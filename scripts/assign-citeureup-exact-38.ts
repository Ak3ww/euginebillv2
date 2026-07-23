import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 38 Exact Citeureup Usernames & Names
const CITEUREUP_USERNAMES = [
  'EMGC025', 'EMGC019', 'EMGC022', 'EMGC024', 'EMGC018', 'EMGC003',
  'EMGC007', 'EMG-0234', 'EMGC017', 'EMGC023', 'EMGC006', 'EMGC005',
  'EMGC036', 'EMGC030', 'EMGCAKEW', 'EMGC001', 'EMGC004', 'EMGCF001',
  'EMGC038', 'EMGC013', 'EMGC014', 'EMGC032', 'EMGC035', 'EMGC033',
  'EMGC034', 'EMGC011', 'EMGCF002', 'EMGC002', 'EMGC026', 'EMGC016',
  'EMGC009', 'EMGC021', 'EMGC029', 'EMGC008', 'EMGC037', 'EMGC039',
  'EMGC015', 'EMGC020'
];

const CITEUREUP_NAMES = [
  'KOST MARFUNGAH', 'IRFAN', 'SUPARMAN', 'ACE ALE', 'DABBY', 'AYU FIDA SABIL',
  'DINA DINI', 'ADE', 'ARI ABUY', 'OM AGUS', 'SHINTA 2', 'LUSY', 'TEH AI',
  'ANNISA', 'AKEW', 'AULIA', 'DHANI', 'MANG ASEP', 'DIRA', 'ARYA', 'SHEILA',
  'USMAN', 'MAMAH DINI', 'DERY', 'RISA', 'EMAN', 'ARIF', 'ARLINA', 'CHANDRA',
  'SHINTA 1', 'TANTE', 'ZAHRA', 'FARHAN / DARIANI', 'AHMAD NUR HAFIZ', 'ANDRIANA',
  'SYAHRONAL', 'RIO', 'ABY ADITYA'
];

async function main() {
  console.log('📌 Executing Router Assignment (38 Citeureup vs Rest Cibinong)...\n');

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

  // Step 1: Assign 38 exact Citeureup customers by username or name
  const citeureupResult = await prisma.pppoeUser.updateMany({
    where: {
      OR: [
        { username: { in: CITEUREUP_USERNAMES } },
        { name: { in: CITEUREUP_NAMES } },
      ]
    },
    data: {
      routerId: citeureupRouter.id
    }
  });

  console.log(`✅ ${citeureupResult.count} pelanggan berhasil di-assign ke Router CITEUREUP.`);

  // Step 2: Assign ALL other customers to Cibinong Router
  const cibinongResult = await prisma.pppoeUser.updateMany({
    where: {
      NOT: {
        routerId: citeureupRouter.id
      }
    },
    data: {
      routerId: cibinongRouter.id
    }
  });

  console.log(`✅ ${cibinongResult.count} pelanggan sisanya berhasil di-assign ke Router CIBINONG.`);

  // Summary
  const finalCtr = await prisma.pppoeUser.count({ where: { routerId: citeureupRouter.id } });
  const finalCbn = await prisma.pppoeUser.count({ where: { routerId: cibinongRouter.id } });
  const total = await prisma.pppoeUser.count();

  console.log('\n📊 HASIL AKHIR ALOKASI ROUTER:');
  console.log(`  - Total Pelanggan:     ${total}`);
  console.log(`  - Router CITEUREUP:    ${finalCtr} Pelanggan`);
  console.log(`  - Router CIBINONG:     ${finalCbn} Pelanggan`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
