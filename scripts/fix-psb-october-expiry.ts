import { prisma } from '../src/server/db/client';

async function fixPsbOctoberExpiry() {
  console.log('🔍 Checking PSB customers registered in August 2026 with October expiry...');

  const augStart = new Date('2026-08-01T00:00:00Z');
  const augEnd = new Date('2026-08-31T23:59:59Z');

  const users = await prisma.pppoeUser.findMany({
    where: {
      createdAt: { gte: augStart, lte: augEnd },
      expiredAt: {
        gte: new Date('2026-10-01T00:00:00Z'),
        lte: new Date('2026-10-31T23:59:59Z'),
      },
    },
    include: {
      profile: true,
      invoices: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  console.log(`Found ${users.length} customer(s) with October 2026 expiry:`);

  for (const user of users) {
    console.log(`- Customer: ${user.name} (${user.username})`);
    console.log(`  CreatedAt: ${user.createdAt.toISOString()}`);
    console.log(`  Current ExpiredAt: ${user.expiredAt?.toISOString()}`);

    const paidInvoicesCount = user.invoices.filter(i => i.status === 'PAID').length;
    if (paidInvoicesCount <= 1 && user.expiredAt) {
      const correctedExpiry = new Date(user.expiredAt);
      correctedExpiry.setMonth(correctedExpiry.getMonth() - 1);

      await prisma.pppoeUser.update({
        where: { id: user.id },
        data: { expiredAt: correctedExpiry },
      });

      console.log(`  ✅ Corrected ExpiredAt from October to: ${correctedExpiry.toISOString()}`);
    } else {
      console.log(`  ⚠️ Skipped: customer has ${paidInvoicesCount} paid invoices`);
    }
  }

  console.log('🎉 Audit and correction complete!');
}

fixPsbOctoberExpiry()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
