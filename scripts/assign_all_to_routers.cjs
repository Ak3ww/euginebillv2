'use strict';
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== AUTO-ASSIGN PELANGGAN & TAGIHAN KE ROUTER ===\n');

  // 1. Ambil router Cibinong & Citeureup
  const allRouters = await prisma.router.findMany();
  const cibinongRouter = allRouters.find(r => r.name.toLowerCase().includes('cibinong')) || allRouters[0];
  const citeureupRouter = allRouters.find(r => r.name.toLowerCase().includes('citeureup'));

  console.log(`Router Utama: ${cibinongRouter.name} (${cibinongRouter.id})`);
  if (citeureupRouter) {
    console.log(`Router Sekunder: ${citeureupRouter.name} (${citeureupRouter.id})`);
  }

  // 2. Link unlinked invoices ke pppoe_users
  const allUsers = await prisma.pppoeUser.findMany({
    include: { area: true },
  });
  const userByUsername = new Map(allUsers.map(u => [u.username.toLowerCase(), u]));

  const unlinkedInvoices = await prisma.invoice.findMany({
    where: {
      OR: [
        { userId: null },
        { userId: '' },
      ],
    },
  });

  let reLinkedCount = 0;
  for (const inv of unlinkedInvoices) {
    if (inv.customerUsername) {
      const u = userByUsername.get(inv.customerUsername.toLowerCase());
      if (u) {
        await prisma.invoice.update({
          where: { id: inv.id },
          data: {
            userId: u.id,
            customerName: inv.customerName || u.name,
            customerPhone: u.phone,
          },
        });
        reLinkedCount++;
      }
    }
  }
  console.log(`[1] Berhasil menyambungkan ${reLinkedCount} tagihan ke data pelanggan.`);

  // 3. Assign routerId ke pelanggan yang belum punya router
  const usersWithoutRouter = await prisma.pppoeUser.findMany({
    where: {
      OR: [
        { routerId: null },
        { routerId: '' },
      ],
    },
    include: { area: true },
  });

  let assignedUsersCount = 0;
  for (const u of usersWithoutRouter) {
    let targetRouterId = cibinongRouter.id;
    // Cek jika areanya mengarah ke Citeureup
    if (u.area?.routerId) {
      targetRouterId = u.area.routerId;
    } else if (u.area?.name?.toLowerCase().includes('citeureup') && citeureupRouter) {
      targetRouterId = citeureupRouter.id;
    }

    await prisma.pppoeUser.update({
      where: { id: u.id },
      data: { routerId: targetRouterId },
    });
    assignedUsersCount++;
  }
  console.log(`[2] Berhasil meng-assign ${assignedUsersCount} pelanggan ke router yang sesuai.`);

  console.log('\n=== SELESAI! Seluruh pelanggan & tagihan kini sudah memiliki router. ===');
}

main().catch(console.error).finally(() => prisma.$disconnect());
