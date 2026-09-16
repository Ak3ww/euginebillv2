# Panduan Teknis: Kit Standar SPK, Unifikasi Stok, dan Master Dropcore (Addendum EugineBill)

## 1. Latar Belakang & Masalah (Issue & Background)

Sebelum pembaruan ini, terdapat beberapa inkonsistensi arsitektural dan operasional dalam modul inventori dan teknisi EugineBill:
1. **Shadow Field Stok Ganda**: Model `inventoryItem` memiliki dua kolom stok yaitu `stockQuantity` (Int) dan `currentStock` (Int). Beberapa service membaca `stockQuantity`, sedangkan mutasi mencatat `currentStock`, menyebabkan ketidakselarasan data stok aktual.
2. **Hard Blocking pada Material Consumable (Jalur B)**: Di lapangan, material kecil seperti paku klem, isolasi, kabel ties, atau fast connector sering kali dipakai teknisi sebelum admin gudang sempat melakukan input mutasi barang masuk (*restock*). Jika sistem memberlakukan *hard blocking* (melempar error jika stok 0), teknisi tidak dapat menyelesaikan SPK di portal lapangan, menghambat operasional aktivasi pelanggan baru.
3. **Belum Ada Template Kit Standar per Jenis SPK**: Setiap penyelesaian SPK pasang baru (PSB) memerlukan material standar yang sama (kabel ties, isolasi, klem, fast connector), namun sebelumnya teknisi atau admin harus menginput material satu per satu secara manual.
4. **Ketiadaan Master Dropcore & Roll Fisik Terdaftar**: Dropcore precon 1 core memiliki berbagai varian panjang (50m s/d 300m) yang belum terdaftar di gudang secara rapi sebagai master item dan roll fisik bernomor seri/kode unik.
5. **Kemasan Pack vs Eceran (Pcs)**: Barang seperti paku klem (kotak isi 100) atau kabel ties (bungkus isi 100) dibeli per *pack*, tetapi digunakan teknisi per *pcs*. Belum ada mekanisme konversi otomatis di pencatatan mutasi stok.
6. **Stock Opname Bulanan Tanpa Label Periode**: Penyesuaian stok (*adjustment*) belum memiliki tanda pengenal periode audit bulanan (`periodLabel`), menyulitkan rekonsiliasi audit berkala.
7. **Input MAC Address Manual**: Input MAC address modem ONT belum otomatis memformat huruf besar (*uppercase*) dan titik dua (`:`), memperlambat pendaftaran pelanggan dan teknisi.

---

## 2. Solusi Arsitektural & Perubahan Teknis

### A. Unifikasi Stok & Tipe Data Float
- **Hapus `stockQuantity`**: Menghapus field bayangan `stockQuantity` dari model `inventoryItem`.
- **Ubah `currentStock` Menjadi `Float`**: Tipe data `currentStock` di `inventoryItem` dan `quantity`, `previousStock`, `newStock` di `inventoryMovement` diubah menjadi `Float` `@default(0)`. Hal ini memungkinkan pencatatan material dengan nilai desimal (misal kabel, cairan pembersih, dsb).
- **Relasi Database Konsisten**: Semua modul membaca dan menulis secara eksklusif ke kolom `currentStock`.

### B. Soft-Limit pada Material Consumable (Jalur B)
- Pada `src/server/services/inventory-deduct.service.ts`:
  - Jalur A (Modem/ONT Serialized): Tetap *strict* (memerlukan unit fisik `AVAILABLE` dengan Serial Number valid).
  - Jalur B (Consumable & Pasif): Menerapkan **Soft-Limit**. Jika `item.currentStock < qtyNeeded` (atau bahkan 0 atau minus):
    - Sistem **TIDAK melempar exception** yang memblokir SPK.
    - Sistem mencatat log peringatan (*warning log*) bahwa stok minus/defisit.
    - Tetap membuat transaksi `inventoryMovement` bertipe `OUT` sehingga stok menjadi negatif secara akurat (misal `-6.0 pcs`).
    - Hal ini menjamin SPK teknisi selesai 100%, dan selisih stok dapat disesuaikan kemudian melalui mutasi restock atau stock opname.

### C. Sistem Template Kit Standar SPK (`workOrderTypeKit`)
- Menambahkan model Prisma `workOrderTypeKit` dan `workOrderTypeKitItem`:
  - `workOrderTypeKit`: `id`, `issueType` (e.g. `INSTALLATION`, `REPAIR`), `name`, `isActive`.
  - `workOrderTypeKitItem`: `kitId`, `itemId`, `defaultQty` (Float).
- **Auto-Deduct Terintegrasi**:
  - Saat teknisi menyelesaikan SPK di `/api/technician/work-orders/[id]/complete`:
    1. Sistem memotong roll kabel yang dipilih (Jalur C).
    2. Sistem mengecek apakah ada `workOrderTypeKit` aktif yang cocok dengan `workOrder.issueType`.
    3. Jika ada, sistem melakukan iterasi untuk setiap item dalam kit dan memanggil `deductWorkOrderConsumable(item.id, defaultQty)`.
    4. Setiap item diproses dalam blok `try/catch` terisolasi sehingga kegagalan satu item tidak menggagalkan item lainnya atau proses penutupan SPK.
- **UI Manajemen Kit**: Halaman `/admin/inventory/kits` untuk mengatur template kit dan daftar material per tipe SPK secara visual.

### D. Konversi Kemasan Satuan (`packSize`)
- Field `packSize Int?` ditambahkan pada `inventoryItem`.
- Pada halaman Mutasi Stok (`/admin/inventory/movements`):
  - Jika barang memiliki `packSize > 1` (misal 1 pack = 100 pcs), admin dapat memilih mode input: **Pack** atau **Pcs**.
  - Jika memilih **Pack** dan memasukkan `2`, sistem otomatis menghitung `quantity = 2 * 100 = 200 pcs`, menampilkan kalkulasi real-time yang jelas.

### E. Label Periode Stock Opname (`periodLabel`)
- Kolom opsional `periodLabel String?` (format `"YYYY-MM"`, diindeks) pada `inventoryMovement`.
- Saat admin mencatat mutasi bertipe `ADJUSTMENT`, sistem otomatis menyematkan label bulan berjalan (atau label kustom yang diinput admin), memudahkan filter dan rekonsiliasi audit bulanan.

### F. Auto-Formatting MAC Address (`formatMacAddress`)
- Utility `src/lib/mac-format.ts` memformat input MAC address secara real-time:
  - Otomatis mengubah karakter ke huruf kapital (`BD` -> `BD`).
  - Otomatis menambahkan separator titik dua (`:`) setiap 2 karakter heksadesimal (`BD:CG`).
  - Menangani tombol *backspace* secara mulus tanpa tersangkut pada separator titik dua.
  - Diterapkan pada Form Pelanggan Baru, Edit Pelanggan (Modal), Form ONT, dan Form Aset.

---

## 3. Skema Database & Migrasi SQL

### Skema Prisma (`prisma/schema.prisma`)
```prisma
model inventoryItem {
  id            String   @id @default(uuid())
  sku           String   @unique
  name          String
  // ...
  currentStock  Float    @default(0)
  packSize      Int?     // e.g. 100 for pack of 100 pcs
  // ...
  kits          workOrderTypeKitItem[]
  // ...
}

model inventoryMovement {
  id            String   @id @default(uuid())
  itemId        String
  movementType  String   // 'IN', 'OUT', 'ADJUSTMENT'
  quantity      Float
  previousStock Float
  newStock      Float
  periodLabel   String?  // format "YYYY-MM"
  referenceNo   String?
  notes         String?
  // ...
  @@index([periodLabel])
}

model workOrderTypeKit {
  id        String   @id @default(uuid())
  issueType String   @unique // 'INSTALLATION', 'REPAIR', 'MAINTENANCE', etc.
  name      String   // e.g. "Kit Standar PSB (Instalasi Baru)"
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  items workOrderTypeKitItem[]

  @@map("work_order_type_kits")
}

model workOrderTypeKitItem {
  id         String @id @default(uuid())
  kitId      String
  itemId     String
  defaultQty Float  // e.g. 6.0 cable ties, 1.0 tape, 8.0 clamps

  kit  workOrderTypeKit @relation(fields: [kitId], references: [id], onDelete: Cascade)
  item inventoryItem    @relation(fields: [itemId], references: [id], onDelete: Restrict)

  @@unique([kitId, itemId])
  @@index([kitId])
  @@index([itemId])
  @@map("work_order_type_kit_items")
}
```

### File Migrasi SQL untuk VPS Deployment
Tersedia di `prisma/migrations/20260916_unify_inventory_stock_field_and_kits.sql`.

---

## 4. Master Item Dropcore & 25 Physical Rolls (Data Standar)

### 5 Varian Master Item Dropcore
| SKU | Nama Barang | Satuan | Kategori |
|---|---|---|---|
| `EMG-CAB-DRP-1C-50M` | Dropcore Fiber Optic 1C Precon 50M | roll | CAB / DRP |
| `EMG-CAB-DRP-1C-100M` | Dropcore Fiber Optic 1C Precon 100M | roll | CAB / DRP |
| `EMG-CAB-DRP-1C-150M` | Dropcore Fiber Optic 1C Precon 150M | roll | CAB / DRP |
| `EMG-CAB-DRP-1C-200M` | Dropcore Fiber Optic 1C Precon 200M | roll | CAB / DRP |
| `EMG-CAB-DRP-1C-300M` | Dropcore Fiber Optic 1C Precon 300M | roll | CAB / DRP |

### 25 Physical Rolls
- Setiap varian memiliki 5 roll fisik dengan kode roll berurutan:
  - `ROLL-50M-01` s/d `ROLL-50M-05` (Panjang awal 50m)
  - `ROLL-100M-01` s/d `ROLL-100M-05` (Panjang awal 100m)
  - `ROLL-150M-01` s/d `ROLL-150M-05` (Panjang awal 150m)
  - `ROLL-200M-01` s/d `ROLL-200M-05` (Panjang awal 200m)
  - `ROLL-300M-01` s/d `ROLL-300M-05` (Panjang awal 300m)
- Status default: `AVAILABLE`, kondisi: `NEW`.
- Di-seed dengan `upsert` dan `update: {}` agar sisa meteran roll yang sedang digunakan teknisi tidak ter-reset saat migrasi ulang.

### Template Kit Standar PSB Default
- **Tipe SPK**: `INSTALLATION`
- **Nama Kit**: Kit Standar PSB (Instalasi Baru)
- **Komposisi Material**:
  1. `EMG-CON-TIE-150MM` (Kabel Ties 150mm): **6 pcs**
  2. `EMG-CON-ISO-BLK` (Isolasi Listrik Hitam): **1 roll**
  3. `EMG-PAS-KLM-NO7` (Paku Klem No. 7): **8 pcs**
  4. `EMG-CON-FSC-SC-UPC` (Fast Connector SC/UPC): **1 pcs**

---

## 5. Kontrak API (API Reference)

### 1. `GET /api/inventory/kits`
- Mengambil semua template kit standar beserta item material dan detail stok barang.
- Query params: `?issueType=INSTALLATION` (opsional).

### 2. `POST /api/inventory/kits`
- Membuat atau memperbarui template kit.
- Payload:
  ```json
  {
    "issueType": "INSTALLATION",
    "name": "Kit Standar PSB (Instalasi Baru)",
    "isActive": true
  }
  ```

### 3. `GET /api/inventory/kits/[id]`
- Mengambil detail satu template kit beserta itemnya.

### 4. `PUT /api/inventory/kits/[id]`
- Memperbarui nama, tipe SPK, atau status aktif kit.

### 5. `DELETE /api/inventory/kits/[id]`
- Menghapus template kit (cascade menghapus item relasi di kit tersebut).

### 6. `POST /api/inventory/kits/[id]/items`
- Menambahkan atau memperbarui material dalam kit.
- Payload:
  ```json
  {
    "itemId": "uuid-barang",
    "defaultQty": 6.0
  }
  ```

### 7. `DELETE /api/inventory/kits/[id]/items/[itemId]`
- Menghapus material dari template kit.

### 8. `POST /api/admin/inventory/seed-defaults`
- Menjalankan migrasi data master standar, 25 roll dropcore, stok awal consumable, dan kit standar PSB.
- Aman dijalankan berulang (*idempotent*).

---

## 6. Prosedur Deployment di Production VPS

Langkah-langkah deployment di VPS `/var/www/EugineBill-radius`:

1. **Pull Kode Terbaru**:
   ```bash
   cd /var/www/EugineBill-radius
   git pull origin main
   ```

2. **Jalankan Migrasi Database**:
   ```bash
   # Opsi A: Jalankan script SQL migrasi langsung ke database
   mysql -u euginebill -p euginebill < prisma/migrations/20260916_unify_inventory_stock_field_and_kits.sql

   # Opsi B: Jalankan prisma generate
   npx prisma generate
   ```

3. **Build dan Restart PM2**:
   ```bash
   npm run build
   pm2 restart EugineBill-radius
   ```

4. **Inisialisasi Data Master (1-Klik via API/Dashboard)**:
   - Akses endpoint POST `/api/admin/inventory/seed-defaults` melalui browser/curl atau tombol sinkronisasi di admin portal untuk memastikan 5 master dropcore, 25 physical rolls, dan Kit Standar PSB ter-seed.
