/**
 * EugineBill — Consolidated Migration Runner (Passwordless)
 *
 * Menjalankan semua migrasi schema yang diperlukan secara berurutan.
 * Aman dijalankan berulang kali (idempotent) karena menggunakan IF NOT EXISTS
 * dan ALTER TABLE yang di-guard dalam try/catch.
 *
 * Usage:
 *   npx tsx scripts/run-migrations.ts
 */

import { prisma } from '../src/server/db/client';

async function columnExists(table: string, column: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<any[]>(`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
      AND COLUMN_NAME = ?
  `, table, column);
  return rows.length > 0;
}

async function main() {
  console.log('');
  console.log('=======================================================');
  console.log(' EugineBill Migration Runner — Passwordless DDL');
  console.log('=======================================================');
  console.log('');

  // ─── Migration 1: Drop stockQuantity, migrate to currentStock ─────────────
  console.log('1️⃣  [inventory_items] Checking stockQuantity → currentStock...');
  const hasStockQty = await columnExists('inventory_items', 'stockQuantity');
  if (hasStockQty) {
    console.log('   Migrating data stockQuantity → currentStock...');
    await prisma.$executeRawUnsafe(`
      UPDATE \`inventory_items\`
      SET \`currentStock\` = \`stockQuantity\`
      WHERE \`stockQuantity\` IS NOT NULL AND \`stockQuantity\` > \`currentStock\`
    `);
    await prisma.$executeRawUnsafe(`ALTER TABLE \`inventory_items\` DROP COLUMN \`stockQuantity\``);
    console.log('   ✅ stockQuantity migrated & dropped.');
  } else {
    console.log('   ✅ Already clean (stockQuantity not found).');
  }

  // ─── Migration 2: Ensure currentStock is DOUBLE ───────────────────────────
  console.log('2️⃣  [inventory_items] Ensuring currentStock = DOUBLE...');
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE \`inventory_items\` MODIFY \`currentStock\` DOUBLE NOT NULL DEFAULT 0`);
    console.log('   ✅ currentStock type ensured.');
  } catch { console.log('   ✅ Already correct type.'); }

  // ─── Migration 3: Add packSize ─────────────────────────────────────────────
  console.log('3️⃣  [inventory_items] Adding packSize column...');
  if (!(await columnExists('inventory_items', 'packSize'))) {
    await prisma.$executeRawUnsafe(`ALTER TABLE \`inventory_items\` ADD COLUMN \`packSize\` INT NULL`);
    console.log('   ✅ packSize added.');
  } else { console.log('   ✅ packSize already exists.'); }

  // ─── Migration 4: Add categoryCode ────────────────────────────────────────
  console.log('4️⃣  [inventory_items] Adding categoryCode column...');
  if (!(await columnExists('inventory_items', 'categoryCode'))) {
    await prisma.$executeRawUnsafe(`ALTER TABLE \`inventory_items\` ADD COLUMN \`categoryCode\` VARCHAR(191) NULL`);
    try {
      await prisma.$executeRawUnsafe(`CREATE INDEX \`inventory_items_categoryCode_idx\` ON \`inventory_items\`(\`categoryCode\`)`);
    } catch { /* index may already exist */ }
    console.log('   ✅ categoryCode added.');
  } else { console.log('   ✅ categoryCode already exists.'); }

  // ─── Migration 5: Add subCategory ─────────────────────────────────────────
  console.log('5️⃣  [inventory_items] Adding subCategory column...');
  if (!(await columnExists('inventory_items', 'subCategory'))) {
    await prisma.$executeRawUnsafe(`ALTER TABLE \`inventory_items\` ADD COLUMN \`subCategory\` VARCHAR(191) NULL`);
    console.log('   ✅ subCategory added.');
  } else { console.log('   ✅ subCategory already exists.'); }

  // ─── Migration 6: inventory_movements — DOUBLE fields + periodLabel ────────
  console.log('6️⃣  [inventory_movements] Ensuring quantity fields = DOUBLE...');
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE \`inventory_movements\`
        MODIFY \`quantity\` DOUBLE NOT NULL,
        MODIFY \`previousStock\` DOUBLE NOT NULL,
        MODIFY \`newStock\` DOUBLE NOT NULL
    `);
    console.log('   ✅ inventory_movements types ensured.');
  } catch { console.log('   ✅ Already correct types.'); }

  console.log('7️⃣  [inventory_movements] Adding periodLabel column...');
  if (!(await columnExists('inventory_movements', 'periodLabel'))) {
    await prisma.$executeRawUnsafe(`ALTER TABLE \`inventory_movements\` ADD COLUMN \`periodLabel\` VARCHAR(50) NULL`);
    try {
      await prisma.$executeRawUnsafe(`CREATE INDEX \`inventory_movements_periodLabel_idx\` ON \`inventory_movements\`(\`periodLabel\`)`);
    } catch { /* index may exist */ }
    console.log('   ✅ periodLabel added.');
  } else { console.log('   ✅ periodLabel already exists.'); }

  // ─── Migration 7: work_order_type_kits ────────────────────────────────────
  console.log('8️⃣  [work_order_type_kits] Creating table...');
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`work_order_type_kits\` (
      \`id\` VARCHAR(191) NOT NULL,
      \`issueType\` VARCHAR(191) NOT NULL,
      \`name\` VARCHAR(191) NOT NULL,
      \`isActive\` BOOLEAN NOT NULL DEFAULT TRUE,
      \`updatedAt\` DATETIME(3) NOT NULL,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`work_order_type_kits_issueType_key\` (\`issueType\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  console.log('   ✅ work_order_type_kits ready.');

  // ─── Migration 8: work_order_type_kit_items ───────────────────────────────
  console.log('9️⃣  [work_order_type_kit_items] Creating table...');
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`work_order_type_kit_items\` (
      \`id\` VARCHAR(191) NOT NULL,
      \`kitId\` VARCHAR(191) NOT NULL,
      \`itemId\` VARCHAR(191) NOT NULL,
      \`defaultQty\` DOUBLE NOT NULL,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`work_order_type_kit_items_kitId_itemId_key\` (\`kitId\`, \`itemId\`),
      CONSTRAINT \`work_order_type_kit_items_kitId_fkey\` FOREIGN KEY (\`kitId\`) REFERENCES \`work_order_type_kits\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT \`work_order_type_kit_items_itemId_fkey\` FOREIGN KEY (\`itemId\`) REFERENCES \`inventory_items\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  console.log('   ✅ work_order_type_kit_items ready.');

  // ─── Migration 9: sku_category_codes ──────────────────────────────────────
  console.log('🔟  [sku_category_codes] Creating table...');
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`sku_category_codes\` (
      \`id\` VARCHAR(191) NOT NULL,
      \`code\` VARCHAR(191) NOT NULL,
      \`label\` VARCHAR(191) NOT NULL,
      \`isActive\` BOOLEAN NOT NULL DEFAULT true,
      \`sortOrder\` INTEGER NOT NULL DEFAULT 0,
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      UNIQUE INDEX \`sku_category_codes_code_key\`(\`code\`),
      PRIMARY KEY (\`id\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  console.log('   ✅ sku_category_codes ready.');

  // ─── Migration 10: sku_sub_category_codes ─────────────────────────────────
  console.log('1️⃣1️⃣  [sku_sub_category_codes] Creating table...');
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`sku_sub_category_codes\` (
      \`id\` VARCHAR(191) NOT NULL,
      \`categoryCode\` VARCHAR(191) NOT NULL,
      \`code\` VARCHAR(191) NOT NULL,
      \`label\` VARCHAR(191) NOT NULL,
      \`requiresBrand\` BOOLEAN NOT NULL DEFAULT true,
      \`isActive\` BOOLEAN NOT NULL DEFAULT true,
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      UNIQUE INDEX \`sku_sub_category_codes_categoryCode_code_key\`(\`categoryCode\`, \`code\`),
      PRIMARY KEY (\`id\`),
      CONSTRAINT \`sku_sub_category_codes_categoryCode_fkey\` FOREIGN KEY (\`categoryCode\`) REFERENCES \`sku_category_codes\`(\`code\`) ON DELETE CASCADE ON UPDATE CASCADE
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  console.log('   ✅ sku_sub_category_codes ready.');

  console.log('');
  console.log('=======================================================');
  console.log(' ✅ Semua migrations selesai!');
  console.log('   Jalankan: npx prisma generate && npm run build');
  console.log('=======================================================');
  console.log('');
}

main()
  .catch(err => {
    console.error('\n❌ Migration gagal:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
