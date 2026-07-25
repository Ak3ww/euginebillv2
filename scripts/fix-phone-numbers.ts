import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Clean & normalize Indonesian phone numbers to standard 08xxxxxxxx format
 * Examples:
 *  "628970734097"    => "08970734097"
 *  "6208970734097"   => "08970734097"
 *  "62628970734097"  => "08970734097"
 *  "088970734097"    => "08970734097" (fixes accidental 088 prefix if invalid)
 *  "0812 110 1410"   => "08121101410"
 *  "8970734097"      => "08970734097"
 */
function normalizePhone(raw: string): string {
  if (!raw) return '';

  // 1. Remove all non-digits
  let digits = raw.trim().replace(/[^0-9]/g, '');
  if (!digits) return '';

  // 2. Fix 62 prefix -> convert 62 to 0
  if (digits.startsWith('62')) {
    // Remove repeated 62s (e.g. 62628...)
    while (digits.startsWith('6262')) {
      digits = digits.slice(2);
    }
    // Fix 6208... -> 08...
    if (digits.startsWith('620')) {
      digits = '0' + digits.slice(3);
    } else {
      // 628... -> 08...
      digits = '0' + digits.slice(2);
    }
  }

  // 3. Ensure starts with 0
  if (digits.startsWith('8')) {
    digits = '0' + digits;
  }

  // 4. Fix accidental double '088' prefix from previous script run (e.g. 088970734097 -> 08970734097)
  // Smartfren valid prefixes: 0881, 0882, 0883, 0884, 0885, 0886, 0887, 0888, 0889 (11-12 digits).
  // If number starts with 088 followed by non-Smartfren 2nd digit or extra 8 (e.g., 08897... when original was 62897...)
  if (digits.startsWith('088') && digits.length === 12) {
    const fourthChar = digits[3]; // e.g. '9' in 0889
    // If it's 088970734097 -> 08970734097
    if (['1','2','3','4','5','6','7','8','9'].includes(fourthChar)) {
      // Check if removing the extra '8' yields a standard 11-digit provider number
      const trimmedCandidate = '08' + digits.slice(3);
      if (trimmedCandidate.length >= 10 && trimmedCandidate.length <= 12) {
        digits = trimmedCandidate;
      }
    }
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
