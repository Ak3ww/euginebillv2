const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.pppoeUser.updateMany({
    where: {
      OR: [
        { username: 'EMG083' },
        { name: { contains: 'BERITAKAN' } }
      ]
    },
    data: {
      status: 'active',
      autoIsolationEnabled: false
    }
  });

  console.log(`✅ Reverted ${result.count} user(s) (EMG083 / BERITAKAN HIA) back to:`);
  console.log(`   - status: 'active'`);
  console.log(`   - autoIsolationEnabled: false (DISPENSASI AKTIF)`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
