import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';
import { prisma } from '@/server/db/client';
import { RouterOSAPI } from 'node-routeros';

export const dynamic = 'force-dynamic';

const EXCLUDED_STATUSES = new Set([
  'stop', 'stopped', 'inactive', 'dismantled', 'dismantle',
  'terminated', 'cancelled', 'pending', 'pending_installation'
]);

function isUserOffOrInactive(user: any) {
  if (!user) return true;
  if (user.isDismantled) return true;
  const username = (user.username || '').toUpperCase();
  if (username.includes('-OFF-') || username.includes('_OFF_') || username.includes('(OFF)')) return true;
  const status = (user.status || '').toLowerCase().trim();
  if (EXCLUDED_STATUSES.has(status)) return true;
  return false;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const targetRouterId = body.routerId;

    const company = await prisma.company.findFirst();
    const isolateProfileName = company?.isolateProfileName || 'isolir';

    // Force turn off RADIUS for PPPoE to ensure safe local authentication
    await prisma.company.updateMany({
      data: {
        radiusPppoeEnabled: false,
        radiusEnabled: false,
      },
    });

    const routers = targetRouterId
      ? await prisma.router.findMany({ where: { id: targetRouterId, isActive: true } })
      : await prisma.router.findMany({ where: { isActive: true } });

    if (routers.length === 0) {
      return NextResponse.json({ error: 'Router tidak ditemukan atau tidak aktif' }, { status: 404 });
    }

    const allUsers = await prisma.pppoeUser.findMany({
      include: { router: true, profile: true },
    });

    const results: any[] = [];

    for (const router of routers) {
      const isCiteureupRouter = router.name.toLowerCase().includes('citeureup') || router.name.toLowerCase().includes('ctp');

      const apiHost = router.ipAddress || router.nasname;
      const apiPort = router.port || 8728;

      const api = new RouterOSAPI({
        host: apiHost,
        port: apiPort,
        user: router.username,
        password: router.password,
        timeout: 15,
      });

      try {
        await api.connect();

        // 1. Force use-radius=no & accounting=no on PPP AAA
        await api.write(['/ppp/aaa/set', '=use-radius=no', '=accounting=no']);

        // 2. Strip 'ppp' from radius service
        try {
          const radiusEntries = await api.write('/radius/print');
          for (const r of radiusEntries) {
            if ((r.service || '').toLowerCase().includes('ppp')) {
              await api.write(['/radius/set', `=.id=${r['.id']}`, '=service=hotspot']);
            }
          }
        } catch {
          // ignore
        }

        // 3. Strict router filtering
        const routerUsers = allUsers.filter(u => {
          if (isCiteureupRouter) {
            const rName = (u.router?.name || '').toLowerCase();
            return rName.includes('citeureup') || u.routerId === router.id || u.username.toUpperCase().startsWith('EMGC');
          } else {
            const rName = (u.router?.name || '').toLowerCase();
            if (rName.includes('citeureup')) return false;
            if (u.username.toUpperCase().startsWith('EMGC')) return false;
            return u.routerId === router.id || (!u.routerId && u.username.toUpperCase().startsWith('EMG'));
          }
        });

        // 4. Exclude OFF users
        const validUsers = routerUsers.filter(u => !isUserOffOrInactive(u));
        const offUsers = routerUsers.filter(u => isUserOffOrInactive(u));
        const offUsernameSet = new Set(offUsers.map(u => u.username.toLowerCase()));

        // 5. Clean up spurious secrets
        const existingSecrets = await api.write('/ppp/secret/print');
        let removedCount = 0;

        for (const s of existingSecrets) {
          const sNameUpper = (s.name || '').toUpperCase().trim();
          const sNameLower = (s.name || '').toLowerCase().trim();

          let shouldRemove = false;
          if (isCiteureupRouter) {
            if (sNameUpper.startsWith('EMG') && !sNameUpper.startsWith('EMGC')) shouldRemove = true;
          } else {
            if (sNameUpper.startsWith('EMGC')) shouldRemove = true;
          }

          if (sNameUpper.includes('-OFF-') || sNameUpper.includes('_OFF_') || sNameUpper.includes('(OFF)')) {
            shouldRemove = true;
          }
          if (offUsernameSet.has(sNameLower)) {
            shouldRemove = true;
          }

          if (shouldRemove) {
            await api.write(['/ppp/secret/remove', `=.id=${s['.id']}`]);
            removedCount++;
          }
        }

        // 6. Refresh secrets & sync valid users
        const freshSecrets = await api.write('/ppp/secret/print');
        const secretMap = new Map();
        for (const s of freshSecrets) {
          if (s.name) secretMap.set(s.name.toLowerCase(), s);
        }

        let createdCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;

        for (const user of validUsers) {
          try {
            const username = user.username.trim();
            const password = user.password || '123456';
            const isIsolated = user.status === 'isolated';
            const profileName = isIsolated 
              ? isolateProfileName 
              : (user.profile?.mikrotikProfileName || user.profile?.name || 'default');
            const comment = `${user.name || ''} - ${user.customerId || ''}`.trim();

            const existing = secretMap.get(username.toLowerCase());

            if (!existing) {
              const addParams = [
                '/ppp/secret/add',
                `=name=${username}`,
                `=password=${password}`,
                `=profile=${profileName}`,
                '=service=pppoe',
                `=comment=${comment}`,
                '=disabled=no',
              ];
              if (user.ipAddress) {
                addParams.push(`=remote-address=${user.ipAddress}`);
              }
              await api.write(addParams);
              createdCount++;
            } else {
              let needUpdate = false;
              if (isIsolated && existing.profile !== isolateProfileName) {
                needUpdate = true;
              } else if (!isIsolated && existing.profile === isolateProfileName) {
                needUpdate = true;
              }

              if (needUpdate) {
                await api.write([
                  '/ppp/secret/set',
                  `=.id=${existing['.id']}`,
                  `=profile=${profileName}`,
                  '=disabled=no',
                ]);
                updatedCount++;
              } else {
                skippedCount++;
              }
            }
          } catch (uErr: any) {
            console.error(`[Restore API] Failed user ${user.username}:`, uErr.message);
          }
        }

        const finalSecrets = await api.write('/ppp/secret/print');
        await api.close();

        results.push({
          router: router.name,
          ip: router.ipAddress,
          totalSecrets: finalSecrets.length,
          removedSpurious: removedCount,
          created: createdCount,
          updated: updatedCount,
          skipped: skippedCount,
          success: true,
        });
      } catch (rErr: any) {
        results.push({
          router: router.name,
          error: rErr.message,
          success: false,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Pemulihan dan pembersihan secret MikroTik selesai dengan aman.',
      results,
    });
  } catch (error: any) {
    console.error('[Restore Mikrotik API Error]:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
