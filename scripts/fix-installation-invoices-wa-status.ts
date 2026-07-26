import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixInstallationInvoicesWAStatus() {
  console.log('🔧 SINKRONISASI STATUS WA UNTUK TAGIHAN SEBELUMNYA...\n');

  try {
    // Find all invoices with null waNotifiedAt for ACTIVE users created recently
    const unnotifiedInvoices = await prisma.invoice.findMany({
      where: {
        waNotifiedAt: null,
        user: { status: 'ACTIVE' }
      },
      include: { user: true }
    });

    console.log(`Found ${unnotifiedInvoices.length} invoices to update waNotifiedAt.`);

    if (unnotifiedInvoices.length > 0) {
      const now = new Date();
      const res = await prisma.invoice.updateMany({
        where: {
          id: { in: unnotifiedInvoices.map(i => i.id) }
        },
        data: {
          waNotifiedAt: now,
          waRetryCount: 1
        }
      });
      console.log(`✅ Successfully updated ${res.count} invoices to waNotifiedAt = NOW.`);
    }

  } catch (e) {
    console.error('❌ Error fixing invoices:', e);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

fixInstallationInvoicesWAStatus();
