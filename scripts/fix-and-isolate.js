const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('====================================================');
  console.log('  EUGINEBILL - ONE-TIME DIAGNOSTIC & AUTO ISOLATE   ');
  console.log('====================================================');

  const now = new Date();
  console.log(`🕒 Server Time (UTC): ${now.toISOString()}`);
  console.log(`🕒 Server Time (WIB): ${new Date(now.getTime() + 7 * 3600 * 1000).toISOString()}`);

  // 1. SPECIFIC CHECK FOR EMG083 / BERITAKAN HIA
  console.log('\n--- 🔍 Checking Target User (EMG083 / BERITAKAN) ---');
  const targetUser = await prisma.pppoeUser.findFirst({
    where: {
      OR: [
        { username: { contains: 'EMG083' } },
        { name: { contains: 'BERITAKAN' } },
      ]
    },
    include: {
      profile: true,
      router: true,
      invoices: {
        where: { status: { in: ['PENDING', 'OVERDUE'] } }
      }
    }
  });

  if (!targetUser) {
    console.log('❌ User EMG083 / BERITAKAN not found in database!');
  } else {
    console.log(`👤 Username:           ${targetUser.username}`);
    console.log(`👤 Name:               ${targetUser.name}`);
    console.log(`📌 Status:             ${targetUser.status}`);
    console.log(`💳 SubscriptionType:   ${targetUser.subscriptionType}`);
    console.log(`📅 ExpiredAt (Raw):    ${targetUser.expiredAt}`);
    console.log(`📅 ExpiredAt (ISO):    ${targetUser.expiredAt ? new Date(targetUser.expiredAt).toISOString() : '-'}`);
    console.log(`⚠️  Is Expired Now?:    ${targetUser.expiredAt ? (new Date(targetUser.expiredAt) <= now ? 'YES (EXPIRED)' : 'NO (NOT EXPIRED YET)') : 'N/A'}`);
    console.log(`🛡️  AutoIsolation:     ${targetUser.autoIsolationEnabled}`);
    console.log(`📱 Phone:              ${targetUser.phone}`);
    console.log(`🧾 Unpaid Invoices:    ${targetUser.invoices.length}`);
  }

  // 2. SCAN ALL EXPIRED UN-ISOLATED USERS IN DB
  console.log('\n--- 🔍 Scanning All Expired Un-isolated Users in DB ---');
  const expiredUsers = await prisma.pppoeUser.findMany({
    where: {
      status: { notIn: ['isolated', 'suspended', 'blocked', 'stop'] },
      expiredAt: {
        lte: now,
      },
      OR: [
        { autoIsolationEnabled: true },
        { autoIsolationEnabled: null },
      ]
    },
    include: {
      router: true,
      profile: true
    }
  });

  console.log(`📊 Total Expired Un-isolated Users Found: ${expiredUsers.length}`);

  if (expiredUsers.length === 0) {
    console.log('✅ No users need isolation right now.');
    return;
  }

  // Get company settings
  const company = await prisma.company.findFirst();
  const isolateProfileName = company?.isolateProfileName || 'isolir';
  const isRadiusEnabled = company?.radiusEnabled ?? false;

  console.log(`\n--- ⚡ Executing Isolation for ${expiredUsers.length} User(s)... ---`);

  for (const user of expiredUsers) {
    console.log(`\n👉 Isolating: ${user.username} (${user.name}) | Expired: ${new Date(user.expiredAt).toISOString()}`);

    try {
      // Step A: Update DB status to 'isolated'
      await prisma.pppoeUser.update({
        where: { id: user.id },
        data: { status: 'isolated' },
      });
      console.log(`   ✓ DB status updated to 'isolated'`);

      // Step B: Direct MikroTik API swap profile to 'isolir' and disconnect
      if (user.routerId) {
        try {
          const { PPPSecretService } = require('../src/server/services/mikrotik/ppp-secret.service');
          await PPPSecretService.setProfileAndDisconnect(user.routerId, user.username, isolateProfileName);
          console.log(`   ✓ MikroTik API: Profile swapped to '${isolateProfileName}' & active session kicked`);
        } catch (mtErr) {
          console.log(`   ⚠️ MikroTik API notice for ${user.username}: ${mtErr.message}`);
        }
      }

      // Step C: RADIUS sync (if enabled)
      if (isRadiusEnabled) {
        try {
          await prisma.$executeRaw`
            INSERT INTO radcheck (username, attribute, op, value)
            VALUES (${user.username}, 'Cleartext-Password', ':=', ${user.password})
            ON DUPLICATE KEY UPDATE value = ${user.password}
          `;
          await prisma.$executeRaw`DELETE FROM radcheck WHERE username = ${user.username} AND attribute = 'Auth-Type'`;
          await prisma.$executeRaw`DELETE FROM radreply WHERE username = ${user.username} AND attribute = 'Reply-Message'`;
          await prisma.$executeRaw`DELETE FROM radusergroup WHERE username = ${user.username}`;
          await prisma.$executeRaw`INSERT INTO radusergroup (username, groupname, priority) VALUES (${user.username}, 'isolir', 1)`;
          await prisma.$executeRaw`DELETE FROM radreply WHERE username = ${user.username} AND attribute = 'Framed-IP-Address'`;
          await prisma.$executeRaw`UPDATE radacct SET acctstoptime = NOW(), acctterminatecause = 'Admin-Reset' WHERE username = ${user.username} AND acctstoptime IS NULL`;
          console.log(`   ✓ RADIUS radusergroup set to 'isolir'`);
        } catch (radErr) {
          console.log(`   ⚠️ RADIUS notice: ${radErr.message}`);
        }
      }

      console.log(`   ✅ SUCCESS: ${user.username} is now ISOLATED.`);
    } catch (err) {
      console.error(`   ❌ Failed to isolate ${user.username}:`, err.message);
    }
  }

  console.log('\n====================================================');
  console.log('           ONE-TIME ISOLATION COMPLETE 🎉           ');
  console.log('====================================================');
}

main().catch(console.error).finally(() => prisma.$disconnect());
