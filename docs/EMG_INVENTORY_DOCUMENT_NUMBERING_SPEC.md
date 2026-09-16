# Spesifikasi & Perintah Build — Inventori, Penomoran Dokumen, dan Document Maker (EugineBill)

## 📌 Perintah untuk Gemini (baca dulu sebelum coding)

Tolong implementasikan spek ini secara utuh ke aplikasi billing **EugineBill**. Saat ini di EugineBill baru ada fitur `invoice-manual` untuk dokumen. Tugasnya:

1. Terapkan skema database di Bagian 1–5 (inventori + penomoran dokumen).
2. **Bangun modul baru: Document Maker** (Bagian 8) — generalisasi dari `invoice-manual` yang sudah ada menjadi generator dokumen universal untuk semua jenis dokumen perusahaan (MOU, Surat Jalan, BAST, SPK, Kwitansi, Invoice), bukan cuma invoice.
3. `invoice-manual` yang sudah ada **jangan dihapus/dirombak total** — migrasikan jadi salah satu kategori (`FAK`) di dalam Document Maker, supaya nomor invoice ke depan konsisten pakai sistem penomoran token yang baru, tanpa mengubah data invoice lama yang sudah ada.
4. Ikuti urutan fase implementasi di Bagian 9 — jangan loncat fase, karena Document Maker (fase D) bergantung pada skema penomoran (fase B) sudah jalan duluan.
5. Kalau ada bagian yang ambigu atau bentrok dengan struktur kode EugineBill yang sudah ada, tanyakan dulu sebelum asumsi sendiri — terutama penamaan model yang mungkin sudah dipakai (`workOrder`, `pppoeUser`, dsbō sesuaikan ke skema yang sudah ada di project, bukan bikin duplikat).

Isi lengkap spek teknis ada di bawah ini.

---

## 1. Standar Kode SKU Inventori

**Format:** `EMG-[KATEGORI]-[SUB-KATEGORI]-[DETAIL/VARIAN]`

Aturan: UPPERCASE, pemisah strip (`-`), maksimal 4 segmen, tanpa spasi.

| Kategori | Sub-Kategori | Contoh SKU |
|---|---|---|
| HW (Hardware Utama) | OLT, ROU, SWI, SRV | `EMG-HW-OLT-VSL-1600GS`, `EMG-HW-ROU-MTK-750GR3` |
| CPE (Customer Equipment) | ONT, STB, RTR | `EMG-CPE-ONT-ZTE-F609V3` |
| PAS (Passive Equipment) | ODP, ODC, SPL, CLS, RST | `EMG-PAS-SPL-1X8-PLC` |
| CAB (Cables) | DRP, PRC, UTP, PWR | `EMG-CAB-PRC-1C-250M` |
| CON (Consumables) | PTC, FOD, TAP, TIE, KLM, PAP, BAT | `EMG-CON-TIE-30CM-BLK` |
| MKT (Marketing) | BRC, STK, BNR | `EMG-MKT-STK-ODP-LOGO` |

**Aturan varian:**
- Barang bermerek → 3 huruf merek + model: `MTK-750GR3`, `ZTE-F609V3`
- Barang generic/pasif → spesifikasi langsung, tanpa merek: `16P`, `60MM`, `30CM`

**Catatan khusus modem/ONT:** SKU di atas adalah SKU *tipe/katalog*. Unit fisik individual dilacak pakai Serial Number bawaan pabrik (`ZTEGD089D75F`) dan MAC address — bukan bikin kode stiker baru.

---

## 2. Prinsip Arsitektur: Dua Jenis Barang

Ini titik paling penting yang membedakan spek ini dari draft sebelumnya. **Jangan** perlakukan semua barang sebagai unit individual (asset) — itu tidak scalable untuk barang habis pakai bervolume tinggi.

| Jenis | Kategori SKU | Cara lacak | Contoh |
|---|---|---|---|
| **Serialized** (per-unit) | HW, CPE, PAS bermerek, CAB (roll) | 1 baris DB = 1 unit fisik, punya SN/kode roll sendiri | Router, ONT, roll kabel Precon 250m |
| **Quantity-based** (stok angka) | CON generic, MKT | 1 baris DB = 1 jenis barang, hanya punya angka stok | Kabel tis, isolasi, paku klem, brosur |

Kabel adalah kasus khusus dalam kategori CAB: **serialized per roll**, karena tiap roll punya sisa panjang berbeda-beda (kasus 10 kabel 250m yang sudah dibahas) — bukan quantity-based biasa.

---

## 3. Skema Database (Prisma)

```prisma
enum AssetType {
  MODEM
  CABLE_ROLL
  ROUTER
  OTHER
}

enum AssetStatus {
  AVAILABLE
  RESERVED
  IN_USE
  DEFECTIVE
  USED_GOOD
  DEPLETED       // khusus roll kabel yang sisanya habis/tak ekonomis
}

enum AssetCondition {
  NEW
  USED_GOOD
  DEFECTIVE
}

model inventoryItem {
  id             String   @id @default(cuid())
  sku            String   @unique          // EMG-CAB-PRC-1C-250M
  name           String
  category       String                    // HW, CPE, PAS, CAB, CON, MKT
  subCategory    String
  unit           String   @default("pcs")  // pcs, meter, roll, dll

  isSerialized   Boolean  @default(true)   // FALSE = quantity-based (consumable generic)
  stockQuantity  Float?                    // dipakai HANYA kalau isSerialized = false

  assets         inventoryAsset[]          // dipakai HANYA kalau isSerialized = true
  workOrderUsages workOrderMaterial[]

  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  @@index([category])
  @@index([isSerialized])
  @@map("inventory_items")
}

model inventoryAsset {
  id                 String          @id @default(cuid())
  itemId             String
  assetType          AssetType       @default(MODEM)

  serialNumber       String          @unique  // SN pabrik ATAU kode roll (ROLL-001)
  macAddress         String?
  vendor             String?
  model              String?

  // Khusus CABLE_ROLL
  initialLength      Float?
  remainingLength    Float?

  condition          AssetCondition  @default(NEW)
  status             AssetStatus     @default(AVAILABLE)

  currentCustomerId  String?
  currentWorkOrderId String?
  location           String?
  notes              String?         @db.Text

  version            Int             @default(0)  // optimistic locking, WAJIB dicek saat deduct

  installedAt        DateTime?
  createdAt          DateTime        @default(now())
  updatedAt          DateTime        @updatedAt

  item               inventoryItem   @relation(fields: [itemId], references: [id], onDelete: Cascade)
  customer           pppoeUser?      @relation(fields: [currentCustomerId], references: [id], onDelete: SetNull)
  workOrder          workOrder?      @relation(fields: [currentWorkOrderId], references: [id], onDelete: SetNull)
  deviceHistories    customerDeviceHistory[]

  @@index([itemId])
  @@index([assetType])
  @@index([status])
  @@index([serialNumber])
  @@index([currentCustomerId])
  @@map("inventory_assets")
}

model customerDeviceHistory {
  id             String          @id @default(cuid())
  customerId     String
  assetId        String?
  serialNumber   String
  macAddress     String?
  vendor         String?
  model          String?
  action         String          // INSTALLED, REPLACED_OLD, REPLACED_NEW, DISMANTLED
  reason         String?
  workOrderId    String?
  technicianName String?
  installedAt    DateTime        @default(now())
  removedAt      DateTime?
  createdAt      DateTime        @default(now())

  customer       pppoeUser       @relation(fields: [customerId], references: [id], onDelete: Cascade)
  asset          inventoryAsset? @relation(fields: [assetId], references: [id], onDelete: SetNull)
  @@index([customerId])
  @@index([serialNumber])
  @@map("customer_device_histories")
}

model workOrderMaterial {
  id                String          @id @default(cuid())
  workOrderId       String
  itemId            String

  // Jalur A: barang serialized (roll kabel, modem tertentu)
  assetId           String?

  // Jalur B: barang quantity-based (consumable generic)
  quantityRequested Float           @default(1)
  quantityUsed      Float           @default(0)   // untuk roll: dwRoll (meter terpakai); untuk consumable: qty terpakai
  unit              String          @default("pcs")

  isDeducted        Boolean         @default(false)
  deductedAt        DateTime?

  workOrder         workOrder       @relation(fields: [workOrderId], references: [id], onDelete: Cascade)
  item              inventoryItem   @relation(fields: [itemId], references: [id], onDelete: Cascade)
  asset             inventoryAsset? @relation(fields: [assetId], references: [id], onDelete: SetNull)

  @@index([workOrderId])
  @@index([itemId])
  @@map("work_order_materials")
}
```

---

## 4. Logika Auto-Deduct (Integrasi Work Order ↔ Billing)

Fungsi ini dipanggil saat SPK/Work Order berstatus **COMPLETED** — bukan saat draft/preview.

```
function deductMaterial(workOrderMaterial):

  item = getInventoryItem(workOrderMaterial.itemId)

  IF item.isSerialized == true:
      // Jalur A — misal roll kabel
      asset = getInventoryAsset(workOrderMaterial.assetId)

      TRANSACTION (dengan row lock / optimistic locking via `version`):
          IF asset.assetType == CABLE_ROLL:
              newRemaining = asset.remainingLength - workOrderMaterial.quantityUsed
              IF newRemaining < 0:
                  THROW error "Sisa roll tidak cukup"
              asset.remainingLength = newRemaining
              asset.status = (newRemaining <= 10) ? DEPLETED : AVAILABLE
          ELSE:
              // modem/router individual → cukup pindah status, bukan kurangi kuantitas
              asset.status = IN_USE
              asset.currentCustomerId = workOrder.customerId
          asset.version += 1
          SAVE asset

          LOG audit_trail (siapa, kapan, berapa, WO mana)

  ELSE:
      // Jalur B — consumable generic (TIE, TAP, KLM, dst)
      TRANSACTION:
          IF item.stockQuantity < workOrderMaterial.quantityUsed:
              THROW error "Stok tidak cukup"
          item.stockQuantity -= workOrderMaterial.quantityUsed
          SAVE item

  workOrderMaterial.isDeducted = true
  workOrderMaterial.deductedAt = now()
  SAVE workOrderMaterial
```

**Poin kritis untuk integrasi ke billing ISP:**
- Deduct **hanya sekali** — cek `isDeducted` sebelum eksekusi supaya webhook/retry dari sistem billing tidak memotong stok dobel.
- Bungkus dalam DB transaction dengan row lock (`SELECT ... FOR UPDATE`) atau optimistic locking (`version`) — penting karena beberapa teknisi/SPK bisa jalan bersamaan.
- Simpan snapshot `quantityUsed` di `workOrderMaterial`, jangan hanya di log — supaya bisa di-reverse kalau SPK dibatalkan setelah completed.

---

## 5. Sistem Penomoran Dokumen (Token-Based)

Menggantikan pola lama `EMG/004/KPMR 01/14/01/2026` yang statis dan ambigu.

### 5.1 Format Token

`{PREFIX}/{DEPT}/{ROMAN_MM}/{YYYY}/{SEQ:n}`

| Token | Isi |
|---|---|
| `{PREFIX}` | Kode jenis dokumen (MOU, FAK, KWT, SJ, BAST, SPK) |
| `{DEPT}` | Kode wilayah/divisi (RW01, RW14, RW15, RW16, RW06, RW07, HO, LOG, BILL) |
| `{YYYY}` / `{YY}` | Tahun |
| `{MM}` / `{ROMAN_MM}` | Bulan angka / romawi |
| `{SEQ:n}` | Nomor urut n-digit, di-generate saat disimpan (bukan saat preview) |

### 5.2 Pola per Kategori

| Kategori | Pola | Contoh | Reset |
|---|---|---|---|
| MOU | `MOU/{DEPT}/{ROMAN_MM}/{YYYY}/{SEQ:3}` | MOU/RW16/I/2026/001 | Per tahun |
| Invoice | `FAK/{DEPT}/{YYYY}{MM}/{SEQ:4}` | FAK/BILL/202609/0001 | Per bulan |
| Kwitansi | `KWT/{YYYY}{MM}/{SEQ:4}` | KWT/202609/0001 | Per bulan |
| Surat Jalan | `SJ/LOG/{ROMAN_MM}/{YYYY}/{SEQ:4}` | SJ/LOG/IX/2026/0001 | Per tahun |
| BAST | `BAST/{DEPT}/{YYYY}/{SEQ:3}` | BAST/RW14/2026/001 | Per tahun |
| SPK | `SPK/{YYYY}/{SEQ:4}` | SPK/2026/0001 | Tanpa reset |

### 5.3 Skema Database

```prisma
model numberingRule {
  id               String   @id @default(cuid())
  category         String   @unique       // MOU, FAK, KWT, SJ, BAST, SPK
  pattern          String                 // "MOU/{DEPT}/{ROMAN_MM}/{YYYY}/{SEQ:3}"
  resetFrequency   String   @default("none") // "none" | "monthly" | "yearly"
  lastResetPeriod  String?                // "2026" atau "202609", dicek tiap generate
  currentSeq       Int      @default(0)
  updatedAt        DateTime @updatedAt
  @@map("numbering_rules")
}

model issuedNumber {
  id               String   @id @default(cuid())
  category         String
  generatedNumber  String   @unique
  dept             String?
  issuedAt         DateTime @default(now())
  referenceId      String?               // link ke dokumen asli (MOU id, invoice id, dst)
  @@index([category])
  @@map("issued_numbers")
}
```

### 5.4 Aturan Konsumsi Nomor
- Nomor **dipreview** (dihitung tapi tidak disimpan/di-increment) selama dokumen masih draft/form terbuka.
- Nomor **dikonsumsi** (di-increment & dicatat ke `issuedNumber`) hanya saat dokumen disimpan final.
- Duplikat dokumen (misal invoice bulanan berulang) selalu dapat nomor baru — tidak pernah salin nomor lama.
- Cek `lastResetPeriod` tiap kali generate: kalau periode sekarang beda dari yang tersimpan (bulan/tahun baru), `currentSeq` direset ke 0 dulu sebelum increment.

### 5.5 Nomor Lama (Legacy)
`EMG/004/KPMR 01/14/01/2026` — dicatat sebagai legacy, tidak dikonversi paksa ke pola baru. Nomor MOU berikutnya mulai pakai pola token di atas.

---

## 7. Document Maker — Generator Dokumen Universal

Modul baru yang menggantikan peran `invoice-manual` menjadi generator dokumen untuk **semua** jenis dokumen perusahaan (MOU, Surat Jalan, BAST, SPK, Kwitansi, Invoice), berbasis template + placeholder, terhubung ke sistem penomoran di Bagian 5.

### 7.1 Konsep

- Admin membuat **template** per kategori dokumen (misal "Template MOU Pemasangan CCTV+WiFi RW") berisi teks dengan placeholder, contoh: `{{nama_pihak_pertama}}`, `{{jabatan_pihak_pertama}}`, `{{alamat_pihak_kedua}}`, `{{nomor_dokumen}}`, `{{tanggal}}`.
- Tiap template punya **skema field** (`fieldsSchema`) yang mendefinisikan input apa saja yang harus diisi user — dipakai untuk auto-generate form di UI (tidak perlu hardcode form per jenis dokumen).
- Alur pembuatan dokumen: pilih kategori → pilih template → isi form sesuai `fieldsSchema` → **Preview** (nomor dokumen di-preview, belum dikonsumsi, render HTML) → **Simpan/Terbitkan** (konsumsi nomor dari `numberingRule`, render final jadi PDF, simpan record `generatedDocument` dengan status `ISSUED`).
- Dokumen yang sudah `ISSUED` bisa diunduh ulang PDF-nya kapan saja, tidak bisa diedit isinya (kalau salah, buat dokumen baru / status `VOID` untuk yang lama, jangan overwrite record yang sudah terbit).

### 7.2 Skema Database

```prisma
model documentTemplate {
  id            String   @id @default(cuid())
  category      String                     // MOU, SJ, BAST, SPK, KWT, FAK
  name          String                     // "Template MOU Pemasangan RW"
  bodyHtml      String   @db.Text          // isi dokumen dengan placeholder {{field_key}}
  fieldsSchema  Json                       // [{ key: "nama_pihak_pertama", label: "Nama Pihak Pertama", type: "text" }, ...]
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  documents     generatedDocument[]
  @@index([category])
  @@map("document_templates")
}

model generatedDocument {
  id             String    @id @default(cuid())
  templateId     String
  category       String
  documentNumber String?   @unique          // null selama draft, terisi saat ISSUED
  status         String    @default("DRAFT") // DRAFT | ISSUED | VOID
  dataJson       Json                        // nilai tiap field yang diisi user, sesuai fieldsSchema
  pdfPath        String?                     // lokasi file PDF hasil render, terisi saat ISSUED
  relatedEntity  String?                     // opsional: customerId / workOrderId / kode RW terkait
  createdBy      String?
  issuedAt       DateTime?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  template       documentTemplate @relation(fields: [templateId], references: [id])
  @@index([category])
  @@index([status])
  @@map("generated_documents")
}
```

### 7.3 API

| Endpoint | Fungsi |
|---|---|
| `GET /api/documents/templates?category=MOU` | List template aktif per kategori |
| `POST /api/documents/templates` | Admin buat/edit template (bodyHtml + fieldsSchema) |
| `POST /api/documents/generate/preview` | Input `{templateId, dataJson}` → render HTML + panggil `numbering/preview` (read-only) → return HTML preview + nomor pratinjau |
| `POST /api/documents/generate/issue` | Input sama seperti preview → konsumsi nomor lewat `numbering/issue`, render PDF final (mis. via Puppeteer: render `bodyHtml` yang sudah disubstitusi jadi HTML lengkap → screenshot ke PDF), simpan `generatedDocument` status `ISSUED`, simpan file ke storage, return link PDF |
| `GET /api/documents/:id/pdf` | Download ulang PDF dokumen yang sudah terbit |
| `POST /api/documents/:id/void` | Tandai dokumen `VOID` (nomor tetap tercatat di `issuedNumber`, tidak dipakai ulang) |

### 7.4 Migrasi `invoice-manual` ke Document Maker

- Buat satu `documentTemplate` default berkategori `FAK` yang isinya menyerupai layout invoice-manual yang sudah ada saat ini.
- Endpoint lama `invoice-manual` tetap boleh jalan untuk kompatibilitas, tapi diarahkan supaya nomor invoice barunya diambil dari `numberingRule` kategori `FAK` yang sama dengan Document Maker — supaya tidak ada dua sumber nomor invoice yang berjalan sendiri-sendiri dan berpotensi bentrok.
- Invoice yang sudah pernah terbit sebelumnya **tidak perlu dimigrasi ulang** nomornya — biarkan sebagai data historis.

### 7.5 Contoh Isi Template (MOU)

```
No. {{nomor_dokumen}}
Pada hari {{hari}}, {{tanggal}} telah ditanda tangani perjanjian antara:
  Nama Lengkap : {{nama_pihak_pertama}}
  Jabatan      : {{jabatan_pihak_pertama}}
  Alamat       : {{alamat_pihak_pertama}}
...
```
`{{nomor_dokumen}}` otomatis disubstitusi dari hasil `numbering/issue` saat dokumen diterbitkan — user tidak input manual.

---

## 8. Perbedaan Kunci vs Draft Sebelumnya (Gemini Flash 3.8)

| Isu | Draft Lama | Spek Ini |
|---|---|---|
| Consumable generic (tie, tape, dll) | Dipaksa jadi `inventoryAsset` per unit | Pakai `stockQuantity` di `inventoryItem`, tidak bikin baris per pcs |
| Concurrency saat potong roll | Tidak ada locking | `version` field (optimistic locking) wajib dicek saat deduct |
| Nomor dokumen | Statis `EMG/[SEQ]/[DEPT]/DD/MM/YYYY`, tanggal redundan | Token-based, per-kategori pola & reset frequency sendiri, ada tabel `numberingRule` + `issuedNumber` |
| Preview vs konsumsi nomor | Tidak dibedakan eksplisit | Eksplisit dipisah — preview read-only, issue baru increment |
| Pembuatan dokumen (MOU, SJ, BAST, dsb) | Belum ada, cuma invoice-manual | Modul Document Maker: template + placeholder + auto-numbering, generalisasi dari invoice-manual |

---

## 9. Fase Implementasi (Urutan Wajib)

1. **Fase A — Skema & Migrasi Inti**: terapkan `inventoryItem`, `inventoryAsset`, `customerDeviceHistory`, `workOrderMaterial`, jalankan `npx prisma generate`.
2. **Fase B — Sistem Penomoran**: terapkan `numberingRule`, `issuedNumber`; buat endpoint `numbering/preview` & `numbering/issue`. Ini prasyarat Fase D.
3. **Fase C — Seed Data Master & Inventori**: daftarkan SKU sesuai Bagian 1, tandai `isSerialized` per kategori, import 340 unit ONT ke `inventoryAsset`. Bangun endpoint CRUD `/api/inventory/*` + auto-deduct (Bagian 4).
4. **Fase D — Document Maker**: terapkan `documentTemplate`, `generatedDocument`; bangun endpoint di Bagian 7.3; migrasikan `invoice-manual` sesuai Bagian 7.4; buat minimal 1 template awal per kategori (MOU, SJ, BAST, SPK, KWT, FAK).
5. **Fase E — Integrasi Wizard SPK & Ganti Modem**: Step 1/3 wizard SPK terhubung ke `inventoryAsset`; SPK `REPLACE_MODEM` terhubung ke `customerDeviceHistory`.
6. **Fase F — Validasi & Dokumentasi**: `npx tsc --noEmit`; tulis `docs/inventory/INVENTORY_AND_SKU_STANDARDS.md`, `docs/DOCUMENT_NUMBERING_STANDARD.md`, `docs/DOCUMENT_MAKER_GUIDE.md`; update `CHANGELOG.md`.
