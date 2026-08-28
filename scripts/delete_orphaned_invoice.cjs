'use strict';
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== PENGHAPUSAN TAGIHAN GHOST / ORPHANED INVOICE ===\n');

  // 1. Hapus invoice AKEW (INV-20260801-84EBF8)
  const deletedAkew = await prisma.invoice.deleteMany({
    where: {
      OR: [
        { invoiceNumber: 'INV-20260801-84EBF8' },
        { customerUsername: 'EMGCAKEW' },
      ],
    },
  });
  console.log(`[1] Berhasil menghapus ${deletedAkew.count} tagihan AKEW (EMGCAKEW / INV-20260801-84EBF8).`);

  // 2. Hapus seluruh unpaid invoices (PENDING / OVERDUE) yang sudah tidak memiliki pelanggan (userId = null)
  const deletedOrphans = await prisma.invoice.deleteMany({
    where: {
      userId: null,
      status: { in: ['PENDING', 'OVERDUE'] },
    },
  });
  console.log(`[2] Berhasil menghapus ${deletedOrphans.count} tagihan belum bayar dari pelanggan yang sudah dihapus.`);

  console.log('\n=== SELESAI! Tagihan ghost telah dibersihkan 100%. ===');
}

main().catch(console.error).finally(() => prisma.$disconnect());
