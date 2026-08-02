import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';
import { prisma } from '@/server/db/client';
import { disconnectMultiplePPPoEUsers } from '@/server/services/radius/coa-handler.service';

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { userIds, status } = await request.json();

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { error: 'Missing or invalid userIds' },
        { status: 400 }
      );
    }

    if (!status || !['active', 'isolated', 'blocked', 'stop'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be: active, isolated, blocked, or stop' },
        { status: 400 }
      );
    }

    // Get company settings to determine mode
    const company = await prisma.company.findFirst();
    const isRadiusEnabled = company?.radiusEnabled ?? false;

    // Get all users with router info
    const users = await prisma.pppoeUser.findMany({
      where: { id: { in: userIds } },
      include: { 
        profile: { select: { groupName: true, mikrotikProfileName: true, name: true } },
        router: { select: { id: true, ipAddress: true, username: true, password: true, apiPort: true } },
      },
    });

    if (users.length === 0) {
      return NextResponse.json(
        { error: 'No users found' },
        { status: 404 }
      );
    }

    // Update all users status in DB
    await prisma.pppoeUser.updateMany({
      where: { id: { in: userIds } },
      data: { status },
    });

    // Apply network-level changes per user
    for (const user of users) {
      if (isRadiusEnabled) {
        // ========== RADIUS MODE ==========
        if (status === 'active') {
          await prisma.radcheck.deleteMany({ where: { username: user.username, attribute: 'Auth-Type' } });
          await prisma.radcheck.deleteMany({ where: { username: user.username, attribute: 'NAS-IP-Address' } });
          await prisma.radreply.deleteMany({ where: { username: user.username, attribute: 'Reply-Message' } });

          await prisma.$executeRaw`
            INSERT INTO radcheck (username, attribute, op, value)
            VALUES (${user.username}, 'Cleartext-Password', ':=', ${user.password})
            ON DUPLICATE KEY UPDATE value = ${user.password}
          `;

          await prisma.$executeRaw`DELETE FROM radusergroup WHERE username = ${user.username}`;
          await prisma.$executeRaw`
            INSERT INTO radusergroup (username, groupname, priority)
            VALUES (${user.username}, ${user.profile.groupName}, 1)
          `;

          if (user.ipAddress) {
            await prisma.$executeRaw`
              INSERT INTO radreply (username, attribute, op, value)
              VALUES (${user.username}, 'Framed-IP-Address', ':=', ${user.ipAddress})
              ON DUPLICATE KEY UPDATE value = ${user.ipAddress}
            `;
          }

        } else if (status === 'isolated') {
          await prisma.radcheck.deleteMany({ where: { username: user.username, attribute: 'Auth-Type' } });
          await prisma.radcheck.deleteMany({ where: { username: user.username, attribute: 'NAS-IP-Address' } });
          await prisma.radreply.deleteMany({ where: { username: user.username, attribute: 'Reply-Message' } });

          await prisma.$executeRaw`
            INSERT INTO radcheck (username, attribute, op, value)
            VALUES (${user.username}, 'Cleartext-Password', ':=', ${user.password})
            ON DUPLICATE KEY UPDATE value = ${user.password}
          `;

          await prisma.$executeRaw`DELETE FROM radusergroup WHERE username = ${user.username}`;
          await prisma.$executeRaw`
            INSERT INTO radusergroup (username, groupname, priority)
            VALUES (${user.username}, 'isolir', 1)
          `;

          await prisma.$executeRaw`
            DELETE FROM radreply WHERE username = ${user.username} AND attribute = 'Framed-IP-Address'
          `;

        } else if (status === 'blocked' || status === 'stop') {
          await prisma.$executeRaw`DELETE FROM radcheck WHERE username = ${user.username}`;
          await prisma.$executeRaw`DELETE FROM radusergroup WHERE username = ${user.username}`;
          await prisma.$executeRaw`DELETE FROM radreply WHERE username = ${user.username}`;
        }

        // ========== ALWAYS SYNC MIKROTIK DIRECT API (PPP Secret & Active Session) ==========
        if (user.router) {
          const { MikroTikConnection } = await import('@/server/services/mikrotik/client');
          const port = (user.router as any).port || 8728;
          const conn = new MikroTikConnection({
            host: user.router.ipAddress,
            username: user.router.username,
            password: user.router.password,
            port,
          });
          try {
            await conn.connect();
            const existing = await conn.execute('/ppp/secret/print', [`?name=${user.username}`]);
            if (existing.length > 0) {
              if (status === 'stop') {
                await conn.execute('/ppp/secret/remove', [`=.id=${existing[0]['.id']}`]);
              } else if (status === 'blocked') {
                await conn.execute('/ppp/secret/set', [
                  `=.id=${existing[0]['.id']}`,
                  `=disabled=yes`,
                ]);
              } else if (status === 'active') {
                const normalProfile = user.profile.mikrotikProfileName || user.profile.name || user.profile.groupName;
                await conn.execute('/ppp/secret/set', [
                  `=.id=${existing[0]['.id']}`,
                  `=disabled=no`,
                  `=profile=${normalProfile}`,
                ]);
              } else if (status === 'isolated') {
                await conn.execute('/ppp/secret/set', [
                  `=.id=${existing[0]['.id']}`,
                  `=disabled=no`,
                  `=profile=isolir`,
                ]);
              }
            }
            const active = await conn.execute('/ppp/active/print', [`?name=${user.username}`]);
            for (const session of active) {
              await conn.execute('/ppp/active/remove', [`=.id=${session['.id']}`]);
            }
            await conn.disconnect();
            console.log(`[Bulk Status Change] MikroTik API sync complete for ${user.username} (status: ${status}, port: ${port})`);
          } catch (err) {
            console.error(`[Bulk Status Change] MikroTik API sync error for ${user.username} on port ${port}:`, err);
            try { await conn.disconnect(); } catch { /* ignore */ }
          }
        }
      }
    }

    // Send CoA disconnect for RADIUS mode users
    if (isRadiusEnabled) {
      const usernames = users.map(u => u.username);
      const coaResult = await disconnectMultiplePPPoEUsers(usernames);
      console.log(`[Bulk Status Change] CoA disconnect result:`, coaResult);
    }

    return NextResponse.json({
      success: true,
      updated: users.length,
      status,
    });
  } catch (error) {
    console.error('Bulk status change error:', error);
    return NextResponse.json(
      { error: 'Failed to update status' },
      { status: 500 }
    );
  }
}
