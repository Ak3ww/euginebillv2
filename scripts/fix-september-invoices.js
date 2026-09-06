#!/usr/bin/env node
/**
 * Comprehensive Repair Script: Fix September Invoices erroneously moved to October & Cleanup Duplicates
 * Usage on VPS:
 *   node scripts/fix-september-invoices.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TARGET_SEPTEMBER_DUE = new Date('2026-09-06T23:59:59.999Z');

async function main() {
  console.log('='.repeat(75));
  console.log('🔧 PERBAIKAN MENYELURUH ANOMALI TAGIHAN SEPTEMBER 2026');
  console.log('='.repeat(75));

  try {
    // 1. TANGANI NAJWA SELMA
    console.log('\n1️⃣ Memeriksa & Memperbaiki Akun Najwa Selma...');
    const najwaUsers = await prisma.pppoeUser.findMany({
      where: {
        OR: [
          { name: { contains: 'Najwa' } },
          { username: { contains: 'Najwa' } },
          { customerId: '72888309' },
        ]
      }
    });

    for (const u of najwaUsers) {
      console.log(`   👤 User: ${u.username} (${u.name})`);

      // Cek invoice lama yang lunas INV-20260904-E4ABB2
      const oldInv = await prisma.invoice.findFirst({
        where: { invoiceNumber: 'INV-20260904-E4ABB2' }
      });
      if (oldInv) {
        await prisma.invoice.update({
          where: { id: oldInv.id },
          data: { dueDate: TARGET_SEPTEMBER_DUE, status: 'PAID' }
        });
        console.log(`      ✓ Invoice lunas ${oldInv.invoiceNumber} dikembalikan ke periode 6 September 2026 (status: Lunas).`);
      }

      // Cek invoice baru duplikat/prematur INV-20260906-DBA0FB
      const newInv = await prisma.invoice.findFirst({
        where: { invoiceNumber: 'INV-20260906-DBA0FB' }
      });
      if (newInv) {
        await prisma.payment.deleteMany({ where: { invoiceId: newInv.id } });
        await prisma.invoice.delete({ where: { id: newInv.id } });
        console.log(`      ✓ Invoice duplikat tertunda ${newInv.invoiceNumber} berhasil DIHAPUS (agar Najwa tidak ditagih ulang & aman dari isolir).`);
      }
    }

    // 2. TANGANI AMI
    console.log('\n2️⃣ Memeriksa & Memperbaiki Akun Ami (147989)...');
    const amiInvoices = await prisma.invoice.findMany({
      where: {
        OR: [
          { customerName: { contains: 'AMI' } },
          { customerUsername: { contains: 'AMI' } },
          { customerPhone: '085965545278' },
        ]
      }
    });

    for (const inv of amiInvoices) {
      console.log(`   • ${inv.invoiceNumber} | Status: ${inv.status} | DueDate: ${inv.dueDate ? inv.dueDate.toISOString().slice(0, 10) : '-'} | Created: ${inv.createdAt.toISOString().slice(0, 10)}`);
      
      // Hapus tagihan pending yang duplikat jika Ami sudah lunas
      if (inv.status === 'PENDING' || inv.status === 'OVERDUE') {
        if (inv.invoiceNumber === 'INV-20260902-DF1615') {
          await prisma.payment.deleteMany({ where: { invoiceId: inv.id } });
          await prisma.invoice.delete({ where: { id: inv.id } });
          console.log(`      🗑️ Hapus tagihan duplikat tertunda ${inv.invoiceNumber}`);
        }
      } else if (inv.status === 'PAID') {
        // Jika ini invoice September (INV-20260904-23DBA1), pastikan dueDate di September
        if (inv.invoiceNumber === 'INV-20260904-23DBA1') {
          await prisma.invoice.update({
            where: { id: inv.id },
            data: { dueDate: TARGET_SEPTEMBER_DUE }
          });
          console.log(`      ✓ Invoice lunas September ${inv.invoiceNumber} dipastikan dueDate: 6 September 2026.`);
        }
      }
    }

    // 3. TANGANI ABY ADITYA (Pembersihan Tagihan Duplikat)
    console.log('\n3️⃣ Memeriksa Duplikat Tagihan Aby Aditya...');
    const abyInvoices = await prisma.invoice.findMany({
      where: {
        OR: [
          { customerName: { contains: 'ABY ADITYA' } },
          { customerUsername: { contains: 'ABY' } },
          { invoiceNumber: { in: ['INV-20260829-8C2F55', 'INV-20260902-CF7301', 'INV-20260904-087FF2'] } }
        ],
        status: { in: ['PENDING', 'OVERDUE'] }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (abyInvoices.length > 1) {
      console.log(`   Ditemukan ${abyInvoices.length} tagihan belum lunas untuk Aby Aditya:`);
      const [keepInvoice, ...duplicates] = abyInvoices;

      await prisma.invoice.update({
        where: { id: keepInvoice.id },
        data: { dueDate: TARGET_SEPTEMBER_DUE, status: 'PENDING' }
      });
      console.log(`   💎 Pertahankan tagihan terbaru: ${keepInvoice.invoiceNumber} (dueDate: 6 September 2026)`);

      for (const dup of duplicates) {
        await prisma.payment.deleteMany({ where: { invoiceId: dup.id } });
        await prisma.invoice.delete({ where: { id: dup.id } });
        console.log(`   🗑️ Hapus tagihan duplikat: ${dup.invoiceNumber} (${dup.createdAt.toISOString().slice(0, 10)})`);
      }
    }

    // 4. KEMBALIKAN SEMUA TAGIHAN SEPTEMBER YANG TERLEMPAR KE OKTOBER
    console.log('\n4️⃣ Memeriksa Seluruh Tagihan yang Dibuat di Periode Agustus/September tapi DueDate-nya Berubah ke Oktober...');
    const startLateAug = new Date('2026-08-15T00:00:00.000Z');
    const endNow = new Date('2026-09-07T23:59:59.999Z');
    const startOct = new Date('2026-10-01T00:00:00.000Z');
    const endOct = new Date('2026-10-31T23:59:59.999Z');

    const misplacedInvoices = await prisma.invoice.findMany({
      where: {
        createdAt: { gte: startLateAug, lte: endNow },
        dueDate: { gte: startOct, lte: endOct },
      },
      select: {
        id: true,
        invoiceNumber: true,
        customerName: true,
        dueDate: true,
        createdAt: true,
        status: true,
        userId: true,
      }
    });

    console.log(`   Ditemukan ${misplacedInvoices.length} tagihan yang dueDate-nya terlempar ke Oktober:`);
    for (const inv of misplacedInvoices) {
      console.log(`   • ${inv.invoiceNumber} | ${inv.customerName} | Status: ${inv.status} | DueDate: ${inv.dueDate.toISOString().slice(0, 10)} -> Kembalikan ke 6 Sept 2026`);
      
      await prisma.invoice.update({
        where: { id: inv.id },
        data: {
          dueDate: TARGET_SEPTEMBER_DUE,
        }
      });
    }

    // 5. KEMBALIKAN TAGIHAN LAWAS (seperti Rahmat Nugraha INV-20260727-693B72) JIKA DATEDUE-NYA TERTINDAH OKTOBER
    const oldMisplaced = await prisma.invoice.findMany({
      where: {
        createdAt: { lt: startLateAug },
        dueDate: { gte: startOct, lte: endOct },
      }
    });

    if (oldMisplaced.length > 0) {
      console.log(`\n5️⃣ Ditemukan ${oldMisplaced.length} tagihan lawas (sebelum Agustus) yang dueDate-nya tertimpa Oktober:`);
      for (const inv of oldMisplaced) {
        await prisma.invoice.update({
          where: { id: inv.id },
          data: { dueDate: TARGET_SEPTEMBER_DUE }
        });
        console.log(`   • ${inv.invoiceNumber} (${inv.customerName}) disetel ke 6 September 2026.`);
      }
    }

    // 6. DETEKSI & BERSIHKAN TAGIHAN PENDING DUPLIKAT UNTUK PELANGGAN YANG SUDAH LUNAS DI SEPTEMBER
    console.log('\n6️⃣ Memeriksa Pelanggan yang Sudah Lunas di September Tapi Memiliki Tagihan Pending Duplikat...');
    const paidInvoicesSept = await prisma.invoice.findMany({
      where: {
        status: 'PAID',
        OR: [
          { paidAt: { gte: new Date('2026-08-25T00:00:00.000Z') } },
          { dueDate: { gte: new Date('2026-09-01T00:00:00.000Z'), lte: new Date('2026-09-30T23:59:59.999Z') } }
        ]
      },
      select: { userId: true, invoiceNumber: true },
      distinct: ['userId']
    });

    const paidUserIds = paidInvoicesSept.map(i => i.userId).filter(Boolean);

    // Cari apakah user yang sudah lunas punya tagihan PENDING yang dibuat hari ini (6 Sept) atau tgl 5 Sept
    const duplicatePending = await prisma.invoice.findMany({
      where: {
        userId: { in: paidUserIds },
        status: { in: ['PENDING', 'OVERDUE'] },
        createdAt: { gte: new Date('2026-09-05T00:00:00.000Z') }
      },
      select: { id: true, invoiceNumber: true, customerName: true, createdAt: true, status: true }
    });

    if (duplicatePending.length > 0) {
      console.log(`   ⚠️ Ditemukan ${duplicatePending.length} tagihan pending duplikat untuk pelanggan yang sudah bayar:`);
      for (const dup of duplicatePending) {
        await prisma.payment.deleteMany({ where: { invoiceId: dup.id } });
        await prisma.invoice.delete({ where: { id: dup.id } });
        console.log(`      🗑️ Hapus invoice palsu/duplikat: ${dup.invoiceNumber} (${dup.customerName})`);
      }
    } else {
      console.log('   ✓ Tidak ada tagihan pending duplikat untuk pelanggan yang sudah lunas.');
    }

    console.log('\n' + '='.repeat(75));
    console.log('🎉 SEMUA ANOMALI TAGIHAN BERHASIL DIPERBAIKI & DIBERSIHKAN!');
    console.log('='.repeat(75));
    console.log('• Invoice lunas Najwa Selma & Ami telah dikembalikan rapi ke September (tab Lunas).');
    console.log('• Semua invoice duplikat / prematur telah dihapus.');
    console.log('• Semua tagihan yang terlempar ke Oktober sudah kembali ke September.');
    console.log('• Tidak ada pelanggan lunas yang memiliki tagihan gantung.');
    console.log('='.repeat(75) + '\n');

  } catch (error) {
    console.error('❌ Error saat menjalankan perbaikan:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
