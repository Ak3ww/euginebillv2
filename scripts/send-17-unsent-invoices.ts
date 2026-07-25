import { PrismaClient } from '@prisma/client';
import { sendInvoiceReminder } from '../src/server/services/notifications/whatsapp-templates.service';

const prisma = new PrismaClient();

async function send17UnsentInvoices() {
  console.log('🚀 Memulai pengiriman WA tagihan KHUSUS untuk 17 pelanggan (Belum WA)...\n');

  try {
    const company = await prisma.company.findFirst();
    const companyName = company?.name || 'EUGINE MEDIA GROUP';
    const companyPhone = company?.phone || '';

    // 1. Ensure all PENDING invoices have dueDate set to 5 August 2026
    const targetDueDate = new Date('2026-08-05T12:00:00.000Z');

    await prisma.invoice.updateMany({
      where: {
        status: { in: ['PENDING', 'OVERDUE'] },
      },
      data: {
        dueDate: targetDueDate,
        status: 'PENDING',
      },
    });

    console.log('📅 Tanggal Jatuh Tempo seluruh tagihan di database SUDAH DIPASTIKAN: 5 Agustus 2026.\n');

    // 2. Fetch strictly the 17 unsent invoices (waNotifiedAt is null)
    const unsentInvoices = await prisma.invoice.findMany({
      where: {
        status: { in: ['PENDING', 'OVERDUE'] },
        waNotifiedAt: null,
      },
      include: {
        user: {
          include: {
            area: true,
            profile: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Filter out Muara Beres / KMB in memory to be 100% safe
    const filteredInvoices = unsentInvoices.filter(inv => {
      const areaName = inv.user?.area?.name || '';
      const address = inv.user?.address || '';
      const lowerArea = areaName.toLowerCase();
      const lowerAddress = address.toLowerCase();
      return !lowerArea.includes('muara beres') && !lowerArea.includes('kmb') && !lowerAddress.includes('muara beres');
    });

    console.log(`📋 Total antrean tagihan 'Belum WA' yang akan dikirim: ${filteredInvoices.length} pelanggan.\n`);

    if (filteredInvoices.length === 0) {
      console.log('✅ Semua pelanggan sudah terkirim WA! Tidak ada antrean tersisa.');
      return;
    }

    let sent = 0;
    let failed = 0;

    for (let i = 0; i < filteredInvoices.length; i++) {
      const inv = filteredInvoices[i];
      const phone = inv.customerPhone || inv.user?.phone;
      const name = inv.customerName || inv.user?.name || 'Pelanggan';

      if (!phone) {
        console.log(`⚠️ [${i + 1}/${filteredInvoices.length}] Skipped ${inv.invoiceNumber} (${name}) - No phone number`);
        continue;
      }

      console.log(`📱 [${i + 1}/${filteredInvoices.length}] Kirim WA -> ${inv.invoiceNumber} | ${name} (${phone})...`);

      try {
        await sendInvoiceReminder({
          phone,
          customerName: name,
          customerId: inv.user?.customerId || inv.user?.username || '-',
          customerUsername: inv.user?.username,
          profileName: inv.user?.profile?.name || inv.profileName || '-',
          area: inv.user?.area?.name || '-',
          invoiceNumber: inv.invoiceNumber,
          amount: inv.amount,
          dueDate: targetDueDate, // Explicitly pass 5 August 2026
          paymentLink: inv.paymentLink || `${company?.baseUrl || 'http://euginemediagroup.com'}/pay/${inv.paymentToken}`,
          companyName,
          companyPhone,
          isOverdue: false,
        });

        // Update DB status: set waNotifiedAt to now and increment waRetryCount
        await prisma.invoice.update({
          where: { id: inv.id },
          data: {
            waNotifiedAt: new Date(),
            waRetryCount: (inv.waRetryCount || 0) + 1,
            dueDate: targetDueDate,
          },
        });

        sent++;
        console.log(`   ✅ BERHASIL! Status DB: WA Terkirim (1x)\n`);

        // Delay 1.5s per message
        await new Promise(resolve => setTimeout(resolve, 1500));
      } catch (err: any) {
        failed++;
        console.error(`   ❌ Gagal:`, err?.message || err);
      }
    }

    console.log(`\n🎉 SELESAI! Pengiriman 17 Pelanggan Selesai. Total Terkirim: ${sent}, Gagal: ${failed}`);
  } catch (error) {
    console.error('❌ Script error:', error);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

send17UnsentInvoices();
