import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';
import { prisma } from '@/server/db/client';
import { RouterOSAPI } from 'node-routeros';

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

    // Force turn off RADIUS for PPPoE to ensure safe isolation
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

    let radcheckUsers: any[] = [];
    try {
      radcheckUsers = await prisma.radcheck.findMany({
        where: { attribute: { in: ['Cleartext-Password', 'User-Password'] } },
      });
    } catch {
      // ignore
    }

    let radgroups: any[] = [];
    try {
      radgroups = await prisma.radusergroup.findMany();
    } catch {
      // ignore
    }
    const radGroupMap = new Map(radgroups.map(g => [g.username, g.groupname]));

    const results: any[] = [];

    for (const router of routers) {
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

        // 3. Existing secrets on MikroTik
        const existingSecrets = await api.write('/ppp/secret/print');
        const existingMap = new Map();
        for (const s of existingSecrets) {
          if (s.name) existingMap.set(s.name.toLowerCase(), s);
        }

        const targetUsers = routers.length === 1 
          ? allUsers 
          : allUsers.filter(u => u.routerId === router.id || !u.routerId);

        let createdCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        for (const user of targetUsers) {
          try {
            const username = user.username.trim();
            const password = user.password || '123456';
            const isIsolated = user.status === 'isolated';
            const isSuspended = user.status === 'suspended' || user.status === 'stop';
            
            const profileName = isIsolated 
              ? isolateProfileName 
              : (user.profile?.mikrotikProfileName || user.profile?.name || 'default');

            const comment = `${user.name || ''} - ${user.customerId || ''} [RESTORED]`.trim();
            const disabledParam = isSuspended ? 'yes' : 'no';

            const existing = existingMap.get(username.toLowerCase());

            if (!existing) {
              const addParams = [
                '/ppp/secret/add',
                `=name=${username}`,
                `=password=${password}`,
                `=profile=${profileName}`,
                '=service=pppoe',
                `=comment=${comment}`,
                `=disabled=${disabledParam}`,
              ];
              if (user.ipAddress) {
                addParams.push(`=remote-address=${user.ipAddress}`);
              }
              await api.write(addParams);
              createdCount++;
            } else {
              const needProfileUpdate = isIsolated ? (existing.profile !== isolateProfileName) : (existing.profile === isolateProfileName);
              const needPasswordUpdate = existing.password !== password;

              if (needProfileUpdate || needPasswordUpdate) {
                await api.write([
                  '/ppp/secret/set',
                  `=.id=${existing['.id']}`,
                  `=password=${password}`,
                  `=profile=${profileName}`,
                  `=disabled=${disabledParam}`,
                ]);
                updatedCount++;
              } else {
                skippedCount++;
              }
            }
          } catch {
            errorCount++;
          }
        }

        // 4. Recover any users present in radcheck but missing from pppoeUser
        const userDbSet = new Set(allUsers.map(u => u.username.toLowerCase()));
        for (const rc of radcheckUsers) {
          const rcUser = rc.username.trim();
          if (!userDbSet.has(rcUser.toLowerCase()) && !existingMap.has(rcUser.toLowerCase())) {
            try {
              const rcPass = rc.value || '123456';
              const rcGroup = radGroupMap.get(rcUser) || 'default';
              await api.write([
                '/ppp/secret/add',
                `=name=${rcUser}`,
                `=password=${rcPass}`,
                `=profile=${rcGroup}`,
                '=service=pppoe',
                '=comment=Restored from FreeRADIUS radcheck',
                '=disabled=no',
              ]);
              createdCount++;
            } catch {
              errorCount++;
            }
          }
        }

        const finalSecrets = await api.write('/ppp/secret/print');
        await api.close();

        results.push({
          routerId: router.id,
          routerName: router.name,
          success: true,
          totalSecrets: finalSecrets.length,
          restored: createdCount,
          updated: updatedCount,
          skipped: skippedCount,
          errors: errorCount,
        });
      } catch (err: any) {
        results.push({
          routerId: router.id,
          routerName: router.name,
          success: false,
          error: err.message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Proses pemulihan secret MikroTik selesai',
      results,
    });
  } catch (error: any) {
    console.error('[Restore MikroTik Secrets] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memulihkan secret ke MikroTik' },
      { status: 500 }
    );
  }
}
