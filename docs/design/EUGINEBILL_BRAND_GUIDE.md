# EugineBill / Eugine Media Group — Official Brand & Design System Guide
**Version:** 1.0.0  
**Design Philosophy:** Hallmark Oceanic Telco & Modern Fintech Standard (Anti-AI-Slop)  
**Target Applications:** Customer Portal, Public Payment Engine (`/pay/[token]`), Voucher Landing Pages, Technician PWA

---

## 1. Filosofi Desain & Karakter Brand

EugineBill dibangun sebagai platform billing ISP dan telekomunikasi kelas industri. Karakter antarmuka mengacu pada standar **Modern Oceanic Telco**:
- **Anti-AI-Slop**: Menghindari elemen fiktif, terminologi peretasan semu, efek neon cyberpunk yang menyilaukan, atau bayangan gradient berlebihan yang tidak fungsional.
- **Tinggi Kontras & Ramah Aksesibilitas (WCAG AAA)**: Teks harus terbaca jelas di layar ponsel saat siang hari terik di luar ruangan. Tidak ada teks abu-abu pudar di atas background putih.
- **Tipografi Berbobot Nyata**: Ukuran font body dan instruksi minimal 13px - 15px (tidak ada lagi font 10px mikro yang memaksa pengguna menyipitkan mata).
- **Standar Finansial Presisi**: Nominal rupiah, kode invoice, nomor Virtual Account, dan kode kasir Finpay selalu menggunakan font **monospace berbobot tebal (`font-mono font-extrabold tabular-nums`)** untuk mencegah salah transfer atau salah sebut di kasir.

---

## 2. Palet Warna Resmi (Oceanic Blue System)

### A. Warna Utama Brand (Primary & Accent)
| Nama Token | Kode HEX | Peran & Penggunaan |
|---|---|---|
| `--color-brand-primary` | `#002C60` | **Oceanic Navy**: Warna identitas utama, header, tombol primer, outline kartu aktif, logo bank frame. Melambangkan keamanan perbankan dan keandalan jaringan. |
| `--color-brand-accent` | `#0066CC` | **Cobalt Blue**: Interaksi hover, tautan teks, highlight kode pembayaran, progress bar. |
| `--color-brand-deep` | `#001C3D` | **Deep Midnight**: Sidebar gelap portal admin, teks judul terpenting, footer kontras tinggi. |

### B. Warna Status & Semantik (Semantic Colors)
| Status | HEX Background | HEX Teks & Border | Penggunaan |
|---|---|---|---|
| **Success (Lunas)** | `#ECFDF5` | `#059669` / `#047857` | Lunas, verifikasi WhatsApp berhasil, indikator jaringan online. |
| **Attention (Pending/Jatuh Tempo)** | `#FFFBEB` | `#D97706` / `#B45309` | Menunggu pembayaran, countdown timer, pengingat jatuh tempo. |
| **Danger (Overdue/Isolir)** | `#FEF2F2` | `#DC2626` / `#B91C1C` | Tagihan lewat jatuh tempo, pelanggan terisolir, transaksi gagal. |
| **Info / Highlight** | `#EFF6FF` | `#1D4ED8` / `#002C60` | Box kode bayar kasir, petunjuk gerai retail Alfamart/Indomaret. |

### C. Surface, Card, & Border
- **Canvas / Halaman**: `#F8FAFC` (Slate 50 — sejuk, bersih, tidak menyilaukan).
- **Card Surface**: `#FFFFFF` (Putih murni dengan border hairline `#E2E8F0` / Slate 200).
- **Subdued Container**: `#F1F5F9` (Slate 100 — latar nomor VA, step number badge, input background).

---

## 3. Hirarki Tipografi Standar (Typography Scale)

| Level | Desktop | Mobile | Weight | Color | Contoh Penggunaan |
|---|---|---|---|---|---|
| **Display / Hero Nominal** | `32px` | `26px` | `800` (Extrabold) | `#002C60` | `Rp 150.000` pada kartu total tagihan |
| **Heading 1 (Page Title)** | `22px` | `18px` | `700` (Bold) | `#0F172A` | "Pilih Metode Pembayaran", "Detail Tagihan" |
| **Heading 2 (Card Title)** | `16px` | `15px` | `700` (Bold) | `#0F172A` | "QRIS Standar Nasional", "Petunjuk Pembayaran" |
| **Body Primary** | `15px` | `14px` | `500` (Medium) | `#334155` | Langkah 1 s/d 6 instruksi bayar, nama paket |
| **Body Secondary / Muted** | `13px` | `12px` | `500` (Medium) | `#64748B` | Tanggal jatuh tempo, keterangan bantuan |
| **Numbers & Token (Monospace)**| `16px - 28px`| `15px - 24px` | `800` (Extrabold) | `#002C60` / `#0F172A` | Kode Bayar `021113741682`, Invoice `INV-20260902-...` |

> [!IMPORTANT]
> **Aturan Mutlak Kontras Teks:**
> Dilarang keras menggunakan teks abu-abu terang (`text-slate-400`, `text-neutral-300`, atau `text-white` di latar belakang terang) untuk instruksi, judul, atau nomor pembayaran. Rasio kontras minimal adalah 7:1 untuk kenyamanan mata pengguna.

---

## 4. Standar Alur Pembayaran Gerai Retail (Alfamart & Indomaret)

Untuk pembayaran di gerai retail offline (menggunakan aggregator **QRIN / Finpay / Pronpay**):
1. **Identifikasi Multi-Nama**:
   Komponen pembaca metode mendeteksi seluruh variasi nama dari API gateway:
   `alfa`, `alfamart`, `alfamidi`, `lawson`, `indo`, `indomaret`, `indomart`, `finpay`, `pronpay`, `retail`.
2. **Format Kotak Kode Bayar**:
   Menampilkan judul yang benar: **"Kode Pembayaran Kasir"** (bukan Virtual Account bank transfer), nomor kode yang dapat disalin dengan 1 klik, dan nama gerai yang bersangkutan.
3. **Standar Dialog Kasir (Script Petunjuk)**:
   - Beritahu kasir: *"Mau bayar merchant **Finpay** (atau **Pronpay / Pembayaran Online**)"*.
   - Sebutkan kode pembayaran kepada kasir.
   - Verifikasi nama dan nominal sebelum membayar tunai/debit.
   - Ambil struk resmi kasir sebagai bukti sah.

---

## 5. Arsitektur Domain & Tautan Pembayaran Kanonikal

### Mengapa terjadi perbedaan domain?
EugineBill mendukung portal pelanggan pada subdomain tersendiri (`customer.euginemediagroup.com`) maupun domain utama (`euginemediagroup.com`):
- **Canonical Payment Route**: `https://euginemediagroup.com/pay/[token]`
- **Customer Portal Origin**: `https://customer.euginemediagroup.com/customer`

### Standar Penanganan:
1. **Aplikasi Client Portal (`/customer`)**:
   Saat tombol "Bayar" diklik pada portal pelanggan, aplikasi memprioritaskan URL kanonikal `inv.paymentLink` (yang sudah terisi domain utama resmi dari basis data perusahaan), sehingga pelanggan diarahkan secara mulus ke halaman pembayaran tanpa terhalang konfigurasi Nginx subdomain.
2. **Next.js Route Rewrite**:
   Disediakan rewrite internal `/customer/pay/:token` $\rightarrow$ `/pay/:token` pada `next.config.ts` untuk memastikan jika tautan diakses dengan prefix `/customer`, halaman tetap terbuka sempurna (tidak menghasilkan error 404).
3. **Nginx Reverse Proxy Standar**:
   Untuk subdomain `customer.euginemediagroup.com`, Nginx disarankan mem-proxy seluruh path `location /` ke port `127.0.0.1:3000` dengan header `Host $host` dan `X-Forwarded-Proto https`.
