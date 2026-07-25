import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixPhoneNumbers() {
  console.log('🔄 Starting phone number database fix & seeding script...\n');

  try {
    const users = await prisma.pppoeUser.findMany({
      select: { id: true, name: true, username: true, phone: true },
    });

    console.log(`📊 Found ${users.length} total customers to check.`);

    let fixedCount = 0;
    let skippedCount = 0;

    for (const user of users) {
      if (!user.phone) {
        skippedCount++;
        continue;
      }

      const raw = user.phone.trim();
      let digits = raw.replace(/[^0-9]/g, '');
      let updated = digits;

      // Fix 1: Double prefix 62628xxx -> 08xxx
      if (updated.startsWith('62628')) {
        updated = '08' + updated.slice(5);
      }
      // Fix 2: Double prefix 6208xxx -> 08xxx
      else if (updated.startsWith('6208')) {
        updated = '08' + updated.slice(3);
      }
      // Fix 3: Malformed 62888xxx double prefix (e.g. 628 added in front of 88xxx)
      else if (updated.startsWith('62888')) {
        updated = '088' + updated.slice(5);
      }
      // Fix 4: Extra 628 in front of 628 (628628xxx) -> 08xxx
      else if (updated.startsWith('628628')) {
        updated = '08' + updated.slice(6);
      }
      // Fix 5: Malformed 6288xxx where 628 was double prefixed onto 8xxx
      else if (updated.startsWith('6288') && updated.length > 13) {
        updated = '088' + updated.slice(4);
      }
      // Fix 6: Convert standard 628xxx -> 08xxx for database consistency
      else if (updated.startsWith('628')) {
        updated = '08' + updated.slice(2);
      }

      // Ensure starts with 0
      if (updated.startsWith('8')) {
        updated = '0' + updated;
      }

      if (updated !== raw && updated.length >= 10 && updated.length <= 13) {
        await prisma.pppoeUser.update({
          where: { id: user.id },
          data: { phone: updated },
        });

        fixedCount++;
        console.log(`✅ [${fixedCount}] Fixed ${user.username} (${user.name}): "${raw}" ➔ "${updated}"`);
      } else {
        skippedCount++;
      }
    }

    console.log(`\n🎉 Selesai! Berhasil merapikan ${fixedCount} nomor HP pelanggan.`);
    console.log(`ℹ️ ${skippedCount} nomor HP sudah valid / tidak memerlukan perubahan.`);
  } catch (error) {
    console.error('❌ Error during phone number fix:', error);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

fixPhoneNumbers();
