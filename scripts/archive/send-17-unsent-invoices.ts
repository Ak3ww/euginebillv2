import { PrismaClient } from '@prisma/client';
import { sendInvoiceReminder } from '../src/server/services/notifications/whatsapp-templates.service';

const prisma = new PrismaClient();

async function send17UnsentInvoices() {
  console.log('🚀 Memulai pengiriman WA tagihan KHUSUS untuk pelanggan (Belum WA)...\n');

  try {
    // 1. Enable WhatsApp reminder settings in DB so messages are actually sent to device
    await prisma.whatsapp_reminder_settings.updateMany({
      data: { enabled: true },
    });

    console.log('✅ WA Reminder Settings: ENABLED (enabled = true). Pesan WA akan benar-benar terkirim ke HP!\n');

    const company = await prisma.company.findFirst();
    const companyName = company?.name || 'EUGINE MEDIA GROUP';
    const companyPhone = company?.phone || '';

    // Target Due Date: 5 August 2026
    const targetDueDate = new Date('2026-08-05T12:00:00.000Z');

    // Reset waNotifiedAt for unsent/skipped invoices
    const skippedInvoiceNumbers = [
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

    await prisma.invoice.updateMany({
      where: {
        invoiceNumber: { in: skippedInvoiceNumbers },
      },
      data: {
        waNotifiedAt: null,
        waRetryCount: 0,
      },
    });

    // Fetch strictly unsent invoices (waNotifiedAt is null)
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

    // Filter out Muara Beres / KMB in memory
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
        const result: any = await sendInvoiceReminder({
          phone,
          customerName: name,
          customerId: inv.user?.customerId || inv.user?.username || '-',
          customerUsername: inv.user?.username,
          profileName: inv.user?.profile?.name || inv.profileName || '-',
          area: inv.user?.area?.name || '-',
          invoiceNumber: inv.invoiceNumber,
          amount: inv.amount,
          dueDate: targetDueDate,
          paymentLink: inv.paymentLink || `${company?.baseUrl || 'http://euginemediagroup.com'}/pay/${inv.paymentToken}`,
          companyName,
          companyPhone,
          isOverdue: false,
        });

        if (result === undefined || result?.success === true) {
          await prisma.invoice.update({
            where: { id: inv.id },
            data: {
              waNotifiedAt: new Date(),
              waRetryCount: (inv.waRetryCount || 0) + 1,
              dueDate: targetDueDate,
            },
          });
          sent++;
          console.log(`   🎉 REAL SENT & DB Updated: WA Terkirim (1x)\n`);
        } else {
          failed++;
          console.log(`   ⚠️ Gagal: ${result?.error || 'Pesan gagal terkirim'}\n`);
        }

        // Delay 1.5s per message
        await new Promise(resolve => setTimeout(resolve, 1500));
      } catch (err: any) {
        failed++;
        console.error(`   ❌ Gagal:`, err?.message || err);
      }
    }

    console.log(`\n🎉 SELESAI! Total Berhasil Terkirim Real: ${sent}, Gagal: ${failed}`);
  } catch (error) {
    console.error('❌ Script error:', error);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

send17UnsentInvoices();
