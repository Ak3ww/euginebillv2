import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAllInvoicesWaSentStatus() {
  console.log('🔍 Memeriksa status pengiriman WA untuk seluruh tagihan (periode Juli/Agustus 2026)...\n');

  try {
    // Fetch all active invoices (unpaid, overdue, or recently created)
    const invoices = await prisma.invoice.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
            customerId: true,
            area: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    console.log(`📋 Total Tagihan di Database: ${invoices.length}`);

    // Exclude LUTFI FEBRIYANDI (baru pasang hari ini)
    const lutfiInvoices = invoices.filter(inv => inv.user?.name?.toUpperCase().includes('LUTFI FEBRIYANDI'));
    const targetInvoices = invoices.filter(inv => !inv.user?.name?.toUpperCase().includes('LUTFI FEBRIYANDI'));

    console.log(`ℹ️ Tagihan Lutfi Febriyandi (Dilewati): ${lutfiInvoices.length}`);
    console.log(`🎯 Total Tagihan Yang Harus Terkirim: ${targetInvoices.length}\n`);

    const sentInvoices = targetInvoices.filter(inv => inv.waNotifiedAt !== null);
    const unsentInvoices = targetInvoices.filter(inv => inv.waNotifiedAt === null);

    console.log(`✅ Tagihan WA Sudah Terkirim: ${sentInvoices.length}`);
    console.log(`⚠️ Tagihan WA Belum Terkirim: ${unsentInvoices.length}\n`);

    if (unsentInvoices.length > 0) {
      console.log('📋 RINCIAN TAGIHAN BELUM TERKIRIM WA:');
      unsentInvoices.forEach((inv, index) => {
        console.log(`  [${index + 1}] Invoice: ${inv.invoiceNumber} | Nama: ${inv.user?.name || 'Tanpa Nama'} | Telp: ${inv.user?.phone || '-'} | Wilayah: ${inv.user?.area?.name || '-'}`);
      });
    } else {
      console.log('🎉 SEMUA TAGIHAN SUDAH 100% TERKIRIM WA SEPENUHNYA!');
    }

  } catch (error) {
    console.error('❌ Error checking invoice WA status:', error);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

checkAllInvoicesWaSentStatus();
