# Panduan Cepat Turnkey: Easy Setup VPS & Easy Setup MikroTik EugineBill

Dokumentasi ini adalah panduan praktis *"Zero-Friction / Siap Pakai"* untuk instalasi VPS dan integrasi MikroTik. Hanya dengan **1 perintah di VPS** dan **beberapa kali klik serta paste skrip di Winbox**, seluruh sistem billing, VPN, FTTH OLT, Remote ONT, dan TR-069 siap melayani pelanggan secara profesional.

---

## 1. Easy Setup VPS: 1 Perintah Curl Selesai (5 Menit)

Untuk server VPS baru dengan sistem operasi **Ubuntu 20.04 / 22.04 / 24.04 LTS**, login via SSH sebagai root dan jalankan **satu baris perintah** ini:

```bash
curl -fsSL https://raw.githubusercontent.com/Ak3ww/euginebillv2/main/scripts/install.sh | sudo bash
```

### Yang Dikerjakan Otomatis oleh Installer:
1. **Node.js 20 LTS, MySQL Server, & PM2 Process Manager**.
2. **Nginx Reverse Proxy**: Port 80/443 langsung terhubung ke Next.js (port 3000), support WebSocket & batas upload berkas 100MB.
3. **FreeRADIUS 3.x + MySQL Engine**: Mendukung MS-CHAPv2 PPPoE dengan legacy OpenSSL MD4 provider.
4. **WireGuard VPN Server**: Subnet `10.200.0.0/24` pada port `51820/UDP` (untuk RouterOS v7).
5. **L2TP/IPSec VPN Server**: Subnet `10.201.0.0/24` (untuk RouterOS v6).
6. **Socat Proxy Engine**: Port `24000:24999` untuk Remote Web ONT dan port `10001:10999` untuk Remote Winbox.
7. **Firewall UFW Hardening**: Semua port sistem dibuka secara otomatis.
8. **Persistent Storage**: Menjamin bukti transfer dan foto KTP tersimpan aman di `/var/data/EugineBill/uploads/`.
9. **3 Layanan PM2 Mandiri**:
   - `EugineBill-radius` (Web Application & Built-in ACS Core)
   - `EugineBill-wa` (WhatsApp Baileys Service)
   - `EugineBill-cron` (Otomasi Tagihan & Sinkronisasi)

---

## 2. Inisialisasi Pertama Kali: Setup Wizard Browser (`/setup`)

Setelah installer selesai:
1. Buka browser laptop/HP ke alamat: `http://<IP_PUBLIK_VPS>/setup`
2. **Langkah 1 (Profil Perusahaan)**: Masukkan nama ISP / RTRW-Net, nomor WhatsApp, dan alamat.
3. **Langkah 2 (Akun Utama)**: Buat akun Super Admin pertama Anda (Username & Password).
4. **Langkah 3 (Format Billing)**: Tentukan prefix ID pelanggan (misal `EB-`) dan tanggal jatuh tempo bulanan (misal `20`).
5. Klik **Selesaikan Inisialisasi** &rarr; Halaman setup otomatis terkunci permanen demi keamanan, dan Anda langsung diarahkan ke halaman login admin (`/admin/login`).

---

## 3. Easy Setup MikroTik: Cuma Klik & Paste Script Winbox

Seluruh konfigurasi MikroTik dirancang modular. Teknisi **cukup menyalin skrip dari antarmuka web EugineBill** lalu mem-paste-nya ke **Winbox &rarr; New Terminal**.

```text
+-------------------------------------------------------------------------------+
|                             ADMIN EUGINEBILL UI                               |
| 1. Klik Salin Script VPN      2. Klik Salin Script FTTH    3. Klik Salin ACS  |
+-------------------------------------------------------------------------------+
                                       │
                                       ▼ (1-Klik Copy ke Clipboard)
+-------------------------------------------------------------------------------+
|                            WINBOX MIKROTIK ROUTER                             |
|              Buka menu "New Terminal" ───> Klik Kanan ───> PASTE              |
+-------------------------------------------------------------------------------+
                                       │
                                       ▼
             [ SISTEM 100% ONLINE, TERHUBUNG KE VPS & SIAP PAKAI ]
```

---

### Skenario 1: Menghubungkan MikroTik ke VPS (VPN Client 1-Klik)

Agar MikroTik dapat berkomunikasi dengan VPS tanpa IP publik statis di sisi router:

1. Di Admin EugineBill, buka menu **Jaringan &rarr; VPN Client** (`/admin/network/vpn-client`).
2. Klik tombol **"+ Tambah VPN Client"**.
3. Masukkan nama router (misal: `Router-Pusat`), lalu pilih tipe:
   - **WireGuard (Direkomendasikan untuk RouterOS v7.x)**
   - **L2TP (Untuk RouterOS v6.x)**
4. Klik **Simpan** &rarr; Sistem langsung menghasilkan skrip RouterOS lengkap dengan kunci enkripsi unik.
5. Klik tombol **"Salin Script"**.
6. Di Winbox MikroTik, buka **New Terminal**, lalu **Paste**.
7. **Hasil**:
   - Router langsung tersambung ke VPN VPS dengan IP tunnel (misal `10.200.0.2`).
   - Port Winbox dan API MikroTik otomatis di-forward ke VPS sehingga router dapat di-remote dari mana saja.

---

### Skenario 2: Pondasi Awal Jaringan FTTH Lengkap (Ultra-Lean)

Untuk router baru yang akan dipasang di lapangan melayani OLT dan pelanggan:

1. Buka file [`deployment-pack-client/02-mikrotik-ftth-complete.rsc`](file:///c:/EugineBill/deployment-pack-client/02-mikrotik-ftth-complete.rsc).
2. Salin seluruh isi file tersebut.
3. Di Winbox MikroTik, buka **New Terminal**, lalu **Paste**.
4. **Hasil Langsung Aktif**:
   - **WAN DHCP Client (ether1)**: Otomatis meminta IP dan internet dari modem ISP.
   - **LAN DHCP Server (ether2-5)**: Teknisi bisa colok laptop atau Access Point di port LAN manapun dan langsung mendapat IP `192.168.50.x` serta internet.
   - **VLAN 20 (PPPoE FTTH)**: BRAS Server PPPoE aktif pada VLAN 20 dengan bandwidth profile 10–100 Mbps dan user pengetesan `test/123`.
   - **VLAN 30 (Management OLT)**: Gateway `192.168.30.1/24` aktif. Web GUI OLT VSOL dapat diakses langsung melalui browser di `http://192.168.30.1:8001` tanpa perlu cabut colok kabel LAN ke OLT!
   - **DNS Resolver & Cloud Time**: Waktu jam sistem dan DNS sinkron otomatis ke Cloudflare & Google.

---

### Skenario 3: Remote Web GUI Modem ONT Pelanggan (1-Klik di UI)

Untuk meremote modem pelanggan di rumah tanpa mendatangi lokasi:

1. Di Admin EugineBill, buka menu **Monitoring PPPoE** (`/admin/sessions/pppoe`) atau daftar pelanggan.
2. Klik tombol **"Remote ONT"** pada pelanggan yang diinginkan.
3. Sistem secara otomatis memvalidasi kesiapan koneksi:
   - **Jika API router belum terhubung**: Modal otomatis menampilkan kartu panduan aktivasi yang memuat skrip Winbox dinamis sesuai port API router (`router.port`). Klik tombol **"Salin Script"**, paste di Terminal Winbox, lalu klik ulang.
   - **Jika siap**: Cukup klik tombol **"Buka Akses Web GUI ONT"**.
4. **Hasil**: Browser otomatis membuka tab baru mengarah ke web login modem pelanggan (port proxy aman temporary 10 menit).

---

### Skenario 4: Aktivasi TR-069 Built-in ACS (VLAN 4000)

Jika ingin memantau status modem ONT, redaman optik dBm, dan mengubah password WiFi dari web admin:

1. Di Admin EugineBill, buka menu **TR-069 ACS &rarr; Perangkat** (`/admin/acs`).
2. Klik tombol **"Buka Panduan Setup TR-069"**:
   - **Langkah 1 (MikroTik)**: Klik **"Salin Script MikroTik"**, lalu paste di Winbox New Terminal untuk mengaktifkan `vlan4000-tr069`, gateway `10.40.10.1/24`, dan DHCP server TR-069.
   - **Langkah 2 (OLT VSOL)**: Klik **"Salin CLI OLT"**, lalu paste di Telnet/SSH OLT untuk tagging VLAN 4000 pada port uplink.
   - **Langkah 3 (Modem Pelanggan)**: Masukkan URL ACS `http://<DOMAIN_VPS>/api/cwmp` ke menu TR-069 modem pelanggan (tersedia petunjuk per merk ZTE, Huawei, Fiberhome, dan VSOL).
3. **Hasil**: Modem pelanggan otomatis muncul di tabel ACS, terbaca redaman optiknya, dan dapat diatur nama/password WiFi-nya langsung dari panel web.

---

### Skenario 5: Isolasi Pelanggan Otomatis (Walled Garden)

Untuk mengarahkan pelanggan yang jatuh tempo ke halaman peringatan isolir:

1. Buka menu **Pengaturan &rarr; Setup MikroTik Isolir** (`/admin/settings/isolation/mikrotik`).
2. Tentukan domain billing atau IP VPS Anda.
3. Klik tombol **"Salin Script Firewall Isolir"**.
4. Paste skrip tersebut di Winbox New Terminal MikroTik.
5. **Hasil**: Ketika status pelanggan diubah menjadi isolir, MikroTik otomatis mengarahkan akses browsing pelanggan ke halaman pembayaran `/isolated` tanpa memutus koneksi fisik.

---

## 4. Rangkuman Direktori File Penting

| Lokasi Berkas | Kegunaan |
| :--- | :--- |
| `scripts/install.sh` | Installer turnkey 1-perintah untuk VPS baru |
| `scripts/safe-update.sh` | Skrip update aman VPS dengan auto-backup DB |
| `deployment-pack-client/01-vsol-1600gs-clean.conf` | Konfigurasi siap import untuk OLT VSOL V1600GS |
| `deployment-pack-client/02-mikrotik-ftth-complete.rsc` | Skrip pondasi lengkap FTTH MikroTik siap paste di Winbox |
| `deployment-pack-client/PANDUAN_SETUP_LENGKAP_OLT_MIKROTIK.md` | Panduan lapangan instalasi fisik OLT & MikroTik |
| `docs/mikrotik/BUILTIN_TR069_ACS_SETUP_GUIDE.md` | Panduan teknis Built-in ACS TR-069 EugineBill |
| `docs/AI_PROJECT_MEMORY.md` | Memori arsitektur jangka panjang sistem |
