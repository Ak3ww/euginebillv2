import { prisma } from '../src/server/db/client';

async function checkWaStatus() {
  console.log('====================================================');
  console.log('🔍 INVOICE WHATSAPP REMINDER STATUS VERIFICATION');
  console.log('====================================================\n');

  // Fetch all pending / overdue invoices with user, area, and router details
  const invoices = await prisma.invoice.findMany({
    where: {
      status: { in: ['PENDING', 'OVERDUE'] }
    },
    include: {
      user: {
        include: {
          area: {
            include: {
              router: true
            }
          },
          router: true
        }
      }
    },
    orderBy: { dueDate: 'asc' }
  });

  console.log(`📦 Found Total ${invoices.length} Unpaid / Pending Invoice(s) in System.\n`);

  if (invoices.length === 0) {
    console.log('✅ All invoices are PAID! No pending reminders.');
    await prisma.$disconnect();
    return;
  }

  // Group invoices by NAS / Router
  const nasBreakdown: Record<string, {
    routerName: string;
    total: number;
    sentCount: number;
    unsentCount: number;
    failedCount: number;
    invoices: Array<{
      invoiceNumber: string;
      customerName: string;
      username: string;
      phone: string;
      amount: number;
      dueDate: Date;
      waNotifiedAt: Date | null;
      sentReminders: string | null;
      waRetryCount: number;
      areaName: string;
    }>;
  }> = {};

  for (const inv of invoices) {
    const routerName = inv.user?.router?.name || inv.user?.area?.router?.name || 'NAS (Default / Unassigned)';
    const routerId = inv.user?.routerId || inv.user?.area?.routerId || 'unassigned';

    if (!nasBreakdown[routerId]) {
      nasBreakdown[routerId] = {
        routerName,
        total: 0,
        sentCount: 0,
        unsentCount: 0,
        failedCount: 0,
        invoices: []
      };
    }

    const isSent = Boolean(inv.waNotifiedAt || (inv.sentReminders && inv.sentReminders !== '[]'));
    const isFailed = Boolean(!isSent && (inv as any).waRetryCount >= 4);

    nasBreakdown[routerId].total += 1;
    if (isSent) {
      nasBreakdown[routerId].sentCount += 1;
    } else if (isFailed) {
      nasBreakdown[routerId].failedCount += 1;
    } else {
      nasBreakdown[routerId].unsentCount += 1;
    }

    nasBreakdown[routerId].invoices.push({
      invoiceNumber: inv.invoiceNumber,
      customerName: inv.customerName || inv.user?.name || 'Tanpa Nama',
      username: inv.customerUsername || inv.user?.username || '-',
      phone: inv.customerPhone || inv.user?.phone || '-',
      amount: inv.amount,
      dueDate: inv.dueDate,
      waNotifiedAt: inv.waNotifiedAt,
      sentReminders: inv.sentReminders,
      waRetryCount: (inv as any).waRetryCount || 0,
      areaName: inv.user?.area?.name || 'Tanpa Wilayah'
    });
  }

  // Print Summary per NAS
  console.log('📡 SUMMARY BREAKDOWN PER NAS / ROUTER:');
  console.log('----------------------------------------------------');
  for (const [rId, group] of Object.entries(nasBreakdown)) {
    const pct = Math.round((group.sentCount / group.total) * 100) || 0;
    console.log(`\n🔹 Router/NAS: ${group.routerName}`);
    console.log(`   - Total Tagihan Belum Lunas: ${group.total}`);
    console.log(`   - ✅ WA Terkirim            : ${group.sentCount} (${pct}%)`);
    console.log(`   - ⏳ WA Belum Terkirim      : ${group.unsentCount}`);
    console.log(`   - ❌ WA Gagal Retry (>4x)   : ${group.failedCount}`);
  }

  console.log('\n----------------------------------------------------');

  // Print Detailed Unsent Customers (if any)
  for (const [rId, group] of Object.entries(nasBreakdown)) {
    const unsentList = group.invoices.filter(i => !i.waNotifiedAt && (!i.sentReminders || i.sentReminders === '[]'));
    if (unsentList.length > 0) {
      console.log(`\n⚠️ DAFTAR PELANGGAN BELUM TERKIRIM WA [NAS: ${group.routerName}] (${unsentList.length} orang):`);
      unsentList.forEach((item, idx) => {
        const dueStr = item.dueDate.toISOString().split('T')[0];
        console.log(`   ${idx + 1}. [${item.invoiceNumber}] ${item.customerName} (@${item.username}) - HP: ${item.phone} | Due: ${dueStr} | Area: ${item.areaName} | Retry: ${item.waRetryCount}x`);
      });
    } else {
      console.log(`\n🎉 NAS "${group.routerName}": SELURUH ${group.total} PELANGGAN TELAH BERHASIL MENERIMA WA!`);
    }
  }

  console.log('\n====================================================');
  console.log('💡 TIP: Untuk mengirim reminder WA ke pelanggan belum terkirim,');
  console.log('      jalankan: npx tsx scripts/trigger-wa-bulk.ts');
  console.log('====================================================');

  await prisma.$disconnect();
}

checkWaStatus().catch(err => {
  console.error('❌ Check WA Status Error:', err);
  process.exit(1);
});
