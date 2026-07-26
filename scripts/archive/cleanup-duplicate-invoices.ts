import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupDuplicateInvoices() {
  console.log('🔄 Starting invoice cleanup & WA history sync script...\n');

  try {
    // 1. Fetch all SENT WA messages from the last 24 hours containing /pay/
    const sinceDate = new Date(Date.now() - 24 * 3600 * 1000);
    const sentWaLogs = await prisma.whatsapp_history.findMany({
      where: {
        message: { contains: '/pay/' },
        sentAt: { gte: sinceDate },
        status: { in: ['sent', 'SENT', 'success', 'SUCCESS', 'terkirim', 'TERKIRIM'] },
      },
      select: { message: true, phone: true },
    });

    console.log(`📱 Found ${sentWaLogs.length} sent WA invoice messages in the last 24 hours.`);

    // Extract all valid invoiceNumbers & paymentTokens from sent WA logs
    const validInvoiceNumbers = new Set<string>();
    const validPaymentTokens = new Set<string>();

    for (const log of sentWaLogs) {
      const invMatch = log.message.match(/(?:No\.\s*Invoice|Nomor\s*Invoice|Nomor\s*Tagihan|No\s*Tagihan):\s*\*?([^\*\n\r]+)\*?/i) || log.message.match(/(INV-[a-zA-Z0-9_-]+)/i);
      const linkMatch = log.message.match(/\/pay\/([a-zA-Z0-9_-]+)/i);

      if (invMatch) {
        validInvoiceNumbers.add(invMatch[1].replace(/\*/g, '').trim());
      }
      if (linkMatch) {
        validPaymentTokens.add(linkMatch[1].trim());
      }
    }

    console.log(`📋 Extracted ${validInvoiceNumbers.size} valid WA invoice numbers from sent history.`);

    // 2. Fetch all PENDING / OVERDUE invoices in DB
    const unpaidInvoices = await prisma.invoice.findMany({
      where: {
        status: { in: ['PENDING', 'OVERDUE'] },
      },
      select: {
        id: true,
        invoiceNumber: true,
        paymentToken: true,
        customerName: true,
        createdAt: true,
      },
    });

    console.log(`📊 Current PENDING/OVERDUE invoices in DB: ${unpaidInvoices.length}`);

    const idsToDelete: string[] = [];
    let keptCount = 0;

    for (const inv of unpaidInvoices) {
      const isMatchedByInvNum = validInvoiceNumbers.has(inv.invoiceNumber);
      const isMatchedByToken = inv.paymentToken ? validPaymentTokens.has(inv.paymentToken) : false;

      if (isMatchedByInvNum || isMatchedByToken) {
        keptCount++;
      } else {
        // Un-sent / unsynced invoice -> delete
        idsToDelete.push(inv.id);
        console.log(`🗑️ Deleting unsent/unmatched invoice ${inv.invoiceNumber} (${inv.customerName})`);
      }
    }

    if (idsToDelete.length > 0) {
      // Delete associated payments if any
      await prisma.payment.deleteMany({
        where: { invoiceId: { in: idsToDelete } },
      });

      // Delete unsent invoices
      const deleted = await prisma.invoice.deleteMany({
        where: { id: { in: idsToDelete } },
      });

      console.log(`\n🎉 Selesai! Berhasil menghapus ${deleted.count} tagihan yang tidak pernah terkirim via WA.`);
      console.log(`✅ Menyisakan ${keptCount} tagihan PENDING/OVERDUE yang 100% cocok dengan WA Terkirim!`);
    } else {
      console.log('\n✅ Seluruh tagihan PENDING di DB sudah 100% cocok dengan WA Terkirim!');
    }
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

cleanupDuplicateInvoices();
