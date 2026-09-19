# PANDUAN INTEGRASI JARINGAN KE BILLING EUGINEBILL RADIUS

> **Panduan Praktis Menghubungkan Jaringan ISP / RTRW.NET ke Sistem Billing**  
> Versi Dokumen: 2.40.28 — September 2026  
> EugineBill Turnkey ISP Management & Automation Platform

---

## 📋 Daftar Isi
1. [Konsep Alur Koneksi Jaringan ke Billing](#1-konsep-alur-koneksi-jaringan-ke-billing)
2. [Langkah 1: Menghubungkan Router MikroTik ke Billing (VPN Client & Port API)](#2-langkah-1-menghubungkan-router-mikrotik-ke-billing-vpn-client--port-api)
3. [Langkah 2: Menghubungkan Paket Tarif ke PPP Profile MikroTik](#3-langkah-2-menghubungkan-paket-tarif-ke-ppp-profile-mikrotik)
4. [Langkah 3: Mendaftarkan Pelanggan & Otomasi Akun PPPoE](#4-langkah-3-mendaftarkan-pelanggan--otomasi-akun-pppoe)
5. [Langkah 4: Menghubungkan OLT ke Monitoring Billing (Opsional)](#5-langkah-4-menghubungkan-olt-ke-monitoring-billing-opsional)
6. [Langkah 5: Setup WhatsApp Bot (Notifikasi Tagihan Otomatis)](#6-langkah-5-setup-whatsapp-bot-notifikasi-tagihan-otomatis)
7. [Langkah 6: Setup Payment Gateway (QRIS & Virtual Account Otomatis Lunas)](#7-langkah-6-setup-payment-gateway-qris--virtual-account-otomatis-lunas)
8. [Troubleshooting Koneksi Billing ke MikroTik](#8-troubleshooting-koneksi-billing-ke-mikrotik)

---

## 1. Konsep Alur Koneksi Jaringan ke Billing

Topologi jaringan fisik dan FTTH Anda **tetap berjalan seperti biasa**. EugineBill hanya membutuhkan jalur komunikasi API ke router MikroTik Anda untuk melakukan otomasi:
1. **Pembuatan Akun Pelanggan**: Saat admin klik simpan di billing, billing menembak API MikroTik untuk membuat `/ppp/secret`.
2. **Otomasi Isolir**: Saat pelanggan telat bayar, billing mengganti profile PPP pelanggan menjadi isolir dan mengirim perintah disconnect.
3. **Otomasi Buka Isolir**: Saat pelanggan membayar via QRIS/VA, billing mengembalikan profile normal seketika.

---

## 2. Langkah 1: Menghubungkan Router MikroTik ke Billing (VPN Client & Port API)

EugineBill terhubung ke MikroTik via terowongan VPN aman bawaan (WireGuard atau L2TP). Anda **tidak perlu IP publik statis**.

### A. Buat VPN Client di EugineBill
1. Buka menu **Jaringan & NAS** -> **VPN Client** (`/admin/network/vpn-client`).
2. Klik **Tambah VPN Client**.
3. Masukkan nama router Anda (misal `ROUTER-PUSAT`) dan tipe VPN (`WireGuard` untuk ROS 7 atau `L2TP` untuk ROS 6/7).
4. Masukkan Target Port API (default `8728` atau port custom Anda misal `8520`).
5. Klik **Simpan & Generate Script**. Salin seluruh skrip RouterOS yang tampil di layar.

### B. Jalankan Skrip di Terminal MikroTik
1. Buka Winbox -> **New Terminal**.
2. Tempelkan (paste) skrip tersebut. Skrip secara otomatis:
   - Membuat interface VPN client ke VPS.
   - Membuat user admin remote API (`api-mikrotik-...`).
   - Membuka port service API MikroTik.
   - Membuka firewall filter input di baris teratas (`place-before=0`):
     ```routeros
     /ip service set api port=8728 disabled=no address=""
     /ip firewall filter add chain=input action=accept protocol=tcp dst-port=8728,8520 comment="Allow EugineBill VPS API" place-before=0
     ```

### C. Test Koneksi di Data Router
1. Buka menu **Jaringan & NAS** -> **Data Router** (`/admin/network/routers`).
2. Centang **Hubungkan via VPN Client** -> Pilih VPN Client yang Anda buat tadi.
3. Klik tombol **Test Koneksi**. Jika muncul notifikasi sukses, MikroTik Anda sudah 100% terhubung dengan billing!

---

## 3. Langkah 2: Menghubungkan Paket Tarif ke PPP Profile MikroTik

Anda tidak perlu membuat queue manual di billing. Cukup hubungkan nama paket di billing dengan nama **PPP Profile** yang sudah ada di MikroTik Anda.

1. Buka menu **Layanan & Paket** -> **Paket Langganan** (`/admin/packages`).
2. Klik **Tambah Paket Baru**:
   - **Nama Paket**: Nama yang tampil di invoice pelanggan (misal: *Home 20 Mbps Ultra*).
   - **Harga Bulanan**: Tarif tagihan (misal: `165000`).
   - **MikroTik PPP Profile**: Pilih nama profile yang ada di MikroTik (misal `PAKET-20MBPS`).
   - **Router Target**: Pilih router MikroTik Anda.
3. Klik **Simpan**.

---

## 4. Langkah 3: Mendaftarkan Pelanggan & Otomasi Akun PPPoE

1. Buka menu **Pelanggan & ISP** -> **Data Pelanggan** (`/admin/customers`).
2. Klik **Tambah Pelanggan**:
   - Isi Nama Lengkap, Nomor WhatsApp aktif (format `08...`), dan Alamat.
   - Pilih Paket Langganan yang telah dibuat pada Langkah 2.
   - Masukkan **Username PPPoE** dan **Password PPPoE** (yang akan di-dial oleh modem ONT pelanggan).
3. Klik **Simpan Pelanggan**.
4. **Selesai!** Akun `/ppp/secret` langsung terbuat di MikroTik Anda secara instan dalam hitungan detik. Modem pelanggan dapat langsung dial PPPoE dan aktif.

---

## 5. Langkah 4: Menghubungkan OLT ke Monitoring Billing (Opsional)

Jika Anda ingin memonitor status ONT pelanggan (redaman optik RX/TX dBm dan status LOS) langsung dari dashboard billing:

1. Buka menu **OLT Management** -> **Data OLT** (`/admin/network/olts`).
2. Klik **Tambah OLT**.
3. Masukkan Nama OLT, Tipe (VSOL, ZTE, GPON/EPON), IP Management OLT Anda, dan kredensial Telnet/SNMP.
4. Klik **Simpan & Uji Koneksi**.
5. Redaman sinyal optik modem pelanggan kini terpantau secara live di billing tanpa mengganggu konfigurasi OLT yang sudah berjalan.

---

## 6. Langkah 5: Setup WhatsApp Bot (Notifikasi Tagihan Otomatis)

1. Buka menu **Pesan & Bot WA** -> **Gateway WhatsApp** (`/admin/whatsapp`).
2. Pada tab **Status Koneksi**, scan QR Code menggunakan WhatsApp di HP Admin (**Perangkat Tertaut**).
3. Status langsung berubah menjadi `TERHUBUNG (ONLINE)`.
4. Sistem billing kini otomatis mengirim:
   - Pesan selamat datang & rincian akun saat pelanggan baru dipasang.
   - Tagihan invoice otomatis H-6 dan H-1 sebelum jatuh tempo.
   - Bukti kuitansi lunas instan setelah pembayaran diterima.
   - Notifikasi pengingat isolasi.

---

## 7. Langkah 6: Setup Payment Gateway (QRIS & Virtual Account Otomatis Lunas)

Agar pelanggan bisa membayar mandiri tanpa admin harus cek mutasi bank manual:

1. Buka menu **Keuangan & Kas** -> **Payment Gateway** (`/admin/payment-gateway`).
2. Pilih provider (Midtrans, Tripay, Xendit, atau Duitku).
3. Masukkan Server Key / Merchant Code dari akun provider Anda.
4. Salin **Webhook / Callback URL** yang disediakan EugineBill dan tempelkan di dashboard payment gateway Anda.
5. Ketika pelanggan scan QRIS atau transfer VA:
   - Invoice langsung berstatus **LUNAS**.
   - Pelanggan yang terisolir **langsung otomatis aktif kembali dalam 2 detik**.

---

## 8. Troubleshooting Koneksi Billing ke MikroTik

### Q1: Saat klik "Test Koneksi", muncul error Connection Timed Out / Firewall Block?
- **Penyebab**: Rule default firewall filter MikroTik memblokir koneksi port API dari IP VPN.
- **Solusi**: Jalankan perintah ini di Terminal MikroTik (sesuaikan port Anda):
  ```routeros
  /ip service set api port=8728 disabled=no address=""
  /ip firewall filter add chain=input action=accept protocol=tcp dst-port=8728,8520 comment="Allow EugineBill VPS API" place-before=0
  ```

### Q2: Saat klik "Test Koneksi", muncul error "wrong password" atau "cannot log in"?
- **Solusi**: Periksa kembali user dan password yang diisi pada Data Router. Anda dapat menggunakan user remote yang dibuat otomatis oleh skrip VPN (`api-mikrotik-...`) atau user `admin` MikroTik Anda.

### Q3: Status VPN Client di MikroTik tidak kunjung Connected (Waiting / Disconnected)?
- **Solusi**:
  - Untuk WireGuard: Pastikan RouterOS versi 7.x dan port 51820 UDP tidak diblokir oleh ISP upstream MikroTik.
  - Untuk L2TP: Pastikan username dan password L2TP sesuai dengan kredensial yang dibuat di menu VPN Client.

---

*EugineBill RADIUS — Solusi Manajemen & Otomasi Billing ISP Tanpa Ribet.*
