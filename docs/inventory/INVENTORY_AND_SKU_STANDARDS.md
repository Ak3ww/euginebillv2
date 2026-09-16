# Inventori Aset & Standar SKU — Dokumentasi Teknis

## 1. Format SKU

Format: `EMG-[KATEGORI]-[SUB]-[VARIAN]`

| Kode | Kategori | Contoh |
|------|----------|--------|
| `HW` | Hardware Utama | Switch, OLT, Server |
| `CPE` | Customer Premises Equipment | ONT, Modem |
| `CAB` | Kabel & Jaringan | Dropwire, Fiber, UTP |
| `CON` | Konektor & Aksesoris | Fast Connector, SC/APC |
| `PWR` | Power & Adaptor | Adaptor 12V, UPS |
| `TLS` | Alat & Perkakas | Cleaver, OPM, Tang |
| `ACC` | Aksesori & Material Kecil | Klem, S-Hook, Tape |
| `SUP` | Supplies & Kertas | HVS, Brosur, Stempel |

### Sub-Kategori CPE (Modem ONT)

Format: `EMG-CPE-ONT-[VENDOR]-[MODEL]`

| SKU | Vendor | Model | Prefix SN |
|-----|--------|-------|-----------|
| `EMG-CPE-ONT-ZTE-F609V3` | ZTE | F609V3 | `ZTEG` |
| `EMG-CPE-ONT-SKW-542VF` | Skyworth | EG8143X5 / 542VF | `SKYW` |
| `EMG-CPE-ONT-RLT-OEM` | Realtek OEM | Generic | `RTEG` |
| `EMG-CPE-ONT-YHT-100G` | Yihua | 100G | `YHTC` |
| `EMG-CPE-ONT-FBH-HG6243` | FiberHome | HG6243C | `FHTT` |
| `EMG-CPE-ONT-HWA-8245H` | Huawei | HG8245H | `HWTC` |
| `EMG-CPE-ONT-GGL-FD511G` | Gigalight | FD511G | `GGCI`, `GGCL` |
| `EMG-CPE-ONT-VSL-V2801` | VSOL | V2801 | `AZVG` |
| `EMG-CPE-ONT-EFT-OEM` | EFT OEM | Generic | `EFTT` |

### Sub-Kategori Kabel (CABLE_ROLL)

| SKU | Keterangan |
|-----|-----------|
| `EMG-CAB-DW-1C-BLCK` | Kabel Dropwire 1 Core Hitam |
| `EMG-CAB-DW-1C-WHT` | Kabel Dropwire 1 Core Putih |
| `EMG-CAB-FO-1C-BLCK` | Fiber Optic Single Mode 1 Core |
| `EMG-CAB-UTP-CAT5E` | Kabel UTP Cat5e |

---

## 2. Sistem Aset Terserialisasi vs Stok Kuantitas

### A. Aset Terserialisasi (`isSerialized = true`)

Setiap unit memiliki record `inventoryAsset` sendiri dengan:
- `assetType`: `MODEM` atau `CABLE_ROLL`
- `serialNumber`: SN unik (mandatory untuk MODEM)
- `status`: `AVAILABLE` → `IN_USE` → `USED_GOOD` / `DEPLETED`
- `currentCustomerId`: Link ke `pppoeUser` yang sedang memakai
- `version`: Optimistic locking integer

**Alur Hidup MODEM:**
```
Beli → AVAILABLE → (Pasang) → IN_USE → (Cabut/Ganti) → USED_GOOD
```

**Alur Hidup CABLE_ROLL:**
```
Beli (panjang 250m) → AVAILABLE
→ Teknisi pakai 150m → remainingLength = 100m (masih AVAILABLE)
→ Teknisi pakai 90m → remainingLength = 10m → DEPLETED
```

> Deduksi meter: Jika `remainingLength ≤ 10m` setelah deduct, status otomatis `DEPLETED`.

### B. Stok Kuantitas (`isSerialized = false`)

Item seperti konektor, klem, tape → field `stockQuantity` di `inventoryItem`.

Tidak ada record `inventoryAsset` per unit. Deduct langsung via `inventoryItem.stockQuantity`.

---

## 3. Deduct Logic — `inventory-deduct.service.ts`

```typescript
async function deductWorkOrderMaterial(materialId: string) {
  // 1. Ambil workOrderMaterial, cek isDeducted guard
  // 2. Jika aset CABLE_ROLL → kurangi remainingLength, set DEPLETED jika ≤ 10m
  // 3. Jika aset MODEM → tidak deduct meter, hanya update status IN_USE (sudah ditangani saat instalasi)
  // 4. Jika item qty-based → kurangi stockQuantity
  // 5. Update isDeducted = true (idempotency guard)
  // Semua dalam $transaction + optimistic lock (version increment)
}
```

### Optimistic Locking

```typescript
const updated = await prisma.inventoryAsset.updateMany({
  where: { id: assetId, version: currentVersion },
  data: { remainingLength: newLength, version: { increment: 1 } },
});
if (updated.count === 0) throw new Error('Conflict: asset modified by another process');
```

---

## 4. API Endpoints Inventori

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| `GET` | `/api/inventory/assets` | List aset dengan filter (assetType, status, search, page) |
| `POST` | `/api/inventory/assets` | Tambah aset baru (MODEM atau CABLE_ROLL) |
| `GET` | `/api/inventory/assets/:id` | Detail satu aset |
| `PUT` | `/api/inventory/assets/:id` | Update aset (status, vendor, model, dll) |
| `DELETE` | `/api/inventory/assets/:id` | Hapus aset |
| `POST` | `/api/admin/inventory/seed-defaults` | Seed SKU catalog & numbering rules default |

### Query Parameter `/api/inventory/assets`

```
?assetType=MODEM&status=AVAILABLE&search=ZTEG&page=1&limit=20
```

---

## 5. Admin UI — `/admin/inventory/assets`

Halaman full Shadcn UI dengan:
- **Summary cards**: Total aset, Modem tersedia, Kabel tersedia, Sedang dipakai
- **Filter bar**: Tipe aset, status, search SN
- **Tabel**: SN, Tipe, Vendor/Model, Status badge, Sisa Panjang (cable), Pelanggan (modem IN_USE)
- **Modal Tambah Aset**: Mendukung MODEM (input SN, MAC, vendor, model) dan CABLE_ROLL (input SN roll, panjang awal meter, vendor)

---

## 6. Integrasi SPK Wizard

Di wizard teknisi (`/technician/work-orders/[id]/page.tsx`), **Step 2** (ODP & Port):
- Menampilkan dropdown **Roll Kabel** (`availableRolls`) diambil dari `/api/inventory/assets?assetType=CABLE_ROLL&status=AVAILABLE`
- Teknisi pilih roll dan isi **DW Roll (m)** yang dipakai
- Saat submit complete, `selectedRollId` + `dwRoll` dikirim ke `/api/technician/work-orders/:id/complete`
- Backend auto-deduct via `deductWorkOrderMaterial()` — non-fatal jika gagal

---

## 7. Integrasi PSB Baru (`/admin/pppoe/users/new`)

Di Tab 2 (Instalasi):
- Field **Serial Number ONT** dengan autocomplete realtime
- Debounce search ke `/api/inventory/assets?assetType=MODEM&status=AVAILABLE&search=...`
- Saat pilih dari dropdown: auto-fill MAC Address
- Non-blocking: jika SN tidak ada di inventori, tampil peringatan tapi proses tidak diblokir
- `ontSerialNumber` dikirim di payload submit ke `/api/pppoe/users`

---

## 8. Ganti Modem — `/admin/pppoe/users/:id`

Di halaman detail pelanggan, section **Perangkat ONT**:
- Menampilkan modem aktif (`status=IN_USE`, `currentCustomerId=id`)
- Tabel **Riwayat Pergantian** dari `customerDeviceHistory`
- Tombol **Ganti Modem** membuka modal:
  - Input SN modem baru dengan live preview dari inventori
  - Input alasan + nama teknisi (opsional)
  - POST ke `/api/pppoe/users/:id/replace-device`

### Flow Ganti Modem

```
1. Cari modem baru by SN (harus MODEM, status AVAILABLE/USED_GOOD)
2. Cari modem lama (status=IN_USE, currentCustomerId=pelanggan)
3. Update modem lama → USED_GOOD, currentCustomerId=null
4. Log customerDeviceHistory (action=REPLACED_OLD)
5. Update modem baru → IN_USE, currentCustomerId=pelanggan
6. Log customerDeviceHistory (action=REPLACED_NEW)
7. Update pppoeUser.macAddress jika modem baru punya MAC
Semua dalam $transaction
```

---

## 9. Dashboard Kamus SKU Dinamis & Smart Generator (Addendum 3)

### A. Kamus SKU Database-Driven
Kamus SKU tidak lagi hardcoded di kode aplikasi, melainkan tersimpan di tabel database:
- `skuCategoryCode`: 10 kategori induk (`HW`, `CPE`, `PAS`, `CAB`, `CON`, `MKT`, `PWR`, `TLS`, `ACC`, `SUP`).
- `skuSubCategoryCode`: 35+ subkategori baku yang memiliki parameter:
  - `requiresBrand`: Menentukan apakah wajib merek & tipe (cth: ONT, ROUTER) atau spesifikasi varian generic (cth: DROP, FAST).
  - `defaultUnit`: Satuan default otomatis (cth: `unit`, `meter`, `pcs`, `roll`, `box`).
  - `isSerialized`: Menentukan apakah barang wajib dilacak per-unit di modul Unit Aset.

### B. Golden Rule Auto-Generator SKU
API `POST /api/inventory/sku/generate`:
Format baku: `EMG-[KATEGORI]-[SUBKAT]-[MEREK/SPEC]`
- Barang Bermerek: `clean(brand).slice(0, 4) + "-" + clean(model)`
  Contoh: `EMG-CPE-ONT-ZTE-F609V9`, `EMG-HW-ROUT-MIKR-RB750GR3`
- Barang Generic: `clean(spec)`
  Contoh: `EMG-CAB-DROP-1C-1000M`, `EMG-CON-FAST-SCUPC-09`

### C. Alur Wizard Tambah Barang (`/admin/inventory/items`)
1. **Step 0 (Cek Duplikasi)**: Live search mencari kesamaan barang di gudang. Admin bisa langsung memilih *"Gunakan / Tambah Stok"* barang yang sudah ada atau *"Lanjut Buat Master Baru"*.
2. **Step 1–4 (Smart SKU Generator)**: Pilih Kategori Induk → Sub-Kategori → Toggle Bermerek/Generic → Live Monospace SKU Preview.
3. **Override Manual**: Field SKU manual disembunyikan by default dan hanya terbuka jika admin mengklik link collapsible *"Override SKU Manual"*.

---

## 10. Mesin Audit & Rekonsiliasi ONT Pelanggan (`reconcile-customer-ont`)

Untuk mengatasi modem pelanggan yang belum tercatat atau salah tertaut di inventori:
- **Audit Endpoint**: `GET /api/admin/inventory/reconcile-customer-ont`
  Memindai seluruh pelanggan PPPoE aktif dan riwayat SPK teknisi berstatus `COMPLETED`. Menghitung:
  - Pelanggan yang sudah memiliki modem aktif di `inventoryAsset` (`status = IN_USE`).
  - Pelanggan yang belum memiliki catatan unit modem di gudang/aset.
  - Modem yatim (*orphaned in-use*) yang berstatus `IN_USE` tapi pelanggannya telah terhapus atau kosong.
- **Self-Healing & Reseed Endpoint**: `POST /api/admin/inventory/reconcile-customer-ont`
  Secara otomatis:
  1. Menyembuhkan modem yatim (*orphaned in-use modems*).
  2. Mencocokkan data SN & MAC dari SPK teknisi ke unit inventori dan menautkan pelanggan.
  3. Mendaftarkan unit baru ke `inventoryAsset` dengan status `IN_USE` jika modem belum pernah tercatat sebelumnya.
  4. Menyinkronkan riwayat perangkat ke `customerDeviceHistory`.

