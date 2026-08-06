import { prisma } from '../src/server/db/client';

async function setKpTegalNoIsolation() {
  console.log('🚀 Starting Setting KAMPUNG TEGAL to "TETAP TERHUBUNG (No Action)"...\n');

  try {
    // 1. Find area KAMPUNG TEGAL
    const areas = await prisma.$queryRawUnsafe<Array<{ id: string; name: string }>>(
      `SELECT id, name FROM pppoe_areas WHERE LOWER(name) LIKE '%tegal%'`
    );

    if (areas.length === 0) {
      console.log('❌ Area "KAMPUNG TEGAL" not found in database!');
      await prisma.$disconnect();
      return;
    }

    console.log(`📍 Found ${areas.length} matching area(s):`);
    areas.forEach(a => console.log(`   - [${a.id}] ${a.name}`));

    const areaIds = areas.map(a => `'${a.id}'`).join(',');

    // 2. Count users before update
    const userCountResult = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*) as count FROM pppoe_users WHERE areaId IN (${areaIds})`
    );
    const totalUsers = Number(userCountResult[0]?.count || 0);

    console.log(`\n📦 Found ${totalUsers} user(s) in area KAMPUNG TEGAL.`);

    if (totalUsers === 0) {
      console.log('⚠️ No users found in this area.');
      await prisma.$disconnect();
      return;
    }

    // 3. Update autoIsolationEnabled = false (0) for all users in KAMPUNG TEGAL
    const updateResult = await prisma.$executeRawUnsafe(
      `UPDATE pppoe_users 
       SET autoIsolationEnabled = 0,
           status = CASE WHEN status = 'isolated' THEN 'active' ELSE status END
       WHERE areaId IN (${areaIds})`
    );

    console.log(`\n✅ Updated ${updateResult} user(s) in KAMPUNG TEGAL to "TETAP TERHUBUNG (No Action)"!`);

    // 4. Restore RADIUS group for any users that were previously isolated
    try {
      const radiusRestoreResult = await prisma.$executeRawUnsafe(
        `UPDATE radusergroup rug
         JOIN pppoe_users u ON rug.username = u.username
         LEFT JOIN pppoe_profiles p ON u.profileId = p.id
         SET rug.groupname = COALESCE(p.name, 'default')
         WHERE u.areaId IN (${areaIds})`
      );
      console.log(`⚡ Restored ${radiusRestoreResult} RADIUS user group(s) to active profile!`);
    } catch (radErr: any) {
      console.log(`ℹ️ Note: RADIUS table sync notice: ${radErr.message || radErr}`);
    }

    console.log('\n====================================================');
    console.log('🎉 SUCCESS: All customers in KAMPUNG TEGAL are now set');
    console.log('   to "TETAP TERHUBUNG (No Action)" — will NOT be isolated');
    console.log('   even if their expiration date has passed.');
    console.log('====================================================');

  } catch (err: any) {
    console.error('❌ Error executing script:', err);
  } finally {
    await prisma.$disconnect();
  }
}

setKpTegalNoIsolation();
