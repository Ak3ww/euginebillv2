# Walkthrough: Kit Standar SPK Auto-Deduct, Unifikasi Stok Float, & 25 Dropcore Rolls

Pembaruan besar ini menyelesaikan masalah operasional di mana SPK teknisi sempat terhambat jika material belum di-input di inventori, unifikasi kolom stok database, otomatisasi pemotongan material consumable standar, pendaftaran 25 roll kabel precon, serta auto-formatting input MAC Address.

---

## 1. Perubahan yang Telah Diterapkan

### A. Realtime MAC Address Auto-Formatter
- **Utility `src/lib/mac-format.ts`**:
  - Otomatis mengubah input ke huruf besar (*uppercase*).
  - Menyisipkan separator titik dua (`:`) setiap 2 karakter heksadesimal (misal: ketik `BD` lalu `CG` otomatis menjadi `BD:CG`).
  - Menangani tombol *backspace* dengan cerdas tanpa tersangkut di tanda titik dua.
- **Implementasi UI**:
  - `src/components/UserDetailModal.tsx` (Modal Edit Pelanggan)
  - `src/app/admin/pppoe/users/new/page.tsx` (Form Pasang Baru PSB)
  - `src/app/admin/inventory/ont/page.tsx` (Manajemen Modem ONT)
  - `src/app/admin/inventory/assets/page.tsx` (Manajemen Unit Aset & Roll Kabel)

### B. Unifikasi Field Stok (`currentStock Float`) & Hapus `stockQuantity`
- **Model `inventoryItem`**: Menghapus field bayangan `stockQuantity`. Menjadikan `currentStock` bertipe `Float @default(0)` sebagai *single source of truth*.
- **Model `inventoryMovement`**: Kolom `quantity`, `previousStock`, `newStock` diubah menjadi `Float`.
- **Dukungan Satuan Kemasan (`packSize Int?`)**: Pada `inventoryItem`, digunakan untuk item kemasan (pack/box). Form mutasi stok kini mendukung konversi otomatis pack ke pcs (`quantity = packCount * packSize`).
- **Label Periode Audit (`periodLabel String?`)**: Pada `inventoryMovement`, mendukung penandaan periode bulanan (format `YYYY-MM`) untuk Stock Opname (`ADJUSTMENT`).
- **Script Migrasi Database**: `prisma/migrations/20260916_unify_inventory_stock_field_and_kits.sql`.

### C. Soft-Limit pada Pemotongan Consumable (Jalur B)
- Pada `src/server/services/inventory-deduct.service.ts`:
  - Jalur B (Consumable & Pasif) menerapkan **Soft-Limit**.
  - Jika stok barang di gudang bernilai 0 atau negatif, sistem **TIDAK melempar exception** atau memblokir penyelesaian SPK teknisi.
  - Sistem mencatat log peringatan (`console.warn`) dan tetap membuat transaksi `inventoryMovement` bertipe `OUT` sehingga stok menjadi negatif secara akurat dan transparan (misal `-6.0 pcs`) untuk ditindaklanjuti saat restock / opname.

### D. Sistem Kit Standar SPK (`workOrderTypeKit`) & Auto-Deduct
- **Model Prisma**: `workOrderTypeKit` dan `workOrderTypeKitItem`.
- **Auto-Deduct Terintegrasi**: Pada `src/app/api/technician/work-orders/[id]/complete/route.ts`, saat teknisi menyelesaikan SPK, sistem otomatis mencari template kit yang sesuai dengan `issueType` SPK (misal `INSTALLATION`), lalu memotong setiap material secara otomatis dengan isolasi `try/catch` per item.
- **API CRUD Kit Lengkap**:
  - `GET /api/inventory/kits`
  - `POST /api/inventory/kits`
  - `GET /api/inventory/kits/[id]`
  - `PUT /api/inventory/kits/[id]`
  - `DELETE /api/inventory/kits/[id]`
  - `POST /api/inventory/kits/[id]/items`
  - `DELETE /api/inventory/kits/[id]/items/[itemId]`
- **Halaman Manajemen Kit Admin (`/admin/inventory/kits`)**:
  - Shadcn UI modern, hairline border, Lucide icons (strictly no text emojis).
  - Ringkasan template kit, daftar material per kit, modal tambah/edit kit, dan modal tambah/edit material.

### E. Master Dropcore & 25 Physical Rolls (Seeding Otomatis)
- **5 Varian Dropcore Precon 1C**:
  - `EMG-CAB-DRP-1C-50M` (50 Meter)
  - `EMG-CAB-DRP-1C-100M` (100 Meter)
  - `EMG-CAB-DRP-1C-150M` (150 Meter)
  - `EMG-CAB-DRP-1C-200M` (200 Meter)
  - `EMG-CAB-DRP-1C-300M` (300 Meter)
- **25 Physical Rolls**: Masing-masing varian memiliki 5 roll fisik (`ROLL-50M-01` s/d `ROLL-300M-05`) dengan status `AVAILABLE`, kondisi `NEW`, menggunakan `upsert` dengan `update: {}` agar sisa meteran operasional teknisi tidak ter-reset.
- **Initial Stock Consumables**: Stok awal otomatis di-seed dengan pencatatan mutasi `IN` (`SEED-INITIAL`) jika belum ada pergerakan sebelumnya.
- **Kit Standar PSB Default**: 6 kabel ties, 1 isolasi hitam, 8 paku klem no. 7, 1 fast connector SC/UPC.

### F. Pembaruan Halaman Mutasi Stok (`/admin/inventory/movements`)
- Standar Shadcn UI bersih dengan kartu ringkasan interaktif.
- Konverter Pack / Pcs jika barang memiliki `packSize > 1`.
- Input & filter `periodLabel` (YYYY-MM) pada mode Stock Opname.

---

## 2. Perbaikan Tagihan PSB & Pengingat WhatsApp (v2.40.7)

### A. Root Cause & Solusi Tagihan Pertama PSB Tidak Terbuat
- **Masalah**: Saat pelanggan baru dibuat di `/admin/pppoe/users/new`, tagihan pertama tidak muncul di daftar tagihan. Saat teknisi klik "Selesai" pada SPK, bot WhatsApp tidak mengirimkan tagihan apa pun.
- **Penyebab**: Kolom `amount` dan `baseAmount` pada skema Prisma bertipe `Int`. Nilai prorata menghasilkan desimal (`Float`) dan `profile.price` berupa objek Prisma `Decimal`. Melewatkan nilai ini ke `prisma.invoice.create` memicu error runtime validasi Prisma `Expected Int, got Decimal/Float` yang tertelan oleh blok `catch (invoiceError)`.
- **Solusi**: Dilakukan pembulatan integer eksplisit `Math.round(Number(invoiceAmount))` pada `amount` dan `baseAmount`. Ditambahkan proteksi fallback saat teknisi menyelesaikan SPK instalasi (`work-orders/[id]/complete`): jika belum ada tagihan `PENDING`, sistem otomatis membuat invoice instalasi baru dan langsung mengirimkannya via WhatsApp.

### B. Prorata pada Generate Tagihan Manual (`/api/invoices/generate`)
- **Masalah**: Saat generate tagihan manual dari `/tagihans` (`/admin/invoices`), pelanggan baru dikenakan tagihan penuh Rp 150.000,- bukan nominal prorata.
- **Penyebab**: Kondisi sebelumnya hanya mendeteksi pelanggan dengan status `PENDING_INSTALLATION`. Begitu teknisi menyelesaikan SPK, status pelanggan berubah menjadi `ACTIVE`, sehingga generate tagihan menganggap pelanggan reguler dan menagih tarif 100%.
- **Solusi**: Diperbarui dengan mengecek `!hasPriorPaidInvoice && (userRegMonth === targetMonth || isPendingInstallation)` untuk pelanggan pascabayar, menghitung nominal prorata akurat berdasarkan sisa hari aktif bulan berjalan, serta memberi jatuh tempo `now + 2 hari`.

### C. Proteksi Pesan Penangguhan Layanan (`/api/invoices/send-reminder`)
- **Masalah**: Mengklik ikon bubble WhatsApp pada tagihan berstatus `PENDING` mengirimkan pesan penangguhan/isolir ("⚠️ PERINGATAN PENANGGUHAN LAYANAN - Layanan Anda saat ini diisolir/ditangguhkan sementara").
- **Penyebab**: Logika sebelumnya mengevaluasi `isOverdue = invoice.status === 'OVERDUE' || dueDate < now`. Jika jatuh tempo terdaftar sebelum tanggal hari ini, tagihan yang masih `PENDING` dianggap `OVERDUE`.
- **Solusi**: Invoice berstatus `PENDING` tidak boleh memicu pesan penangguhan. Hanya invoice dengan status `OVERDUE` yang mengirim template penangguhan. Invoice `PENDING` selalu mengirim pengingat pembayaran biasa (`invoice-reminder` atau `sendInstallationInvoice`).

---

## 3. Auto-Link Modem Inventori & Auto-Prefill SPK Teknisi (v2.40.8)

### A. Auto-Link & Registrasi Modem ONT saat SPK Selesai (`complete/route.ts`)
- **Masalah**: Pada saat teknisi klik "Selesai" di SPK, detail SN ONT dan MAC disimpan hanya di JSON `workOrder.reportData`. Unit belum dikaitkan ke tabel `inventoryAsset` (`currentCustomerId`) dan belum dicatat ke `customerDeviceHistory`, sehingga card "Perangkat ONT" di halaman pelanggan menampilkan "Tidak ada modem terdaftar di inventori".
- **Solusi**: Handler `complete/route.ts` otomatis mencari unit di `inventoryAsset`. Jika belum ada, katalog default `EMG-CPE-ONT-GENERIC` dan unit baru auto-create (`status = 'IN_USE'`), `currentCustomerId` ditautkan ke pelanggan, `pppoeUser.macAddress` di-update, dan riwayat `INSTALLED` dicatat ke `customerDeviceHistory`.

### B. Self-Healing Riwayat Perangkat Pelanggan (`device-history/route.ts`)
- Jika endpoint `/api/pppoe/users/[id]/device-history` menemukan bahwa modem aktif belum tertaut, sistem secara otomatis membaca data SPK berstatus `COMPLETED` milik pelanggan dan langsung meregister/menautkan modem ke inventori secara instan saat halaman dibuka oleh admin (menyembuhkan data historis seperti pelanggan SUPRIYADI).

### C. Auto-Prefill Form SPK Teknisi (`work-orders/[id]/page.tsx` & API `work-orders/[id]/route.ts`)
- **Data Pelanggan Lengkap**: Endpoint backend menyertakan `latitude`, `longitude`, `odpAssignment`, `macAddress`, dan `inventoryAssets`/`deviceHistories`.
- **Tikor GPS Rumah**: Otomatis terkunci (*locked*) jika sudah diset admin, dengan badge hijau informatif.
- **ODP & Port**: Otomatis terisi dan terpilih di Step 2 jika sudah di-assign admin, dengan badge hijau informatif.
- **SN ONT & MAC & Tipe ONT**: Otomatis terisi di Step 3 jika sudah diset admin.
- **Auto-Formatting MAC**: Input MAC address teknisi menggunakan utility `formatMacAddress` dengan `maxLength={17}` sehingga otomatis kapital dan bertitik dua (`XX:XX:XX:XX:XX:XX`), mencegah salah ketik.

---

## 4. Hasil Verifikasi & Kompilasi

- **TypeScript Typecheck**:
  ```bash
  cmd.exe /c "npx tsc --noEmit"
  # Exit code 0 (0 errors)
  ```

---

## 5. Panduan Eksekusi di Production VPS

Jalankan perintah berikut di VPS (`/var/www/EugineBill-radius`):

```bash
cd /var/www/EugineBill-radius
git pull origin main

# 1. Jalankan migrasi database (jika belum dijalankan saat Addendum 1)
mysql -u euginebill -p euginebill < prisma/migrations/20260916_unify_inventory_stock_field_and_kits.sql
npx prisma generate

# 2. Build aplikasi & restart PM2
npm run build
pm2 restart EugineBill-radius

# 3. Seed data dropcore, 25 roll kabel, dan Kit PSB default (1-klik):
curl -X POST http://localhost:3000/api/admin/inventory/seed-defaults
```

