# 📖 Dokumentasi Spesifikasi & Template Notifikasi WhatsApp (EugineBill v2.0)

> **Dokumen Panduan Reka Ulang & Rephrase Teks Pesan (ChatGPT / Gemini Ready)**  
> *Versi 2.0 · EugineBill ISP & Billing RADIUS System*

---

## 🚀 1. Brief Project Overview (EugineBill)

**EugineBill** adalah platform manajemen ISP (Internet Service Provider), billing otomatis, dan RADIUS terintegrasi yang dirancang untuk mengelola pelanggan internet rumahan (PPPoE/FTTH) maupun E-Voucher Hotspot. 

Salah satu fitur inti EugineBill adalah **Engine Notifikasi WhatsApp Otomatis** yang berkomunikasi langsung dengan pelanggan mengenai status pendaftaran, perintah kerja teknisi, tagihan bulanan, konfirmasi pembayaran, serta peringatan isolir otomatis.

---

## 🔒 2. Aturan Keamanan & Kebijakan Variabel (Global Security Rules)

1. **Privasi Username PPPoE**:  
   - **DILARANG** menampilkan variabel `{{username}}` (Username PPPoE internal) pada pesan WhatsApp pelanggan internet rumahan/PPPoE.
   - Variabel `{{username}}` **HANYA BOLEH** digunakan pada notifikasi **E-Voucher / Hotspot** di mana pengguna memang membutuhkan kredensial login Wi-Fi publik.
   - Untuk identifikasi pelanggan rumahan, gunakan `{{customerId}}` (ID Pelanggan) atau `{{customerName}}`.
2. **Prinsip Anti-Spam & Konsolidasi Pesan**:
   - Mencegah pengiriman pesan ganda (*duplicate messages*) untuk kejadian yang sama.
   - Menggabungkan beberapa notifikasi pembayaran yang serupa menjadi **1 Notifikasi Payment Success** yang dinamis berdasarkan metode bayar (`{{paymentMethod}}`).

---

## 📋 3. Daftar Variabel Dinamis (Available Variables)

Berikut adalah variabel baku `{{placeholder}}` yang didukung oleh sistem untuk direka ulang (rephrase) di ChatGPT / Gemini:

### 👤 Data Pelanggan & Akun
- `{{customerName}}` : Nama lengkap pelanggan.
- `{{customerId}}` : ID Unik Pelanggan (contoh: `CUST-08912`).
- `{{phone}}` : Nomor WhatsApp / Telepon pelanggan.
- `{{address}}` : Alamat lokasi pemasangan.
- `{{area}}` : Nama wilayah / cluster pelanggan.
- `{{profileName}}` : Nama paket internet (contoh: `Home 20 Mbps`).
- `{{subscriptionType}}` : Tipe pendaftaran (`POSTPAID` / `PREPAID`).

### 🧾 Data Tagihan & Pembayaran
- `{{invoiceNumber}}` : Nomor invoice resmi (contoh: `INV-20260722-A91B`).
- `{{amount}}` : Nominal rupiah tagihan (contoh: `Rp 250.000`).
- `{{installationFee}}` : Biaya pemasangan (contoh: `Rp 150.000`).
- `{{dueDate}}` : Tanggal jatuh tempo tagihan.
- `{{daysRemaining}}` : Sisa hari sebelum jatuh tempo.
- `{{daysOverdue}}` : Jumlah hari keterlambatan bayar.
- `{{paymentMethod}}` : Metode bayar (`QRIS`, `Transfer Bank BCA`, `Alfamart/Indomaret`, `Kasir`).
- `{{paymentLink}}` : Link langsung halaman pembayaran online.
- `{{bankAccounts}}` : Daftar nomor rekening resmi perusahaan.
- `{{expiredDate}}` : Masa aktif baru setelah tagihan dibayar.

### 🎫 Khusus Hotspot / E-Voucher (Khusus Login Publik)
- `{{voucherCodes}}` : Kode voucher Wi-Fi Hotspot.
- `{{orderNumber}}` : Nomor order pembelian voucher.
- `{{validity}}` : Masa berlaku voucher (contoh: `24 Jam` / `7 Hari`).

### 🏢 Perusahaan & Informasi Umum
- `{{companyName}}` : Nama ISP / Perusahaan Anda.
- `{{companyPhone}}` : Nomor Customer Service / WhatsApp Resmi Perusahaan.
- `{{companyEmail}}` : Email resmi support ISP.

---

## ⚡ 4. Alur & Spesifikasi Template Notifikasi Aktif

---

### 🟢 A. Alur Pendaftaran & SPK Pemasangan Baru

#### 1. Konfirmasi Form Pendaftaran Diterima
- **Pemicu (Trigger)**: Seketika saat calon pelanggan mengirimkan form pendaftaran di `/daftar`.
- **Tujuan**: Konfirmasi bahwa formulir telah masuk ke sistem.
- **Draft Teks Pesan (Dapat Direphrase)**:
```text
✅ *Konfirmasi Pendaftaran*

Halo *{{customerName}}*,

Terima kasih telah mendaftar! Kami telah menerima pendaftaran Anda dengan detail berikut:

📋 *Detail Pendaftaran:*
• Nama: {{customerName}}
• Telepon: {{phone}}
• Paket: {{profileName}}
• Alamat: {{address}}

📌 *Status:* Pendaftaran Anda sedang diproses oleh tim kami.

Anda akan menerima notifikasi lebih lanjut setelah pendaftaran disetujui.

Jika ada pertanyaan, silakan hubungi kami di *{{companyPhone}}*

_{{companyName}}_
```

---

#### 2. Persetujuan Pendaftaran (Registration Approved)
- **Pemicu (Trigger)**: Admin menyetujui pendaftaran di `/admin/registrations`.
- **Aturan**: Tanpa menampilkan password/username PPPoE internal.
- **Draft Teks Pesan (Dapat Direphrase)**:
```text
🎉 Halo {{customerName}},

Selamat! Pendaftaran langganan internet Anda telah *DISETUJUI*!

━━━━━━━━━━━━━━━━━━━━━━
*📱 INFORMASI PELANGGAN*
━━━━━━━━━━━━━━━━━━━━━━
🆔 ID Pelanggan: {{customerId}}
📦 Paket: {{profileName}}
💳 Tipe Layanan: {{subscriptionType}}

━━━━━━━━━━━━━━━━━━━━━━
*💰 INVOICE INSTALASI*
━━━━━━━━━━━━━━━━━━━━━━
🧾 No. Invoice: {{invoiceNumber}}
💵 Biaya Instalasi: {{installationFee}}
📅 Jatuh Tempo: {{dueDate}}

🔗 *Link Pembayaran:*
{{paymentLink}}

{{bankAccounts}}

Tim teknisi kami akan menghubungi Anda untuk konfirmasi jadwal pemasangan lokasi.

Terima kasih! 🙏
_{{companyName}}_
```

---

#### 3. SPK Pemasangan Selesai & Trigger Invoice (Work Order Completed)
- **Alur & Logika Anti-Spam di Belakang Layar**:
  1. Admin membuat User & Surat Perintah Kerja (SPK).
  2. Teknisi menerima SPK di Portal Teknisi.
  3. Teknisi menyelesaikan pemasangan di lokasi dan menekan **"Selesai Pemasangan"**.
  4. **Deteksi Pesan Terkirim (Anti-Duplicate)**: Sistem mengecek flag `isNotificationSent` pada invoice. Jika invoice *belum pernah* dikirimkan, pesan tagihan otomatis tertrigger. Jika *sudah pernah* terkirim saat pendaftaran, sistem **TIDAK AKAN** mengirimkan pesan ganda.
- **Draft Teks Pesan (Dapat Direphrase)**:
```text
🧾 *Pemasangan Selesai & Invoice Layanan*

Halo {{customerName}},

Pemasangan jaringan internet Anda telah selesai dilaksanakan oleh tim teknisi kami.

━━━━━━━━━━━━━━━━━━━━━━
*📋 DETAIL INVOICE PERTAMA*
━━━━━━━━━━━━━━━━━━━━━━
📌 No. Invoice: {{invoiceNumber}}
🆔 ID Pelanggan: {{customerId}}
📦 Paket: {{profileName}}
💰 Total Tagihan: {{amount}}
📅 Jatuh Tempo: {{dueDate}}

🔗 *Bayar Sekarang:*
{{paymentLink}}

{{bankAccounts}}

Terima kasih telah berlangganan! 🙏

{{companyName}}
☎️ {{companyPhone}}
```

---

### 🟢 B. Tagihan Bulanan & Notifikasi Keterlambatan

#### 4. Pengingat Tagihan Bulanan (Invoice Reminder)
- **Pemicu (Trigger)**: Cron Job otomatis H-3 / H-1 sebelum jatuh tempo.
- **Draft Teks Pesan (Dapat Direphrase)**:
```text
⏰ *Pengingat Pembayaran Tagihan*

Halo {{customerName}},

Ini adalah pengingat tagihan internet Anda yang akan segera jatuh tempo.

━━━━━━━━━━━━━━━━━━━━━━
*📋 Detail Tagihan*
━━━━━━━━━━━━━━━━━━━━━━
🧾 No. Invoice: {{invoiceNumber}}
🆔 ID Pelanggan: {{customerId}}
📦 Paket: {{profileName}}
📍 Area: {{area}}
💰 Jumlah Tagihan: {{amount}}
📅 Jatuh Tempo: {{dueDate}}
⏱️ Sisa Waktu: {{daysRemaining}} hari

🔗 *Bayar Sekarang:*
{{paymentLink}}

{{bankAccounts}}

Mohon lakukan pembayaran sebelum jatuh tempo agar layanan internet tetap berjalan lancar.

{{companyName}}
☎️ {{companyPhone}}
```

---

#### 5. Peringatan Jatuh Tempo / Overdue Warning
- **Pemicu (Trigger)**: Tagihan telah melewahi tanggal jatuh tempo (H+1 sampai H+3) sebelum diisolir.
- **Draft Teks Pesan (Dapat Direphrase)**:
```text
⚠️ *PERINGATAN KETERLAMBATAN PEMBAYARAN*

Halo {{customerName}},

Tagihan internet Anda dengan No. {{invoiceNumber}} telah melewati tanggal jatuh tempo.

Segera lakukan pembayaran untuk menghindari pengisolisasian / pemutusan koneksi otomatis.

💰 Total Tagihan: {{amount}}

🔗 *Bayar Sekarang:*
{{paymentLink}}

{{bankAccounts}}

📞 Hubungi kami: {{companyPhone}}

_{{companyName}}_
```

---

#### 6. Peringatan Isolir Otomatis (Service Suspension)
- **Pemicu (Trigger)**: Otomatis saat koneksi pelanggan diisolir oleh MikroTik karena melewati batas toleransi bayar.
- **Draft Teks Pesan (Dapat Direphrase)**:
```text
⚠️ *PEMBERITAHUAN ISOLIR LAYANAN*

Halo {{customerName}},

Layanan internet Anda sementara diisolir karena tagihan belum diterima hingga batas waktu toleransi.

━━━━━━━━━━━━━━━━━━━━━━
🆔 ID Pelanggan: {{customerId}}
📅 Jatuh Tempo: {{dueDate}}
💰 Total Tagihan: {{amount}}
━━━━━━━━━━━━━━━━━━━━━━

Koneksi internet Anda akan *OTOMATIS AKTIF KEMBALI* dalam 1 detik setelah pembayaran berhasil.

🔗 *Bayar & Aktifkan Sekarang:*
{{paymentLink}}

📞 CS Support: {{companyPhone}}

_{{companyName}}_
```

---

### 🟢 C. Pembayaran & Kwitansi (Ter-Konsolidasi)

#### 7. Pembayaran Berhasil (Payment Success - Unified Receipt)
- **Pemicu (Trigger)**: Dikirim 1 detik setelah pembayaran lunas (via Payment Gateway, Transfer Manual Disetujui, maupun Kasir Direct).
- **Catatan**: Mengonsolidasikan notifikasi receipt menjadi 1 pesan dinamis menggunakan variabel `{{paymentMethod}}`.
- **Draft Teks Pesan (Dapat Direphrase)**:
```text
✅ *PEMBAYARAN LUNAS & BERHASIL*

Halo {{customerName}},

Terima kasih! Pembayaran tagihan internet Anda telah berhasil dikonfirmasi.

━━━━━━━━━━━━━━━━━━━━━━
📋 *Detail Transaksi*
━━━━━━━━━━━━━━━━━━━━━━
🆔 ID Pelanggan: {{customerId}}
📌 No. Invoice: {{invoiceNumber}}
💰 Jumlah Dibayar: {{amount}}
💳 Metode Pembayaran: {{paymentMethod}}
📦 Paket: {{profileName}}
📅 Masa Aktif Hingga: {{expiredDate}}

🎉 Layanan internet Anda aktif dan dapat digunakan kembali. Terima kasih atas kepercayaan Anda!

{{companyName}}
☎️ {{companyPhone}}
```

---

#### 8. Pembayaran Manual Ditolak Admin (Manual Payment Rejected)
- **Pemicu (Trigger)**: Admin menolak foto bukti transfer manual pelanggan di `/admin/manual-payments`.
- **Draft Teks Pesan (Dapat Direphrase)**:
```text
❌ *Pembayaran Manual Ditolak*

Halo {{customerName}},

Mohon maaf, bukti transfer pembayaran manual Anda *DITOLAK* oleh admin.

📋 *Detail Transaksi:*
• ID Pelanggan: {{customerId}}
• No. Invoice: {{invoiceNumber}}
• Jumlah: {{amount}}

💬 *Alasan Penolakan:*
{{rejectionReason}}

Silakan periksa kembali bukti transfer Anda dan upload ulang melalui link berikut:
🔗 Upload Ulang: {{paymentLink}}

{{bankAccounts}}

📞 Customer Support: {{companyPhone}}

_{{companyName}}_
```

---

### 🟢 D. Khusus Hotspot / E-Voucher

#### 9. Pembelian E-Voucher Hotspot Berhasil
- **Pemicu (Trigger)**: Pembelian voucher Wi-Fi Hotspot berhasil via pembayaran online.
- **Catatan**: Diizinkan menampilkan kode voucher / username login.
- **Draft Teks Pesan (Dapat Direphrase)**:
```text
🎫 *Pembelian E-Voucher Berhasil*

Halo {{customerName}},

Terima kasih telah membeli E-Voucher Wi-Fi!

━━━━━━━━━━━━━━━━━━━━━━
*📋 DETAIL PESANAN*
━━━━━━━━━━━━━━━━━━━━━━
🔢 Nomor Order: {{orderNumber}}
📦 Paket: {{profileName}}
🎟️ Jumlah: {{quantity}} voucher
⏱️ Masa Berlaku: {{validity}}

━━━━━━━━━━━━━━━━━━━━━━
*🎟️ KODE VOUCHER ANDA*
━━━━━━━━━━━━━━━━━━━━━━
{{voucherCodes}}

📝 *Cara Penggunaan:*
1. Hubungkan perangkat Anda ke Wi-Fi {{companyName}}
2. Buka browser hingga halaman login muncul
3. Masukkan kode voucher di atas lalu klik Login

{{companyName}}
📞 {{companyPhone}}
```

---

### 🟢 E. Informasi Tambahan & Layanan

#### 10. Informasi Detail Akun Pelanggan (Account Info)
- **Pemicu (Trigger)**: Diberikan saat pelanggan meminta info akun dari portal.
- **Draft Teks Pesan (Dapat Direphrase)**:
```text
📋 *Informasi Akun Pelanggan*

Halo {{customerName}},

Berikut adalah rincian data akun langganan Anda:

━━━━━━━━━━━━━━━━━━━━━━
*📱 DETAIL AKUN*
━━━━━━━━━━━━━━━━━━━━━━
🆔 ID Pelanggan: {{customerId}}
📦 Paket Layanan: {{profileName}}
📍 Area: {{area}}
📅 Masa Aktif Hingga: {{expiredAt}}

📞 Support: {{companyPhone}}
📧 Email: {{companyEmail}}

_{{companyName}}_
```

---

#### 11. Notifikasi Balasan Tiket Bantuan (Support Ticket Reply)
- **Pemicu (Trigger)**: Admin / Teknisi membalas pesan tiket bantuan pelanggan.
- **Draft Teks Pesan (Dapat Direphrase)**:
```text
📢 *Update Tiket Bantuan*

Halo {{customerName}},

Ada balasan baru dari Tim Support {{companyName}} untuk Tiket #{{ticketNumber}}:

"{{message}}"

Jika masih ada kendala, Anda dapat membalas pesan ini atau mengakses portal bantuan.

Terima kasih,
_{{companyName}}_
```

---

#### 12. Notifikasi Transfer Manual ke HP Admin (Admin Manual Payment Alert)
- **Pemicu (Trigger)**: Pelanggan mengunggah foto bukti transfer baru di `/pay-manual`.
- **Penerima**: HP Admin Perusahaan (`adminPhone`).
- **Draft Teks Pesan (Dapat Direphrase)**:
```text
🔔 *NOTIFIKASI PEMBAYARAN MANUAL MASUK*

📋 *Detail Pembayaran:*
📌 Invoice: {{invoiceNumber}}
👤 Pelanggan: {{customerName}}
🆔 ID: {{customerId}}
💰 Jumlah: {{amount}}

🏦 *Informasi Transfer:*
Bank Pengirim: {{senderBank}}
Nama Pengirim: {{senderName}}
No. Rekening: {{senderAccount}}
📝 Catatan: {{notes}}

⚠️ Silakan lakukan verifikasi dan approval di Admin Panel.

{{companyName}}
```

---

## 🚫 5. Daftar Fitur Notifikasi Diberhentikan / Non-Aktif (Disabled Features)

Fitur notifikasi berikut sengaja **dinonaktifkan / di-disable** untuk menjaga ketenangan pelanggan dan menghindari pengiriman pesan berlebihan (spam):

1. **Admin Create User Notification (`admin-create-user`)**  
   - *Status*: **Non-Aktif**.  
   - *Alasan*: Akun manual buatan admin tidak perlu langsung mengirim WA otomatis saat dibuat; penyerahan akun dilakukan terpisah atau saat pemasangan.
2. **Ucapan Selamat Datang (`welcome-message`)**  
   - *Status*: **Non-Aktif**.  
   - *Alasan*: Menghindari pesan berulang karena pesan persetujuan pendaftaran & SPK selesai sudah cukup menyambut pelanggan baru.
3. **Kwitansi Ganda (`payment_receipt` redundant)**  
   - *Status*: **Di-Konsolidasi**.  
   - *Alasan*: Digabungkan penuh ke dalam 1 pesan `Payment Success` dinamis agar pelanggan hanya menerima 1 pesan WhatsApp resmi per pembayaran.

---

*Dokumen `docs.md` ini disiapkan khusus untuk prompt rephrase pada ChatGPT atau Gemini.*
