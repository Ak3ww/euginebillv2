import { prisma } from '../src/server/db/client';

async function main() {
  console.log('[Migrate] Ensuring SKU dictionary tables exist in MySQL...');

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
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  `);

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
        PRIMARY KEY (\`id\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  `);

  console.log('[Migrate] SKU dictionary tables created successfully without manual password input!');
}

main()
  .catch(err => {
    console.error('[Migrate] Error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
