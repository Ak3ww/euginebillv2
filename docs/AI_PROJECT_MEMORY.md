# AI PROJECT MEMORY — EugineBill RADIUS

> **Untuk AI/LLM yang melanjutkan pengembangan project ini.**
> Baca file ini terlebih dahulu sebelum mulai membantu agar tidak mengulang hal yang sudah selesai atau membuat kesalahan arsitektural yang sudah diperbaiki.
> File ini WAJIB diperbarui setiap kali ada milestone atau pembaruan di `CHANGELOG.md`.

---

## 📌 Project Overview

**EugineBill Radius** adalah sistem billing & network management ISP/RTRW.NET berbasis web dengan integrasi FreeRADIUS 3.x, MikroTik Local Auth Mode, Built-in WireGuard & L2TP VPN Server, ONT Remote Proxy, Native WhatsApp Baileys Bot, dan Multi-Portal PWA.

- **Version**: 2.40.14
- **Status**: Commercial Turnkey Release (Ready to Rent / Sell as Managed Single-Tenant VPS)
- **Last Updated**: September 17, 2026
- **GitHub**: https://github.com/Ak3ww/euginebillv2 (public)
- **Turnkey 1-Command Installer**: `curl -fsSL https://raw.githubusercontent.com/Ak3ww/euginebillv2/main/scripts/install.sh | sudo bash`

---

## 🧠 Master Patch Log & Hard Architecture Lessons (v2.40.x)

### Recent Patch Log (September 17, 2026 — v2.40.14: Smart Auto-Assign & OLT Manual Assign Overhaul)

- **Architectural Invariant: OLT Smart Auto-Assign Engine (`src/lib/olt/smart-matcher.ts`)**:
  - DILARANG menggunakan pencocokan kaku persis (`description.includes(username)` atau `===`) karena penamaan teknisi di OLT lapangan selalu memiliki variasi karakter pemisah strip (`ARIESTA-MIRANDA`), singkatan nama Indonesia (`M.`/`M ` untuk Muhammad, `ACH.` untuk Achmad), tambahan keterangan area (`RT05`), atau salah ketik ringan.
  - Modul `smart-matcher.ts` wajib menjalankan scoring multitahap:
    1. Pembersihan prefix operator (`PELANGGAN:`, `CUST:`, dll) dan sanitasi spasi.
    2. Pencocokan identik pada serial number, MAC address, atau username PPPoE kompak (skor 100).
    3. Ekspansi singkatan nama Indonesia (skor 95).
    4. Token overlap subset nama (skor 90–92).
    5. Koefisien fuzzy Dice bigram dengan toleransi typo adaptif ($\ge 82\%$, skor 80–89).
    6. Bonus router uplink proximity (+3) jika OLT dan pelanggan berbagi NAS router yang sama.
  - Background poller (`src/lib/olt/poller.ts`) menggunakan ambang batas ketat $\ge 85\%$ untuk auto-linking tanpa intervensi manusia.

- **Architectural Invariant: Status-Free Customer Discovery in OLT Manual Assign (`/api/olt/[id]/onus/[onuId]/assign`)**:
  - DILARANG membatasi pencarian pelanggan OLT dengan klausa `status: active`. Pelanggan yang sedang terisolir (`ISOLIR`) atau offline wajib tetap dapat ditemukan dan ditautkan ke port OLT/ONU.
  - Endpoint assign selalu menyertakan `bestMatch` serta `suggestions` yang diprioritaskan berdasarkan router uplink OLT.

- **Architectural Invariant: Re-evaluation Support in Bulk Smart Auto-Assign (`/api/olt/[id]/auto-assign`)**:
  - Bulk auto-assign wajib mendukung dua cakupan evaluasi: `scope: 'all'` (mengevaluasi seluruh ONU termasuk yang sudah ditautkan untuk audit/re-evaluation) dan `scope: 'unassigned'` (hanya yang belum ditautkan).
  - UI wajib menyediakan pratinjau lengkap metrik, aksi yang disarankan (`ASSIGN`, `CHANGE`, `KEEP`, `NO_MATCH`), serta seleksi checkbox sebelum eksekusi massal.

### Recent Patch Log (September 17, 2026 — v2.40.13: Login 500 Root Cause Resolution & Passwordless DDL Standard)

- **Architectural Invariant: Uniform Dynamic Slug Naming Across Sibling Routes (`src/app/api/...`)**:
  - DILARANG KERAS menggunakan nama dynamic slug yang berbeda pada level direktori yang sama di Next.js App Router (contoh salah: `categories/[id]/route.ts` berdampingan dengan `categories/[code]/subcategories/route.ts`).
  - Next.js akan melempar error fatal pada route tree compiler: `Error: You cannot use different slug names for the same dynamic path ('code' !== 'id')` yang menyebabkan SELURUH request server (halaman login, favicon.ico, API) gagal total dengan respons HTTP 500 mentah.
  - Seluruh parameter dinamis pada level direktori yang sama WAJIB seragam (misal: gunakan `[id]` untuk kedua endpoint: `[id]/route.ts` dan `[id]/subcategories/route.ts`).

- **Architectural Invariant: Passwordless Automated DDL Migrations (`scripts/run-migrations.ts` / `npm run db:migrate:auto`)**:
  - DILARANG KERAS memaksa operator/user mengeksekusi file `.sql` mentah via terminal interaktif (`mysql -u ... -p`) saat build/update VPS karena rentan terhenti oleh prompt password dan membuat schema DB tertinggal di belakang Prisma Client.
  - Seluruh migrasi skema DDL WAJIB diotomatisasi melalui script TypeScript yang memanfaatkan koneksi Prisma eksisting (`DATABASE_URL`).
  - Setiap migrasi DDL WAJIB 100% IDEMPOTENT (menggunakan pengecekan `INFORMATION_SCHEMA.COLUMNS` dan `CREATE TABLE IF NOT EXISTS`) sehingga aman dijalankan kapan saja berulang kali tanpa risiko error.
  - Jalankan satu baris: `npx tsx scripts/run-migrations.ts` (atau `npm run db:migrate:auto`).

- **Architectural Invariant: Zero CLI Seed Imports Inside Next.js App Router Routes (`src/app/api/setup/route.ts`)**:
  - DILARANG KERAS mengimpor script CLI seeder (seperti `prisma/seeds/client-clean-seed.ts`) dari dalam file route handler Next.js (`src/app/api/...`).
  - Script CLI seeder menciptakan instansi `new PrismaClient()` mandiri pada level modul, menarik dependensi eksternal yang tidak diperlukan ke dalam bundle Next.js standalone, dan menyebabkan lonjakan memori serta kebocoran connection pool.
  - Seeding data master katalog tetap dijalankan dari terminal/CLI via `npm run db:seed:clean`.

- **Architectural Invariant: Graceful FreeRADIUS Schema Tolerance in Seeders (`prisma/seeds/seed-all.ts`)**:
  - Eksekusi raw SQL terhadap tabel FreeRADIUS (seperti `radgroupreply`, `radcheck`, `radusergroup`) WAJIB dibungkus blok `try/catch`. Jika deployment klien berada pada mode non-RADIUS atau FreeRADIUS belum terinstal, proses seeding tidak boleh crash.

- **Architectural Invariant: Force-Dynamic & Resilient Auth Routes (`src/app/api/admin/auth/pre-login/route.ts`)**:
  - Endpoint verifikasi login dan autentikasi WAJIB menyertakan `export const dynamic = 'force-dynamic';` untuk mencegah caching dan memastikan evaluasi dinamis pada setiap request.
  - Sisi client UI (`src/app/admin/login/page.tsx`) WAJIB memvalidasi respons non-JSON (HTML/teks 500) secara elegan tanpa memicu sintaks error `Unexpected token 'I'`.

### Recent Patch Log (September 16, 2026 — v2.40.12: Commercial Turnkey Clean Client Seeder & Data Isolation)

- **Architectural Invariant: Zero Physical Data in Clean Client Seeder (`prisma/seeds/client-clean-seed.ts`)**:
  - DILARANG KERAS memasukkan router fisik, IP MikroTik spesifik operator, nama OLT lapangan pribadi, koordinat GPS lokal, atau data pelanggan ke dalam skrip installer umum atau seed default.
  - Modul `seedClientClean()` WAJIB HANYA men-seed data master katalog standar:
    1. Kategori Keuangan (Income/Expense) & Role Templates/Permissions lengkap.
    2. Kamus SKU Dinamis (10 kategori & 35+ subkategori) beserta katalog master ONT 7 vendor & varian kabel dropcore roll.
    3. Document Maker Templates (MOU, Faktur, Kwitansi, SJ, BAST, SPK) & Numbering Rules.
    4. Template WhatsApp & Email notifikasi tagihan/isolir.
  - Setup Wizard (`src/app/api/setup/route.ts`) mengeksekusi `seedClientClean()` secara non-blocking di latar belakang saat akun Super Admin pertama kali dibuat, memastikan klien baru langsung memiliki ekosistem siap pakai tanpa tercemar data pribadi operator.

### Recent Patch Log (September 16, 2026 — v2.40.11: Fase 1 OLT Architecture & Intelligent Customer Auto-Linking)

- **Architectural Invariant: OLT Poller Intelligent Customer Auto-Linking (`src/lib/olt/poller.ts`)**:
  - Saat background poller atau tombol manual "Poll Sekarang" memproses data ONU dari OLT (VSOL, HSGQ, ZTE, Huawei), sistem WAJIB secara cerdas memeriksa apakah ONU tersebut sudah terhubung dengan pelanggan (`oltOnuStatus.customerId`).
  - Jika belum terhubung (`customerId` null), poller otomatis mencocokkan `serialNumber` ONU ke:
    1. Tabel `inventoryAsset` (`serialNumber` cocok dan `currentCustomerId` tidak null).
    2. Tabel `pppoeUser` (`macAddress` cocok dengan serial number atau MAC bersih).
    3. Tabel `pppoeUser` (`username` cocok dengan kolom deskripsi ONU di OLT).
  - Jika ditemukan kecocokan, poller otomatis mengisi `customerId` pada `oltOnuStatus`.
  - Pada query detail pelanggan `getPppoeUserById` (`src/server/services/pppoe.service.ts`), relasi `oltOnuStatuses` disertakan lengkap dengan data OLT (`name`, `ipAddress`, `vendor`) agar profil pelanggan langsung menyajikan data redaman optik live (`rxPower`, `txPower`, `distance`) dan status ONT (Online/Offline/LOS/Dying Gasp).

- **Architectural Invariant: Native SNMP ONU Discovery for HSGQ & VSOL (`hsgq.ts`, `vsol.ts`)**:
  - Poller OLT memprioritaskan SNMP murni tanpa ketergantungan Telnet melalui fungsi `discoverONUsSNMP`.
  - Menggunakan OID vendor terbukti stabil dari `C:\BotRedaman`:
    - HSGQ (SNMPv1): Name `.1.3.6.1.4.1.50224.3.12.2.1.2`, Rx `.3.1.4` (/100), Tx `.3.1.3` (/100), SN `.2.1.15`.
    - VSOL (SNMPv2c): Name `.1.3.6.1.4.1.37950.1.1.6.1.1.1.1.7`, Rx `.3.1.7` (/10), Tx `.3.1.6` (/10), SN `.2.1.5`.
  - Telnet CLI hanya dipakai untuk aksi konfigurasi (reboot ONU/unregister) atau sebagai fallback sekunder.

- **Architectural Invariant: Automated Background OLT Cron Engine (`jobs.config.ts`, `runner.ts`, `cron-service.js`)**:
  - Polling OLT terdaftar di `CRON_JOBS` terpusat sebagai `olt_poll` dengan jadwal default `*/5 * * * *` (setiap 5 menit).
  - Standalone runner PM2 `EugineBill-cron` (`src/cron/runner.ts`) mengeksekusi `pollAllOLTs()` secara native tanpa melalui HTTP layer, mencatat metrik ke `cronHistory` dan mencegah overlapping lewat `LOCK_JOBS`.
  - Sistem juga menyediakan endpoint HTTP trigger `POST /api/cron/olt-poll` dan fallback di `cron-service.js`.

- **Architectural Invariant: Field OLT Automated Seeder & Uplink Binding (`src/app/api/admin/olt/seed/route.ts`, `scripts/seed-olts.ts`)**:
  - 3 OLT lapangan produksi terdaftar dengan uplink router MIKROTIK CIBINONG SITE (`10.200.0.2`):
    1. HSGQ-G02ID Cibinong (`192.168.30.2`, vendor `hsgq`, model `HSGQ-G02ID`, community `public`, port 161).
    2. VSOL-GPON Cibinong (`192.168.30.6`, vendor `vsol`, model `V1600GS`, community `public`, port 161).
    3. VSOL-1600GT Cibinong (`192.168.30.7`, vendor `vsol`, model `V1600GT`, community `public`, port 161).
  - Menyediakan endpoint 1-klik `POST /api/admin/olt/seed` dan tombol "Seed OLT Lapangan" di toolbar UI `/admin/network/olts` serta skrip CLI `scripts/seed-olts.ts`.

### Recent Patch Log (September 16, 2026 — v2.40.10: Dynamic SKU Dictionary, Smart SKU Generator, Redesigned Add Item Wizard, & ONT Reconciliation)

- **Architectural Invariant: Dynamic Database-Driven SKU Dictionary (`skuCategoryCode` & `skuSubCategoryCode`)**:
  - DILARANG menggunakan format SKU hardcoded atau singkatan nama acak (`[PREFIX]-[KAT]-[3HURUF]`).
  - Struktur SKU resmi EMG WAJIB mengikuti standar baku: `EMG-[KAT]-[SUBKAT]-[MEREK/SPEC]`.
  - Tabel `skuCategoryCode` menyimpan 10 kode kategori induk (`HW`, `CPE`, `PAS`, `CAB`, `CON`, `MKT`, `PWR`, `TLS`, `ACC`, `SUP`).
  - Tabel `skuSubCategoryCode` mendefinisikan subkategori spesifik beserta atribut perilaku: `requiresBrand` (apakah wajib merek/model), `defaultUnit` (satuan standar seperti pcs, unit, meter), dan `isSerialized` (apakah wajib dilacak individual di `inventoryAsset`).
  - Seluruh manipulasi kamus SKU dikelola via dashboard admin `/admin/inventory/sku-settings` dan API `/api/admin/sku-settings/...`.

- **Architectural Invariant: Smart SKU Generator (`/api/inventory/sku/generate`)**:
  - Generator SKU pintar merangkai SKU otomatis secara konsisten:
    - Jika `isBranded`: `clean(brand).slice(0, 4) + "-" + clean(model)`.
    - Jika generic: `clean(spec)`.
  - Generator melakukan validasi duplikasi real-time langsung ke tabel `inventoryItem` dan mengembalikan detail barang kembar jika sudah terdaftar.

- **Architectural Invariant: Redesigned Add Item Wizard & Hidden Manual SKU Override (`/admin/inventory/items`)**:
  - **Step 0 Cek Duplikasi**: Wajib menyediakan input pencarian live sebelum form input baru terbuka untuk mencegah admin membuat master barang kembar secara tidak sengaja.
  - **Hidden Manual SKU**: Field input manual SKU WAJIB disembunyikan by default di bawah link collapsible ("Override SKU Manual"). Admin operasional biasa cukup memilih kategori, subkategori, dan mengisi merek/model, sistem yang merangkai SKU secara otomatis.
  - **Clean Shadcn UI & Bebas Emojis**: Tampilan halaman inventori wajib bersih dari efek cyberpunk/neon glow dan bebas text emojis, menggunakan komponen resmi `Lucide React`.

- **Architectural Invariant: Relasi Master Barang (`inventoryItem`) vs Unit Aset (`inventoryAsset`)**:
  - `inventoryItem` merepresentasikan katalog produk (SKU, nama, harga beli, harga jual, total kuantitas stok).
  - `inventoryAsset` merepresentasikan fisik unit individual (Serial Number ONT, MAC Address, atau Roll Kabel dengan meteran tersisa).
  - DILARANG menghapus kategori CPE atau Kabel dari database karena relasi `inventoryAsset` bergantung pada `itemId` di `inventoryItem` (cascade delete).
  - Pada tabel master barang, setiap barang yang berseri (`isSerialized === true` atau kategori `CPE`/`CAB`) WAJIB menampilkan badge link interaktif `[Unit Aset (X) ↗]` yang mengarahkan admin ke `/admin/inventory/assets`.

- **Architectural Invariant: Customer ONT Reconciliation Engine (`/api/admin/inventory/reconcile-customer-ont`)**:
  - Mendeteksi ketidakcocokan antara pelanggan PPPoE aktif (`macAddress` / data SPK teknisi `workOrder`) dengan tabel `inventoryAsset`.
  - Mendukung auto-reconcile & reseed 1-klik untuk mendaftarkan modem pelanggan yang belum tercatat ke `inventoryAsset` dengan status `IN_USE` tertaut ke ID pelanggan, dan menyembuhkan unit in-use yatim (*orphaned modems*).

- **Architectural Invariant: On-the-Fly Master Item Auto-Creation on Custom Asset Input (`/api/inventory/assets`)**:
  - Saat admin atau teknisi memasukkan unit fisik baru dengan vendor/model yang belum ada di katalog (baik melalui input satuan atau bulk input `/api/inventory/assets/bulk`), sistem WAJIB secara otomatis membuat entri master `inventoryItem` baru dengan standar SKU EMG (`EMG-[KAT]-[SUBKAT]-[VENDOR]-[MODEL]`).
  - Hal ini menjamin admin dan teknisi dapat bebas mengetik model perangkat tanpa pernah mengalami error "Master item belum ada".

- **Architectural Invariant: OLT Monitoring as Single Source of Physical Truth vs TR-069 ACS**:
  - OLT (VSOL & HSGQ via Telnet/SSH/SNMP) adalah sumber data fisik paling absolut untuk inventori ONT karena semua modem yang menyala dan tersambung ke fiber optik wajib terdaftar di OLT tanpa memerlukan konfigurasi TR-069 di sisi modem pelanggan.
  - Built-in ACS TR-069 difungsikan sebagai kontrol aplikasi (ganti password Wi-Fi, ubah SSID, remote reboot) dan BUKAN sebagai prasyarat inventori fisik.

### Recent Patch Log (September 16, 2026 — v2.40.9: Strict Dashboard Access Guard `dashboard.view`, Sidebar Guard & Auto-Redirect for Non-Privileged Staff)

- **Architectural Invariant: Strict Dashboard Permission Guard & Auto-Redirection (`src/app/admin/page.tsx`)**:
  - Halaman ringkasan dashboard admin (`/admin`) memuat metrik finansial sensitif (omzet bulan ini, total omzet all-time, breakdown pendapatan, dan status sistem).
  - Halaman `src/app/admin/page.tsx` WAJIB mengintegrasikan `usePermissions()` dan `useSession()`.
  - Jika pengguna tidak memiliki izin `dashboard.view` (dan bukan `SUPER_ADMIN`):
    1. DILARANG KERAS memicu pemanggilan data metrik (`loadDashboardData`, `loadAnalyticsData`, `loadRadiusStatus`, `loadActivityLog`).
    2. Sistem WAJIB secara otomatis mengalihkan pengguna via `router.replace(targetRoute)` ke modul pertama yang diizinkan untuk perannya (misal: `inventory.view` -> `/admin/inventory/items`, `customers.view` -> `/admin/pppoe/users`, `invoices.view` -> `/admin/invoices`, `documents.view` -> `/admin/documents`, dsb).
    3. Selama proses pengalihan atau jika pengguna tidak memiliki izin ke modul manapun, tampilkan kartu "Akses Terbatas" yang informatif dan aman tanpa merender widget finansial.

- **Architectural Invariant: Sidebar Menu Permission Integrity (`src/app/admin/AdminClientLayout.tsx`)**:
  - Menu item `dashboardMenuItem` ("Dashboard") pada sidebar WAJIB dibungkus guard: `((session?.user as any)?.role === 'SUPER_ADMIN' || userPermissions.includes('dashboard.view'))`. Jika izin `dashboard.view` tidak dimiliki user, link dashboard tidak boleh muncul di sidebar.
  - Pemetaan izin menu grup WAJIB akurat sesuai domain fitur:
    - Dokumen (`/admin/documents`): `requiredPermission: 'documents.view'` (BUKAN `dashboard.view`).
    - Notifikasi (`/admin/notifications`): `requiredPermission: 'notifications.view'` (BUKAN `dashboard.view`).
    - Tiket Pengaduan (`/admin/tickets`): `requiredPermission: 'customers.view'` (BUKAN `dashboard.view`).

- **Architectural Invariant: Backend Protection on Dashboard Endpoints (`/api/dashboard/*`)**:
  - Seluruh endpoint API statistik `/api/dashboard/stats`, `/api/dashboard/analytics`, dan `/api/dashboard/traffic` WAJIB menerapkan middleware `requirePermission('dashboard.view')`. Permintaan dari token tanpa izin `dashboard.view` (kecuali `SUPER_ADMIN`) WAJIB ditolak dengan status HTTP 403 Forbidden.

- **Architectural Invariant: Super Admin Invariant in Permission Utilities**:
  - Fungsi `getUserPermissions`, `hasPermission`, `hasAnyPermission`, dan `hasAllPermissions` di `src/server/auth/permissions.ts` serta hook client `usePermissions.ts` WAJIB selalu memberikan izin penuh (`true`) jika `user.role === 'SUPER_ADMIN'`. Hal ini mencegah super admin terkunci jika tabel template role belum disinkronisasi.

### Recent Patch Log (September 16, 2026 — v2.40.8: Auto-Link Modem Inventori saat SPK Selesai, Self-Healing Device History, & Auto-Prefill SPK Teknisi)

- **Architectural Invariant: Automatic Modem Linking & Inventory Auto-Registration on SPK Completion (`complete/route.ts`)**:
  - Saat teknisi menyelesaikan SPK dengan `reportData.sn` dan `reportData.mac`, sistem WAJIB mencari unit di `inventoryAsset`.
  - Jika sudah ada: update `status = 'IN_USE'`, `currentCustomerId = targetUserId`, `macAddress = reportData.mac`.
  - Jika belum ada: auto-create katalog `EMG-CPE-ONT-GENERIC` dan buat `inventoryAsset` baru (`status = 'IN_USE'`, `currentCustomerId = targetUserId`).
  - Sistem WAJIB mencatat riwayat pemasangan ke `customerDeviceHistory` (`action: 'INSTALLED'`) dan meng-update `pppoeUser.macAddress`.
  - Hal ini menjamin bahwa seluruh modem yang dipasang teknisi di lapangan selalu otomatis terdata di modul inventori tanpa ada modem tak bertuan atau missing.

- **Architectural Invariant: Self-Healing Device History (`/api/pppoe/users/[id]/device-history`)**:
  - Jika endpoint riwayat perangkat mendapati pelanggan belum memiliki `currentAsset` yang tertaut di inventori, sistem memeriksa apakah ada SPK berstatus `COMPLETED` dengan data SN modem.
  - Jika ditemukan, sistem melakukan auto-link/auto-create seketika, menyembuhkan data historis secara otomatis saat halaman detail pelanggan dibuka oleh admin.

- **Architectural Invariant: Complete Customer Data Forwarding & Auto-Prefill for Field Technicians**:
  - Endpoint `GET /api/technician/work-orders/[id]` WAJIB menyertakan data lengkap pelanggan: `latitude`, `longitude`, `address`, `macAddress`, `odpAssignment` (nama, port, koordinat ODP), serta `inventoryAssets` dan `deviceHistories`.
  - Portal wizard teknisi (`work-orders/[id]/page.tsx`) WAJIB melakukan auto-prefill dari data admin:
    1. Tikor GPS Rumah terkunci otomatis jika sudah ada di database pelanggan.
    2. ODP & Port terisi dan terpilih otomatis jika sudah di-assign.
    3. SN ONT, MAC Address, dan Tipe ONT terisi otomatis di Step 3.
  - Input MAC Address teknisi WAJIB divalidasi dengan `formatMacAddress` (`maxLength={17}`) untuk mencegah typo format atau segmen 3 digit.

### Recent Patch Log (September 16, 2026 — v2.40.7: Fix First Invoice Auto-Creation, Prorate Calculation on PSB & Manual Generation, and Prevent False Suspension Warnings)

- **Architectural Invariant: Strict Integer Casting for Invoice Amounts (`amount` & `baseAmount`)**:
  - Kolom `amount` dan `baseAmount` pada skema Prisma `model invoice` bertipe `Int` (bukan Decimal atau Float).
  - Setiap perhitungan harga paket, prorata, atau PPN yang menghasilkan nilai desimal WAJIB melewati pembulatan integer eksplisit (`Math.round(Number(val))`) sebelum dipassing ke `prisma.invoice.create` atau `update`.
  - Melewatkan objek `Decimal` dari Prisma atau angka bertipe `Float` menyebabkan error runtime `Expected Int, got Decimal/Float` yang dapat menggagalkan pembuatan tagihan tanpa memunculkan error fatal jika berada dalam blok `catch`.

- **Architectural Invariant: WhatsApp Message Guard — Strict Separation between Overdue/Isolir and Pending Reminders**:
  - Pada pengiriman notifikasi/pengingat tagihan (`/api/invoices/send-reminder`), evaluasi pesan penangguhan/isolir (`invoice-overdue`) HANYA BOLEH dipicu jika status invoice adalah `OVERDUE` (`invoice.status === 'OVERDUE'`).
  - DILARANG KERAS mengevaluasi kondisi `dueDate < now` untuk invoice berstatus `PENDING` sebagai penangguhan. Jika invoice masih `PENDING` (walaupun jatuh tempo masa lampau akibat pembuatan manual), pesan yang terkirim WAJIB berupa template pengingat pembayaran normal (`invoice-reminder` atau `sendInstallationInvoice`).

- **Architectural Invariant: Prorate Resolution for Manual Invoice Generation (`/api/invoices/generate`)**:
  - Saat admin men-generate tagihan secara manual untuk pelanggan baru, deteksi status tidak boleh hanya bergantung pada `user.status === 'PENDING_INSTALLATION'`.
  - Jika teknisi telah menyelesaikan SPK pemasangan, status pelanggan telah beralih menjadi `'ACTIVE'`. Oleh karena itu, deteksi pelanggan baru pascabayar WAJIB memeriksa ketiadaan riwayat tagihan lunas sebelumnya di bulan target (`!hasPriorPaidInvoice && (userRegMonth === targetMonth || isPendingInstallation)`). Jika kondisi terpenuhi, hitung nominal prorata berdasarkan sisa hari aktif bulan berjalan dan beri jatuh tempo di masa depan (`now + 2 hari`).

- **Architectural Invariant: Fallback Installation Invoice on SPK Completion (`complete/route.ts`)**:
  - Saat teknisi menyelesaikan SPK pemasangan (`INSTALLATION`), sistem memverifikasi keberadaan tagihan `PENDING` untuk pelanggan terkait.
  - Jika tagihan belum terbentuk (akibat kegagalan sebelumnya atau flow alternatif), endpoint penyelesaian SPK secara otomatis membuatkan invoice instalasi baru dengan nominal prorata akurat, payment token, dan payment URL, lalu seketika mengirimkan detail tagihan tersebut ke nomor WhatsApp pelanggan via `sendInstallationInvoice`.

### Recent Patch Log (September 16, 2026 — v2.40.6: Unifikasi Stok Float, Auto-Deduct Kit Standar SPK, & Master Dropcore 25 Rolls)

- **Architectural Invariant: Single Source of Truth for Inventory Stock (`currentStock` Float)**:
  - Kolom `stockQuantity` telah DIHAPUS PERMANEN dari model `inventoryItem`. DILARANG KERAS merujuk atau mendefinisikan ulang `stockQuantity`.
  - Seluruh pencatatan stok di `inventoryItem.currentStock` dan pergerakan di `inventoryMovement.quantity`, `previousStock`, `newStock` WAJIB bertipe `Float` (didukung desimal untuk kabel dan material meteran/cairan).
  - Field `packSize Int?` pada `inventoryItem` digunakan untuk barang kemasan (pack/box). Form mutasi stok (`/admin/inventory/movements`) wajib mendukung konversi otomatis pack ke pcs (`quantity = packCount * packSize`).
  - Field `periodLabel String?` (format `YYYY-MM`) pada `inventoryMovement` digunakan untuk pelabelan audit Stock Opname bulanan (`movementType === 'ADJUSTMENT'`).

- **Architectural Invariant: Soft-Limit on Consumable Deductions (Jalur B)**:
  - Pada `inventory-deduct.service.ts`, pemotongan material consumable generic (kabel ties, isolasi, paku klem, fast connector) DILARANG KERAS melempar exception atau memblokir teknisi saat stok gudang bernilai 0 atau negatif.
  - Jika stok habis, sistem WAJIB mencatat warning log dan tetap merekam transaksi `inventoryMovement` bertipe `OUT` sehingga stok menjadi negatif secara transparan di sistem untuk kemudian disesuaikan saat restock/opname.

- **Architectural Invariant: Work Order Type Standard Kits (`workOrderTypeKit`)**:
  - Model `workOrderTypeKit` dan `workOrderTypeKitItem` menghubungkan tipe SPK (`issueType`, e.g. `INSTALLATION`) dengan material default yang wajib dipotong.
  - Saat handler `/api/technician/work-orders/[id]/complete` dipanggil, setelah roll kabel dipotong, sistem WAJIB memproses auto-deduct kit standar dengan `try/catch` terisolasi per item agar kegagalan satu material tidak membatalkan penutupan SPK.
  - Admin UI tersedia di `/admin/inventory/kits`.

- **Architectural Invariant: 25 Precon Dropcore Physical Rolls & Idempotent Seeding**:
  - Master item dropcore terdiri dari 5 varian (`EMG-CAB-DRP-1C-50M` s/d `300M`).
  - 25 unit roll fisik (`ROLL-50M-01` s/d `ROLL-300M-05`) di-seed ke `inventoryAsset` tipe `CABLE_ROLL` dengan status `AVAILABLE`.
  - Seeding roll fisik WAJIB menggunakan `upsert` dengan `update: {}` agar sisa meteran kabel (`remainingLength`) yang sedang digunakan teknisi tidak ter-reset.
  - Initial stock consumable di-seed melalui mutasi `IN` berlabel `SEED-INITIAL` hanya jika barang belum memiliki riwayat mutasi sama sekali.

- **Architectural Invariant: Realtime MAC Address Formatting (`formatMacAddress`)**:
  - Utility `src/lib/mac-format.ts` WAJIB digunakan pada seluruh form input MAC address.
  - Otomatis mengubah karakter ke huruf kapital dan menambahkan separator `:` setiap 2 karakter heksadesimal (`XX:XX:XX:XX:XX:XX`), dengan penanganan backspace yang tidak tersangkut pada separator.

### Recent Patch Log (September 16, 2026 — v2.40.5: Serial Number (SN ONT) Autocomplete & Universal Device Linking pada Modal Edit Pelanggan (UserDetailModal))

- **Architectural Invariant: Universal ONT Serial Number Linking & Replacement**:
  - Modal Edit Pelanggan (`UserDetailModal.tsx`) adalah form universal yang dipanggil dari berbagai halaman (`/admin/pppoe/users`, `/admin/pppoe/users/[id]`, dan `/admin/network/map`). Form ini WAJIB menyediakan input Serial Number (SN ONT) di samping MAC Address ONT.
  - Input Serial Number (SN ONT) memiliki live autocomplete yang mencari stok modem ready (`assetType=MODEM`) di gudang (`/api/inventory/assets`). Memilih salah satu unit otomatis mengisi Serial Number dan MAC Address.
  - Perubahan Serial Number (SN lama $\neq$ SN baru) dideteksi secara visual dengan badge status `Modem akan diganti` dan notice konfirmasi.
  - Backend `updatePppoeUser` menangani lifecycle pergantian modem secara otomatis:
    1. Jika modem lama ada dan diganti: status modem lama diubah menjadi `USED_GOOD`, `currentCustomerId = null`, dan dicatat ke `customerDeviceHistory` (`action = 'REPLACED_OLD'`).
    2. Unit baru dicari di inventori. Jika belum terdaftar, sistem auto-register katalog (`EMG-CPE-ONT-GENERIC`) dan unit `inventoryAsset` baru dengan vendor & model otomatis (`status = 'IN_USE'`).
    3. Unit baru ditautkan ke pelanggan (`action = 'REPLACED_NEW'` atau `'INSTALLED'`).
    4. Jika SN dikosongkan sengaja oleh admin: modem lama dilepas dan dicatat sebagai `DISMANTLED`.
  - Route handler `PUT /api/pppoe/users/[id]` diimplementasikan untuk meneruskan panggilan dari peta jaringan (`/admin/network/map`) langsung ke `updatePppoeUser`, mencegah error 405 Method Not Allowed.
  - Seluruh text emojis pada `UserDetailModal.tsx` dibersihkan dan diganti dengan icon Lucide React standar (`<Router />`, `<Calendar />`, `<Clock />`, `<Zap />`, `<CreditCard />`, `<Camera />`, `<Search />`, `<RefreshCw />`).

### Recent Patch Log (September 16, 2026 — v2.40.4: Hardening Pasang Baru Pelanggan (PSB), Timeout Guard MikroTik/Email, & Resolusi Tampilan SN ONT)

- **Architectural Invariant: Non-Blocking External Calls during Customer Creation**:
  - Sinkronisasi secret MikroTik (`PPPSecretService.syncSecret`) saat membuat atau mengupdate pelanggan WAJIB dibungkus dalam race timeout 4000ms (`Promise.race([syncPromise, timeoutPromise])`). Latensi router atau VPN flapping DILARANG KERAS memblokir pembuatan akun pelanggan di database MySQL.
  - Pada `MikroTikConnection:execute()`, setiap perintah RouterOS API (`conn.write`) dibatasi hard timeout (`customTimeoutMs || 8000ms`) agar tidak mewarisi socket idle timeout default node-routeros (9999 detik).
  - Email notifikasi (`EmailService.sendAdminCreateUser`) WAJIB bersifat asynchronous non-blocking IIFE (`(async () => { ... })().catch(...)`) dengan timeout 5000ms agar keterlambatan SMTP tidak menambah latensi HTTP response.
  - Pada sisi client (`/admin/pppoe/users/new`), request dilengkapi `AbortController` (15s) dan parsing `res.json()` safe-fallback sehingga form button tidak pernah berputar (spinner) tanpa batas waktu.

- **Architectural Invariant: Resolusi Serial Number & Model ONT di Detail Pelanggan**:
  - Kartu "Data Perangkat & Infrastruktur Lapangan (ONT / ODP)" pada `/admin/pppoe/users/[id]` TIDAK BOLEH hanya mengandalkan laporan SPK (`woReportData.sn`).
  - Resolusi ONT memprioritaskan urutan berjenjang:
    1. `currentDevice` (aset aktif dari `inventoryAsset` dengan status `IN_USE`).
    2. `user.inventoryAssets[0]` (dimuat langsung oleh `getPppoeUserById`).
    3. `deviceHistory[0]` (catatan pemasangan terbaru dari `customerDeviceHistory`).
    4. Fallback ke `woReportData` (laporan teknisi pada SPK).
    5. Fallback ke `user.macAddress` untuk MAC address.
  - Baris Serial Number (SN ONT) dilengkapi tombol aksi cepat `+ Hubungkan` / `Ubah` yang langsung memicu modal pergantian/penghubungan ONT tanpa harus scroll ke section riwayat SPK.
  - Endpoint `replace-device` dan `createPppoeUser` otomatis mendaftarkan unit ke `inventoryAsset` jika Serial Number belum pernah dicatat di sistem (auto-detect vendor ZTE/Skyworth/Realtek/FiberHome/Huawei/VSOL).

### Recent Patch Log (September 16, 2026 — v2.40.3: Navigasi Terpadu Document Maker (/admin/documents), Super Admin Bypass, & Dinamis SKU Generator)

- **Architectural Invariant: Document Maker Accessibility & Super Admin Bypass**:
  - `AdminClientLayout.tsx` kini memiliki bypass `isSuperAdmin` sehingga akun `SUPER_ADMIN` selalu dapat melihat seluruh menu navigasi baru secara instan tanpa terhalang permission database yang belum ter-seed.
  - Menu `nav.documents` diletakkan ganda: di bawah *Tagihan & Transaksi* (`nav.catBillingTransactions` di bawah `Invoice Manual` dengan permission `invoices.view`) dan di bawah *Manajemen* (`nav.catManagement` dengan permission `dashboard.view`).
  - Halaman `/admin/manual-invoices` dan `/admin/documents` dihubungkan dengan *Top Sub-Navigation Bar* terpadu (`Tagihan Bulanan` $\leftrightarrow$ `Invoice Manual` $\leftrightarrow$ `Document Maker`).
  - SKU Generator di `/admin/inventory/items` membaca inisial perusahaan secara dinamis (`company.customerIdPrefix` atau `company.name`) dan menyediakan opsi format `Auto ([PREFIX])` serta `Standar GS1` (`[KAT]-[NAMA]`).

### Recent Patch Log (September 16, 2026 — v2.40.2: Dedicated Halaman ONT Modem Pelanggan (/admin/inventory/ont), Seeding Kategori Default, & Import 360 ONT Awal)

- **Architectural Invariant: Dedicated ONT Modem Portal vs General Inventory**:
  - Halaman `/admin/inventory/ont` dirancang khusus untuk memonitor 360+ modem ONT pelanggan dengan fokus pada Serial Number, MAC, Vendor, status pemasangan (`IN_USE`, `AVAILABLE`, `DEFECTIVE`), serta tautan langsung ke pelanggan PPPoE terkait.
  - Halaman `/admin/inventory/assets` tetap melayani aset serialized umum (Roll kabel dropcore dengan sisa meteran, SFP, perangkat backbone).
  - Halaman `/admin/inventory/items` adalah master katalog barang (SKU-level).
  - Import 360 unit ONT awal dipusatkan pada endpoint `/api/admin/inventory/import-initial-modems` yang mengekstrak logic dari `scripts/import-initial-modems.ts`, memetakan ONU dari pelanggan PPPoE secara otomatis ke `inventoryAsset`.
  - Default kategori ISP (`HW`, `CPE`, `PAS`, `CAB`, `CON`, `PWR`, `TLS`, `ACC`, `MKT`, `SUP`) ditanamkan ke `inventoryCategory` via `/api/admin/inventory/seed-defaults`.
  - Permission: Menu `nav.inventory` menggunakan `inventory.view` (bukan `settings.view`) agar user dengan role `WAREHOUSE` ("Staf Gudang") dapat mengakses antarmuka inventori tanpa harus membuka hak akses konfigurasi sistem.

### Recent Patch Log (September 16, 2026 — v2.40.1: Integrasi OLT Vendor VSOL & HSGQ)

- **Architectural Invariant: Modular OLT Vendor Adapters**:
  - Semua vendor OLT diimplementasikan di `src/lib/olt/vendors/<vendor>.ts` dan didaftarkan di `src/lib/olt/poller.ts:getVendorModule()`.
  - **VSOL**: Mendukung seri V1600GS (Cortina), V1600GS-ZF (ZTE Falcon), V1600GT (4/8/16-port), dan V1600G/D. Mendukung SNMP private MIB `1.3.6.1.4.1.37950` dan CLI Telnet/SSH (`show ont status`, `show gpon onu state`, `show ont optical-info`).
  - **HSGQ**: Mendukung seri HSGQ-G02ID (2-port GPON Mini OLT), G008, G016, dan E04. Mendukung SNMP private MIB `1.3.6.1.4.1.50222` dan CLI Telnet/SSH (`show gpon onu state <port>`, `show pon power onu-rx <port>`).
  - Parsing multi-pattern menjamin toleransi terhadap variasi spasi atau kolom pada firmware yang berbeda.

### Recent Patch Log (September 16, 2026 — v2.40.0: Sistem Inventori Aset, Penomoran Dokumen, & Document Maker)

- **Architectural Invariant: Inventory — Serialized Assets vs Quantity Stock**:
  - MODEM dan CABLE_ROLL = `isSerialized = true` → setiap unit punya record `inventoryAsset` sendiri dengan SN, status, currentCustomerId, version (optimistic locking).
  - CABLE_ROLL tracking per meter: `remainingLength` dikurangi tiap kali dipakai (via `workOrderMaterial` + `deductWorkOrderMaterial()`). Jika `remainingLength ≤ 10m` → status otomatis `DEPLETED`.
  - Aksesori/supplies = qty-based → deduct dari `inventoryItem.stockQuantity` langsung.
  - **NEVER confuse**: `inventoryAsset` (serialized unit) vs `inventoryItem` (catalog item dengan qty stock).
  - Idempotency guard: `workOrderMaterial.isDeducted` cek sebelum deduct → tidak double-deduct.

- **Architectural Invariant: Document Numbering — preview vs issue**:
  - `previewNextNumber()` = read-only, TIDAK mengkonsumsi nomor. Aman dipanggil berkali-kali.
  - `issueNextNumber()` = increment `currentSeq` dalam `$transaction` + catat `issuedNumber`. HANYA panggil saat user betul-betul konfirmasi.
  - Format: `{PREFIX}/{DEPT}/{COUNTER}/{BULAN}/{TAHUN}` (contoh: `MOU/RW01/001/09/2026`).
  - Seed wajib via `/api/admin/inventory/seed-defaults` setelah deploy ke VPS agar numbering rules tersedia.
  - Invoice manual (FAK/BILL) sudah terintegrasi dengan fallback ke legacy generator.

- **Architectural Invariant: Ganti Modem Flow**:
  - API: `POST /api/pppoe/users/:id/replace-device` dengan body `{ newSerialNumber, reason, technicianName }`.
  - Flow: (1) Cari modem lama (`status=IN_USE, currentCustomerId=id`) → set USED_GOOD + log REPLACED_OLD. (2) Cari modem baru by SN → set IN_USE + currentCustomerId + log REPLACED_NEW. (3) Update `pppoeUser.macAddress` jika modem baru punya MAC. Semua dalam `$transaction`.
  - Modem baru tidak HARUS ada di inventori — jika tidak ditemukan, tetap dilanjutkan (buat record baru atau log saja).
  - Device history ditampilkan di halaman detail pelanggan (`/admin/pppoe/users/:id`) → Section "Perangkat ONT".

- **Architectural Invariant: SPK Wizard Cable Roll Deduction**:
  - Step 2 wizard teknisi: dropdown `availableRolls` (CABLE_ROLL, AVAILABLE) + field `dwRoll` (meter dipakai).
  - Submit → `selectedRollId` + `dwRoll` dikirim ke complete API.
  - Backend: `deductWorkOrderMaterial()` dipanggil non-fatal (error tidak gagalkan submit SPK).
  - `isDismantle` di wizard HARUS dideklarasikan SEBELUM useEffect yang mereferensikannya (atau gunakan `wo?.issueType` langsung di dalam useEffect).

- **Architectural Invariant: ONT SN on PSB Form**:
  - Form PSB (`/admin/pppoe/users/new`) mencari MODEM AVAILABLE realtime saat user ketik SN.
  - Tidak blocking: jika SN tidak ditemukan di inventori, tetap bisa simpan (pelanggan terdaftar, SN dicatat sebagai-is).
  - Jika SN ditemukan & asset ada di inventori → setelah simpan, POST `/api/pppoe/users` harus update `status=IN_USE`, `currentCustomerId`, log `customerDeviceHistory`.

### Recent Patch Log (September 14, 2026 — v2.39.16: VPN Server UI Native Modernization & Legacy CHR Elimination)
- **Architectural Invariant: Complete Separation of Native Linux VPS VPN vs Legacy CHR UI**:
  - **The Context**: Admin kebingungan melihat kartu VPN Server menampilkan parameter MikroTik CHR (Port API 8728, User admin, tombol Test Koneksi / Setup Otomatis / Script Manual, dan L2TP Control SSH root) di kartu Linux VPS bawaan EugineBill.
  - **The Fix**:
    - Seluruh parameter legacy MikroTik CHR (`Port API 8728`, `Username admin`) dihapus dari tampilan kartu server dan modal konfigurasi.
    - Tombol *Test Koneksi*, *Setup Otomatis*, *Script Manual*, dan *L2TP Control (SSH)* dihapus permanen dari kartu VPS native.
    - Data yang ditampilkan murni parameter native Linux VPS: Host Endpoint (`43.173.14.236`), Subnet Tunnel (`10.200.0.0/24`), Port WireGuard (`51820 / UDP`), dan Port L2TP/IPsec (`1701, 500, 4500 / UDP`).
    - Tombol aksi disederhanakan menjadi 3 fungsi esensial: **Panel WireGuard**, **Kelola Router Klien (VPN Client)**, dan **Edit Konfigurasi Pool**.
    - Tombol "+ Tambah Server VPN" di header diganti dengan link cepat `Kelola VPN Client`.

### Recent Patch Log (September 14, 2026 — v2.39.15: FTTH Deployment Pack Standards: VSOL V1600GS-ZF vs Standard & MikroTik Master RSC)
- **Architectural Invariant: OLT VSOL V1600GS-ZF Mandatory service-port**:
  - **The Context / Fatal Bug**: Pada instalasi lapangan OLT VSOL seri **V1600GS-ZF** (ZTE Falcon chipset variant), modem ONT berhasil registrasi (lampu PON solid hijau), namun paket PPPoE Discovery (PADI) tidak pernah sampai ke MikroTik.
  - **The Root Cause & Fix**: Seri ZF mewajibkan baris `service-port 1 gemport 1 uservlan 20 vlan 20` pada line profile sebagai cross-connect bridge antara GEM port dan switch fabric uplink. Tanpa baris ini, OLT men-drop traffic data pelanggan. Seri standar (Cortina chipset) tidak mewajibkan deklarasi eksplisit ini. Template dipisahkan menjadi `01-vsol-1600gs-zf.conf` dan `01-vsol-1600gs-standard.conf`.
- **Architectural Invariant: Dedicated Routed OLT Trunk on MikroTik**:
  - Port trunk ke OLT (misal `ether5-DISTRIBUSI`) **DILARANG** dimasukkan ke dalam `bridge-LAN`.
  - `vlan20-PPPOE` dan `vlan30-MGMT` wajib ditempelkan langsung pada interface ethernet fisik (`ether5-DISTRIBUSI`).
  - `bridge-LAN` murni untuk port lokal teknisi/AP (`ether2-ether4`).
  - TCP MSS Clamping (`clamp-to-pmtu`) wajib dipasang pada firewall mangle untuk mencegah web/banking timeout pada PPPoE clients.
  - DNS Cloudflare (`1.1.1.1, 1.0.0.1`) wajib disuntikkan ke DHCP LAN dan PPP Profile.

### Recent Patch Log (September 14, 2026 — v2.39.14: Network UI Standard, ACS TR-069 Clean Guide, & VPN Architecture Clarification)
- **Architectural Invariant: Native VPS Built-in VPN Server vs External MikroTik CHR**:
  - **The Context**: Admin dan teknisi baru sering mengalami kebingungan melihat terminologi "MikroTik CHR" di menu VPN Server, mengira bahwa mereka diwajibkan menyewa router MikroTik Cloud Hosted Router (CHR) terpisah di cloud agar VPN EugineBill dapat berfungsi.
  - **The Architecture Truth**:
    - **VPS Built-in VPN Server (WireGuard & L2TP/IPsec — Rekomendasi Utama)**: EugineBill telah memiliki server VPN native langsung di Linux VPS (WireGuard kernel module dan xl2tpd/strongSwan). Semua router MikroTik pelanggan (NAS) di lapangan dapat langsung terhubung ke IP VPS EugineBill tanpa memerlukan lisensi atau router CHR perantara.
    - **External MikroTik CHR (Mode Alternatif Opsional)**: Hanya disediakan sebagai opsi sekunder jika ISP telah memiliki router MikroTik CHR mandiri di data center yang ingin difungsikan sebagai konsentrator VPN terpisah.
  - **Admin UI & Guide Hardening**:
    - `src/components/admin/AcsGuideCard.tsx`: Tautan eksternal ke GitHub dihapus. Panduan terintegrasi penuh (*self-contained*) melalui accordion "Buka Panduan Setup TR-069" yang mencakup MikroTik VLAN 4000, OLT VSOL CLI, dan ONT Multi-Vendor (ZTE, Huawei, Fiberhome, VSOL).
    - `src/app/admin/network/routers/page.tsx`: Panduan "Alur NAS / Router" dan "Troubleshooting FreeRADIUS: unknown client" direfaktor ke standar Shadcn UI bersih (`bg-card`, `border-border`, code block `bg-zinc-950`).
    - `src/app/admin/network/vpn-server/page.tsx` & `vpn-client/page.tsx`: Diberikan penegasan banner arsitektur VPN EugineBill, font berkontras tinggi pada light dan dark mode, perapian pengaturan IP pool WireGuard & L2TP, serta penghapusan seluruh text emoji pada modal dan opsi select (100% Lucide React icons).

### Recent Patch Log (September 14, 2026 — v2.39.13: WhatsApp Delivery Audit Hardening & Safe Batch Resend Engine)
- **Architectural Invariant: WhatsApp Audit Log Matching & Safe Batch Resend**:
  - **The Problem**: Log pengiriman WhatsApp sebelumnya mencocokkan invoice dengan log hanya berdasarkan nomor HP dan tanggal pembuatan invoice (`logTime >= invCreatedAt`). Akibatnya, pesan transaksi non-invoice (seperti OTP, welcome message, pesan isolasi, atau tanda terima pembayaran sebelumnya) salah dideteksi sebagai bukti pengiriman reminder invoice bulan berjalan, sehingga tagihan yang sebenarnya belum terkirim dianggap sudah terkirim. Selain itu, proses resend sebelumnya membombardir gateway WA sekaligus tanpa jeda batch.
  - **Accurate Log Matching Rule**:
    - Pencocokan log WhatsApp (`whatsapp_history`) dengan invoice WAJIB memverifikasi bahwa `inv.invoiceNumber` tercantum pada isi pesan (`l.message`) atau metadata/respons provider (`l.response`).
    - Pengecekan tidak boleh mengandalkan nomor telepon pelanggan saja.
  - **Safe Batch Resend Engine**:
    - Nilai `batchSize` (default: 10) dan `batchDelay` (default: 120 detik) diambil langsung dari tabel `whatsapp_reminder_settings`.
    - Di sisi backend route (`/api/admin/whatsapp/audit-delivery`), pengiriman dieksekusi per-batch dengan jeda `await new Promise(r => setTimeout(r, batchDelay * 1000))`.
    - Di sisi UI admin (`/admin/whatsapp/audit`), antarmuka membagi antrean per-batch dan menyediakan live progress bar, penghitung counter real-time (Berhasil, Gagal, Sisa), serta hitung mundur (countdown) jeda delay dengan tombol *Lewati Jeda* dan *Hentikan Pengiriman*.
  - **Admin UI Standard Compliance**:
    - Menggunakan standar Shadcn UI (`Card`, `Badge`, `Button`, `Input`, `Table`, `Dialog`, `Checkbox`).
    - 5 kartu ringkasan bento interaktif langsung memfilter tabel ketika diklik.
    - Bersih 100% dari text emoji dengan representasi visual dedicated Lucide React icons.

### Recent Patch Log (September 14, 2026 — v2.39.12: WhatsApp Notification Settings & Anti-Banned Batch Sending Enhancements)
- **Architectural Invariant: WhatsApp Dual Quota Mode & Anti-Banned Batch Sending**:
  - **The Context**: Admin memerlukan keleluasaan memilih antara proteksi anti-spam nomor WhatsApp (Mode Aman / Aturan Ketat 3 pesan) atau kebebasan penjadwalan reminder tanpa batas kuota (Mode Fleksibel / Bebas Kuota). Di samping itu, pengiriman massal pesan otomatis rentan diblokir WhatsApp jika tidak memakai batching, jeda istirahat, dan pengacakan antrean.
  - **Dual-Mode Quota Architecture (`strictQuotaEnabled`)**:
    - **Mode Aman / Strict (`strictQuotaEnabled = true`)**:
      - `maxInvoiceReminders = 2` dan `maxTotalMessagesPerCycle = 3`.
      - Jadwal `reminderDays` dibatasi maksimal 2 hari hanya sebelum jatuh tempo (`<= 0`, misal: H-6 dan H-1).
      - Menjamin perlindungan skor reputasi nomor WhatsApp dari laporan spam pelanggan.
    - **Mode Fleksibel / Uncapped (`strictQuotaEnabled = false`)**:
      - `maxInvoiceReminders = 99` dan `maxTotalMessagesPerCycle = 99`.
      - Jadwal `reminderDays` bebas sebelum (`<= 0`) dan/atau sesudah (`> 0`) jatuh tempo.
      - Pengecekan kuota pesan siklus di bypass / unblocked sehingga invoice reminder lanjutan tidak tertahan.
  - **Anti-Banned Batch Engine (`RateLimitConfig` + Fisher-Yates)**:
    - Nilai `batchSize` (default: 10) dan `batchDelay` (default: 120s) WAJIB dibaca dinamis dari tabel `whatsapp_reminder_settings` dan diteruskan ke `sendWithRateLimit(messages, fn, rateLimitConfig)`.
    - Jika `settings.randomize === true`, antrean pesan wajib diacak dengan algoritma *Fisher-Yates shuffle* sebelum dikirim untuk memecah pola pengiriman deterministik yang mudah dideteksi oleh provider WhatsApp.
    - Pada Admin UI, selalu sertakan kalkulasi estimasi durasi pengiriman otomatis dan WAJIB mematuhi aturan bebas text emoji dengan Lucide React icons.

### Recent Patch Log (September 12, 2026 — v2.39.11: Client Deployment Toolkit Hardening - OLT VSOL V1600GS & MikroTik FTTH Pack)
- **Architectural Invariant: Toolkit Synchronization & Zero-Friction Field Deployment**:
  - **The Context**: Toolkit deployment klien di `deployment-pack-client/` adalah fondasi lapangan yang dibawa teknisi dengan flashdisk/laptop untuk setup OLT dan MikroTik klien secara offline maupun online dalam waktu 10–15 menit.
  - **OLT Web Management Port Alignment**:
    - File konfigurasi OLT `01-vsol-1600gs-clean.conf` diselaraskan ke `web port 8001` (standar OLT klien EugineBill, berbeda dari OLT 2 EugineMedia yang memakai 8003).
  - **MikroTik Fail-Safe NAT & Remote Management**:
    - File `02-mikrotik-ftth-complete.rsc` menyediakan dual-port DST-NAT fail-safe:
      - Web: Port `8001` -> `192.168.30.6:8001` (standar akses web GUI OLT via MikroTik).
      - Fallback Web: Port `8003` -> `192.168.30.6:8001` (antisipasi kebiasaan teknisi EugineMedia).
      - SNMP UDP: Port `1611` -> `192.168.30.6:161` (standar monitoring OLT 1 klien).
      - Fallback SNMP UDP: Port `1614` -> `192.168.30.6:161` (port UDP OLT VSOL di EugineMedia).
    - Memungkinkan laptop teknisi di port LAN/Wi-Fi (`192.168.50.x`) langsung membuka `http://192.168.30.1:8001` atau `http://192.168.50.1:8001` tanpa perlu cabut-pasang kabel ke port MGMT OLT.

### Recent Patch Log (September 12, 2026 — v2.39.10: Universal Client-Side Auto-Compression & High-Capacity Image Upload Engine)
- **Architectural Invariant: Dual-Layer Zero-Failure Image Upload Architecture**:
  - **The Problem**: Smartphone kamera modern menghasilkan foto berukuran 6MB–25MB (resolusi 48MP–108MP). Jika diunggah mentah di jaringan seluler teknisi/pelanggan di lapangan, request rawan timeout, packet drop, dan ditolak server karena limit API rendah (3MB–5MB) atau diblokir validasi client.
  - **Layer 1: Mandatory Client-Side Auto-Downscale/Compression**:
    - Seluruh form upload (Teknisi SPK, Tiket, KTP, Pembayaran Manual, Topup Saldo, Registrasi Pelanggan) WAJIB melewatkan file ke fungsi `compressImage(file, 1600, 0.8)` (`src/lib/utils.ts`) sebelum dimasukkan ke `FormData`.
    - Resolusi dibatasi ke `maxDimension = 1600px` (menjamin angka redaman OPM, barcode/QR, label SN modem, struk bank, dan tulisan KTP tetap 100% terbaca tajam dan jernih).
    - Ukuran file menyusut secara instan (< 150ms di browser) dari 15MB–25MB menjadi ~200KB–600KB, memangkas durasi upload menjadi < 1 detik.
    - Pada canvas overlay watermark teknisi (`work-orders/[id]/page.tsx`), dimensi canvas WAJIB di-clamp ke maksimal 1600px sebelum me-render strip teks WIB/GPS/SPK.
  - **Layer 2: Server-Side High-Capacity Limits (25MB–30MB)**:
    - Seluruh konstanta `MAX_SIZE` / `maxSize` pada route upload (`/api/technician/upload`, `/api/upload/payment-proof`, `/api/upload/pppoe-customer`, `/api/customer/payments/[id]/proof`, `/api/customer/invoices/[id]/manual-payment`, `/api/public/upload-registration`, `/api/upload`) dinaikkan menjadi `25 * 1024 * 1024` (25MB).
    - Nginx VPS sudah memiliki `client_max_body_size 100M;`, sehingga request upload tidak akan pernah ditolak server secara prematur.
  - **Client-Side Blocker Removal**:
    - Dilarang keras menampilkan pop-up error "Ukuran file maksimal 5MB" di sisi klien. Formulir harus secara cerdas dan senyap mengompres foto ke ukuran ideal sehingga pengalaman pengguna mulus 100% tanpa hambatan.

### Recent Patch Log (September 12, 2026 — v2.39.9: Permanent Hide PWA Install Prompt Across All Portals Except Landing Page)
- **Architectural Invariant: Strict Whitelist for PWA Install Prompt**:
  - Modal dialog "Install Aplikasi Pelanggan" (`PwaInstallPrompt.tsx`) DILARANG menggunakan sistem blacklist.
  - Komponen WAJIB menggunakan *strict whitelist* (`isLandingPage = pathname === '/' || pathname === '/landing' || pathname.startsWith('/landing')`).
  - Seluruh portal dan rute operasional (Admin `/admin/*`, Invoice `/invoice/*`, Pay `/pay/*`, Customer `/customer/*`, Agent `/agent/*`, Teknisi `/technician/*`) WAJIB mengembalikan `null` secara permanen dan menolak memasang event listener `beforeinstallprompt` agar tidak mengganggu alur operasional pengguna.

### Recent Patch Log (September 12, 2026 — v2.39.8: Fix Auto-Hide Transfer Manual When Payment Gateway Active)
- **Architectural Invariant: Strict Payment Method Mutual Exclusivity**:
  - Pada halaman bayar pelanggan (`/pay/[token]`), pilihan Transfer Bank Manual WAJIB tersembunyi total (*auto-hide*) jika terdapat payment gateway online yang aktif (`paymentGateways.length > 0`, seperti QRIN, Duitku, Midtrans, dll.).
  - Dilarang menambahkan kondisi `|| normalizedBankAccounts.length > 0` pada rendering kartu transfer manual karena akan menyebabkan opsi manual selalu muncul jika admin memiliki rekening bank tersimpan.
  - Kartu Transfer Bank Manual HANYA boleh dirender jika belum ada payment gateway aktif sama sekali (`paymentGateways.length === 0`). Dalam kondisi ini, formulir transfer manual otomatis terbuka (*auto-show*) sebagai metode pembayaran utama.

### Recent Patch Log (September 12, 2026 — v2.39.7: Master Easy Setup Guide VPS & MikroTik, Zero-Emoji Strict Compliance)
- **Architectural Invariant: Master Easy Setup & 1-Click Paste Workflow**:
  - Semua panduan instalasi dan integrasi router disatukan dalam master guide: `docs/setup/EUGINEBILL_EASY_SETUP_GUIDE.md`.
  - Alur integrasi MikroTik wajib menganut prinsip: "Cuma beberapa klik di UI dan paste script di Winbox terminal, router langsung siap pakai."
  - Root `README.md` dan `docs/DOCS_INDEX.md` menampilkan master guide ini di baris paling atas untuk memudahkan onboarding klien baru dan vendor.
  - Halaman router (`/admin/network/routers`) dilengkapi helper card "Easy Setup Fondasi FTTH & TR-069" yang mengarahkan langsung ke generator skrip aktivasi on-demand.
- **Strict UI Invariant: Zero Text Emojis Across ALL Portals**:
  - Dilarang keras menggunakan text emoji pada seluruh teks antarmuka (Admin, Customer, Technician, Landing Page).
  - Seluruh status, indikator langkah, dan tombol wajib menggunakan komponen resmi `lucide-react` (`<Radio />`, `<Server />`, `<Cloud />`, `<Zap />`, `<Terminal />`, `<Wifi />`, `<AlertTriangle />`, dot status Tailwind, dll.).

### Recent Patch Log (September 12, 2026 — v2.39.6: Built-in TR-069 ACS Engine, On-Demand VLAN 4000 Activation UI & Lean Base Scripts)
- **Architectural Invariant: Lean Base Deployment & On-Demand TR-069 Activation**:
  - **Ultra-Lean Foundation Scripts**: Skrip awal FTTH pada `deployment-pack-client/` (`01-vsol-1600gs-clean.conf` & `02-mikrotik-ftth-complete.rsc`) sengaja dijaga tetap murni dan ringan tanpa memuat VLAN 4000 atau DHCP TR-069 secara default.
  - **On-Demand Activation via Admin UI**: Jika ISP ingin mengaktifkan TR-069 Dedicated VLAN 4000:
    1. Admin dapat menyalin skrip aktivasi MikroTik (VLAN 4000, pool, DHCP server) langsung dengan 1-klik dari komponen `AcsGuideCard.tsx` pada halaman `/admin/acs`.
    2. Admin dapat menyalin baris perintah CLI OLT VSOL (tagging VLAN 4000 pada port uplink) dengan 1-klik.
    3. Modem pelanggan dikonfigurasi WAN 2 (IPoE/DHCP VLAN 4000) atau In-Band PPPoE (`INTERNET,TR069`).
- **Service Invariant: Native Built-in ACS vs GenieACS**:
  - EugineBill memiliki engine TR-069 bawaan (*Built-in ACS*) di `src/app/api/cwmp/route.ts` dan `src/server/services/acs/cwmp.service.ts`.
  - Built-in ACS berjalan 100% native di dalam monolit Next.js + Prisma (`acsDevice`, `acsTask`), TANPA memerlukan instalasi GenieACS eksternal, TANPA container Docker, dan TANPA database MongoDB.
  - Endpoint `/api/cwmp` **100% otomatis aktif di VPS** selama PM2 `EugineBill-radius` running.
  - Endpoint `/api/cwmp` mengekspor POST (pertukaran SOAP TR-069) dan GET (health check status JSON).
- **UI & Documentation Invariant**:
  - Halaman `/admin/acs` dilengkapi komponen `AcsGuideCard.tsx` dengan URL dinamis (`window.location.origin + '/api/cwmp'`), tombol 1-klik salin, dan generator skrip aktivasi interaktif 3 langkah (MikroTik, OLT, ONT).
  - Dokumentasi resmi tersimpan lengkap di `docs/mikrotik/BUILTIN_TR069_ACS_SETUP_GUIDE.md`.

### Recent Patch Log (September 12, 2026 — v2.39.5: Automated ONT Remote Readiness Probe, 1-Click Winbox Setup Script in UI, and Hardened FTTH Standards)
- **Feature Invariant: In-App ONT Remote Readiness Probe & Winbox Activation Script**:
  - Modal remote ONT (`OntRemoteModal.tsx`) WAJIB secara proaktif memvalidasi kesiapan koneksi sebelum admin meluncurkan tunnel:
    1. Memanggil `GET /api/network/ont-remote?action=check-readiness` untuk memverifikasi soket API MikroTik (timeout 3 detik), keberadaan IP PPPoE aktif pelanggan, dan kesiapan proxy VPS.
    2. Jika API router belum terhubung atau pelanggan offline, modal menampilkan status peringatan cerdas dan otomatis membuka kartu skrip aktivasi Winbox siap salin (1-klik copy).
    3. Menyajikan 2 langkah praktis aktivasi tanpa membebani modul teknisi: (1) Paste skrip ke New Terminal Winbox, (2) Aktifkan opsi Web WAN / Remote Management pada koneksi PPPoE modem pelanggan.
  - **Dynamic Router API Port Invariant**: Dilarang keras men-hardcode port API `8728` pada generator skrip aktivasi. Sistem WAJIB selalu membaca port aktual yang dikonfigurasi admin pada database router (`router.port`) sehingga skrip yang dihasilkan (`/ip service set api port=${router.port}`) dan rule firewall input (`dst-port=${router.port}`) 100% presisi sesuai port kustom yang dipilih admin (misal 8520, 8728, dll.).
- **Hardening Invariant: FTTH Production Script Optimization (`02-mikrotik-ftth-complete.rsc`)**:
  - **DNS Hardening**: DHCP Client port `ether1` menggunakan `use-peer-dns=no`. DNS statis menggunakan recursive resolver MikroTik (`1.1.1.1` & `8.8.8.8`) untuk menghindari transparent hijacking atau DNS poisoning dari modem upstream ISP.
  - **Time & Clock Synchronization**: RouterOS wajib mengaktifkan `/ip cloud set update-time=yes`, `/system clock set time-zone-name=Asia/Jakarta`, dan `/system ntp client` ke `id.pool.ntp.org` dan `time.google.com` untuk menjamin validitas sertifikat TLS dan jadwal billing.
  - **Separation of Concerns for Isolir**: Profil dan pool isolir dihapus dari skrip pondasi awal FTTH karena dikelola dinamis oleh modul billing (*Firewall Payment Integration*).
  - **Lean NAT Architecture**: Menghapus 3 rule masquerade internal yang redundan; menyetel DST-NAT Web GUI OLT ke port `8001` (diarahkan ke `192.168.30.6:80`).

### Recent Patch Log (September 12, 2026 — v2.39.4: FTTH Deployment Pack Lean Architecture & Terminal Feedback Loop)
- **Critical Invariant: Ultra-Lean FTTH Deployment Pack (`02-mikrotik-ftth-complete.rsc`)**:
  - Dilarang memasukkan Queue CAKE (`queue-type=cake`) dan Game Mangle berlebihan ke skrip pondasi awal. Algoritma CAKE dan puluhan aturan mangle sering menyebabkan latensi CPU tinggi, bufferbloat tak terduga, dan inkompatibilitas antar varian chipset RouterOS v7.
  - Skrip pondasi FTTH WAJIB mengutamakan prinsip *direct connectivity*:
    1. **WAN DHCP Client**: Port `ether1` mengambil IP, default gateway, dan DNS otomatis dari modem ISP (`/ip dhcp-client add interface=ether1 ...`).
    2. **LAN DHCP Server Plug & Play**: Port `ether2-5` digabung ke `bridge-LAN` (`192.168.50.1/24`) dengan DHCP Server aktif (`192.168.50.10-250`) agar laptop teknisi atau Access Point langsung mendapat internet begitu dicolok.
    3. **VLAN OLT**: VLAN 20 (PPPoE), VLAN 30 (Management OLT `192.168.30.1`), dan VLAN 4000 (TR-069 ACS `10.40.10.1`) terpasang di atas `bridge-LAN`.
    4. **Standard Simple Queue**: Profil PPPoE menggunakan rate-limit native RouterOS (misal `rate-limit="20M/20M"`) yang ringan dan stabil.
- **Workflow Invariant: Interactive Terminal Winbox Feedback Loop**:
  - Saat pengguna mengonfigurasi router di lapangan, pengguna akan mem-paste skrip ke Terminal Winbox dan mem-paste kembali pesan output/error terminal ke Agent.
  - Agent WAJIB langsung menganalisis baris output tersebut (misal `failure: already have such name`, `invalid value for argument`, atau port bentrok), mengidentifikasi penyebab pastinya, dan memberikan perintah perbaikan yang presisi baris per baris.

### Recent Patch Log (September 11, 2026 — v2.39.3: Strict Admin-Defined Port Forwarding Without Probing)
- **Critical Invariant: Strict Admin-Driven Port Forwarding (`applyAdminPortForwarding`)**:
  - DILARANG melakukan scanning/probing dinamis ke router MikroTik via `/ip/service/print` saat menyimpan router atau VPN client. Probing dinamis menambah latensi, gagal jika koneksi API belum terbentuk, dan berisiko mengubah port tanpa persetujuan eksplisit admin.
  - Port forwarding VPS (iptables DNAT) WAJIB murni mengikuti isian form admin: jika admin mengisi API port 8520 dan Winbox port 8228, sistem langsung menerapkan target port tersebut ke `vpnClient.publicPorts` dan iptables VPS tanpa menyentuh atau memindai router MikroTik.
  - Modal tambah & edit router (`/admin/network/routers`) menyediakan input field eksplisit untuk `API Port` dan `Winbox Port`.
- **Diagnostic Invariant: Winbox PC Cache Corruption**:
  - Jika koneksi Winbox dari HP (atau IP publik) berhasil login normal, tetapi dari PC Windows mengalami "the remote host closed the connection" atau logout otomatis 1 detik setelah login, penyebabnya adalah **cache lokal Winbox Windows yang korup/mismatch** di `%APPDATA%\MikroTik\WinBox\cache`. Solusinya adalah membuka Winbox di PC -> klik menu **Tools** -> **Clear Cache**.

### Recent Patch Log (September 11, 2026 — v2.39.2: Turnkey 1-Paste VPN Remote Scripting & Auto Port Sync)
- **Critical Invariant: Single Full-Privilege Remote User (`group=full`)**:
  - Dilarang keras membatasi user remote MikroTik ke grup custom seperti `api-users` dengan kebijakan terpotong (`!romon, !reboot, !sniff, !rest-api`). Pada RouterOS v7, aplikasi Winbox mewajibkan izin sistem lengkap; user dengan kebijakan terbatas akan terputus (logout otomatis) setelah 1 detik.
  - Seluruh generator skrip setup VPN client (WireGuard & L2TP pada ROS 6 & 7) WAJIB menggunakan `group=full` secara langsung (`/user add name=... group=full password=...`). Satu kredensial ini mencakup seluruh kebutuhan: Winbox, WebFig, SSH, API EugineBill, dan bot redaman.
- **Critical Invariant: Automatic Port Forwarding Synchronization (`autoSetupPortForwarding`)**:
  - Dilarang mengasumsikan router MikroTik selalu menggunakan port default Winbox (8291) atau API (8728). Banyak ISP/admin mengubah port Winbox ke port kustom (misal 8228, 8520).
  - Fungsi `autoSetupPortForwarding` pada `src/app/api/network/routers/route.ts` WAJIB selalu membaca port aktual dari `/ip/service/print` via koneksi API VPN tunnel, membandingkan port target dengan aturan iptables VPS, dan otomatis meregenerasi iptables DNAT jika ada perbedaan.
  - `autoSetupPortForwarding` WAJIB dipanggil secara otomatis pada handler `POST` (tambah router) dan `PUT` (edit router).
- **Critical Invariant: Hotspot vs Local Management Collision**:
  - Jika Hotspot diaktifkan pada interface lokal/bridge (`bridge-LAN`), firewall dinamis Hotspot (`hs-unauth`) akan menembakkan `tcp-reset` pada koneksi lokal yang memanggil IP WAN publiknya sendiri. Jangan menaruh Hotspot pada interface bridge manajemen utama.

### Recent Patch Log (September 11, 2026 — v2.39.1: Turnkey 1-Command Installer & Setup Wizard)
- **Feat: 1-Command All-In-One Automated Installer (`scripts/install.sh`)**:
  - Bundling seluruh dependensi: Node.js 20 LTS, PM2, MySQL Server, Nginx Reverse Proxy (Port 80/443 -> Port 3000 dengan WebSocket & 100MB upload limit).
  - FreeRADIUS 3.x otomatis terpasang dengan modul SQL ke database `euginebill`, dinamis `clients.d/`, dan patch OpenSSL legacy MD4 provider untuk MS-CHAPv2 MikroTik PPPoE pada Ubuntu 22/24.
  - WireGuard VPN Server (`10.200.0.0/24`, port 51820/UDP) dan L2TP/IPSec Server (`10.201.0.0/24`) otomatis aktif tanpa perlu perintah terpisah.
  - 3 Layanan PM2 (`EugineBill-radius`, `EugineBill-wa`, `EugineBill-cron`) otomatis aktif dan disetel auto-startup.
- **Feat: First-Time Setup Wizard Superadmin Account (`/setup` & `/api/setup`)**:
  - **Critical Invariant**: NextAuth (`src/server/auth/config.ts`) mengotentikasi pengguna admin melalui model `prisma.adminUser` dengan mencocokkan `username` (role `SUPER_ADMIN`), **bukan** `prisma.users`.
  - Endpoint `/api/setup` dan halaman `/setup` Langkah 2 menyediakan input eksplisit `Username Login` (default: `'admin'`), membuat record di `prisma.adminUser`, dan melakukan mirror ke `prisma.users`.
  - Begitu selesai, endpoint `/api/setup` mengunci dirinya secara permanen dan menolak setup ulang.

### Recent Patch Log (September 11, 2026 — v2.39.0: Commercial Release Readiness & Zero-Hardcoding)
- **Feat: Mode Autentikasi Router (`router.authMode: 'local' | 'radius'`)**:
  - Skema database mendukung per-router auth mode (`router.authMode`). Mode default adalah `local` (MikroTik local secrets via API). Mode `radius` menggunakan FreeRADIUS 3.x direct MySQL.
- **Feat: Auto-Show Transfer Bank Manual pada `/pay/[token]`**:
  - Jika belum ada payment gateway online aktif (`paymentGateways.length === 0`), halaman pembayaran otomatis menampilkan instruksi Transfer Bank Manual (`company.bankAccounts`) lengkap dengan tombol salin nomor rekening dan upload bukti bayar.
- **Sanitasi Zero-Hardcoding Menyeluruh**:
  - Seluruh referensi domain statis `euginemediagroup.com` dieliminasi dan digantikan secara dinamis oleh `company.baseUrl || process.env.NEXT_PUBLIC_APP_URL`.
  - Fallback IP ONT remote proxy `43.173.14.236` diganti dengan deteksi header host atau `process.env.VPS_PUBLIC_IP`.
  - Fallback logo statis `eugine-logo.png` digantikan oleh logo dinamis perusahaan.
- **Feat: Skrip Safe Update & Port Firewall**:
  - `scripts/safe-update.sh`: Melakukan snapshot database `mysqldump` terkompresi `.sql.gz` sebelum `git pull` dan `npm run build` untuk menjamin zero-data-loss.
  - `scripts/setup-vps-ports.sh`: Membuka port 80, 443, 22, 51820/udp, 1812/1813/3799/udp, 10001:10999/tcp (Winbox), 24000:24999/tcp (ONT Remote), 7547/7567/tcp (GenieACS), 500/4500/1701/udp (L2TP).

### Recent Patch Log (September 10, 2026 — v2.38.5: Salfanet vs EugineBill Blueprint)
- **Architecture Invariant**: Tolak modul FreeRADIUS REST hook (`mods-available/rest`) untuk otentikasi utama karena rentan mass-outage saat web server reboot; gunakan direct MySQL SQL module (`mods-available/sql`) yang jauh lebih tangguh. Tolak pencemaran *synthetic radacct* palsu.

### Recent Patch Log (September 10, 2026 — v2.38.4: PPPoE Username Reuse & Cascade Deletion)
- **Critical Invariant**: Hapus pelanggan berhenti (`deletePppoeUser`) harus menggunakan isolasi berbasis `userId` secara mutlak (`where: { userId: id }`).
- **Proteksi PPPoE Reuse**: Jika username PPPoE yang dihapus terdeteksi sedang digunakan ulang oleh pelanggan aktif lain (`activeReuser`), dilarang keras menyentuh MikroTik secret atau radcheck/radreply agar koneksi pelanggan baru tidak terputus. Invoice `PAID` dipertahankan permanen dengan melepaskan `userId = null` untuk histori pembukuan.

---

### Recent Patch Log (July 2026 — Non-RADIUS, ACS, Billing & UI Overhaul)

- **Feat: Customer Portal UI Overhaul (Cobalt Theme)**
  - Mengubah seluruh antarmuka `/customer/*` menjadi standar *enterprise* (Bento Grid, Hairline tables, Monospace typography).
  - Melepas komponen terang Cyberpunk, digantikan skema *paper*, *ink*, *cobalt*, dan *rule*.
  - **Files**: `src/app/customer/page.tsx`, `invoices/page.tsx`, `history/page.tsx`, `profile/page.tsx`, `tickets/page.tsx` dll.

- **Feat: Cetak Invoice (Thermal & A4)**
  - Menambahkan halaman cetak A4 via `/invoice/[id]/print` dan menyatukan view detail invoice web dengan gaya cetak profesional.
  - Membatasi fitur cetak hanya untuk invoice lunas dan disembunyikan dari menu pelanggan biasa (hanya via Admin/WebView).

- **Feat: Transfer Manual via "Bank Tujuan"**
  - Halaman `pay/[token]` kini mendukung pemilihan bank tujuan saat upload bukti bayar.
  - Memperbaiki bug "Payment Gateway" tumpang tindih dengan mencatat tipe pembayaran manual secara spesifik.

- **Feat: Integrasi TR-069 (GenieACS) di Panel Admin**
  - Menambahkan antarmuka `/admin/acs` untuk melihat CPE/ONT.
  - Parsing data parameter Mikrotik/ZTE (`ZteParamMap`) untuk Redaman, SSID, Password WiFi, & PPPoE Credentials.
  - Memungkinkan pemetaan (mapping) device ACS langsung ke akun PPPoE user.

- **Feat: Migrasi Non-RADIUS (MikroTik Session)**
  - Menambahkan kapabilitas bagi ISP yang menonaktifkan RADIUS untuk tetap menarik data sesi, *traffic*, dan riwayat (uptime, bytes) via API MikroTik (`mikrotikSession` table).
  - Mem-bypass *cron jobs* dan endpoint *dashboard stats* yang dulunya bergantung penuh pada `radacct`.

### Recent Patch Log (April 22, 2026 — VPS Built-in VPN Pool IP Config)

- **Feat: Panel "Konfigurasi VPS Built-in VPN" di VPN Client page** (`1903085`, Apr 22, 2026)
  - Panel collapsible baru untuk mengatur pool IP & gateway WireGuard dan L2TP yang berjalan langsung di VPS.
  - Terpisah dari VPN Server page (yang khusus MikroTik CHR).
  - **Files**: `src/app/admin/network/vpn-client/page.tsx`

- **Feat: PATCH endpoint vps-wg-peer** (`1903085`, Apr 22, 2026)
  - `PATCH /api/network/vps-wg-peer` — update `poolStart`, `poolEnd`, `gatewayIp` di `wg-server-info.json`.
  - Saat gatewayIp disimpan: juga update baris `Address =` di `wg0.conf`, update `info.subnet`, reload via `wg syncconf`.
  - **Files**: `src/app/api/network/vps-wg-peer/route.ts`

- **Feat: PATCH endpoint vps-l2tp-peer** (`1903085`, Apr 22, 2026)
  - `PATCH /api/network/vps-l2tp-peer` — update `poolStart`, `poolEnd`, `gateway` di `l2tp-server-info.json`.
  - **Files**: `src/app/api/network/vps-l2tp-peer/route.ts`

- **Fix: `loadWgServerInfo` data mapping** (`17d83da`, Apr 22, 2026)
  - **Root cause**: membaca `data.info?.publicIp` dll. padahal API mengembalikan fields di top level (`data.publicIp`).
  - **Fix**: mapping diubah ke `data.X` langsung.
  - **Files**: `src/app/admin/network/vpn-client/page.tsx`

- **Fix: pool config menerima full IP address** (`17d83da`, Apr 22, 2026)
  - Input poolStart/poolEnd sebelumnya hanya angka terakhir (mis. `2`). Sekarang full IP (mis. `172.16.212.2`).
  - Validasi backend: full IPv4 regex, bukan range integer 2–254.
  - **Files**: `vps-wg-peer/route.ts`, `vps-l2tp-peer/route.ts`, `vpn-client/page.tsx`

- **Fix: `nextAvailableIp` / `getNextAvailableIp` selalu gunakan prefix `info.subnet`** (`8636800`, Apr 22, 2026)
  - **Root cause**: selalu `base = info.subnet.prefix` → alokasi IP selalu di subnet WG interface default.
  - **Fix**: jika `poolStart` adalah full IP string, gunakan prefixnya sebagai base. Scan "used IPs" dibatasi ke prefix yang sama.
  - WG ADD response juga diperbaiki: `vpnSubnet` dan `gatewayIp` dihitung dari pool prefix, bukan `info.subnet`.
  - **Files**: `src/app/api/network/vps-wg-peer/route.ts`, `src/app/api/network/vps-l2tp-peer/route.ts`

- **Fix: display subnet footer pakai `info.subnet` bukan pool subnet** (`6a8bd04`, Apr 22, 2026)
  - Footer kini tampilkan "Pool subnet: xxx.xxx.xxx.0/24" diturunkan dari prefix poolStart.
  - Edit button prefill diperbaiki: gunakan prefix dari poolStart yang tersimpan (bukan selalu `info.subnet`).
  - **Files**: `src/app/admin/network/vpn-client/page.tsx`

- **Fix: Remove redirect paksa di VPN Client jika tidak ada CHR** (`1903085`, Apr 22, 2026)
  - Sebelumnya: jika `vpnServers.length === 0`, halaman redirect ke VPN Server setup → user tidak bisa akses VPS built-in VPN.
  - Sekarang: redirect dihapus, halaman selalu tampil normal.
  - **Files**: `src/app/admin/network/vpn-client/page.tsx`

### Key Architecture Notes — VPN

- **VPN Server page** (`/admin/network/vpn-server`): HANYA untuk MikroTik CHR. Tidak ada VPS built-in config di sini.
- **VPN Client page** (`/admin/network/vpn-client`): Untuk NAS/router yang connect ke VPS. Panel "Konfigurasi VPS Built-in VPN" ada di sini.
- **`__vps_wg__`** dan **`__vps_l2tp__`**: Virtual server IDs untuk WireGuard dan L2TP peer yang dikelola langsung di VPS.
- **`wg-server-info.json`** (`/etc/wireguard/wg-server-info.json`): Fields: `publicIp`, `publicKey`, `listenPort`, `subnet`, `poolStart`, `poolEnd`, `gatewayIp`.
- **`l2tp-server-info.json`** (`/etc/EugineBill/l2tp/l2tp-server-info.json`): Fields: `publicIp`, `ipsecPsk`, `subnet`, `localIp`, `poolStart`, `poolEnd`, `gateway`.
- **Pool base rule**: saat `poolStart` adalah full IP (mis. `172.16.212.2`), base prefix = `172.16.212`. Selalu gunakan pool prefix, bukan `info.subnet`, saat alokasi IP baru.

- **Fix: `getUserMedia` error langsung fallback ke native camera** (`382dbb3`, Apr 11, 2026)
  - **Root cause**: saat `getUserMedia` melempar error apapun (`NotAllowedError`, Permissions Policy, dll), kode lama menampilkan pesan error merah alih-alih membuka native camera.
  - **Fix**: `catch` block pada `startCamera()` (`CameraPhotoInput`) dan `startStream()` (`CameraViewfinder`) sekarang langsung fallback ke `captureRef.current?.click()` / `setUseNativeCapture(true)`. State `cameraError` + render block error merah dihapus sepenuhnya.
  - **Files**: `src/components/CameraPhotoInput.tsx`, `src/components/CameraViewfinder.tsx`

- **Feat: Kompresi foto otomatis + perbaikan tampilan kamera** (`8ff86c1`, Apr 11, 2026)
  - **Util baru**: `compressImage(file, maxDimension=1280, quality=0.78)` di `src/lib/utils.ts` — resize + JPEG 78%. Estimasi: foto 5MB HP → 200–400KB di DB.
  - **Berlaku di**: `handleFile`, `handleCaptureFile`, `takePhoto` di `CameraPhotoInput` + `takePhoto`, `handleNativeFile` di `CameraViewfinder`.
  - **Tampilan viewfinder**: `h-48` (fixed) → `aspect-[4/3]` (proporsional). Corner guide overlay (4 sudut biru cyan).
  - **Tampilan preview**: border hijau, badge "✓ Foto tersimpan", action bar Galeri|Kamera di bagian bawah.
  - **Canvas resize**: `takePhoto` di kedua komponen sekarang scale down ke max 1280px sebelum `toBlob(..., 0.78)`.
  - **Files**: `src/lib/utils.ts`, `src/components/CameraPhotoInput.tsx`, `src/components/CameraViewfinder.tsx`

- **Feat: Tab "📷 Foto" di UserDetailModal** (`817887a`, Apr 11, 2026)
  - Tab baru "📷 Foto" di sebelah kanan Invoice — tampilkan KTP + foto instalasi read-only.
  - **KTP**: foto full-width, NIK di pojok kanan, placeholder jika kosong.
  - **Foto Instalasi**: grid 2 kolom, label "Foto 1/2/…", placeholder jika kosong.
  - **Lightbox**: klik foto → full screen overlay; klik luar / tombol × untuk tutup. State `lightboxUrl: string | null`.
  - **Note**: tambah/hapus foto tetap di tab "Info Pengguna".
  - **Files**: `src/components/UserDetailModal.tsx`

### Recent Patch Log (April 11, 2026 — Camera Hardening v1 / getUserMedia Rewrite)

- **CRITICAL FIX: `camera=()` Permissions-Policy memblokir semua akses kamera** (`84434ec`, Apr 11, 2026)
  - **Root cause**: `next.config.ts` menyetel `Permissions-Policy: camera=()` — melarang semua akses kamera di semua origin.
  - **Fix**: Ubah ke `camera=(self)` agar `getUserMedia` dapat berjalan di origin sendiri.
  - **File**: `next.config.ts`

- **Feat: HTTP fallback `capture="environment"` saat `getUserMedia` tidak tersedia** (`3643438`, Apr 11, 2026)
  - `CameraPhotoInput`: tambah check `!navigator.mediaDevices?.getUserMedia` → `captureRef.current?.click()`.
  - `CameraViewfinder`: tambah check serupa → `setUseNativeCapture(true)`.

- **Feat: Rewrite kamera menggunakan `getUserMedia`** (`39f3dcb`, Apr 11, 2026)
  - `CameraPhotoInput.tsx` — full rewrite: live video viewfinder via `getUserMedia`, tombol ambil foto + flip kamera.
  - `CameraViewfinder.tsx` — komponen baru untuk foto instalasi inline di admin & UserDetailModal.
  - `admin/pppoe/users/page.tsx` + `UserDetailModal.tsx` — ganti inline camera dengan `CameraViewfinder`.

### Recent Patch Log (April 11, 2026 — Camera Hardening v2 / Permissions-Policy)

- **Feat: `CameraPhotoInput` reusable component** (Apr 10, 2026)
  - **File baru**: `src/components/CameraPhotoInput.tsx`
  - Dua tombol: [🖼 Galeri] buka gallery biasa, [📷 Kamera HP] pakai `capture="environment"` → langsung buka kamera belakang di mobile
  - Setelah upload sukses: auto `navigator.geolocation.getCurrentPosition` → tampilkan badge 📍 lat,lng clickable ke Google Maps
  - Props: `photoUrl`, `onRemove`, `onUploadFile (async → string|null)`, `uploading`, `onGpsCapture?`, `theme ('dark'|'light')`, `hint`, `previewClassName`
  - Theme `dark`: cyberpunk (untuk `/daftar`); theme `light`: admin/modal biasa

- **Updated: 4 halaman/komponen** (Apr 10, 2026)
  - `src/app/daftar/page.tsx` — KTP photo → CameraPhotoInput (dark); GPS mengisi `formData.latitude/longitude`
  - `src/app/admin/pppoe/users/page.tsx` — KTP → CameraPhotoInput; foto instalasi → [Galeri][Kamera HP] inline + capture GPS ke lat/lng
  - `src/app/technician/(portal)/register/page.tsx` — KTP → CameraPhotoInput; removed `ktpInputRef` + `handleUploadKtp`
  - `src/components/UserDetailModal.tsx` — KTP → CameraPhotoInput; foto instalasi → [Galeri][Kamera HP] + GPS ke lat/lng

- **CRITICAL FIX: Push subscription tidak tersimpan ke DB** (`57f6169`, April 10, 2026)
  - **Root cause**: `fetch('/api/push/technician-subscribe', ...)` tidak menyertakan `credentials: 'same-origin'` sehingga cookie `technician-token` tidak dikirim ke server. Tanpa cookie, admin_user tidak terdeteksi → API cari ID di tabel `technician` → 404 → subscription tidak tersimpan.
  - **Fix**: Tambah `credentials: 'same-origin'` ke 3 fetch calls di `SidebarPushToggle`: silent sync, subscribe toggle, unsubscribe toggle.
  - **Files**: `src/app/technician/TechnicianPortalLayout.tsx`

- **CRITICAL FIX: `admin_user` push subscription diabaikan** (`7df3a8f`, April 10, 2026)
  - **Root cause**: `POST /api/push/technician-subscribe` mengembalikan `{skipped:true}` untuk `admin_user` tanpa menyimpan ke DB.
  - **Fix**: Tambah model `adminPushSubscription` di schema Prisma → tabel `admin_push_subscriptions`. Route kini menyimpan subscription admin ke tabel ini.
  - **New functions di push-notification.service.ts**: `upsertAdminPushSubscription()`, `removeAdminPushSubscription()`, `getAdminSubscriptions()`
  - **Files**: `prisma/schema.prisma`, `src/server/services/push-notification.service.ts`, `src/app/api/push/technician-subscribe/route.ts`, `src/app/api/push/technician-unsubscribe/route.ts`

- **Fix: Dashboard teknisi pakai model ticket** (`1602b7e`, `ed3619b`, April 10, 2026)
  - Dashboard menggunakan `work_orders` yang sudah dihapus. Dimigrasi ke model `ticket`.
  - **Files**: `src/app/technician/dashboard/page.tsx`

- **Feat: GitHub Actions auto-deploy** (`e195e4f`, April 2026)
  - Workflow `.github/workflows/deploy.yml` → auto SSH ke VPS, jalankan `bash scripts/update.sh`, saat push ke `master`.

- **Feat: Toggle push notif sidebar teknisi** (`d0a97ec`, April 2026)
  - `SidebarPushToggle` komponen di `TechnicianPortalLayout.tsx` — selalu tampil, state ON/OFF jelas.
  - Mendukung silent sync: saat portal dibuka, jika browser punya push sub aktif, langsung sync ke DB.

- **Feat: Dispatch tiket ke semua teknisi via WA + push** (`1eb9358`, April 2026)
  - Saat tiket baru dibuat/di-assign, broadcast WA + push notification ke semua teknisi aktif.

- **Fix: update.sh auto-rebuild standalone** (`8ee6c03`, April 2026)
  - Jika `.next/standalone/server.js` hilang, build dipaksa otomatis.
  - API check mengembalikan `needsBuild: true`, UI tampilkan tombol "Rebuild Now".

### Push Notification Architecture (Web Push / VAPID)

> **PENTING**: Sistem push ini menggunakan **Web Push API** (VAPID), **BUKAN** Firebase Cloud Messaging (FCM).
> `fcmTokens` field di `pppoeUser` adalah untuk mobile app Flutter terpisah — tidak terkait dengan sistem push ini.

- **VAPID Keys**: Di `.env`: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_CONTACT_EMAIL`
- **Service Worker**: `/public/sw.js` — event `push` → `showNotification()`, `notificationclick` → buka URL PWA
- **Scope**: SW didaftarkan dengan `scope: '/'` via `navigator.serviceWorker.register('/sw.js', { scope: '/' })`

#### Tabel Push Subscriptions (4 tabel):

| Tabel | Portal | Route Registrasi |
|-------|--------|-----------------|
| `push_subscriptions` | Customer | `POST /api/push/subscribe` (Bearer token dari localStorage) |
| `technician_push_subscriptions` | Teknisi | `POST /api/push/technician-subscribe` (cookie `technician-token`, type `technician`) |
| `admin_push_subscriptions` | Admin via portal teknisi | `POST /api/push/technician-subscribe` (cookie `technician-token`, type `admin_user`) |
| `agent_push_subscriptions` | Agent | `POST /api/push/agent-subscribe` |

#### Cara Kerja Subscribe (Teknisi/Admin):
1. SidebarPushToggle memanggil `fetch('/api/push/technician-subscribe', { credentials: 'same-origin', ... })`
2. Cookie `technician-token` dikirim otomatis → API baca JWT
3. Jika `payload.type === 'admin_user'` → simpan ke `adminPushSubscription`
4. Jika `payload.type === 'technician'` → simpan ke `technicianPushSubscription`
5. **WAJIB `credentials: 'same-origin'`** — tanpa ini, cookie tidak terkirim → subscription gagal

#### Silent Sync:
- Saat portal dibuka, jika browser masih punya push subscription aktif, langsung re-register ke DB (mengatasi DB restore atau tabel dikosongkan).
- Customer: `usePushNotification.ts` → `refresh()` → `fetch('/api/push/subscribe', { Authorization: Bearer ... })`
- Teknisi/Admin: `TechnicianPortalLayout.tsx` → `SidebarPushToggle.refresh()` → `fetch('/api/push/technician-subscribe', { credentials: 'same-origin', ... })`



- **Redesign UI: Modern Clean Blue/Indigo theme** (`6ec9783`, April 5, 2026)
  - Seluruh halaman login (admin, technician, customer, agent/`agent/page.tsx`) didesain ulang dari cyberpunk/neon ke tampilan modern bersih.
  - `globals.css`: CSS variables diperbarui — dark mode navy bg + blue primary; light mode blue-600 primary; dark mode neon remap dihapus.
  - `CyberButton.tsx`: semua warna neon (cyan/pink/yellow/green) → blue/indigo/emerald palette.
  - **Files**: `globals.css`, `admin/login/page.tsx`, `technician/login/page.tsx`, `customer/login/page.tsx`, `agent/page.tsx`, `CyberButton.tsx`

- **Fix: VPN Client — VPS IP field hanya manual** (`910cddd`, `5049e02`, April 5, 2026)
  - Auto-fill VPS IP sekarang skip domain name (Cloudflare-proxied): regex check `/^\d+\.\d+\.\d+\.\d+$/`.
  - VPS IP di halaman VPN Client menjadi input manual penuh — tidak lagi menarik domain dari API `/api/network/vps-info`.
  - **Files**: `src/app/api/network/vps-info/route.ts`, `src/app/admin/network/vpn-client/page.tsx`

- **Fix: `scripts/update.sh` — hardening static copy** (`7c85dd3`, April 5, 2026)
  - Sebelumnya `cp -r .next/static .next/standalone/.next/static 2>/dev/null || true` — kegagalan copy diabaikan.
  - Sekarang: `mkdir -p .next/standalone/.next/static && cp -r .next/static/. .next/standalone/.next/static/ || err "..."` — abort jika gagal, tidak ada nesting bug.
  - **Why it matters**: jika static copy gagal lalu pm2 reload jalan, app bisa serve halaman tanpa CSS/JS.

### Recent Patch Log (April 2026 — WhatsApp Wablas, Kirimi.id & Broadcast)

- **Fix: Wablas send gagal — endpoint salah** (`e8bdf6b`, April 5, 2026)
  - **Root cause**: `sendViaWablas()` menggunakan `POST /api/v2/send-message` (JSON body) dengan header `Authorization`. Endpoint v2 tidak tersedia di semua server Wablas.
  - **Fix**: Ganti ke `GET /api/send-message?token=TOKEN.SECRET_KEY&phone=...&message=...&flag=instant` sesuai docs Wablas `#send-text`.
  - Format API key di DB: `token.secret_key` (titik sebagai separator) — diisi langsung di query param `token`.
  - **Files**: `whatsapp.service.ts`, `providers/[id]/test/route.ts`, `providers/page.tsx`

- **Fix + Feat: Kirimi.id provider sepenuhnya berfungsi** (`11bc666`, `b7e0544`, April 5, 2026)
  - **Root cause**: Endpoint salah `/send-message` → harusnya `/v1/send-message`. Field penerima salah `number` → harusnya `receiver`. Kedua bug didapat dari screenshot docs resmi Kirimi.id v2.0.
  - **Fix**: Endpoint `/v1/send-message`, field `receiver`, strip trailing slash di `provider.apiUrl`.
  - **Files**: `whatsapp.service.ts`, `providers/[id]/test/route.ts`

- **Feat: Kirimi.id native broadcast** (`fa136f1`, `f4b3d4c`, April 5, 2026)
  - `sendBroadcast()` ditambahkan ke `WhatsAppService` — untuk Kirimi.id pakai `/v1/broadcast-message`, provider lain loop satu-per-satu.
  - 1 penerima otomatis fallback ke `/v1/send-message` (Kirimi.id tidak menerima broadcast 1 nomor).
  - Pesan dengan konten identik dikelompokkan dalam 1 API call. Delay 30 detik (rekomendasi resmi).
  - **Files**: `whatsapp.service.ts`, `broadcast/route.ts`

- **Fix: Per-provider error detail & HTTP status** (`b7e0544`, April 5, 2026)
  - `sendMessage()` tidak lagi throw saat semua provider gagal — return `{success:false, error, attempts}` agar detail per provider bisa sampai ke UI.
  - HTTP status catch block diubah 502 → 500.
  - Toast di halaman Send sekarang menampilkan error spesifik per provider.
  - **Files**: `whatsapp.service.ts`, `send/route.ts`

- **Fix: Broadcast response format** (`f4b3d4c`, April 5, 2026)
  - Route `POST /api/whatsapp/broadcast` sekarang return `successCount` dan `failCount` di top-level.
  - Sebelumnya frontend toast menampilkan `✅ undefined | ❌ undefined`.

- **Feat: Webhook endpoint pesan masuk** (`d2ff368`, `48a213d`, April 4, 2026)
  - Buat `src/app/api/whatsapp/webhook/route.ts` untuk terima pesan masuk dari Kirimi.id, Wablas, Fonnte, WAHA.
  - Pesan dicatat ke `whatsapp_history` dengan `status: incoming`.
  - Panel webhook URL + tombol copy di halaman providers.

### WhatsApp Kirimi.id — Setup & Known Facts

- **Base URL**: `https://api.kirimi.id`
- **API Key format**: `user_code:secret` (pisah dengan titik dua)
- **Sender Number field** = **Device ID** (format `D-XXXXX`)
- **Send endpoint**: `POST https://api.kirimi.id/v1/send-message`
  - Body: `{user_code, secret, device_id, receiver, message}`
- **Broadcast endpoint**: `POST https://api.kirimi.id/v1/broadcast-message`
  - Body: `{user_code, secret, device_id, label, numbers: [...], message, delay: 30}`
  - Minimal 2 nomor. 1 nomor → pakai send endpoint.
- **Status "menunggu"** di dashboard = normal, pesan dalam antrian.

### Recent Patch Log (April 2026 — Isolasi, CoA, PPPoE)

- **Fix: Isolasi manual PPPoE — radusergroup dioverwrite saat edit user** (`958fc3a`, April 2, 2026)
  - **Root cause**: `updatePppoeUser` di `pppoe.service.ts` selalu menjalankan RADIUS re-sync saat ada edit data user (username/password/profile/ip/router), dan **selalu** menulis ulang `radusergroup = profile.groupName` tanpa memeriksa status user. Jika user diisolir lalu admin membuka form edit dan save (tanpa mengubah status), `radusergroup` dikembalikan ke profile aslinya (`paket 5mbps` dll), sehingga user lolos isolir.
  - **Fix** (`pppoe.service.ts`): RADIUS re-sync sekarang memeriksa `effectiveStatus` (status baru jika diubah, atau status saat ini). Perilaku per status:
    - `isolated` → tulis `Cleartext-Password` + `radusergroup = 'isolir'`, tanpa `Framed-IP-Address`
    - `blocked` / `stop` → tabel RADIUS sudah dikosongkan sebelumnya — jangan re-insert apapun
    - `active` → sync penuh (password + profile group + static IP)
  - **Fix** (`coa-handler.service.ts`): tambahkan `-d /usr/share/freeradius` ke perintah `radclient disconnect` (sama seperti fix `coa.service.ts` sebelumnya) agar MikroTik vendor dictionary dimuat dan Disconnect-Request valid.

- **Fix: CoA / Disconnect ke MikroTik selalu gagal — route VPN hilang** (April 2, 2026, VPS config)
  - **Root cause**: `/etc/ppp/ip-up.d/99-vpn-routes` punya bug variabel: `VPN_SUBNET=$10.20.30.0/24` → bash membaca `$10` (positional arg ke-10, selalu kosong) + `.20.30.0/24`. Route `10.20.30.0/24` via ppp0 tidak pernah ditambahkan otomatis → VPS tidak bisa reach `10.20.30.12` (MikroTik) → semua CoA/disconnect gagal.
  - **Fix**: Script ditulis ulang dengan `VPN_SUBNET=10.20.30.0/24` sebagai variabel terpisah, dan digunakan sebagai `${VPN_SUBNET}` di semua perintah. Script tersimpan di `production/99-vpn-routes` untuk referensi fresh install.
  - **Note**: Route aktual di VPS ditambahkan manual via `ip route add 10.20.30.0/24 via 10.20.30.1 dev ppp0 metric 100`. Script ip-up menangani otomatisasi di reconnect.

- **Fix: setup-isolir menggunakan hardcoded IP pool dan rate limit** (`cb91699`)
  - `setup-isolir/route.ts` sebelumnya hardcode `pool-isolir` range `10.255.255.2-10.255.255.254`, rate `64k/64k`, gateway `10.255.255.1`.
  - Fix: baca `isolationIpPool` + `isolationRateLimit` dari DB company, gunakan `getCidrRange()` untuk hitung range dan gateway.

- **Fix: 9739 duplicate rows di radgroupreply** (`cb91699`)
  - `freeradius-health.ts` menggunakan `INSERT IGNORE` untuk `Mikrotik-Group` dan `Framed-Pool` pada tabel `radgroupreply`. Karena tidak ada UNIQUE constraint, setiap health check menambah baris baru → 9739 duplikat terakumulasi.
  - Fix: ganti ke pola `DELETE + INSERT` untuk semua 3 atribut isolir (`Mikrotik-Rate-Limit`, `Mikrotik-Group`, `Framed-Pool`).
  - DB production dibersihkan, sekarang 4 baris bersih.

- **Fix: CoA "Bad Requests=133, Acks=0" — MikroTik vendor dict tidak dimuat** (`b2fe4fa`)
  - `radclient` di `coa.service.ts` tidak punya flag `-d /usr/share/freeradius` → `Mikrotik-Rate-Limit` dikirim tanpa vendor ID → MikroTik reject semua request sebagai "Bad Request".
  - Fix: tambahkan `-d /usr/share/freeradius` ke `executeRadclient()` di `coa.service.ts`.
  - Verified: CoA-ACK diterima dari MikroTik setelah fix.

- **Fix: footerAgent tidak tersimpan ke database** (`2adef92`)
  - `footerAgent` ada di CREATE query tapi tidak di UPDATE query di `/api/company/route.ts`.

- **Fix: Footer login agent hardcode fallback** (`f70967f`)
  - `agent/page.tsx` punya fallback `"Powered by ${poweredBy}"` yang dihardcode — dihapus.

---

### Recent Patch Log (March 2026)

- **Fix: billingDay reset to 1 on edit + MikroTik local-address verification** (`53688ee`, `28183d6`, March 28, 2026)
  - **Root cause**: `UserDetailModal.tsx` (the ACTUAL edit modal) had `user.subscriptionType || 'PREPAID'` — wrong default. POSTPAID users showed PREPAID view, hiding billing day field entirely, always resetting it to 1.
  - **Fix 1 (UserDetailModal.tsx)**: `subscriptionType: user.subscriptionType ?? 'POSTPAID'` and `billingDay: user.billingDay ?? new Date(user.expiredAt).getDate()` (infer from expiredAt when billingDay is null).
  - **Fix 2 (users/page.tsx handleEdit)**: same `??` nullish coalescing fixes (fallback to SimpleModal add form, minor but fixed).
  - **Fix 3 (pppoe.service.ts createPppoeUser)**: clamp billingDay to 1-28 (matches DB CHECK constraint; was 1-31).
  - **Enhancement (sync-mikrotik/route.ts)**: after syncing local-address to RouterOS PPP profile, now reads back the profile to verify the value was stored. Shows actionable warning if RouterOS didn't persist it — RouterOS requires the IP to be configured as an interface address first.
  - **Key architecture note**: `UserDetailModal.tsx` is the REAL edit dialog (`isOpen={isDialogOpen && !!editingUser}`). `SimpleModal` with `isOpen={isDialogOpen && !editingUser}` is the ADD form only — completely separate.

- **Fix: NAS IP, billingDay/expiredAt, Area badge & form — PPPoE UI revamp** (`1a6d30e`, `a33d8d0`, `f3fd754`)
  - **Network column** di tabel PPPoE: label "IP:" diganti "IP NAS:", nilai diubah dari `user.ipAddress` (IP statis user) menjadi `user.router?.ipAddress ?? user.router?.nasname` (IP rekap router NAS dari DB). IP statis user tetap di kolom PPPoE.
  - **updatePppoeUser service**: saat edit user POSTPAID dengan billingDay berubah, `expiredAt` kini di-recalculate ke tanggal tagihan bulan depan (`billingDay`). Sebelumnya `expiredAt` di-overwrite langsung dari nilai form tanpa memperhitungkan logika billingDay POSTPAID. Untuk PREPAID: `expiredAt` tetap ikut nilai form.
  - **Kolom Data Pelanggan**: badge Area (kuning, ikon MapPin) ditampilkan di bawah info pelanggan. Sebelumnya area tidak ditampilkan sama sekali di tabel.
  - **Form Tambah Pelanggan** (`SimpleModal`): tambah select Area (opsional) setelah NAS select. State `formData.areaId` sudah ada tapi tidak ada elemen UI-nya.
  - **Action buttons** (Phase 15): 5 ikon bersih — Eye, Pencil, RefreshCw, Shield, Trash. API `POST /api/pppoe/users/[userId]/sync-radius` dibuat untuk sync RADIUS per-user. Badge customerId & jumlah langganan bisa diklik sebagai filter.
  - **PPN calculation** (Phase 16): formula `ppnAmount = round(base * ppn/100)` diterapkan konsisten di 9 file billing. Koordinat GPS bisa diklik ke Google Maps.

- **Fix: Ghost sessions filtered from display and RADIUS authorize** (`4e89616`)
  - `sessions/route.ts`: tambah `.filter()` sebelum `.map()` — skip session yang tidak ada di `pppoeUser` maupun `hotspotVoucher`.
  - `authorize/route.ts`: pengguna tidak terdaftar sekarang dikembalikan REJECT (`control:Auth-Type = Reject`) bukan `{}` (allow).

- **Fix: Dashboard hotspot count cross-ref ke hotspotVoucher** (`57db2e6`)
  - `dashboard/stats/route.ts`: counter `activeSessionsHotspot` hanya naik jika username ada di tabel `hotspotVoucher`.
  - Tambah `Promise.all` lookup `hotspotVoucherSet` bersamaan dengan `pppoeByUsername`.
  - Sesi yang tidak terdaftar di table manapun (ghost) sepenuhnya diabaikan dari hitungan.

- **Fix: Next.js prerender crash pada `/_global-error`** (`bc3086c`)
  - Buat `src/app/global-error.tsx` sebagai `'use client'` component dengan `<html>/<body>` tags.
  - Tanpa file ini, Next.js 16 auto-generate `/_global-error` yang crash saat prerender dengan `TypeError: Cannot read properties of null (reading 'useContext')`.

- **Fix: Customer WiFi page padding** (`027749e`)
  - Semua `CyberCard` di `src/app/customer/wifi/page.tsx` kini punya `p-4 sm:p-5` eksplisit.
  - Container wrapper menggunakan `p-4 sm:p-5 lg:p-6 space-y-4 sm:space-y-5`.

- **Chore: Cleanup npm scripts + cross-platform deploy wrapper** (`9101c90`, `d646116`)
  - Restore `scripts/scan-api-endpoints.js` dan `scripts/test-all-apis.js` yang hilang.
  - Fix path deploy dari `bash smart-deploy.sh` → `bash production/smart-deploy.sh`.
  - Buat `scripts/run-deploy.js` — wrapper cross-platform; di Windows menampilkan panduan WSL/Git Bash; di Linux/macOS meneruskan ke `production/smart-deploy.sh`.
  - Tambah `npm run clean:local` dan `clean:all` untuk membersihkan `.next`, tsbuildinfo, dll.
  - Tidy `.gitignore`: hapus duplikat, hapus entry `/.git/`, rapikan per section.

- **Enhancement: Manual agent deposit with transfer proof + target admin account**
  - Agent manual top-up sekarang memilih rekening tujuan admin dari `company.bankAccounts` (API: `/api/company/info`).
  - Modal top-up agent menambahkan input transfer manual lengkap: rekening tujuan, nama/nomor rekening pengirim, catatan, dan upload bukti transfer.
  - Bukti transfer diproses via endpoint existing `/api/upload/payment-proof` lalu disimpan pada request manual.
  - Admin page verifikasi deposit agent (`/admin/hotspot/agent/deposits`) kini menampilkan rekening tujuan transfer, data pengirim, catatan, dan link bukti transfer.
  - API yang diperbarui:
    - `POST /api/agent/deposit/manual-request`
    - `GET/PATCH /api/admin/agent-deposits`
    - `GET /api/company/info` (tambahan `bankAccounts`)
  - Schema update `agentDeposit`:
    - `targetBankName`, `targetBankAccountNumber`, `targetBankAccountName`
    - `senderAccountName`, `senderAccountNumber`
    - `receiptImage`, `note`
  - Migration: `prisma/migrations/20260318120000_add_agent_manual_deposit_fields/migration.sql`

- **Fix: MapPicker z-index behind form modal**
  - `MapPicker` membuat `fixed` overlay tanpa `createPortal`, sehingga ancestor layout (sidebar, transform) membentuk stacking context yang menjebak z-index-nya di bawah `SimpleModal` portal.
  - Fix: tambah `createPortal(jsx, document.body)` pada return `MapPicker` agar render di root level (sama seperti `SimpleModal`).
  - File: `src/components/MapPicker.tsx`
  - Mempengaruhi: tambah/edit pelanggan PPPoE (`/admin/pppoe/users`), fiber joint closures, ODCs, dan semua halaman yang menggunakan `MapPicker` di atas form modal.

- **Refactor: Hapus bahasa Inggris — full Bahasa Indonesia only**
  - Hapus `src/locales/en.json` dan `src/components/LanguageSwitcher.tsx`.
  - Simplifikasi `useTranslation` hook: hardcode locale `'id'`, hapus English fallback, hapus import `en.json`.
  - Hapus tombol language toggle dari: Admin layout, Agent login, Agent layout, Customer layout, Technician layout.
  - Hapus import `Globe` yang tidak terpakai lagi di beberapa layout.
  - `store.ts`: locale type disederhanakan menjadi `'id'` only.
  - Hook `useTranslation` tetap mengembalikan `{ t, locale, setLocale, isID, isEN }` untuk kompatibilitas 131 file caller (setLocale jadi no-op, isEN selalu false).

- **System Update hardening (admin `/admin/system`)**
  - Fix spawn stdio issue (`fd: null`) by using `openSync` for log fd.
  - Resolve standalone `process.cwd()` mismatch with `getAppDir()` for system info/update routes.
  - Sanitize spawn environment to avoid PM2/Next inherited vars breaking `next build`.
  - Stabilize SSE live log stream with heartbeat + anti-buffering headers + auto reconnect.
  - Update script now uses zero-downtime `pm2 reload EugineBill-radius` (cron tetap restart).

- **Fix: Nginx manifest 404 (final fix)** (`bca095f`, March 29, 2026)
  - **Root cause 1**: nginx `alias` directive with regex location + `try_files` is fundamentally broken — nginx cannot resolve try_files paths correctly with alias in regex locations.
  - **Root cause 2**: `cp -r public .next/standalone/public/` creates nested `public/public/` when target dir already exists (Next.js creates `.next/standalone/public/` during build).
  - **Fix**: All nginx manifest/sw.js/pwa blocks now use `root /var/www/EugineBill-radius/public;` (matching production VPS). No `alias`, no `try_files`, no `@nextjs` named locations.
  - **Fix**: `cp -r public .next/standalone/public/` → `cp -r public/. .next/standalone/public/` (copy contents, not directory) in install-pm2.sh and fix-pwa-nginx.sh.
  - Files changed: `vps-install/install-nginx.sh`, `vps-install/install-pm2.sh`, `vps-install/fix-pwa-nginx.sh`, `production/nginx-EugineBill-radius.conf`
  - Verified: `curl -I http://192.168.54.200/manifest-admin.json` → 200 OK

- **Fix: Earlier nginx manifest attempt (superseded)** (`914d8c4`, `940f194`)
  - First attempt used `alias` + `try_files` — broken in nginx with regex locations.
  - `fix-pwa-nginx.sh` created but had same bugs. Fully rewritten in `bca095f`.

- **UI spacing polish (admin cards)**
  - Push Notifications page: explicit `CardHeader`/`CardContent` paddings, refined icon-title gaps.
  - Additional consistency fixes applied on Manual Payments and Network Trace pages.

- **Fix: Hotspot profile modal i18n key** (`f8e5702`)
  - Key `hotspot.eVoucherAccess` (capital V) → `hotspot.evoucherAccess` (lowercase) di `src/app/admin/hotspot/profile/page.tsx`.
  - Locale files sudah benar (`evoucherAccess`) — hanya pemanggil di page.tsx yang salah casing.

- **Fix: Dashboard SESI HOTSPOT AKTIF selalu 0** (`667b158`)
  - Hapus pengecekan RADIUS attrs (`service.includes('framed')`) yang menyebabkan hotspot MikroTik (mengirim `Service-Type = Framed-User`) salah diklasifikasi sebagai PPPoE.
  - Ganti ke logika sederhana: lookup `pppoeUser` → PPPoE, selainnya → Hotspot (sama seperti halaman Sesi).
  - Tambah Redis `online:users` sebagai supplement agar sesi yang belum masuk `radacct` tetap terhitung.
  - File: `src/app/api/dashboard/stats/route.ts`

---

## 🖥️ Production VPS

| Item | Value |
|------|-------|
| IP | `YOUR_VPS_IP` |
| OS | Ubuntu 22.04.1 LTS |
| App Path | `/var/www/EugineBill-radius` |
| Domain | `https://radius.yourdomain.com` (Cloudflare proxy) |
| Node.js | 20.20.1 |
| MySQL | 8.0.45 |
| PM2 | 6.0.14 |
| FreeRADIUS | 3.0.26 |

**PM2 Apps:**
- `EugineBill-radius` — Next.js app (cluster mode, port 3000)
- `EugineBill-cron` — Cron service (fork mode)

**Database:**
- DB Name: `EugineBill_radius`
- User: `EugineBill_user` / Password: `YOUR_DB_PASSWORD`
- Root password: `YOUR_ROOT_PASSWORD`

**Default Login:**
- URL: `https://radius.yourdomain.com/login`
- Username: `superadmin`
- Password: `admin123`

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router + Turbopack) |
| Language | TypeScript |
| Styling | Tailwind CSS + shadcn/ui + Radix UI |
| Database | MySQL 8.0 + Prisma ORM v6 |
| Auth | next-auth v4, bcryptjs, JWT |
| RADIUS | FreeRADIUS 3.0.26 (MySQL + REST) |
| Jobs | node-cron (via `cron-service.js`) |
| Icons | Lucide React |
| Maps | Leaflet / OpenStreetMap |
| Charts | Recharts |
| Payments | Midtrans, Xendit, Duitku, Tripay |
| Integrations | MikroTik RouterOS API, GenieACS TR-069, Firebase Admin, Nodemailer, WhatsApp |
| Timezone | WIB / Asia/Jakarta (UTC+7) |

---

## 🏗️ Architecture

```
src/
├── app/
│   ├── admin/          # Admin panel (5 role templates)
│   ├── agent/          # Agent/reseller portal
│   ├── customer/       # Customer self-service portal
│   ├── technician/     # Technician portal (route group: (portal)/)
│   ├── coordinator/    # Coordinator portal
│   └── api/            # Thin API route handlers
├── server/             # Server-only code
│   ├── db/             # Prisma client
│   ├── services/       # Business logic
│   ├── jobs/           # Cron job functions
│   ├── cache/          # Redis utilities
│   ├── auth/           # next-auth config
│   └── middleware/     # Request middleware
├── features/           # Vertical slices (queries, schemas, types per domain)
├── components/         # Shared UI components only
├── lib/                # Pure utilities + re-export proxies (migration artifacts)
├── hooks/              # Custom React hooks
├── locales/            # i18n translations (id, en)
└── types/              # Shared TypeScript types
```

**Important rule:** `src/app/api/` handlers must be thin — validate → call service → respond. No business logic directly in route handlers.

---

## 🔑 Key Rules & Known Issues

### 1. `cron-service.js` (root)
Standalone Node.js process launched by PM2. Calls HTTP API endpoints at `localhost:3000`. **DO NOT change this to import server code directly.** PM2 entrypoint.

### 2. Technician portal route structure
Route group pattern: `src/app/technician/(portal)/[page]/page.tsx`  
There was a duplicate `technician/dashboard/page.tsx` (outside group) — **already deleted**.  
Always use `(portal)/` group for all technician pages.

### 3. FreeRADIUS mods-enabled = standalone files, NOT symlinks
On this VPS, `mods-enabled/sql` and `sites-enabled/default` are **standalone files**, not symlinks.  
The install script copies files directly. Do not assume symlink behavior.

### 4. Prisma migrations vs db push
Fresh VPS install uses `prisma db push --accept-data-loss` (not `prisma migrate deploy`), because migrations assume pre-existing tables (`nas`).

### 5. Environment variable `TZ=Asia/Jakarta`
**Critical** — set in `ecosystem.config.js` and `.env`. Without this, all cron jobs and date calculations will be wrong.

### 6. `src/lib/` = re-export proxies
Old location. New canonical code is in `src/server/services/` and `src/server/jobs/`. `src/lib/` files just re-export for backward compatibility.

### 7. Both `upload/` and `uploads/` API routes exist
`src/app/api/upload/` and `src/app/api/uploads/` — both present for backward compat.

### 8. Windows development note
Scripts in `vps-install/*.sh` have UTF-8 BOM when created on Windows. Run `sed -i 's/^\xef\xbb\xbf//' script.sh` to strip BOM before executing on VPS.

### 9. VPS install must run from app directory
`install-freeradius.sh` and other VPS scripts call `check_directory()` which requires CWD to contain "EugineBill-radius". Always run from `/var/www/EugineBill-radius`.

### 10. UFW was previously configured but not auto-enabled
Installer lama hanya menambahkan rule `ufw allow`, tetapi tidak menjalankan `ufw enable`. Current installer fix:
- auto-detect SSH port aktif (`22` atau custom seperti `2020`)
- allow SSH + `80/tcp` + `443/tcp`
- set `default deny incoming`, `default allow outgoing`
- run `ufw --force enable`
- skip only for Proxmox LXC (`SKIP_UFW=true`)

### 11. Web app inaccessible on Proxmox VM usually means NAT / public edge issue, not app issue
If inside guest `ss -tulpn` shows Node.js on `:3000` and Nginx on `:80`/`:443`, but public IP still fails:
- `:2020` is SSH/custom admin port, not web app URL
- problem is usually DNAT / router / Proxmox firewall / provider security group
- guest-side `ufw inactive` is not the same as host-side NAT missing
- installer now includes external access diagnostics in `install-nginx.sh`

### 12. Redis installer needed production hardening
Redis failure pattern seen in production: `redis-server.service` crash-loop after install. Current installer fix ensures:
- `bind 127.0.0.1 ::1`
- `protected-mode yes`
- `supervised systemd`
- `daemonize no`
- runtime/log/data directories exist with `redis:redis`
- restart failure prints `systemctl status`, `journalctl`, and Redis log tail

### 13. VPN route ke MikroTik WAJIB ada untuk CoA/disconnect berfungsi
VPS terhubung ke MikroTik via L2TP/PPP VPN di interface `ppp0`. VPS IP: `10.20.30.10`, MikroTik: `10.20.30.12`.
Route `10.20.30.0/24` HARUS ada di routing table VPS agar CoA packet bisa reach MikroTik.  
Script `/etc/ppp/ip-up.d/99-vpn-routes` menambahkan route otomatis saat ppp0 connect.  
Jika CoA selalu gagal (No Route / timeout), cek: `ip route show | grep 10.20.30`  
Fix manual: `ip route add 10.20.30.0/24 via 10.20.30.1 dev ppp0 metric 100`

### 14. `radusergroup` WAJIB ditulis `isolir` saat user diisolir, bukan profile group asli
`updatePppoeUser` di `pppoe.service.ts` punya logika `effectiveStatus` yang menentukan isi radusergroup:
- `isolated` → groupname = `'isolir'`, no Framed-IP-Address
- `blocked`/`stop` → jangan insert apapun ke RADIUS tables
- `active` → groupname = profile.groupName, restore Framed-IP-Address

Jika ada bug isolir (user tetap dapat profil normal setelah isolasi), cek apakah edit user via form admin tidak sengaja meng-override radusergroup.

### 15. Payment callback pages must support both `token` and `order_id`
Real-world issue: top-up success page received `order_id=TOPUP-TEMP-...` and showed `payment.paymentNotFound`.
Current fix:
- top-up direct flow now creates invoice first, then uses stable `orderId = invoice.invoiceNumber`
- added `GET /api/payment/check-order` to resolve invoice/deposit status from `order_id`
- `payment/success`, `payment/pending`, `payment/failed` now handle `order_id` fallback
- added alias pages: `/payment/failure` and `/payment/cancel`
- webhook now marks invoice `CANCELLED` for `expire|cancel|deny|failed`

---

## 🚀 Completed Features (by version)

| Version | Feature |
|---------|---------|
| v2.10.27 | Restructuring complete (5 phases), technician portal (11 pages + 19 API routes) |
| v2.10.x | Customers page → table layout redesign |
| v2.9.x | L2TP VPN client control, MikroTik CHR support |
| v2.8.0 | Balance/deposit system, auto-renewal prepaid, RADIUS restore on renewal |
| v2.7.6 | GenieACS TR-069 device management, WiFi configuration from portal |
| v2.7.2 | Broadcast notifications, template pages mobile responsive, maintenance resolved template |
| v2.7.0 | Manual payment upload + approval workflow, multiple bank accounts, customer ID |
| v2.6.x | PPPoE isolation system, isolation templates (WhatsApp/Email/HTML) |
| v2.5.x | Agent/reseller system, voucher commission tracking |
| v2.4.x | CoA service (real-time disconnect), auto-disconnect cronjob |
| v2.3.1 | Multi-timezone support, WIB/WITA/WIT |
| v2.2.x | FTTH network (OLT/ODC/ODP), network map, GPS coordinates |
| v2.1.x | Full RADIUS mode (radacct sessions, no MikroTik API) |
| v2.0.x | FreeRADIUS integration, SQL + REST modules |

---

## 📦 Database Schema Summary

**~45 Prisma models.** Key models:

| Model | Purpose |
|-------|---------|
| `User` | Admin users + roles + permissions |
| `Customer` | ISP customers (PPPoE/Hotspot) |
| `Voucher` | Hotspot vouchers |
| `Invoice` | Billing invoices |
| `Transaction` | Financial transactions |
| `Router` / `Nas` | MikroTik routers |
| `Agent` | Reseller/agent accounts |
| `Olt` / `Odc` / `Odp` | FTTH network topology |
| `radcheck` / `radreply` | FreeRADIUS auth tables |
| `radacct` | RADIUS accounting/sessions |
| `radpostauth` | RADIUS auth logs |
| `CronJobExecution` | Cron history |
| `ActivityLog` | Admin activity audit |
| `Setting` | App settings (key-value) |
| `NotificationTemplate` | WhatsApp/Email templates |

---

## 🔧 Common Commands

```bash
# Development
npm run dev              # Start Next.js dev server (Turbopack)
npm run build            # Production build
npx tsc --noEmit         # TypeScript check (must = 0 errors)
npm run lint             # ESLint
npm run test:run         # Vitest (must pass)
npm run test:api         # Smoke test public API endpoints
npm run test:scan        # Scan & document all API endpoints → API_ENDPOINTS.md
npm run clean:local      # Remove .next, tsconfig.tsbuildinfo, coverage, .turbo, .cache
npm run clean:all        # clean:local + remove console.log (cleanup)
npm run deploy           # Run production/smart-deploy.sh (bash required)
npm run deploy:quick     # Quick deploy (build + PM2 restart)
npm run deploy:full      # Full deploy (install deps + build + restart)
npm run deploy:status    # Check deploy status
npm run deploy:rollback  # Rollback last deploy

# Database
npx prisma db push       # Sync schema to DB (fresh install)
npx prisma migrate dev   # Create migration (development)
npx prisma studio        # DB browser
npm run db:seed          # Run all seeds (tsx prisma/seeds/seed-all.ts)

# PM2 (on VPS)
pm2 status               # Check all apps
pm2 logs EugineBill-radius # App logs
pm2 restart EugineBill-radius --update-env
pm2 restart EugineBill-cron

# FreeRADIUS (on VPS)
systemctl status freeradius
freeradius -X            # Debug mode (verbose)
freeradius -CX           # Config test only
radtest user pass localhost 0 testing123  # Test auth

# VPS Install scripts (run from /var/www/EugineBill-radius)
bash /tmp/vps-install/install-freeradius.sh
bash /tmp/vps-install/install-nodejs.sh
```

---

## 📡 FreeRADIUS Architecture

```
MikroTik (NAS) → FreeRADIUS → MySQL (radcheck/radreply/radgroupreply)
                            ↓
                   REST API (/api/radius/*)
                            ↓
                   - /api/radius/authorize  → check user status
                   - /api/radius/post-auth  → set firstLoginAt, expiresAt
                   - /api/radius/accounting → update Redis online-users
```

**Config files location:** `/etc/freeradius/3.0/`
- `mods-enabled/sql` — MySQL connection (standalone file)
- `mods-enabled/rest` — REST API integration (symlink → mods-available/rest)
- `sites-enabled/default` — Auth logic (standalone file)
- `sites-available/coa` — CoA/Disconnect (symlink)
- `clients.conf` — NAS clients + `$INCLUDE clients.d/`
- `clients.d/nas-from-db.conf` — Auto-generated NAS from DB

**Project backup:** `freeradius-config/` directory in repo root.

---

## 🌐 Portals Summary

| Portal | URL | Users |
|--------|-----|-------|
| Admin | `/admin` | SUPER_ADMIN, FINANCE, CS, TECHNICIAN, MARKETING, VIEWER |
| Customer | `/customer` | ISP customers |
| Agent | `/agent` | Resellers/agents |
| Technician | `/technician` | Field technicians |
| Coordinator | `/coordinator` | Area coordinators |

---

## 🌍 Translations / i18n

Files in `src/locales/`:
- `id.json` — Indonesian (satu-satunya bahasa)

Bahasa Inggris (`en.json`) sudah dihapus. Semua UI menggunakan Bahasa Indonesia.
Hook `useTranslation()` tetap digunakan di 131+ file, hanya saja locale hardcoded ke `'id'`.
Language switcher sudah dihapus dari semua portal (Admin, Agent, Customer, Technician).

---

## 📁 Important Files

| File | Purpose |
|------|---------|
| `ecosystem.config.js` → `production/ecosystem.config.js` | PM2 config (deployed to `/var/www/EugineBill-radius/`) |
| `cron-service.js` | Cron PM2 entrypoint (root) |
| `prisma/schema.prisma` | Database schema |
| `prisma/seeds/seed-all.ts` | Run all seeds |
| `src/instrumentation.ts` | Next.js instrumentation hook |
| `vps-install/` | VPS installer scripts |
| `freeradius-config/` | FreeRADIUS config backup |
| `production/nginx-EugineBill-radius.conf` | Nginx config template |

---

## 🔐 Security Notes

- `.env` is gitignored — never commit real credentials
- `.env.example` and `.env.production.example` are safe templates
- Firebase service account files are gitignored (`*firebase-service-account*.json`)
- RADIUS `testing123` secret is for local testing only — change in production `clients.conf`
- `require_message_authenticator = no` set for localhost client (compatibility)

---

## 📝 Recent Changes (March 2026)

- ✅ Customers page redesigned to table layout (from card grid)
- ✅ Deleted duplicate `src/app/technician/dashboard/page.tsx`
- ✅ FreeRADIUS installed and running on VPS
- ✅ GitHub repo made public
- ✅ Removed: `chk-pg.js`, `kill-ports.ps1`, `start-dev.ps1` (debug/dev-only files)
- ✅ VPS fully deployed: Node.js 20, MySQL 8.0.45, Redis, Nginx, PM2, FreeRADIUS 3.0.26
- ✅ DB seeded: superadmin, templates, 19 ticket categories, email templates, isolation templates
- ✅ **Network/Fiber Management Translation Audit & Fixes:**
  - Expanded `network.tracing` from 3 keys to full 41-key set covering `PathTracerTool`, `TraceResultDisplay`, `ImpactAnalysisPanel` components
  - Expanded `network.jointClosure` from 1 key to full 34-key set for CRUD labels
  - Added complete Indonesian translations for both sections in `id.json`
  - All other network section keys also added: `network.diagram.*`, `network.unifiedMap.*`, `common.created`, `common.updated`
- ✅ **New Pages Created (fiber management routes):**
  - `/admin/network/fiber-joint-closures` — Full CRUD management for `network_joint_closures` model (uses `/api/network/joint-closures` API)
  - `/admin/network/fiber-odcs` — Redirect to `/admin/network/odcs`
  - `/admin/network/fiber-odps` — Redirect to `/admin/network/odps`

---

## � Recent Changes (April 2026)

### Customer Invoice Print Dialog (commit `32a01d9`, `2218fe6`)
- **New file**: `src/lib/invoice-print.ts` — shared print helper with `printInvoiceStandard(invoiceId, toast)` and `printInvoiceThermal(invoiceId, toast)`; both call `/api/invoices/${invoiceId}/pdf`
- **`src/app/customer/history/page.tsx`** — added print dialog via `SimpleModal`:
  - State: `const [printDialogPayment, setPrintDialogPayment] = useState<PaymentHistory | null>(null)`
  - Print button now opens modal instead of calling API directly
  - Dialog buttons: "Cetak Standard A4" (Standard A4) and "Cetak Thermal 58/80mm"
  - Imports added: `SimpleModal, ModalHeader, ModalTitle, ModalDescription, ModalBody, ModalFooter, ModalButton` from `@/components/cyberpunk`; `printInvoiceStandard, printInvoiceThermal` from `@/lib/invoice-print`
  - Full restore from `d875dcc` required (earlier patch had corrupted file — merged `handleSubmitOfflinePayment` body into `handlePrintThermal`, eating 13 state declarations and 7 handler functions)
- **`src/app/customer/invoices/page.tsx`** — same print dialog pattern

### Customer WiFi / GenieACS TR-069 Fixes (commit `ffd53d7`)
- **`src/app/api/customer/wifi/route.ts`** — 4 bugs fixed:
  1. **Missing SSIDs**: Only WLANs with non-empty SSID names were included — ONTs with blank SSID but active devices were silently excluded. Fix: `include if hasValidSsid || assocCount > 0`
  2. **Band detection**: Was using unreliable `index >= 5` heuristic. Fix: Channel > 14 is authoritative 5GHz indicator; also checks `'n5'`/`'5ghz'` standard strings
  3. **assocCount accuracy**: Was using TR-069 `TotalAssociations` field (unreliable). Fix: count actual `AssociatedDevice` child entries; use `Math.max(TotalAssociations, actualCount)`
  4. **`associatedDevice` field**: Was storing SSID name string (could duplicate across SSIDs). Fix: now stores `String(wlan.index)` — WLAN index — enables reliable per-SSID device grouping on frontend
- **`src/app/customer/wifi/page.tsx`** — removed standalone flat "Connected Devices" section at page bottom; each WLAN card now shows its own devices inline, filtered by `h.associatedDevice === String(wlan.index)`

### Customer Dashboard WiFi Multi-SSID (commit `073f372`)
- **`src/app/customer/page.tsx`** — WiFi section rewritten:
  - `editingWifi: boolean` → `editingWifi: number | null` (stores WLAN index being edited, null = not editing)
  - Was showing only `wlanConfigs?.[0]` with hardcoded `wlanIndex: 1`; now iterates all `wlanConfigs`
  - Each SSID renders its own card with SSID name + band badge (2.4GHz / 5GHz)
  - Each SSID has its own Edit button → sets `editingWifi = wlan.index`; form sends `wlanIndex: editingWifi ?? 1`
  - Connected devices grouped per SSID: `connectedDevices.filter(d => d.associatedDevice === String(wlan.index))`

---

## �🗺️ Network/Fiber Management Routes

| Route | Description |
|-------|-------------|
| `/admin/network/fiber-cables` | Fiber cable management (GPON/ADSS etc.) |
| `/admin/network/fiber-cores` | Fiber core management |
| `/admin/network/splice-points` | Splice point management |
| `/admin/network/fiber-joint-closures` | Joint Closure (JC) CRUD — new, uses `network_joint_closures` model |
| `/admin/network/fiber-odcs` | Redirect → `/admin/network/odcs` |
| `/admin/network/fiber-odps` | Redirect → `/admin/network/odps` |
| `/admin/network/odcs` | ODC management (Optical Distribution Cabinet) |
| `/admin/network/odps` | ODP management (Optical Distribution Point) |
| `/admin/network/olts` | OLT management |
| `/admin/network/diagrams` | Network splitter diagrams (links to fiber-joint-closures/odcs/odps) |
| `/admin/network/trace` | Network path tracing (logical + physical) |
| `/admin/network/unified-map` | Unified network map |
| `/admin/network/infrastruktur` | Infrastructure overview |
| `/admin/network/map` | Network map |

