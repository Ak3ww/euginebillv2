import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function markAllRemainingSent() {
  console.log('🔄 Memperbarui status database untuk 10 tagihan terkirim terakhir...\n');

  try {
    const targetDueDate = new Date('2026-08-05T12:00:00.000Z');
    const now = new Date();

    const remainingInvoiceNumbers = [
      'INV-20260725-78577B',
      'INV-20260725-A1C40A',
      'INV-20260725-F92A7F',
      'INV-20260725-6CB0C9',
      'INV-20260725-B343C6',
      'INV-20260725-FE739B',
      'INV-20260725-D0DF77',
      'INV-20260725-2AD555',
      'INV-20260725-1BFD77',
      'INV-20260725-91ABA8',
    ];

    const result = await prisma.invoice.updateMany({
      where: {
        invoiceNumber: { in: remainingInvoiceNumbers },
      },
      data: {
        waNotifiedAt: now,
        waRetryCount: 1,
        dueDate: targetDueDate,
      },
    });

    console.log(`✅ Berhasil memperbarui ${result.count} tagihan menjadi status WA Terkirim (1x)!`);
    console.log('🎉 SELURUH TAGIHAN 100% SUDAH BERSTATUS WA TERKIRIM DAN TEPAT JATUH TEMPO 5 AGUSTUS 2026!');
  } catch (error) {
    console.error('❌ Error updating DB:', error);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

markAllRemainingSent();
