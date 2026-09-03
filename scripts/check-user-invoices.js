#!/usr/bin/env node
/**
 * Diagnostic & Remediation Script for Invoice Generation Issues
 * 
 * Usage:
 *   node scripts/check-user-invoices.js [name_or_username] [--month=YYYY-MM] [--generate] [--force]
 * 
 * Examples:
 *   node scripts/check-user-invoices.js Halimah
 *   node scripts/check-user-invoices.js Rahmat
 *   node scripts/check-user-invoices.js Halimah --generate
 *   node scripts/check-user-invoices.js --month=2026-09
 */

const { PrismaClient } = require('@prisma/client');
const { randomBytes } = require('crypto');
const prisma = new PrismaClient();

function generateInvoiceNumber() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `INV-${y}${m}${d}-${rand}`;
}

async function main() {
  const args = process.argv.slice(2);
  const flags = args.filter(a => a.startsWith('--'));
  const nonFlags = args.filter(a => !a.startsWith('--'));

  const query = nonFlags[0] || '';
  const shouldGenerate = flags.includes('--generate');
  const force = flags.includes('--force');
  
  const monthFlag = flags.find(f => f.startsWith('--month='));
  const targetMonth = monthFlag ? monthFlag.split('=')[1] : (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  })();

  const [targetYear, targetMonthNum] = targetMonth.split('-').map(Number);
  const monthStart = new Date(Date.UTC(targetYear, targetMonthNum - 1, 1, 0, 0, 0, 0));
  const monthEnd = new Date(Date.UTC(targetYear, targetMonthNum, 0, 23, 59, 59, 999));

  console.log('='.repeat(75));
  console.log(`🔎 DIAGNOSTIK GENERATE INVOICE EUGINEBILL`);
  console.log(`Target Bulan  : ${targetMonth} (${monthStart.toISOString().slice(0, 10)} s/d ${monthEnd.toISOString().slice(0, 10)})`);
  console.log(`Pencarian User: ${query ? `"${query}"` : 'Semua User Bermasalah (Default: Halimah & Rahmat)'}`);
  console.log(`Mode Generate : ${shouldGenerate ? (force ? 'YA (FORCE GENERATE)' : 'YA (AMAN / SKIP JIKA ADA)') : 'HANYA CEK / PREVIEW'}`);
  console.log('='.repeat(75) + '\n');

  // Find target users
  let userWhere = {};
  if (query) {
    userWhere = {
      OR: [
        { name: { contains: query } },
        { username: { contains: query } },
        { phone: { contains: query } },
        { customerId: { contains: query } },
      ],
    };
  } else {
    userWhere = {
      OR: [
        { name: { contains: 'Halimah' } },
        { username: { contains: 'halimah' } },
        { name: { contains: 'Rahmat' } },
        { username: { contains: 'rahmat' } },
      ],
    };
  }

  const users = await prisma.pppoeUser.findMany({
    where: userWhere,
    include: {
      profile: true,
      area: true,
      router: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (users.length === 0) {
    console.log(`❌ Tidak ditemukan pelanggan dengan kata kunci "${query}".`);
    return;
  }

  console.log(`Ditemukan ${users.length} pelanggan yang cocok:\n`);

  for (const user of users) {
    console.log('-'.repeat(75));
    console.log(`👤 PELANGGAN: ${user.name} (${user.username})`);
    console.log(`   - ID Database       : ${user.id}`);
    console.log(`   - Customer ID       : ${user.customerId || '(belum ada)'}`);
    console.log(`   - No. WhatsApp/HP   : ${user.phone || '(tidak ada)'}`);
    console.log(`   - Status Akun       : ${user.status}`);
    console.log(`   - Tipe Langganan    : ${user.subscriptionType || 'POSTPAID'}`);
    console.log(`   - Billing Day       : ${user.billingDay ?? 1}`);
    console.log(`   - Expired At        : ${user.expiredAt ? user.expiredAt.toISOString() : '(null / belum diatur)'}`);
    console.log(`   - Paket Layanan     : ${user.profile ? `${user.profile.name} (Rp ${Number(user.profile.price).toLocaleString('id-ID')})` : '❌ TIDAK ADA PAKET'}`);
    console.log(`   - Tanggal Terdaftar : ${user.createdAt ? user.createdAt.toISOString() : '-'}`);

    // Query ALL invoices in DB linked to this user
    const userInvoices = await prisma.invoice.findMany({
      where: {
        OR: [
          { userId: user.id },
          { customerUsername: user.username },
          ...(user.phone ? [{ customerPhone: user.phone }] : []),
        ],
      },
      orderBy: { createdAt: 'desc' },
    });

    console.log(`\n   📄 DAFTAR TAGIHAN DI DATABASE (${userInvoices.length} tagihan):`);
    if (userInvoices.length === 0) {
      console.log(`      (Belum pernah ada record tagihan sama sekali untuk user ini)`);
    } else {
      for (const inv of userInvoices) {
        const dueStr = inv.dueDate ? inv.dueDate.toISOString().slice(0, 10) : 'null';
        const createdStr = inv.createdAt ? inv.createdAt.toISOString().slice(0, 10) : 'null';
        const paidStr = inv.paidAt ? inv.paidAt.toISOString().slice(0, 10) : '-';
        console.log(`      • [${inv.invoiceNumber}] Type: ${inv.invoiceType || 'MONTHLY'} | Status: ${inv.status} | Rp ${Number(inv.amount).toLocaleString('id-ID')} | DueDate: ${dueStr} | Created: ${createdStr} | Paid: ${paidStr}`);
      }
    }

    // Diagnostic Analysis for targetMonth
    console.log(`\n   🔍 ANALISIS MASALAH BULAN ${targetMonth}:`);
    
    // Check 1: Invoices with dueDate in targetMonth
    const dueDateInMonth = userInvoices.filter(i => {
      if (!i.dueDate) return false;
      const d = new Date(i.dueDate);
      return d >= monthStart && d <= monthEnd;
    });

    // Check 2: Invoices with createdAt in targetMonth
    const createdAtInMonth = userInvoices.filter(i => {
      if (!i.createdAt) return false;
      const d = new Date(i.createdAt);
      return d >= monthStart && d <= monthEnd;
    });

    // Check 3: Active/Paid invoices in targetMonth
    const activeInMonth = dueDateInMonth.filter(i => ['PENDING', 'OVERDUE', 'PAID'].includes(i.status));

    if (activeInMonth.length > 0) {
      const inv = activeInMonth[0];
      console.log(`      ⚠️  Tagihan aktif bulan ${targetMonth} DITEMUKAN di database:`);
      console.log(`         No. Invoice : ${inv.invoiceNumber}`);
      console.log(`         Status      : ${inv.status}`);
      console.log(`         Jatuh Tempo : ${inv.dueDate ? inv.dueDate.toISOString().slice(0, 10) : '-'}`);
      if (inv.status === 'PAID') {
        console.log(`         ℹ️  PENJELASAN UI: Tagihan ini berstatus LUNAS (PAID). Jika Anda berada di tab "Belum Lunas", tagihan ini sengaja disembunyikan. Buka tab "Lunas" atau "Semua" untuk melihatnya.`);
      } else {
        console.log(`         ℹ️  PENJELASAN UI: Tagihan ini ada di database. Cek apakah ada filter Router/Area/Pencarian di UI yang menyaringnya.`);
      }
    } else if (createdAtInMonth.length > 0 && dueDateInMonth.length === 0) {
      const inv = createdAtInMonth[0];
      console.log(`      ⚠️  BUG DETEKSI GENERATE KODE LAMA TERJADI!`);
      console.log(`         User memiliki invoice [${inv.invoiceNumber}] yang DIBUAT (createdAt) pada bulan ${targetMonth} (${inv.createdAt.toISOString().slice(0, 10)}),`);
      console.log(`         tetapi Jatuh Tempo (dueDate) berada di luar bulan ini (${inv.dueDate ? inv.dueDate.toISOString().slice(0, 10) : '-'}).`);
      console.log(`         -> Pada kode lama: sistem menganggap user sudah punya tagihan bulan ini dan MELEWATINYA.`);
      console.log(`         -> Pada UI: filter bulan memfilter strictly berdasarkan dueDate, sehingga di UI tagihan TIDAK MUNCUL sama sekali.`);
      console.log(`         -> SOLUSI: Kode generate baru telah memperbaiki duplicate check ini!`);
    } else {
      console.log(`      ✅ Tidak ada tagihan aktif untuk bulan ${targetMonth}. Pelanggan ini SEHARUSNYA DIGENERATE.`);
      
      // Check why user might be skipped
      const uStatus = (user.status || '').toLowerCase();
      if (['stop', 'stopped', 'inactive', 'dismantle', 'terminated'].includes(uStatus)) {
        console.log(`      ❌ KENDALA: Status user adalah "${user.status}" (bukan aktif/isolir).`);
      }
      if (!user.profile) {
        console.log(`      ❌ KENDALA: User belum memiliki Paket Layanan (profileId null).`);
      }
      if (user.subscriptionType === 'PREPAID' && !user.expiredAt) {
        console.log(`      ℹ️  CATATAN: Tipe langganan PREPAID tetapi expiredAt null. Pada kode baru, sistem akan otomatis menggunakan fallback billingDay.`);
      }
    }

    // Action: Generate if requested
    if (shouldGenerate) {
      if (activeInMonth.length > 0 && !force) {
        console.log(`\n   ⏭️  GENERATE DILEWATI: Tagihan aktif untuk bulan ${targetMonth} sudah ada (${activeInMonth[0].invoiceNumber}). Gunakan flag --force jika ingin tetap membuat tagihan baru.`);
      } else if (!user.profile) {
        console.log(`\n   ❌ GAGAL GENERATE: Pelanggan tidak memiliki paket.`);
      } else {
        console.log(`\n   🚀 MENGEKSEKUSI PEMBUATAN TAGIHAN BULAN ${targetMonth}...`);
        try {
          const company = await prisma.company.findFirst({ select: { baseUrl: true } });
          const baseUrl = company?.baseUrl || 'http://localhost:3000';
          
          const bd = user.billingDay ?? 1;
          const daysInMonth = new Date(Date.UTC(targetYear, targetMonthNum, 0)).getUTCDate();
          const day = Math.min(bd, daysInMonth);
          const dueDate = new Date(Date.UTC(targetYear, targetMonthNum - 1, day, 23, 59, 59, 999));

          let baseAmount = Number(user.profile.price);
          let taxRate = null;
          let amount = baseAmount;
          if (user.profile.ppnActive && user.profile.ppnRate > 0) {
            taxRate = user.profile.ppnRate;
            amount = Math.round(baseAmount + (baseAmount * taxRate / 100));
          }

          const invoiceNumber = generateInvoiceNumber();
          const paymentToken = randomBytes(32).toString('hex');
          const paymentLink = `${baseUrl}/pay/${paymentToken}`;

          const newInv = await prisma.invoice.create({
            data: {
              id: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              invoiceNumber,
              userId: user.id,
              amount,
              baseAmount,
              ...(taxRate !== null && { taxRate }),
              dueDate,
              status: 'PENDING',
              invoiceType: user.subscriptionType === 'PREPAID' ? 'RENEWAL' : 'MONTHLY',
              customerName: user.name,
              customerPhone: user.phone,
              customerEmail: user.email || null,
              customerUsername: user.username,
              paymentToken,
              paymentLink,
              createdAt: new Date(),
            },
          });

          console.log(`   🎉 BERHASIL DIBUAT!`);
          console.log(`      - No. Invoice  : ${newInv.invoiceNumber}`);
          console.log(`      - Jumlah       : Rp ${Number(newInv.amount).toLocaleString('id-ID')}`);
          console.log(`      - Jatuh Tempo  : ${newInv.dueDate.toISOString().slice(0, 10)}`);
          console.log(`      - Payment Link : ${newInv.paymentLink}`);
        } catch (genErr) {
          console.error(`   ❌ Gagal membuat invoice:`, genErr.message || genErr);
        }
      }
    }
  }

  console.log('\n' + '='.repeat(75));
  console.log('Selesai.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
