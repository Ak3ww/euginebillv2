const { PrismaClient } = require('@prisma/client');
const { RouterOSAPI } = require('node-routeros');
const prisma = new PrismaClient();

async function restoreKpTegal() {
  console.log('='.repeat(70));
  console.log('RESTORASI TOTAL PELANGGAN WILAYAH KAMPUNG TEGAL');
  console.log('='.repeat(70));

  try {
    // 1. Find area KAMPUNG TEGAL
    const areas = await prisma.$queryRawUnsafe(
      `SELECT id, name FROM pppoe_areas WHERE LOWER(name) LIKE '%tegal%'`
    );

    if (!areas || areas.length === 0) {
      console.log('❌ Area "KAMPUNG TEGAL" tidak ditemukan di database pppoe_areas.');
      await prisma.$disconnect();
      return;
    }

    console.log(`📍 Ditemukan ${areas.length} area matching:`);
    areas.forEach(a => console.log(`   - ID: ${a.id} | Nama: ${a.name}`));
    const areaIds = areas.map(a => `'${a.id}'`).join(',');

    // 2. Fetch all users in Kampung Tegal with their profile and router
    const users = await prisma.pppoeUser.findMany({
      where: {
        areaId: { in: areas.map(a => a.id) }
      },
      include: {
        profile: true,
        router: true
      }
    });

    console.log(`\n📦 Ditemukan ${users.length} pelanggan di area Kampung Tegal.\n`);

    // 3. Update DB: Set status='active', autoIsolationEnabled=false, waNotificationEnabled=false, expiredAt=nextMonth
    const updateDbResult = await prisma.$executeRawUnsafe(`
      UPDATE pppoe_users 
      SET status = 'active',
          autoIsolationEnabled = 0,
          waNotificationEnabled = 0,
          expiredAt = DATE_ADD(NOW(), INTERVAL 30 DAY)
      WHERE areaId IN (${areaIds})
    `);
    console.log(`✅ [DATABASE] ${updateDbResult} pelanggan berhasil disetel ke:`);
    console.log(`   - status = 'active'`);
    console.log(`   - autoIsolationEnabled = 0 (TETAP TERHUBUNG / Kebal Isolir)`);
    console.log(`   - waNotificationEnabled = 0 (Tidak kirim WA isolir)`);
    console.log(`   - expiredAt diperpanjang 30 hari ke depan\n`);

    // 4. Group users by router to restore on MikroTik
    const usersByRouter = {};
    users.forEach(u => {
      if (u.router) {
        if (!usersByRouter[u.router.id]) {
          usersByRouter[u.router.id] = { router: u.router, userList: [] };
        }
        usersByRouter[u.router.id].userList.push(u);
      }
    });

    for (const routerId in usersByRouter) {
      const { router, userList } = usersByRouter[routerId];
      console.log(`⚡ [MIKROTIK] Menghubungkan ke ${router.name} (${router.ipAddress}:${router.port || 8728})...`);

      const api = new RouterOSAPI({
        host: router.ipAddress,
        port: router.port || 8728,
        user: router.username,
        password: router.password,
        timeout: 10,
      });
      api.on('error', () => {});

      try {
        await api.connect();
        console.log(`✓ Terhubung ke router ${router.name}! Memproses ${userList.length} secret...`);

        for (const u of userList) {
          const targetProfile = u.profile?.mikrotikProfileName || u.profile?.name || 'default';
          try {
            const secrets = await api.write('/ppp/secret/print', [`?name=${u.username}`]);
            if (secrets.length > 0) {
              const currentProf = secrets[0]['profile'];
              if (currentProf !== targetProfile) {
                await api.write('/ppp/secret/set', [
                  `=.id=${secrets[0]['.id']}`,
                  `=profile=${targetProfile}`
                ]);
                console.log(`   ✓ Secret ${u.username}: profil dipulihkan dari '${currentProf}' -> '${targetProfile}'`);
              } else {
                console.log(`   ✓ Secret ${u.username}: sudah profil '${targetProfile}'`);
              }
            }

            // Kick active session if running with isolir profile so it reconnects with normal profile
            const active = await api.write('/ppp/active/print', [`?name=${u.username}`]);
            for (const s of active) {
              await api.write('/ppp/active/remove', [`=.id=${s['.id']}`]);
              console.log(`   ⚡ Kick active session ${u.username} agar reconnect dengan profil aktif`);
            }
          } catch (itemErr) {
            console.error(`   ❌ Gagal memproses ${u.username}:`, itemErr.message);
          }
        }

        await api.close();
        console.log(`✓ Selesai proses MikroTik ${router.name}\n`);
      } catch (rErr) {
        console.error(`❌ Gagal konek ke MikroTik ${router.name}:`, rErr.message);
      }
    }

    console.log('='.repeat(70));
    console.log('🎉 RESTORASI SELESAI: Seluruh pelanggan Kampung Tegal kini AKTIF dan KEBAL ISOLIR!');
    console.log('='.repeat(70));
  } catch (err) {
    console.error('❌ Error saat restorasi:', err);
  } finally {
    await prisma.$disconnect();
  }
}

restoreKpTegal().catch(console.error);
