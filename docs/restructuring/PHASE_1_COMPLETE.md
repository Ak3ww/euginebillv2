# Phase 1 — Foundation Setup ✅ COMPLETE
> **Tanggal:** March 10, 2026  
> **Status:** ✅ Selesai  
> **Validasi:** `npx tsc --noEmit` → Exit Code 0 (no errors)

---

## Apa yang Dilakukan

### 1. Backup Project
- Backup folder: `c:\Users\yanz\Downloads\EugineBill-radius-BACKUP-PRE-RESTRUCTURE\`
- 490 file di `src/` berhasil di-mirror (tanpa node_modules/.next)

### 2. Buat Struktur Folder Baru
```
src/
├── server/                    ← BARU — semua server-only code
│   ├── db/
│   │   ├── client.ts          ← Prisma singleton (dipindahkan)
│   │   └── repositories/     ← Kosong (diisi di Phase 2)
│   ├── services/             ← Kosong (diisi di Phase 2)
│   ├── cache/
│   │   ├── redis.ts          ← Redis client (dipindahkan)
│   │   └── online-users.cache.ts ← Online users tracker (dipindahkan)
│   ├── auth/
│   │   ├── config.ts          ← NextAuth config + auth helpers (dipindahkan)
│   │   └── permissions.ts     ← RBAC permissions (dipindahkan)
│   ├── middleware/
│   │   ├── api-auth.ts        ← API auth checker (dipindahkan)
│   │   └── rate-limit.ts      ← Rate limiting (dipindahkan)
│   └── jobs/                 ← Kosong (diisi di Phase 5)
├── features/                 ← Kosong (diisi di Phase 3)
└── lib/
    └── validators/           ← Kosong (diisi di Phase 3)
```

### 3. File yang Dipindahkan

| File Lama (src/lib/) | File Baru (src/server/) | Isi/Fungsi |
|---|---|---|
| `prisma.ts` | `server/db/client.ts` | Prisma client singleton — koneksi database tunggal yang dipakai seluruh server code. |
| `redis.ts` | `server/cache/redis.ts` | Redis client dengan graceful fallback — jika Redis mati, app tetap jalan pakai in-memory. Berisi helpers: `redisGet`, `redisSet`, `redisDel`, `redisIncr`, `redisSetNX`, `cacheGetOrSet`, `RedisKeys`. |
| `online-users.ts` | `server/cache/online-users.cache.ts` | Online user tracker — mark online/offline dari RADIUS accounting, count online users, sync ke Redis. Fallback ke MySQL query jika Redis mati. |
| `auth.ts` | `server/auth/config.ts` | NextAuth configuration — credential provider (username/password + 2FA TOTP), JWT callbacks, session strategy (2 jam). Juga berisi: `HttpError` class, `handleRouteError()`, `verifyAuth()`, `requireAuth()`, `requireRole()`, `requireAdmin()`, `requireStaff()`. |
| `permissions.ts` | `server/auth/permissions.ts` | Permission system RBAC — query user/role permissions dari DB. Berisi: `getUserPermissions()`, `hasPermission()`, `hasAnyPermission()`, `isSuperAdmin()`, `setUserPermissions()`, `resetUserPermissionsToRole()`. |
| `apiAuth.ts` | `server/middleware/api-auth.ts` | API route auth helpers — `checkAuth()` (cek session), `checkPermission()` (cek izin spesifik), `requirePermission()` (combined check auth+permission). Dipakai di awal setiap API route handler. |
| `rate-limit.ts` | `server/middleware/rate-limit.ts` | API rate limiting — Redis-backed (fallback in-memory). Berisi: `rateLimit()`, `RateLimitPresets` (auth: 5/min, api: 60/min, upload: 10/min), `getRateLimitInfo()`. |

### 4. Strategi Re-Export Proxy (Zero Breakage)

Setiap file lama di `src/lib/` diubah menjadi **re-export proxy** — isinya hanya `export ... from '@/server/...'`. Ini berarti:

- ✅ **190 file** yang import `@/lib/prisma` tetap berjalan normal
- ✅ **138 file** yang import `@/lib/auth` tetap berjalan normal
- ✅ **9 file** yang import `@/lib/apiAuth` tetap berjalan normal
- ✅ **8 file** yang import `@/lib/redis` tetap berjalan normal
- ✅ **5 file** yang import `@/lib/rate-limit` tetap berjalan normal
- ✅ **3 file** yang import `@/lib/permissions` tetap berjalan normal

File lama ditandai `@deprecated` agar jelas bagi developer: gunakan path baru.

Contoh `src/lib/prisma.ts` sekarang:
```typescript
/**
 * @deprecated Import dari '@/server/db/client' sebagai gantinya.
 */
export { prisma } from '@/server/db/client'
```

### 5. Import Internal yang Diupdate

File-file di `src/server/` diupdate agar import satu sama lain via path absolut `@/server/*`:

| File | Import Lama | Import Baru |
|---|---|---|
| `server/auth/config.ts` | `./prisma` | `@/server/db/client` |
| `server/auth/permissions.ts` | `./prisma` | `@/server/db/client` |
| `server/middleware/api-auth.ts` | `./auth`, `./permissions` | `@/server/auth/config`, `@/server/auth/permissions` |
| `server/middleware/rate-limit.ts` | `./redis` | `@/server/cache/redis` |
| `server/cache/online-users.cache.ts` | `./prisma`, `./redis` | `@/server/db/client`, `@/server/cache/redis` |

### 6. tsconfig.json — Tidak Perlu Diubah

Path alias `@/*` → `./src/*` sudah mencakup semua subfolder baru:
- `@/server/*` → `./src/server/*` ✅
- `@/features/*` → `./src/features/*` ✅

---

## Cara Import Setelah Phase 1

### Untuk code baru — gunakan path baru:
```typescript
import { prisma } from '@/server/db/client'
import { authOptions, requireAuth } from '@/server/auth/config'
import { hasPermission } from '@/server/auth/permissions'
import { checkAuth, requirePermission } from '@/server/middleware/api-auth'
import { rateLimit } from '@/server/middleware/rate-limit'
import { getRedisClient, RedisKeys } from '@/server/cache/redis'
import { markUserOnline, getOnlineCount } from '@/server/cache/online-users.cache'
```

### Untuk code lama — masih berjalan (via proxy):
```typescript
import { prisma } from '@/lib/prisma'          // → re-export dari @/server/db/client
import { authOptions } from '@/lib/auth'        // → re-export dari @/server/auth/config
```

---

## Next: Phase 2 — Service Layer Extraction

Akan memindahkan:
- Payment services (Midtrans, Xendit, Duitku, Tripay)
- Notification services (WhatsApp, Email, Firebase, Telegram)
- MikroTik services
- RADIUS services (FreeRADIUS, CoA)
- Billing services (Invoice generator)
- Dan membuat repository layer (Data Access Layer)
