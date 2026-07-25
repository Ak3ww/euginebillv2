import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('=== Checking PPPoE Passwords in Database ===');
  
  // Find all users where password is '123' or empty
  const weakPasswordUsers = await prisma.pppoeUser.findMany({
    where: {
      OR: [
        { password: '123' },
        { password: '' },
        { password: null as any }
      ]
    },
    select: {
      id: true,
      username: true,
      name: true,
      password: true,
      portalPassword: true,
      routerId: true
    }
  });

  console.log(`Found ${weakPasswordUsers.length} users with weak/default '123' or empty PPPoE password.`);

  let fixedCount = 0;

  for (const user of weakPasswordUsers) {
    // Generate a secure unique PPPoE password (e.g. ppp + 6 random chars)
    const newPppoePassword = 'pp' + Math.floor(100000 + Math.random() * 900000).toString();

    await prisma.pppoeUser.update({
      where: { id: user.id },
      data: {
        password: newPppoePassword,
        // Keep portalPassword as '123' if they want default 123 for portal login
        portalPassword: user.portalPassword || '123',
      }
    });

    // Also update radcheck if exists
    try {
      await prisma.radcheck.upsert({
        where: { username_attribute: { username: user.username, attribute: 'Cleartext-Password' } },
        create: { username: user.username, attribute: 'Cleartext-Password', op: ':=', value: newPppoePassword },
        update: { value: newPppoePassword }
      });
    } catch (_) {}

    fixedCount++;
    console.log(`  [Fixed] User "${user.username}" (${user.name}) -> New PPPoE Password: ${newPppoePassword} (Portal Password: ${user.portalPassword || '123'})`);
  }

  console.log(`\n✓ Fixed ${fixedCount} users.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
