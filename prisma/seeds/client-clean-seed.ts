import { PrismaClient } from '@prisma/client';
import { seedAll } from './seed-all';
import { seedSkuDictionary } from './sku-dictionary';

const prisma = new PrismaClient();

// ── 1. Inventory Categories ──────────────────────────────────────────────────
const INVENTORY_CATEGORIES = [
  { code: 'HW',  name: 'Hardware Utama (HW)', description: 'Router, Switch, OLT, Server' },
  { code: 'CPE', name: 'Customer Equipment (CPE)', description: 'Modem ONT, STB, Access Point' },
  { code: 'PAS', name: 'Perangkat Pasif (PAS)', description: 'ODP, ODC, Closure, Splitter PLC/FBT' },
  { code: 'CAB', name: 'Kabel & Dropcore (CAB)', description: 'Kabel Precon, Dropwire, Patchcord, UTP' },
  { code: 'CON', name: 'Konektor & Aksesoris (CON)', description: 'Fast Connector, Adapter SC, Klem, Isolasi, HVS' },
  { code: 'PWR', name: 'Power & Adaptor (PWR)', description: 'Adaptor 12V, Mini UPS, POE Injector' },
  { code: 'TLS', name: 'Alat & Perkakas (TLS)', description: 'Fusion Splicer, Cleaver, Stripper, OPM, VFL' },
  { code: 'ACC', name: 'Aksesori Material (ACC)', description: 'Fishbone, Bracket ODP, Spiral, Kabel Tis' },
  { code: 'MKT', name: 'Materi Marketing (MKT)', description: 'Brosur PSB, Spanduk, Stiker ODP' },
  { code: 'SUP', name: 'Supplies Kantor (SUP)', description: 'Kertas HVS, Amplop, Kwitansi, ATK' },
];

// ── 2. Standard Master Items (7 ONT Vendors & FTTH Consumables) ─────────────
const STANDARD_MASTER_ITEMS = [
  // 1. ZTE (ZTEG)
  { sku: 'EMG-CPE-ONT-ZTE-F609V3', name: 'Modem ZTE F609 V3 Gigabit GPON', categoryCode: 'CPE', subCategory: 'ONT', unit: 'pcs', isSerialized: true },
  { sku: 'EMG-CPE-ONT-ZTE-F609V9', name: 'Modem ZTE F609 V9 Dual Band AC', categoryCode: 'CPE', subCategory: 'ONT', unit: 'pcs', isSerialized: true },
  { sku: 'EMG-CPE-ONT-ZTE-F670L',  name: 'Modem ZTE F670L Dual Band Gigabit AC1200', categoryCode: 'CPE', subCategory: 'ONT', unit: 'pcs', isSerialized: true },
  { sku: 'EMG-CPE-ONT-ZTE-F660',   name: 'Modem ZTE F660 Single Band GPON', categoryCode: 'CPE', subCategory: 'ONT', unit: 'pcs', isSerialized: true },
  // 2. Huawei (HWTC)
  { sku: 'EMG-CPE-ONT-HWA-8245H',  name: 'Modem Huawei EchoLife HG8245H GPON', categoryCode: 'CPE', subCategory: 'ONT', unit: 'pcs', isSerialized: true },
  { sku: 'EMG-CPE-ONT-HWA-8245A',  name: 'Modem Huawei EchoLife HG8245A GPON', categoryCode: 'CPE', subCategory: 'ONT', unit: 'pcs', isSerialized: true },
  { sku: 'EMG-CPE-ONT-HWA-8546M',  name: 'Modem Huawei HG8546M Single Band GPON', categoryCode: 'CPE', subCategory: 'ONT', unit: 'pcs', isSerialized: true },
  // 3. FiberHome (FHTT)
  { sku: 'EMG-CPE-ONT-FBH-6145F',  name: 'Modem FiberHome HG6145F Dual Band WiFi 5', categoryCode: 'CPE', subCategory: 'ONT', unit: 'pcs', isSerialized: true },
  { sku: 'EMG-CPE-ONT-FBH-6243C',  name: 'Modem FiberHome HG6243C Gigabit GPON', categoryCode: 'CPE', subCategory: 'ONT', unit: 'pcs', isSerialized: true },
  // 4. Skyworth (SKYW)
  { sku: 'EMG-CPE-ONT-SKW-V2802',  name: 'Modem Skyworth V2802RH XPON Hybrid', categoryCode: 'CPE', subCategory: 'ONT', unit: 'pcs', isSerialized: true },
  { sku: 'EMG-CPE-ONT-SKW-V2804',  name: 'Modem Skyworth V2804RFT XPON 4-Port', categoryCode: 'CPE', subCategory: 'ONT', unit: 'pcs', isSerialized: true },
  // 5. Realtek OEM (RLTK)
  { sku: 'EMG-CPE-ONT-RLT-V2801',  name: 'Modem Realtek OEM V2801SG XPON Bridge', categoryCode: 'CPE', subCategory: 'ONT', unit: 'pcs', isSerialized: true },
  { sku: 'EMG-CPE-ONT-RLT-V2804',  name: 'Modem Realtek OEM V2804RGW XPON', categoryCode: 'CPE', subCategory: 'ONT', unit: 'pcs', isSerialized: true },
  // 6. Gigalink / C-Data (GGCLINK)
  { sku: 'EMG-CPE-ONT-GGL-FD511G', name: 'Modem Gigalink / C-Data FD511G 1GE GPON', categoryCode: 'CPE', subCategory: 'ONT', unit: 'pcs', isSerialized: true },
  { sku: 'EMG-CPE-ONT-GGL-FD512G', name: 'Modem Gigalink FD512GW 1GE+1FE WiFi XPON', categoryCode: 'CPE', subCategory: 'ONT', unit: 'pcs', isSerialized: true },
  // 7. VSOL (AZVG)
  { sku: 'EMG-CPE-ONT-VSL-V2801',  name: 'Modem VSOL V2801SG 1GE XPON Bridge', categoryCode: 'CPE', subCategory: 'ONT', unit: 'pcs', isSerialized: true },
  { sku: 'EMG-CPE-ONT-VSL-V2804',  name: 'Modem VSOL V2804RGW 4GE Dual Band XPON', categoryCode: 'CPE', subCategory: 'ONT', unit: 'pcs', isSerialized: true },
  // Standard Dropcore Precon Roll Lengths
  { sku: 'EMG-CAB-DRP-1C-50M',     name: 'Kabel Dropcore 1 Core Precon 50 Meter', categoryCode: 'CAB', subCategory: 'DRP', unit: 'roll', isSerialized: false },
  { sku: 'EMG-CAB-DRP-1C-100M',    name: 'Kabel Dropcore 1 Core Precon 100 Meter', categoryCode: 'CAB', subCategory: 'DRP', unit: 'roll', isSerialized: false },
  { sku: 'EMG-CAB-DRP-1C-150M',    name: 'Kabel Dropcore 1 Core Precon 150 Meter', categoryCode: 'CAB', subCategory: 'DRP', unit: 'roll', isSerialized: false },
  { sku: 'EMG-CAB-DRP-1C-200M',    name: 'Kabel Dropcore 1 Core Precon 200 Meter', categoryCode: 'CAB', subCategory: 'DRP', unit: 'roll', isSerialized: false },
  { sku: 'EMG-CAB-DRP-1C-250M',    name: 'Kabel Dropcore 1 Core Precon 250 Meter', categoryCode: 'CAB', subCategory: 'DRP', unit: 'roll', isSerialized: false },
  { sku: 'EMG-CAB-DRP-1C-300M',    name: 'Kabel Dropcore 1 Core Precon 300 Meter', categoryCode: 'CAB', subCategory: 'DRP', unit: 'roll', isSerialized: false },
  // Consumables & Passive
  { sku: 'EMG-CON-FST-SCUPC',      name: 'Fast Connector SC/UPC Biru (Pack 10 pcs)', categoryCode: 'CON', subCategory: 'FST', unit: 'pack', isSerialized: false, packSize: 10 },
  { sku: 'EMG-CON-FST-SCAPC',      name: 'Fast Connector SC/APC Hijau (Pack 10 pcs)', categoryCode: 'CON', subCategory: 'FST', unit: 'pack', isSerialized: false, packSize: 10 },
  { sku: 'EMG-CON-ADP-SCUPC',      name: 'Adapter SC/UPC Simplex Biru', categoryCode: 'CON', subCategory: 'ADP', unit: 'pcs', isSerialized: false },
  { sku: 'EMG-PWR-ADP-12V1A',      name: 'Power Adaptor 12V 1A DC Jack Standar', categoryCode: 'PWR', subCategory: 'ADP', unit: 'pcs', isSerialized: false },
  { sku: 'EMG-PWR-ADP-12V15A',     name: 'Power Adaptor 12V 1.5A DC Jack Gigabit', categoryCode: 'PWR', subCategory: 'ADP', unit: 'pcs', isSerialized: false },
  { sku: 'EMG-ACC-FSH-STANDAR',    name: 'Fishbone / Clamp Buaya Penarik Dropcore', categoryCode: 'ACC', subCategory: 'FSH', unit: 'pcs', isSerialized: false },
  { sku: 'EMG-PAS-ODP-8P',         name: 'Kotak ODP 8 Port Lengkap Adapter & Splitter', categoryCode: 'PAS', subCategory: 'ODP', unit: 'unit', isSerialized: false },
  { sku: 'EMG-PAS-ODP-16P',        name: 'Kotak ODP 16 Port Lengkap Adapter & Splitter', categoryCode: 'PAS', subCategory: 'ODP', unit: 'unit', isSerialized: false },
  { sku: 'EMG-PAS-SPL-1X8-PLC',    name: 'Splitter Optik 1:8 PLC Cassette SC/UPC', categoryCode: 'PAS', subCategory: 'SPL', unit: 'pcs', isSerialized: false },
];

// ── 3. Document Numbering Rules ─────────────────────────────────────────────
const NUMBERING_RULES = [
  { category: 'MOU',  pattern: 'MOU/{DEPT}/{ROMAN_MM}/{YYYY}/{SEQ:3}', resetFrequency: 'yearly' },
  { category: 'FAK',  pattern: 'FAK/{DEPT}/{YYYY}{MM}/{SEQ:4}', resetFrequency: 'monthly' },
  { category: 'KWT',  pattern: 'KWT/{YYYY}{MM}/{SEQ:4}', resetFrequency: 'monthly' },
  { category: 'SJ',   pattern: 'SJ/LOG/{ROMAN_MM}/{YYYY}/{SEQ:4}', resetFrequency: 'yearly' },
  { category: 'BAST', pattern: 'BAST/{DEPT}/{YYYY}/{SEQ:3}', resetFrequency: 'yearly' },
  { category: 'SPK',  pattern: 'SPK/{YYYY}/{SEQ:4}', resetFrequency: 'none' },
];

// ── 4. Document Maker Templates ─────────────────────────────────────────────
const DOCUMENT_TEMPLATES = [
  {
    category: 'MOU',
    name: 'Template MOU Kerja Sama',
    bodyHtml: `<div style="font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: auto;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h2 style="text-transform: uppercase; letter-spacing: 2px;">MEMORANDUM OF UNDERSTANDING (MOU)</h2>
    <p>Nomor: <strong>{{nomor_dokumen}}</strong></p>
  </div>
  <p>Pada hari <strong>{{hari}}</strong>, tanggal <strong>{{tanggal}}</strong>, telah disepakati Perjanjian Kerja Sama antara:</p>
  <br/>
  <p><strong>PIHAK PERTAMA</strong><br/>Nama: {{nama_pihak_pertama}}<br/>Jabatan: {{jabatan_pihak_pertama}}<br/>Alamat: {{alamat_pihak_pertama}}</p>
  <br/>
  <p><strong>PIHAK KEDUA</strong><br/>Nama: {{nama_pihak_kedua}}<br/>Jabatan: {{jabatan_pihak_kedua}}<br/>Alamat: {{alamat_pihak_kedua}}</p>
  <br/>
  <p>Kedua pihak sepakat untuk bekerja sama sesuai dengan ketentuan layanan internet yang telah disepakati bersama.</p>
</div>`,
    fieldsSchema: [
      { key: 'nama_pihak_pertama', label: 'Nama Pihak Pertama', type: 'text' },
      { key: 'jabatan_pihak_pertama', label: 'Jabatan Pihak Pertama', type: 'text' },
      { key: 'alamat_pihak_pertama', label: 'Alamat Pihak Pertama', type: 'textarea' },
      { key: 'nama_pihak_kedua', label: 'Nama Pihak Kedua', type: 'text' },
      { key: 'jabatan_pihak_kedua', label: 'Jabatan Pihak Kedua', type: 'text' },
      { key: 'alamat_pihak_kedua', label: 'Alamat Pihak Kedua', type: 'textarea' },
      { key: 'hari', label: 'Hari', type: 'text' },
      { key: 'tanggal', label: 'Tanggal', type: 'date' },
    ],
  },
  {
    category: 'FAK',
    name: 'Template Faktur Tagihan ISP',
    bodyHtml: `<div style="font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: auto; border: 1px solid #ddd;">
  <div style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px;">
    <h2>FAKTUR TAGIHAN</h2>
    <p>No: <strong>{{nomor_dokumen}}</strong></p>
    <p>Tanggal: {{tanggal}}</p>
  </div>
  <p><strong>Kepada Yth:</strong><br/>{{nama_pelanggan}}<br/>{{alamat}}</p>
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
  <h2 style="text-align: center; border-bottom: 1px solid #333; padding-bottom: 10px;">KWITANSI PEMBAYARAN</h2>
  <p>No: <strong>{{nomor_dokumen}}</strong></p>
  <table style="width: 100%; margin-top: 20px;">
    <tr><td style="width: 180px; padding: 6px;">Telah diterima dari</td><td>: <strong>{{nama}}</strong></td></tr>
    <tr><td style="padding: 6px;">Jumlah Uang</td><td>: <strong>Rp {{jumlah}}</strong></td></tr>
    <tr><td style="padding: 6px;">Terbilang</td><td>: <em>{{terbilang}}</em></td></tr>
    <tr><td style="padding: 6px;">Untuk Pembayaran</td><td>: {{keperluan}}</td></tr>
  </table>
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
    name: 'Template Surat Jalan Material',
    bodyHtml: `<div style="font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: auto;">
  <div style="text-align: center; margin-bottom: 20px;">
    <h2>SURAT JALAN</h2>
    <p>No: <strong>{{nomor_dokumen}}</strong></p>
    <p>Tanggal: {{tanggal}}</p>
  </div>
  <p><strong>Kepada:</strong> {{tujuan}}</p>
  <p>Bersama surat ini dikirimkan barang/material sebagai berikut:</p>
  <p>{{daftar_barang}}</p>
</div>`,
    fieldsSchema: [
      { key: 'tujuan', label: 'Tujuan / Penerima', type: 'text' },
      { key: 'daftar_barang', label: 'Daftar Barang', type: 'textarea' },
      { key: 'tanggal', label: 'Tanggal', type: 'date' },
    ],
  },
  {
    category: 'BAST',
    name: 'Template BAST Instalasi Perangkat',
    bodyHtml: `<div style="font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: auto;">
  <div style="text-align: center; margin-bottom: 20px;">
    <h2>BERITA ACARA SERAH TERIMA (BAST)</h2>
    <p>No: <strong>{{nomor_dokumen}}</strong></p>
  </div>
  <p>Pada hari ini tanggal <strong>{{tanggal}}</strong>, telah diserahterimakan perangkat ONT/kabel dalam kondisi baik dan berfungsi normal kepada pelanggan:</p>
  <p><strong>Nama:</strong> {{nama_pelanggan}}<br/><strong>SN Perangkat:</strong> {{serial_number}}</p>
</div>`,
    fieldsSchema: [
      { key: 'nama_pelanggan', label: 'Nama Pelanggan', type: 'text' },
      { key: 'serial_number', label: 'Serial Number ONT', type: 'text' },
      { key: 'tanggal', label: 'Tanggal', type: 'date' },
    ],
  },
  {
    category: 'SPK',
    name: 'Template SPK Pasang Baru / Maintenance',
    bodyHtml: `<div style="font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: auto;">
  <div style="text-align: center; margin-bottom: 20px;">
    <h2>SURAT PERINTAH KERJA (SPK)</h2>
    <p>No: <strong>{{nomor_dokumen}}</strong></p>
  </div>
  <table style="width: 100%; margin: 20px 0;">
    <tr><td style="width: 200px; padding: 6px;">Nama Teknisi</td><td>: <strong>{{nama_teknisi}}</strong></td></tr>
    <tr><td style="padding: 6px;">Lokasi Pekerjaan</td><td>: {{lokasi_pekerjaan}}</td></tr>
    <tr><td style="padding: 6px;">Jenis Pekerjaan</td><td>: {{jenis_pekerjaan}}</td></tr>
  </table>
  <p><strong>Deskripsi Pekerjaan:</strong></p>
  <p>{{deskripsi_pekerjaan}}</p>
</div>`,
    fieldsSchema: [
      { key: 'nama_teknisi', label: 'Nama Teknisi', type: 'text' },
      { key: 'lokasi_pekerjaan', label: 'Lokasi Pekerjaan', type: 'text' },
      { key: 'jenis_pekerjaan', label: 'Jenis Pekerjaan (PSB / Maintenance)', type: 'text' },
      { key: 'deskripsi_pekerjaan', label: 'Deskripsi Pekerjaan', type: 'textarea' },
    ],
  },
];

// ── MAIN SEED ENTRYPOINT ────────────────────────────────────────────────────
export async function seedClientClean(force = false) {
  console.log('\n=============================================================');
  console.log('🌱 Starting EugineBill Client Clean Seeding (Master Catalogs)');
  console.log('   Strictly clean: Zero personal OLTs, Zero Routers, Zero Customers');
  console.log('=============================================================\n');

  // 1. Run core baseline seeds (Transaction Categories, Permissions, WA/Email, Isolir)
  console.log('1️⃣ Running Core System Baseline Seeds...');
  await seedAll(force);

  // 2. Run Dynamic SKU Dictionary Seeds
  console.log('2️⃣ Running Dynamic SKU Dictionary Seeds...');
  await seedSkuDictionary(prisma);

  // 3. Seed Inventory Categories
  console.log('3️⃣ Seeding Standard Inventory Categories...');
  const categoryMap: Record<string, string> = {};
  for (const cat of INVENTORY_CATEGORIES) {
    const record = await prisma.inventoryCategory.upsert({
      where: { name: cat.name },
      create: {
        name: cat.name,
        description: cat.description,
      },
      update: {
        description: cat.description,
      },
    });
    categoryMap[cat.code] = record.id;
  }
  console.log(`   ✅ ${Object.keys(categoryMap).length} Inventory Categories verified.\n`);

  // 4. Seed Standard Master Items (7 Vendor ONT, Dropcore, Fast Connectors)
  console.log('4️⃣ Seeding Standard Master Catalog Items (7 Vendor ONT & FTTH)...');
  let itemsCount = 0;
  for (const item of STANDARD_MASTER_ITEMS) {
    const categoryId = categoryMap[item.categoryCode] || null;
    await prisma.inventoryItem.upsert({
      where: { sku: item.sku },
      create: {
        sku: item.sku,
        name: item.name,
        categoryCode: item.categoryCode,
        subCategory: item.subCategory,
        categoryId,
        unit: item.unit,
        isSerialized: item.isSerialized,
        currentStock: 0,
        packSize: (item as any).packSize || null,
        isActive: true,
      },
      update: {
        name: item.name,
        categoryCode: item.categoryCode,
        subCategory: item.subCategory,
        ...(categoryId ? { categoryId } : {}),
      },
    });
    itemsCount++;
  }
  console.log(`   ✅ ${itemsCount} Master Catalog Items seeded.\n`);

  // 5. Seed Document Numbering Rules
  console.log('5️⃣ Seeding Document Numbering Rules...');
  for (const rule of NUMBERING_RULES) {
    await prisma.numberingRule.upsert({
      where: { category: rule.category },
      create: {
        category: rule.category,
        pattern: rule.pattern,
        resetFrequency: rule.resetFrequency as any,
        currentSeq: 0,
      },
      update: {
        pattern: rule.pattern,
        resetFrequency: rule.resetFrequency as any,
      },
    });
  }
  console.log(`   ✅ ${NUMBERING_RULES.length} Numbering Rules active.\n`);

  // 6. Seed Document Maker Templates
  console.log('6️⃣ Seeding Document Maker Templates (MOU, SJ, BAST, SPK, KWT, FAK)...');
  for (const tpl of DOCUMENT_TEMPLATES) {
    const existing = await prisma.documentTemplate.findFirst({
      where: { category: tpl.category, name: tpl.name },
    });
    if (!existing) {
      await prisma.documentTemplate.create({
        data: {
          category: tpl.category,
          name: tpl.name,
          bodyHtml: tpl.bodyHtml,
          fieldsSchema: tpl.fieldsSchema,
          isActive: true,
        },
      });
    }
  }
  console.log(`   ✅ ${DOCUMENT_TEMPLATES.length} Document Templates verified.\n`);

  console.log('=============================================================');
  console.log('✨ Clean Client Seeding Completed Successfully!');
  console.log('   All master catalogs, document templates, and SKU items are ready.');
  console.log('   Database is 100% clean of external routers or client-specific devices.');
  console.log('=============================================================\n');
}

// Direct execution support
if (require.main === module) {
  const force = process.argv.includes('--force');
  seedClientClean(force)
    .catch((err) => {
      console.error('❌ Clean Seeding Error:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
