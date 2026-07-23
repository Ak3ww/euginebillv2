import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Checking Routers in Database...\n');

  const routers = await prisma.router.findMany({
    select: { id: true, name: true, ipAddress: true, isActive: true }
  });

  console.log('📋 Existing Routers:');
  routers.forEach((r, idx) => {
    console.log(`  [${idx + 1}] ID: ${r.id} | Name: "${r.name}" | IP: ${r.ipAddress}`);
  });

  // Find Cibinong router
  const cibinongRouter = routers.find(r => 
    r.name.toLowerCase().includes('cibinong') || 
    r.name.toLowerCase().includes('cbn')
  );

  if (!cibinongRouter) {
    console.log('\n⚠️ Router Cibinong belum ditemukan dari kata kunci name. Berikut router yang ada:');
    console.log(routers);
    return;
  }

  console.log(`\n🎯 Found Cibinong Router: "${cibinongRouter.name}" (ID: ${cibinongRouter.id})`);

  // Count unassigned customers
  const totalUsers = await prisma.pppoeUser.count();
  const unassignedCount = await prisma.pppoeUser.count({
    where: {
      OR: [
        { routerId: null },
        { routerId: '' }
      ]
    }
  });

  const assignedOtherCount = await prisma.pppoeUser.count({
    where: {
      routerId: { notIn: [null, ''] }
    }
  });

  console.log(`\n📊 Summary Customer Status:`);
  console.log(`  - Total Pelanggan: ${totalUsers}`);
  console.log(`  - Sudah Punya Router (misal Citeureup): ${assignedOtherCount} (TIDAK AKAN DIUBAH)`);
  console.log(`  - Belum Ada Router: ${unassignedCount} (AKAN DIPINDAH/DISET KE CIBINONG)`);

  if (unassignedCount > 0) {
    console.log(`\n🚀 Executing Bulk Assign to Cibinong Router...`);
    const updateResult = await prisma.pppoeUser.updateMany({
      where: {
        OR: [
          { routerId: null },
          { routerId: '' }
        ]
      },
      data: {
        routerId: cibinongRouter.id
      }
    });

    console.log(`\n✅ BERHASIL! ${updateResult.count} pelanggan tanpa router telah di-assign ke Router "${cibinongRouter.name}" (ID: ${cibinongRouter.id}).`);
  } else {
    console.log('\nℹ️ Semua pelanggan sudah memiliki router masing-masing.');
  }
}

main()
  .catch(e => console.error('❌ Error executing assignment:', e))
  .finally(() => prisma.$disconnect());
