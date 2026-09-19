#!/usr/bin/env node

/**
 * EugineBill — Safe Bulk Sync Tool (Billing -> MikroTik & FreeRADIUS)
 * 
 * Perlindungan Keras (Hard Invariants & Safety Shields):
 * 1. ZERO OFF TO MIKROTIK: Akun berstatus stop, stopped, suspended, dismantled,
 *    atau berakhiran '-OFF-', '-STOP-', '-CABUT-' DILARANG KERAS dimasukkan ke MikroTik!
 * 2. SHIELD GANTI USER: Jika ada akun lama OFF dan username dasarnya sudah dipakai oleh
 *    pelanggan baru, akun baru 100% terlindungi dan tidak akan tertimpa akun lama.
 * 3. SHIELD SUDAH BAYAR / ANTI-ISOLIR SALAH: Jika pelanggan berstatus 'isolated' di DB
 *    tetapi invoice terakhirnya LUNAS (PAID) atau expiredAt masih di masa depan,
 *    profil di MikroTik OTOMATIS dipulihkan ke paket aslinya (bukan isolir) dan DB disembuhkan ke 'active'.
 * 4. ROUTER SCOPING: Memisahkan secara ketat router Cibinong (EMG) vs Citeureup (EMGC).
 * 5. PROFILE MAPPING: Memetakan nama paket billing ke profil MikroTik (20 Mbps, 50 Mbps, dll).
 * 
 * Penggunaan:
 *   node scripts/sync-all-to-mikrotik.js [ROUTER_KEYWORD] [--dry-run] [--kick]
 * Contoh:
 *   node scripts/sync-all-to-mikrotik.js CIBINONG --dry-run
 *   node scripts/sync-all-to-mikrotik.js CIBINONG
 *   node scripts/sync-all-to-mikrotik.js CIBINONG --kick
 */

const { PrismaClient } = require('@prisma/client');
const { RouterOSAPI, Channel } = require('node-routeros');

// Patch node-routeros Channel for RouterOS 7.18+ / 7.24+ !empty reply compatibility
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

const EXCLUDED_STATUSES = new Set([
  'stop', 'stopped', 'suspended', 'dismantled', 'dismantle',
  'terminated', 'cancelled', 'inactive', 'pending', 'pending_installation',
  'blocked', 'cabut'
]);

function isUserOff(user) {
  if (!user) return true;
  const st = String(user.status || '').toLowerCase().trim();
  if (EXCLUDED_STATUSES.has(st)) return true;
  if (user.isActive === false) return true;

  const uNameUpper = String(user.username || '').toUpperCase();
  if (
    uNameUpper.includes('-OFF-') ||
    uNameUpper.includes('-STOP-') ||
    uNameUpper.includes('-CABUT-') ||
    uNameUpper.includes('_OFF_') ||
    uNameUpper.includes('(OFF)')
  ) {
    return true;
  }

  return false;
}

function getBaseUsername(username) {
  if (!username) return '';
  return String(username)
    .replace(/-OFF-.*$/i, '')
    .replace(/-STOP-.*$/i, '')
    .replace(/-CABUT-.*$/i, '')
    .replace(/_OFF_.*$/i, '')
    .trim();
}

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
  console.log('       EUGINEBILL — SAFE BULK SYNC BILLING -> MIKROTIK          ');
  console.log('       (DILENGKAPI SAFETY SHIELD ANTI-OFF & GANTI USER)         ');
  console.log('================================================================');
  console.log(`Target Router Filter : "${searchTerm}"`);
  console.log(`Mode Operasi         : ${isDryRun ? 'DRY-RUN (Simulasi aman, TANPA menulis ke router)' : 'LIVE SYNC (Tulis ke MikroTik & DB)'}`);
  console.log(`Kick Active Sessions : ${isKick ? 'YA (--kick aktif, ONT reconnect otomatis)' : 'TIDAK (Pertahankan koneksi ONT)'}\n`);

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
  const isCiteureupRouter = router.name.toLowerCase().includes('citeureup') || router.name.toLowerCase().includes('ctp');

  console.log(`Router Terpilih : ${router.name}`);
  console.log(`Tipe Site       : ${isCiteureupRouter ? 'CITEUREUP (Prefix EMGC)' : 'CIBINONG / UTAMA (Prefix EMG)'}`);
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
  console.log(`\n[FASE 2] Memeriksa dan Memetakan Paket Profil PPPoE...`);
  const dbProfiles = await prisma.pppoeProfile.findMany({ where: { isActive: true } });
  const mtkProfiles = await api.write('/ppp/profile/print').catch(() => []);
  const mtkProfileNames = mtkProfiles.map(p => p.name);

  console.log(`  Profil eksisting di MikroTik : ${mtkProfiles.length} profil (${mtkProfileNames.join(', ')})`);
  console.log(`  Paket aktif di Billing       : ${dbProfiles.length} paket\n`);

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
  console.log(`\n[FASE 3] Mode FreeRADIUS Global: ${isRadiusEnabled ? 'AKTIF' : 'NON-AKTIF (Direct MikroTik Local Auth Mode)'}`);

  // 5. Query Seluruh Pelanggan & Lakukan Audit / Filtering Super Ketat
  console.log(`\n[FASE 4] Menarik dan Menganalisis Database Pelanggan...`);
  const allUsersInDb = await prisma.pppoeUser.findMany({
    include: {
      profile: true,
      router: true,
    },
    orderBy: { username: 'asc' },
  });

  // Filter router Cibinong vs Citeureup
  const routerScopedUsers = allUsersInDb.filter(u => {
    if (isCiteureupRouter) {
      const rName = (u.router?.name || '').toLowerCase();
      return rName.includes('citeureup') || u.routerId === router.id || u.username.toUpperCase().startsWith('EMGC');
    } else {
      const rName = (u.router?.name || '').toLowerCase();
      if (rName.includes('citeureup')) return false;
      if (u.username.toUpperCase().startsWith('EMGC')) return false;
      return u.routerId === router.id || (!u.routerId && u.username.toUpperCase().startsWith('EMG'));
    }
  });

  console.log(`  Total data pelanggan terasosiasi dengan router ${router.name}: ${routerScopedUsers.length} akun.`);

  // Pisahkan Pelanggan Aktif vs Pelanggan OFF
  const activeCandidates = [];
  const offUsers = [];

  for (const u of routerScopedUsers) {
    if (isUserOff(u)) {
      offUsers.push(u);
    } else {
      activeCandidates.push(u);
    }
  }

  console.log(`  - Akun Calon Aktif / Terdaftar : ${activeCandidates.length} akun`);
  console.log(`  - Akun Berstatus OFF / Berhenti : ${offUsers.length} akun (DILINDUNGI & TIDAK DIMASUKKAN KE MIKROTIK)`);

  // Bangun Map username aktif untuk mendeteksi "Ganti User" / Reuse Shield
  const activeUserMap = new Map(); // lowercase username -> user object
  for (const u of activeCandidates) {
    activeUserMap.set(u.username.toLowerCase(), u);
  }

  // 6. Audit Akun OFF: Deteksi "Ganti User" & Akun OFF yang Ternyata Sudah Bayar
  console.log(`\n[FASE 5] Menjalankan Audit Keamanan Akun OFF (Safety Shield & Anomaly Detection)...`);
  const now = new Date();
  let gantiUserDetected = 0;
  let offTapiBayarDetected = 0;

  for (const offU of offUsers) {
    const baseU = getBaseUsername(offU.username);
    const activeReuser = activeUserMap.get(baseU.toLowerCase());

    // Cek apakah username dasar sudah dipakai orang lain
    if (activeReuser && activeReuser.id !== offU.id) {
      gantiUserDetected++;
      console.log(`  [SHIELD GANTI USER] Akun OFF '${offU.username}' (${offU.name})`);
      console.log(`    -> Username dasar '${baseU}' kini AKTIF digunakan oleh: '${activeReuser.name}' (ID: ${activeReuser.customerId || activeReuser.id}).`);
      console.log(`    -> STATUS: Akun lama DIABAIKAN, akun baru DILINDUNGI PENUH agar tidak tertimpa!\n`);
    }

    // Cek apakah akun OFF memiliki masa aktif yang belum habis atau tagihan yang lunas
    const hasUnexpiredDate = offU.expiredAt && new Date(offU.expiredAt) > now;
    const latestPaidInvoice = await prisma.invoice.findFirst({
      where: {
        pppoeUserId: offU.id,
        status: 'PAID',
      },
      orderBy: { createdAt: 'desc' },
      select: { invoiceNumber: true, period: true, paidAt: true },
    }).catch(() => null);

    if (hasUnexpiredDate || latestPaidInvoice) {
      offTapiBayarDetected++;
      console.log(`  [PERINGATAN AUDIT - OFF TAPI ADA PEMBAYARAN]`);
      console.log(`    Akun     : ${offU.username} (Nama: ${offU.name}, Telp: ${offU.phone || '-'})`);
      console.log(`    Status DB: ${offU.status} | ExpiredAt: ${offU.expiredAt ? new Date(offU.expiredAt).toLocaleDateString('id-ID') : 'N/A'}`);
      if (latestPaidInvoice) {
        console.log(`    Tagihan  : ${latestPaidInvoice.invoiceNumber} (Periode: ${latestPaidInvoice.period}, LUNAS: ${latestPaidInvoice.paidAt ? new Date(latestPaidInvoice.paidAt).toLocaleDateString('id-ID') : 'Ya'})`);
      }
      if (activeReuser) {
        console.log(`    PERHATIAN: Username '${baseU}' sudah dipakai orang lain! User ini harus diberikan username baru lewat Admin Portal.`);
      } else {
        console.log(`    SARAN    : User ini belum digantikan orang lain. Aktifkan kembali lewat Admin Portal (/admin/pppoe/stopped) jika ingin dimasukkan ke MikroTik.`);
      }
      console.log('    ------------------------------------------------------------');
    }
  }

  if (gantiUserDetected === 0 && offTapiBayarDetected === 0) {
    console.log(`  [OK] Tidak ada konflik anomali ganti user yang mencurigakan pada akun OFF.`);
  }

  // 7. Ambil Cache Secret Eksisting MikroTik
  console.log(`\n[FASE 6] Mengambil Cache Secret Eksisting dari MikroTik...`);
  const existingSecrets = await api.write('/ppp/secret/print').catch(() => []);
  const mtkSecretMap = new Map(); // lowercase name -> secret object
  let existingOffSecretsInMtk = 0;

  for (const s of existingSecrets) {
    if (s.name) {
      mtkSecretMap.set(s.name.toLowerCase(), s);
      const sUpper = s.name.toUpperCase();
      if (sUpper.includes('-OFF-') || sUpper.includes('-STOP-') || sUpper.includes('-CABUT-')) {
        existingOffSecretsInMtk++;
      }
    }
  }

  console.log(`  Total secret di MikroTik        : ${existingSecrets.length} akun`);
  console.log(`  Secret MikroTik bertanda '-OFF-': ${existingOffSecretsInMtk} akun (DIBIARKAN / TIDAK DISINKRONKAN)`);

  // 8. Sinkronisasi Pelanggan Aktif Saja (DENGAN PROTEKSI SUDAH BAYAR / ANTI-ISOLIR SALAH)
  console.log(`\n[FASE 7] Memulai Sinkronisasi ${activeCandidates.length} Pelanggan Aktif ke MikroTik...`);
  console.log('----------------------------------------------------------------');

  let addedCount = 0;
  let updatedCount = 0;
  let protectedFromIsolirCount = 0;
  let failedCount = 0;
  let radiusCount = 0;
  let kickedCount = 0;

  for (let i = 0; i < activeCandidates.length; i++) {
    const u = activeCandidates[i];
    const progress = `[${i + 1}/${activeCandidates.length}]`;
    const username = u.username.trim();
    const password = u.password || u.portalPassword || '123456';
    const assignedProfile = profileMap.get(u.profileId) || u.profile?.mikrotikProfileName || u.profile?.name || 'default';

    // Periksa status dan bukti pembayaran (Anti-Isolir salah)
    const stLower = String(u.status || '').toLowerCase();
    const isDbMarkedIsolated = stLower === 'isolated';

    let targetProfile = assignedProfile;
    let isSecretDisabled = false;
    let autoHealedToActive = false;

    if (isDbMarkedIsolated) {
      // Periksa apakah user ini sebetulnya sudah bayar atau expiredAt masih valid
      const hasValidExpiry = u.expiredAt && new Date(u.expiredAt) > now;
      const latestInvoice = await prisma.invoice.findFirst({
        where: { pppoeUserId: u.id },
        orderBy: { createdAt: 'desc' },
        select: { status: true, period: true },
      }).catch(() => null);

      const isPaid = latestInvoice?.status === 'PAID';

      if (hasValidExpiry || isPaid) {
        // 🛡️ USER SUDAH BAYAR / EXPIRED BELUM HABIS -> JANGAN DIISOLIR!
        targetProfile = assignedProfile;
        isSecretDisabled = false;
        protectedFromIsolirCount++;
        autoHealedToActive = true;

        if (!isDryRun) {
          await prisma.pppoeUser.update({
            where: { id: u.id },
            data: { status: 'active', autoIsolationEnabled: false },
          }).catch(() => {});
        }
      } else {
        // Benar-benar menunggak & belum bayar
        targetProfile = mtkProfileNames.includes('isolir') ? 'isolir' : assignedProfile;
        isSecretDisabled = false;
      }
    } else {
      // Normal aktif
      targetProfile = assignedProfile;
      isSecretDisabled = false;
    }

    const comment = `${u.name || ''} - ${u.customerId || ''}`.trim();
    const existingMtkSecret = mtkSecretMap.get(username.toLowerCase());

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
      const healNotice = autoHealedToActive ? ' [🛡️ PULIHKAN: SUDAH BAYAR / BATAL ISOLIR]' : '';
      console.log(`${progress} (DRY-RUN) ${username} | Paket: "${targetProfile}" | Status: ${u.status}${healNotice}`);
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
        // Update secret eksisting di MikroTik
        try {
          await api.write('/ppp/secret/set', [
            `=.id=${existingMtkSecret['.id']}`,
            ...sParams,
          ]);
          updatedCount++;
          const healNotice = autoHealedToActive ? ' (🛡️ BATAL ISOLIR: SUDAH BAYAR)' : '';
          console.log(`${progress} [UPDATE] ${username} -> Profil: "${targetProfile}"${healNotice}`);
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
        // Tambah secret baru di MikroTik
        try {
          await api.write('/ppp/secret/add', [
            `=name=${username}`,
            ...sParams,
          ]);
          addedCount++;
          const healNotice = autoHealedToActive ? ' (🛡️ BATAL ISOLIR: SUDAH BAYAR)' : '';
          console.log(`${progress} [TAMBAH] ${username} -> Profil: "${targetProfile}"${healNotice}`);
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

      // Update routerId & status sinkronisasi di database
      await prisma.pppoeUser.update({
        where: { id: u.id },
        data: {
          routerId: router.id,
          syncedToRadius: true,
          lastSyncAt: new Date(),
        },
      }).catch(() => {});

      // Kick active session jika diminta (--kick)
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
  console.log(`Router Target                  : ${router.name} (${configuredHost}:${configuredPort})`);
  console.log(`Total Pelanggan Aktif Disinkron: ${activeCandidates.length}`);
  console.log(`Total Akun OFF Dilewati (SKIP) : ${offUsers.length} (AMAN 0% masuk MikroTik)`);
  console.log(`Akun Terlindungi dari Isolir   : ${protectedFromIsolirCount} (Sudah bayar/belum expired)`);
  console.log(`Konflik Ganti User Terdeteksi  : ${gantiUserDetected} (Pelanggan baru dilindungi)`);
  console.log(`Secret Baru Ditambahkan        : ${addedCount}`);
  console.log(`Secret Diperbarui              : ${updatedCount}`);
  console.log(`Gagal Disinkronkan             : ${failedCount}`);
  if (isRadiusEnabled) {
    console.log(`Record RADIUS Tersinkron       : ${radiusCount}`);
  }
  if (isKick) {
    console.log(`Sesi Aktif Di-Kick             : ${kickedCount} pelanggan (ONT reconnect speed baru)`);
  }
  console.log('================================================================\n');
}

main()
  .catch(err => {
    console.error('[FATAL ERROR]', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
