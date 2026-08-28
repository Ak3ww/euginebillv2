'use strict';
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== MENCARI TAGIHAN & PELANGGAN TANPA ROUTER ===\n');

  // 1. Invoices in August 2026 where user is null or user.routerId is null
  const startOfAug = new Date('2026-08-01T00:00:00.000Z');
  const startOfSep = new Date('2026-09-01T00:00:00.000Z');

  const unassignedInvoices = await prisma.invoice.findMany({
    where: {
      dueDate: { gte: startOfAug, lt: startOfSep },
      OR: [
        { user: null },
        { user: { routerId: null } },
      ],
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          username: true,
          customerId: true,
          phone: true,
          routerId: true,
          areaId: true,
          area: { select: { id: true, name: true, routerId: true, router: { select: { name: true } } } },
        },
      },
    },
  });

  console.log(`Ditemukan ${unassignedInvoices.length} tagihan Agustus tanpa router:\n`);

  for (let i = 0; i < unassignedInvoices.length; i++) {
    const inv = unassignedInvoices[i];
    const user = inv.user;
    console.log(`${i + 1}. [${inv.invoiceNumber}] - Rp ${inv.amount.toLocaleString('id-ID')} (${inv.status})`);
    console.log(`   - Nama: ${inv.customerName || user?.name || '-'}`);
    console.log(`   - Username: ${inv.customerUsername || user?.username || '-'}`);
    console.log(`   - Customer ID: ${user?.customerId || '-'}`);
    console.log(`   - User ID di Invoice: ${inv.userId || 'NULL (Tidak Terlink)'}`);
    console.log(`   - Wilayah / Area: ${user?.area?.name || 'Tanpa Area'}`);
    console.log(`   - Rekomendasi Router: ${user?.area?.router?.name || 'MIKROTIK CIBINONG SITE (Default)'}`);
    console.log('--------------------------------------------------');
  }

  // 2. All PPPoE Users where routerId is null
  const usersWithoutRouter = await prisma.pppoeUser.findMany({
    where: {
      OR: [
        { routerId: null },
        { routerId: '' },
      ],
    },
    include: {
      area: { select: { name: true, routerId: true, router: { select: { name: true } } } },
    },
  });

  console.log(`\nTotal Pelanggan PPPoE tanpa router di database: ${usersWithoutRouter.length} user:`);
  for (const u of usersWithoutRouter) {
    console.log(`  - [${u.username}] ${u.name} (Area: ${u.area?.name || '-'}) -> Suggested Router: ${u.area?.router?.name || 'MIKROTIK CIBINONG SITE'}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
