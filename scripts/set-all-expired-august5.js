const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const august5 = new Date('2026-08-05T00:00:00.000Z');
  console.log(`📅 Bulk updating ALL PPPoE customers expiredAt date to: ${august5.toLocaleDateString('id-ID')} (5 Agustus 2026)...`);

  const result = await prisma.pppoeUser.updateMany({
    data: {
      expiredAt: august5,
    },
  });

  console.log(`🎉 SUCCESS! Updated ${result.count} customers expiredAt date to 5 Agustus 2026.`);
}

main()
  .catch((e) => {
    console.error('❌ Error updating expiredAt date for all customers:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
