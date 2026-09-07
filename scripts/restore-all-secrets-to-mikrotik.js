const { PrismaClient } = require('@prisma/client');
const { RouterOSAPI } = require('node-routeros');

const prisma = new PrismaClient();

const EXCLUDED_STATUSES = new Set([
  'stop', 'stopped', 'inactive', 'dismantled', 'dismantle',
  'terminated', 'cancelled', 'pending', 'pending_installation'
]);

function isUserOffOrInactive(user) {
  if (!user) return true;
  if (user.isDismantled) return true;
  const username = (user.username || '').toUpperCase();
  if (username.includes('-OFF-') || username.includes('_OFF_') || username.includes('(OFF)')) return true;
  const status = (user.status || '').toLowerCase().trim();
  if (EXCLUDED_STATUSES.has(status)) return true;
  return false;
}

async function restoreSecrets() {
  console.log('====================================================');
  console.log('   SAFE RESTORE SECRETS TO MIKROTIK (PER ROUTER)');
  console.log('====================================================\n');

  try {
    const company = await prisma.company.findFirst();
    const isolateProfileName = company?.isolateProfileName || 'isolir';

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

    for (const router of routers) {
      const isCiteureupRouter = router.name.toLowerCase().includes('citeureup') || router.name.toLowerCase().includes('ctp');
      const isCibinongRouter = router.name.toLowerCase().includes('cibinong') || router.name.toLowerCase().includes('cbn') || !isCiteureupRouter;

      const apiHost = router.ipAddress || router.nasname;
      const apiPort = router.port || 8728;
      console.log(`\n----------------------------------------------------`);
      console.log(`Target Router: ${router.name} (${apiHost}:${apiPort})`);

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
        await api.write(['/ppp/aaa/set', '=use-radius=no', '=accounting=no']);
        console.log('✓ Enforced /ppp/aaa use-radius=no accounting=no');

        // 2. Strip 'ppp' from /radius service
        try {
          const radiusEntries = await api.write('/radius/print');
          for (const r of radiusEntries) {
            const currentService = (r.service || '').toLowerCase();
            if (currentService.includes('ppp')) {
              await api.write(['/radius/set', `=.id=${r['.id']}`, '=service=hotspot']);
            }
          }
        } catch (rErr) {
          // ignore
        }

        // 3. Strict router filtering: DO NOT CROSS ROUTERS!
        const routerUsers = allUsers.filter(u => {
          if (isCiteureupRouter) {
            const rName = (u.router?.name || '').toLowerCase();
            return rName.includes('citeureup') || u.routerId === router.id || u.username.toUpperCase().startsWith('EMGC');
          } else {
            // Cibinong / other
            const rName = (u.router?.name || '').toLowerCase();
            if (rName.includes('citeureup')) return false;
            if (u.username.toUpperCase().startsWith('EMGC')) return false;
            return u.routerId === router.id || (!u.routerId && u.username.toUpperCase().startsWith('EMG'));
          }
        });

        // 4. Strict status filtering: NO OFF / STOPPED / DISMANTLED USERS
        const validUsers = routerUsers.filter(u => !isUserOffOrInactive(u));
        const offUsers = routerUsers.filter(u => isUserOffOrInactive(u));
        const offUsernameSet = new Set(offUsers.map(u => u.username.toLowerCase()));

        console.log(`User sah untuk router ini: ${validUsers.length} (Diabaikan OFF: ${offUsers.length})`);

        // 5. Cleanup spurious secrets from MikroTik
        const existingSecrets = await api.write('/ppp/secret/print');
        let removedCount = 0;

        for (const s of existingSecrets) {
          const sNameUpper = (s.name || '').toUpperCase().trim();
          const sNameLower = (s.name || '').toLowerCase().trim();

          let shouldRemove = false;

          if (isCiteureupRouter) {
            // On Citeureup, remove Cibinong users (EMG* without C) and OFF users
            if (sNameUpper.startsWith('EMG') && !sNameUpper.startsWith('EMGC')) shouldRemove = true;
          } else {
            // On Cibinong, remove Citeureup users (EMGC*)
            if (sNameUpper.startsWith('EMGC')) shouldRemove = true;
          }

          if (sNameUpper.includes('-OFF-') || sNameUpper.includes('_OFF_') || sNameUpper.includes('(OFF)')) {
            shouldRemove = true;
          }
          if (offUsernameSet.has(sNameLower)) {
            shouldRemove = true;
          }

          if (shouldRemove) {
            console.log(`  [-] Menghapus secret tidak sah: ${s.name}`);
            await api.write(['/ppp/secret/remove', `=.id=${s['.id']}`]);
            removedCount++;
          }
        }
        if (removedCount > 0) {
          console.log(`✓ Dihapus ${removedCount} secret tidak sah.`);
        }

        // 6. Refresh and restore missing/update profiles
        const freshSecrets = await api.write('/ppp/secret/print');
        const secretMap = new Map();
        for (const s of freshSecrets) {
          if (s.name) secretMap.set(s.name.toLowerCase(), s);
        }

        let createdCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;

        for (const user of validUsers) {
          try {
            const username = user.username.trim();
            const password = user.password || '123456';
            const isIsolated = user.status === 'isolated';
            const profileName = isIsolated 
              ? isolateProfileName 
              : (user.profile?.mikrotikProfileName || user.profile?.name || 'default');
            const comment = `${user.name || ''} - ${user.customerId || ''}`.trim();

            const existing = secretMap.get(username.toLowerCase());

            if (!existing) {
              const addParams = [
                '/ppp/secret/add',
                `=name=${username}`,
                `=password=${password}`,
                `=profile=${profileName}`,
                '=service=pppoe',
                `=comment=${comment}`,
                '=disabled=no',
              ];
              if (user.ipAddress) {
                addParams.push(`=remote-address=${user.ipAddress}`);
              }
              await api.write(addParams);
              createdCount++;
              console.log(`  [+] Dibuat: ${username} (Profil: ${profileName})`);
            } else {
              let needUpdate = false;
              if (isIsolated && existing.profile !== isolateProfileName) {
                needUpdate = true;
              } else if (!isIsolated && existing.profile === isolateProfileName) {
                needUpdate = true;
              }

              if (needUpdate) {
                await api.write([
                  '/ppp/secret/set',
                  `=.id=${existing['.id']}`,
                  `=profile=${profileName}`,
                  '=disabled=no',
                ]);
                updatedCount++;
                console.log(`  [*] Profil disesuaikan: ${username} -> ${profileName}`);
              } else {
                skippedCount++;
              }
            }
          } catch (uErr) {
            console.error(`  [!] Gagal user ${user.username}:`, uErr.message);
          }
        }

        const finalSecrets = await api.write('/ppp/secret/print');
        console.log(`✓ Selesai untuk ${router.name}: total secret sekarang = ${finalSecrets.length} (Baru: ${createdCount}, Profil diupdate: ${updatedCount}, Utuh: ${skippedCount})`);

        await api.close();
      } catch (connErr) {
        console.error(`❌ Gagal terhubung ke router ${router.name}:`, connErr.message);
      }
    }

    console.log('\n====================================================');
    console.log('✓ SEMUA PROSES PEMULIHAN SELESAI DENGAN AMAN!');
    console.log('====================================================\n');
  } catch (error) {
    console.error('Fatal error during restore:', error);
  } finally {
    await prisma.$disconnect();
  }
}

restoreSecrets();
