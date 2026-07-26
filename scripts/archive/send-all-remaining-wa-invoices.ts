import { PrismaClient } from '@prisma/client';
import { sendInvoiceReminder } from '../src/server/services/notifications/whatsapp-templates.service';

const prisma = new PrismaClient();

async function sendAllRemainingWaInvoices() {
  console.log('🚀 Memulai pengiriman otomatis WA untuk seluruh sisa tagihan (168 pelanggan)...\n');

  try {
    const company = await prisma.company.findFirst();
    const companyName = company?.name || 'EUGINE MEDIA GROUP';
    const companyPhone = company?.phone || '085169990995';

    // 1. Fetch all unsent invoices (waNotifiedAt is null)
    const unsentInvoices = await prisma.invoice.findMany({
      where: {
        waNotifiedAt: null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
            customerId: true,
            username: true,
            area: { select: { name: true } },
            profile: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // 2. Filter out Lutfi Febriyandi
    const targetInvoices = unsentInvoices.filter(
      inv => !inv.user?.name?.toUpperCase().includes('LUTFI FEBRIYANDI')
    );

    console.log(`📋 Total antrean tagihan 'Belum WA' yang akan dikirim: ${targetInvoices.length} pelanggan.\n`);

    if (targetInvoices.length === 0) {
      console.log('🎉 Tidak ada tagihan tersisa! Semua tagihan sudah terkirim WA.');
      return;
    }

    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < targetInvoices.length; i++) {
      const inv = targetInvoices[i];
      const user = inv.user;
      const indexStr = `[${i + 1}/${targetInvoices.length}]`;

      if (!user || !user.phone) {
        console.log(`📱 ${indexStr} ⚠️ Skipped -> Invoice ${inv.invoiceNumber} | ${user?.name || 'Tanpa Nama'} (Tidak ada nomor HP)`);
        failedCount++;
        continue;
      }

      console.log(`📱 ${indexStr} Kirim WA -> ${inv.invoiceNumber} | ${user.name} (${user.phone})...`);

      try {
        const paymentLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://euginemediagroup.com'}/pay/${inv.paymentToken || ''}`;

        const res = await sendInvoiceReminder({
          phone: user.phone,
          customerName: user.name,
          customerId: user.customerId || user.username || '-',
          customerUsername: user.username || '-',
          profileName: user.profile?.name || 'Paket Internet',
          area: user.area?.name || '-',
          invoiceNumber: inv.invoiceNumber,
          amount: inv.amount,
          dueDate: inv.dueDate,
          paymentLink: inv.paymentToken ? paymentLink : '',
          companyName,
          companyPhone,
          isOverdue: inv.status === 'OVERDUE',
        });

        // Mark as sent in database
        await prisma.invoice.update({
          where: { id: inv.id },
          data: {
            waNotifiedAt: new Date(),
            waRetryCount: { increment: 1 },
          },
        });

        console.log(`   ✅ BERHASIL! Status DB: WA Terkirim (${(inv.waRetryCount || 0) + 1}x)\n`);
        successCount++;

      } catch (err: any) {
        console.error(`   ❌ GAGAL: ${err.message || err}\n`);
        failedCount++;
      }

      // Delay 2.5 detik per pesan agar aman dari rate limit WA & anti-block
      await new Promise(resolve => setTimeout(resolve, 2500));
    }

    console.log(`==================================================`);
    console.log(`🎉 SELESAI! Total Berhasil Terkirim: ${successCount}, Gagal/Skipped: ${failedCount}`);
    console.log(`==================================================`);

  } catch (error) {
    console.error('❌ Error executing sendAllRemainingWaInvoices:', error);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

sendAllRemainingWaInvoices();
