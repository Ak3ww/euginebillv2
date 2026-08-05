import { prisma } from '../src/server/db/client';

async function main() {
  console.log('🚀 Starting NAS Assignment to Areas & Users...');

  const routers = await prisma.router.findMany({
    select: { id: true, name: true, nasname: true, shortname: true }
  });

  if (routers.length === 0) {
    console.error('❌ Error: Tidak ada Router/NAS di database.');
    process.exit(1);
  }

  console.log(`📍 Found ${routers.length} Router(s):`);
  routers.forEach(r => console.log(`   - [${r.id}] ${r.name} (${r.nasname})`));

  // Find Citeureup & Cibinong routers
  const citeureupRouter = routers.find(r => 
    r.name.toUpperCase().includes('CITEUREUP') || 
    r.shortname.toUpperCase().includes('CITEUREUP')
  ) || routers[0];

  const cibinongRouter = routers.find(r => 
    r.name.toUpperCase().includes('CIBINONG') || 
    r.shortname.toUpperCase().includes('CIBINONG')
  ) || routers.find(r => r.id !== citeureupRouter.id) || routers[0];

  console.log(`\n🎯 Target Router Mapping:`);
  console.log(`   - Area TEGAL -> NAS CITEUREUP: ${citeureupRouter.name} [ID: ${citeureupRouter.id}]`);
  console.log(`   - Area Lainnya -> NAS CIBINONG: ${cibinongRouter.name} [ID: ${cibinongRouter.id}]`);

  const areas = await prisma.pppoeArea.findMany();
  console.log(`\n📦 Processing ${areas.length} Area(s)...`);

  for (const area of areas) {
    const isTegal = area.name.toUpperCase().includes('TEGAL');
    const targetRouter = isTegal ? citeureupRouter : cibinongRouter;

    // Update area
    await prisma.pppoeArea.update({
      where: { id: area.id },
      data: { routerId: targetRouter.id }
    });

    // Update all users in this area
    const userUpdateResult = await prisma.pppoeUser.updateMany({
      where: { areaId: area.id },
      data: { routerId: targetRouter.id }
    });

    console.log(`   ✅ Area "${area.name}" -> NAS "${targetRouter.name}" | (${userUpdateResult.count} pelanggan diperbarui)`);
  }

  console.log('\n🎉 Finished! All Areas and Customers successfully assigned to respective NAS.');
  await prisma.$disconnect();
}

main().catch(err => {
  console.error('❌ Migration Error:', err);
  process.exit(1);
});
