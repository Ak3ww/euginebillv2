# Panduan Deployment Vendor & Layanan Sewa Billing (EugineBill v2.39.0)

Dokumen ini adalah panduan resmi bagi vendor (penyedia sistem) untuk menyewakan atau menginstal platform **EugineBill** kepada klien ISP/RT-RW Net baru secara mandiri (*Managed Single-Tenant VPS*).

---

## 1. Arsitektur Deployment Klien (*Managed Single-Tenant*)

EugineBill didesain dengan model **Single-Tenant per VPS**. Setiap klien ISP menyewa atau memiliki 1 VPS mandiri dengan database, konfigurasi, dan isolasi data 100% terpisah.

### Spesifikasi VPS Minimum & Rekomendasi
| Komponen | Spesifikasi Minimum | Rekomendasi Production |
| :--- | :--- | :--- |
| **OS** | Ubuntu 22.04 / 24.04 LTS | Ubuntu 24.04 LTS (x86_64) |
| **CPU** | 2 vCPU | 4 vCPU |
| **RAM** | 2 GB (+ 2 GB Swap) | 4 GB - 8 GB RAM |
| **Storage** | 30 GB SSD / NVMe | 50 GB - 100 GB NVMe |
| **Network** | 1 IPv4 Publik Statis | 1 IPv4 Publik Statis |

---

## 2. Port Firewall & Security Checklist

Jalankan skrip pembuka port otomatis pada VPS baru:
```bash
sudo bash scripts/setup-vps-ports.sh
```

Daftar port yang wajib dibuka pada Cloud Security Group / Firewall VPS:
- **Port 80/tcp & 443/tcp**: Akses Web Admin, Customer Portal, Payment Page (`/pay/[token]`), dan Webhook Payment Gateway.
- **Port 22/tcp**: Akses SSH Management VPS.
- **Port 51820/udp**: Server WireGuard VPN (tunneling MikroTik ke VPS).
- **Port 10001-10999/tcp**: Range port Remote Winbox & MikroTik Services Forwarding publik (Winbox, WebFig, API per router).
- **Port 24000-24999/tcp**: Range port ONT Remote Proxy (`socat` + Dynamic NAT MikroTik untuk remote modem pelanggan).
- **Port 1812/udp & 1813/udp**: FreeRADIUS Authentication & Accounting (jika klien menggunakan RADIUS).
- **Port 3799/udp**: RADIUS CoA (Change of Authorization / Disconnect Request).
- **Port 7547/tcp & 7567/tcp**: GenieACS TR-069 CWMP listener & File Server (untuk auto-provisioning ONT).
- **Port 500/udp, 4500/udp, 1701/udp**: L2TP / IPSec VPN Server (opsional jika router memakai L2TP).
- **Port 3306/tcp**: MySQL / MariaDB (HANYA BIND KE `127.0.0.1` / Private VPN, jangan dibuka ke publik).

---

## 3. Instalasi Awal pada VPS Baru (Step-by-Step)

### Step 1: Install Paket Sistem & Node.js
```bash
sudo apt-get update && sudo apt-get upgrade -y
sudo apt-get install -y curl git ufw socat mysql-server wireguard gzip

# Install Node.js 20.x LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 Process Manager secara global
sudo npm install -g pm2
```

### Step 2: Konfigurasi Database MySQL
```sql
sudo mysql -u root
CREATE DATABASE euginebill CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'eugineuser'@'localhost' IDENTIFIED BY 'PasswordKuatAndaDisini123!';
GRANT ALL PRIVILEGES ON euginebill.* TO 'eugineuser'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### Step 3: Setup Direktori Unggahan Permanen (*Zero Data Loss*)
```bash
sudo mkdir -p /var/data/EugineBill/uploads/receipts
sudo mkdir -p /var/data/EugineBill/uploads/proofs
sudo mkdir -p /var/data/EugineBill/uploads/logos
sudo chown -R www-data:www-data /var/data/EugineBill/uploads
sudo chmod -R 775 /var/data/EugineBill/uploads
```

### Step 4: Clone Repository & Konfigurasi Lingkungan (.env)
```bash
cd /var/www
git clone https://github.com/USERNAME/EugineBill.git EugineBill-radius
cd /var/www/EugineBill-radius

cp .env.example .env
nano .env
```
Isi variabel kunci di `.env`:
- `DATABASE_URL="mysql://eugineuser:PasswordKuatAndaDisini123!@localhost:3306/euginebill"`
- `NEXT_PUBLIC_APP_URL="https://billing.ispklien.com"`
- `VPS_PUBLIC_IP="103.xxx.xxx.xxx"`
- `UPLOAD_DIR="/var/data/EugineBill/uploads"`
- Generate secret untuk `NEXTAUTH_SECRET`, `AGENT_JWT_SECRET`, dan `ENCRYPTION_KEY`.

### Step 5: Install Dependensi & Sinkronisasi Skema
```bash
npm install
npx prisma generate
npx prisma db push --skip-generate
npm run build
```

### Step 6: Jalankan Layanan dengan PM2
```bash
# Start Web App
pm2 start npm --name "EugineBill-radius" -- start

# Start WhatsApp Baileys & Cron Jobs (jika dikonfigurasi)
pm2 start "node src/server/jobs/cron.js" --name "EugineBill-cron"

pm2 save
pm2 startup
```

---

## 4. Wizard Pengaturan Pertama Kali (*First-Time Setup Wizard*)

Pada instalasi baru (database kosong), sistem otomatis mengarahkan ke halaman wizard:
```
http://IP_VPS_ATAU_DOMAIN/setup
```

Wizard terdiri dari 3 tahapan visual:
1. **Profil Perusahaan (ISP)**: Nama ISP, Alamat, Nomor Kontak WhatsApp CS, Email Resmi, dan Zona Waktu (Default: `Asia/Jakarta`).
2. **Akun Superadmin**: Nama Lengkap Administrator, Username, Email, dan Password Master.
3. **Konfigurasi Billing & Identitas**:
   - Prefix ID Pelanggan (contoh: `EB-`, `MYISP-`, `NET-`).
   - Powered By Footer Label (contoh: `EugineBill`).
   - Hari Toleransi Isolir (*Grace Period Days*).

Setelah tombol **"Selesaikan & Simpan Setup"** ditekan:
- Profil ISP dan akun superadmin langsung terbentuk secara aman (`bcrypt.hash`).
- Endpoint `/setup` **otomatis terkunci** dan dialihkan ke `/admin/login`.

---

## 5. Menghubungkan Router MikroTik Klien

EugineBill v2.39 mendukung fleksibilitas penuh per-router autentikasi:

### Pilihan Mode Autentikasi (`authMode`):
1. **Mode Lokal MikroTik (`local` - Direkomendasikan & Default)**:
   - Pelanggan PPPoE disimpan langsung di `/ppp/secret` router klien.
   - Pelanggan Hotspot disimpan langsung di `/ip/hotspot/user`.
   - **Kelebihan**: Sangat stabil, tidak bergantung pada FreeRADIUS service atau koneksi UDP RADIUS, jika VPS restart pelanggan tetap online.
2. **Mode FreeRADIUS Server (`radius`)**:
   - Autentikasi dan pencatatan sesi kuota/waktu terpusat melalui modul database FreeRADIUS.
   - Mendukung multi-router roaming hotspot.

### Langkah Menambahkan Router:
1. Masuk ke Admin Portal ➔ **Jaringan & Router** ➔ Klik **Tambah Router**.
2. Masukkan Nama Router, IP VPN / Hostname, Port API (default `8728`), Username API, dan Password API.
3. Pilih **Mode Autentikasi**: `Lokal MikroTik (Default)` atau `FreeRADIUS Server`.
4. Klik **Generate Script Setup**:
   - Salin script yang dihasilkan dan jalankan di **Terminal Winbox MikroTik** klien.
   - Script akan otomatis membuat interface VLAN hotspot, IP pool, DHCP server, dan aturan **Walled Garden** dinamis untuk domain billing & payment gateway.

---

## 6. Pembayaran Manual & Payment Gateway

### Pembayaran Transfer Bank Manual (Tanpa Gateway):
- Klien yang belum berlangganan payment gateway (Midtrans/Duitku/Tripay/QRIN) dapat langsung menggunakan fitur transfer manual.
- Tambahkan rekening bank di **Pengaturan ➔ Perusahaan ➔ Rekening Bank** (misal: BCA, Mandiri, BRI, Bank Jago).
- Pada halaman bayar pelanggan (`/pay/[token]`), sistem **otomatis membuka formulir Transfer Bank Manual** jika belum ada payment gateway aktif.
- Pelanggan dapat menyalin nomor rekening dengan 1-klik dan mengunggah foto struk bukti transfer.
- Notifikasi langsung masuk ke dashboard admin untuk diverifikasi dan diaktifkan.

---

## 7. Pembaruan Rutin & Safe Git Patching

Saat vendor merilis patch/fitur baru di repository GitHub, klien dapat memperbarui sistem mereka dengan aman tanpa merusak database:

```bash
cd /var/www/EugineBill-radius
sudo bash scripts/safe-update.sh
```

### Apa yang dilakukan `scripts/safe-update.sh` secara otomatis:
1. Membuat backup database lengkap (`mysqldump`) terkompresi `.sql.gz` ke `/var/backups/euginebill/`.
2. Mencadangkan file `.env`.
3. Menjalankan `git pull` dari branch aktif.
4. Menjalankan `npx prisma db push --skip-generate` untuk sinkronisasi tabel/kolom baru tanpa menghapus data pelanggan.
5. Melakukan `npm run build`.
6. Melakukan `pm2 reload` secara anggun (*graceful reload*) pada `EugineBill-radius`, `EugineBill-wa`, dan `EugineBill-cron`.

---

## 8. Checklist Akhir Sebelum Serah Terima ke Klien

- [ ] Wizard setup `/setup` telah diselesaikan.
- [ ] Admin dapat login dengan kredensial baru di `/admin/login`.
- [ ] Profil perusahaan dan logo telah diunggah di Pengaturan.
- [ ] Rekening bank untuk transfer manual telah ditambahkan.
- [ ] Port firewall VPS telah diverifikasi (`sudo ufw status`).
- [ ] WhatsApp Gateway telah di-scan QR (menu WhatsApp Gateway).
- [ ] Uji coba pembuatan 1 paket langganan dan 1 pelanggan uji coba.
- [ ] Uji coba buka link invoice bayar `/pay/[token]` untuk verifikasi tampilan rekening manual dan upload bukti.
