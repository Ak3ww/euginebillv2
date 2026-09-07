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

async function restoreCibinong() {
  console.log('====================================================');
  console.log('   RESTORE & CLEANUP SECRETS - ROUTER CIBINONG');
  console.log('====================================================\n');

  try {
    const company = await prisma.company.findFirst();
    const isolateProfileName = company?.isolateProfileName || 'isolir';

    // Find Cibinong Router
    const routers = await prisma.router.findMany({ where: { isActive: true } });
    const router = routers.find(r => 
      r.name.toLowerCase().includes('cibinong') || 
      r.name.toLowerCase().includes('cbn') ||
      r.ipAddress === '43.173.14.236' ||
      r.ipAddress === '10.200.0.2'
    ) || routers[0];

    if (!router) {
      console.error('❌ Router Cibinong tidak ditemukan!');
      return;
    }

    console.log(`Target Router: ${router.name} (${router.ipAddress}:${router.port || 8728})`);

    // Fetch users for Cibinong only
    const allUsers = await prisma.pppoeUser.findMany({
      include: { router: true, profile: true },
    });

    const cibinongUsers = allUsers.filter(u => {
      // Must not belong to Citeureup
      const routerName = (u.router?.name || '').toLowerCase();
      if (routerName.includes('citeureup')) return false;
      if (u.username.toUpperCase().startsWith('EMGC')) return false;

      // Belongs to this router or matches prefix EMG
      if (u.routerId === router.id) return true;
      if (!u.routerId && u.username.toUpperCase().startsWith('EMG')) return true;
      return false;
    });

    console.log(`Total user terdaftar untuk Cibinong: ${cibinongUsers.length}`);

    // Filter out OFF / inactive / stopped / dismantled users
    const validUsers = cibinongUsers.filter(u => !isUserOffOrInactive(u));
    const offUsers = cibinongUsers.filter(u => isUserOffOrInactive(u));
    console.log(`  - User aktif/isolir yang sah: ${validUsers.length}`);
    console.log(`  - User OFF / non-aktif / dicabut (DIABAIKAN): ${offUsers.length}`);

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
    console.log(`Total secret saat ini di MikroTik: ${existingSecrets.length}`);

    // 3. REMOVE SPURIOUS SECRETS:
    //    - Anything starting with EMGC (belongs to Citeureup)
    //    - Anything with -OFF- or _OFF_
    //    - Any secret belonging to an inactive/stopped user in DB
    const offUsernames = new Set(offUsers.map(u => u.username.toLowerCase()));
    let removedCount = 0;

    for (const s of existingSecrets) {
      const sName = (s.name || '').trim();
      const sNameUpper = sName.toUpperCase();
      const sNameLower = sName.toLowerCase();

      const isCiteureup = sNameUpper.startsWith('EMGC');
      const hasOffTag = sNameUpper.includes('-OFF-') || sNameUpper.includes('_OFF_') || sNameUpper.includes('(OFF)');
      const isDbOffUser = offUsernames.has(sNameLower);
      const isBogusComment = (s.comment || '').includes('Restored from FreeRADIUS radcheck') && isCiteureup;

      if (isCiteureup || hasOffTag || isDbOffUser || isBogusComment) {
        console.log(`  [-] MENGHAPUS secret tidak valid: ${sName} (${s.comment || 'no comment'})`);
        await api.write(['/ppp/secret/remove', `=.id=${s['.id']}`]);
        removedCount++;
      }
    }
    console.log(`✓ Total secret sampah/salah router dihapus: ${removedCount}`);

    // 4. Refresh existing secrets after cleanup
    const currentSecrets = await api.write('/ppp/secret/print');
    const secretMap = new Map();
    for (const s of currentSecrets) {
      if (s.name) secretMap.set(s.name.toLowerCase(), s);
    }

    // 5. RESTORE / SYNC LEGITIMATE USERS
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
        // MISSING -> ADD
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
        // EXISTS -> check profile only (don't overwrite password unnecessarily)
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
          console.log(`  [*] Profil diperbarui: ${username} -> ${profileName}`);
        } else {
          skippedCount++;
        }
      }
    }

    const finalSecrets = await api.write('/ppp/secret/print');
    console.log('\n====================================================');
    console.log(`✓ PROSES CIBINONG SELESAI!`);
    console.log(`✓ Total secret sekarang di MikroTik Cibinong: ${finalSecrets.length}`);
    console.log(`✓ Dihapus (sampah/OFF/Citeureup): ${removedCount}`);
    console.log(`✓ Dibuat baru (missing): ${createdCount}`);
    console.log(`✓ Diperbarui profil: ${updatedCount}`);
    console.log(`✓ Sudah cocok & utuh: ${skippedCount}`);
    console.log('====================================================\n');

    await api.close();
  } catch (err) {
    console.error('Fatal error in restoreCibinong:', err);
  } finally {
    await prisma.$disconnect();
  }
}

restoreCibinong();
