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
| [VENDOR_DEPLOYMENT_GUIDE.md](docs/setup/VENDOR_DEPLOYMENT_GUIDE.md) | Panduan lengkap vendor menyewakan VPS EugineBill ke klien ISP baru. |
| [CUSTOMER_EXPERIENCE_PAYMENT_GUIDE.md](docs/customer/CUSTOMER_EXPERIENCE_PAYMENT_GUIDE.md) | Panduan pembayaran pelanggan, transfer bank manual, dan gateway. |
| [TROUBLESHOOTING.md](docs/getting-started/TROUBLESHOOTING.md) | Panduan investigasi dan solusi kendala teknis (RADIUS, MySQL, VPN). |
| [COA_TROUBLESHOOTING_WORKFLOW.md](docs/getting-started/COA_TROUBLESHOOTING_WORKFLOW.md) | Panduan penanganan CoA disconnect dan MikroTik kick session. |
| [API_TESTING_GUIDE.md](docs/getting-started/API_TESTING_GUIDE.md) | Daftar dan panduan pengujian 150+ endpoint API EugineBill. |
| [GENIEACS-GUIDE.md](docs/features/GENIEACS-GUIDE.md) | Panduan TR-069 ACS dan manajemen modem ONT pelanggan. |
| [CHANGELOG.md](CHANGELOG.md) | Riwayat patch lengkap dan catatan rilis setiap versi. |

---

## 🔌 FreeRADIUS

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

### v2.39.2 — 2026-09-11

### Turnkey 1-Paste VPN Remote Client Scripting, Single Full-Privilege Winbox+API User, & Auto Port Forwarding Sync
- **Turnkey 1-Paste Remote Access Setup (WireGuard & L2TP pada RouterOS 6 & 7)**:
  - *Context / User Request*:
    Pengguna mengeluhkan skrip setup VPN client yang dihasilkan EugineBill tidak dapat langsung dipakai untuk login ke Winbox (mengalami "error: the remote host closed the connection" atau logout otomatis setelah 1 detik), serta port forwarding VPS tidak otomatis menyesuaikan port kustom pada MikroTik (seperti Winbox di port 8228 dan API di port 8520). Pengguna juga menginginkan **1 akun kredensial tunggal** yang langsung dapat digunakan untuk Winbox, API, WebFig, dan SSH tanpa harus membuat banyak user terpisah.
  - *Solusi Arsitektural & Perubahan Teknis*:
    1. **Single Full-Privilege Remote User (`group=full`)**:
       - Mengubah seluruh generator skrip MikroTik (`src/app/admin/network/vpn-client/page.tsx`, `src/app/api/network/vps-wg-peer/route.ts`, dan `src/app/api/network/vps-l2tp-peer/route.ts`) agar akun remote yang dibuat langsung diberikan hak akses bawaan `group=full`.
       - Menghilangkan pembatasan grup `api-users` (`!romon, !reboot, !sniff, !rest-api`) yang sebelumnya menyebabkan aplikasi Winbox RouterOS 7 menolak hak akses GUI dan memutus koneksi (logout otomatis).
       - Menjamin 1 kali paste skrip langsung menghasilkan akun administrator remote yang valid 100% untuk login Winbox, bot redaman, API EugineBill, WebFig, dan SSH.
    2. **Otomatisasi Penuh Sinkronisasi Port Forwarding VPS (`autoSetupPortForwarding`)**:
       - Memperbaiki `autoSetupPortForwarding` pada `src/app/api/network/routers/route.ts`: kini fungsi tersebut tidak lagi mengabaikan pembaruan jika `publicPorts` sudah ada di database.
       - Sistem secara cerdas membaca port aktual seluruh layanan dari MikroTik via `/ip/service/print` melalui tunnel VPN, membandingkannya dengan port target pada iptables VPS, dan jika ada port kustom (misal Winbox 8228, API 8520), sistem otomatis meregenerasi aturan `iptables -t nat PREROUTING DNAT` di VPS dan memperbarui database.
       - Menghubungkan fungsi sinkronisasi otomatis ini ke dalam handler `POST` (tambah router baru) dan `PUT` (edit router) agar port forwarding selalu sinkron tanpa intervensi manual.
    3. **Generator Skrip WireGuard Terpadu di Backend**:
       - Menambahkan fungsi pembantu `generateWgScript` pada `src/app/api/network/vps-wg-peer/route.ts` dan mengembalikan `routerosScript` langsung pada respons `POST /api/network/vps-wg-peer`.
       - Modal WireGuard di antarmuka frontend kini otomatis menerima dan menampilkan skrip lengkap dengan port target dan akun `group=full` yang siap salin dan paste.
  - *Files*:
    - `src/app/admin/network/vpn-client/page.tsx`
    - `src/app/api/network/routers/route.ts`
    - `src/app/api/network/vps-l2tp-peer/route.ts`
    - `src/app/api/network/vps-wg-peer/route.ts`

### v2.39.1 — 2026-09-11

### Turnkey 1-Command Installer Bundle & Setup Wizard Superadmin Username Customization
- **Paket Instalasi 1-Baris Perintah Komprehensif (`scripts/install.sh`)**:
  - *Context / User Request*:
    Menghilangkan kerumitan menjalankan banyak skrip terpisah di VPS baru. Memastikan FreeRADIUS 3.x, WireGuard VPN Server, L2TP/IPSec VPN Server, Nginx Reverse Proxy, dan PM2 Ecosystem (Web + WA + Cron) otomatis terpasang dan aktif dalam satu paket perintah tunggal (`curl -fsSL ... | sudo bash` atau `sudo bash scripts/install.sh`).
  - *Solusi Arsitektural & Perubahan Teknis*:
    1. **Bundling Layanan Jaringan Lengkap**:
       - Mengintegrasikan konfigurasi Nginx reverse proxy langsung di port 80/443 menuju Next.js internal (port 3000) dengan dukungan WebSocket dan batas unggah 100MB, sehingga setup wizard dapat diakses langsung pada port standar web `http://IP/setup`.
       - Mengintegrasikan modul FreeRADIUS 3.x langsung terhubung ke database `euginebill` via MySQL, konfigurasi direktori dinamis `clients.d/`, dan injeksi provider legacy OpenSSL (MD4) untuk kompatibilitas MS-CHAPv2 MikroTik PPPoE pada Ubuntu 22+.
       - Mengintegrasikan instalasi otomatis WireGuard VPN Server (subnet `10.200.0.0/24`, port `51820/UDP`) untuk router MikroTik RouterOS v7.
       - Mengintegrasikan instalasi otomatis L2TP/IPSec VPN Server (strongSwan + xl2tpd, subnet `10.201.0.0/24`) dengan auto-generated IPSec PSK untuk router MikroTik RouterOS v6.
       - Menjalankan seluruh proses PM2 melalui `ecosystem.config.js` (`EugineBill-radius`, `EugineBill-wa`, `EugineBill-cron`) dan menyetel auto-start sistem saat reboot.
    2. **Kustomisasi Username Superadmin pada Setup Wizard (`/setup` & `/api/setup`)**:
       - Menambahkan input field eksplisit `Username Login` (default: `'admin'`) pada Langkah 2 wizard agar pengguna mengetahui persis username yang digunakan untuk login di `/admin/login`.
       - Menghubungkan pembuatan akun ke tabel `admin_users` dengan role `SUPER_ADMIN` yang menjadi acuan otentikasi NextAuth, sekaligus membuat salinan backward-compatible pada tabel legacy `users`.
  - *Files*:
    - `scripts/install.sh`
    - `src/app/setup/page.tsx`
    - `src/app/api/setup/route.ts`
    - `docs/setup/VENDOR_DEPLOYMENT_GUIDE.md`

### v2.39.0 — 2026-09-11

### Commercial Release Readiness: First-Time Setup Wizard, Local Auth Mode, Manual Bank Transfer, & Zero-Hardcoding Sanitization
- **Transformasi Komersial EugineBill Siap Sewa / Jual (Managed Single-Tenant VPS)**:
  - *Context / User Request*:
    Mempersiapkan codebase EugineBill agar 100% siap disewakan dan dijual ke klien ISP/RT-RW Net baru sebagai layanan Managed Single-Tenant VPS. Menjamin tidak ada hardcoded domain/logo vendor lama, menyediakan instalasi wizard pertama kali tanpa seeding database manual, mendukung mode autentikasi lokal MikroTik per router tanpa wajib RADIUS, auto-show pembayaran transfer manual di link bayar pelanggan jika gateway belum disetup, serta menyediakan skrip patch git yang aman dari risiko data loss.
  - *Solusi Arsitektural & Perubahan Teknis*:
    1. **First-Time Setup Wizard (`/setup` & `/api/setup`)**:
       - Mengembangkan antarmuka wizard visual 3 langkah (Profil ISP, Akun Superadmin, Default Billing & Identitas) dengan tema Hallmark Oceanic Blue.
       - Menyediakan proteksi backend: route `/api/setup` otomatis mendeteksi status inisialisasi database. Jika superadmin sudah ada, endpoint terkunci secara permanen dan menolak permintaan pendaftaran ulang.
       - Mengintegrasikan deteksi otomatis pada `/admin/login`: jika sistem belum diinisialisasi, pengguna langsung dialihkan ke `/setup`.
       - Mendaftarkan rute `/setup` ke dalam bypass middleware `src/proxy.ts` (subdomain & isolated IP bypass).
    2. **Per-Router Authentication Mode (`authMode: 'local' | 'radius'`)**:
       - Menambahkan kolom `authMode String @default("local")` pada model `router` di `prisma/schema.prisma`.
       - Memperbarui API router (`src/app/api/network/routers/route.ts`) untuk menangani penyimpanan dan pembaruan `authMode`.
       - Menambahkan badge status mode autentikasi pada kartu router dan dropdown seleksi mode pada modal router di `/admin/network/routers`. Mode lokal MikroTik ditetapkan sebagai standar bawaan.
    3. **Auto-Show Transfer Bank Manual pada Halaman Pembayaran (`/pay/[token]`)**:
       - Mengembangkan sistem deteksi dinamis gateway pembayaran: jika belum ada payment gateway online aktif (`paymentGateways.length === 0`), formulir Transfer Bank Manual otomatis dibuka sebagai metode pembayaran utama.
       - Menampilkan kartu rekening resmi perusahaan (`company.bankAccounts`) dilengkapi tombol 1-klik salin nomor rekening, petunjuk transfer nominal tagihan tepat, dan formulir konfirmasi bukti transfer yang langsung tersambung ke `POST /api/pay/[token]/manual`.
       - Jika payment gateway online aktif, opsi transfer manual tetap dapat diakses sebagai opsi alternatif tanpa membebani biaya gateway.
    4. **Sanitasi Zero-Hardcoding Menyeluruh**:
       - Mengeliminasi seluruh fallback domain statis `https://euginemediagroup.com` di `whatsapp-templates.service.ts`, `auto-isolation.ts`, `broadcast/route.ts`, serta endpoint `work-orders`. Seluruh rujukan digantikan secara dinamis oleh `company.baseUrl || process.env.NEXT_PUBLIC_APP_URL || ''`.
       - Mengganti domain hotspot statis `wifi.euginemediagroup.com` dengan `wifi.hotspot.local` dan nama router dinamis di `templateRenderer.ts`, `voucher/page.tsx`, dan `setup-hotspot/route.ts`.
       - Mengotomatisasi injeksi aturan Walled Garden MikroTik: script setup hotspot kini membaca hostname server billing secara dinamis dari `company.baseUrl` atau `NEXT_PUBLIC_APP_URL`.
       - Mengganti fallback IP ONT remote proxy `43.173.14.236` pada `ont-remote/route.ts` dengan deteksi dinamis header host atau `process.env.VPS_PUBLIC_IP`.
       - Mengganti aset logo fallback statis `eugine-logo.png` dengan logo dinamis perusahaan atau `/logo.png`.
    5. **Skrip Pembaruan Aman & Setup Port VPS**:
       - Menyusun `scripts/safe-update.sh`: melakukan snapshot backup database otomatis (`mysqldump` terkompresi `.sql.gz`), backup `.env`, `git pull`, `npx prisma db push --skip-generate` tanpa menghapus data, `npm run build`, dan graceful reload proses PM2 (`EugineBill-radius`, `EugineBill-wa`, `EugineBill-cron`).
       - Menyusun `scripts/setup-vps-ports.sh`: otomatisasi konfigurasi firewall UFW untuk seluruh port layanan (80, 443, 22, 51820 UDP, 1812/1813/3799 UDP, dan rentang proxy ONT 24000:24999 TCP).
       - Memperbarui template `.env.example` dengan dokumentasi lengkap variabel produksi.
    6. **Dokumentasi Resmi Deployment Vendor**:
       - Menyusun dokumen panduan `docs/setup/VENDOR_DEPLOYMENT_GUIDE.md` yang merinci langkah instalasi awal, arsitektur single-tenant, konfigurasi firewall, hingga serah terima sistem ke klien.
  - *Files*:
    - `prisma/schema.prisma`
    - `src/proxy.ts`
    - `src/app/setup/page.tsx`
    - `src/app/api/setup/route.ts`
    - `src/app/admin/login/page.tsx`
    - `src/app/api/network/routers/route.ts`
    - `src/app/admin/network/routers/page.tsx`
    - `src/app/pay/[token]/page.tsx`
    - `src/app/api/invoices/by-token/[token]/route.ts`
    - `src/server/services/notifications/whatsapp-templates.service.ts`
    - `src/server/jobs/auto-isolation.ts`
    - `src/app/api/whatsapp/broadcast/route.ts`
    - `src/app/api/technician/work-orders/[id]/complete/route.ts`
    - `src/app/api/admin/work-orders/[id]/route.ts`
    - `src/app/api/admin/work-orders/[id]/resend-wa/route.ts`
    - `src/lib/utils/templateRenderer.ts`
    - `src/app/admin/hotspot/voucher/page.tsx`
    - `src/app/admin/hotspot/template/page.tsx`
    - `src/app/api/network/routers/[id]/setup-hotspot/route.ts`
    - `src/app/api/network/ont-remote/route.ts`
    - `src/app/customer/CustomerClientLayout.tsx`
    - `src/app/customer/login/page.tsx`
    - `src/app/admin/technicians/page.tsx`
    - `scripts/safe-update.sh`
    - `scripts/setup-vps-ports.sh`
    - `.env.example`
    - `docs/setup/VENDOR_DEPLOYMENT_GUIDE.md`
    - `CHANGELOG.md`

### v2.38.6 — 2026-09-11

### Client Field Deployment Kits & OLT Standardization
- **Rilis Repositori & Standardisasi Field Deployment Toolkit (`euginemedia-client-kits`)**:
  - *Context / User Request*:
    Mempersiapkan toolkit deployment lapangan mandiri yang siap dibawa teknisi/laptop untuk instalasi paket FTTH 1-PON (OLT VSOL V1600GS + MikroTik v7) di sisi router klien tanpa bentrok IP dan tanpa downtime jaringan lama. Melakukan audit mentahan produksi CCR2116 EugineMedia dan standardisasi port remote web OLT serta SNMP.
  - *Solusi Arsitektural & Perubahan Teknis*:
    1. **Audit Multi-OLT Mentahan Produksi EugineMedia**:
       - Mengidentifikasi pemetaan eksisting 3 OLT di CCR2116 EugineMedia:
         - OLT 1 (HSGQ): Web `8229`, SNMP UDP `1611` (`192.168.30.2:161`).
         - OLT 2 (VSOL V1600GS): Web `8003`, SNMP UDP `1614` (`192.168.30.6:161`).
         - OLT 3 (VSOL V1600GT): Web `8004`, SNMP UDP `1615` (`192.168.30.7:1615`).
    2. **Standarisasi Bersih Client Deployment Kit**:
       - Menetapkan konvensi berurutan untuk instalasi OLT baru di sisi klien:
         - OLT 1 (Default): Web GUI Port `8001` (`http://192.168.30.6:8001`), SNMP Port UDP `1611` (forward ke UDP `161` OLT).
         - Skema Multi-OLT Klien: OLT 2 (`8002` / `1612`), OLT 3 (`8003` / `1613`), OLT 4 (`8004` / `1614`).
    3. **Pembersihan Konfigurasi Mentahan VSOL V1600GS**:
       - Menyaring lebih dari 70 serial number ONU statis lama (`onu add 1`..`118`) dari konfigurasi mentahan, mempertahankan VLAN 20 (PPPoE), VLAN 30 (Management OLT), VLAN 4000 (TR-069), serta mengaktifkan `onu auto-learn`.
       - Mengubah konfigurasi OLT ke `web port 8001`.
    4. **Pemisahan Script MikroTik FTTH Universal vs Billing EugineBill**:
       - Memisahkan script pondasi FTTH (Cake SQM, Game Mangle, PPPoE server) dari aturan khusus billing cloud EugineBill (isolir redirect, payment gateway IP list, hotspot voucher, tunnel WireGuard).
       - Menyiapkan script 7-point non-destructive inspection (`01-inspect-client-router.rsc`) dan modul AI Agent operational guidelines (`.agents/AGENTS.md`) dengan 5 skenario percabangan otomatis (DHCP client ISP, PPPoE dial client, dedicated IP statis, bentrok subnet auto-shift ke `10.20.0.0/22`, dan pemisahan port bridge).
    5. **Repositori GitHub & Dokumentasi Terpadu**:
       - Diterbitkan ke repositori `https://github.com/Ak3ww/euginemedia-client-kits.git`.
    6. **Aturan Wajib Konstruksi Dinamis NAT Masquerade PPPoE**:
       - Mengunci protokol bahwa rule NAT Masquerade PPPoE tidak boleh dicopy secara buta. Parameter `src-address` wajib mengikuti subnet pool yang dipilih (`192.168.20.0/22` atau `10.20.0.0/22`), dan parameter `out-interface` / `out-interface-list` disesuaikan spesifik dengan port WAN ISP klien (DHCP `ether1`, dial `pppoe-out1`, atau dedicated) untuk menjamin trafik internet keluar dengan benar dan tidak merusak routing internal.
  - *Files*:
    - `CHANGELOG.md`

### v2.38.5 — 2026-09-10

### Architecture Audit & Master Blueprint Roadmap
- **Master Blueprint: Komparasi Arsitektur Salfanet-Radius vs EugineBill & Roadmap Upgrade**:
  - *Context / User Request*:
    Pengguna menginstruksikan re-clone repositori Salfanet-Radius (`https://github.com/s4lfanet/salfanet-radius.git`), melakukan audit mendalam sistem RADIUS & Local Auth menggunakan subagent otonom pada kedua codebase, serta menyusun dokumentasi komparasi obyektif dan roadmap fitur apa yang perlu dikejar vs apa yang harus dihindari.
  - *Solusi Arsitektural & Perubahan Teknis*:
    1. **Dual Subagent Codebase Audit**:
       - Mengoperasikan subagent auditor independen pada `C:\salfanet-radius` (`v5.20.0`) dan `C:\EugineBill` untuk membedah seluruh layer: FreeRADIUS configuration, REST hook authorize/post-auth, skema database, alur CoA disconnect, cron session sync, hingga Transactional Outbox.
    2. **Penyusunan Master Blueprint Document (`docs/architecture/RADIUS_LOCAL_AUTH_COMPARISON_AND_ROADMAP.md`)**:
       - Menganalisis 14 parameter teknis komparasi antara Salfanet dan EugineBill.
       - Menetapkan daftar fitur unggulan Salfanet yang **WAJIB DIKEJAR** (Per-Router `authMode`, migrasi router 1-klik, Transactional Outbox `external_task`, rekapitulasi voucher terpakai `firstLoginAt`, dynamic interim-update 300s).
       - Menetapkan daftar anti-pattern Salfanet yang **HARUS DITOLAK** demi stabilitas produksi (modul FreeRADIUS REST hook yang rawan mass-outage saat web server restart, serta pencemaran tabel `radacct` via sesi palsu *synthetic radacct*).
       - Merancang 5 fase eksekusi bertahap yang 100% backward-compatible dan bebas risiko downtime.
  - *Files*:
    - `docs/architecture/RADIUS_LOCAL_AUTH_COMPARISON_AND_ROADMAP.md`
    - `CHANGELOG.md`

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
