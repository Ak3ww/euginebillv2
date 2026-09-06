#!/usr/bin/env node
/**
 * Diagnostic script for Najwa Selma invoices anomaly
 * Usage on VPS: node scripts/check-najwa.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('='.repeat(70));
  console.log('🔍 DIAGNOSTIK ANOMALI INVOICE NAJWA SELMA');
  console.log('='.repeat(70));

  try {
    // 1. Cari user Najwa Selma
    const users = await prisma.pppoeUser.findMany({
      where: {
        OR: [
          { name: { contains: 'Najwa' } },
          { name: { contains: 'Selma' } },
          { username: { contains: 'Najwa' } },
          { username: { contains: 'Selma' } },
        ],
      },
      include: {
        profile: true,
        area: true,
      },
    });

    console.log(`\n👤 Ditemukan ${users.length} user dengan kata kunci Najwa / Selma:`);
    for (const u of users) {
      console.log(`   - ID: ${u.id}`);
      console.log(`     Username: ${u.username} | Nama: ${u.name} | Phone: ${u.phone}`);
      console.log(`     Status: ${u.status} | Subscription: ${u.subscriptionType}`);
      console.log(`     BillingDay: ${u.billingDay} | BillingCycleDay: ${u.billingCycleDay}`);
      console.log(`     ExpiredAt: ${u.expiredAt ? u.expiredAt.toISOString() : 'NULL'}`);
      console.log(`     LastPaymentDate: ${u.lastPaymentDate ? u.lastPaymentDate.toISOString() : 'NULL'}`);
      console.log(`     Area: ${u.area?.name || '-'}`);
    }

    // 2. Cek invoice INV-20260904-E4ABB2
    console.log('\n📄 Mencari Invoice Lama: INV-20260904-E4ABB2 ...');
    const oldInv = await prisma.invoice.findFirst({
      where: { invoiceNumber: 'INV-20260904-E4ABB2' },
      include: { payments: true, user: true },
    });

    if (oldInv) {
      console.log(`   ✅ DITEMUKAN di database:`);
      console.log(`      ID: ${oldInv.id}`);
      console.log(`      Status: ${oldInv.status}`);
      console.log(`      Amount: Rp ${oldInv.amount.toLocaleString('id-ID')}`);
      console.log(`      DueDate: ${oldInv.dueDate ? oldInv.dueDate.toISOString() : 'NULL'}`);
      console.log(`      PaidAt: ${oldInv.paidAt ? oldInv.paidAt.toISOString() : 'NULL'}`);
      console.log(`      CreatedAt: ${oldInv.createdAt.toISOString()}`);
      console.log(`      UserId: ${oldInv.userId}`);
      console.log(`      CustomerName: ${oldInv.customerName}`);
      console.log(`      Payments: ${oldInv.payments.length} transaksi`);
      oldInv.payments.forEach(p => {
        console.log(`         • [${p.status}] Rp ${p.amount} via ${p.method} pada ${p.paidAt}`);
      });
    } else {
      console.log(`   ❌ TIDAK DITEMUKAN di tabel invoice dengan nomor INV-20260904-E4ABB2!`);
      // Coba cari invoice dengan akhiran E4ABB2 atau tanggal 2026-09-04
      const similar = await prisma.invoice.findMany({
        where: {
          OR: [
            { invoiceNumber: { contains: 'E4ABB2' } },
            { invoiceNumber: { contains: '20260904' } },
          ],
        },
        take: 5,
      });
      console.log(`   Invoice mirip:`, similar.map(s => `${s.invoiceNumber} (${s.customerName} - ${s.status})`));
    }

    // 3. Cek invoice INV-20260906-DBA0FB
    console.log('\n📄 Mencari Invoice Baru: INV-20260906-DBA0FB ...');
    const newInv = await prisma.invoice.findFirst({
      where: { invoiceNumber: 'INV-20260906-DBA0FB' },
      include: { payments: true, user: true },
    });

    if (newInv) {
      console.log(`   ✅ DITEMUKAN di database:`);
      console.log(`      ID: ${newInv.id}`);
      console.log(`      Status: ${newInv.status}`);
      console.log(`      Amount: Rp ${newInv.amount.toLocaleString('id-ID')}`);
      console.log(`      DueDate: ${newInv.dueDate ? newInv.dueDate.toISOString() : 'NULL'}`);
      console.log(`      PaidAt: ${newInv.paidAt ? newInv.paidAt.toISOString() : 'NULL'}`);
      console.log(`      CreatedAt: ${newInv.createdAt.toISOString()}`);
      console.log(`      UserId: ${newInv.userId}`);
      console.log(`      CustomerName: ${newInv.customerName}`);
      console.log(`      Payments: ${newInv.payments.length} transaksi`);
    } else {
      console.log(`   ❌ TIDAK DITEMUKAN invoice INV-20260906-DBA0FB!`);
    }

    // 4. Cek semua invoice milik user terkait
    if (users.length > 0) {
      const userIds = users.map(u => u.id);
      const allInvoices = await prisma.invoice.findMany({
        where: { userId: { in: userIds } },
        orderBy: { createdAt: 'desc' },
      });

      console.log(`\n📚 Total seluruh invoice untuk user di atas: ${allInvoices.length}`);
      for (const inv of allInvoices) {
        console.log(`   • ${inv.invoiceNumber} | Status: ${inv.status} | Amount: ${inv.amount} | DueDate: ${inv.dueDate ? inv.dueDate.toISOString().slice(0, 10) : '-'} | CreatedAt: ${inv.createdAt.toISOString()}`);
      }
    }

    // 5. Cek pembayaran manual / manual payments
    const manualPayments = await prisma.manualPayment.findMany({
      where: {
        OR: [
          { invoiceNumber: { contains: 'E4ABB2' } },
          { invoiceNumber: { contains: 'DBA0FB' } },
        ],
      },
    }).catch(() => []);

    if (manualPayments.length > 0) {
      console.log(`\n💳 Ditemukan ${manualPayments.length} catatan manualPayment:`);
      manualPayments.forEach(mp => {
        console.log(`   • Inv: ${mp.invoiceNumber} | Status: ${mp.status} | Amount: ${mp.amount}`);
      });
    }

  } catch (err) {
    console.error('Error saat diagnosa:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
