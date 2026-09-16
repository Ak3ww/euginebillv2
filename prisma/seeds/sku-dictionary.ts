import { PrismaClient } from '@prisma/client';

export const SKU_CATEGORIES = [
  { code: 'HW',  label: 'Hardware Utama', sortOrder: 1 },
  { code: 'CPE', label: 'Customer Equipment', sortOrder: 2 },
  { code: 'PAS', label: 'Passive Equipment', sortOrder: 3 },
  { code: 'CAB', label: 'Cables', sortOrder: 4 },
  { code: 'CON', label: 'Consumables', sortOrder: 5 },
  { code: 'MKT', label: 'Marketing Material', sortOrder: 6 },
  { code: 'PWR', label: 'Power Equipment', sortOrder: 7 },
  { code: 'TLS', label: 'Tools / Alat Kerja', sortOrder: 8 },
  { code: 'ACC', label: 'Accessories', sortOrder: 9 },
  { code: 'SUP', label: 'Office Supplies', sortOrder: 10 },
];

export const SKU_SUBCATEGORIES = [
  // HW - Hardware Utama
  { categoryCode: 'HW',  code: 'OLT', label: 'Optical Line Terminal', requiresBrand: true },
  { categoryCode: 'HW',  code: 'ROU', label: 'Router Core / Mikrotik', requiresBrand: true },
  { categoryCode: 'HW',  code: 'SWI', label: 'Switch / Hub',          requiresBrand: true },
  { categoryCode: 'HW',  code: 'SRV', label: 'Server / Mini PC',      requiresBrand: true },

  // CPE - Customer Equipment
  { categoryCode: 'CPE', code: 'ONT', label: 'Modem / ONT / ONU',     requiresBrand: true },
  { categoryCode: 'CPE', code: 'STB', label: 'Set Top Box',           requiresBrand: true },
  { categoryCode: 'CPE', code: 'RTR', label: 'Home Router / Extender', requiresBrand: true },

  // PAS - Passive Equipment
  { categoryCode: 'PAS', code: 'ODP', label: 'Optical Distribution Point', requiresBrand: false },
  { categoryCode: 'PAS', code: 'ODC', label: 'Optical Distribution Cabinet', requiresBrand: false },
  { categoryCode: 'PAS', code: 'SPL', label: 'Splitter Optik (PLC/FBT)', requiresBrand: false },
  { categoryCode: 'PAS', code: 'CLS', label: 'Joint Closure',         requiresBrand: false },
  { categoryCode: 'PAS', code: 'RST', label: 'Roset Fiber',           requiresBrand: false },

  // CAB - Cables
  { categoryCode: 'CAB', code: 'DRP', label: 'Dropcore 1 Core',       requiresBrand: false },
  { categoryCode: 'CAB', code: 'PRC', label: 'Precon Fast Connector', requiresBrand: false },
  { categoryCode: 'CAB', code: 'UTP', label: 'UTP / LAN Cat5/Cat6',   requiresBrand: false },
  { categoryCode: 'CAB', code: 'PWR', label: 'Kabel Power / Listrik', requiresBrand: false },

  // CON - Consumables
  { categoryCode: 'CON', code: 'PTC', label: 'Patch Cord / Konektor',  requiresBrand: false },
  { categoryCode: 'CON', code: 'FOD', label: 'Sleeve / Protection',   requiresBrand: false },
  { categoryCode: 'CON', code: 'TAP', label: 'Isolasi / Tape',        requiresBrand: false },
  { categoryCode: 'CON', code: 'TIE', label: 'Kabel Tis (Cable Ties)', requiresBrand: false },
  { categoryCode: 'CON', code: 'KLM', label: 'Paku Klem',             requiresBrand: false },
  { categoryCode: 'CON', code: 'PAP', label: 'Kertas HVS / Cetak',    requiresBrand: false },
  { categoryCode: 'CON', code: 'BAT', label: 'Baterai',               requiresBrand: false },

  // MKT - Marketing Material
  { categoryCode: 'MKT', code: 'BRC', label: 'Brosur / Flyer PSB',    requiresBrand: false },
  { categoryCode: 'MKT', code: 'STK', label: 'Stiker / Label ODP',    requiresBrand: false },
  { categoryCode: 'MKT', code: 'BNR', label: 'Banner / Spanduk',      requiresBrand: false },

  // PWR - Power Equipment
  { categoryCode: 'PWR', code: 'ADP', label: 'Power Adaptor 12V',     requiresBrand: true },
  { categoryCode: 'PWR', code: 'UPS', label: 'Mini UPS Backup',       requiresBrand: true },
  { categoryCode: 'PWR', code: 'POE', label: 'PoE Injector / Splitter', requiresBrand: true },

  // TLS - Tools / Alat Kerja
  { categoryCode: 'TLS', code: 'FUS', label: 'Fusion Splicer',        requiresBrand: true },
  { categoryCode: 'TLS', code: 'OPM', label: 'Optical Power Meter',   requiresBrand: true },
  { categoryCode: 'TLS', code: 'VFL', label: 'Visual Fault Locator (Laser)', requiresBrand: true },
  { categoryCode: 'TLS', code: 'CLV', label: 'Fiber Cleaver Blade',   requiresBrand: true },
  { categoryCode: 'TLS', code: 'STP', label: 'Fiber Stripper Tang',   requiresBrand: false },
  { categoryCode: 'TLS', code: 'CRF', label: 'Crimping Tool RJ45',    requiresBrand: false },

  // ACC - Accessories
  { categoryCode: 'ACC', code: 'FSH', label: 'Fishbone / Clamp Buaya', requiresBrand: false },
  { categoryCode: 'ACC', code: 'BRK', label: 'Bracket Tiang / ODP',   requiresBrand: false },
  { categoryCode: 'ACC', code: 'SPR', label: 'Spiral Wrapping Band',  requiresBrand: false },

  // SUP - Office Supplies
  { categoryCode: 'SUP', code: 'ATK', label: 'Alat Tulis Kantor',     requiresBrand: false },
  { categoryCode: 'SUP', code: 'ENV', label: 'Amplop Surat Tagihan',  requiresBrand: false },
];

export async function seedSkuDictionary(prismaClient?: PrismaClient) {
  const db = prismaClient || new PrismaClient();

  console.log('📦 Seeding SKU dictionary categories...');
  let categoriesCount = 0;
  for (const cat of SKU_CATEGORIES) {
    await db.skuCategoryCode.upsert({
      where: { code: cat.code },
      create: {
        code: cat.code,
        label: cat.label,
        sortOrder: cat.sortOrder,
        isActive: true,
      },
      update: {
        label: cat.label,
        sortOrder: cat.sortOrder,
      },
    });
    categoriesCount++;
  }

  console.log('🏷️ Seeding SKU dictionary sub-categories...');
  let subCategoriesCount = 0;
  for (const sub of SKU_SUBCATEGORIES) {
    await db.skuSubCategoryCode.upsert({
      where: {
        categoryCode_code: {
          categoryCode: sub.categoryCode,
          code: sub.code,
        },
      },
      create: {
        categoryCode: sub.categoryCode,
        code: sub.code,
        label: sub.label,
        requiresBrand: sub.requiresBrand,
        isActive: true,
      },
      update: {
        label: sub.label,
        requiresBrand: sub.requiresBrand,
      },
    });
    subCategoriesCount++;
  }

  return { categoriesCount, subCategoriesCount };
}
