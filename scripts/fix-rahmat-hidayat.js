#!/usr/bin/env node
/**
 * One-click fix for Rahmat Hidayat's September Cash Payment & Duplicate Cleanup
 * 
 * Usage:
 *   node scripts/fix-rahmat-hidayat.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('='.repeat(70));
  console.log('🔧 FIX STATUS & TAGIHAN RAHMAT HIDAYAT (EMG297)');
  console.log('='.repeat(70) + '\n');

  // 1. Cari user Rahmat Hidayat
  const user = await prisma.pppoeUser.findFirst({
    where: {
      OR: [
        { username: 'EMG297' },
        { name: { contains: 'RAHMAT HIDAYAT' } }
      ]
    },
    include: {
      invoices: {
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  if (!user) {
    console.log('❌ User RAHMAT HIDAYAT (EMG297) tidak ditemukan di database.');
    return;
  }

  console.log(`👤 Ditemukan: ${user.name} (${user.username}) - ID: ${user.id}`);
  console.log(`   Daftar tagihan saat ini: ${user.invoices.length} tagihan\n`);

  // 2. Identifikasi tagihan duplikat tanggal 5 Okt 2026
  const octInvoices = user.invoices.filter(i => {
    if (!i.dueDate) return false;
    const d = new Date(i.dueDate);
    return d.getMonth() === 9 && i.status === 'PENDING'; // Month index 9 = Oktober
  });

  console.log(`🔍 Ditemukan ${octInvoices.length} tagihan PENDING bertanggal jatuh tempo Oktober:`);
  for (const inv of octInvoices) {
    console.log(`   • [${inv.invoiceNumber}] Due: ${inv.dueDate.toISOString().slice(0, 10)} | Status: ${inv.status} | Created: ${inv.createdAt.toISOString().slice(0, 10)}`);
  }

  if (octInvoices.length === 0) {
    console.log('ℹ️ Tidak ditemukan tagihan Oktober yang perlu diperbaiki.');
    return;
  }

  // Ambil invoice pertama untuk diubah menjadi Tagihan Lunas September 2026
  const invToPay = octInvoices[0];
  const septDueDate = new Date('2026-09-05T23:59:59.999Z');
  const paidDate = new Date('2026-09-02T12:00:00.000Z');

  console.log(`\n1️⃣ Mengubah [${invToPay.invoiceNumber}] menjadi Tagihan LUNAS September:`);
  await prisma.invoice.update({
    where: { id: invToPay.id },
    data: {
      dueDate: septDueDate,
      status: 'PAID',
      paidAt: paidDate,
      paymentMethod: 'CASH',
      notes: 'Pelunasan Cash September 2026 (Diperbarui via script fix)',
    }
  });
  console.log(`   ✅ Selesai: DueDate diubah ke 2026-09-05, Status: PAID (Lunas Cash).`);

  // Hapus invoice duplikat sisanya (jika ada lebih dari 1 invoice pending Oktober)
  const duplicatesToDelete = octInvoices.slice(1);
  if (duplicatesToDelete.length > 0) {
    console.log(`\n2️⃣ Menghapus ${duplicatesToDelete.length} tagihan duplikat yang berlebih:`);
    for (const dup of duplicatesToDelete) {
      await prisma.payment.deleteMany({ where: { invoiceId: dup.id } }).catch(() => {});
      await prisma.invoice.delete({ where: { id: dup.id } });
      console.log(`   🗑️ Dihapus: [${dup.invoiceNumber}]`);
    }
  }

  // 3. Pastikan user aktif dan masa aktif sampai 5 Oktober 2026
  const nextExp = new Date('2026-10-05T23:59:59.999Z');
  await prisma.pppoeUser.update({
    where: { id: user.id },
    data: {
      status: 'active',
      expiredAt: nextExp,
    }
  });
  console.log(`\n3️⃣ Memperbarui akun pelanggan:`);
  console.log(`   ✅ Status Akun : active`);
  console.log(`   ✅ Masa Aktif  : 05 Oktober 2026`);

  console.log('\n' + '='.repeat(70));
  console.log('🎉 PERBAIKAN SELESAI!');
  console.log('Sekarang tagihan September Rahmat Hidayat sudah tercatat LUNAS (CASH)');
  console.log('dan akan langsung muncul di tab "Lunas" / "Semua" pada bulan September 2026 di UI.');
  console.log('='.repeat(70));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
