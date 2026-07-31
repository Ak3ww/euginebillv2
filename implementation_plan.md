# Rencana Implementasi: Anti-Spam & Proteksi Duplikasi Invoice

Berdasarkan pengecekan mendalam terhadap sistem `cron` dan pengiriman WhatsApp, berikut adalah rencana arsitektur untuk memastikan sistem berjalan sempurna (zero spam & zero duplicate).

## User Review Required

> [!IMPORTANT]
> Saat ini, 53 tagihan yang belum terkirim WA **TIDAK AKAN otomatis terkirim sekarang** kecuali mereka bertepatan dengan jadwal pengingat (Reminder H-X atau H+X) yang diset di pengaturan pengingat tagihan, ATAU Bapak menekan tombol "Kirim WA" secara manual dari halaman Audit WA.
> 
> **Pertanyaan**: Apakah Bapak ingin 53 tagihan ini dikirimkan sekarang melalui halaman Audit WA (dengan menekan "Kirim ke X Pelanggan Unsent"), ATAU biarkan saja sistem pengingat otomatis (cron) yang mengirimkannya pada H-3 / H-1 sebelum jatuh tempo?

## Proposed Changes

### 1. Database Level Protection (Zero Duplicate Invoices)
Saat ini pengecekan duplikasi hanya dilakukan di level kode/aplikasi (di `generateInvoices`). Jika terjadi *race condition* (2 proses berjalan bersamaan), tagihan ganda bisa tercipta. 
**Solusi**:
- Menambahkan *Unique Constraint* di skema database (Prisma) agar satu User tidak bisa memiliki lebih dari satu tagihan `PENDING` atau `OVERDUE` secara bersamaan, atau membatasi pembuatan invoice ganda untuk periode yang sama.

### 2. WhatsApp Anti-Spam & Rate Limiter
Sistem `rateLimiter.ts` sudah ada dengan batas **5 pesan per 10 detik** (30 pesan per menit). Ini sudah cukup aman dari blokir WhatsApp. Namun, kita harus memastikan tidak ada pesan yang terkirim ganda ke nomor yang sama di hari yang sama.
**Solusi**:
- Menambahkan pengecekan *cache* sementara (menggunakan Memory atau SQLite sementara) sebelum `WhatsAppService.sendMessage` dipanggil, untuk memblokir jika nomor yang sama dikirimi pesan tagihan dalam rentang waktu 5 menit terakhir.
- Memperketat `WhatsAppService` agar selalu mencatat histori (`whatsapp_history`) dengan status `pending` *sebelum* pesan dikirim, dan mengupdate-nya menjadi `success`/`failed` *setelah* dikirim, agar tidak ada *race condition* cron yang mengirim ulang pesan yang sedang diproses.

### 3. Cron Job Safety
Cron pengirim tagihan (`sendInvoiceReminders`) berjalan setiap jam untuk mengecek apakah waktu (jam & menit) cocok dengan `targetHour` di pengaturan.
**Solusi**:
- Menambahkan *lock mechanism* yang lebih ketat agar jika cron sedang berjalan dan mengirim 1000 antrean, cron jam berikutnya tidak akan memproses data yang sama.

#### [MODIFY] `prisma/schema.prisma`
- Menambahkan unique constraint/index untuk mencegah duplikasi invoice.

#### [MODIFY] `src/server/services/notifications/whatsapp-templates.service.ts`
- Menambahkan proteksi *debounce*/anti-spam 5 menit per nomor untuk pengiriman tagihan.

#### [MODIFY] `src/server/jobs/voucher-sync.ts`
- Menambahkan filter ketat pada `sendInvoiceReminders` untuk memastikan tidak ada spam.

## Verification Plan

### Automated Tests
- Mensimulasikan pemanggilan `generateInvoices` dua kali bersamaan, memastikan hanya 1 tagihan yang terbuat.
- Mensimulasikan pemanggilan `sendInvoiceReminders` ganda untuk melihat apakah sistem anti-spam memblokir pesan kedua.

### Manual Verification
- Memeriksa halaman riwayat WhatsApp untuk melihat tidak ada pesan beruntun yang terkirim di menit yang sama untuk pelanggan yang sama.
