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

async function cleanupCiteureup() {
  console.log('====================================================');
  console.log('   CLEANUP & RESTORE SECRETS - ROUTER CITEUREUP');
  console.log('====================================================\n');

  try {
    const company = await prisma.company.findFirst();
    const isolateProfileName = company?.isolateProfileName || 'isolir';

    // Find Citeureup Router
    const routers = await prisma.router.findMany({ where: { isActive: true } });
    const router = routers.find(r => 
      r.name.toLowerCase().includes('citeureup') || 
      r.name.toLowerCase().includes('ctp') ||
      r.ipAddress === '10.201.0.15'
    );

    if (!router) {
      console.error('❌ Router Citeureup tidak ditemukan di database!');
      return;
    }

    console.log(`Target Router: ${router.name} (${router.ipAddress}:${router.port || 8728})`);

    // Fetch users for Citeureup only
    const allUsers = await prisma.pppoeUser.findMany({
      include: { router: true, profile: true },
    });

    const citeureupUsers = allUsers.filter(u => {
      const routerName = (u.router?.name || '').toLowerCase();
      if (routerName.includes('citeureup')) return true;
      if (u.routerId === router.id) return true;
      if (u.username.toUpperCase().startsWith('EMGC')) return true;
      return false;
    });

    console.log(`Total user terdaftar untuk Citeureup di database: ${citeureupUsers.length}`);

    const validUsers = citeureupUsers.filter(u => !isUserOffOrInactive(u));
    const offUsers = citeureupUsers.filter(u => isUserOffOrInactive(u));
    console.log(`  - User aktif/isolir yang sah: ${validUsers.length}`);
    console.log(`  - User OFF / non-aktif (DIABAIKAN): ${offUsers.length}`);

    const validCiteureupUsernames = new Set(validUsers.map(u => u.username.toLowerCase()));

    const apiHost = router.ipAddress || router.nasname;
    const apiPort = router.port || 8728;

    const api = new RouterOSAPI({
      host: apiHost,
      port: apiPort,
      user: router.username,
      password: router.password,
      timeout: 15,
    });

    await api.connect();
    console.log(`\n✓ Terhubung ke MikroTik ${router.name}!`);

    // 1. Ensure PPP AAA uses local secrets
    await api.write(['/ppp/aaa/set', '=use-radius=no', '=accounting=no']);
    console.log('✓ Enforced /ppp/aaa use-radius=no accounting=no');

    // 2. Fetch existing secrets
    const existingSecrets = await api.write('/ppp/secret/print');
    console.log(`Total secret saat ini di MikroTik Citeureup: ${existingSecrets.length}`);

    // 3. REMOVE SPURIOUS SECRETS:
    //    - Any user that starts with EMG but NOT EMGC (Cibinong users that got dumped)
    //    - Any secret not in the valid Citeureup user list that was restored from radcheck
    //    - Any OFF user
    let removedCount = 0;

    for (const s of existingSecrets) {
      const sName = (s.name || '').trim();
      const sNameUpper = sName.toUpperCase();
      const sNameLower = sName.toLowerCase();

      const isCibinongUser = sNameUpper.startsWith('EMG') && !sNameUpper.startsWith('EMGC');
      const hasOffTag = sNameUpper.includes('-OFF-') || sNameUpper.includes('_OFF_') || sNameUpper.includes('(OFF)');
      const isFromRadcheck = (s.comment || '').includes('FreeRADIUS');
      const notInCiteureupDb = !validCiteureupUsernames.has(sNameLower);

      if (isCibinongUser || hasOffTag || (isFromRadcheck && notInCiteureupDb)) {
        console.log(`  [-] MENGHAPUS secret nyasar: ${sName} (${s.comment || 'no comment'})`);
        await api.write(['/ppp/secret/remove', `=.id=${s['.id']}`]);
        removedCount++;
      }
    }
    console.log(`✓ Total secret nyasar (Cibinong/FreeRADIUS/OFF) dihapus: ${removedCount}`);

    // 4. Refresh existing secrets after cleanup
    const currentSecrets = await api.write('/ppp/secret/print');
    const secretMap = new Map();
    for (const s of currentSecrets) {
      if (s.name) secretMap.set(s.name.toLowerCase(), s);
    }

    // 5. RESTORE LEGITIMATE CITEUREUP USERS & FIX THEIR PROFILES
    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const user of validUsers) {
      const username = user.username.trim();
      const password = user.password || '123456';
      const isIsolated = user.status === 'isolated';
      const profileName = isIsolated 
        ? isolateProfileName 
        : (user.profile?.mikrotikProfileName || user.profile?.name || 'default');
      const comment = `${user.name || ''} - ${user.customerId || ''}`.trim();

      const existing = secretMap.get(username.toLowerCase());

      if (!existing) {
        // Missing -> add
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
        console.log(`  [+] Dibuat ulang: ${username} (Profil: ${profileName})`);
      } else {
        // Exists -> fix profile if it was wrongly set to isolir or differs
        if (existing.profile !== profileName) {
          await api.write([
            '/ppp/secret/set',
            `=.id=${existing['.id']}`,
            `=profile=${profileName}`,
            '=disabled=no',
          ]);
          updatedCount++;
          console.log(`  [*] Profil dikembalikan: ${username} (${existing.profile} -> ${profileName})`);
        } else {
          skippedCount++;
        }
      }
    }

    const finalSecrets = await api.write('/ppp/secret/print');
    console.log('\n====================================================');
    console.log(`✓ PROSES CITEUREUP SELESAI!`);
    console.log(`✓ Total secret sekarang di MikroTik Citeureup: ${finalSecrets.length}`);
    console.log(`✓ Dihapus (secret nyasar dari Cibinong/FreeRADIUS): ${removedCount}`);
    console.log(`✓ Dibuat baru: ${createdCount}`);
    console.log(`✓ Profil diperbaiki/dikembalikan dari isolir: ${updatedCount}`);
    console.log(`✓ Sesuai: ${skippedCount}`);
    console.log('====================================================\n');

    await api.close();
  } catch (err) {
    console.error('Fatal error in cleanupCiteureup:', err);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupCiteureup();
