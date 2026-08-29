const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== MEMERIKSA STATUS PELANGGAN DENGAN SPK SELESAI ===\n');

  // 1. Ambil semua Work Order (SPK) yang berstatus COMPLETED
  const completedWOs = await prisma.workOrder.findMany({
    where: {
      status: 'COMPLETED',
    },
    include: {
      customer: true,
    },
    orderBy: { completedAt: 'desc' },
  });

  console.log(`Ditemukan ${completedWOs.length} SPK dengan status COMPLETED.`);

  let updatedCount = 0;

  for (const wo of completedWOs) {
    const isDismantle = wo.issueType?.toUpperCase().includes('DISMANTLE') || wo.issueType?.toUpperCase().includes('CABUT');
    if (isDismantle) continue;

    let targetUser = wo.customer;

    // Jika linkedUserId belum ada pada SPK, cari berdasarkan nomor HP atau Nama
    if (!targetUser && (wo.customerPhone || wo.customerName)) {
      const cleanPhone = (wo.customerPhone || '').replace(/\D/g, '');
      const phoneVariations = cleanPhone ? [
        cleanPhone,
        '0' + cleanPhone.replace(/^62/, ''),
        '62' + cleanPhone.replace(/^0/, ''),
      ] : [];

      targetUser = await prisma.pppoeUser.findFirst({
        where: {
          OR: [
            ...(phoneVariations.length > 0 ? [{ phone: { in: phoneVariations } }] : []),
            { name: { equals: wo.customerName.trim() } },
          ],
        },
      });

      if (targetUser) {
        // Tautkan SPK ke ID Pelanggan
        await prisma.workOrder.update({
          where: { id: wo.id },
          data: { linkedUserId: targetUser.id },
        }).catch(() => {});
      }
    }

    if (targetUser) {
      const currentStatus = (targetUser.status || '').toUpperCase();
      if (currentStatus !== 'ACTIVE') {
        console.log(`\n[UPDATE] Mengaktifkan Pelanggan:`);
        console.log(`- Nama     : ${targetUser.name}`);
        console.log(`- Username : ${targetUser.username}`);
        console.log(`- HP       : ${targetUser.phone}`);
        console.log(`- Status   : ${targetUser.status} -> ACTIVE`);

        await prisma.pppoeUser.update({
          where: { id: targetUser.id },
          data: { status: 'ACTIVE' },
        });

        // Update registration request jika ada
        await prisma.registrationRequest.updateMany({
          where: { pppoeUserId: targetUser.id, status: { in: ['PENDING', 'APPROVED'] } },
          data: { status: 'INSTALLED' },
        }).catch(() => {});

        // Tautkan Invoice jika userId belum terisi
        await prisma.invoice.updateMany({
          where: {
            OR: [
              { customerPhone: targetUser.phone },
              { customerUsername: targetUser.username },
            ],
            userId: null,
          },
          data: { userId: targetUser.id },
        }).catch(() => {});

        updatedCount++;
      }
    }
  }

  // 2. Periksa juga pelanggan dengan username EMG338 / Alysa Biana secara spesifik
  const specificUsers = await prisma.pppoeUser.findMany({
    where: {
      OR: [
        { username: 'EMG338' },
        { name: { contains: 'Alysa' } },
        { status: { in: ['PENDING_INSTALLATION', 'pending_installation', 'PENDING', 'pending'] } },
      ],
    },
  });

  for (const u of specificUsers) {
    const hasCompletedWo = await prisma.workOrder.findFirst({
      where: {
        OR: [
          { linkedUserId: u.id },
          { customerPhone: u.phone },
          { customerName: u.name },
        ],
        status: 'COMPLETED',
      },
    });

    const isAlysa = u.username === 'EMG338' || u.name.toLowerCase().includes('alysa');

    if ((hasCompletedWo || isAlysa) && u.status?.toUpperCase() !== 'ACTIVE') {
      console.log(`\n[UPDATE SPESIFIK] Mengaktifkan Pelanggan:`);
      console.log(`- Nama     : ${u.name}`);
      console.log(`- Username : ${u.username}`);
      console.log(`- Status   : ${u.status} -> ACTIVE`);

      await prisma.pppoeUser.update({
        where: { id: u.id },
        data: { status: 'ACTIVE' },
      });

      await prisma.registrationRequest.updateMany({
        where: { pppoeUserId: u.id, status: { in: ['PENDING', 'APPROVED'] } },
        data: { status: 'INSTALLED' },
      }).catch(() => {});

      updatedCount++;
    }
  }

  console.log(`\n========================================`);
  console.log(`SELESAI: Berhasil memperbarui ${updatedCount} pelanggan menjadi status ACTIVE.`);
  console.log(`========================================\n`);
}

main()
  .catch((e) => {
    console.error('Error saat menjalankan script:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
