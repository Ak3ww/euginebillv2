import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';
import { ok, unauthorized, notFound, serverError } from '@/lib/api-response';
import { prisma } from '@/server/db/client';
import { PPPSecretService } from '@/server/services/mikrotik/ppp-secret.service';

// POST /api/pppoe/users/[id]/sync-radius — re-sync a single user to MikroTik /ppp secret and RADIUS tables
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorized();

  try {
    const { id } = await params;

    const user = await prisma.pppoeUser.findUnique({
      where: { id },
      include: { profile: true, router: true },
    });
    if (!user) return notFound('User tidak ditemukan');

    const username = user.username;
    const company = await prisma.company.findFirst();
    const isRadiusEnabled = company?.radiusPppoeEnabled ?? false;

    // 1. Sync to FreeRADIUS MySQL if enabled
    if (isRadiusEnabled) {
      // Re-create radcheck (password)
      await prisma.radcheck.deleteMany({ where: { username } });
      await prisma.radcheck.create({
        data: { username, attribute: 'Cleartext-Password', op: ':=', value: user.password },
      });

      // Re-create radusergroup (profile group)
      await prisma.radusergroup.deleteMany({ where: { username } });
      await prisma.radusergroup.create({
        data: { username, groupname: user.profile.groupName, priority: 0 },
      });

      // Re-create radreply (static IP if set)
      await prisma.radreply.deleteMany({ where: { username } });
      if (user.ipAddress) {
        await prisma.radreply.create({
          data: { username, attribute: 'Framed-IP-Address', op: ':=', value: user.ipAddress },
        });
      }
    }

    // 2. Sync to MikroTik router /ppp secret
    let mikrotikSynced = false;
    try {
      mikrotikSynced = await PPPSecretService.syncSecret(user.id);
    } catch (mtkError) {
      console.error(`Failed to sync user ${username} to MikroTik:`, mtkError);
    }

    // Mark synced in database
    await prisma.pppoeUser.update({
      where: { id },
      data: { syncedToRadius: true, lastSyncAt: new Date() },
    });

    let message = `${username} berhasil di-sync ke MikroTik`;
    if (isRadiusEnabled && mikrotikSynced) {
      message = `${username} berhasil di-sync ke MikroTik & RADIUS`;
    } else if (isRadiusEnabled && !mikrotikSynced) {
      message = `${username} tersinkron ke RADIUS (MikroTik API belum terhubung)`;
    } else if (!mikrotikSynced) {
      message = `${username} tersimpan di database, tetapi koneksi MikroTik API gagal/timeout`;
    }

    return ok({ success: mikrotikSynced || isRadiusEnabled, message, mikrotikSynced });
  } catch (error) {
    console.error('Sync user error:', error);
    return serverError();
  }
}
