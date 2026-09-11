# Panduan Kontribusi EugineBill RADIUS

Terima kasih atas minat Anda untuk berkontribusi pada pengembangan **EugineBill RADIUS**!

## Standar Kode & Aturan Pengembangan

1. **Strictly No Text Emojis**:
   Dilarang keras menggunakan text emoji unicode (seperti 🌐, 🚀, 🟢, 🔴, ⚡) pada teks antarmuka di seluruh portal (Admin, Customer, Technician). Selalu gunakan icon komponen resmi dari **Lucide React** (`<Wifi />`, `<Globe />`, `<Zap />`, dll).

2. **Zero Hardcoded Secrets**:
   Dilarang melakukan hardcoding domain, IP publik, atau kredensial database di dalam kode. Seluruh rujukan harus membaca konfigurasi dari `company` database atau variabel `.env`.

3. **Dokumentasi Wajib ("Tulis yang dikerjakan, kerjakan yang ditulis")**:
   Setiap fitur baru, perbaikan bug, atau perubahan arsitektur wajib dicatat di:
   - `CHANGELOG.md` pada root project (mengikuti format *Keep a Changelog*).
   - Dokumen panduan teknis pada folder `docs/`.

4. **Preservasi File Upload**:
   Seluruh fitur unggah berkas wajib menulis ke penyimpanan persisten menggunakan `getUploadDir(...)` dari `@/lib/upload-dir` (`/var/data/EugineBill/uploads/`). Dilarang menyimpan file upload runtime di dalam folder project atau `public/uploads`.

5. **Verifikasi Build Sebelum Commit**:
   Pastikan kompilasi build sukses 100% tanpa error sebelum mengajukan Pull Request:
   ```bash
   npm run build
   ```
