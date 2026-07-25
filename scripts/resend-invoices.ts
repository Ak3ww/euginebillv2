import { PrismaClient } from '@prisma/client';
import { sendInvoiceReminder } from '../src/server/services/notifications/whatsapp-templates.service';

const prisma = new PrismaClient();

async function resendInvoices() {
  console.log('🚀 Memulai pengiriman ulang WA tagihan ke pelanggan (Non-Muara Beres)...\n');

  try {
    const company = await prisma.company.findFirst();
    const companyName = company?.name || 'EUGINE MEDIA GROUP';
    const companyPhone = company?.phone || '';

    // Fetch all PENDING/OVERDUE invoices
    const invoices = await prisma.invoice.findMany({
      where: {
        status: { in: ['PENDING', 'OVERDUE'] },
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

    // Filter out Muara Beres / KMB in memory to be 100% thorough
    const filteredInvoices = invoices.filter(inv => {
      const areaName = inv.user?.area?.name || '';
      const address = inv.user?.address || '';
      const lowerArea = areaName.toLowerCase();
      const lowerAddress = address.toLowerCase();
      return !lowerArea.includes('muara beres') && !lowerArea.includes('kmb') && !lowerAddress.includes('muara beres');
    });

    console.log(`📋 Ditemukan ${filteredInvoices.length} tagihan (Non-Muara Beres) yang akan dikirim ulang.\n`);

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

      console.log(`📱 [${i + 1}/${filteredInvoices.length}] Pengiriman WA ${inv.invoiceNumber} -> ${name} (${phone})...`);

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
          dueDate: inv.dueDate,
          paymentLink: inv.paymentLink || `${company?.baseUrl || 'http://euginemediagroup.com'}/pay/${inv.paymentToken}`,
          companyName,
          companyPhone,
          isOverdue: inv.status === 'OVERDUE',
        });
        sent++;
        console.log(`   ✅ Terkirim!`);

        // Jeda 1.5 detik per pesan agar aman & tidak kena spam limit
        await new Promise(resolve => setTimeout(resolve, 1500));
      } catch (err: any) {
        failed++;
        console.error(`   ❌ Gagal:`, err?.message || err);
      }
    }

    console.log(`\n🎉 Pengiriman ulang selesai! Total Terkirim: ${sent}, Gagal: ${failed}`);
  } catch (error) {
    console.error('❌ Script error:', error);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

resendInvoices();
