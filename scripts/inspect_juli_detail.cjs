'use strict';
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const startOfJuly = new Date('2026-07-01T00:00:00.000Z');
  const startOfAugust = new Date('2026-08-01T00:00:00.000Z');

  console.log('=== INVESTIGASI RINCI TAGIHAN JULI 2026 ===\n');

  // Query 1: Invoices where paidAt is in July 2026
  const paidInJuly = await prisma.invoice.findMany({
    where: {
      status: 'PAID',
      paidAt: { gte: startOfJuly, lt: startOfAugust },
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          username: true,
          routerId: true,
          router: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { paidAt: 'asc' },
  });

  console.log(`[A] Tagihan yang dibayar di bulan Juli 2026 (paidAt in July): ${paidInJuly.length} tagihan`);
  let paidInJulySum = 0;
  const routerJulyMap = {};

  for (const inv of paidInJuly) {
    paidInJulySum += inv.amount;
    const rName = inv.user?.router?.name || (inv.user?.routerId ? `RouterID: ${inv.user.routerId}` : 'Tanpa Router');
    if (!routerJulyMap[rName]) routerJulyMap[rName] = { count: 0, sum: 0 };
    routerJulyMap[rName].count++;
    routerJulyMap[rName].sum += inv.amount;
  }
  console.log('Total Nominal: Rp', paidInJulySum.toLocaleString('id-ID'));
  console.log('Rincian per Router:', routerJulyMap);

  // Query 2: Invoices where dueDate is in July 2026
  const dueInJuly = await prisma.invoice.findMany({
    where: {
      dueDate: { gte: startOfJuly, lt: startOfAugust },
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          username: true,
          routerId: true,
          router: { select: { id: true, name: true } },
        },
      },
    },
  });

  console.log(`\n[B] Tagihan yang jatuh tempo di bulan Juli 2026 (dueDate in July): ${dueInJuly.length} tagihan`);
  let dueInJulyPaidCount = 0;
  let dueInJulyUnpaidCount = 0;
  for (const inv of dueInJuly) {
    if (inv.status === 'PAID') dueInJulyPaidCount++;
    else dueInJulyUnpaidCount++;
  }
  console.log(`  - Lunas: ${dueInJulyPaidCount}`);
  console.log(`  - Belum Lunas: ${dueInJulyUnpaidCount}`);

  // Query 3: Invoices created in July 2026
  const createdInJuly = await prisma.invoice.findMany({
    where: {
      createdAt: { gte: startOfJuly, lt: startOfAugust },
    },
    select: {
      id: true,
      invoiceNumber: true,
      amount: true,
      status: true,
      dueDate: true,
      paidAt: true,
      createdAt: true,
      notes: true,
      customerUsername: true,
      customerName: true,
    },
    take: 10,
  });
  console.log(`\n[C] Total Tagihan dibuat pada bulan Juli 2026 (createdAt in July): ${createdInJuly.length}`);
  console.log('Contoh 5 data pertama:');
  for (const inv of createdInJuly.slice(0, 5)) {
    console.log(`  - ${inv.invoiceNumber} | ${inv.customerName || inv.customerUsername} | Rp ${inv.amount.toLocaleString('id-ID')} | Status: ${inv.status} | Created: ${inv.createdAt?.toISOString().split('T')[0]} | Due: ${inv.dueDate?.toISOString().split('T')[0]} | Paid: ${inv.paidAt?.toISOString().split('T')[0] || 'NULL'}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
