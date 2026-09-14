# Sistem Batas Ketat Maksimal 3 Pesan WhatsApp per Siklus Penagihan

## Ringkasan Eksekutif
Sistem ini dirancang untuk mencegah spamming pesan WhatsApp ke pelanggan, dengan menerapkan **aturan ketat maksimal 3 pesan total per siklus penagihan**:
1. **Pesan 1:** Pengingat invoice pertama sebelum jatuh tempo (default: H-6).
2. **Pesan 2:** Pengingat invoice kedua sebelum jatuh tempo (default: H-1).
3. **Pesan 3:** Notifikasi isolasi yang dikirimkan pada **H+7 setelah pelanggan diisolir**.
4. **Tidak ada pesan overdue harian:** Seluruh array hardcoded pengingat beruntun harian (hari 1 s/d 28) telah dihapus.
5. **Akuntansi Pengiriman ("Gagal Tidak Termasuk, Gagal Boleh Ulang")**: Pesan berstatus gagal (status === 'failed') tidak memotong kuota dan otomatis dicoba ulang oleh cron hingga berhasil. Begitu sukses terkirim (status === 'sent'), pesan tersebut dicatat permanen dan dihitung ke kuota limit.

---

## Arsitektur & Alur Kerja

\\\mermaid
flowchart TD
    A[Siklus Tagihan Dimulai] --> B[Cron H-6: Kirim Invoice Reminder 1]
    B -->|Sukses: Status 'sent'| C[Tercatat Pesan 1/3]
    B -->|Gagal: Status 'failed'| B1[Kuota Tetap Utuh, Cron Jam Berikutnya Coba Ulang]
    C --> D[Cron H-1: Kirim Invoice Reminder 2]
    D -->|Sukses: Status 'sent'| E[Tercatat Pesan 2/3]
    D -->|Gagal: Status 'failed'| D1[Kuota Tetap Utuh, Cron Jam Berikutnya Coba Ulang]
    E --> F{Jatuh Tempo H0: Sudah Bayar?}
    F -->|Ya| G[Layanan Tetap Aktif, Siklus Selesai]
    F -->|Tidak| H[Pelanggan Diisolir Teknis di MikroTik/RADIUS]
    H --> I[Pesan WA Isolasi DITAHAN / DEFERRED]
    I --> J{Hari H+7 Isolasi Tercapai?}
    J -->|Belum H+7| K[Tetap Terisolir, Tanpa Notifikasi WA]
    J -->|H+7 Tercapai| L{Sudah Pernah Terima WA Isolir?}
    L -->|Ya / Kuota 3 Tercapai| M[Lewati - Tidak Kirim Pesan Tambahan]
    L -->|Belum| N[Kirim Notifikasi WA Isolir - Pesan 3/3]
    N -->|Sukses: Status 'sent'| O[Tercatat Pesan 3/3 - HARD STOP]
    N -->|Gagal: Status 'failed'| P[Cron Jam Berikutnya Mencoba Ulang]
\\\

---

## Konfigurasi Database (\whatsapp_reminder_settings\)

Tabel \whatsapp_reminder_settings\ menyimpan aturan dinamis:

| Kolom | Tipe | Default | Keterangan |
| :--- | :--- | :--- | :--- |
| \eminderDays\ | TEXT (JSON) | \"[-6, -1]"\ | Array hari pengingat invoice sebelum jatuh tempo (maksimal 2 item). |
| \eminderTime\ | VARCHAR | \"09:00"\ | Waktu pengiriman cron (WIB). |
| `isolationDelayDays` | INT | `7` | Jeda hari setelah isolir sebelum pesan isolasi dikirimkan (H+7). |
| `maxInvoiceReminders` | INT | `2` | Kuota maksimal pengingat invoice sebelum jatuh tempo (mode ketat = 2, fleksibel = 99). |
| `maxTotalMessagesPerCycle` | INT | `3` | Batas total pesan WhatsApp sukses per siklus penagihan (mode ketat = 3, fleksibel = 99). |
| `batchSize` | INT | `10` | Ukuran kelompok pesan terkirim per batch. |
| `batchDelay` | INT | `120` | Jeda istirahat antar batch dalam detik (anti-banned). |
| `randomize` | BOOLEAN | `true` | Mengaktifkan pengacakan urutan antrean pesan (Fisher-Yates shuffle). |

### Mode Operasional: Strict vs Flexible Quota
Sistem kini mendukung toggle `strictQuotaEnabled`:
- **Mode Aman / Anti-Spam (`strictQuotaEnabled = true`)**:
  - `maxInvoiceReminders = 2` dan `maxTotalMessagesPerCycle = 3`.
  - `reminderDays` dibatasi maksimal 2 entri dan bernilai `<= 0` (hanya sebelum jatuh tempo, misal H-6 dan H-1).
  - Menjaga reputasi nomor pengirim WhatsApp agar terhindar dari pemblokiran atau penandaan spam.
- **Mode Fleksibel / Bebas Kuota (`strictQuotaEnabled = false`)**:
  - `maxInvoiceReminders = 99` dan `maxTotalMessagesPerCycle = 99`.
  - `reminderDays` bebas diatur tanpa batasan jumlah entri dan dapat mencakup hari sebelum (`< 0`) maupun sesudah jatuh tempo (`> 0`).
  - Quota checks per siklus dilewati sehingga tidak memblokir pesan pengingat lanjutan.

---

## Modul & File Terkait

1. **`src/server/jobs/voucher-sync.ts` (`sendInvoiceReminders`)**:
   - Membaca konfigurasi `batchSize` dan `batchDelay` dari database dan meneruskannya ke `sendWithRateLimit` serta `estimateSendTime`.
   - Mengacak antrean pesan dengan *Fisher-Yates shuffle* jika `settings.randomize === true`.
   - Menghormati batasan kuota: Jika mode fleksibel (`maxTotalMessagesPerCycle >= 99`), kuota pesan per siklus tidak memblokir pengiriman.
   - Rollback atomik pada kegagalan pengiriman agar pengulangan (retry) diizinkan.

2. **`src/app/api/whatsapp/reminder-settings/route.ts`**:
   - Menangani `GET` dan `PUT` untuk `strictQuotaEnabled`.
   - Memastikan `batchSize`, `batchDelay`, `randomize`, dan `strictQuotaEnabled` selalu dipersist dan dikembalikan.

3. **`src/app/admin/whatsapp/notifications/page.tsx`**:
   - Admin UI interaktif dengan switch toggle aturan ketat (Mode Aman vs Mode Fleksibel).
   - Formulir pengaturan batch anti-banned dengan kalkulasi estimasi waktu pengiriman otomatis.
   - Standar Shadcn UI & Lucide React tanpa emoji teks.

4. **`src/server/jobs/auto-isolation.ts` (`sendIsolationNotification` & `sendPendingIsolationNotifications`)**:
   - Menahan pengiriman WA saat isolir awal pada hari H jika pelanggan belum mencapai `isolationDelayDays` (H+7).
   - Memeriksa seluruh pelanggan berstatus `isolated` setiap jam via `sendPendingIsolationNotifications()` untuk mengirim pesan tepat saat hari H+7 tiba.
   - Menghentikan pengiriman jika pesan isolir sudah pernah sukses terkirim atau kuota total 3 pesan siklus telah tercapai dalam mode ketat.

5. **`src/server/jobs/pppoe-sync.ts` (`autoIsolatePPPoEUsers`)**:
   - Menjalankan isolasi teknis ke MikroTik/RADIUS dan memicu `sendPendingIsolationNotifications()` di setiap putaran cron.
