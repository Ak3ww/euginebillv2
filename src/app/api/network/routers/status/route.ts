import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';
const RouterOSAPI = require('node-routeros').RouterOSAPI;
import { prisma } from '@/server/db/client';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await request.json();
    const { routerIds } = body;

    if (!routerIds || !Array.isArray(routerIds)) {
      return NextResponse.json(
        { error: 'Router IDs array is required' },
        { status: 400 }
      );
    }

    // Get routers with vpnClient from database
    const routers = await prisma.router.findMany({
      where: {
        id: { in: routerIds },
      },
      include: {
        vpnClient: true,
      },
    });

    // Check status for each router directly on configured host & port (no guessing / port mutation)
    const statusMap: Record<string, { online: boolean; identity?: string; uptime?: string }> = {};

    await Promise.all(
      routers.map(async (router) => {
        // Direct Host: Utamakan VPN Tunnel IP jika router terhubung via VPN, else ipAddress
        const vpnIp = router.vpnClient?.vpnIp?.trim();
        const configuredIp = router.ipAddress?.trim() || router.nasname?.trim();
        const primaryHost = vpnIp || configuredIp;
        const secondaryHost = vpnIp && configuredIp && vpnIp !== configuredIp ? configuredIp : null;

        // Direct Port: Persis port yang diisi admin di router, atau target API VPN
        const vpnTarget = (router.vpnClient?.publicPorts as any)?.services?.api?.target;
        const targetPort = router.port || (vpnTarget ? parseInt(vpnTarget) : 8728);
        const isTls = targetPort === 8729;

        // Kredensial dinamis
        const user = (router.username || router.vpnClient?.apiUsername || 'admin').trim();
        const pass = router.password !== undefined && router.password !== null ? router.password : (router.vpnClient?.apiPassword || '');

        let isOnline = false;
        let identityName = 'Unknown';
        let uptimeVal = 'Unknown';

        const hostsToTry = [primaryHost, ...(secondaryHost ? [secondaryHost] : [])].filter(Boolean) as string[];

        for (const host of hostsToTry) {
          try {
            const conn = new RouterOSAPI({
              host,
              user,
              password: pass,
              port: targetPort,
              timeout: 4,
              tls: isTls,
            });

            await conn.connect();

            let identity = null;
            let resource = null;
            try {
              identity = await conn.write('/system/identity/print');
            } catch { /* ignore */ }
            try {
              resource = await conn.write('/system/resource/print');
            } catch { /* ignore */ }

            try { conn.close(); } catch { /* ignore */ }

            isOnline = true;
            identityName = identity?.[0]?.name || identity?.[0]?.['name'] || 'Unknown';
            uptimeVal = resource?.[0]?.uptime || resource?.[0]?.['uptime'] || 'Unknown';
            break;
          } catch {
            // Next host attempt
          }
        }

        statusMap[router.id] = {
          online: isOnline,
          ...(isOnline && {
            identity: identityName,
            uptime: uptimeVal,
          }),
        };
      })
    );

    return NextResponse.json({ statusMap });

  } catch (error) {
    console.error('Check router status error:', error);
    return NextResponse.json(
      { error: 'Failed to check router status' },
      { status: 500 }
    );
  }
}
