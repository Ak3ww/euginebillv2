import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function markAllInvoicesSentNow() {
  console.log('🔒 Menandai SELURUH tagihan di database sebagai WA TERKIRIM (waNotifiedAt = NOW)...\n');

  try {
    const result = await prisma.invoice.updateMany({
      where: {
        waNotifiedAt: null,
      },
      data: {
        waNotifiedAt: new Date(),
        waRetryCount: 1,
      },
    });

    console.log(`==================================================`);
    console.log(`✅ BERHASIL! Berhasil mengunci & menandai ${result.count} tagihan menjadi status: WA Terkirim (1x)!`);
    console.log(`🔒 Sekarang 100% tagihan di database sudah berstatus TERKIRIM dan tidak akan pernah terkirim ganda lagi.`);
    console.log(`==================================================`);

  } catch (error) {
    console.error('❌ Error updating invoice WA status:', error);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

markAllInvoicesSentNow();
