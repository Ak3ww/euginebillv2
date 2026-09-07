import { PrismaClient } from '@prisma/client';
import { RouterOSAPI } from 'node-routeros';

const prisma = new PrismaClient();

async function restoreSecrets() {
  console.log('====================================================');
  console.log('   EMERGENCY RESTORE ALL SECRETS TO MIKROTIK');
  console.log('====================================================\n');

  try {
    const company = await prisma.company.findFirst();
    const isolateProfileName = company?.isolateProfileName || 'isolir';
    console.log(`Company isolation profile: ${isolateProfileName}`);

    // Ensure RADIUS PPPoE is toggled OFF in DB
    await prisma.company.updateMany({
      data: {
        radiusPppoeEnabled: false,
        radiusEnabled: false,
      }
    });
    console.log('✓ Force set radiusPppoeEnabled=false & radiusEnabled=false in DB\n');

    // Fetch all active routers
    const routers = await prisma.router.findMany({
      where: { isActive: true },
    });

    if (routers.length === 0) {
      console.log('⚠️ Tidak ada router aktif ditemukan di database!');
      return;
    }

    console.log(`Ditemukan ${routers.length} router aktif.\n`);

    // Fetch all PPPoE users from database
    const allUsers = await prisma.pppoeUser.findMany({
      include: { router: true, profile: true },
    });
    console.log(`Total user PPPoE di database: ${allUsers.length}`);

    // Also fetch users from radcheck & radusergroup if any exist
    let radcheckUsers = [];
    try {
      radcheckUsers = await prisma.radcheck.findMany({
        where: { attribute: { in: ['Cleartext-Password', 'User-Password'] } },
      });
      console.log(`Total user di FreeRADIUS (radcheck): ${radcheckUsers.length}`);
    } catch (e) {
      console.log('Tabel radcheck tidak dapat diakses atau kosong.');
    }

    let radgroups = [];
    try {
      radgroups = await prisma.radusergroup.findMany();
    } catch (e) {
      // ignore
    }
    const radGroupMap = new Map(radgroups.map(g => [g.username, g.groupname]));

    for (const router of routers) {
      const apiHost = router.ipAddress || router.nasname;
      const apiPort = router.port || 8728;
      console.log(`\n----------------------------------------------------`);
      console.log(`Connecting to router: ${router.name} (${apiHost}:${apiPort})...`);

      const api = new RouterOSAPI({
        host: apiHost,
        port: apiPort,
        user: router.username,
        password: router.password,
        timeout: 15,
      });

      try {
        await api.connect();
        console.log(`✓ Terhubung ke MikroTik ${router.name}!`);

        // 1. HARD ISOLATION: Disable RADIUS for PPP
        console.log('Enforcing /ppp/aaa use-radius=no accounting=no...');
        await api.write(['/ppp/aaa/set', '=use-radius=no', '=accounting=no']);

        // 2. Strip 'ppp' from /radius service
        try {
          const radiusEntries = await api.write('/radius/print');
          for (const r of radiusEntries) {
            const currentService = (r.service || '').toLowerCase();
            if (currentService.includes('ppp')) {
              console.log(`Stripping 'ppp' from radius entry ${r['.id']}...`);
              await api.write(['/radius/set', `=.id=${r['.id']}`, '=service=hotspot']);
            }
          }
        } catch (rErr) {
          console.log('Radius entry update note:', rErr.message);
        }

        // 3. Get existing secrets from MikroTik
        const existingSecrets = await api.write('/ppp/secret/print');
        console.log(`Jumlah secret saat ini di MikroTik: ${existingSecrets.length}`);

        const existingMap = new Map();
        for (const s of existingSecrets) {
          if (s.name) existingMap.set(s.name.toLowerCase(), s);
        }

        // Filter users for this router (or all users if only 1 router)
        const targetUsers = routers.length === 1 
          ? allUsers 
          : allUsers.filter(u => u.routerId === router.id || !u.routerId);

        console.log(`Memproses ${targetUsers.length} user dari database untuk router ini...`);

        let createdCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        for (const user of targetUsers) {
          try {
            const username = user.username.trim();
            const password = user.password || '123456';
            const isIsolated = user.status === 'isolated';
            const isSuspended = user.status === 'suspended' || user.status === 'stop';
            
            const profileName = isIsolated 
              ? isolateProfileName 
              : (user.profile?.mikrotikProfileName || user.profile?.name || 'default');

            const comment = `${user.name || ''} - ${user.customerId || ''} [RESTORED]`.trim();
            const disabledParam = isSuspended ? 'yes' : 'no';

            const existing = existingMap.get(username.toLowerCase());

            if (!existing) {
              // Secret MISSING -> ADD
              const addParams = [
                '/ppp/secret/add',
                `=name=${username}`,
                `=password=${password}`,
                `=profile=${profileName}`,
                '=service=pppoe',
                `=comment=${comment}`,
                `=disabled=${disabledParam}`,
              ];
              if (user.ipAddress) {
                addParams.push(`=remote-address=${user.ipAddress}`);
              }
              await api.write(addParams);
              createdCount++;
              console.log(`  [+] Dibuat ulang: ${username} (Profil: ${profileName})`);
            } else {
              // Secret EXISTS -> check if profile or password needs update
              const needProfileUpdate = isIsolated ? (existing.profile !== isolateProfileName) : (existing.profile === isolateProfileName);
              const needPasswordUpdate = existing.password !== password;

              if (needProfileUpdate || needPasswordUpdate) {
                const setParams = [
                  '/ppp/secret/set',
                  `=.id=${existing['.id']}`,
                  `=password=${password}`,
                  `=profile=${profileName}`,
                  `=disabled=${disabledParam}`,
                ];
                await api.write(setParams);
                updatedCount++;
                console.log(`  [*] Diperbarui: ${username} (Profil: ${profileName})`);
              } else {
                skippedCount++;
              }
            }
          } catch (userErr) {
            errorCount++;
            console.error(`  [!] Gagal memproses ${user.username}:`, userErr.message);
          }
        }

        // 4. Also check users in radcheck that might not be in pppoeUser
        const userDbSet = new Set(allUsers.map(u => u.username.toLowerCase()));
        for (const rc of radcheckUsers) {
          const rcUser = rc.username.trim();
          if (!userDbSet.has(rcUser.toLowerCase()) && !existingMap.has(rcUser.toLowerCase())) {
            try {
              const rcPass = rc.value || '123456';
              const rcGroup = radGroupMap.get(rcUser) || 'default';
              console.log(`  [+] Memulihkan user dari FreeRADIUS: ${rcUser} (Group: ${rcGroup})`);
              await api.write([
                '/ppp/secret/add',
                `=name=${rcUser}`,
                `=password=${rcPass}`,
                `=profile=${rcGroup}`,
                '=service=pppoe',
                '=comment=Restored from FreeRADIUS radcheck',
                '=disabled=no',
              ]);
              createdCount++;
            } catch (rcErr) {
              console.error(`  [!] Gagal memulihkan ${rcUser} dari radcheck:`, rcErr.message);
            }
          }
        }

        // Re-check count on MikroTik
        const finalSecrets = await api.write('/ppp/secret/print');
        console.log(`\n================ Selesai untuk ${router.name} ================`);
        console.log(`✓ Total secret sekarang di MikroTik: ${finalSecrets.length}`);
        console.log(`✓ Baru dibuat (dipulihkan): ${createdCount}`);
        console.log(`✓ Diperbarui: ${updatedCount}`);
        console.log(`✓ Sesuai (tidak perlu diubah): ${skippedCount}`);
        if (errorCount > 0) console.log(`⚠️ Gagal: ${errorCount}`);

        await api.close();
      } catch (connErr) {
        console.error(`❌ Gagal terhubung ke router ${router.name}:`, connErr.message);
      }
    }

    console.log('\n====================================================');
    console.log('✓ SEMUA PROSES PEMULIHAN SECRET SELESAI!');
    console.log('====================================================\n');
  } catch (error) {
    console.error('Fatal error during restore:', error);
  } finally {
    await prisma.$disconnect();
  }
}

restoreSecrets();
