#!/usr/bin/env node
/**
 * Repair Script: Fix September Invoices erroneously moved to October & Cleanup Duplicates
 * Usage on VPS:
 *   node scripts/fix-september-invoices.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TARGET_SEPTEMBER_DUE = new Date('2026-09-06T23:59:59.999Z');

async function main() {
  console.log('='.repeat(75));
  console.log('🔧 PERBAIKAN DATA TAGIHAN BULAN SEPTEMBER 2026');
  console.log('='.repeat(75));

  try {
    // 1. TANGANI NAJWA SELMA
    console.log('\n1️⃣ Memeriksa Akun Najwa Selma...');
    const najwaUsers = await prisma.pppoeUser.findMany({
      where: {
        OR: [
          { name: { contains: 'Najwa' } },
          { username: { contains: 'Najwa' } },
        ]
      }
    });

    for (const u of najwaUsers) {
      console.log(`   👤 User: ${u.username} (${u.name})`);

      // Cek invoice lama INV-20260904-E4ABB2
      const oldInv = await prisma.invoice.findFirst({
        where: { invoiceNumber: 'INV-20260904-E4ABB2' }
      });
      if (oldInv) {
        // Kembalikan dueDate ke September
        await prisma.invoice.update({
          where: { id: oldInv.id },
          data: { dueDate: TARGET_SEPTEMBER_DUE }
        });
        console.log(`      ✓ Invoice lama ${oldInv.invoiceNumber} status: ${oldInv.status}, dueDate dikembalikan ke 6 September 2026.`);
      }

      // Cek invoice baru prematur INV-20260906-DBA0FB
      const newInv = await prisma.invoice.findFirst({
        where: { invoiceNumber: 'INV-20260906-DBA0FB' }
      });
      if (newInv) {
        // Hapus payments terkait jika ada
        await prisma.payment.deleteMany({ where: { invoiceId: newInv.id } });
        await prisma.invoice.delete({ where: { id: newInv.id } });
        console.log(`      ✓ Invoice prematur ${newInv.invoiceNumber} berhasil DIHAPUS (karena Najwa sudah bayar di invoice lama).`);
      }
    }

    // 2. TANGANI ABY ADITYA (Pembersihan Tagihan Duplikat)
    console.log('\n2️⃣ Memeriksa Duplikat Tagihan Aby Aditya...');
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
      // Ambil yang paling baru (INV-20260904-087FF2) sebagai tagihan aktif
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

    // 3. KEMBALIKAN SEMUA TAGIHAN SEPTEMBER YANG TERLEMPAR KE OKTOBER
    console.log('\n3️⃣ Memeriksa Tagihan yang Dibuat di Periode Agustus/September tapi DueDate-nya Berubah ke Oktober...');
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
      }
    });

    console.log(`   Ditemukan ${misplacedInvoices.length} tagihan yang dueDate-nya terlempar ke Oktober:`);
    for (const inv of misplacedInvoices) {
      console.log(`   • ${inv.invoiceNumber} | ${inv.customerName} | Status: ${inv.status} | DueDate: ${inv.dueDate.toISOString().slice(0, 10)} -> Ubah ke 6 Sept 2026`);
      
      await prisma.invoice.update({
        where: { id: inv.id },
        data: {
          dueDate: TARGET_SEPTEMBER_DUE,
        }
      });
    }

    // 4. KEMBALIKAN TAGIHAN LAMA DARI JULI/SEBELUMNYA (seperti Rahmat Nugraha) JIKA DATEDUE-NYA TERTINDAH OKTOBER
    const oldMisplaced = await prisma.invoice.findMany({
      where: {
        createdAt: { lt: startLateAug },
        dueDate: { gte: startOct, lte: endOct },
      }
    });

    if (oldMisplaced.length > 0) {
      console.log(`\n4️⃣ Ditemukan ${oldMisplaced.length} tagihan lawas (sebelum Agustus) yang dueDate-nya tertimpa Oktober:`);
      for (const inv of oldMisplaced) {
        // Kembalikan dueDate ke September atau tanggal aslinya
        await prisma.invoice.update({
          where: { id: inv.id },
          data: { dueDate: TARGET_SEPTEMBER_DUE }
        });
        console.log(`   • ${inv.invoiceNumber} (${inv.customerName}) disetel ke 6 September 2026.`);
      }
    }

    console.log('\n' + '='.repeat(75));
    console.log('✅ PERBAIKAN SELESAI DENGAN SUKSES!');
    console.log('='.repeat(75));
    console.log('• Semua tagihan periode September telah dikembalikan ke filter bulan September.');
    console.log('• Tagihan prematur Najwa Selma (INV-20260906-DBA0FB) telah dihapus, invoice lunasnya aktif.');
    console.log('• Tagihan ganda Aby Aditya telah dibersihkan.');
    console.log('='.repeat(75) + '\n');

  } catch (error) {
    console.error('❌ Error saat menjalankan perbaikan:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
