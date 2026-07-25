import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupDuplicateInvoices() {
  console.log('🔄 Starting duplicate PENDING invoices cleanup script...\n');

  try {
    // Get all PENDING / OVERDUE unpaid invoices
    const unpaidInvoices = await prisma.invoice.findMany({
      where: {
        status: { in: ['PENDING', 'OVERDUE'] },
      },
      orderBy: {
        createdAt: 'desc', // newest first
      },
      select: {
        id: true,
        invoiceNumber: true,
        userId: true,
        createdAt: true,
        customerName: true,
      },
    });

    console.log(`📊 Total PENDING/OVERDUE invoices in DB: ${unpaidInvoices.length}`);

    // Group invoices by userId
    const userInvoiceMap = new Map<string, typeof unpaidInvoices>();

    for (const inv of unpaidInvoices) {
      if (!inv.userId) continue;
      const list = userInvoiceMap.get(inv.userId) || [];
      list.push(inv);
      userInvoiceMap.set(inv.userId, list);
    }

    const idsToDelete: string[] = [];

    // For each user with more than 1 unpaid invoice, keep ONLY the newest one!
    for (const [userId, invs] of userInvoiceMap.entries()) {
      if (invs.length > 1) {
        // First element (invs[0]) is newest -> keep it
        // Remaining elements (invs.slice(1)) are older duplicates -> delete!
        const duplicates = invs.slice(1);
        for (const dup of duplicates) {
          idsToDelete.push(dup.id);
          console.log(`🗑️ Deleting duplicate invoice ${dup.invoiceNumber} for ${dup.customerName} (Date: ${dup.createdAt.toISOString()})`);
        }
      }
    }

    if (idsToDelete.length > 0) {
      // Delete associated payments if any
      await prisma.payment.deleteMany({
        where: { invoiceId: { in: idsToDelete } },
      });

      // Delete duplicate invoices
      const deleted = await prisma.invoice.deleteMany({
        where: { id: { in: idsToDelete } },
      });

      console.log(`\n🎉 Selesai! Berhasil menghapus ${deleted.count} tagihan duplikat lama.`);
    } else {
      console.log('\n✅ Tidak ada tagihan duplikat yang perlu dihapus.');
    }
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

cleanupDuplicateInvoices();
