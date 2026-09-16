import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';
import { prisma } from '@/server/db/client';
import { ok, unauthorized, serverError } from '@/lib/api-response';

const SEED_TEMPLATES = [
  {
    category: 'MOU',
    name: 'Template MOU Kerja Sama',
    bodyHtml: `<div style="font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: auto;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h2 style="text-transform: uppercase; letter-spacing: 2px;">MEMORANDUM OF UNDERSTANDING (MOU)</h2>
    <p>Nomor: <strong>{{nomor_dokumen}}</strong></p>
  </div>
  <p>Pada hari <strong>{{hari}}</strong>, tanggal <strong>{{tanggal}}</strong>, di <strong>{{kota}}</strong>, telah disepakati Perjanjian Kerja Sama antara:</p>
  <br/>
  <p><strong>PIHAK PERTAMA</strong><br/>
  Nama: {{nama_pihak_pertama}}<br/>
  Jabatan: {{jabatan_pihak_pertama}}<br/>
  Alamat: {{alamat_pihak_pertama}}</p>
  <br/>
  <p><strong>PIHAK KEDUA</strong><br/>
  Nama: {{nama_pihak_kedua}}<br/>
  Jabatan: {{jabatan_pihak_kedua}}<br/>
  Alamat: {{alamat_pihak_kedua}}</p>
  <br/>
  <p>Kedua pihak sepakat untuk bekerja sama sesuai dengan ketentuan yang telah disepakati bersama.</p>
  <br/><br/>
  <div style="display: flex; justify-content: space-between; margin-top: 60px;">
    <div style="text-align: center;">
      <p>Pihak Pertama,</p><br/><br/><br/>
      <p><strong>{{nama_pihak_pertama}}</strong></p>
      <p>{{jabatan_pihak_pertama}}</p>
    </div>
    <div style="text-align: center;">
      <p>Pihak Kedua,</p><br/><br/><br/>
      <p><strong>{{nama_pihak_kedua}}</strong></p>
      <p>{{jabatan_pihak_kedua}}</p>
    </div>
  </div>
</div>`,
    fieldsSchema: [
      { key: 'nama_pihak_pertama', label: 'Nama Pihak Pertama', type: 'text' },
      { key: 'jabatan_pihak_pertama', label: 'Jabatan Pihak Pertama', type: 'text' },
      { key: 'alamat_pihak_pertama', label: 'Alamat Pihak Pertama', type: 'textarea' },
      { key: 'nama_pihak_kedua', label: 'Nama Pihak Kedua', type: 'text' },
      { key: 'jabatan_pihak_kedua', label: 'Jabatan Pihak Kedua', type: 'text' },
      { key: 'alamat_pihak_kedua', label: 'Alamat Pihak Kedua', type: 'textarea' },
      { key: 'kota', label: 'Kota', type: 'text' },
      { key: 'hari', label: 'Hari', type: 'text' },
      { key: 'tanggal', label: 'Tanggal', type: 'date' },
    ],
  },
  {
    category: 'FAK',
    name: 'Template Faktur Layanan',
    bodyHtml: `<div style="font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: auto; border: 1px solid #ddd;">
  <div style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px;">
    <h2>FAKTUR</h2>
    <p>No: <strong>{{nomor_dokumen}}</strong></p>
    <p>Tanggal: {{tanggal}}</p>
  </div>
  <p><strong>Kepada Yth:</strong><br/>
  {{nama_pelanggan}}<br/>
  {{alamat}}</p>
  <br/>
  <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
    <tr style="background: #f5f5f5;">
      <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Keterangan</th>
      <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Jumlah</th>
    </tr>
    <tr>
      <td style="border: 1px solid #ddd; padding: 8px;">{{keterangan_layanan}}</td>
      <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">Rp {{jumlah}}</td>
    </tr>
  </table>
  <br/>
  <p>Terbilang: <em>{{terbilang}}</em></p>
</div>`,
    fieldsSchema: [
      { key: 'nama_pelanggan', label: 'Nama Pelanggan', type: 'text' },
      { key: 'alamat', label: 'Alamat', type: 'textarea' },
      { key: 'keterangan_layanan', label: 'Keterangan Layanan', type: 'textarea' },
      { key: 'jumlah', label: 'Jumlah (Rp)', type: 'number' },
      { key: 'terbilang', label: 'Terbilang', type: 'text' },
      { key: 'tanggal', label: 'Tanggal', type: 'date' },
    ],
  },
  {
    category: 'KWT',
    name: 'Template Kwitansi Pembayaran',
    bodyHtml: `<div style="font-family: Arial, sans-serif; padding: 40px; max-width: 700px; margin: auto; border: 2px solid #333;">
  <h2 style="text-align: center; border-bottom: 1px solid #333; padding-bottom: 10px;">KWITANSI</h2>
  <p>No: <strong>{{nomor_dokumen}}</strong></p>
  <table style="width: 100%; margin-top: 20px;">
    <tr><td style="width: 180px; padding: 6px;">Telah diterima dari</td><td>: <strong>{{nama}}</strong></td></tr>
    <tr><td style="padding: 6px;">Jumlah</td><td>: <strong>Rp {{jumlah}}</strong></td></tr>
    <tr><td style="padding: 6px;">Terbilang</td><td>: <em>{{terbilang}}</em></td></tr>
    <tr><td style="padding: 6px;">Untuk keperluan</td><td>: {{keperluan}}</td></tr>
  </table>
  <div style="text-align: right; margin-top: 40px;">
    <p>{{tanggal}}</p><br/><br/><br/>
    <p>___________________________</p>
    <p>Penerima</p>
  </div>
</div>`,
    fieldsSchema: [
      { key: 'nama', label: 'Nama Pembayar', type: 'text' },
      { key: 'jumlah', label: 'Jumlah (Rp)', type: 'number' },
      { key: 'terbilang', label: 'Terbilang', type: 'text' },
      { key: 'keperluan', label: 'Keperluan', type: 'textarea' },
      { key: 'tanggal', label: 'Tanggal', type: 'date' },
    ],
  },
  {
    category: 'SJ',
    name: 'Template Surat Jalan',
    bodyHtml: `<div style="font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: auto;">
  <div style="text-align: center; margin-bottom: 20px;">
    <h2>SURAT JALAN</h2>
    <p>No: <strong>{{nomor_dokumen}}</strong> | Tanggal: {{tanggal}}</p>
  </div>
  <table style="width: 100%; margin-bottom: 20px;">
    <tr><td style="width: 160px;">Pengirim</td><td>: {{pengirim}}</td></tr>
    <tr><td>Tujuan</td><td>: {{tujuan}}</td></tr>
    <tr><td>Keterangan</td><td>: {{keterangan}}</td></tr>
  </table>
  <table style="width: 100%; border-collapse: collapse;">
    <tr style="background: #f5f5f5;">
      <th style="border: 1px solid #ddd; padding: 8px;">No</th>
      <th style="border: 1px solid #ddd; padding: 8px;">Daftar Barang / Peralatan</th>
    </tr>
    <tr>
      <td style="border: 1px solid #ddd; padding: 8px;">1</td>
      <td style="border: 1px solid #ddd; padding: 8px;">{{daftar_barang}}</td>
    </tr>
  </table>
  <div style="display: flex; justify-content: space-between; margin-top: 60px;">
    <div style="text-align: center;"><p>Pengirim,</p><br/><br/><br/><p>{{pengirim}}</p></div>
    <div style="text-align: center;"><p>Penerima,</p><br/><br/><br/><p>( ______________ )</p></div>
  </div>
</div>`,
    fieldsSchema: [
      { key: 'tujuan', label: 'Tujuan Pengiriman', type: 'text' },
      { key: 'pengirim', label: 'Nama Pengirim', type: 'text' },
      { key: 'daftar_barang', label: 'Daftar Barang / Peralatan', type: 'textarea' },
      { key: 'tanggal', label: 'Tanggal', type: 'date' },
      { key: 'keterangan', label: 'Keterangan', type: 'textarea' },
    ],
  },
  {
    category: 'BAST',
    name: 'Template BAST Serah Terima',
    bodyHtml: `<div style="font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: auto;">
  <div style="text-align: center; margin-bottom: 20px;">
    <h2>BERITA ACARA SERAH TERIMA</h2>
    <p>No: <strong>{{nomor_dokumen}}</strong></p>
  </div>
  <p>Pada hari ini tanggal <strong>{{tanggal}}</strong>, bertempat di <strong>{{lokasi}}</strong>, telah dilaksanakan serah terima antara:</p>
  <br/>
  <p><strong>Pihak yang Menyerahkan:</strong><br/>Nama: {{nama_penyerah}}<br/>Jabatan: {{jabatan_penyerah}}</p>
  <br/>
  <p><strong>Pihak yang Menerima:</strong><br/>Nama: {{nama_penerima}}<br/>Jabatan: {{jabatan_penerima}}</p>
  <br/>
  <p>Adapun yang diserahterimakan adalah:</p>
  <p>{{daftar_item}}</p>
  <br/>
  <div style="display: flex; justify-content: space-between; margin-top: 60px;">
    <div style="text-align: center;"><p>Yang Menyerahkan,</p><br/><br/><br/><p><strong>{{nama_penyerah}}</strong></p><p>{{jabatan_penyerah}}</p></div>
    <div style="text-align: center;"><p>Yang Menerima,</p><br/><br/><br/><p><strong>{{nama_penerima}}</strong></p><p>{{jabatan_penerima}}</p></div>
  </div>
</div>`,
    fieldsSchema: [
      { key: 'nama_penerima', label: 'Nama Penerima', type: 'text' },
      { key: 'jabatan_penerima', label: 'Jabatan Penerima', type: 'text' },
      { key: 'nama_penyerah', label: 'Nama Yang Menyerahkan', type: 'text' },
      { key: 'jabatan_penyerah', label: 'Jabatan Yang Menyerahkan', type: 'text' },
      { key: 'daftar_item', label: 'Daftar Item yang Diserahkan', type: 'textarea' },
      { key: 'lokasi', label: 'Lokasi', type: 'text' },
      { key: 'tanggal', label: 'Tanggal', type: 'date' },
    ],
  },
  {
    category: 'SPK',
    name: 'Template SPK Surat Perintah Kerja',
    bodyHtml: `<div style="font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: auto;">
  <div style="text-align: center; margin-bottom: 20px;">
    <h2>SURAT PERINTAH KERJA (SPK)</h2>
    <p>No: <strong>{{nomor_dokumen}}</strong></p>
  </div>
  <p>Yang bertanda tangan di bawah ini menerangkan bahwa:</p>
  <table style="width: 100%; margin: 20px 0;">
    <tr><td style="width: 200px; padding: 6px;">Nama Teknisi</td><td>: <strong>{{nama_teknisi}}</strong></td></tr>
    <tr><td style="padding: 6px;">Jabatan</td><td>: {{jabatan}}</td></tr>
    <tr><td style="padding: 6px;">Lokasi Pekerjaan</td><td>: {{lokasi_pekerjaan}}</td></tr>
    <tr><td style="padding: 6px;">Tanggal Mulai</td><td>: {{tanggal_mulai}}</td></tr>
    <tr><td style="padding: 6px;">Tanggal Selesai</td><td>: {{tanggal_selesai}}</td></tr>
  </table>
  <p><strong>Deskripsi Pekerjaan:</strong></p>
  <p>{{deskripsi_pekerjaan}}</p>
  <div style="text-align: right; margin-top: 60px;">
    <p>Diketahui oleh,</p><br/><br/><br/>
    <p>___________________________</p>
    <p>Koordinator</p>
  </div>
</div>`,
    fieldsSchema: [
      { key: 'nama_teknisi', label: 'Nama Teknisi', type: 'text' },
      { key: 'jabatan', label: 'Jabatan', type: 'text' },
      { key: 'lokasi_pekerjaan', label: 'Lokasi Pekerjaan', type: 'text' },
      { key: 'deskripsi_pekerjaan', label: 'Deskripsi Pekerjaan', type: 'textarea' },
      { key: 'tanggal_mulai', label: 'Tanggal Mulai', type: 'date' },
      { key: 'tanggal_selesai', label: 'Tanggal Selesai', type: 'date' },
    ],
  },
];

// POST /api/admin/documents/seed-templates
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorized();

  try {
    const results: { category: string; name: string; action: string }[] = [];

    for (const tpl of SEED_TEMPLATES) {
      const existing = await prisma.documentTemplate.findFirst({
        where: { category: tpl.category, name: tpl.name },
      });

      if (existing) {
        results.push({ category: tpl.category, name: tpl.name, action: 'skipped (exists)' });
        continue;
      }

      await prisma.documentTemplate.create({
        data: {
          category: tpl.category,
          name: tpl.name,
          bodyHtml: tpl.bodyHtml,
          fieldsSchema: tpl.fieldsSchema,
          isActive: true,
        },
      });
      results.push({ category: tpl.category, name: tpl.name, action: 'created' });
    }

    return ok({ success: true, results });
  } catch (error: any) {
    console.error('POST /api/admin/documents/seed-templates error:', error);
    return serverError(error?.message || 'Failed to seed templates');
  }
}

// GET — also seed via GET for convenience (idempotent)
export async function GET(request: NextRequest) {
  return POST(request);
}