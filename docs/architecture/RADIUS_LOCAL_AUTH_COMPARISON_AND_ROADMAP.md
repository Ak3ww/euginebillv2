# 📡 MASTER BLUEPRINT: RADIUS & LOCAL AUTH COMPARISON & UPGRADE ROADMAP
## Analisis Komprehensif Salfanet-Radius vs EugineBill serta Perencanaan Adopsi Sistem

> **Dokumen Arsitektur & Perencanaan Sistem**  
> **Target Sistem:** EugineBill RADIUS Platform  
> **Referensi Analisis:** Salfanet-Radius (v5.20.0, April–September 2026)  
> **Status:** Approved Architectural Blueprint  
> **Tanggal:** 10 September 2026  

---

## DAFTAR ISI
1. [Executive Summary](#1-executive-summary)
2. [Hasil Audit Mendalam: Arsitektur Salfanet-Radius](#2-hasil-audit-mendalam-arsitektur-salfanet-radius)
   - [2.1 Per-Router Auth Mode & Penghapusan Hybrid](#21-per-router-auth-mode--penghapusan-hybrid)
   - [2.2 Konfigurasi FreeRADIUS (SQL vs REST Module)](#22-konfigurasi-freeradius-sql-vs-rest-module)
   - [2.3 Analisis REST Hook: Authorize, Post-Auth, Accounting](#23-analisis-rest-hook-authorize-post-auth-accounting)
   - [2.4 Alur CoA / Disconnect 3-Tier Hierarchy](#24-alur-coa--disconnect-3-tier-hierarchy)
   - [2.5 Konsep "Synthetic Radacct" & Analisis Bahayanya](#25-konsep-synthetic-radacct--analisis-bahayanya)
   - [2.6 Transactional Outbox Pattern (`external_task`)](#26-transactional-outbox-pattern-external_task)
   - [2.7 Fitur Unggulan Lain Salfanet](#27-fitur-unggulan-lain-salfanet)
   - [2.8 Evaluasi Kritis: Tech Debt & Bug Salfanet yang Wajib Dihindari](#28-evaluasi-kritis-tech-debt--bug-salfanet-yang-wajib-dihindari)
3. [Hasil Audit Mendalam: Arsitektur EugineBill Eksisting](#3-hasil-audit-mendalam-arsitektur-euginebill-eksisting)
   - [3.1 Kondisi Eksisting Global Toggle RADIUS](#31-kondisi-eksisting-global-toggle-radius)
   - [3.2 Model Router & Pencatatan Sesi Eksisting](#32-model-router--pencatatan-sesi-eksisting)
   - [3.3 Keunggulan Utama EugineBill yang Wajib Dipertahankan](#33-keunggulan-utama-euginebill-yang-wajib-dipertahankan)
4. [Gap Analysis: Apa yang Perlu Dikejar vs Apa yang Harus Ditolak](#4-gap-analysis-apa-yang-perlu-dikejar-vs-apa-yang-harus-ditolak)
   - [4.1 Matriks Komparasi 14 Parameter Teknis](#41-matriks-komparasi-14-parameter-teknis)
   - [4.2 Fitur yang Wajib Dikejar (High Priority)](#42-fitur-yang-wajib-dikejar-high-priority)
   - [4.3 Fitur yang Harus Ditolak / Dihindari (Anti-Patterns)](#43-fitur-yang-harus-ditolak--dihindari-anti-patterns)
5. [Blueprint Rencana Implementasi Bertahap (Execution Roadmap)](#5-blueprint-rencana-implementasi-bertahap-execution-roadmap)
   - [Fase 1: Skema Prisma & Per-Router Auth Mode Engine](#fase-1-skema-prisma--per-router-auth-mode-engine)
   - [Fase 2: Endpoint 1-Klik Migrasi & Sinkronisasi Router](#fase-2-endpoint-1-klik-migrasi--sinkronisasi-router)
   - [Fase 3: Pembaruan Antarmuka Admin (/admin/network/routers)](#fase-3-pembaruan-antarmuka-admin-adminnetworkrouters)
   - [Fase 4: Transactional Outbox untuk Panggilan MikroTik API](#fase-4-transactional-outbox-untuk-panggilan-mikrotik-api)
   - [Fase 5: Rekapitulasi Voucher Hotspot Tingkat Lanjut](#fase-5-rekapitulasi-voucher-hotspot-tingkat-lanjut)
6. [Panduan Verifikasi & Rollback Safety](#6-panduan-verifikasi--rollback-safety)

---

## 1. EXECUTIVE SUMMARY

Tujuan dari dokumen ini adalah membedah secara menyeluruh arsitektur sistem **Salfanet-Radius** (`C:\salfanet-radius`, versi `v5.20.0`), membandingkannya secara obyektif dengan **EugineBill** (`C:\EugineBill`), serta menyusun rencana strategis mengenai:
1. Fitur dan pola arsitektur apa saja dari Salfanet yang **unggul, matang, dan sangat penting untuk kita kejar/adopsi**.
2. Bagian mana dari Salfanet yang **terlalu rumit (*overengineered*), rapuh, atau mengandung cacat bawaan (*architectural anti-patterns*)** sehingga **HARUS KITA TOLAK** demi menjaga stabilitas produksi EugineBill.
3. Bagaimana merancang peningkatan sistem autentikasi EugineBill (mendukung mode autentikasi *Per-Router* dan migrasi 1-klik) tanpa merusak kehandalan monolitik Next.js yang sudah terbukti stabil di lapangan.

---

## 2. HASIL AUDIT MENDALAM: ARSITEKTUR SALFANET-RADIUS

Audit dilakukan oleh subagent auditor terhadap seluruh tree source code Salfanet (`backend/`, `frontend/`, `freeradius-config/`, dan riwayat commit Git).

### 2.1 Per-Router Auth Mode & Penghapusan Hybrid
Pada skema database Salfanet (`backend/prisma/schema.prisma`), model router (`nas`) mendefinisikan:
```prisma
authMode String @default("radius") // "local" | "radius" (hybrid removed - use local OR radius only)
```
- **Latar Belakang Penghapusan Hybrid:** Salfanet awalnya mencoba mode *hybrid* (autentikasi jalan di lokal sekaligus RADIUS). Hasilnya di lapangan terjadi *race condition* parah: MikroTik bingung menggunakan secret lokal atau RADIUS, limitasi bandwidth tertimpa acak, dan disconnect CoA sering ditolak. Salfanet akhirnya menetapkan pemisahan tegas:
  - **Mode `local`**: MikroTik PPP secret aktif (`disabled: false`). RADIUS tables tetap diisi sebagai cadangan tapi tidak dipakai auth. Otorisasi isolir dilakukan via MikroTik API `/ppp/secret/set profile=isolir`.
  - **Mode `radius`**: FreeRADIUS MySQL aktif penuh (`radcheck`, `radusergroup`, `radreply`). PPP secret di MikroTik dibuat tapi berstatus `disabled: true` (sebagai cold backup). Otorisasi isolir ditangani via RADIUS (`radusergroup` diubah ke group `isolir`), dan sesi diputus via CoA Disconnect.

### 2.2 Konfigurasi FreeRADIUS (SQL vs REST Module)
Struktur di `backend/freeradius-config/`:
- **`mods-available/sql`**: Menggunakan driver `rlm_sql_mysql` langsung ke port 3306. Mengatur `read_clients = no` karena pembacaan client NAS dialihkan ke file statis `clients.d/nas-from-db.conf` yang di-generate berkala oleh cron (`syncNasClients()`).
- **`mods-available/rest`**: Mengarahkan FreeRADIUS melakukan HTTP calls ke backend Node.js (`http://localhost:3001`).
- **`sites-available/default`**: Memanggil modul secara berurutan: `preprocess -> chap -> mschap -> files -> -rest -> sql -> expiration -> pap`. Tanda minus (`-rest`) bersifat non-fatal, sehingga jika API web mati, FreeRADIUS mencoba lanjut ke modul SQL.

### 2.3 Analisis REST Hook: Authorize, Post-Auth, Accounting
1. **`POST /api/radius/authorize`**:
   - Memeriksa status voucher hotspot atau pelanggan PPPoE sebelum autentikasi selesai.
   - Jika voucher expired atau pelanggan berstatus `blocked`/`stop`, mengembalikan:
     ```json
     { "control:Auth-Type": "Reject", "reply:Reply-Message": "Pesan Spesifik Isolir" }
     ```
   - Tujuannya: Agar log di MikroTik menampilkan alasan penolakan yang jelas bagi teknisi lapangan (bukan sekadar *"wrong password"*).
2. **`POST /api/radius/post-auth`**:
   - Dipanggil saat login berhasil (`reply === "Access-Accept"`).
   - Menghitung `firstLoginAt` dan masa aktif voucher (`expiresAt = now + validityValue`), serta langsung memasukkan mutasi kas keuangan (`transaction`) dan komisi agen secara otomatis.
3. **`POST /api/radius/accounting`**:
   - Bertindak sebagai event receiver audit log. SQL module FreeRADIUS tetap yang melakukan insert/update fisik ke tabel `radacct`.

### 2.4 Alur CoA / Disconnect 3-Tier Hierarchy
Implementasi di `backend/src/server/services/radius/coa-handler.service.ts`:
- **Tier 1 (Database First)**: Langsung mengupdate baris `radacct` (`acctstoptime = nowWIB()`, `acctterminatecause = 'Admin-Reset'`). Ini menjamin data di dashboard seketika terlihat offline tanpa menunggu respons jaringan.
- **Tier 2 (RADIUS CoA Disconnect via `radclient`)**: Mengirim paket UDP Disconnect-Request port 3799 langsung ke IP router MikroTik dengan timeout singkat (2 detik).
- **Tier 3 (MikroTik API Fallback)**: Jika CoA gagal/timeout (misal router di balik NAT tanpa port forwarding), sistem membuka socket RouterOS API port 8728, mencari sesi aktif via `/ppp/active/print ?name=username`, lalu mengeksekusi `/ppp/active/remove`.

### 2.5 Konsep "Synthetic Radacct" & Analisis Bahayanya
Pada mode `local`, MikroTik tidak mengirimkan accounting RADIUS ke database. Untuk menampilkan sesi aktif di dashboard, Salfanet membuat cron `pppoe_session_sync` yang membaca `/ppp/active` dari MikroTik lalu meng-insert baris palsu ke `radacct` dengan format ID:
```sql
acctsessionid = 'mt-sync-' + Date.now() + '-' + username.slice(0, 8)
```
> [!CAUTION]
> **BAHAYA FATAL SYNTHETIC RADACCT:**  
> ID sesi buatan ini **tidak cocok** dengan `Acct-Session-Id` internal MikroTik. Ketika router mengirimkan paket `Accounting-Stop` asli, FreeRADIUS gagal mencocokkan sesi tersebut, menghasilkan ribuan sesi hantu (*ghost sessions*) yang menggantung di database. Riwayat commit Salfanet membuktikan mereka berulang kali merilis bugfix darurat (`c4c397b7`, `06fbab01`, `70bb8213`) karena cron ini salah menutup voucher hotspot aktif dan merusak analitik trafik.

### 2.6 Transactional Outbox Pattern (`external_task`)
Implementasi di `backend/src/server/services/external-task.service.ts`:
- Menggunakan tabel `external_task` untuk mencatat operasi eksternal (MikroTik sync, WhatsApp, Email, CoA) di dalam transaksi database `$transaction` yang sama dengan mutasi pelanggan.
- **State Machine**: `PENDING -> PROCESSING -> SUCCESS / FAILED -> DEAD`.
- **Atomic Claiming**: Update status menggunakan conditional query `where: { id, status: 'PENDING' }` sehingga aman dari bentrokan multi-worker.
- **Retry Backoff**: 30 detik, 2 menit, 5 menit, 15 menit, 30 menit. Jika gagal 5 kali berturut-turut, task berstatus `DEAD` dan mengirimkan notifikasi alert ke Telegram admin.

### 2.7 Fitur Unggulan Lain Salfanet
1. **Rekapitulasi Voucher Hotspot**: Laporan komprehensif yang membedakan voucher yang sudah login (`firstLoginAt`) dengan stok batch yang belum terpakai, lengkap dengan filter agen dan margin keuntungan.
2. **FTTH Topology & Cable Tracing**: Pemetaan visual kabel FO dari OLT -> FDT/ODC -> ODP hingga port pelanggan, termasuk kalkulasi redaman optik.
3. **TR-069 via GenieACS**: Remote management ONT untuk ganti SSID, password WiFi, dan reboot modem dari jauh.
4. **Graceful Cache-Aside Redis**: Pustaka `redis.ts` yang otomatis fallback ke query MySQL langsung jika service Redis mati/down (*zero crash*).

### 2.8 Evaluasi Kritis: Tech Debt & Bug Salfanet yang Wajib Dihindari
1. **Titik Kegagalan Fatal FreeRADIUS REST Hook**: Menggantungkan autentikasi internet pada server Node.js port 3001 sangat berbahaya. Saat web server restart atau CPU spike, FreeRADIUS REST timeout dan seluruh pelanggan satu ISP serentak terputus internetnya (*mass outage*).
2. **Crash `node-routeros` Unhandled Reply**: Bug di mana pustaka MikroTik melemparkan error `UNKNOWNREPLY: !empty` saat query mengembalikan hasil kosong.
3. **Pencemaran Tabel `radacct`**: Mencampur sesi lokal buatan dengan sesi RADIUS asli terbukti menimbulkan inkonsistensi data akuntansi jangka panjang.

---

## 3. HASIL AUDIT MENDALAM: ARSITEKTUR EUGINEBILL EKSISTING

### 3.1 Kondisi Eksisting Global Toggle RADIUS
Di EugineBill, kendali mode RADIUS saat ini tersimpan di tabel `companies`:
- `radiusPppoeEnabled` (Boolean)
- `radiusHotspotEnabled` (Boolean)

Jika `radiusPppoeEnabled = false`, seluruh router dianggap lokal. Jika `true`, seluruh router dipaksa menggunakan FreeRADIUS. Pendekatan ini menyulitkan ISP yang memiliki banyak router cabang dan ingin melakukan migrasi bertahap per wilayah.

### 3.2 Model Router & Pencatatan Sesi Eksisting
- Model `router` di Prisma di-mapping langsung ke tabel FreeRADIUS `@@map("nas")`, namun **belum memiliki kolom `authMode`**.
- **Pencatatan Sesi**:
  - Mode RADIUS: Menggunakan tabel standar `radacct` (diisi langsung oleh C daemon FreeRADIUS via `rlm_sql`).
  - Mode Non-RADIUS / Lokal: Menggunakan tabel terpisah `mikrotikSession` yang diisi oleh worker poller berkala.
  - Model `sessions` (legacy) sudah tidak digunakan lagi dan aman untuk dibersihkan.

### 3.3 Keunggulan Utama EugineBill yang Wajib Dipertahankan
1. **Single Next.js Monolith**: Sangat hemat RAM/CPU (berjalan stabil di VPS 1–2 GB RAM), proses build tunggal `npm run build`, dan deployment PM2 sangat mudah tanpa reverse-proxy Nginx multi-port internal.
2. **ONT Remote Proxy Architecture (`socat` + Dynamic NAT port 24000-24999)**: Mekanisme remote web GUI modem ONT pelanggan ZTE/Huawei/Fiberhome yang aman, cepat, dan bekerja sempurna melewati tunnel VPN.
3. **Balance Privacy Mode (`src/lib/balance-privacy.ts`)**: Fitur sensor nominal saldo/omzet (`Rp ••••••`) di dashboard dan invoice yang sangat disukai pengguna untuk menjaga privasi finansial.
4. **Clean Accounting Cascade & PPPoE Reuse Shield**: Perlindungan database saat penghapusan pelanggan berhenti: invoice lunas tetap disimpan sebagai arsip, dan akun PPPoE yang di-reuse oleh pelanggan aktif terlindungi 100% dari penghapusan secret router.
5. **FreeRADIUS Direct MySQL (`rlm_sql`) Tanpa REST Hook**: Autentikasi internet pelanggan berjalan langsung di level C daemon ke MySQL. Web admin Next.js mati atau di-restart sama sekali **tidak mempengaruhi koneksi internet pelanggan**.

---

## 4. GAP ANALYSIS: APA YANG PERLU DIKEJAR VS APA YANG HARUS DITOLAK

### 4.1 Matriks Komparasi 14 Parameter Teknis

| No | Parameter Teknis | Salfanet-Radius | EugineBill Eksisting | Status Keputusan |
|:--:|---|---|---|---|
| 1 | **Skema Auth Router** | Per-Router (`router.authMode`) | Global (`company.radiusPppoeEnabled`) | **WAJIB DIKEJAR** |
| 2 | **1-Klik Migrasi Auth Router** | Ada (`bulk-migrate-radius` & `migrate-local-auth`) | Manual via script | **WAJIB DIKEJAR** |
| 3 | **Antrean Tugas Eksternal (Outbox)** | Ada (`external_task` + retry backoff) | Inline try/catch | **WAJIB DIKEJAR** |
| 4 | **FreeRADIUS REST Hook** | Menggunakan `rlm_rest` HTTP port 3001 | Direct MySQL `rlm_sql` | **HARUS DITOLAK (Bahaya)** |
| 5 | **Pencatatan Sesi Non-RADIUS** | Synthetic `radacct` (sesi palsu) | Terpisah di `mikrotikSession` | **PERTAHANKAN EUGINEBILL** |
| 6 | **CoA Disconnect Hierarchy** | DB-first -> UDP CoA -> MikroTik API | DB-first -> UDP CoA -> MikroTik API | **SUDAH SETARA** |
| 7 | **Rekapitulasi Voucher Hotspot** | Rekap detail first login vs batch | Rekap standar | **BAGUS DIADOPSI** |
| 8 | **Remote Akses Web GUI ONT** | Routing IP publik / VPN manual | Proxy Port `socat` + NAT dinamis | **PERTAHANKAN EUGINEBILL** |
| 9 | **Privasi Finansial (Hide Balance)** | Tidak ada | Ada (`Balance Privacy Mode`) | **PERTAHANKAN EUGINEBILL** |
| 10 | **Dynamic Interim Interval** | Disuntik di RADIUS post-auth (300s) | Manual di MikroTik profile | **BAGUS DIADOPSI** |
| 11 | **Beban Server / Arsitektur App** | Monorepo terpisah (Next + Nest + Redis) | Monolith Next.js terpadu | **PERTAHANKAN EUGINEBILL** |
| 12 | **Koneksi TR-069 GenieACS** | REST NBI + Direct MongoDB | REST NBI murni | **PERTAHANKAN EUGINEBILL** |
| 13 | **Multi-NAS Scoping** | Kolom `nas_identifier` di radcheck | Scoping per router / username | **BAGUS DIADOPSI** |
| 14 | **Proteksi PPPoE Reuse** | Peringatan dasar di UI | Multi-layer shield di DB & API | **PERTAHANKAN EUGINEBILL** |

---

### 4.2 Fitur yang Wajib Dikejar (High Priority)
1. **Per-Router `authMode` (`local` vs `radius`)**: Memberikan fleksibilitas penuh bagi ISP untuk mengatur router mana yang menggunakan RADIUS dan mana yang tetap lokal.
2. **Tombol Migrasi 1-Klik di Halaman Router**:
   - `Migrate to RADIUS`: Sync profil ke `radgroupreply`, push user ke `radcheck`/`radusergroup`/`radreply`, disable secret di MikroTik, dan kick sesi via CoA.
   - `Migrate to Local`: Bulk create/enable secret di MikroTik, kick sesi agar dial lokal, ubah mode router ke `local`.
   - `Re-sync RADIUS`: Memperbaiki integritas tabel FreeRADIUS tanpa mengubah mode router.
3. **Transactional Outbox Queue (`externalTask`)**: Mengisolasi pemanggilan socket MikroTik API dan pengiriman pesan WhatsApp agar form submission di web admin merespons instan (<300ms) tanpa resiko timeout.
4. **Rekapitulasi Voucher Hotspot Terpadu**: Pemisahan laporan omzet voucher terpakai (first login) vs stok voucher yang belum diaktifkan.

---

### 4.3 Fitur yang Harus Ditolak / Dihindari (Anti-Patterns)
1. **JANGAN GUNAKAN Modul REST FreeRADIUS (`rlm_rest`)**:  
   Tetap pertahankan arsitektur FreeRADIUS direct MySQL (`rlm_sql`). Autentikasi internet ribuan pelanggan tidak boleh bergantung pada kestabilan proses Node.js.
2. **JANGAN GUNAKAN "Synthetic Radacct"**:  
   Jangan pernah mencampurkan sesi lokal buatan ke dalam tabel `radacct`. Tetap gunakan tabel `mikrotikSession` untuk router lokal guna menjaga integritas akuntansi RADIUS.
3. **JANGAN Memecah Monolith Menjadi Monorepo Frontend/Backend Terpisah**:  
   Monolith Next.js EugineBill terbukti jauh lebih hemat resource di VPS dan bebas dari masalah CORS serta koordinasi deploy multi-port.

---

## 5. BLUEPRINT RENCANA IMPLEMENTASI BERTAHAP (EXECUTION ROADMAP)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    ROADMAP UPGRADE ARSITEKTUR EUGINEBILL                │
├─────────────────┬───────────────────┬──────────────────┬────────────────┤
│     FASE 1      │      FASE 2       │      FASE 3      │     FASE 4     │
│ Skema Database  │   API Migrasi     │    UI Admin &    │  Outbox Queue  │
│ & Auth Resolver │  Router 1-Klik    │ Action Dashboard │  & Rekap Hotspot│
└─────────────────┴───────────────────┴──────────────────┴────────────────┘
```

### Fase 1: Skema Prisma & Per-Router Auth Mode Engine

#### 1.1 Penambahan Kolom di `prisma/schema.prisma`
Tambahkan kolom `authMode` pada model `router`:
```prisma
model router {
  id             String             @id
  name           String
  nasname        String
  shortname      String
  type           String             @default("mikrotik")
  authMode       String?            @default("local") // "local" | "radius"
  ipAddress      String
  username       String
  password       String
  port           Int                @default(8728)
  apiPort        Int                @default(8729)
  secret         String             @default("secret123")
  ports          Int                @default(1812)
  ...
}
```

#### 1.2 Helper Resolver Terpusat (`src/server/services/router-auth.service.ts`)
Fungsi ini menjamin **100% backward-compatibility**: jika `router.authMode` belum diset (null), sistem otomatis menggunakan nilai fallback dari toggle global `company.radiusPppoeEnabled`:
```typescript
import { prisma } from '@/server/db/client';

export type EffectiveAuthMode = 'local' | 'radius';

export async function resolveRouterAuthMode(routerId?: string | null): Promise<EffectiveAuthMode> {
  if (!routerId) {
    const company = await prisma.company.findFirst({ select: { radiusPppoeEnabled: true } });
    return company?.radiusPppoeEnabled ? 'radius' : 'local';
  }

  const router = await prisma.router.findUnique({
    where: { id: routerId },
    select: { authMode: true },
  });

  if (router?.authMode === 'radius' || router?.authMode === 'local') {
    return router.authMode;
  }

  const company = await prisma.company.findFirst({ select: { radiusPppoeEnabled: true } });
  return company?.radiusPppoeEnabled ? 'radius' : 'local';
}
```

---

### Fase 2: Endpoint 1-Klik Migrasi & Sinkronisasi Router

Bangun 3 endpoint baru di bawah modul router:
1. **`POST /api/network/routers/[id]/migrate-radius`**:
   - Memvalidasi kredensial router & koneksi FreeRADIUS.
   - Menyinkronkan seluruh profile paket ke `radgroupreply` (`Mikrotik-Rate-Limit`, `Pool-Name`).
   - Melakukan bulk upsert kredensial pelanggan router ke `radcheck`, `radusergroup`, dan `radreply`.
   - Mengubah seluruh PPP secret di router MikroTik menjadi `disabled=yes` via RouterOS API.
   - Mengubah `router.authMode = 'radius'`.
   - Mengirimkan CoA disconnect / kick session agar modem pelanggan langsung re-auth via FreeRADIUS.
2. **`POST /api/network/routers/[id]/migrate-local`**:
   - Membaca semua user aktif/isolir pada router tersebut di database.
   - Melakukan bulk create/update secret di MikroTik menjadi `disabled=no` (atau profile `isolir`).
   - Mengubah `router.authMode = 'local'`.
   - Menendang sesi aktif agar ONT kembali menggunakan autentikasi lokal MikroTik.
3. **`POST /api/network/routers/[id]/resync-radius`**:
   - Memperbaiki data tabel FreeRADIUS yang *out-of-sync* untuk router tersebut tanpa merubah status mode router.

---

### Fase 3: Pembaruan Antarmuka Admin (`/admin/network/routers`)

Perbarui halaman daftar router (`src/app/admin/network/routers/page.tsx`):
- Menampilkan badge indikator status autentikasi router:
  - **Badge Hijau**: `Local Auth` (MikroTik Secret Primary)
  - **Badge Biru**: `FreeRADIUS Auth` (FreeRADIUS Primary, Secret Backup)
- Menambahkan Action Buttons pada card/tabel router:
  - Tombol **"Migrate to RADIUS"** (muncul jika mode saat ini `local`).
  - Tombol **"Migrate to Local"** (muncul jika mode saat ini `radius`).
  - Tombol **"Re-sync RADIUS"** (memperbaiki data FreeRADIUS).
- Dialog konfirmasi interaktif transparan yang menjelaskan apa yang akan dilakukan sistem sebelum migrasi dieksekusi.

---

### Fase 4: Transactional Outbox untuk Panggilan MikroTik API

Buat model dan service outbox ringan untuk memisahkan mutasi database dari panggilan soket MikroTik:
- **Tabel Prisma**: `external_task` (`id`, `entityType`, `entityId`, `operation`, `status`, `payload`, `retryCount`, `nextRetryAt`).
- **Worker Cron**: Dijalankan setiap 1 menit via `cron-runner` untuk mengeksekusi antrean yang tertunda.
- **Keuntungan**: Saat admin mengedit pelanggan atau menekan tombol lunas, UI merespons seketika dalam waktu <200ms. Jika router MikroTik sedang offline sesaat, antrean akan otomatis mencoba kembali saat router hidup kembali.

---

### Fase 5: Rekapitulasi Voucher Hotspot Tingkat Lanjut

- Bangun halaman dan API `/admin/hotspot/rekap`:
  - Rekap penjualan berbasis `firstLoginAt` (transaksi nyata saat voucher dicolokkan pertama kali ke internet).
  - Pembagian komisi agen vs kas owner yang tercatat otomatis di buku kas umum (`keuangan`).
  - Laporan ekspor Excel dan PDF server-side sesuai standar sistem EugineBill.

---

## 6. PANDUAN VERIFIKASI & ROLLBACK SAFETY

1. **Non-Breaking Database Migration**:
   - Kolom `authMode` pada tabel `nas` bersifat opsional (`nullable`) dengan default `'local'`, sehingga instalasi yang sedang berjalan di VPS tidak akan mengalami error skema.
2. **Zero Downtime Verification**:
   - Uji coba migrasi local -> radius pada satu router uji coba. Pastikan ONT berhasil dial PPPoE dan mendapatkan alokasi bandwidth yang sesuai dari `radgroupreply`.
3. **Emergency Rollback Strategy**:
   - Jika router mengalami kendala jaringan saat mode RADIUS, admin cukup mengklik tombol **"Migrate to Local"**. Sistem dalam waktu 3 detik akan mengaktifkan kembali seluruh secret lokal di MikroTik dan menendang sesi ONT agar langsung kembali ke autentikasi lokal tanpa kehilangan data pelanggan.

---
*Dokumen ini merupakan standar panduan arsitektur resmi untuk pengembangan modul autentikasi EugineBill RADIUS.*
