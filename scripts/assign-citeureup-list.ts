import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// List of exact Citeureup usernames / customer names / IPs provided by user
const CITEUREUP_USERNAMES = [
  'EMGC026', 'CHANDRA',
  'EMGC021', 'ZAHRA',
  'EMGCF001', 'MANG ASEP',
  'EMGC014', 'SHEILA',
  'EMGCAKEW', 'AKEW',
  'EMGC017', 'ARI ABUY',
  'EMG-0234', 'ADE',
  'EMGC005', 'LUSY',
  'EMGC032', 'USMAN',
  'EMGC022', 'SUPARMAN',
];

const CITEUREUP_IPS = [
  '172.168.20.209',
  '172.168.20.213',
  '172.168.20.185',
  '172.168.20.201',
  '172.168.20.175',
  '172.168.20.190',
  '172.168.20.218',
  '172.168.20.182',
  '172.168.20.206',
  '172.168.20.202',
];

async function main() {
  console.log('📌 Executing Custom Router Assignment (Citeureup vs Cibinong)...\n');

  const routers = await prisma.router.findMany({
    select: { id: true, name: true, ipAddress: true }
  });

  const citeureupRouter = routers.find(r => r.name.toLowerCase().includes('citeureup') || r.name.toLowerCase().includes('ctr'));
  const cibinongRouter = routers.find(r => r.name.toLowerCase().includes('cibinong') || r.name.toLowerCase().includes('cbn'));

  if (!citeureupRouter || !cibinongRouter) {
    console.log('⚠️ Both routers (Citeureup & Cibinong) must exist in database.');
    console.log(routers);
    return;
  }

  console.log(`1️⃣ Router Citeureup: "${citeureupRouter.name}" (ID: ${citeureupRouter.id})`);
  console.log(`2️⃣ Router Cibinong:  "${cibinongRouter.name}" (ID: ${cibinongRouter.id})\n`);

  // Step 1: Assign Citeureup customers by username, name, IP prefix "172.168.20.", or username prefix "EMGC" / "EMG-"
  const citeureupResult = await prisma.pppoeUser.updateMany({
    where: {
      OR: [
        { username: { in: CITEUREUP_USERNAMES } },
        { name: { in: CITEUREUP_USERNAMES } },
        { ipAddress: { in: CITEUREUP_IPS } },
        { ipAddress: { startsWith: '172.168.20.' } },
        { username: { startsWith: 'EMGC' } },
        { username: { startsWith: 'EMG-' } },
      ]
    },
    data: {
      routerId: citeureupRouter.id
    }
  });

  console.log(`✅ ${citeureupResult.count} pelanggan berhasil di-assign ke Router CITEUREUP.`);

  // Step 2: Assign ALL remaining customers to Cibinong Router
  const cibinongResult = await prisma.pppoeUser.updateMany({
    where: {
      OR: [
        { routerId: null },
        { routerId: '' },
        { routerId: { not: citeureupRouter.id } }
      ]
    },
    data: {
      routerId: cibinongRouter.id
    }
  });

  console.log(`✅ ${cibinongResult.count} pelanggan sisanya berhasil di-assign ke Router CIBINONG.`);

  // Summary
  const finalCtr = await prisma.pppoeUser.count({ where: { routerId: citeureupRouter.id } });
  const finalCbn = await prisma.pppoeUser.count({ where: { routerId: cibinongRouter.id } });

  console.log('\n📊 RINGKASAN HASIL AKHIR ALOKASI ROUTER:');
  console.log(`  - Total Router CITEUREUP: ${finalCtr} Pelanggan`);
  console.log(`  - Total Router CIBINONG:  ${finalCbn} Pelanggan`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
