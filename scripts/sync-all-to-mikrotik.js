#!/usr/bin/env node

/**
 * EugineBill — Bulk Sync Tool (Billing -> MikroTik & RADIUS)
 * 
 * Fitur:
 * 1. Sinkronisasi Paket/Profil: Memetakan & membuat /ppp/profile di MikroTik sesuai paket billing.
 * 2. Sinkronisasi Pelanggan: Menulis/memperbarui semua /ppp/secret pelanggan di MikroTik.
 * 3. Sinkronisasi FreeRADIUS: Memperbarui tabel radcheck, radusergroup, dan radreply (jika RADIUS aktif).
 * 4. Opsional --kick: Memutus sesi aktif agar ONT pelanggan langsung menerapkan kecepatan baru.
 * 
 * Penggunaan:
 *   node scripts/sync-all-to-mikrotik.js [ROUTER_NAME_OR_IP] [--kick] [--dry-run]
 * Contoh:
 *   node scripts/sync-all-to-mikrotik.js CIBINONG
 *   node scripts/sync-all-to-mikrotik.js CIBINONG --kick
 */

const { PrismaClient } = require('@prisma/client');
const { RouterOSAPI, Channel } = require('node-routeros');

// Patch node-routeros Channel for RouterOS 7.18+ !empty reply compatibility
if (Channel && Channel.prototype && !Channel.prototype._ros7EmptyPatched) {
  Channel.prototype._ros7EmptyPatched = true;
  const proto = Channel.prototype;
  const originalProcessPacket = proto.processPacket;
  proto.processPacket = function (packet) {
    if (packet && packet.length > 0 && packet[0] === '!empty') {
      packet.shift();
      return;
    }
    return originalProcessPacket.call(this, packet);
  };
}

const prisma = new PrismaClient();

function normalizeSpeedStr(str) {
  if (!str) return '';
  return str.toLowerCase().replace(/\s+/g, '');
}

async function main() {
  const args = process.argv.slice(2);
  const isKick = args.includes('--kick');
  const isDryRun = args.includes('--dry-run');
  const searchTerm = args.find(a => !a.startsWith('--')) || 'CIBINONG';

  console.log('\n================================================================');
  console.log('       EUGINEBILL — BULK SYNC BILLING -> MIKROTIK & RADIUS      ');
  console.log('================================================================');
  console.log(`Target Router Filter : "${searchTerm}"`);
  console.log(`Mode Operasi         : ${isDryRun ? 'DRY-RUN (Simulasi tanpa menulis)' : 'LIVE SYNC (Tulis ke Router & DB)'}`);
  console.log(`Kick Active Sessions : ${isKick ? 'YA (--kick aktif, ONT reconnect otomatis)' : 'TIDAK (Tanpa kick session)'}\n`);

  // 1. Cari Router
  const routers = await prisma.router.findMany({
    where: {
      isActive: true,
      OR: [
        { name: { contains: searchTerm } },
        { ipAddress: { contains: searchTerm } },
        { nasname: { contains: searchTerm } },
      ],
    },
    include: { vpnClient: true },
  });

  if (routers.length === 0) {
    console.error(`[ERROR] Tidak ditemukan router aktif dengan kata kunci "${searchTerm}".`);
    const allRouters = await prisma.router.findMany({ select: { name: true, ipAddress: true, port: true } });
    console.log('\nDaftar router aktif di database:');
    allRouters.forEach(r => console.log(` - ${r.name} (${r.ipAddress}:${r.port || 8728})`));
    process.exit(1);
  }

  const router = routers[0];
  const configuredHost = router.ipAddress?.trim() || router.nasname?.trim() || router.vpnClient?.vpnIp;
  const configuredPort = router.port || (router.vpnClient?.publicPorts)?.services?.api?.target || 8728;
  const apiUser = router.username || router.vpnClient?.apiUsername || 'admin';
  const apiPass = router.password || router.vpnClient?.apiPassword || '';

  console.log(`Router Terpilih : ${router.name}`);
  console.log(`Host / Port API : ${configuredHost}:${configuredPort}`);
  console.log(`User API        : ${apiUser}`);
  console.log(`----------------------------------------------------------------\n`);

  // 2. Hubungkan ke RouterOS API
  console.log(`[FASE 1] Menghubungkan ke MikroTik RouterOS API (${configuredHost}:${configuredPort})...`);
  const api = new RouterOSAPI({
    host: configuredHost,
    port: configuredPort,
    user: apiUser,
    password: apiPass,
    timeout: 8,
    tls: configuredPort === 8729,
  });

  try {
    await api.connect();
    console.log('  [OK] Berhasil login ke RouterOS API!');
  } catch (connErr) {
    console.error(`  [GAGAL] Tidak dapat terhubung ke MikroTik: ${connErr.message || connErr}`);
    process.exit(1);
  }

  // Ambil Resource & Info
  const resource = await api.write('/system/resource/print').catch(() => [{}]);
  const rosVersion = resource[0]?.version || 'Unknown';
  console.log(`  - RouterOS Version : ${rosVersion}`);

  // 3. Sinkronisasi Profil / Paket (pppoe_profiles <-> /ppp/profile)
  console.log(`\n[FASE 2] Memeriksa dan Menyinkronkan Paket / Profil PPPoE...`);
  const dbProfiles = await prisma.pppoeProfile.findMany({ where: { isActive: true } });
  const mtkProfiles = await api.write('/ppp/profile/print').catch(() => []);
  const mtkProfileNames = mtkProfiles.map(p => p.name);

  console.log(`  Total profil di MikroTik : ${mtkProfiles.length} profil (${mtkProfileNames.join(', ')})`);
  console.log(`  Total paket di Billing   : ${dbProfiles.length} paket\n`);

  const profileMap = new Map(); // dbProfile.id -> mikrotikProfileName

  for (const prof of dbProfiles) {
    let matchedMtkName = null;

    // Prioritas 1: Exact match mikrotikProfileName
    if (prof.mikrotikProfileName && mtkProfileNames.includes(prof.mikrotikProfileName)) {
      matchedMtkName = prof.mikrotikProfileName;
    }
    // Prioritas 2: Exact match name
    else if (mtkProfileNames.includes(prof.name)) {
      matchedMtkName = prof.name;
    }
    // Prioritas 3: Exact match groupName
    else if (mtkProfileNames.includes(prof.groupName)) {
      matchedMtkName = prof.groupName;
    }
    // Prioritas 4: Cerdas mencocokkan speed string (e.g. "50 Mbps" <-> 50M downloadSpeed)
    else {
      const speedMb = prof.downloadSpeed;
      const speedCandidates = [
        `${speedMb} Mbps`,
        `${speedMb}Mbps`,
        `${speedMb}M`,
        `${speedMb} MBPS`,
        `${speedMb} mbps`,
      ];
      for (const cand of speedCandidates) {
        if (mtkProfileNames.includes(cand)) {
          matchedMtkName = cand;
          break;
        }
      }

      // Normalized fallback check
      if (!matchedMtkName) {
        const normProf = normalizeSpeedStr(prof.name);
        for (const mName of mtkProfileNames) {
          if (normalizeSpeedStr(mName) === normProf) {
            matchedMtkName = mName;
            break;
          }
        }
      }
    }

    // Jika belum ada di MikroTik, buatkan profile baru di MikroTik
    if (!matchedMtkName) {
      const newProfName = prof.groupName || prof.name;
      const rateLimit = prof.rateLimit || `${prof.downloadSpeed}M/${prof.uploadSpeed}M`;
      console.log(`  [PROFIL BARU] Paket "${prof.name}" belum ada di MikroTik -> Membuat profil "${newProfName}" (${rateLimit})...`);

      if (!isDryRun) {
        try {
          await api.write('/ppp/profile/add', [
            `=name=${newProfName}`,
            `=rate-limit=${rateLimit}`,
            `=only-one=${prof.sharedUser ? 'no' : 'yes'}`,
          ]);
          matchedMtkName = newProfName;
          mtkProfileNames.push(newProfName);
          console.log(`    [OK] Profil "${newProfName}" berhasil dibuat di MikroTik!`);
        } catch (addProfErr) {
          console.error(`    [GAGAL] Buat profil "${newProfName}": ${addProfErr.message || addProfErr}`);
          matchedMtkName = 'default';
        }
      } else {
        matchedMtkName = newProfName;
      }
    }

    // Perbarui mapping mikrotikProfileName di database jika belum sesuai
    if (matchedMtkName && matchedMtkName !== prof.mikrotikProfileName && !isDryRun) {
      await prisma.pppoeProfile.update({
        where: { id: prof.id },
        data: { mikrotikProfileName: matchedMtkName, lastSyncAt: new Date(), syncedToRadius: true },
      }).catch(() => {});
      console.log(`  [MAPPING] Paket "${prof.name}" -> MikroTik Profile: "${matchedMtkName}" (Disimpan ke DB)`);
    } else {
      console.log(`  [OK] Paket "${prof.name}" -> MikroTik Profile: "${matchedMtkName}"`);
    }

    profileMap.set(prof.id, matchedMtkName);
  }

  // 4. Periksa Company RADIUS Settings
  const company = await prisma.company.findFirst();
  const isRadiusEnabled = company?.radiusEnabled || company?.radiusPppoeEnabled || false;
  console.log(`\n[FASE 3] Mode FreeRADIUS Global: ${isRadiusEnabled ? 'AKTIF (radcheck/radusergroup/radreply ikut disinkronkan)' : 'NON-AKTIF (Direct MikroTik Local Auth Mode)'}`);

  // 5. Sinkronisasi Pelanggan
  console.log(`\n[FASE 4] Mengambil daftar pelanggan PPPoE dari database...`);
  const users = await prisma.pppoeUser.findMany({
    where: {
      OR: [
        { routerId: router.id },
        { routerId: null },
      ],
    },
    include: { profile: true },
    orderBy: { username: 'asc' },
  });

  console.log(`  Ditemukan ${users.length} pelanggan untuk router ${router.name}.\n`);

  // Ambil semua secret eksisting dari MikroTik sekaligus (efisien, 1 query)
  console.log(`  Mengambil cache secret eksisting dari MikroTik...`);
  const existingSecrets = await api.write('/ppp/secret/print').catch(() => []);
  const secretMap = new Map(); // username -> secret item
  existingSecrets.forEach(s => {
    if (s.name) secretMap.set(s.name, s);
  });
  console.log(`  Cache secret MikroTik terkumpul: ${secretMap.size} akun.\n`);

  let addedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  let radiusCount = 0;
  let kickedCount = 0;

  console.log(`Memulai sinkronisasi ${users.length} pelanggan...`);
  console.log('----------------------------------------------------------------');

  for (let i = 0; i < users.length; i++) {
    const u = users[i];
    const progress = `[${i + 1}/${users.length}]`;
    const username = u.username;
    const password = u.password || u.portalPassword || 'eugine0909';
    const assignedProfile = profileMap.get(u.profileId) || u.profile?.mikrotikProfileName || u.profile?.name || 'default';
    
    // Status handling
    const stUpper = String(u.status || '').toUpperCase();
    const isIsolated = stUpper === 'ISOLATED';
    const isBlockedOrStop = ['BLOCKED', 'STOP', 'SUSPENDED'].includes(stUpper);
    const targetProfile = isIsolated ? (mtkProfileNames.includes('isolir') ? 'isolir' : assignedProfile) : assignedProfile;
    const isSecretDisabled = isBlockedOrStop;

    const comment = `${u.name || ''} - ${u.customerId || ''}`.trim();
    const existingMtkSecret = secretMap.get(username);

    // FreeRADIUS Sync jika aktif
    if (isRadiusEnabled && !isDryRun) {
      try {
        await prisma.radcheck.deleteMany({ where: { username } });
        await prisma.radcheck.create({
          data: { username, attribute: 'Cleartext-Password', op: ':=', value: password },
        });

        await prisma.radusergroup.deleteMany({ where: { username } });
        await prisma.radusergroup.create({
          data: { username, groupname: targetProfile, priority: 0 },
        });

        if (u.ipAddress) {
          await prisma.radreply.deleteMany({ where: { username } });
          await prisma.radreply.create({
            data: { username, attribute: 'Framed-IP-Address', op: ':=', value: u.ipAddress },
          });
        }
        radiusCount++;
      } catch (rErr) {
        // silent radius error
      }
    }

    if (isDryRun) {
      console.log(`${progress} (DRY-RUN) ${username} | Paket: ${targetProfile} | Disabled: ${isSecretDisabled ? 'YES' : 'NO'}`);
      continue;
    }

    const sParams = [
      `=password=${password}`,
      `=profile=${targetProfile}`,
      `=service=pppoe`,
      `=comment=${comment}`,
      `=disabled=${isSecretDisabled ? 'yes' : 'no'}`,
    ];
    if (u.ipAddress) sParams.push(`=remote-address=${u.ipAddress}`);

    try {
      if (existingMtkSecret) {
        // Update secret
        try {
          await api.write('/ppp/secret/set', [
            `=.id=${existingMtkSecret['.id']}`,
            ...sParams,
          ]);
          updatedCount++;
          console.log(`${progress} [UPDATE] ${username} -> Profil: "${targetProfile}" (Status: ${u.status})`);
        } catch (setErr) {
          if (String(setErr.message || '').toLowerCase().includes('profile')) {
            sParams[1] = '=profile=default';
            await api.write('/ppp/secret/set', [`=.id=${existingMtkSecret['.id']}`, ...sParams]);
            updatedCount++;
            console.log(`${progress} [UPDATE FALLBACK default] ${username}`);
          } else {
            throw setErr;
          }
        }
      } else {
        // Add new secret
        try {
          await api.write('/ppp/secret/add', [
            `=name=${username}`,
            ...sParams,
          ]);
          addedCount++;
          console.log(`${progress} [TAMBAH] ${username} -> Profil: "${targetProfile}" (Status: ${u.status})`);
        } catch (addErr) {
          if (String(addErr.message || '').toLowerCase().includes('profile')) {
            sParams[1] = '=profile=default';
            await api.write('/ppp/secret/add', [`=name=${username}`, ...sParams]);
            addedCount++;
            console.log(`${progress} [TAMBAH FALLBACK default] ${username}`);
          } else {
            throw addErr;
          }
        }
      }

      // Update routerId & synced status in DB
      await prisma.pppoeUser.update({
        where: { id: u.id },
        data: {
          routerId: router.id,
          syncedToRadius: true,
          lastSyncAt: new Date(),
        },
      }).catch(() => {});

      // Kick active session if requested
      if (isKick) {
        try {
          const activeSess = await api.write('/ppp/active/print', [`?name=${username}`]);
          if (activeSess && activeSess.length > 0) {
            for (const s of activeSess) {
              if (s['.id']) await api.write('/ppp/active/remove', [`=.id=${s['.id']}`]);
            }
            kickedCount++;
          }
        } catch {}
      }

    } catch (opErr) {
      failedCount++;
      console.error(`${progress} [GAGAL] ${username}: ${opErr.message || opErr}`);
    }
  }

  await api.close().catch(() => {});

  console.log('\n================================================================');
  console.log('                 RINGKASAN SINKRONISASI SELESAI                 ');
  console.log('================================================================');
  console.log(`Router Target          : ${router.name} (${configuredHost}:${configuredPort})`);
  console.log(`Total Pelanggan        : ${users.length}`);
  console.log(`Secret Baru Ditambahkan: ${addedCount}`);
  console.log(`Secret Diperbarui      : ${updatedCount}`);
  console.log(`Gagal Disinkronkan     : ${failedCount}`);
  if (isRadiusEnabled) {
    console.log(`Record RADIUS Tersinkron : ${radiusCount}`);
  }
  if (isKick) {
    console.log(`Sesi Aktif Di-Kick     : ${kickedCount} pelanggan (ONT auto-reconnect speed baru)`);
  }
  console.log('================================================================\n');
}

main()
  .catch(err => {
    console.error('[FATAL ERROR]', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
