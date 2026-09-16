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

### v2.40.4 — 2026-09-16

### Hardening Pasang Baru Pelanggan (PSB), Timeout Guard MikroTik/Email, & Resolusi Tampilan SN ONT

- **Latar Belakang / Context**:
  1. Pada form Pasang Baru (`/admin/pppoe/users/new`), proses penambahan pelanggan sempat terasa lambat dan berpotensi freeze/loading lama jika router MikroTik memiliki latensi tinggi, VPN terputus, atau API MikroTik tidak merespon instan.
  2. Data Serial Number (SN ONT) dan Tipe/Model ONT yang diinput saat PSB sempat bernilai `-` pada kartu "Data Perangkat & Infrastruktur Lapangan (ONT / ODP)" di detail pelanggan, karena kartu tersebut sebelumnya hanya membaca data dari laporan SPK/Work Order (`woReportData.sn`), bukan dari `inventoryAsset` / `customerDeviceHistory` aktif pelanggan.

- **Solusi Arsitektural & Perubahan Teknis**:
  1. **MikroTik API & Email Non-Blocking Timeout Guard**:
     - `src/server/services/mikrotik/client.ts`: Menambahkan hard timeout guard (`customTimeoutMs || 8000ms`) pada method `execute()`. Membatalkan perintah RouterOS jika tidak merespons dalam batas waktu aman (mencegah socket hang tak terbatas `timeout: 9999`).
     - `src/server/services/mikrotik/ppp-secret.service.ts`: Memasang batas waktu koneksi dan eksekusi 4000ms pada `syncSecret()`.
     - `src/server/services/pppoe.service.ts`: Membungkus proses sinkronisasi secret MikroTik saat pembuatan user dalam `Promise.race([syncPromise, timeout(4000)])` baik mode RADIUS maupun Local Auth. Router lambat/offline tidak akan pernah menggagalkan atau memperlambat pembuatan akun pelanggan.
     - Email notifikasi (`EmailService.sendAdminCreateUser`) dipindahkan ke eksekusi non-blocking asynchronous IIFE dengan timeout 5000ms, sehingga kegagalan/kelambatan SMTP tidak menambah delay HTTP response.
  2. **Resolusi Data Perangkat ONT di Detail Pelanggan (`/admin/pppoe/users/[id]`)**:
     - `getPppoeUserById()` sekarang meng-include relasi `inventoryAssets` (status `IN_USE`) dan `deviceHistories` (terbaru).
     - Pada kartu "Data Perangkat & Infrastruktur Lapangan (ONT / ODP)", variabel `ontSn`, `ontModel`, dan `ontMac` sekarang memprioritaskan `currentDevice` $\to$ `user.inventoryAssets[0]` $\to$ `deviceHistory[0]` $\to$ fallback `woReportData` $\to$ `-`.
     - Menambahkan tombol interaktif `+ Hubungkan` / `Ubah` langsung di baris Serial Number ONT pada Section 3, yang langsung memicu modal pergantian/penghubungan unit modem secara realtime.
  3. **Auto-Register ONT Universal & Safe Client Submission**:
     - `replace-device`: Jika admin memasukkan Serial Number baru yang belum terdaftar di inventori, endpoint otomatis mendaftarkan unit tersebut ke `inventoryAsset` (auto-detect vendor ZTE/Skyworth/Realtek/FiberHome/Huawei/VSOL) tanpa memblokir proses penggantian.
     - `createPppoeUser`: Jika katalog inventori belum memiliki record ONT, otomatis membuat katalog fallback (`EMG-CPE-ONT-GENERIC`) sehingga unit modem baru selalu berhasil tercatat di database.
     - `NewPppoeUserPage`: Dilengkapi `AbortController` (15s) dan penanganan `res.json()` yang aman agar spinner submit selalu ter-reset dengan notifikasi jelas.

- **Files**:
  - `src/server/services/mikrotik/client.ts`
  - `src/server/services/mikrotik/ppp-secret.service.ts`
  - `src/server/services/pppoe.service.ts`
  - `src/app/api/pppoe/users/route.ts`
  - `src/app/api/pppoe/users/[id]/replace-device/route.ts`
  - `src/app/admin/pppoe/users/new/page.tsx`
  - `src/app/admin/pppoe/users/[id]/page.tsx`
  - `CHANGELOG.md`
  - `docs/AI_PROJECT_MEMORY.md`

### v2.40.3 — 2026-09-16

### Navigasi Terpadu Document Maker (/admin/documents), Super Admin Bypass, & Dinamis SKU Generator

- **Latar Belakang / Context**:
  1. Pengguna mencari UI Document Maker setelah membuka halaman Invoice Manual, namun tidak menemukannya karena menu Dokumen Perusahaan berada di grup terpisah dan sempat terfilter jika akun admin belum memiliki izin `documents.view`.
  2. Kebutuhan fleksibilitas format SKU: Apakah SKU harus selalu menggunakan awalan `EMG-` jika sistem dipakai oleh ISP/klien lain, atau adakah format standar industri.

- **Solusi Arsitektural & Perubahan Teknis**:
  1. **Aksesibilitas Document Maker (`/admin/documents`)**:
     - Ditambahkan menu navigasi **"Dokumen Resmi & Maker"** di sidebar di bawah grup *Tagihan & Transaksi* (`nav.catBillingTransactions`) persis di bawah Invoice Manual, serta tetap dapat diakses di grup *Manajemen* (`nav.catManagement`).
     - Super Admin Bypass: Pada `AdminClientLayout.tsx`, ditambahkan proteksi bypass `isSuperAdmin` sehingga akun dengan role `SUPER_ADMIN` selalu dapat melihat seluruh menu navigasi baru tanpa terhalang permission database yang belum ter-seed.
  2. **Top Sub-Navigation Antar Modul Tagihan & Dokumen**:
     - Pada `/admin/manual-invoices` dan `/admin/documents`, ditambahkan tab navigasi atas yang saling menghubungkan: `Tagihan Bulanan PPPoE` $\leftrightarrow$ `Invoice Manual` $\leftrightarrow$ `Document Maker Resmi (MOU, BAST, SPK, SJ, KWT)`.
  3. **SKU Generator Dinamis & Standar GS1 (`/admin/inventory/items`)**:
     - Menghubungkan pembacaan kode perusahaan dari `company.customerIdPrefix` atau inisial nama perusahaan via `useAppStore()`.
     - Memberikan 2 tombol generator di modal Tambah Barang:
       1. `Auto ([PREFIX])`: Format `[PREFIX_PERUSAHAAN]-[KAT]-[NAMA]` (misal `EMG-CPE-ZTE-F609`).
       2. `Standar GS1`: Format standar warehouse internasional tanpa nama perusahaan `[KAT]-[NAMA]` (misal `CPE-ONT-ZTE-F609`).

- **Files**:
  - `src/app/admin/AdminClientLayout.tsx`
  - `src/app/admin/manual-invoices/page.tsx`
  - `src/app/admin/documents/page.tsx`
  - `src/app/admin/inventory/items/page.tsx`
  - `src/lib/store.ts`
  - `src/locales/id.json`
  - `CHANGELOG.md`
  - `docs/AI_PROJECT_MEMORY.md`

### v2.40.2 — 2026-09-16

### Dedicated Halaman ONT Modem Pelanggan (/admin/inventory/ont), Seeding Kategori Default, & Import 360 ONT Awal

- **Latar Belakang / Context**:
  1. Pengguna membutuhkan pemisahan inventori modem ONT pelanggan dengan material/roll kabel lainnya agar 360+ unit ONT terpasang dapat ditinjau dalam satu tabel komprehensif lengkap dengan nama pelanggan PPPoE, router/paket, status, MAC, dan SN.
  2. Kategori barang di `/admin/inventory/categories` belum memiliki data default ISP setelah skema inventori baru diimplementasikan.
  3. Pembuatan SKU barang baru di `/admin/inventory/items` membutuhkan format penamaan standar otomatis (`EMG-[KATEGORI]-[SUB]-[VARIAN]`).
  4. Akun role `WAREHOUSE` ("Staf Gudang") harus dapat mengakses inventori tanpa dependensi izin `settings.view`.

- **Solusi Arsitektural & Perubahan Teknis**:
  1. **Halaman Khusus ONT Pelanggan (`src/app/admin/inventory/ont/page.tsx`)**:
     - Metric cards: Total Unit ONT, Terpasang di Pelanggan (`IN_USE`), Ready di Gudang (`AVAILABLE`), dan Rusak (`DEFECTIVE`).
     - Live filter berdasarkan Vendor (ZTE, Skyworth, Realtek, FiberHome, Huawei, VSOL, dsb), Status, dan Pencarian teks (SN, MAC, Nama Pelanggan, Username PPPoE).
     - Kolom tabel interaktif dengan fitur salin cepat Serial Number, tautan langsung ke detail pelanggan PPPoE (`/admin/pppoe/users/[id]`), dan modal detail riwayat unit.
     - Modal Tambah Unit ONT (Mendukung input satuan maupun bulk input banyak SN sekaligus).
     - Tombol 1-klik "Import 360 ONT Awal" yang langsung memproses dan menghubungkan data ONU PPPoE ke inventori aset.
  2. **Seeding Kategori Default & Permisi (`src/app/api/admin/inventory/seed-defaults/route.ts`)**:
     - Menambahkan 10 kategori standar ISP (`HW`, `CPE`, `PAS`, `CAB`, `CON`, `PWR`, `TLS`, `ACC`, `MKT`, `SUP`) ke tabel `inventoryCategory`.
     - Mengaitkan template SKU katalog barang ke kategori masing-masing.
     - Memperbarui hak akses `WAREHOUSE` dan relasi permissions `inventory.*` & `documents.*`.
  3. **Endpoint Import 360 ONT (`src/app/api/admin/inventory/import-initial-modems/route.ts`)**:
     - Mengekstrak fungsi `runInitialModemImport()` dari skrip CLI agar dapat dipanggil via API admin / antarmuka web.
  4. **Auto-Generate SKU Helper (`src/app/admin/inventory/items/page.tsx`)**:
     - Tombol otomatis untuk meracik kode SKU sesuai format standar inventori.
  5. **Navigasi & Sidebar Terpadu**:
     - Menambahkan menu `nav.inventoryOnt` ("Modem ONT Pelanggan") di sidebar `AdminClientLayout.tsx`.
     - Memperbaiki `requiredPermission` menu inventori dari `settings.view` menjadi `inventory.view`.
     - Menghubungkan top navigation bar di seluruh sub-halaman inventori (`items`, `ont`, `assets`).

- **Files**:
  - `src/app/admin/inventory/ont/page.tsx` — [NEW]
  - `src/app/api/admin/inventory/import-initial-modems/route.ts` — [NEW]
  - `src/app/admin/AdminClientLayout.tsx`
  - `src/app/admin/inventory/items/page.tsx`
  - `src/app/admin/inventory/assets/page.tsx`
  - `src/app/admin/management/page.tsx`
  - `src/app/api/admin/inventory/seed-defaults/route.ts`
  - `scripts/import-initial-modems.ts`
  - `src/locales/id.json`
  - `CHANGELOG.md`
  - `docs/AI_PROJECT_MEMORY.md`

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
