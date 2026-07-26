import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Clean & normalize Indonesian phone numbers to standard 08xxxxxxxx format
 * Special fix for double '8' prefix bug (e.g. 62885254837611 -> 085254837611)
 *
 * Test cases:
 *  "62885254837611"  => "085254837611"  (Sumarwan: 14 digits double '8' -> 12 digits Telkomsel 0852)
 *  "0885254837611"   => "085254837611"  (13 digits double '8' -> 12 digits Telkomsel 0852)
 *  "088970734097"    => "08970734097"  (Akew: previous wrong run -> 11 digits Tri 0897)
 *  "628970734097"    => "08970734097"  (Akew original -> 11 digits Tri 0897)
 *  "0898 6041910"    => "08986041910"  (Sri Nila)
 *  "0812 110 1410"   => "08121101410"  (Dewiana)
 */
function normalizePhone(raw: string): string {
  if (!raw) return '';

  // 1. Remove spaces and non-digit characters
  let digits = raw.trim().replace(/[^0-9]/g, '');
  if (!digits) return '';

  // 2. Remove repeated country codes (62628...)
  while (digits.startsWith('6262')) {
    digits = digits.slice(2);
  }

  // 3. FIX DOUBLE '8' PREPEND BUG
  // When '628' was prepended to an 11-12 digit number starting with '8...',
  // it created 13-14 digit numbers starting with '6288...' or '088...'.
  // Example: "62885254837611" (14 digits) -> "6285254837611"
  if (digits.startsWith('6288') && digits.length >= 13) {
    digits = '628' + digits.slice(4);
  } else if (digits.startsWith('088') && digits.length >= 13) {
    digits = '08' + digits.slice(3);
  }

  // 4. FIX PREVIOUS WRONG SEED RUN (e.g. 088970734097 [12 digits] -> 08970734097)
  // Smartfren valid prefixes: 0881, 0882, 0883, 0884, 0885, 0886, 0887, 0888, 0889 (11-12 digits max).
  // If number starts with 088 and is 12 digits, check if removing 2nd '8' matches standard provider prefix (089, 085, 081, 082, 087, 083)
  if (digits.startsWith('088') && digits.length === 12) {
    const candidate = '08' + digits.slice(3);
    // If candidate starts with valid non-Smartfren 08x (like 0897, 0852, 0812, 0877, 0838)
    if (/^08(1|2|3|5|7|9)/.test(candidate)) {
      digits = candidate;
    }
  }

  // 5. Convert 62 prefix to standard 08 format
  if (digits.startsWith('620')) {
    digits = '0' + digits.slice(3);
  } else if (digits.startsWith('62')) {
    digits = '0' + digits.slice(2);
  }

  // 6. Ensure starts with 0
  if (digits.startsWith('8')) {
    digits = '0' + digits;
  }

  return digits;
}

async function fixPhoneNumbers() {
  console.log('🔄 Running phone number database normalization script...\n');

  try {
    const users = await prisma.pppoeUser.findMany({
      select: { id: true, name: true, username: true, phone: true },
    });

    console.log(`📊 Found ${users.length} total customers to process.`);

    let fixedCount = 0;
    let skippedCount = 0;

    for (const user of users) {
      if (!user.phone) {
        skippedCount++;
        continue;
      }

      const raw = user.phone.trim();
      const updated = normalizePhone(raw);

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
