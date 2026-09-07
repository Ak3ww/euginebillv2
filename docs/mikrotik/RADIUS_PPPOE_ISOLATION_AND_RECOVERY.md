# Panduan Isolasi Hard RADIUS PPPoE & Pemulihan Secret MikroTik

Dokumen ini menjelaskan arsitektur pemisahan penuh (Hard Isolation) antara layanan FreeRADIUS untuk Voucher Hotspot dan Autentikasi Pelanggan PPPoE, serta prosedur pemulihan secret MikroTik jika terjadi anomali.

---

## 1. Latar Belakang & Akar Masalah Lag PPPoE

Saat FreeRADIUS diaktifkan untuk Hotspot:
1. **MikroTik Script Bug**: Script RADIUS sebelumnya mendaftarkan service `ppp,hotspot,login,wireless` dan mengaktifkan `/ppp aaa set use-radius=yes accounting=yes` dengan timeout `3s`.
2. **Paket Menunggu Timeout**: MikroTik memeriksa RADIUS untuk setiap sesi PPP dan mengirim laporan accounting setiap 5 menit. Karena database FreeRADIUS tidak memiliki secret PPPoE (atau service FreeRADIUS sedang tidak merespons), setiap paket menunggu timeout 3 detik sehingga menimbulkan packet drop dan latensi parah bagi pelanggan PPPoE.
3. **Penyatuan Flag Database**: Checkbox pengaturan Hotspot sebelumnya membuat flag `radiusEnabled` bernilai `true`, sehingga sistem background lama di VPS menganggap PPPoE juga beroperasi dalam mode RADIUS.

---

## 2. Arsitektur Isolasi (Hard Isolation)

### A. MikroTik RouterOS Configuration
Ketika **Gunakan FreeRADIUS untuk PPPoE** dimatikan (`radiusPppoeEnabled = false`):
- **PPP AAA**: Wajib `use-radius=no accounting=no`.
  ```routeros
  /ppp aaa set use-radius=no accounting=no
  ```
- **Radius Entries**: Service yang didaftarkan **HANYA** `hotspot`. Kata `ppp` tidak boleh ada di parameter `service`.
  ```routeros
  /radius set [find] service=hotspot
  ```
- **Hotspot Server Profiles**: Tetap menggunakan RADIUS jika **Gunakan FreeRADIUS untuk Hotspot** aktif.
  ```routeros
  /ip hotspot profile set [find] use-radius=yes
  ```

### B. Sinkronisasi Otomatis API
Method `HotspotUserService.syncRadiusConfiguration` otomatis dieksekusi setiap kali toggle diubah di antarmuka admin (`/admin/settings/company`):
- Menghubungi seluruh router aktif via MikroTik API.
- Menyetel `/ppp/aaa` ke `use-radius=no accounting=no`.
- Memperbarui seluruh entri `/radius` sehingga service menjadi `hotspot` murni.

---

## 3. Pemulihan Secret MikroTik (Emergency Restore)

Semua kredensial pelanggan PPPoE tersimpan aman dan permanen di database EugineBill pada tabel `pppoeUser`.

### Metode 1: Melalui CLI di VPS (Paling Direkomendasikan)
Jalankan script pemulihan langsung di server:
```bash
cd /var/www/EugineBill-radius
node scripts/restore-all-secrets-to-mikrotik.js
```
Skrip ini akan:
1. Mengamankan toggle di database (`radiusPppoeEnabled = false`).
2. Menyetel `/ppp/aaa use-radius=no accounting=no` dan membersihkan entri `/radius` di seluruh MikroTik aktif.
3. Membaca seluruh data pelanggan di tabel `pppoeUser` dan `radcheck`.
4. Mendaftarkan kembali setiap secret yang hilang di MikroTik lengkap dengan username, password, profile (normal/isolir), dan IP statis jika ada.

### Metode 2: Melalui REST API
Kirim request POST terautentikasi ke:
```http
POST /api/pppoe/users/restore-mikrotik
Content-Type: application/json

{}
```

---

## 4. Strategi Migrasi PPPoE ke RADIUS Zero-Lag di Masa Depan

Jika di kemudian hari ingin memigrasikan PPPoE ke FreeRADIUS tanpa menimbulkan lag pada pelanggan:
1. **Pre-populate Data (Dual-Store)**: Sebelum mengaktifkan `radiusPppoeEnabled`, seluruh user wajib telah disinkronkan ke tabel `radcheck`, `radreply`, dan `radusergroup`.
2. **Uji Coba radtest**: Lakukan pengujian CLI `radtest <username> <password> 127.0.0.1 0 <secret>` dan pastikan respon `Access-Accept` diperoleh dalam waktu < 20ms.
3. **Timeout MikroTik Kecil**: Atur `timeout=300ms` pada `/radius` di MikroTik agar tidak ada jeda terasa jika server sibuk.
4. **Fallback ke Local Secret**: Biarkan `/ppp/secret` lokal tetap ada di MikroTik sebagai fail-safe cadangan saat masa transisi.
