# 📱 Panduan Teknis: Customer Experience & Sistem Pembayaran EugineBill
**Versi:** 2.36.0  
**Tanggal Rilis:** 3 September 2026  
**Standar Desain:** Hallmark Enterprise (Oceanic Blue `#002c60`)  
**Penulis:** Antigravity Full Stack & SRE Team  

---

## 1. Pendahuluan & Latar Belakang

Dokumen ini merinci arsitektur, alur transaksi, dan implementasi komponen antarmuka pelanggan (**Customer Portal & Direct Payment**) pada platform EugineBill RADIUS ISP.

Sebelum rilis v2.36.0:
- Halaman pembayaran (`/pay/[token]`) menggunakan form 888 baris monolith dengan icon generic `<CreditCard />` abu-abu tanpa identitas bank resmi.
- Opsi transfer manual masih tampil default meskipun ISP menggunakan payment gateway otomatis (QRIN / Duitku / Midtrans).
- Halaman login pelanggan (`/customer/login`) menggunakan gradien cyan usang dan hanya menerima input `customerId`.
- Belum ada alur pemulihan kata sandi (*forgot password*) mandiri bagi pelanggan.

Mulai v2.36.0:
- **Tampilan Pembayaran Terpadu**: Mengacu 100% pada layout referensi QRIS nasional dengan visual mobile-first berkelas.
- **Identitas Perbankan Resmi**: Integrasi 16 SVG resmi dari repositori `hafidznoor/idn-finlogos` ke dalam komponen `<BankLogo />`.
- **Multi-Identifier Login**: Pelanggan dapat masuk menggunakan **ID Pelanggan**, **Username PPPoE**, maupun **Nomor WhatsApp**.
- **Self-Service Password Reset**: Pelanggan dapat mereset password secara mandiri melalui OTP 6-digit WhatsApp.

---

## 2. Arsitektur Aset & Komponen `<BankLogo />`

Aset SVG resmi disimpan di `public/images/banks/` dan di-render melalui komponen `src/components/ui/BankLogo.tsx`:

| Kategori | Brand / Institusi | File SVG di `public/images/banks/` |
|---|---|---|
| **Bank Nasional** | BCA | `bca.svg` |
| | Bank Mandiri | `mandiri.svg` |
| | Bank BRI | `bri.svg` |
| | Bank BNI | `bni.svg` |
| | Bank Syariah Indonesia (BSI) | `bsi.svg` |
| | SeaBank | `seabank.svg` |
| | CIMB Niaga | `cimb-niaga.svg` |
| | Bank Permata | `permata.svg` |
| **E-Wallet & QRIS** | QRIS Nasional | `qris.svg` |
| | GoPay | `gopay.svg` |
| | DANA | `dana.svg` |
| | ShopeePay | `shopeepay.svg` |
| | OVO | `ovo.svg` |
| | LinkAja | `linkaja.svg` |
| **Gerai Ritel** | Alfamart | `alfamart.svg` |
| | Indomaret | `indomaret.svg` |

### Penggunaan Komponen:
```tsx
import { BankLogo, AcceptedQrisBadges } from '@/components/ui/BankLogo';

// Render logo satuan (badge / plain)
<BankLogo name="bca" size="sm" variant="badge" />

// Render deretan badge resmi yang diterima (DANA, GoPay, BCA, ShopeePay, SeaBank, BRI, Mandiri, BNI + lainnya)
<AcceptedQrisBadges />
```

---

## 3. Alur Pembayaran Tagihan (`/pay/[token]`)

Halaman pembayaran memiliki **2 Mode Tampilan Visual Utama**:

```
[ Pelanggan Buka Link /pay/token ]
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ STATE 1: PILIHAN METODE PEMBAYARAN                         │
│ • Ringkasan Tagihan (Nomor, Nama, Jumlah, Jatuh Tempo)      │
│ • Kartu Utama: QRIS Nasional (Badge Instan + Row Bank Logo) │
│ • Kartu Sekunder: Virtual Account (BCA, Mandiri, BRI, BNI)  │
│ • (Transfer Manual disembunyikan via SHOW_MANUAL_TRANSFER)  │
└─────────────────────────────────────────────────────────────┘
                 │ (Pelanggan klik QRIS)
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ STATE 2: MODE AKTIF BAYAR QRIS (REFERENSI NASIONAL)         │
│ • Header: Tombol "< Pembayaran"                             │
│ • Card 1: Total Pembayaran (Rp XXX.XXX)                      │
│           Bayar Dalam: [ 23 : 58 : 02 ] (Countdown 24 Jam)  │
│ • Card 2: Container QRIS (Logo Standar Nasional, QR SVG,    │
│           dan nomor NMID)                                   │
│ • Card 3: Banner "Menerima Berbagai Pembayaran QR"          │
│ • Card 4: 6 Langkah Petunjuk Pembayaran Resmi               │
│ • Sticky Action:                                            │
│   ├── "Simpan Kode QR" (Download Canvas Resolusi Tinggi)    │
│   └── "Saya Sudah Bayar" (Cek Status / Auto-detect Polling) │
└─────────────────────────────────────────────────────────────┘
                 │ (Status Lunas Terdeteksi)
                 ▼
[ Tampilan Berhasil Lunas & Auto Redirect ke Struk / Invoice Print ]
```

### Fitur Simpan Gambar QRIS (Canvas Engine):
Fungsi `handleDownloadQrisCanvas` membuat gambar kartu tagihan 750x1000 piksel dengan:
- Header brand korporat Oceanic Blue (`#002c60`).
- Nama perusahaan ISP dan sub-judul QRIS Nasional.
- Rincian Nomor Tagihan dan Total Bayar dalam font tebal.
- QR Code tajam beresolusi tinggi di bagian tengah.
- Banner footer daftar aplikasi yang diterima.

---

## 4. Alur Autentikasi & Reset Password Pelanggan

### Multi-Identifier Login:
Endpoint `POST /api/customer/auth/login` menerima identifier yang dapat berupa:
1. **ID Pelanggan** (contoh: `EMG001`)
2. **Username PPPoE** (contoh: `emg_budi`)
3. **Nomor WhatsApp / HP** (contoh: `081234567890`, `6281234567890`, `+6281234567890`)

### Alur Lupa Password Mandiri:
1. Pelanggan mengklik tombol **"Lupa Password?"** pada form login.
2. Pelanggan memasukkan nomor WhatsApp terdaftar.
3. Backend memanggil `POST /api/customer/auth/send-otp`, menghasilkan OTP 6-digit acak dengan masa berlaku 5 menit, dan mengirimkannya ke WhatsApp pelanggan via `WhatsAppService`.
4. Pelanggan menginput kode OTP 6-digit dan password baru yang diinginkan (minimal 4 karakter).
5. Backend memanggil `POST /api/customer/auth/reset-password`, memvalidasi OTP, mengupdate `portalPassword` di database `pppoeUser`, lalu mengonfirmasi keberhasilan.
6. Pelanggan langsung dapat login kembali dengan password baru tersebut.

---

## 5. Status Fitur Pemeliharaan (Coming Soon) di Portal Pelanggan

Untuk mencegah keluhan pengguna terhadap fitur remote TR-069 / GenieACS yang belum sepenuhnya terkonfigurasi pada perangkat modem tertentu:
- Halaman **`/customer/wifi`** menampilkan kartu informatif:
  - **Badge**: *Fitur Sedang Peningkatan Sistem (Coming Soon)*
  - **Penjelasan**: Permohonan maaf dan panduan bahwa fitur remote Wi-Fi mandiri sedang disempurnakan.
  - **Tombol Cepat**: *Hubungi Layanan Teknis WhatsApp* untuk permintaan ganti sandi Wi-Fi langsung ke admin.
- Menu **WiFi** di sidebar desktop memiliki badge label *"Segera"*, dan tombol WiFi di bottom navigation mobile memiliki dot indikator status.

---

## 6. Verifikasi & Pengujian

Seluruh kode telah diuji secara menyeluruh:
```bash
# Uji kompilasi TypeScript
cmd /c npx tsc --noEmit
# Output: Exit code 0 (0 errors)

# Uji integritas skema database Prisma
cmd /c npx prisma validate
# Output: The schema at prisma\schema.prisma is valid
```
