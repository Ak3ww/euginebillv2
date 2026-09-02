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

  // 3. Sinkronisasi nomor HP & Nama pelanggan ke semua Invoice & Work Order yang tertaut
  console.log('\n=== MENYINKRONKAN NOMOR HP PELANGGAN KE INVOICE & SPK ===');
  const allUsers = await prisma.pppoeUser.findMany({
    select: { id: true, name: true, phone: true, username: true },
  });

  let syncedInvoicesCount = 0;
  for (const user of allUsers) {
    if (user.phone) {
      const updatedInv = await prisma.invoice.updateMany({
        where: {
          userId: user.id,
          OR: [
            { customerPhone: { not: user.phone } },
            { customerPhone: null },
            { customerName: { not: user.name } },
          ],
        },
        data: {
          customerPhone: user.phone,
          customerName: user.name,
        },
      });

      if (updatedInv.count > 0) {
        console.log(`[SYNC HP] Pelanggan ${user.name} (${user.username}): Diperbarui ${updatedInv.count} invoice ke nomor ${user.phone}`);
        syncedInvoicesCount += updatedInv.count;
      }

      await prisma.workOrder.updateMany({
        where: {
          linkedUserId: user.id,
          OR: [
            { customerPhone: { not: user.phone } },
            { customerName: { not: user.name } },
          ],
        },
        data: {
          customerPhone: user.phone,
          customerName: user.name,
        },
      }).catch(() => {});
    }
  }

  // 4. Sinkronisasi Tanggal Jatuh Tempo Invoice dengan expiredAt Pelanggan Aktif
  console.log('\n=== MENYINKRONKAN JATUH TEMPO INVOICE DENGAN EXPIRED PELANGGAN AKTIF ===');
  const activeUsersWithFutureExpiry = await prisma.pppoeUser.findMany({
    where: {
      expiredAt: {
        gt: new Date(),
      },
    },
    select: { id: true, username: true, name: true, expiredAt: true },
  });

  let syncedDueDateCount = 0;
  for (const u of activeUsersWithFutureExpiry) {
    if (u.expiredAt) {
      const invUpdated = await prisma.invoice.updateMany({
        where: {
          userId: u.id,
          status: { in: ['PENDING', 'OVERDUE'] },
        },
        data: {
          dueDate: u.expiredAt,
          status: 'PENDING',
          sentReminders: '[]', // Reset history agar tidak terjebak di reminder kadaluwarsa
        },
      });

      if (invUpdated.count > 0) {
        console.log(`[SYNC JATUH TEMPO] Pelanggan ${u.name} (${u.username}): Sinkronisasi ${invUpdated.count} invoice -> Jatuh Tempo ${u.expiredAt.toISOString()}`);
        syncedDueDateCount += invUpdated.count;
      }
    }
  }

  // 5. Memperbaiki Nominal Tagihan yang Terpotong / Salah Prorata (seperti Halimah Rp 10.000, Rahmat Nugraha Rp 95.000)
  console.log('\n=== MEMPERBAIKI NOMINAL TAGIHAN BULANAN YANG SALAH PRORATA ===');
  const recentInvoicesWithPriceMismatch = await prisma.invoice.findMany({
    where: {
      status: { in: ['PENDING', 'OVERDUE'] },
    },
    include: {
      user: {
        include: { profile: true },
      },
    },
  });

  let fixedPriceCount = 0;
  for (const inv of recentInvoicesWithPriceMismatch) {
    if (inv.user?.profile) {
      const fullPrice = Number(inv.user.profile.price);
      const currentAmount = Number(inv.amount);
      const isSepInvoice = inv.invoiceNumber?.startsWith('INV-202609') || (inv.dueDate && new Date(inv.dueDate).getMonth() === 8);

      // Jika nominal tagihan lebih kecil dari harga paket dan dibuat untuk bulan September / salah tipe INSTALLATION
      if (currentAmount < fullPrice && (inv.invoiceType === 'INSTALLATION' || isSepInvoice)) {
        await prisma.invoice.update({
          where: { id: inv.id },
          data: {
            amount: fullPrice,
            baseAmount: fullPrice,
            invoiceType: 'MONTHLY',
          },
        });

        console.log(`[FIX HARGA] Tagihan ${inv.invoiceNumber} milik ${inv.user.name} (${inv.user.username}): Dikembalikan dari Rp ${currentAmount.toLocaleString('id-ID')} -> Rp ${fullPrice.toLocaleString('id-ID')} (Paket: ${inv.user.profile.name})`);
        fixedPriceCount++;
      }
    }
  }

  // 6. Hapus Tagihan Bulan Terakhir (September 2026) Milik Pelanggan yang Sudah Berstatus Berhenti (STOP / STOPPED / -OFF-)
  // CATATAN: Tagihan bulan Agustus dan ke belakang TETAP DIPERTAHANKAN untuk rekapan & riwayat keuangan!
  console.log('\n=== MENGHAPUS TAGIHAN SEPTEMBER MILIK PELANGGAN BERHENTI (STOP) ===');
  const currentMonthStart = new Date('2026-09-01T00:00:00Z');

  const stoppedUserInvoices = await prisma.invoice.findMany({
    where: {
      status: { in: ['PENDING', 'OVERDUE'] },
      OR: [
        { invoiceNumber: { startsWith: 'INV-202609' } },
        { createdAt: { gte: currentMonthStart } },
        { dueDate: { gte: currentMonthStart } },
      ],
      user: {
        OR: [
          { status: { in: ['stop', 'STOP', 'stopped', 'STOPPED', 'dismantle', 'DISMANTLE', 'inactive', 'INACTIVE', 'terminated', 'TERMINATED'] } },
          { username: { contains: '-OFF-' } },
        ],
      },
    },
    include: {
      user: {
        select: { id: true, username: true, name: true, status: true },
      },
    },
  });

  let deletedStoppedCount = 0;
  for (const inv of stoppedUserInvoices) {
    await prisma.invoice.delete({
      where: { id: inv.id },
    }).catch(() => {});

    console.log(`[HAPUS TAGIHAN STOP SEPTEMBER] Menghapus tagihan September ${inv.invoiceNumber} (Rp ${Number(inv.amount).toLocaleString('id-ID')}) milik pelanggan berhenti: ${inv.user?.name || inv.customerName} (${inv.user?.username || inv.customerUsername}, status: ${inv.user?.status}) - Tagihan lama tetap aman.`);
    deletedStoppedCount++;
  }

  console.log(`\n========================================`);
  console.log(`SELESAI: Berhasil mengaktifkan ${updatedCount} pelanggan, menyinkronkan ${syncedInvoicesCount} nomor HP invoice, menyinkronkan ${syncedDueDateCount} jatuh tempo invoice, memperbaiki ${fixedPriceCount} nominal tagihan yang terpotong, dan menghapus ${deletedStoppedCount} tagihan pelanggan berhenti (STOP).`);
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
