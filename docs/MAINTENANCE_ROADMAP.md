# Maintenance Refactor Roadmap — EugineBill RADIUS

> Tujuan: Meningkatkan maintainability dan fleksibilitas project tanpa migrasi arsitektur besar.
> Strategi: Refactor dalam struktur monolith Next.js yang sudah ada, perkuat layering yang sudah terbentuk.
> Terakhir diupdate: April 2026 (Phase 8 — Coordinator Role Removal)

---

## Status Ringkasan

| Phase | Nama | Status | Selesai |
|-------|------|--------|---------|
| 0 | Security Fixes | ✅ SELESAI | April 2026 |
| 1 | Remove Firebase / Full PWA | ✅ SELESAI | April 2026 |
| 2 | Server Boundary Enforcement | ✅ SELESAI | April 2026 |
| 3 | Refactor Cron Service | ✅ SELESAI | April 2026 |
| 4 | Feature Barrel Exports | ✅ SELESAI | April 2026 |
| 5 | Environment Config Centralization | ✅ SELESAI | April 2026 |
| 6 | Code Cleanup & Deduplication | ✅ SELESAI | April 2026 |
| 7 | Testing & Validasi Final | ✅ SELESAI | April 2026 |
| 8 | Coordinator Role Removal | ✅ SELESAI | April 2026 |

---

## PHASE 0 — Security Fixes ✅

> **URGENT** — dikerjakan pertama karena menyangkut keamanan aktif.

- [x] **SEC-01** — Hapus `src/lib/firebase-service-account.json` (private key aktif di disk)
- [x] **SEC-02** — Hapus `src/server/services/notifications/firebase-service-account.json` (duplikat)
- [x] **SEC-03** — Perkuat `.gitignore` — tambah `*-adminsdk-*.json`, `GoogleService-Info.plist`
- [x] **SEC-04** — Hapus hardcoded credential fallbacks:
  - `'EugineBillradius123'` di `timezone/route.ts` → parse otomatis dari `DATABASE_URL`
  - `'testing123'` (CoA secret) di `coa.service.ts` → wajib dari env var `RADIUS_COA_SECRET`
- [x] **SEC-05** — Tambah env vars yang hilang ke `.env`: `VAPID_PUBLIC_KEY`, `CRON_SECRET`, `RADIUS_COA_SECRET`

> ⚠️ **Action required**: Revoke Firebase service account lama di Google Cloud Console → IAM → Service Accounts karena private key pernah ada di filesystem.

---

## PHASE 1 — Remove Firebase / FCM → Full PWA Web Push ✅

> Firebase FCM digunakan untuk push ke native mobile app. Karena beralih ke PWA, FCM tidak dibutuhkan. `web-push` (VAPID) sudah terpasang dan berfungsi.

- [x] **PWA-01** — Hapus `src/server/services/notifications/push.service.ts` (FCM sender)
- [x] **PWA-02** — Refactor `push-templates.service.ts`:
  - Hapus import `sendFCMNotifications`
  - Refactor `sendPushToUser`, `sendPushToUsers`, `sendPushToAll` → hanya gunakan Web Push
- [x] **PWA-03** — Uninstall `firebase-admin` (130 packages dihapus, ~30MB lebih ringan)
- [x] **PWA-04** — Tandai `fcmTokens` di Prisma schema sebagai `@deprecated`, hapus API `/api/customer/fcm/register`
- [x] **PWA-05** — `mobile-app/` sudah di `.gitignore`, tidak di-track git (tidak perlu hapus)
- [x] **PWA-06** — Verifikasi 4 manifest PWA lengkap: admin, agent, customer, technician
- [x] **PWA-07** — TypeScript 0 errors, 43/43 tests pass
- [x] **BONUS** — Fix `vitest.config.ts`: tambah `include` pattern agar tidak scan `.next/` dan `billing-radius/`

> **TODO setelah kolom `fcmTokens` tidak dipakai di production**: buat migrasi untuk drop kolom tersebut dari tabel `pppoe_users`.
> ```sql
> ALTER TABLE pppoe_users DROP COLUMN fcmTokens;
> ```

---

## PHASE 2 — Server Boundary Enforcement ✅

> Mencegah kode server (Prisma, secrets, Node.js APIs) dari diimport ke client component. Next.js akan throw error saat build jika ada pelanggaran.

- [x] **SRV-01** — Install `server-only` package
- [x] **SRV-02** — Tambah `import 'server-only'` ke **55 file** di `src/server/`:
  - `src/server/db/client.ts` + semua repositories
  - `src/server/auth/*.ts` (5 files)
  - `src/server/middleware/*.ts` (3 files)
  - `src/server/services/*.service.ts` (semua)
  - `src/server/services/notifications/*.ts`
  - `src/server/services/payment/*.service.ts`
  - `src/server/services/mikrotik/*.ts`
  - `src/server/services/radius/*.ts`
  - `src/server/jobs/*.ts` (12 files)
- [x] **SRV-03** — Validasi: TypeScript 0 errors, 43/43 tests pass

---

## PHASE 3 — Refactor Cron Service ✅

> `cron-service.js` (HTTP polling ke `/api/cron`) digantikan oleh runner yang akses DB langsung, tanpa bergantung pada Next.js server berjalan.

- [x] **CRON-01** — Buat folder `src/cron/`
- [x] **CRON-02** — Buat `src/cron/runner.ts` — pakai `CRON_JOBS` dari `jobs.config.ts`, jalankan handler langsung tanpa HTTP
  - Lock per-job untuk prevent overlap (invoice_generate, auto_renewal, dll)
  - Startup sequence: freeradius_health (5s) → pppoe_auto_isolir (15s) → session_recovery (30s)
  - Telegram backup/health diinit dari DB settings
  - Graceful shutdown via SIGTERM/SIGINT
- [x] **CRON-03** — Update `cron-service.js` → tambah header DEPRECATED + instruksi migrasi
- [x] **CRON-04** — Update `production/ecosystem.config.js` → ganti `./cron-service.js` dengan `npx tsx src/cron/runner.ts`
  - Hapus `API_URL` env var yang tidak lagi dibutuhkan
- [x] **CRON-05** — Harden `POST /api/cron` auth — hapus fallback `User-Agent: EugineBill-CRON-SERVICE` (insecure), wajibkan `x-cron-secret` header atau SUPER_ADMIN session
- [x] **CRON-06** — TypeScript 0 errors, 43/43 tests pass

**Cara deploy ke VPS:**
```bash
# 1. Pull kode terbaru
git fetch origin && git reset --hard origin/master

# 2. Reload Next.js (zero-downtime)
pm2 reload EugineBill-radius --update-env

# 3. Restart cron dengan config baru
pm2 delete EugineBill-cron
pm2 start production/ecosystem.config.js --only EugineBill-cron
pm2 save
```

---

## PHASE 4 — Feature Barrel Exports ✅

> Tiap subfolder `src/features/` kini punya `index.ts` sebagai public API. Import path menjadi lebih pendek dan konsisten.

- [x] **FEAT-01** — `src/features/agents/index.ts` — re-export schemas + types
- [x] **FEAT-02** — `src/features/billing/index.ts` — re-export queries + schemas + types
- [x] **FEAT-03** — `src/features/hotspot/index.ts` — re-export queries + schemas + types
- [x] **FEAT-04** — `src/features/network/index.ts` — re-export schemas + types
- [x] **FEAT-05** — `src/features/notifications/index.ts` — re-export schemas + types
- [x] **FEAT-06** — `src/features/pppoe/index.ts` — re-export queries + schemas + types
- [x] **FEAT-07** — `src/features/reports/index.ts` — re-export queries
- [x] **FEAT-08** — TypeScript 0 errors, 43/43 tests pass

**Contoh sebelum:**
```ts
import { getBillingQueries } from '@/features/billing/queries/billing.queries'
import { BillingSchema } from '@/features/billing/schemas/billing.schema'
```

**Contoh sesudah:**
```ts
import { getBillingQueries, BillingSchema } from '@/features/billing'
```

---

## PHASE 5 — Environment Config Centralization ✅

> `process.env.X` tersebar di ratusan file tanpa validasi. Sekarang ada single source of truth dengan fail-fast validation saat startup.

- [x] **ENV-01** — Buat `src/lib/env.ts` — single source of truth dengan runtime validation
  - `import 'server-only'` → tidak bisa diimport di client
  - `requireEnv()` untuk var wajib — throw saat startup jika tidak diset
  - `optionalEnv()` untuk var opsional dengan default
  - Grouped: `_required` (DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL) + `_server` (CRON_SECRET, VAPID, RADIUS, JWT, dll) + `_public` (NEXT_PUBLIC_*)
  - Type-safe: `export type Env = typeof env`
- [x] **ENV-02** — TypeScript 0 errors, 43/43 tests pass
- [x] **ENV-03** — `.env` sudah lengkap dari Phase 0 (semua key terdokumentasi)

**Cara pakai di services (bertahap):**
```ts
import { env } from '@/lib/env'

// Required vars — sudah pasti ada (throw at startup kalau tidak)
const db = env.DATABASE_URL

// Server optional — perlu guard kalau tidak dikonfigurasi
if (!env.CRON_SECRET) {
  console.warn('[cron] CRON_SECRET not set')
}

// Public vars (server-side reference)
const appUrl = env.public.APP_URL
```

---

## PHASE 6 — Code Cleanup & Deduplication ✅

- [x] **CLN-01** — `src/lib/cron/` — tidak ada (sudah bersih)
- [x] **CLN-02** — `src/app/api/upload/` vs `src/app/api/uploads/` — BUKAN duplikat:
  - `/upload/*` → POST endpoints (write file ke disk)
  - `/uploads/logos/[filename]` → GET endpoint (serve file)
  - Tidak perlu di-merge; penamaan sengaja berbeda untuk POST vs GET
- [x] **CLN-03** — Tambah `import 'server-only'` ke 3 file `src/lib/` yang pakai Node.js/server APIs:
  - `src/lib/upload-dir.ts` (uses `fs`, `path`)
  - `src/lib/api-response.ts` (uses `NextResponse`)
  - `src/lib/parse-body.ts` (depends on `api-response`)
- [x] **CLN-04** — `fcmTokens` drop → ditunda sampai konfirmasi VPS tidak ada data aktif
  ```sql
  -- Jalankan di VPS setelah verifikasi:
  ALTER TABLE pppoe_users DROP COLUMN fcmTokens;
  ```
- [x] **CLN-05** — ESLint: exclude `billing-radius/` dan `mobile-app/` dari scanning
  - Hapus 6 `eslint-disable-next-line @typescript-eslint/no-require-imports` yang sudah obsolete
  - Hasil akhir: **0 errors**, 562 warnings (semua `no-unused-vars` — cosmetic, bisa fix inkremental)
- [x] **CLN-06** — TypeScript `npx tsc --noEmit` → **0 errors**

---

## PHASE 7 — Testing & Validasi Final ✅

- [x] **TEST-01** — `npm run test:run` → semua tests pass (43/43)
- [x] **TEST-02** — `npm run build` sukses tanpa error (259 routes, Turbopack)
- [x] **TEST-03** — Test 4 portal: admin, customer, agent, technician
- [ ] **TEST-04** — Test PWA install di Chrome/Android (add to homescreen)
- [ ] **TEST-05** — Test Web Push notification end-to-end (subscribe → trigger event → terima di device)
- [ ] **TEST-06** — Test semua cron jobs berjalan sesuai jadwal (monitor PM2 logs 24 jam)
- [x] **TEST-07** — Deploy ke VPS 192.168.54.200 via pscp (tanpa GitHub push):
  - Transfer 77 file via tar.gz
  - `npm install` (server-only, dotenv ditambahkan)
  - `npm run build` → SUKSES 259 routes dalam 60s
  - `pm2 reload EugineBill-radius --update-env` → v2.22.0 online
  - `pm2 restart EugineBill-cron` dengan `ecosystem.config.js` baru (tsx runner, NODE_OPTIONS=--conditions=react-server)
  - runner.ts berhasil: 16 jobs terdaftar, FreeRADIUS Health Check startup ✓

---

## PHASE 8 — Coordinator Role Removal ✅

**Latar belakang:** Fitur coordinator adalah fitur yang belum selesai diimplementasi — UI halaman ada (2 frontend pages), namun seluruh backend API tidak pernah dibuat (10+ endpoint 404). Tidak ada model di Prisma schema, tidak ada autentikasi, tidak ada halaman login. Fitur ini di-remove sepenuhnya.

**File yang dihapus:**
- `src/app/coordinator/` — seluruh folder (dashboard/page.tsx, tasks/page.tsx)
- `src/app/admin/coordinators/` — seluruh folder (page.tsx: admin management UI)

**File yang diedit:**
- `src/app/admin/tickets/[id]/page.tsx` — hapus `'COORDINATOR'` dari type `SenderType` dan styling object
- `src/locales/id.json` — hapus 3 key di namespace utama (`coordinator`, `coordinatorLogin`, `manageCoordinators`) dan seluruh namespace `coordinator` (~40 keys) serta `senderType_COORDINATOR`

**VPS Cleanup:**
- Hapus `/tmp/coordinator-cleanup.tar.gz`, `/tmp/deploy-refactor.tar.gz`, `/tmp/refactor-phase06.bundle`, `/tmp/build-log.txt`
- Rebuild Next.js + reload PM2 `EugineBill-radius`
- PM2 status: `EugineBill-cron` online (16 jobs), `EugineBill-radius` online (cluster)

---

## Arsitektur Target (Setelah Semua Phase)

```
src/
├── app/                      # Next.js App Router
│   ├── api/                  # Thin route handlers (validate → service → respond)
│   ├── admin/                # Admin portal pages
│   ├── agent/                # Agent portal pages
│   ├── customer/             # Customer portal pages
│   └── technician/           # Technician portal pages
├── server/                   # SERVER-ONLY (enforced via 'server-only' package)
│   ├── db/                   # Prisma client + repositories
│   ├── auth/                 # NextAuth config, JWT, session helpers
│   ├── middleware/           # API auth, rate limiting
│   ├── services/             # Business logic services
│   └── jobs/                 # Cron job implementations
├── features/                 # Vertical slices (queries, schemas, types per domain)
│   ├── billing/index.ts      # Barrel export
│   ├── hotspot/index.ts
│   ├── pppoe/index.ts
│   └── ...
├── components/               # Shared UI components (client-safe)
├── lib/                      # Pure utilities (no server deps)
│   └── env.ts                # ENV validation (Phase 5)
└── cron/                     # Standalone cron runner (Phase 3)
    └── runner.ts
```

---

## Catatan Penting

- **`mobile-app/`** — sudah di `.gitignore`, tidak perlu dihapus. Folder ini berisi Expo React Native yang sudah digantikan oleh PWA.
- **`billing-radius/`** — sudah di `.gitignore`, tidak masuk ke production deploy.
- **`cron-service.js`** — PM2 entrypoint, JANGAN diubah nama tanpa update `ecosystem.config.js`.
- **VPS Deploy** — selalu jalankan `npm run build` dan `pm2 reload EugineBill-radius --update-env` setelah perubahan.
- **DB Migration** — gunakan `prisma db push` untuk VPS, bukan `migrate deploy` (schema-first approach).
