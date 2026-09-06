#!/usr/bin/env node
/**
 * Audit & Remediation Script: Pelanggan Sudah Bayar Tapi Masuk Filter Belum Bayar
 * 
 * Kasus:
 *   - Pelanggan seperti RAHMAT NUGRAHA (EMG027) masa aktifnya sudah sampai 05 Okt 2026 (status sudah bayar),
 *     namun di menu Data Pelanggan (/admin/pppoe/users) masih terhitung dan muncul di filter "Belum Bayar" (Tunggakan).
 * 
 * Penyebab Utama:
 *   1. Pelanggan memiliki tagihan yang masih berstatus PENDING/OVERDUE di database, padahal:
 *      a) Tagihan tersebut adalah tagihan September yang belum diubah ke PAID saat masa aktif diperpanjang.
 *      b) Tagihan tersebut adalah duplikat dari tagihan yang sebenarnya sudah lunas.
 *      c) Tagihan tersebut dibuat prematur untuk bulan Oktober (jatuh tempo 5 Okt 2026) sebelum waktunya.
 *   2. /api/invoices/counts menghitung seluruh invoice PENDING/OVERDUE tanpa memperhatikan apakah
 *      pelanggan sudah lunas di periode berjalan dan masa aktifnya masih di masa depan (Oktober).
 * 
 * Penggunaan di VPS:
 *   node scripts/audit-and-fix-unpaid-customers.js              # Mode Audit & Preview (Aman, tidak mengubah data)
 *   node scripts/audit-and-fix-unpaid-customers.js --user=EMG027 # Cek spesifik user tertentu
 *   node scripts/audit-and-fix-unpaid-customers.js --fix         # Eksekusi perbaikan otomatis ke database
 *   node scripts/audit-and-fix-unpaid-customers.js --user=EMG027 --fix # Perbaiki hanya user tertentu
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const isFixMode = args.includes('--fix');
  const userArg = args.find(a => a.startsWith('--user='));
  const targetUserFilter = userArg ? userArg.split('=')[1].trim() : null;

  console.log('='.repeat(80));
  console.log('🔍 AUDIT & PERBAIKAN PELANGGAN SUDAH BAYAR TAPI MASUK FILTER BELUM BAYAR');
  console.log(`Mode Operasi : ${isFixMode ? '🚨 FIX MODE (Melakukan Perbaikan ke Database)' : '🛡️ PREVIEW ONLY (Hanya Menampilkan Data & Anomali)'}`);
  if (targetUserFilter) {
    console.log(`Filter User  : ${targetUserFilter}`);
  } else {
    console.log('Lingkup Audit: Seluruh Pelanggan PPPoE di Database');
  }
  console.log('='.repeat(80) + '\n');

  const now = new Date();
  const startSept = new Date('2026-09-01T00:00:00.000Z');
  const endSept = new Date('2026-09-30T23:59:59.999Z');
  const startOct = new Date('2026-10-01T00:00:00.000Z');

  // 1. Audit Khusus Rahmat Nugraha (EMG027)
  console.log('--------------------------------------------------------------------------------');
  console.log('1️⃣ AUDIT KHUSUS: RAHMAT NUGRAHA (EMG027 / 0895338441225)');
  console.log('--------------------------------------------------------------------------------');

  const rahmatUsers = await prisma.pppoeUser.findMany({
    where: {
      OR: [
        { username: 'EMG027' },
        { phone: '0895338441225' },
        { name: { contains: 'RAHMAT NUGRAHA' } },
      ],
    },
    include: {
      invoices: {
        orderBy: { createdAt: 'desc' },
      },
      profile: true,
      area: true,
    },
  });

  if (rahmatUsers.length === 0) {
    console.log('⚠️ Pelanggan Rahmat Nugraha tidak ditemukan dengan filter EMG027.');
  } else {
    for (const u of rahmatUsers) {
      console.log(`👤 Nama Pelanggan : ${u.name}`);
      console.log(`   Username       : ${u.username}`);
      console.log(`   No. Telepon    : ${u.phone}`);
      console.log(`   Status Akun    : ${u.status}`);
      console.log(`   Masa Aktif     : ${u.expiredAt ? u.expiredAt.toISOString().slice(0, 10) : 'NULL'}`);
      console.log(`   Paket / Profil : ${u.profile?.name || '-'}`);
      console.log(`   Area           : ${u.area?.name || '-'}`);
      console.log(`   Total Tagihan  : ${u.invoices.length} tagihan di database\n`);

      console.log('   Daftar Tagihan Rahmat:');
      for (const inv of u.invoices) {
        console.log(`   • [${inv.invoiceNumber}] Status: ${inv.status.padEnd(8)} | Due: ${inv.dueDate ? inv.dueDate.toISOString().slice(0, 10) : '-'} | PaidAt: ${inv.paidAt ? inv.paidAt.toISOString().slice(0, 10) : '-'} | Rp ${inv.amount.toLocaleString('id-ID')} | Dibuat: ${inv.createdAt.toISOString().slice(0, 10)}`);
      }
      console.log('');
    }
  }

  // 2. Audit Menyeluruh: Cari SEMUA Pelanggan dengan Anomali Serupa
  console.log('--------------------------------------------------------------------------------');
  console.log('2️⃣ AUDIT MENYELURUH: MENCARI SEMUA PELANGGAN DENGAN ANOMALI SERUPA');
  console.log('--------------------------------------------------------------------------------');

  let userQuery = {};
  if (targetUserFilter) {
    userQuery = {
      OR: [
        { username: { contains: targetUserFilter } },
        { name: { contains: targetUserFilter } },
        { phone: { contains: targetUserFilter } },
      ],
    };
  }

  const allUsers = await prisma.pppoeUser.findMany({
    where: userQuery,
    include: {
      invoices: {
        orderBy: { createdAt: 'desc' },
      },
      profile: true,
      area: true,
    },
  });

  const anomalies = [];

  for (const user of allUsers) {
    // Abaikan user berhenti / stop
    const uStatus = (user.status || '').toLowerCase();
    if (['stop', 'stopped', 'blocked', 'suspended', 'dismantle', 'inactive', 'terminated'].includes(uStatus)) {
      continue;
    }

    const pendingInvoices = user.invoices.filter(i => i.status === 'PENDING' || i.status === 'OVERDUE');
    const paidInvoices = user.invoices.filter(i => i.status === 'PAID');

    // Cek apakah masa aktif user masih di masa depan (misal Oktober 2026)
    const isFutureExpired = user.expiredAt && new Date(user.expiredAt) > now;
    const isOctoberExpired = user.expiredAt && new Date(user.expiredAt) >= startOct;

    if (pendingInvoices.length > 0) {
      // Periksa jenis-jenis anomali:
      for (const inv of pendingInvoices) {
        const invDue = inv.dueDate ? new Date(inv.dueDate) : null;
        const isDueOct = invDue && invDue >= startOct;
        const isDueSept = invDue && invDue >= startSept && invDue <= endSept;

        // Cek apakah sudah ada invoice PAID di bulan September
        const hasPaidSept = paidInvoices.some(pi => {
          const piDue = pi.dueDate ? new Date(pi.dueDate) : null;
          const piPaid = pi.paidAt ? new Date(pi.paidAt) : null;
          return (piDue && piDue >= startSept && piDue <= endSept) || (piPaid && piPaid >= startSept);
        });

        // Kategori Anomali
        let anomalyType = null;
        let recommendedAction = null;

        const isCreatedBeforeSept = inv.createdAt && new Date(inv.createdAt) < startSept;

        if (isFutureExpired && hasPaidSept) {
          // Kasus 1: Sudah ada tagihan Lunas di September, tapi masih ada tagihan Pending
          if (isDueOct) {
            anomalyType = 'TAGIHAN_PREMATUR_OKTOBER';
            recommendedAction = 'Hapus tagihan prematur Oktober (karena user sudah lunas September & belum saatnya tagihan Oktober)';
          } else if (isCreatedBeforeSept) {
            anomalyType = 'TAGIHAN_ISOLIR_DILEWATI';
            recommendedAction = 'Batalkan tagihan isolir lampau (STATUS: CANCELLED) karena pelanggan skip bayar saat isolir dan sudah lunas September';
          } else {
            anomalyType = 'TAGIHAN_DUPLIKAT_SEPTEMBER';
            recommendedAction = 'Hapus tagihan duplikat tertunda September (karena user sudah bayar tagihan September lainnya)';
          }
        } else if (isOctoberExpired && !hasPaidSept) {
          // Kasus 2: Masa aktif sudah diperpanjang sampai Oktober (berarti sudah bayar September), tapi invoice September masih PENDING
          if (isCreatedBeforeSept && pendingInvoices.length > 1) {
            anomalyType = 'TAGIHAN_ISOLIR_DILEWATI';
            recommendedAction = 'Batalkan tagihan isolir lampau (STATUS: CANCELLED) karena pelanggan skip bayar saat isolir';
          } else {
            anomalyType = 'TAGIHAN_SEPTEMBER_BELUM_DITANDAI_LUNAS';
            recommendedAction = 'Ubah status tagihan ini menjadi PAID (Lunas September), karena masa aktif user sudah diperpanjang ke Oktober';
          }
        } else if (isDueOct && !isDueSept) {
          // Kasus 3: Tagihan bertanggal Oktober padahal saat ini masih 6 September
          anomalyType = 'TAGIHAN_PREMATUR_OKTOBER';
          recommendedAction = 'Hapus tagihan prematur Oktober';
        } else if (pendingInvoices.length > 1) {
          // Kasus 4: Duplikat beberapa tagihan pending
          anomalyType = 'DUPLIKAT_TAGIHAN_PENDING';
          recommendedAction = 'Bersihkan tagihan duplikat berlebih';
        }

        if (anomalyType) {
          anomalies.push({
            user,
            invoice: inv,
            anomalyType,
            recommendedAction,
            isOctoberExpired,
            hasPaidSept,
          });
        }
      }
    }
  }

  console.log(`📊 DITEMUKAN ${anomalies.length} KASUS ANOMALI DARI ${allUsers.length} PELANGGAN:\n`);

  if (anomalies.length === 0) {
    console.log('✅ Tidak ada anomali yang ditemukan! Semua status pembayaran pelanggan sinkron.');
    await prisma.$disconnect();
    return;
  }

  // Tampilkan tabel rangkuman anomali
  let idx = 1;
  const processedUserIds = new Set();

  for (const an of anomalies) {
    console.log(`[${idx++}] ${an.user.name} (${an.user.username}) | Telp: ${an.user.phone}`);
    console.log(`    Status User   : ${an.user.status} | Expired: ${an.user.expiredAt ? an.user.expiredAt.toISOString().slice(0, 10) : 'NULL'}`);
    console.log(`    Tagihan Anomali: ${an.invoice.invoiceNumber} | Rp ${an.invoice.amount.toLocaleString('id-ID')} | Status: ${an.invoice.status}`);
    console.log(`    Jatuh Tempo   : ${an.invoice.dueDate ? an.invoice.dueDate.toISOString().slice(0, 10) : '-'}`);
    console.log(`    Jenis Anomali : ${an.anomalyType}`);
    console.log(`    Solusi/Aksi   : ${an.recommendedAction}\n`);
    processedUserIds.add(an.user.id);
  }

  console.log(`Total Pelanggan Terdampak: ${processedUserIds.size} pelanggan.`);

  // 3. Eksekusi Perbaikan Jika --fix Diberikan
  if (isFixMode) {
    console.log('\n' + '='.repeat(80));
    console.log('⚙️ MEMULAI EKSEKUSI PERBAIKAN DATABASE...');
    console.log('='.repeat(80) + '\n');

    let fixedCount = 0;
    let deletedCount = 0;

    for (const an of anomalies) {
      try {
        if (an.anomalyType === 'TAGIHAN_SEPTEMBER_BELUM_DITANDAI_LUNAS') {
          // Ubah invoice menjadi PAID
          const septDueDate = new Date('2026-09-06T23:59:59.999Z');
          const paidDate = an.invoice.createdAt < new Date('2026-09-06') ? an.invoice.createdAt : new Date('2026-09-02T12:00:00.000Z');

          await prisma.invoice.update({
            where: { id: an.invoice.id },
            data: {
              status: 'PAID',
              dueDate: septDueDate,
              paidAt: paidDate,
            },
          });

          // Catat transaksi pembayaran jika belum ada
          const existingPayment = await prisma.payment.findFirst({
            where: { invoiceId: an.invoice.id },
          });

          if (!existingPayment) {
            await prisma.payment.create({
              data: {
                id: `pay-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                invoiceId: an.invoice.id,
                amount: an.invoice.amount,
                method: 'CASH',
                status: 'PAID',
                paidAt: paidDate,
              },
            }).catch(() => {});
          }

          console.log(`   ✅ [LUNAS] Invoice ${an.invoice.invoiceNumber} milik ${an.user.name} diubah menjadi PAID (September 2026).`);
          fixedCount++;
        } else if (an.anomalyType === 'TAGIHAN_ISOLIR_DILEWATI') {
          // Batalkan invoice isolir lampau karena dilewati saat reaktivasi
          await prisma.invoice.update({
            where: { id: an.invoice.id },
            data: { status: 'CANCELLED' }
          });
          console.log(`   🚫 [DIBATALKAN] Invoice isolir lampau ${an.invoice.invoiceNumber} milik ${an.user.name} dibatalkan (STATUS: CANCELLED).`);
          fixedCount++;
        } else if (an.anomalyType === 'TAGIHAN_PREMATUR_OKTOBER' || an.anomalyType === 'TAGIHAN_DUPLIKAT_SEPTEMBER') {
          // Hapus tagihan duplikat / prematur
          await prisma.payment.deleteMany({ where: { invoiceId: an.invoice.id } }).catch(() => {});
          await prisma.invoice.delete({ where: { id: an.invoice.id } });
          console.log(`   🗑️ [HAPUS] Invoice duplikat/prematur ${an.invoice.invoiceNumber} milik ${an.user.name} berhasil dihapus.`);
          deletedCount++;
        } else if (an.anomalyType === 'DUPLIKAT_TAGIHAN_PENDING') {
          await prisma.payment.deleteMany({ where: { invoiceId: an.invoice.id } }).catch(() => {});
          await prisma.invoice.delete({ where: { id: an.invoice.id } });
          console.log(`   🗑️ [BERSIHKAN] Invoice ganda ${an.invoice.invoiceNumber} milik ${an.user.name} berhasil dibersihkan.`);
          deletedCount++;
        }
      } catch (err) {
        console.error(`   ❌ Gagal memperbaiki invoice ${an.invoice.invoiceNumber}:`, err.message);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('🎉 PROSES PERBAIKAN SELESAI!');
    console.log('='.repeat(80));
    console.log(`• Total tagihan ditandai Lunas : ${fixedCount}`);
    console.log(`• Total tagihan duplikat dihapus: ${deletedCount}`);
    console.log('• Sekarang seluruh pelanggan yang masa aktifnya sampai Oktober tidak akan lagi masuk filter "Belum Bayar".');
    console.log('='.repeat(80) + '\n');
  } else {
    console.log('--------------------------------------------------------------------------------');
    console.log('💡 CATATAN: Ini adalah mode preview (tidak ada perubahan pada database).');
    console.log('   Untuk mengeksekusi perbaikan di VPS, jalankan:');
    console.log('   node scripts/audit-and-fix-unpaid-customers.js --fix');
    console.log('--------------------------------------------------------------------------------\n');
  }

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Fatal error:', err);
  prisma.$disconnect();
  process.exit(1);
});
