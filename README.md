# EugineBill RADIUS - Billing & Network Management System for ISP / RT-RW Net

<p align="left">
  <a href="https://github.com/Ak3ww/euginebillv2/releases"><img src="https://img.shields.io/badge/version-v2.39.1-002C60.svg?style=flat-square&logo=git" alt="Version"></a>
  <a href="#"><img src="https://img.shields.io/badge/Next.js-16.x-black.svg?style=flat-square&logo=next.js" alt="Next.js"></a>
  <a href="#"><img src="https://img.shields.io/badge/TypeScript-5.x-blue.svg?style=flat-square&logo=typescript" alt="TypeScript"></a>
  <a href="#"><img src="https://img.shields.io/badge/Node.js-%3E%3D20.x%20LTS-339933.svg?style=flat-square&logo=nodedotjs" alt="Node.js"></a>
  <a href="#"><img src="https://img.shields.io/badge/Database-MySQL%208.0%20%2B%20Prisma-4479A1.svg?style=flat-square&logo=mysql" alt="MySQL"></a>
  <a href="#"><img src="https://img.shields.io/badge/FreeRADIUS-3.x-C0392B.svg?style=flat-square" alt="FreeRADIUS"></a>
  <a href="#"><img src="https://img.shields.io/badge/VPN-WireGuard%20%2B%20L2TP-88171A.svg?style=flat-square&logo=wireguard" alt="VPN"></a>
  <a href="#"><img src="https://img.shields.io/badge/License-MIT-green.svg?style=flat-square" alt="License"></a>
</p>

Modern, full-stack billing & RADIUS management system for ISP/RT-RW Net with FreeRADIUS integration, MikroTik Local Auth Mode, Built-in WireGuard & L2TP VPN Server, ONT Remote Proxy, Native WhatsApp Baileys Bot, and Multi-Portal PWA.

> **Latest Release:** v2.39.1 — Commercial Turnkey Release (Ready to Rent / Sell as Managed Single-Tenant VPS) dengan 1-Command All-in-One Installer, First-Time Setup Wizard (`/setup`), Local & RADIUS Per-Router Auth, Auto-Show Transfer Manual, dan Bundled WireGuard + L2TP VPN.

## Quick Start & Easy Setup

> **Butuh panduan instalasi kilat 1-klik & integrasi MikroTik siap pakai?**
> Baca panduan lengkap: **[docs/setup/EUGINEBILL_EASY_SETUP_GUIDE.md](docs/setup/EUGINEBILL_EASY_SETUP_GUIDE.md)**
> - **VPS Setup**: 1 baris perintah curl installer + Setup Wizard (`/setup`).
> - **MikroTik Setup**: Cuma beberapa klik di UI dan paste script di WinBox, router langsung online, siap PPPoE/Hotspot, remote ONT, dan TR-069!

---

## AI Development Assistant & Architecture Memory

**READ FIRST:** [docs/AI_PROJECT_MEMORY.md](docs/AI_PROJECT_MEMORY.md) & [docs/DOCS_INDEX.md](docs/DOCS_INDEX.md) — dokumentasi lengkap arsitektur, spesifikasi database, 70+ panduan teknis, dan troubleshooting playbook.

---

## Core Capabilities & Features

| Kategori | Fitur & Arsitektur Utama |
| :--- | :--- |
| **RADIUS & Local Auth** | Mode fleksibel per-router (`local` MikroTik secrets atau `radius` FreeRADIUS 3.x), real-time CoA disconnect/speed change (Port 3799/UDP), OpenSSL MD4 legacy provider untuk MS-CHAPv2 PPPoE, Dynamic NAS management via `clients.d/`. |
| **VPN Server Management** | WireGuard Server bawaan VPS (`10.200.0.0/24` port 51820 UDP untuk RouterOS v7) & L2TP/IPSec Server (`10.201.0.0/24` untuk RouterOS v6). MikroTik terhubung langsung ke VPS tanpa memerlukan CHR forwarder perantara. |
| **ONT Remote Proxy** | Reverse proxy remote modem pelanggan (`24000:24999/tcp`) via `socat` VPS dan dynamic NAT MikroTik. Akses langsung modem ONT pelanggan di balik IP private tanpa IP publik statis di sisi pelanggan. |
| **Remote Winbox Forwarding**| Forwarding port manajemen router MikroTik (`10001:10999/tcp`) untuk akses Winbox, WebFig, dan API dari mana saja via internet. |
| **PPPoE Management** | Akun pelanggan, paket profile bandwidth, isolir otomatis, penugasan IP statis/pool, auto-sync MikroTik, foto KTP + instalasi via kamera smartphone, GPS otomatis, pemantauan status online/offline 10s. |
| **Hotspot & Voucher** | 8 format kode voucher, generate batch hingga 25.000 voucher, distribusi agen/reseller, auto-sync RADIUS & MikroTik local mode, template cetak profesional dengan barcode QR. |
| **Billing & Invoices** | Penagihan prabayar & pascabayar, invoice PDF & Excel server-side engine (Oceanic Blue), auto-generate tagihan bulanan, sistem saldo deposit agen & pelanggan, auto-renewal otomatis dari saldo. |
| **Payment Gateway & Manual**| Multi-gateway otomatis (Midtrans, Xendit, Tripay, Duitku, QRIN) + Auto-Show Transfer Bank Manual pada `/pay/[token]` dengan 1-klik salin rekening dan upload bukti transfer. |
| **WhatsApp Bot (Baileys Native)**| Bot WhatsApp bawaan VPS via `@whiskeysockets/baileys` (internal port 4000, zero third-party cost, multi-device, auto-reconnect, scan QR langsung di Web Admin). Mendukung juga Fonnte, Wablas, dan Kirimi.id. |
| **Network (FTTH) & OLT** | Manajemen hierarki OLT/ODC/ODP, pemetaan port pelanggan, peta topologi jaringan, kalkulasi jarak kabel fiber optik, visualisasi map interaktif. |
| **Built-in ACS / TR-069** | Native CWMP TR-069 server & GenieACS integration: konfigurasi WiFi multi-vendor (ZTE, Huawei, FiberHome), RxPower optik, reboot jarak jauh, auto-inform. |
| **Isolasi Pelanggan Otomatis** | Auto-isolir pelanggan jatuh tempo, landing page isolir khusus pelanggan (`/isolated`), Walled Garden MikroTik dinamis, fallback auto-kick session. |
| **Role-Based Portals** | 5 Portal terdedikasi: Admin Dashboard (`/admin`), Customer Portal (`/customer`), Agent Reseller (`/agent`), Technician (`/technician`), dan First-Time Setup Wizard (`/setup`). |

---

## 1-Command Turnkey Deployment (VPS Baru)

Untuk VPS baru (Ubuntu 20.04 / 22.04 / 24.04 LTS), jalankan **satu baris perintah** ini di terminal SSH:

```bash
curl -fsSL https://raw.githubusercontent.com/Ak3ww/euginebillv2/main/scripts/install.sh | sudo bash
```

*(Atau via Git Clone manual)*:
```bash
git clone https://github.com/Ak3ww/euginebillv2.git /var/www/EugineBill-radius
cd /var/www/EugineBill-radius
sudo bash scripts/install.sh
```

### Apa Saja yang Diinstal Otomatis?
1. **Node.js 20 LTS, MySQL Server, & PM2**
2. **Nginx Reverse Proxy**: Port 80 & 443 langsung terhubung ke Next.js (port 3000), support WebSocket & batas upload 100MB.
3. **FreeRADIUS 3.x + MySQL**: Langsung tersambung ke database `euginebill` dengan patch OpenSSL MD4 provider.
4. **WireGuard VPN Server**: Aktif pada port `51820/UDP` (Subnet `10.200.0.0/24`).
5. **L2TP/IPSec VPN Server**: Aktif (strongSwan + xl2tpd, Subnet `10.201.0.0/24`).
6. **Firewall UFW**: Seluruh port otomatis dibuka (Web 80/443, Winbox 10001-10999, ONT Remote 24000-24999, FreeRADIUS 1812/1813/3799, VPN 51820/500/4500/1701).
7. **Persistent Storage**: `/var/data/EugineBill/uploads` & auth WhatsApp Baileys.
8. **3 Layanan PM2**: `EugineBill-radius` (Web), `EugineBill-wa` (WhatsApp Bot), dan `EugineBill-cron` (Cron Job otomatis).
9. **First-Time Setup Wizard**: Buka browser di `http://IP_VPS/setup` untuk membuat akun Super Admin dan mengisi profil usaha Anda.

---

## First-Time Setup Wizard (`/setup`)

Tidak ada lagi kredensial default yang rentan. Setelah instalasi selesai:
1. Buka browser: `http://IP_VPS/setup`
2. **Langkah 1**: Masukkan Nama ISP, Telepon, Email, dan Alamat Kantor.
3. **Langkah 2**: Buat Akun Super Admin Utama (Nama, Username Login, Email, Password).
4. **Langkah 3**: Konfigurasi Prefix ID Pelanggan (contoh `EB-`) & Tanggal Jatuh Tempo Tagihan (contoh `20`).
5. Klik **Selesaikan Inisialisasi** -> Halaman `/setup` otomatis terkunci permanen dan Anda langsung dialihkan ke login `/admin/login`.

---

## Updating Existing System (Safe Patch)

Untuk memperbarui sistem tanpa risiko kehilangan data pelanggan, database, atau konfigurasi:

```bash
sudo bash scripts/safe-update.sh
```
Skrip ini otomatis membuat snapshot database MySQL (`mysqldump` terkompresi `.sql.gz`), membackup file `.env`, melakukan `git pull`, sinkronisasi skema database, build aplikasi, dan me-reload proses PM2 tanpa downtime.

---

## Technical Documentation Index

Dokumentasi lengkap terbagi ke dalam panduan teknis pada folder `docs/`:

| Dokumen Panduan | Deskripsi |
| :--- | :--- |
| [EUGINEBILL_EASY_SETUP_GUIDE.md](docs/setup/EUGINEBILL_EASY_SETUP_GUIDE.md) | **Panduan Master Easy Setup VPS & MikroTik Siap Pakai** (Beberapa Klik & Paste Script). |
| [BUILTIN_TR069_ACS_SETUP_GUIDE.md](docs/mikrotik/BUILTIN_TR069_ACS_SETUP_GUIDE.md) | Panduan Built-in TR-069 ACS Native EugineBill (Zero Docker/Mongo). |
| [PANDUAN_SETUP_LENGKAP_OLT_MIKROTIK.md](deployment-pack-client/PANDUAN_SETUP_LENGKAP_OLT_MIKROTIK.md) | Panduan Lengkap Fondasi FTTH: OLT VSOL 1600GS & MikroTik RSC Siap Pakai. |
| [VENDOR_DEPLOYMENT_GUIDE.md](docs/setup/VENDOR_DEPLOYMENT_GUIDE.md) | Panduan lengkap vendor menyewakan VPS EugineBill ke klien ISP baru. |
| [CUSTOMER_EXPERIENCE_PAYMENT_GUIDE.md](docs/customer/CUSTOMER_EXPERIENCE_PAYMENT_GUIDE.md) | Panduan pembayaran pelanggan, transfer bank manual, dan gateway. |
| [TROUBLESHOOTING.md](docs/getting-started/TROUBLESHOOTING.md) | Panduan investigasi dan solusi kendala teknis (RADIUS, MySQL, VPN). |
| [COA_TROUBLESHOOTING_WORKFLOW.md](docs/getting-started/COA_TROUBLESHOOTING_WORKFLOW.md) | Panduan penanganan CoA disconnect dan MikroTik kick session. |
| [API_TESTING_GUIDE.md](docs/getting-started/API_TESTING_GUIDE.md) | Daftar dan panduan pengujian 150+ endpoint API EugineBill. |
| [GENIEACS-GUIDE.md](docs/features/GENIEACS-GUIDE.md) | Panduan TR-069 ACS dan manajemen modem ONT pelanggan. |
| [CHANGELOG.md](CHANGELOG.md) | Riwayat patch lengkap dan catatan rilis setiap versi. |

---

## FreeRADIUS Architecture

Key config files at `/etc/freeradius/3.0/`:

| File | Purpose |
|------|---------|
| `mods-enabled/sql` | MySQL connection for user auth |
| `mods-enabled/rest` | REST API for voucher management |
| `sites-enabled/default` | Main auth logic (PPPoE realm support) |
| `clients.conf` | NAS/router clients (+ `$INCLUDE clients.d/`) |
| `sites-enabled/coa` | CoA/Disconnect-Request virtual server |

Config backup in `freeradius-config/` is auto-deployed by the installer.

### Auth Flow

**PPPoE:** `MikroTik → FreeRADIUS → MySQL (radcheck/radusergroup/radgroupreply)` → Access-Accept with Mikrotik-Rate-Limit

**Hotspot Voucher:** Same RADIUS path + `REST /api/radius/post-auth` → sets firstLoginAt, expiresAt, syncs keuangan

### RADIUS Tables

| Table | Purpose |
|-------|---------|
| `radcheck` | User credentials |
| `radreply` | User-specific reply attrs |
| `radusergroup` | User → Group mapping |
| `radgroupreply` | Group reply (bandwidth, session timeout) |
| `radacct` | Session accounting |
| `nas` | NAS/Router clients (dynamic) |

---

## ⏰ Cron Jobs (16 automated)

| Job | Schedule | Function |
|-----|----------|----------|
| Voucher Sync | Every 5 min | Sync voucher status with RADIUS |
| Disconnect Sessions | Every 5 min | CoA disconnect expired vouchers |
| Auto Isolir (PPPoE) | Every hour | Suspend overdue customers |
| FreeRADIUS Health | Every 5 min | Auto-restart if down |
| PPPoE Session Sync | Every 10 min | Sync radacct sessions |
| Agent Sales | Daily 1 AM | Update sales statistics |
| Invoice Generate | Daily 2 AM | Generate monthly invoices |
| Activity Log Cleanup | Daily 2 AM | Delete logs >30 days |
| Invoice Reminder | Daily 8 AM | Send payment reminders |
| Invoice Status | Daily 9 AM | Mark overdue invoices |
| Notification Check | Every 10 min | Process notification queue |
| Auto Renewal | Daily 8 AM | Prepaid auto-renew from balance |
| Webhook Log Cleanup | Daily 3 AM | Delete webhook logs >30 days |
| Session Monitor | Every 5 min | Security session monitoring |
| Cron History Cleanup | Daily 4 AM | Keep last 50 per job type |
| Suspend Check | Every hour | Activate/restore suspend requests |

All jobs can be triggered manually from **Settings → Cron** in the admin panel.

---

## � Android APK Builder

Buat APK Android (WebView wrapper) untuk 4 portal langsung di server VPS — tanpa GitHub Actions, tanpa Android Studio.

### 1) Setup Android SDK (satu kali via SSH)

```bash
apt-get update && apt-get install -y openjdk-17-jdk wget unzip && \
mkdir -p /opt/android/cmdline-tools && \
wget -q https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip -O /tmp/cmdtools.zip && \
unzip -q /tmp/cmdtools.zip -d /opt/android/cmdline-tools && \
mv /opt/android/cmdline-tools/cmdline-tools /opt/android/cmdline-tools/latest && \
yes | /opt/android/cmdline-tools/latest/bin/sdkmanager --licenses && \
/opt/android/cmdline-tools/latest/bin/sdkmanager "platforms;android-34" "build-tools;34.0.0" && \
echo 'export ANDROID_HOME=/opt/android' >> /etc/environment && \
echo 'Selesai!'
```

> **Perkiraan waktu:** ~5–10 menit (download ~500MB). Disk yang dibutuhkan: ~2GB.

### 2) Build APK via Admin Panel

Buka **Admin → Download Aplikasi Android** → klik **Build APK** pada role yang diinginkan.

- Build berjalan di background (tidak timeout meski butuh beberapa menit)
- Status diperbarui otomatis setiap 3 detik
- Setelah selesai, tombol **Download APK** muncul

### 3) Build via API (opsional)

```bash
# Cek environment
curl http://YOUR_VPS/api/admin/apk/trigger

# Mulai build (role: admin | customer | technician | agent)
curl -X POST http://YOUR_VPS/api/admin/apk/trigger?role=customer \
  -H "Cookie: next-auth.session-token=..."

# Cek status
curl http://YOUR_VPS/api/admin/apk/status?role=customer

# Download APK
curl -OJ http://YOUR_VPS/api/admin/apk/file?role=customer \
  -H "Cookie: next-auth.session-token=..."
```

### Storage APK

| Path | Keterangan |
|------|------------|
| `/var/data/EugineBill/apk/{role}/app.apk` | File APK hasil build |
| `/var/data/EugineBill/apk/{role}/status.json` | Status & metadata build |
| `/var/data/EugineBill/apk/{role}/build.log` | Log Gradle |
| `/var/data/EugineBill/gradle-cache` | Cache Gradle (mempercepat build berikutnya) |

### Paket Aplikasi

| Role | Package ID | Warna |
|------|-----------|-------|
| Admin | `net.EugineBill.admin` | Biru |
| Customer | `net.EugineBill.customer` | Cyan |
| Technician | `net.EugineBill.technician` | Hijau |
| Agent | `net.EugineBill.agent` | Ungu |

---

## �🛠️ Common Commands

```bash
# PM2
pm2 status ; pm2 logs EugineBill-radius
pm2 restart ecosystem.config.js --update-env

# FreeRADIUS
systemctl restart freeradius
freeradius -XC    # Test config
radtest 'user@realm' password 127.0.0.1 0 testing123

# Database
mysql -u EugineBill_user -pEugineBillradius123 EugineBill_radius
mysqldump -u EugineBill_user -pEugineBillradius123 EugineBill_radius > backup.sql
```

---

## 🧯 Troubleshooting Cepat

### 1) Website tidak bisa diakses dari IP VPS

Jika `Nginx` dan app sudah jalan di server tapi dari internet tetap tidak bisa akses, biasanya masalah ada di layer jaringan (NAT/forwarding/firewall external), bukan di aplikasi.

```bash
# Di VM/VPS guest
ss -tulpn | grep -E ':80|:443|:3000'
curl -I http://127.0.0.1:3000
curl -I http://127.0.0.1
systemctl status nginx --no-pager
pm2 status
```

Jika semua check local di atas OK, cek mapping di host Proxmox/router/cloud firewall:

1. `Public:2020 -> VM:22` (SSH)
2. `Public:80 -> VM:80` (HTTP)
3. `Public:443 -> VM:443` (HTTPS)

Catatan: `IP:2020` adalah port SSH, bukan URL web aplikasi.

### 2) PM2 jalan tapi web tetap blank/error

```bash
pm2 status
pm2 logs EugineBill-radius --lines 100
cd /var/www/EugineBill-radius
npm run build
pm2 restart ecosystem.config.js --update-env
```

### 4) Jalankan diagnosa Nginx otomatis dari installer

Installer Nginx terbaru menambahkan self-check internal (`127.0.0.1:3000`, `127.0.0.1`) dan best-effort check publik (HTTP/HTTPS).

```bash
cd /var/www/EugineBill-radius
bash vps-install/install-nginx.sh
```

Jika warning menunjukkan HTTP publik tidak reachable, fokus perbaikan di NAT/port-forward/security-group, bukan di Next.js.

---

## 🔐 Security

```bash
# Firewall
ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp
ufw allow 1812/udp && ufw allow 1813/udp && ufw allow 3799/udp
```

1. Change default admin password on first login
2. Change MySQL passwords in `.env`
3. Configure SSL (Let's Encrypt or Cloudflare)
4. Enable UFW

---

## 📡 CoA (Change of Authorization)

Sends real-time speed/disconnect commands to MikroTik without dropping PPPoE connections.

**MikroTik requirement:** `/radius incoming set accept=yes port=3799`

**API:** `POST /api/radius/coa` — actions: `disconnect`, `update`, `sync-profile`, `test`

Auto-triggered when: PPPoE profile speed is edited (syncs all active sessions).

---

## 📲 WhatsApp Providers

| Provider | Base URL | Auth |
|----------|----------|------|
| Fonnte | `https://api.fonnte.com/send` | Token |
| WAHA | `http://IP:PORT` | API Key |
| GOWA | `http://IP:PORT` | `user:pass` |
| MPWA | `http://IP:PORT` | API Key |
| Wablas | `https://pati.wablas.com` | Token |

---

## ⏱️ Timezone

| Layer | Timezone | Note |
|-------|----------|------|
| Database (Prisma) | UTC | Prisma default |
| FreeRADIUS | WIB (UTC+7) | Server local time |
| PM2 env | WIB | `TZ: 'Asia/Jakarta'` in ecosystem.config.js |
| API / Frontend | WIB | Auto-converts UTC ↔ WIB |

For WITA (UTC+8) or WIT (UTC+9): change `TZ` in `.env`, `ecosystem.config.js`, and `src/lib/timezone.ts`.

---

## 📋 Admin Modules

Dashboard · PPPoE · Hotspot · Agent · Invoice · Payment · Keuangan · Sessions · WhatsApp · Network (OLT/ODC/ODP) · GenieACS · Settings

**Roles:** SUPER_ADMIN · FINANCE · CUSTOMER_SERVICE · TECHNICIAN · MARKETING · VIEWER

---

## 📝 Changelog

Bagian ini otomatis sinkron dari `CHANGELOG.md` saat file changelog berubah di GitHub.

<!-- AUTO-CHANGELOG:START -->

### v2.40.1 — 2026-09-16

### Integrasi Vendor OLT Baru: VSOL (V1600GS, V1600GS-ZF, V1600GT) & HSGQ (HSGQ-G02ID)

- **Latar Belakang / Context**:
  Kebutuhan integrasi monitoring jaringan FTTH untuk OLT seri populer di lapangan:
  1. **HSGQ-G02ID** (2-Port GPON Mini OLT) dan seri HSGQ lainnya (G008, G016, E04).
  2. **VSOL V1600GS** (Cortina), **V1600GS-ZF** (ZTE Falcon), **V1600GT** (4/8/16-port GPON), dan seri V1600G/D.

- **Solusi Arsitektural & Perubahan Teknis**:
  1. **Modul Adapter Vendor VSOL (`src/lib/olt/vendors/vsol.ts`)**:
     - Mendukung SNMP Private MIB VSOL (`1.3.6.1.4.1.37950`) & Host Resources MIB untuk metrik CPU, Memory, dan Temperatur.
     - Parser CLI Telnet/SSH multi-pattern untuk `show ont status`, `show gpon onu state`, `show ont info`, serta `show ont optical-info` (Rx/Tx dBm, Distance meter, Voltase).
  2. **Modul Adapter Vendor HSGQ (`src/lib/olt/vendors/hsgq.ts`)**:
     - Mendukung SNMP Private MIB HSGQ (`1.3.6.1.4.1.50222`) & Host Resources MIB.
     - Parser CLI Telnet/SSH untuk `show gpon onu information`, `show gpon onu state`, dan `show pon power onu-rx` / optical-info.
  3. **Pendaftaran di Poller (`src/lib/olt/poller.ts`)**:
     - Switch case `getVendorModule()` ditambah `vsol` dan `hsgq`.
  4. **Antarmuka Admin (`src/app/admin/network/olts/page.tsx`)**:
     - Penambahan opsi vendor `VSOL` dan `HSGQ` pada form pendaftaran OLT.
     - Penambahan pemetaan model otomatis di `VENDOR_MODELS` untuk `V1600GS`, `V1600GS-ZF`, `V1600GT`, `V1600G1`, `V1600G2`, `V1600D`, `HSGQ-G02ID`, `HSGQ-G008`, `HSGQ-G016`, `HSGQ-E04`, `HSGQ-E08`.
  5. **Dukungan Remote Command & Import**:
     - Menambahkan perintah reboot ONU untuk VSOL (`ont reset <id>`) dan HSGQ (`ont reboot <id>`) di API reboot dan batch-reboot.
     - Menambahkan `vsol` dan `hsgq` ke daftar vendor yang valid pada API import OLT.

- **Files**:
  - `src/lib/olt/vendors/vsol.ts` — [NEW]
  - `src/lib/olt/vendors/hsgq.ts` — [NEW]
  - `src/lib/olt/poller.ts`
  - `src/app/admin/network/olts/page.tsx`
  - `src/app/api/network/olts/import/route.ts`
  - `src/app/api/olt/[id]/onus/[onuId]/reboot/route.ts`
  - `src/app/api/olt/[id]/onus/batch-reboot/route.ts`
  - `CHANGELOG.md`
  - `docs/AI_PROJECT_MEMORY.md`

### v2.40.0 — 2026-09-16

### Sistem Inventori Aset, Penomoran Dokumen, & Document Maker (Fase A–F)

- **Latar Belakang / Context**:
  Dibutuhkan sistem manajemen inventori fisik (modem ONT, roll kabel dropwire, aksesori) yang terintegrasi langsung dengan alur kerja SPK teknisi, pendaftaran pelanggan baru (PSB), dan penerbitan dokumen resmi perusahaan (MOU, Faktur, KWT, Surat Jalan, BAST, SPK) dengan nomor terstruktur dan bisa di-audit.

- **Solusi Arsitektural & Perubahan Teknis**:
  1. **Fase A — Prisma Schema**: Tambah model `inventoryAsset`, `customerDeviceHistory`, `workOrderMaterial`, `numberingRule`, `issuedNumber`, `documentTemplate`, `generatedDocument`. Tambah `WAREHOUSE` ke `AdminRole`. Extend `inventoryItem` dengan `categoryCode`, `subCategory`, `isSerialized`, `stockQuantity`.
  2. **Fase B — Document Numbering Service**: `document-numbering.service.ts` dengan `previewNextNumber()` (read-only) dan `issueNextNumber()` (consume dalam $transaction). REST API: `/api/documents/numbering/preview`, `/issue`, `/rules`. Manual invoice sudah terintegrasi (FAK/BILL, fallback ke legacy).
  3. **Fase C — Seed Data & Assets UI**: Endpoint seed `/api/admin/inventory/seed-defaults` (seeds 6 numbering rules + SKU catalog). Admin UI `/admin/inventory/assets` (full Shadcn, summary cards, CABLE_ROLL support). API CRUD `/api/inventory/assets` + `/:id`. Deduct service `inventory-deduct.service.ts` dengan optimistic locking.
  4. **Fase D — Document Maker**: 7 API routes (templates CRUD, generate preview, generate issue, documents list, void). Admin UI `/admin/documents` dengan 3 tab: Dokumen Terbit, Buat Dokumen (wizard 5 langkah), Kelola Template.
  5. **Fase E — SPK Wizard & Ganti Modem**: Cable roll picker di wizard teknisi Step 2 (auto-deduct saat complete). PSB baru: SN autocomplete dengan live inventori search + auto-fill MAC. Halaman detail pelanggan: section Perangkat ONT + riwayat device history + modal Ganti Modem. API: `/api/pppoe/users/:id/device-history`, `/replace-device`.
  6. **Fase F — Validasi & Dokumentasi**: `npx tsc --noEmit` → 0 errors. Fix WAREHOUSE di role-templates route. Fix `isDismantle` used-before-declaration di wizard.

- **Files**:
  - `prisma/schema.prisma` — Schema extensions
  - `prisma/seeds/permissions.ts` — INVENTORY/DOCUMENTS permissions + WAREHOUSE role
  - `src/server/services/document-numbering.service.ts` — [NEW]
  - `src/server/services/inventory-deduct.service.ts` — [NEW]
  - `src/app/api/documents/numbering/preview/route.ts` — [NEW]
  - `src/app/api/documents/numbering/issue/route.ts` — [NEW]
  - `src/app/api/documents/numbering/rules/route.ts` — [NEW]
  - `src/app/api/documents/templates/route.ts` — [NEW]
  - `src/app/api/documents/templates/[id]/route.ts` — [NEW]
  - `src/app/api/documents/generate/preview/route.ts` — [NEW]
  - `src/app/api/documents/generate/issue/route.ts` — [NEW]
  - `src/app/api/documents/route.ts` — [NEW]
  - `src/app/api/documents/[id]/route.ts` — [NEW]
  - `src/app/api/documents/[id]/void/route.ts` — [NEW]
  - `src/app/api/inventory/assets/route.ts` — [NEW]
  - `src/app/api/inventory/assets/[id]/route.ts` — [NEW]
  - `src/app/api/admin/inventory/seed-defaults/route.ts` — [NEW]
  - `src/app/api/pppoe/users/[id]/device-history/route.ts` — [NEW]
  - `src/app/api/pppoe/users/[id]/replace-device/route.ts` — [NEW]
  - `src/app/api/permissions/role-templates/route.ts` — Fix WAREHOUSE
  - `src/app/api/manual-invoices/route.ts` — Integrate issueNextNumber
  - `src/app/admin/documents/page.tsx` — [NEW] Document Maker UI
  - `src/app/admin/inventory/assets/page.tsx` — [NEW] Asset management UI
  - `src/app/admin/AdminClientLayout.tsx` — Nav: Inventori Aset + Dokumen Perusahaan
  - `src/app/admin/pppoe/users/[id]/page.tsx` — Perangkat ONT section + Ganti Modem
  - `src/app/admin/pppoe/users/new/page.tsx` — ONT SN autocomplete
  - `src/app/technician/(portal)/work-orders/[id]/page.tsx` — Cable roll picker + fix TS
  - `src/app/api/technician/work-orders/[id]/complete/route.ts` — Auto-deduct cable
  - `docs/inventory/INVENTORY_AND_SKU_STANDARDS.md` — [NEW]
  - `docs/DOCUMENT_NUMBERING_STANDARD.md` — [NEW]
  - `CHANGELOG.md`
  - `docs/AI_PROJECT_MEMORY.md`

### v2.39.16 — 2026-09-14

### VPN Server UI Native Modernization & Legacy CHR Elimination
- **Pembersihan Antarmuka `/admin/network/vpn-server` dari Kolom & Tombol Legacy MikroTik CHR**:
  - *Context / User Request*:
    Pengguna bingung melihat kartu VPN Server di `/admin/network/vpn-server` menampilkan Alamat Host `43.173.14.236`, Username `admin`, Port API `8728`, serta tombol *Test Koneksi*, *Setup Otomatis*, *Script Manual*, dan *L2TP Control (SSH)* seolah-olah VPS Linux EugineBill adalah sebuah router MikroTik CHR.
  - *Solusi Arsitektural & Perubahan Teknis*:
    1. **Eliminasi Field Legacy**: Menghapus tampilan `Port API: 8728` dan `Username: admin` dari kartu server dan modal edit, menggantinya dengan data teknis native yang akurat: Host VPS Endpoint (`43.173.14.236`), Subnet Tunnel VPN (`10.200.0.0/24`), Port WireGuard (`51820 / UDP`), dan Port L2TP/IPsec (`1701, 500, 4500 / UDP`).
    2. **Eliminasi Tombol Redundan**: Menghapus tombol *Test Koneksi*, *Setup Otomatis*, *Script Manual*, dan *L2TP Control (SSH root)* yang tidak terpakai pada Linux VPS native.
    3. **Penyederhanaan Aksi**: Menyediakan 3 aksi esensial: **Panel WireGuard** (melihat handshake & transfer peer), **Kelola Router Klien (VPN Client)** (link langsung ke `/admin/network/vpn-client`), dan **Edit Konfigurasi Pool** (hanya edit subnet dan rentang IP pool).
    4. **Penyelarasan Header**: Mengganti tombol "+ Tambah Server VPN" dengan tombol navigasi cepat `Kelola VPN Client`.
  - *Files*:
    - `src/app/admin/network/vpn-server/page.tsx`
    - `CHANGELOG.md`
    - `docs/AI_PROJECT_MEMORY.md`

### v2.39.15 — 2026-09-14

### FTTH Deployment Pack Standards (VSOL V1600GS-ZF vs Standard & MikroTik FTTH Master)
- **Standarisasi Toolkit Deployment Lapangan OLT VSOL & MikroTik FTTH (100% Verified Work)**:
  - *Context / User Request*:
    1. Mengabadikan konfigurasi 100% work dari OLT VSOL klien (`RADIANTO`) dan MikroTik RB2011 (RouterOS 6.49.21) dari deployment nyata di lapangan.
    2. Mendokumentasikan akar masalah kegagalan konfigurasi kits awal: pada OLT VSOL seri **V1600GS-ZF (ZTE Falcon chipset)**, perintah `service-port 1 gemport 1 uservlan 20 vlan 20` **wajib mutlak** disertakan pada line profile agar frame PPPoE tidak di-drop oleh OLT. Sedangkan pada seri **V1600GS standar (Cortina chipset)**, deklarasi eksplisit `service-port` bersifat opsional.
    3. Memisahkan template OLT menjadi 2 file definitif: `01-vsol-1600gs-zf.conf` dan `01-vsol-1600gs-standard.conf`.
    4. Menyusun skrip MikroTik FTTH master (`02-mikrotik-ftth-complete.rsc`) dengan standar arsitektur: WAN DHCP-client, dedicated OLT trunk port (terpisah dari bridge), DNS Cloudflare (`1.1.1.1, 1.0.0.1`), pre-configured NAT remote OLT, TCP MSS Clamping, dan native Simple Queue rate-limiting.
    5. Menambahkan aturan workspace baru `FTTH Deployment Pack Standard` pada `.agents/AGENTS.md`.
  - *Files*:
    - `deployment-pack-client/01-vsol-1600gs-zf.conf`
    - `deployment-pack-client/01-vsol-1600gs-standard.conf`
    - `deployment-pack-client/01-vsol-radianto-final.conf`
    - `deployment-pack-client/02-mikrotik-ftth-complete.rsc`
    - `deployment-pack-client/02-mikrotik-radianto-final.rsc`
    - `deployment-pack-client/PANDUAN_SETUP_LENGKAP_OLT_MIKROTIK.md`
    - `.agents/AGENTS.md`
    - `CHANGELOG.md`
    - `docs/AI_PROJECT_MEMORY.md`

### v2.39.14 — 2026-09-14

### Network UI Standard, ACS TR-069 Clean Guide, & VPN Architecture Clarification
- **Pembaruan UI Jaringan, Panduan ACS TR-069, & Penegasan Arsitektur Native VPN VPS**:
  - *Context / User Request*:
    1. Membersihkan panduan TR-069 ACS pada `src/components/admin/AcsGuideCard.tsx` dengan menghapus tombol eksternal "Dokumentasi GitHub" dan memastikan tombol interaktif "Buka Panduan Setup TR-069" accordion 3-langkah (MikroTik, OLT, ONT) tetap aktif.
    2. Merapikan bagian alur NAS/Router dan Troubleshooting FreeRADIUS "unknown client" di `src/app/admin/network/routers/page.tsx` dari styling cyberpunk/neon glow menjadi standar clean Shadcn UI, code block berkontras tinggi, dan bebas text emoji.
    3. Memberikan penjelasan arsitektur VPN yang tegas pada antarmuka `src/app/admin/network/vpn-server/page.tsx` dan `src/app/admin/network/vpn-client/page.tsx`: bahwa EugineBill memiliki "VPS Built-in VPN Server (WireGuard & L2TP/IPsec - Rekomendasi Utama)" native di Linux VPS sehingga teknisi tidak perlu menyewa/setup MikroTik CHR tambahan. External MikroTik CHR adalah mode alternatif opsional jika pengguna memiliki CHR terpisah.
    4. Memperbaiki kontras font, styling tutorial, dan formulir IP pool VPS pada `src/app/admin/network/vpn-client/page.tsx`, serta menghapus seluruh text emoji pada modal dan select options (100% Lucide React icons).
  - *Solusi Arsitektural & Perubahan Teknis*:
    1. **Kartu Panduan ACS (`src/components/admin/AcsGuideCard.tsx`)**:
       - Menghapus tautan eksternal GitHub dan import `ExternalLink` yang tidak terpakai.
       - Mempertahankan state accordion `showFullGuide` dan tombol toggle "Buka Panduan Setup TR-069" yang menampilkan langkah 1 (MikroTik VLAN 4000), langkah 2 (OLT VSOL), dan langkah 3 (tab ONT ZTE, Huawei, Fiberhome, VSOL).
    2. **Halaman Router / NAS (`src/app/admin/network/routers/page.tsx`)**:
       - Mengganti kontainer cyberpunk gradient (`#00f7ff`, `#bc13fe`) pada bagian Alur NAS dan Troubleshooting FreeRADIUS dengan komponen Shadcn UI standar (`bg-card`, `border-border`, `bg-muted/30`, `bg-muted/40`).
       - Memformat code block troubleshooting menggunakan `bg-zinc-950` berkontras tinggi dan teks rapi.
       - Menghapus text emoji dan karakter simbol (seperti `✓` dan `★`), menggantinya dengan dedicated Lucide icons (`<CheckCircle2 />`, `<AlertTriangle />`, `<Info />`, `<ArrowRight />`, `<ExternalLink />`, `<Router />`, `<Terminal />`).
    3. **Halaman VPN Server & VPN Client (`vpn-server/page.tsx` & `vpn-client/page.tsx`)**:
       - Menambahkan Architecture Explanation Callout Card di bagian atas halaman yang menegaskan:
         - **VPS Built-in VPN Server (WireGuard & L2TP/IPsec — Rekomendasi Utama)**: 100% native di Linux VPS EugineBill, berkecepatan tinggi, tanpa memerlukan lisensi atau setup MikroTik CHR tambahan.
         - **External MikroTik CHR (Mode Alternatif Opsional)**: Hanya digunakan jika pengguna ingin memanfaatkan router MikroTik CHR eksternal di data center sebagai konsentrator terpisah.
       - Merefaktor tutorial alur kerja VPN ke standar Shadcn UI dengan kontras tinggi pada light dan dark mode.
       - Merombak panel "Konfigurasi VPS Built-in VPN" (pengaturan Pool IP WireGuard & L2TP/IPsec) di `vpn-client/page.tsx` menjadi kartu Shadcn UI dengan input berkontras tinggi dan tombol standar.
       - Menghapus text emoji pada opsi select (`⏳`, `🖥️`, `🔷`) dan pesan peringatan (`⚠️`, `🔑`, `📋`, `🔐`, `🔌`), menggantinya dengan label teks deskriptif dan Lucide React icons.
  - *Files*:
    - `src/components/admin/AcsGuideCard.tsx`
    - `src/app/admin/network/routers/page.tsx`
    - `src/app/admin/network/vpn-server/page.tsx`
    - `src/app/admin/network/vpn-client/page.tsx`
    - `CHANGELOG.md`
    - `docs/AI_PROJECT_MEMORY.md`

<!-- AUTO-CHANGELOG:END -->

See full changelog: [docs/getting-started/CHANGELOG.md](docs/getting-started/CHANGELOG.md)

## 📚 Documentation

| File | Description |
|------|-------------|
| [docs/INSTALLATION-GUIDE.md](docs/INSTALLATION-GUIDE.md) | Complete VPS installation |
| [docs/GENIEACS-GUIDE.md](docs/GENIEACS-GUIDE.md) | GenieACS TR-069 setup & WiFi management |
| [docs/AGENT_DEPOSIT_SYSTEM.md](docs/AGENT_DEPOSIT_SYSTEM.md) | Agent balance & deposit |
| [docs/RADIUS-CONNECTIVITY.md](docs/RADIUS-CONNECTIVITY.md) | RADIUS architecture |
| [docs/FREERADIUS-SETUP.md](docs/FREERADIUS-SETUP.md) | FreeRADIUS configuration guide |

## 📝 License

MIT License - Free for commercial and personal use

## 👨‍💻 Development

Built with ❤️ for Indonesian ISPs

**Important**: Always use `formatWIB()` and `toWIB()` functions when displaying dates to users.
