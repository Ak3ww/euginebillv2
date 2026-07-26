import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function diagnoseCibinongSessions() {
  console.log('🔍 Menganalisis kenapa ada selisih ~32 sesi di router Cibinong...\n');

  try {
    // 1. Get all active routers
    const routers = await prisma.router.findMany({
      where: { isActive: true },
    });

    console.log('📡 Daftar Router Aktif:');
    routers.forEach(r => console.log(`  - [ID: ${r.id}] ${r.name} | nasname: ${r.nasname} | ipAddress: ${r.ipAddress}`));

    // Find Cibinong router
    const cibinongRouter = routers.find(r => r.name.toLowerCase().includes('cibinong'));

    // 2. Fetch all active radacct sessions (acctstoptime IS NULL)
    const activeRadacct = await prisma.radacct.findMany({
      where: { acctstoptime: null },
      orderBy: { acctstarttime: 'desc' },
    });

    console.log(`\n📊 Total Active Sessions di radacct (seluruh router): ${activeRadacct.length}`);

    // Group active radacct sessions by nasipaddress
    const countByNasIp = new Map<string, number>();
    for (const s of activeRadacct) {
      const ip = s.nasipaddress || 'unknown';
      countByNasIp.set(ip, (countByNasIp.get(ip) || 0) + 1);
    }

    console.log('\n🌐 Sesi Aktif Berdasarkan NAS IP Address di radacct:');
    for (const [ip, count] of countByNasIp.entries()) {
      const matchedRouter = routers.find(r => r.nasname === ip || r.ipAddress === ip);
      console.log(`  - NAS IP: ${ip} => ${count} sesi ${matchedRouter ? `(Router: ${matchedRouter.name})` : '⚠️ (TIDAK COCOK DENGAN ROUTER MANAPUN!)'}`);
    }

    // 3. Fetch all pppoeUser usernames for case-sensitivity & missing user checks
    const allPppoeUsers = await prisma.pppoeUser.findMany({
      select: { username: true, name: true, area: { select: { name: true } } },
    });

    const userExactMap = new Set(allPppoeUsers.map(u => u.username));
    const userLowerMap = new Set(allPppoeUsers.map(u => u.username.toLowerCase()));

    let totalExactMatch = 0;
    let totalCaseMismatch = 0;
    let totalOrphanUser = 0;

    const orphanUsernames: string[] = [];
    const caseMismatchUsernames: string[] = [];

    for (const s of activeRadacct) {
      if (userExactMap.has(s.username)) {
        totalExactMatch++;
      } else if (userLowerMap.has(s.username.toLowerCase())) {
        totalCaseMismatch++;
        caseMismatchUsernames.push(s.username);
      } else {
        totalOrphanUser++;
        orphanUsernames.push(s.username);
      }
    }

    console.log(`\n🔎 Analisis Pencocokan User:`);
    console.log(`  ✅ Exact Match (Cocok Sempurna): ${totalExactMatch}`);
    console.log(`  ⚠️ Case Mismatch (Beda Huruf Besar/Kecil): ${totalCaseMismatch}`);
    if (caseMismatchUsernames.length > 0) {
      console.log(`     User Beda Case: ${caseMismatchUsernames.slice(0, 10).join(', ')}`);
    }
    console.log(`  ❌ Orphan Users (Username di RADIUS tapi TIDAK ADA di pppoeUser DB): ${totalOrphanUser}`);
    if (orphanUsernames.length > 0) {
      console.log(`     Contoh Username Tidak Terdaftar di DB: ${orphanUsernames.slice(0, 15).join(', ')}`);
    }

  } catch (error) {
    console.error('❌ Error diagnosing:', error);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

diagnoseCibinongSessions();
