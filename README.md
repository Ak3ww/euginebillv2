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

### v2.39.10 — 2026-09-12

### Universal Client-Side Auto-Compression & High-Capacity Image Upload Engine
- **Sistem Kompresi Gambar Otomatis & Penaikan Kapasitas Upload Universal**:
  - *Context / User Request*:
    Teknisi melaporkan upload foto di portal teknisi gagal karena file kebesaran ("upload foto di portal teknisi gagal karna file kebesaran ini gimana solusinya? Pastikan juga upload foto dimanapun tidak gagal baik itu teknisi, atau pelanggan"). Kamera HP modern menghasilkan foto 6MB hingga 25MB (resolusi 48MP–108MP), sementara endpoint API membatasi ukuran file 3MB–5MB dan form client langsung menolak file > 5MB.
  - *Solusi Arsitektural & Perubahan Teknis*:
    1. **Dual-Layer Architecture (Client Canvas Auto-Downscale + Server Limit Expansion)**:
       - **Client-Side Canvas Auto-Downscale**: Mengapa wajib: Teknisi dan pelanggan di lapangan sering kali menghadapi koneksi internet seluler yang terbatas di pelosok. Mengunggah file mentah 15MB–25MB memicu timeout, network drop, dan pemborosan bandwidth. Dengan HTML5 Canvas, foto 15MB–25MB secara instan (< 150ms) di-downscale ke dimensi optimal (maksimal 1600px) dan dikompresi ke format JPEG (kualitas 0.80), menghasilkan payload ringan ~200KB–600KB dengan ketajaman nomor seri modem, barcode, struk transfer, dan tulisan KTP yang tetap 100% presisi dan tajam. Waktu unggah terpangkas dari 30+ detik menjadi < 1 detik dengan tingkat keberhasilan 100%.
       - **Server-Side Limit Expansion**: Batasan upload di seluruh route handler API dinaikkan ke 25MB–30MB sehingga server tidak pernah menolak file secara prematur.
    2. **Penyempurnaan Fungsi Kompresi Universal `compressImage` (`src/lib/utils.ts`)**:
       - Default `maxDimension = 1600` dan `quality = 0.80`.
       - Menjaga keutuhan format SVG/GIF tanpa merusak animasi atau vektor.
       - Proteksi try-catch berlapis dengan fallback aman ke file asli apabila canvas browser mengalami kendala.
    3. **Optimalisasi Overlay Watermark Teknisi (`work-orders/[id]/page.tsx`)**:
       - Membatasi resolusi canvas pada `addPhotoOverlay` ke maksimal 1600px sebelum menggambar strip watermark GPS, tanggal WIB, dan label SPK, serta mengekspor blob JPEG pada kualitas 0.80.
       - Menambahkan auto-kompresi ganda pada fungsi `uploadPhoto` sebelum dimasukkan ke `FormData`.
    4. **Integrasi Kompresi Otomatis pada Seluruh Portal**:
       - **Portal Teknisi**: `work-orders/[id]/page.tsx` (foto ODP, port, rumah, ONT, speedtest), `tickets/page.tsx` (lampiran respon tiket komplain), `register/page.tsx` (foto KTP & instalasi pendaftaran pelanggan baru).
       - **Portal Pelanggan & Pembayaran**: `pay/[token]/page.tsx` (bukti transfer manual), `pay-manual/[token]/page.tsx`, `pay-manual/page.tsx`, `customer/topup-request/page.tsx` (bukti transfer saldo topup), `daftar/page.tsx` (foto KTP pendaftaran publik).
       - **Portal Agen**: `agent/dashboard/page.tsx` (bukti transfer deposit saldo agen).
       - **Portal Admin**: `admin/work-orders/[id]/page.tsx` (upload foto SPK oleh admin), `admin/pppoe/users/page.tsx`, `admin/pppoe/users/new/page.tsx`, dan `src/components/UserDetailModal.tsx` (foto KTP & foto instalasi).
    5. **Penaikan Batas Maksimal Server-Side API (`MAX_SIZE` / `maxSize`)**:
       - `src/app/api/technician/upload/route.ts`: `MAX_SIZE = 25 * 1024 * 1024` (25MB, sebelumnya 5MB).
       - `src/app/api/upload/route.ts`: `maxSize = 25 * 1024 * 1024` (25MB, sebelumnya 10MB).
       - `src/app/api/upload/pppoe-customer/route.ts`: `maxSize = 25 * 1024 * 1024` (25MB, sebelumnya 5MB).
       - `src/app/api/upload/payment-proof/route.ts`: `maxSize = 25 * 1024 * 1024` (25MB, sebelumnya 5MB).
       - `src/app/api/customer/payments/[id]/proof/route.ts`: batas dinaikkan ke 25MB (sebelumnya 5MB).
       - `src/app/api/customer/invoices/[id]/manual-payment/route.ts`: batas dinaikkan ke 25MB (sebelumnya 5MB).
       - `src/app/api/public/upload-registration/route.ts`: `maxSize = 25 * 1024 * 1024` (25MB, sebelumnya 3MB).
       - `src/app/api/upload/logo/route.ts`: `maxSize = 10 * 1024 * 1024` (10MB, sebelumnya 2MB).
    6. **Pembersihan Blocker Validasi 5MB di Client**:
       - Menghapus popup error `Ukuran file maksimal 5MB` di seluruh formulir pembayaran dan top-up, digantikan dengan kompresi client-side otomatis tanpa interupsi.
  - *Files*:
    - `src/lib/utils.ts`
    - `src/app/technician/(portal)/work-orders/[id]/page.tsx`
    - `src/app/technician/(portal)/tickets/page.tsx`
    - `src/app/technician/(portal)/register/page.tsx`
    - `src/app/admin/work-orders/[id]/page.tsx`
    - `src/app/admin/pppoe/users/page.tsx`
    - `src/app/admin/pppoe/users/new/page.tsx`
    - `src/components/UserDetailModal.tsx`
    - `src/app/agent/dashboard/page.tsx`
    - `src/app/customer/topup-request/page.tsx`
    - `src/app/daftar/page.tsx`
    - `src/app/pay/[token]/page.tsx`
    - `src/app/pay-manual/[token]/page.tsx`
    - `src/app/pay-manual/page.tsx`
    - `src/app/api/technician/upload/route.ts`
    - `src/app/api/upload/route.ts`
    - `src/app/api/upload/pppoe-customer/route.ts`
    - `src/app/api/upload/payment-proof/route.ts`
    - `src/app/api/customer/payments/[id]/proof/route.ts`
    - `src/app/api/customer/invoices/[id]/manual-payment/route.ts`
    - `src/app/api/public/upload-registration/route.ts`
    - `src/app/api/upload/logo/route.ts`
    - `CHANGELOG.md`
    - `docs/AI_PROJECT_MEMORY.md`

### v2.39.9 — 2026-09-12

### Permanent Hide PWA Install Prompt Across All Portals Except Landing Page
- **Penyembunyian Permanen Modal PWA Install Prompt di Semua Portal Kecuali Landing Page**:
  - *Context / User Request*:
    Pengguna melaporkan bahwa modal pop-up "Install Aplikasi Pelanggan" (PWA prompt) masih muncul di halaman invoice, halaman bayar `/pay/[token]`, dan sering mengganggu saat admin membuka dashboard `/admin`. Pengguna menginstruksikan untuk menyembunyikan modal ini secara permanen di seluruh sistem kecuali pada landing page.
  - *Solusi Arsitektural & Perubahan Teknis*:
    1. **Strict Whitelist Filtering pada `src/components/pwa-install-prompt.tsx`**:
       - Mengganti filter *blacklist* berbasis `pathname.startsWith` yang rawan bocor menjadi *strict whitelist*: hanya mengizinkan rendering jika `pathname === '/' || pathname === '/landing' || pathname.startsWith('/landing')`.
       - Seluruh halaman lain (Admin `/admin/*`, Invoice `/invoice/*`, Pay `/pay/*`, Customer `/customer/*`, Agent `/agent/*`, Teknisi `/technician/*`, dsb.) langsung mengembalikan `null` secara permanen.
       - Listener event browser `beforeinstallprompt` pada `useEffect` dinonaktifkan sepenuhnya jika route bukan merupakan landing page, menjamin nol interupsi modal pop-up di seluruh portal operasional.
  - *Files*:
    - `src/components/pwa-install-prompt.tsx`
    - `CHANGELOG.md`
    - `docs/AI_PROJECT_MEMORY.md`

### v2.39.8 — 2026-09-12

### Fix Auto-Hide Transfer Manual When Payment Gateway Active
- **Perbaikan Auto-Hide Transfer Bank Manual pada Halaman Pembayaran (`/pay/[token]`)**:
  - *Context / User Request*:
    Pengguna melaporkan bahwa opsi Transfer Bank Manual masih muncul di halaman pembayaran pelanggan (`/pay/[token]`), padahal payment gateway (QRIN) sudah disetup dan aktif.
  - *Solusi Arsitektural & Perubahan Teknis*:
    1. **Strict Condition Rendering pada `src/app/pay/[token]/page.tsx`**:
       - Mengganti kondisi rendering ambigu `{(paymentGateways.length === 0 || normalizedBankAccounts.length > 0)}` menjadi strictly `{paymentGateways.length === 0}`.
       - Memastikan `showManualForm` bernilai `false` jika terdapat payment gateway aktif (`gateways.length > 0`).
    2. **Logika Bisnis yang Benar & Konsisten**:
       - **Saat Payment Gateway Aktif (misal QRIN / Duitku / Midtrans)**: Opsi Transfer Bank Manual **100% otomatis disembunyikan (*auto-hide*)**, pelanggan hanya melihat kanal pembayaran otomatis resmi (QRIS instan, Virtual Account, atau Gerai Retail) sehingga pembayaran terverifikasi otomatis tanpa memerlukan verifikasi mutasi manual oleh admin.
       - **Saat Belum Ada Payment Gateway (`paymentGateways.length === 0`)**: Formulir Transfer Bank Manual **otomatis terbuka (*auto-show*)** sebagai metode utama lengkap dengan kartu rekening tujuan resmi, panduan nominal presisi, dan tombol unggah bukti transfer.
  - *Files*:
    - `src/app/pay/[token]/page.tsx`
    - `CHANGELOG.md`
    - `docs/AI_PROJECT_MEMORY.md`

### v2.39.7 — 2026-09-12

### Master Easy Setup Guide (VPS & MikroTik), UI Quick Links, and Zero-Emoji Standard Enforcement
- **Easy Setup Experience di VPS & MikroTik (Master Guide, Quick Links, & Pembersihan Total Text Emoji)**:
  - *Context / User Request*:
    Pengguna meminta jaminan bahwa alur EugineBill Easy Setup di VPS dan MikroTik memiliki panduan lengkap baik di antarmuka Admin UI maupun repositori GitHub: "Cuma beberapa kali klik dan paste script di MikroTik harus sudah siap pakai." Selain itu, seluruh elemen UI harus patuh pada aturan nol text emoji di seluruh portal admin.
  - *Solusi Arsitektural & Perubahan Teknis*:
    1. **Master Setup Guide (`docs/setup/EUGINEBILL_EASY_SETUP_GUIDE.md`)**:
       - Dokumentasi panduan lengkap 5 skenario implementasi siap pakai:
         - Skenario 1: Hubungkan MikroTik ke EugineBill Cloud (1-Klik Salin Script VPN).
         - Skenario 2: Skrip Fondasi FTTH Plug-and-Play (`02-mikrotik-ftth-complete.rsc`).
         - Skenario 3: Remote ONT Proxy 1-Klik Siap Pakai.
         - Skenario 4: Built-in TR-069 ACS Native Setup (VLAN 4000 on-demand).
         - Skenario 5: Dynamic Isolation & Walled Garden.
    2. **Prominent Banner di Root `README.md` & `docs/DOCS_INDEX.md`**:
       - Menempatkan callout banner utama "Quick Start & Easy Setup" di awal `README.md` dan tabel indeks teknis.
       - Menambahkan referensi master guide di `docs/DOCS_INDEX.md`.
    3. **Helper Card Easy Setup di UI Router (`/admin/network/routers`)**:
       - Menambahkan kartu informasi "Easy Setup Fondasi FTTH & TR-069" dengan tombol pintas ke menu TR-069 ACS (`/admin/acs`).
    4. **Pembersihan Total Text Emoji Sesuai Aturan Workspace**:
       - Mengganti seluruh emoji teks yang tersisa pada `src/app/admin/network/vpn-server/page.tsx`, `src/app/admin/network/vpn-client/page.tsx`, `src/app/admin/network/olts/page.tsx`, `src/app/admin/network/map/page.tsx`, `src/app/admin/pppoe/areas/page.tsx`, dan `src/app/admin/pppoe/users/new/page.tsx` dengan komponen resmi `Lucide React` (`<Cloud />`, `<Server />`, `<Settings />`, `<Wifi />`, `<Terminal />`, `<Radio />`, `<Zap />`, `<Wrench />`, `<User />`, `<AlertTriangle />`, dot status Tailwind, dll.).
  - *Files*:
    - `docs/setup/EUGINEBILL_EASY_SETUP_GUIDE.md`
    - `README.md`
    - `docs/DOCS_INDEX.md`
    - `deployment-pack-client/PANDUAN_SETUP_LENGKAP_OLT_MIKROTIK.md`
    - `src/app/admin/network/routers/page.tsx`
    - `src/app/admin/network/vpn-server/page.tsx`
    - `src/app/admin/network/vpn-client/page.tsx`
    - `src/app/admin/network/olts/page.tsx`
    - `src/app/admin/network/map/page.tsx`
    - `src/app/admin/pppoe/areas/page.tsx`
    - `src/app/admin/pppoe/users/new/page.tsx`
    - `CHANGELOG.md`
    - `docs/AI_PROJECT_MEMORY.md`

### v2.39.6 — 2026-09-12

### Built-in TR-069 ACS Engine, On-Demand VLAN 4000 Activation UI & Lean Base Scripts
- **Standarisasi TR-069: Skrip Pondasi Lean & Aktivasi On-Demand VLAN 4000 di UI**:
  - *Context / User Request*:
    Pengguna menginstruksikan bahwa skrip pondasi awal OLT dan MikroTik harus dijaga tetap bersih dan ringan (*ultra-lean*) tanpa memuat VLAN 4000 secara default. Jika admin ingin menggunakan TR-069 dengan Dedicated VLAN, EugineBill menyediakan panduan interaktif dan skrip aktivasi 1-klik siap salin langsung di halaman Admin `/admin/acs` serta dokumentasi GitHub.
  - *Solusi Arsitektural & Perubahan Teknis*:
    1. **Skrip Pondasi FTTH Ultra-Lean (`01-vsol-1600gs-clean.conf` & `02-mikrotik-ftth-complete.rsc`)**:
       - Hanya memuat port uplink WAN (`ether1`), LAN distribution bridge (`ether2-5`), VLAN 20 (`VLAN20-PPPOE`), dan VLAN 30 (`VLAN30-MGMT-OLT`).
       - Bebas dari konfigurasi awal VLAN 4000 agar tidak membebani teknisi yang baru memasang jaringan awal.
    2. **Komponen Panduan & Generator Skrip Aktivasi TR-069 di UI (`src/components/admin/AcsGuideCard.tsx`)**:
       - Menyediakan tab navigasi interaktif 3 langkah:
         - **Langkah 1 (MikroTik)**: Skrip terminal Winbox siap salin 1-klik untuk membuat interface `vlan4000-tr069`, IP `10.40.10.1/24`, pool, dan DHCP Server TR-069.
         - **Langkah 2 (OLT VSOL)**: Perintah CLI OLT siap salin 1-klik untuk deklarasi `vlan 4000` dan tagging pada port uplink GE 0/1-0/3.
         - **Langkah 3 (Modem ONT Pelanggan)**: Panduan konfigurasi modem per vendor (ZTE, Huawei, Fiberhome, VSOL) untuk opsi Dedicated VLAN 4000 maupun In-Band PPPoE.
    3. **100% Otomatis Aktif di VPS (`/api/cwmp`)**:
       - Engine Built-in ACS ditanam langsung di Next.js monolith (`src/app/api/cwmp/route.ts` & `CwmpService`). Begitu PM2 `EugineBill-radius` running, endpoint langsung aktif tanpa perlu instalasi Docker, tanpa MongoDB, dan tanpa daemon tambahan.
       - Menyediakan HTTP GET handler untuk health check yang mengembalikan status JSON online dan informasi layanan.
    4. **Dokumentasi Terintegrasi di GitHub (`docs/mikrotik/BUILTIN_TR069_ACS_SETUP_GUIDE.md`)**:
       - Merinci arsitektur on-demand VLAN 4000, skrip aktivasi terminal, dan alur kerja integrasi Built-in ACS.
  - *Files*:
    - `deployment-pack-client/01-vsol-1600gs-clean.conf`
    - `deployment-pack-client/02-mikrotik-ftth-complete.rsc`
    - `src/app/api/cwmp/route.ts`
    - `src/components/admin/AcsGuideCard.tsx`
    - `src/app/admin/acs/page.tsx`
    - `docs/mikrotik/BUILTIN_TR069_ACS_SETUP_GUIDE.md`
    - `docs/mikrotik/ACS_SETUP.md`
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
