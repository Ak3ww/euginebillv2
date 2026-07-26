import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('=== Checking PPPoE Passwords in Database ===');
  
  // Fetch users and filter in memory to avoid Prisma null-where query validation error
  const allUsers = await prisma.pppoeUser.findMany({
    select: {
      id: true,
      username: true,
      name: true,
      password: true,
      portalPassword: true,
    }
  });

  const weakPasswordUsers = allUsers.filter(
    u => !u.password || u.password.trim() === '' || u.password === '123'
  );

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
    console.log(`  [Fixed] User "${user.username}" (${user.name}) -> PPPoE Password set to: ${targetPassword}`);
  }

  console.log(`\n✓ Fixed ${fixedCount} users to default PPPoE password '${targetPassword}'.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
