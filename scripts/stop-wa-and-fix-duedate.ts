import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function stopWaAndFixDueDate() {
  console.log('🛑 Mematikan pengiriman WA otomatis & memperbaiki Tanggal Jatuh Tempo ke 5 Agustus 2026...\n');

  try {
    // 1. Disable all automatic WA reminder settings in DB instantly
    await prisma.whatsapp_reminder_settings.updateMany({
      data: {
        enabled: false,
      },
    });

    console.log('✅ WA Reminder Settings: BERHASIL DIMATIKAN (enabled = false). Pengiriman otomatis terhenti 100%!\n');

    // 2. Fix all current PENDING / OVERDUE invoice dueDates to 5 Agustus 2026
    const targetDueDate = new Date('2026-08-05T12:00:00.000Z');

    const result = await prisma.invoice.updateMany({
      where: {
        status: { in: ['PENDING', 'OVERDUE'] },
      },
      data: {
        dueDate: targetDueDate,
        status: 'PENDING', // ensure status is PENDING, not overdue
      },
    });

    console.log(`✅ Berhasil memperbarui ${result.count} tagihan ke Tanggal Jatuh Tempo: 5 Agustus 2026!`);
    console.log('\n🎉 Selesai! WA pengingat otomatis telah dimatikan dan tanggal jatuh tempo sudah rapi 5 Agustus 2026.');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

stopWaAndFixDueDate();
