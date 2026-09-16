# Sistem Penomoran Dokumen — EugineBill

## 1. Konsep Utama

Setiap dokumen resmi perusahaan memiliki **nomor unik** yang di-generate secara terpusat oleh `document-numbering.service.ts`.

**Prinsip:**
- `previewNextNumber` → hanya membaca, **tidak mengkonsumsi** nomor
- `issueNextNumber` → mengkonsumsi nomor dalam `$transaction`, increment `currentSeq`, catat ke `issuedNumber`
- Nomor yang sudah terbit **tidak bisa dibatalkan** (hanya bisa di-VOID sebagai log, nomor tidak dipakai ulang)

---

## 2. Format Nomor

Pola default: `{PREFIX}/{DEPT}/{COUNTER}/{BULAN}/{TAHUN}`

| Variabel | Token | Contoh |
|----------|-------|--------|
| Prefix dokumen | `{PREFIX}` | `MOU`, `FAK`, `KWT`, `SJ`, `BAST`, `SPK` |
| Kode Wilayah/Divisi | `{DEPT}` | `RW01`, `HO`, `BILL`, `LOG` |
| Nomor urut (padded) | `{COUNTER}` | `001`, `002`, ... |
| Bulan (2 digit) | `{BULAN}` | `09` |
| Tahun (4 digit) | `{TAHUN}` | `2026` |

### Contoh Nomor

```
MOU/RW01/001/09/2026   — MOU untuk RW01, nomor 1 di Sep 2026
FAK/BILL/015/09/2026   — Invoice nomor 15 oleh divisi Billing
SJ/LOG/003/09/2026     — Surat Jalan oleh Logistik, nomor 3
SPK/RW14/001/09/2026   — SPK untuk area RW14
```

---

## 3. Kategori Dokumen

| Kode | Nama | Keterangan |
|------|------|-----------|
| `MOU` | Memorandum of Understanding | Perjanjian dengan pelanggan/mitra |
| `FAK` | Faktur / Invoice | Tagihan resmi (integrasi manual-invoice) |
| `KWT` | Kwitansi | Bukti penerimaan pembayaran |
| `SJ` | Surat Jalan | Pengiriman aset/barang |
| `BAST` | Berita Acara Serah Terima | Serah terima aset atau layanan |
| `SPK` | Surat Perintah Kerja | Work order resmi |

---

## 4. Kode Departemen (DEPT)

| Kode | Wilayah / Divisi |
|------|-----------------|
| `RW01` | Area RW 01 |
| `RW14` | Area RW 14 |
| `RW15` | Area RW 15 |
| `RW16` | Area RW 16 |
| `RW06` | Area RW 06 |
| `RW07` | Area RW 07 |
| `HO` | Head Office |
| `LOG` | Logistik |
| `BILL` | Billing |

---

## 5. Reset Period

Setiap kategori memiliki `resetPeriod`:

| Reset | Keterangan |
|-------|-----------|
| `MONTHLY` | Nomor urut reset tiap awal bulan |
| `YEARLY` | Nomor urut reset tiap awal tahun |
| `NEVER` | Nomor urut tidak pernah reset (running) |

Logika reset ada di `formatPatternTokens()` — membandingkan `lastResetPeriod` dengan kunci periode saat ini (`YYYY-MM` atau `YYYY`).

---

## 6. Skema Database

### `numberingRule`

```prisma
model numberingRule {
  id             String    @id
  category       String    @unique   // 'MOU', 'FAK', etc.
  pattern        String              // '{PREFIX}/{DEPT}/{COUNTER}/{BULAN}/{TAHUN}'
  prefix         String              // 'MOU', 'FAK', etc.
  currentSeq     Int       @default(0)
  paddingLength  Int       @default(3)
  resetPeriod    String    @default("MONTHLY")
  lastResetPeriod String?
  isActive       Boolean   @default(true)
}
```

### `issuedNumber`

```prisma
model issuedNumber {
  id             String    @id
  category       String
  issuedNumber   String    @unique  // Nomor yang terbit
  dept           String?
  seq            Int
  period         String?             // '2026-09'
  relatedEntity  String?
  createdAt      DateTime
}
```

---

## 7. Service API — `document-numbering.service.ts`

```typescript
// Preview (tidak konsumsi nomor)
const { previewNumber } = await previewNextNumber({ category: 'FAK', dept: 'BILL' });

// Terbitkan (konsumsi nomor — harus di dalam fitur penting)
const { issuedNumber, rule } = await issueNextNumber({ category: 'FAK', dept: 'BILL' });

// Update aturan penomoran
await updateNumberingRule('FAK', { currentSeq: 0, lastResetPeriod: null });
```

---

## 8. REST API Endpoints

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| `POST` | `/api/documents/numbering/preview` | Preview nomor berikutnya |
| `POST` | `/api/documents/numbering/issue` | Terbitkan nomor (consume) |
| `GET` | `/api/documents/numbering/rules` | Daftar semua aturan |
| `PUT` | `/api/documents/numbering/rules` | Update aturan (reset seq, dll) |

---

## 9. Document Maker — Admin UI (`/admin/documents`)

### Tab 1: Dokumen Terbit
- Tabel semua `generatedDocument` (nomor, kategori, template, status, tanggal terbit)
- Filter: kategori, status (ISSUED/DRAFT/VOID), search nomor
- Aksi VOID (dengan alasan wajib)

### Tab 2: Buat Dokumen (Wizard 5 langkah)
1. Pilih kategori (MOU/FAK/KWT/SJ/BAST/SPK)
2. Pilih template
3. Isi form (field dari `fieldsSchema` template)
4. Preview (call `/api/documents/generate/preview`, tampilkan HTML + preview nomor)
5. Konfirmasi terbit (call `/api/documents/generate/issue`, nomor resmi dikonsumsi)

### Tab 3: Kelola Template
- CRUD template: nama, kategori, `bodyHtml`, `fieldsSchema` (JSON array)
- Placeholder: `{{nama_field}}` di `bodyHtml`
- `{{nomor_dokumen}}` diisi otomatis oleh sistem

### Template `fieldsSchema` Format

```json
[
  { "key": "nama_pelanggan", "label": "Nama Pelanggan", "type": "text", "required": true },
  { "key": "alamat", "label": "Alamat", "type": "textarea" },
  { "key": "tanggal", "label": "Tanggal", "type": "date", "required": true }
]
```

---

## 10. Integrasi Invoice Manual

File: `src/app/api/manual-invoices/route.ts`

Invoice manual (FAK) sudah terintegrasi dengan sistem penomoran terpusat:

```typescript
try {
  const { issuedNumber } = await issueNextNumber({ category: 'FAK', dept: 'BILL' });
  invoiceNumber = issuedNumber;
} catch (numErr) {
  // Fallback ke generator legacy jika numbering service belum di-seed
  invoiceNumber = generateManualInvoiceNumber();
}
```

> **Penting**: Jalankan `/api/admin/inventory/seed-defaults` sekali di VPS untuk menyeed `numberingRule` default agar integrasi berjalan optimal.

---

## 11. Seed Default

Endpoint: `POST /api/admin/inventory/seed-defaults`

Men-seed:
1. 6 aturan penomoran (MOU, FAK, KWT, SJ, BAST, SPK)
2. Full SKU catalog inventori

Gunakan tombol **Seed Default Data** di halaman admin atau panggil endpoint langsung.
