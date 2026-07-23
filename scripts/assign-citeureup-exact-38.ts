import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Exact 38 Citeureup Usernames from user paste
const CITEUREUP_USERNAMES = [
  'EMGC025',  // KOST MARFUNGAH
  'EMGC019',  // IRFAN
  'EMGC022',  // SUPARMAN
  'EMGC024',  // ACE ALE
  'EMGC018',  // DABBY
  'EMGC003',  // AYU FIDA SABIL
  'EMGC007',  // DINA DINI
  'EMG-0234', // ADE
  'EMGC017',  // ARI ABUY
  'EMGC023',  // OM AGUS
  'EMGC006',  // SHINTA 2
  'EMGC005',  // LUSY
  'EMGC036',  // TEH AI
  'EMGC030',  // ANNISA
  'EMGCAKEW', // AKEW
  'EMGC001',  // AULIA
  'EMGC004',  // DHANI
  'EMGCF001', // MANG ASEP
  'EMGC038',  // DIRA
  'EMGC013',  // ARYA
  'EMGC014',  // SHEILA
  'EMGC032',  // USMAN
  'EMGC035',  // MAMAH DINI
  'EMGC033',  // DERY
  'EMGC034',  // RISA
  'EMGC011',  // EMAN
  'EMGCF002', // ARIF
  'EMGC002',  // ARLINA
  'EMGC026',  // CHANDRA
  'EMGC016',  // SHINTA 1
  'EMGC009',  // TANTE
  'EMGC021',  // ZAHRA
  'EMGC029',  // FARHAN / DARIANI
  'EMGC008',  // AHMAD NUR HAFIZ
  'EMGC037',  // ANDRIANA
  'EMGC039',  // SYAHRONAL
  'EMGC015',  // RIO
  'EMGC020',  // ABY ADITYA
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
  console.log('📌 Executing Presise Router Assignment (38 Citeureup vs Rest Cibinong)...\n');

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
