import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';
import { prisma } from '@/server/db/client';
import { unauthorized } from '@/lib/api-response';

/**
 * POST /api/admin/pppoe/fix-phone-numbers
 * Scans all PPPoE users and automatically fixes malformed phone numbers
 * (e.g. 6288xxx double prefixes, 6208xxx, 62628xxx, extra trailing digits).
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorized();

  try {
    const users = await prisma.pppoeUser.findMany({
      select: { id: true, name: true, username: true, phone: true },
    });

    let fixedCount = 0;
    const fixedDetails: Array<{ username: string; name: string; oldPhone: string; newPhone: string }> = [];

    for (const user of users) {
      if (!user.phone) continue;

      const raw = user.phone.trim();
      let digits = raw.replace(/[^0-9]/g, '');
      let updated = digits;

      // Fix 1: Double prefix 62628xxx -> 628xxx or 08xxx
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
      // Fix 4: Extra 628 in front of 628 (628628xxx) -> 628xxx
      else if (updated.startsWith('628628')) {
        updated = '08' + updated.slice(6);
      }
      // Standardize 628xxx -> 08xxx format for DB storage consistency
      else if (updated.startsWith('628')) {
        updated = '08' + updated.slice(2);
      }

      // Format as standard 08xxx
      if (updated.startsWith('8')) {
        updated = '0' + updated;
      }

      if (updated !== raw && updated.length >= 10 && updated.length <= 13) {
        await prisma.pppoeUser.update({
          where: { id: user.id },
          data: { phone: updated },
        });

        fixedCount++;
        fixedDetails.push({
          username: user.username,
          name: user.name,
          oldPhone: raw,
          newPhone: updated,
        });
      }
    }

    return NextResponse.json({
      success: true,
      totalChecked: users.length,
      fixedCount,
      fixedDetails,
      message: `Berhasil merapikan & memperbaiki ${fixedCount} nomor HP pelanggan di database!`,
    });
  } catch (error: any) {
    console.error('Fix phone numbers error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal merapikan nomor HP' },
      { status: 500 }
    );
  }
}
