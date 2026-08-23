const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('\n======================================================');
  console.log('🔄 EugineBill Router Customer Migration Tool');
  console.log('======================================================\n');

  const routers = await prisma.router.findMany({
    select: {
      id: true,
      name: true,
      ipAddress: true,
      _count: {
        select: {
          users: true,
          areas: true,
          vouchers: true,
        }
      }
    }
  });

  if (routers.length === 0) {
    console.log('❌ Tidak ada Router di database.');
    return;
  }

  console.log('Daftar Router di Database:');
  routers.forEach((r, idx) => {
    console.log(  [] ID:  | Nama: "" | IP: );
    console.log(      Pelanggan:  | Wilayah:  | Voucher: );
  });
  console.log('');

  const args = process.argv.slice(2);
  let sourceRouter = null;
  let targetRouter = null;

  if (args.length >= 2) {
    const srcQuery = args[0].toLowerCase();
    const dstQuery = args[1].toLowerCase();
    sourceRouter = routers.find(r => r.id === args[0] || r.name.toLowerCase().includes(srcQuery));
    targetRouter = routers.find(r => r.id === args[1] || r.name.toLowerCase().includes(dstQuery));
  } else if (routers.length === 2) {
    const withUsers = routers.filter(r => r._count.users > 0);
    const emptyOnes = routers.filter(r => r._count.users === 0);
    if (withUsers.length === 1 && emptyOnes.length === 1) {
      sourceRouter = withUsers[0];
      targetRouter = emptyOnes[0];
      console.log(💡 Otomatis mendeteksi:);
      console.log(   Source (Lama): "" ( pelanggan));
      console.log(   Target (Baru): "" (0 pelanggan));
    }
  }

  if (!sourceRouter || !targetRouter) {
    console.log('ℹ️  Cara menjalankan:');
    console.log('   node scripts/migrate-router-customers.js "<nama_router_lama>" "<nama_router_baru>"');
    console.log('\nContoh:');
    console.log('   node scripts/migrate-router-customers.js "Lama" "Baru"');
    return;
  }

  if (sourceRouter.id === targetRouter.id) {
    console.log('❌ Source dan Target router tidak boleh sama.');
    return;
  }

  console.log(\n🚀 Memulai pemindahan data:);
  console.log(   DARI : [] );
  console.log(   KE   : [] \n);

  const userResult = await prisma.pppoeUser.updateMany({
    where: { routerId: sourceRouter.id },
    data: { routerId: targetRouter.id }
  });
  console.log(   ✅ Pelanggan PPPoE dipindahkan : );

  const areaResult = await prisma.pppoeArea.updateMany({
    where: { routerId: sourceRouter.id },
    data: { routerId: targetRouter.id }
  });
  console.log(   ✅ Wilayah PPPoE dipindahkan   : );

  const voucherResult = await prisma.hotspotVoucher.updateMany({
    where: { routerId: sourceRouter.id },
    data: { routerId: targetRouter.id }
  });
  console.log(   ✅ Voucher Hotspot dipindahkan : );

  const agentResult = await prisma.agent.updateMany({
    where: { routerId: sourceRouter.id },
    data: { routerId: targetRouter.id }
  });
  console.log(   ✅ Agen dipindahkan            : );

  const oltResult = await prisma.networkOLTRouter.updateMany({
    where: { routerId: sourceRouter.id },
    data: { routerId: targetRouter.id }
  });
  console.log(   ✅ Relasi OLT dipindahkan      : );

  console.log('\n🎉 MIGRASI SELESAI DENGAN SUKSES!');
  console.log(Semua pelanggan sekarang telah terhubung ke Router "".);
  console.log('======================================================\n');
}

main()
  .catch((e) => {
    console.error('❌ Terjadi kesalahan saat migrasi:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.();
  });
