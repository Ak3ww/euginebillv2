const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== DEBUG USER EMG083 ===');
  const user = await prisma.pppoeUser.findFirst({
    where: {
      OR: [
        { username: { contains: 'EMG083' } },
        { name: { contains: 'BERITAKAN' } },
      ]
    },
    include: {
      profile: true,
      invoices: {
        take: 3,
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  if (!user) {
    console.log('❌ User EMG083 / BERITAKAN not found!');
  } else {
    console.log('ID:', user.id);
    console.log('Username:', user.username);
    console.log('Name:', user.name);
    console.log('Status:', user.status);
    console.log('SubscriptionType:', user.subscriptionType);
    console.log('ExpiredAt (DB Raw):', user.expiredAt);
    console.log('ExpiredAt (ISO):', user.expiredAt ? new Date(user.expiredAt).toISOString() : null);
    console.log('Is Expired Now?:', user.expiredAt ? new Date(user.expiredAt) <= new Date() : false);
    console.log('AutoIsolationEnabled:', user.autoIsolationEnabled);
    console.log('WANotificationEnabled:', user.waNotificationEnabled);
    console.log('Invoices Count:', user.invoices.length);
    user.invoices.forEach(inv => {
      console.log(`  - Inv: ${inv.invoiceNumber}, Amount: ${inv.amount}, Status: ${inv.status}, DueDate: ${inv.dueDate}`);
    });
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
