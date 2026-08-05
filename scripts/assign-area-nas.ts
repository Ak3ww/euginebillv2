import { prisma } from '../src/server/db/client';

async function main() {
  console.log('🚀 Starting NAS Assignment to Areas & Users...');

  // Ensure routerId column exists in pppoe_areas table via Raw SQL
  try {
    const columns: any[] = await prisma.$queryRawUnsafe(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pppoe_areas' AND COLUMN_NAME = 'routerId';`
    );
    if (columns.length === 0) {
      await prisma.$executeRawUnsafe(`ALTER TABLE pppoe_areas ADD COLUMN routerId VARCHAR(191) NULL;`);
      console.log('🛠️ Added column "routerId" to table "pppoe_areas".');
    }
  } catch {
    // Column already exists or alter skipped
  }

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

  const areas: any[] = await prisma.$queryRawUnsafe(`SELECT id, name FROM pppoe_areas;`);
  console.log(`\n📦 Processing ${areas.length} Area(s)...`);

  for (const area of areas) {
    const isTegal = area.name.toUpperCase().includes('TEGAL');
    const targetRouter = isTegal ? citeureupRouter : cibinongRouter;

    // Update area via raw SQL
    await prisma.$executeRawUnsafe(
      `UPDATE pppoe_areas SET routerId = ? WHERE id = ?`,
      targetRouter.id,
      area.id
    );

    // Update all users in this area via raw SQL
    const userUpdateCount: any = await prisma.$executeRawUnsafe(
      `UPDATE pppoe_users SET routerId = ? WHERE areaId = ?`,
      targetRouter.id,
      area.id
    );

    console.log(`   ✅ Area "${area.name}" -> NAS "${targetRouter.name}" | (${userUpdateCount} pelanggan diperbarui)`);
  }

  console.log('\n🎉 Finished! All Areas and Customers successfully assigned to respective NAS.');
  await prisma.$disconnect();
}

main().catch(err => {
  console.error('❌ Migration Error:', err);
  process.exit(1);
});
