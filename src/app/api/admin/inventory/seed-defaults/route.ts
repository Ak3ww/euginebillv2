import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';
import { prisma } from '@/server/db/client';

export const dynamic = 'force-dynamic';

// ─── Numbering Rules ───────────────────────────────────────────────────────────
const DEFAULT_NUMBERING_RULES = [
  {
    category: 'MOU',
    pattern: 'MOU/{DEPT}/{ROMAN_MM}/{YYYY}/{SEQ:3}',
    resetFrequency: 'yearly',
  },
  {
    category: 'FAK',
    pattern: 'FAK/{DEPT}/{YYYY}{MM}/{SEQ:4}',
    resetFrequency: 'monthly',
  },
  {
    category: 'KWT',
    pattern: 'KWT/{YYYY}{MM}/{SEQ:4}',
    resetFrequency: 'monthly',
  },
  {
    category: 'SJ',
    pattern: 'SJ/LOG/{ROMAN_MM}/{YYYY}/{SEQ:4}',
    resetFrequency: 'yearly',
  },
  {
    category: 'BAST',
    pattern: 'BAST/{DEPT}/{YYYY}/{SEQ:3}',
    resetFrequency: 'yearly',
  },
  {
    category: 'SPK',
    pattern: 'SPK/{YYYY}/{SEQ:4}',
    resetFrequency: 'none',
  },
];

// ─── Default Inventory Categories ─────────────────────────────────────────────
const DEFAULT_CATEGORIES = [
  { code: 'HW', name: 'Hardware Utama (HW)', description: 'Router, Switch, OLT, Server' },
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

// ─── Inventory Item Master Catalog ─────────────────────────────────────────────
const DEFAULT_INVENTORY_ITEMS = [
  // ONT (CPE/ONT) — serialized
  { sku: 'EMG-CPE-ONT-ZTE-F609V3', name: 'ONT ZTE F609 V3', categoryCode: 'CPE', subCategory: 'ONT', unit: 'pcs', isSerialized: true },
  { sku: 'EMG-CPE-ONT-SKW-542VF', name: 'ONT Skyworth GN542VF', categoryCode: 'CPE', subCategory: 'ONT', unit: 'pcs', isSerialized: true },
  { sku: 'EMG-CPE-ONT-RLT-OEM', name: 'ONT Realtek OEM', categoryCode: 'CPE', subCategory: 'ONT', unit: 'pcs', isSerialized: true },
  { sku: 'EMG-CPE-ONT-YHT-100G', name: 'ONT Yuhua 100G', categoryCode: 'CPE', subCategory: 'ONT', unit: 'pcs', isSerialized: true },
  { sku: 'EMG-CPE-ONT-FBH-HG6243', name: 'ONT FiberHome HG6243', categoryCode: 'CPE', subCategory: 'ONT', unit: 'pcs', isSerialized: true },
  { sku: 'EMG-CPE-ONT-HWA-8245H', name: 'ONT Huawei HG8245H', categoryCode: 'CPE', subCategory: 'ONT', unit: 'pcs', isSerialized: true },
  { sku: 'EMG-CPE-ONT-GGL-FD511G', name: 'ONT Gigalink FD511G', categoryCode: 'CPE', subCategory: 'ONT', unit: 'pcs', isSerialized: true },
  { sku: 'EMG-CPE-ONT-VSL-V2801', name: 'ONT VSOL V2801', categoryCode: 'CPE', subCategory: 'ONT', unit: 'pcs', isSerialized: true },
  { sku: 'EMG-CPE-ONT-EFT-OEM', name: 'ONT EFiber OEM', categoryCode: 'CPE', subCategory: 'ONT', unit: 'pcs', isSerialized: true },
  // Cable types (CAB) — serialized, roll
  { sku: 'EMG-CAB-PRC-1C-250M', name: 'Kabel Precon 1 Core 250M', categoryCode: 'CAB', subCategory: 'PRC', unit: 'roll', isSerialized: true },
  { sku: 'EMG-CAB-PRC-1C-500M', name: 'Kabel Precon 1 Core 500M', categoryCode: 'CAB', subCategory: 'PRC', unit: 'roll', isSerialized: true },
  { sku: 'EMG-CAB-UTP-CAT6-305M', name: 'Kabel UTP Cat6 305M', categoryCode: 'CAB', subCategory: 'UTP', unit: 'roll', isSerialized: true },
  // Dropcore Cable types (CAB/DRP) — serialized, roll
  { sku: 'EMG-CAB-DRP-1C-50M',  name: 'Kabel Dropcore 1 Core 50M',  categoryCode: 'CAB', subCategory: 'DRP', unit: 'roll', isSerialized: true },
  { sku: 'EMG-CAB-DRP-1C-100M', name: 'Kabel Dropcore 1 Core 100M', categoryCode: 'CAB', subCategory: 'DRP', unit: 'roll', isSerialized: true },
  { sku: 'EMG-CAB-DRP-1C-200M', name: 'Kabel Dropcore 1 Core 200M', categoryCode: 'CAB', subCategory: 'DRP', unit: 'roll', isSerialized: true },
  { sku: 'EMG-CAB-DRP-1C-250M', name: 'Kabel Dropcore 1 Core 250M', categoryCode: 'CAB', subCategory: 'DRP', unit: 'roll', isSerialized: true },
  { sku: 'EMG-CAB-DRP-1C-300M', name: 'Kabel Dropcore 1 Core 300M', categoryCode: 'CAB', subCategory: 'DRP', unit: 'roll', isSerialized: true },
  // PAS types — serialized & non-serialized
  { sku: 'EMG-PAS-ODP-16P', name: 'ODP 16 Port', categoryCode: 'PAS', subCategory: 'ODP', unit: 'pcs', isSerialized: true },
  { sku: 'EMG-PAS-SPL-1X8-PLC', name: 'Splitter PLC 1x8', categoryCode: 'PAS', subCategory: 'SPL', unit: 'pcs', isSerialized: true },
  { sku: 'EMG-PAS-RST-1P-SCUPC', name: 'Roset Fiber 1 Port SC/UPC', categoryCode: 'PAS', subCategory: 'RST', unit: 'pcs', isSerialized: false },
  // Consumables (CON) — not serialized
  { sku: 'EMG-CON-TIE-30CM-BLK', name: 'Kabel Tis 30cm Hitam', categoryCode: 'CON', subCategory: 'TIE', unit: 'pcs', isSerialized: false },
  { sku: 'EMG-CON-TAP-60MM', name: 'Isolasi Hitam 60mm', categoryCode: 'CON', subCategory: 'TAP', unit: 'pcs', isSerialized: false },
  { sku: 'EMG-CON-KLM-16MM', name: 'Paku Klem 16mm', categoryCode: 'CON', subCategory: 'KLM', unit: 'pcs', isSerialized: false },
  { sku: 'EMG-CON-PTC-FC-APC', name: 'Konektor FC-APC', categoryCode: 'CON', subCategory: 'PTC', unit: 'pcs', isSerialized: false },
  { sku: 'EMG-CON-PTC-SC-UPC-3M', name: 'Patch Cord SC-UPC 3M', categoryCode: 'CON', subCategory: 'PTC', unit: 'pcs', isSerialized: false },
  { sku: 'EMG-CON-SLV-60MM', name: 'Protection Sleeve 60mm', categoryCode: 'CON', subCategory: 'SLV', unit: 'pcs', isSerialized: false },
  { sku: 'EMG-CON-FOD-CLEAVE', name: 'Fiber Cleaver Blade', categoryCode: 'CON', subCategory: 'FOD', unit: 'pcs', isSerialized: false },
  { sku: 'EMG-CON-PAP-A4', name: 'Kertas HVS A4', categoryCode: 'CON', subCategory: 'PAP', unit: 'rim', isSerialized: false },
  { sku: 'EMG-CON-BAT-AAA-PAIR', name: 'Baterai Remote AAA (sepasang)', categoryCode: 'CON', subCategory: 'BAT', unit: 'pasang', isSerialized: false },
  // MKT types — not serialized
  { sku: 'EMG-MKT-BRC-A5', name: 'Brosur A5', categoryCode: 'MKT', subCategory: 'BRC', unit: 'pcs', isSerialized: false },
  { sku: 'EMG-MKT-STK-ODP-LOGO', name: 'Stiker Logo ODP', categoryCode: 'MKT', subCategory: 'STK', unit: 'pcs', isSerialized: false },
];

// ─── Standard Initial Stock Levels & Pack Size for Consumables ────────────────
const STANDARD_STOCK_LEVELS: Record<string, { qty: number; packSize?: number }> = {
  'EMG-CON-TIE-30CM-BLK': { qty: 500, packSize: 200 },
  'EMG-CON-TAP-60MM': { qty: 50, packSize: 10 },
  'EMG-CON-KLM-16MM': { qty: 300, packSize: 100 },
  'EMG-CON-PTC-FC-APC': { qty: 100, packSize: 50 },
  'EMG-CON-FOD-CLEAVE': { qty: 5 },
  'EMG-CON-PAP-A4': { qty: 5 },
  'EMG-MKT-BRC-A5': { qty: 200 },
  'EMG-MKT-STK-ODP-LOGO': { qty: 100 },
  'EMG-CON-PTC-SC-UPC-3M': { qty: 50 },
  'EMG-CON-SLV-60MM': { qty: 200 },
  'EMG-PAS-RST-1P-SCUPC': { qty: 50 },
  'EMG-CON-BAT-AAA-PAIR': { qty: 20 },
};

export async function POST(req: NextRequest) {
  try {
    const secret = req.headers.get('x-cron-secret');
    const host = req.headers.get('host') || '';
    const isLocalhost = host.startsWith('localhost') || host.startsWith('127.0.0.1');
    const isValidSecret = process.env.CRON_SECRET && secret === process.env.CRON_SECRET;

    if (!isLocalhost && !isValidSecret) {
      const session = await getServerSession(authOptions);
      if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const userRole = (session.user as { role?: string }).role;
      if (userRole !== 'SUPER_ADMIN') {
        return NextResponse.json({ error: 'Forbidden: SUPER_ADMIN only' }, { status: 403 });
      }
    }

    // ── 1. Seed numbering rules ──────────────────────────────────────────────
    let rulesSeeded = 0;
    for (const rule of DEFAULT_NUMBERING_RULES) {
      await prisma.numberingRule.upsert({
        where: { category: rule.category },
        create: {
          category: rule.category,
          pattern: rule.pattern,
          resetFrequency: rule.resetFrequency,
          currentSeq: 0,
        },
        update: {},
      });
      rulesSeeded++;
    }

    // ── 2. Seed inventory categories ─────────────────────────────────────────
    const categoryMap: Record<string, string> = {};
    let categoriesSeeded = 0;
    for (const cat of DEFAULT_CATEGORIES) {
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
      categoriesSeeded++;
    }

    // ── 3. Seed inventory item master catalog ────────────────────────────────
    let itemsSeeded = 0;
    for (const item of DEFAULT_INVENTORY_ITEMS) {
      const categoryId = categoryMap[item.categoryCode] || null;
      const initialPackSize = STANDARD_STOCK_LEVELS[item.sku]?.packSize || null;
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
          packSize: initialPackSize,
          isActive: true,
        },
        update: {
          name: item.name,
          categoryCode: item.categoryCode,
          subCategory: item.subCategory,
          ...(categoryId ? { categoryId } : {}),
          ...(initialPackSize ? { packSize: initialPackSize } : {}),
        },
      });
      itemsSeeded++;
    }

    // ── 4. Seed permissions & WAREHOUSE role template ──────────────────────
    try {
      const { seedPermissions } = await import('@/../prisma/seeds/permissions');
      await seedPermissions();
    } catch (permErr) {
      console.warn('Warning seeding permissions from seed-defaults:', permErr);
    }

    // ── 5. Seed 25 Physical Dropcore Rolls (5 rolls per length variant) ──────
    let rollsSeeded = 0;
    const DROPCORE_LENGTHS = [50, 100, 200, 250, 300];
    const ROLLS_PER_LENGTH = 5;

    for (const length of DROPCORE_LENGTHS) {
      const sku = `EMG-CAB-DRP-1C-${length}M`;
      const item = await prisma.inventoryItem.findUnique({ where: { sku } });
      if (!item) continue;

      for (let i = 1; i <= ROLLS_PER_LENGTH; i++) {
        const serialNumber = `ROLL-${length}M-${String(i).padStart(2, '0')}`;
        await prisma.inventoryAsset.upsert({
          where: { serialNumber },
          create: {
            itemId: item.id,
            assetType: 'CABLE_ROLL',
            serialNumber,
            initialLength: length,
            remainingLength: length,
            condition: 'NEW',
            status: 'AVAILABLE',
            notes: `Seeding fisik dropcore roll ${length}M unit #${i}`,
          },
          update: {}, // Jangan timpa roll yang sudah dipakai
        });
        rollsSeeded++;
      }
    }

    // ── 6. Seed Standard Initial Stock for Consumables ───────────────────────
    let stockItemsInitialized = 0;
    for (const [sku, { qty, packSize }] of Object.entries(STANDARD_STOCK_LEVELS)) {
      const item = await prisma.inventoryItem.findUnique({ where: { sku } });
      if (!item) continue;

      const hasMovement = await prisma.inventoryMovement.findFirst({ where: { itemId: item.id } });
      if (!hasMovement) {
        await prisma.$transaction([
          prisma.inventoryItem.update({
            where: { id: item.id },
            data: {
              currentStock: qty,
              ...(packSize ? { packSize } : {}),
            },
          }),
          prisma.inventoryMovement.create({
            data: {
              itemId: item.id,
              movementType: 'IN',
              quantity: qty,
              previousStock: 0,
              newStock: qty,
              referenceNo: 'SEED-INITIAL',
              notes: 'Stok awal seeding sistem inventori',
            },
          }),
        ]);
        stockItemsInitialized++;
      } else if (packSize && !item.packSize) {
        await prisma.inventoryItem.update({
          where: { id: item.id },
          data: { packSize },
        });
      }
    }

    // ── 7. Seed Default Kit Standar PSB (workOrderTypeKit) ───────────────────
    let kitItemsSeeded = 0;
    const psbKit = await prisma.workOrderTypeKit.upsert({
      where: { issueType: 'INSTALLATION' },
      create: {
        issueType: 'INSTALLATION',
        name: 'Kit Standar PSB',
        isActive: true,
      },
      update: {
        name: 'Kit Standar PSB',
        isActive: true,
      },
    });

    const DEFAULT_PSB_KIT_ITEMS = [
      { sku: 'EMG-CON-TIE-30CM-BLK', defaultQty: 6 },
      { sku: 'EMG-CON-TAP-60MM', defaultQty: 1 },
      { sku: 'EMG-CON-KLM-16MM', defaultQty: 8 },
      { sku: 'EMG-CON-PTC-FC-APC', defaultQty: 1 },
    ];

    for (const kitItemDef of DEFAULT_PSB_KIT_ITEMS) {
      const targetItem = await prisma.inventoryItem.findUnique({ where: { sku: kitItemDef.sku } });
      if (targetItem) {
        await prisma.workOrderTypeKitItem.upsert({
          where: {
            kitId_itemId: {
              kitId: psbKit.id,
              itemId: targetItem.id,
            },
          },
          create: {
            kitId: psbKit.id,
            itemId: targetItem.id,
            defaultQty: kitItemDef.defaultQty,
          },
          update: {
            defaultQty: kitItemDef.defaultQty,
          },
        });
        kitItemsSeeded++;
      }
    }

    // ── 8. Seed SKU Master Dictionary (Categories & Subcategories) ──────────
    let skuStats = { categoriesCount: 0, subCategoriesCount: 0 };
    try {
      const { seedSkuDictionary } = await import('@/../prisma/seeds/sku-dictionary');
      skuStats = await seedSkuDictionary(prisma);
    } catch (skuErr) {
      console.warn('Warning seeding SKU dictionary from seed-defaults:', skuErr);
    }

    return NextResponse.json({
      success: true,
      message: 'Default data, cable rolls, standard kit, and SKU dictionary seeded successfully',
      seeded: {
        numberingRules: rulesSeeded,
        categories: categoriesSeeded,
        inventoryItems: itemsSeeded,
        cableRolls: rollsSeeded,
        stockItemsInitialized,
        kitStandarPsbItems: kitItemsSeeded,
        skuCategories: skuStats.categoriesCount,
        skuSubCategories: skuStats.subCategoriesCount,
        permissionsUpdated: true,
      },
    });
  } catch (error) {
    console.error('Error seeding defaults:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to seed defaults' },
      { status: 500 }
    );
  }
}
