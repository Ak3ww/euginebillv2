#!/usr/bin/env node
/**
 * One-Click Script: Unisolir Semua Client PPPoE & Ubah Tanggal Isolir ke Tanggal 6
 * 
 * Penggunaan di VPS:
 *   node scripts/unisolate-all-and-set-date-6.js
 */

const { PrismaClient } = require('@prisma/client');
const { RouterOSAPI } = require('node-routeros');

const prisma = new PrismaClient();

// Tanggal target: 6 September 2026 pukul 23:59:59 WIB
// Di MySQL Prisma (UTC field representasi WIB):
const TARGET_DATE = new Date('2026-09-06T23:59:59.999Z');

async function connectToMikroTik(router, timeoutMs = 8000) {
  const host = router.ipAddress && router.ipAddress !== router.nasname ? router.ipAddress : (router.ipAddress || router.nasname);
  const port = router.port || 8728;
  const tls = port === 8729;

  const conn = new RouterOSAPI({
    host,
    user: router.username,
    password: router.password,
    port,
    timeout: 8,
    ...(tls ? { tls: { rejectUnauthorized: false } } : {})
  });

  const connectPromise = conn.connect();
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Timeout koneksi ${timeoutMs / 1000}s ke MikroTik ${host}:${port}`)), timeoutMs)
  );

  await Promise.race([connectPromise, timeoutPromise]);
  return conn;
}

async function main() {
  console.log('='.repeat(75));
  console.log('🚀 UNISOLIR SEMUA CLIENT & UBAH TANGGAL ISOLIR KE 6 SEPTEMBER 2026');
  console.log('='.repeat(75));
  console.log(`⏰ Waktu Eksekusi: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB`);
  console.log(`🎯 Tanggal Jatuh Tempo / Isolir Baru: 6 September 2026 (23:59:59 WIB)\n`);

  try {
    // 1. Ambil Pengaturan Company & Update fixedBillingDate = 6
    const company = await prisma.company.findFirst();
    const isRadiusEnabled = company?.radiusEnabled ?? false;
    console.log(`⚙️  Konfigurasi Sistem:`);
    console.log(`   - Perusahaan: ${company?.name || 'EugineBill ISP'}`);
    console.log(`   - Mode RADIUS: ${isRadiusEnabled ? 'AKTIF (Dual-Mode)' : 'NON-RADIUS (MikroTik Direct API)'}`);
    console.log(`   - Fixed Billing Date Saat Ini: ${company?.fixedBillingDate ?? 'belum diset'}`);

    await prisma.company.updateMany({
      data: { fixedBillingDate: 6 }
    });
    console.log(`   ✅ Setting Perusahaan diperbarui: fixedBillingDate = 6\n`);

    // 2. Cari Semua Pelanggan Berstatus 'isolated'
    const isolatedUsers = await prisma.pppoeUser.findMany({
      where: { status: 'isolated' },
      include: {
        profile: true,
        router: true,
      }
    });

    console.log(`📋 Pelanggan Terisolir Ditemukan: ${isolatedUsers.length} pelanggan.`);

    if (isolatedUsers.length > 0) {
      console.log('\n🔄 Memproses Pembukaan Isolir (Un-isolir) ke MikroTik & Database...');

      // Kelompokkan user terisolir berdasarkan routerId untuk efisiensi koneksi TCP
      const usersByRouter = new Map();
      const usersWithoutRouter = [];

      for (const u of isolatedUsers) {
        if (u.router) {
          const rid = u.router.id;
          if (!usersByRouter.has(rid)) {
            usersByRouter.set(rid, { router: u.router, users: [] });
          }
          usersByRouter.get(rid).users.push(u);
        } else {
          usersWithoutRouter.push(u);
        }
      }

      let mikrotikSuccessCount = 0;
      let mikrotikFailedCount = 0;

      // Sinkronisasi MikroTik per Router
      for (const [routerId, { router, users }] of usersByRouter.entries()) {
        console.log(`\n📡 Menghubungkan ke Router: ${router.name || router.ipAddress} (${users.length} pelanggan)...`);
        let conn = null;
        try {
          conn = await connectToMikroTik(router);
          console.log(`   ✓ Terhubung ke MikroTik ${router.ipAddress}:${router.port || 8728}`);

          // Ambil daftar ppp secret, active sessions, dan address-list isolir
          const secrets = await conn.write('/ppp/secret/print') || [];
          const activeSessions = await conn.write('/ppp/active/print') || [];
          const addressListEntries = await conn.write('/ip/firewall/address-list/print', ['?list=isolir']) || [];

          const activeMap = new Map();
          for (const s of activeSessions) {
            if (s.name) activeMap.set(s.name, s);
          }

          const secretMap = new Map();
          for (const s of secrets) {
            if (s.name) secretMap.set(s.name, s);
          }

          for (const user of users) {
            const normalProfile = user.profile?.mikrotikProfileName || user.profile?.name || user.profile?.groupName || 'default';
            const userIp = user.ipAddress;
            let userSuccess = false;

            try {
              // 1. Update PPP Secret profile ke normal profile
              const existingSecret = secretMap.get(user.username);
              if (existingSecret && existingSecret['.id']) {
                await conn.write('/ppp/secret/set', [
                  `=.id=${existingSecret['.id']}`,
                  `=disabled=no`,
                  `=profile=${normalProfile}`
                ]);
              }

              // 2. Kick sesi aktif agar ONT reconnect dan dapat profile/kecepatan normal
              const activeSess = activeMap.get(user.username);
              if (activeSess && activeSess['.id']) {
                await conn.write('/ppp/active/remove', [`=.id=${activeSess['.id']}`]);
              }

              // 3. Bersihkan entri address-list isolir
              const userActiveIp = activeSess?.address || userIp;
              for (const entry of addressListEntries) {
                const matchIp = userActiveIp && entry.address === userActiveIp;
                const matchComment = entry.comment && entry.comment.includes(user.username);
                if ((matchIp || matchComment) && entry['.id']) {
                  await conn.write('/ip/firewall/address-list/remove', [`=.id=${entry['.id']}`]);
                }
              }

              userSuccess = true;
              mikrotikSuccessCount++;
              console.log(`   ✅ [${user.username}] Berhasil di-unisolir di MikroTik (Profile: ${normalProfile})`);
            } catch (uErr) {
              mikrotikFailedCount++;
              console.error(`   ❌ [${user.username}] Gagal update di MikroTik: ${uErr.message}`);
            }
          }

          try { await conn.close(); } catch {}
        } catch (routerErr) {
          console.error(`   ⚠️ Gagal terhubung ke router ${router.ipAddress}: ${routerErr.message}`);
          mikrotikFailedCount += users.length;
        }
      }

      // Sinkronisasi FreeRADIUS jika mode RADIUS aktif
      if (isRadiusEnabled) {
        console.log('\n🛡️  Menyinkronkan Database FreeRADIUS (Dual-Mode)...');
        for (const user of isolatedUsers) {
          try {
            const normalGroup = user.profile?.groupName || 'default';

            // Hapus blokir di radcheck & radreply
            await prisma.$executeRaw`
              DELETE FROM radcheck 
              WHERE username = ${user.username} 
                AND attribute IN ('Auth-Type', 'NAS-IP-Address')
            `;
            await prisma.$executeRaw`
              DELETE FROM radreply 
              WHERE username = ${user.username} 
                AND attribute = 'Reply-Message'
            `;

            // Pastikan password ada di radcheck
            await prisma.$executeRaw`
              INSERT INTO radcheck (username, attribute, op, value)
              VALUES (${user.username}, 'Cleartext-Password', ':=', ${user.password})
              ON DUPLICATE KEY UPDATE value = ${user.password}
            `;

            // Kembalikan ke grup normal
            await prisma.$executeRaw`DELETE FROM radusergroup WHERE username = ${user.username}`;
            await prisma.$executeRaw`
              INSERT INTO radusergroup (username, groupname, priority)
              VALUES (${user.username}, ${normalGroup}, 1)
            `;

            // Pulihkan IP statis jika ada
            if (user.ipAddress) {
              await prisma.$executeRaw`
                INSERT INTO radreply (username, attribute, op, value)
                VALUES (${user.username}, 'Framed-IP-Address', ':=', ${user.ipAddress})
                ON DUPLICATE KEY UPDATE value = ${user.ipAddress}
              `;
            }

            // Tutup sesi isolir di radacct
            await prisma.$executeRaw`
              UPDATE radacct 
              SET acctstoptime = NOW(), acctterminatecause = 'Admin-Reset'
              WHERE username = ${user.username} AND acctstoptime IS NULL
            `;
          } catch (radErr) {
            console.error(`   ⚠️ Gagal sync RADIUS untuk ${user.username}: ${radErr.message}`);
          }
        }
        console.log('   ✓ Sinkronisasi FreeRADIUS selesai.');
      }

      // Update status pelanggan di database menjadi 'active'
      const unisolatedIds = isolatedUsers.map(u => u.id);
      await prisma.pppoeUser.updateMany({
        where: { id: { in: unisolatedIds } },
        data: {
          status: 'active',
          billingDay: 6,
          billingCycleDay: 6,
          expiredAt: TARGET_DATE,
        }
      });
      console.log(`\n✅ Database: ${unisolatedIds.length} pelanggan status diubah menjadi 'active' & expiredAt 6 September 2026.`);
    } else {
      console.log('ℹ️ Tidak ada pelanggan berstatus terisolir saat ini.');
    }

    // 3. Update Tanggal Isolir & Billing Day untuk Seluruh Pelanggan Aktif
    console.log('\n📅 Menyelaraskan Tanggal Jatuh Tempo & Isolir Seluruh Pelanggan...');

    // Pelanggan dengan expiredAt <= 6 September 2026 (atau NULL) dan bukan stop/blocked
    const alignResult = await prisma.pppoeUser.updateMany({
      where: {
        status: { notIn: ['stop', 'blocked'] },
        OR: [
          { expiredAt: null },
          { expiredAt: { lte: TARGET_DATE } },
        ]
      },
      data: {
        billingDay: 6,
        billingCycleDay: 6,
        expiredAt: TARGET_DATE,
      }
    });
    console.log(`   ✓ ${alignResult.count} pelanggan diperbarui: expiredAt = 06/09/2026, billingDay = 6.`);

    // Untuk pelanggan yang sudah bayar lebih awal (misal Oktober), update siklus billingDay = 6 tanpa kurangi masa aktifnya
    const futurePaidResult = await prisma.pppoeUser.updateMany({
      where: {
        status: { notIn: ['stop', 'blocked'] },
        expiredAt: { gt: TARGET_DATE },
      },
      data: {
        billingDay: 6,
        billingCycleDay: 6,
      }
    });
    if (futurePaidResult.count > 0) {
      console.log(`   ✓ ${futurePaidResult.count} pelanggan yang sudah bayar bulan berikutnya (masa aktif tetap aman) diperbarui siklus billingDay = 6.`);
    }

    // 4. Update Tagihan Invoice September yang Belum Lunas (PENDING & OVERDUE)
    console.log('\n📄 Menyesuaikan Tagihan Invoice September 2026...');
    const startOfSept = new Date('2026-09-01T00:00:00.000Z');
    const endOfSept = new Date('2026-09-30T23:59:59.999Z');

    const invResult = await prisma.invoice.updateMany({
      where: {
        status: { in: ['PENDING', 'OVERDUE'] },
        OR: [
          { dueDate: { gte: startOfSept, lte: endOfSept } },
          { dueDate: { lt: startOfSept } }, // Tagihan lama yang belum lunas
        ]
      },
      data: {
        dueDate: TARGET_DATE,
        status: 'PENDING', // Kembalikan OVERDUE ke PENDING karena tanggal jatuh tempo dimundurkan ke tgl 6
      }
    });

    console.log(`   ✓ ${invResult.count} tagihan invoice diperbarui ke Tanggal Jatuh Tempo: 6 September 2026 (Status: PENDING).`);

    console.log('\n' + '='.repeat(75));
    console.log('🎉 SEMUA TUGAS SELESAI DENGAN SUKSES!');
    console.log('='.repeat(75));
    console.log(`• Total Pelanggan Di-unisolir : ${isolatedUsers.length}`);
    console.log(`• Tanggal Jatuh Tempo Baru   : 6 September 2026 (23:59:59 WIB)`);
    console.log(`• Total Tagihan Diperbarui   : ${invResult.count} tagihan`);
    console.log(`• Siklus Penagihan Bulanan   : Tanggal 6 setiap bulan`);
    console.log('='.repeat(75) + '\n');

  } catch (error) {
    console.error('❌ Terjadi kesalahan fatal:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

main();
