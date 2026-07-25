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
  const targetPassword = 'eugine0909';

  for (const user of weakPasswordUsers) {
    await prisma.pppoeUser.update({
      where: { id: user.id },
      data: {
        password: targetPassword,
        portalPassword: user.portalPassword || '123',
      }
    });

    // Also update radcheck if exists
    try {
      await prisma.radcheck.upsert({
        where: { username_attribute: { username: user.username, attribute: 'Cleartext-Password' } },
        create: { username: user.username, attribute: 'Cleartext-Password', op: ':=', value: targetPassword },
        update: { value: targetPassword }
      });
    } catch (_) {}

    fixedCount++;
    console.log(`  [Fixed] User "${user.username}" (${user.name}) -> PPPoE Password set to: ${targetPassword} (Portal Password: ${user.portalPassword || '123'})`);
  }

  console.log(`\n✓ Fixed ${fixedCount} users.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
