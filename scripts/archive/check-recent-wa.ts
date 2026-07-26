import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkRecentWa() {
  console.log('🔍 Memeriksa log pengiriman WA & status tagihan di database...\n');

  try {
    const sinceDate = new Date(Date.now() - 3 * 3600 * 1000); // 3 jam terakhir

    const logs = await prisma.whatsapp_history.findMany({
      where: {
        sentAt: { gte: sinceDate },
      },
      orderBy: { sentAt: 'desc' },
      select: {
        id: true,
        phone: true,
        message: true,
        sentAt: true,
        status: true,
      },
    });

    console.log(`📱 Total log WA yang terkirim/tercatat dalam 3 jam terakhir: ${logs.length}\n`);

    if (logs.length > 0) {
      console.log('📋 Rincian pengiriman WA 3 jam terakhir:');
      logs.forEach((log, idx) => {
        const nameMatch = log.message.match(/Yth\.\s*(?:Bapak\/Ibu\s*)?\*?([^\*\n\r]+)\*?/i);
        const invMatch = log.message.match(/(INV-[a-zA-Z0-9_-]+)/i);
        const name = nameMatch ? nameMatch[1].replace(/\*/g, '').trim() : 'Nama tidak terdeteksi';
        const invoiceNumber = invMatch ? invMatch[1] : '-';
        const timeStr = log.sentAt ? log.sentAt.toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' }) : '-';

        console.log(`  [${idx + 1}] Jam ${timeStr} WIB | ${invoiceNumber} | ${name} (${log.phone}) | Status: ${log.status}`);
      });
    } else {
      console.log('ℹ️ Tidak ada pengiriman WA baru dalam 3 jam terakhir.');
    }

    // Status Tagihan saat ini di DB
    const notifiedInvoices = await prisma.invoice.count({
      where: {
        waNotifiedAt: { not: null },
        status: { in: ['PENDING', 'OVERDUE'] },
      },
    });

    const unnotifiedInvoices = await prisma.invoice.count({
      where: {
        waNotifiedAt: null,
        status: { in: ['PENDING', 'OVERDUE'] },
      },
    });

    console.log(`\n📊 Status Tagihan PENDING saat ini di Database:`);
    console.log(`🟢 WA Terkirim (waNotifiedAt != null): ${notifiedInvoices} tagihan`);
    console.log(`⚪ Belum WA (waNotifiedAt == null): ${unnotifiedInvoices} tagihan`);

  } catch (error) {
    console.error('❌ Error checking WA logs:', error);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

checkRecentWa();
