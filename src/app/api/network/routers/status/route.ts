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

    // Check status for each router with multi-port & VPN fallback
    const statusMap: Record<string, { online: boolean; identity?: string; uptime?: string }> = {};

    await Promise.all(
      routers.map(async (router) => {
        const candidateHosts = Array.from(new Set([
          router.ipAddress?.trim(),
          router.vpnClient?.vpnIp?.trim(),
          router.nasname?.trim(),
        ].filter(Boolean) as string[]));

        const vpnTarget = (router.vpnClient?.publicPorts as any)?.services?.api?.target;
        const candidatePorts = Array.from(new Set([
          router.port,
          vpnTarget ? parseInt(vpnTarget) : null,
          8520,
          8728,
          8729,
        ].filter(Boolean) as number[]));

        const creds = [
          { user: router.username, pass: router.password },
          ...(router.vpnClient?.apiUsername ? [{ user: router.vpnClient.apiUsername, pass: router.vpnClient.apiPassword || '' }] : []),
          ...(router.vpnClient?.username ? [{ user: router.vpnClient.username, pass: router.vpnClient.password || '' }] : []),
        ].filter(c => c.user);

        let isOnline = false;
        let identityName = 'Unknown';
        let uptimeVal = 'Unknown';
        let matchedPort: number | null = null;

        hostLoop: for (const host of candidateHosts) {
          for (const cred of creds) {
            for (const probePort of candidatePorts) {
              try {
                const conn = new RouterOSAPI({
                  host,
                  user: cred.user,
                  password: cred.pass,
                  port: probePort,
                  timeout: 3,
                  tls: probePort === 8729,
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
                matchedPort = probePort;
                identityName = identity?.[0]?.name || identity?.[0]?.['name'] || 'Unknown';
                uptimeVal = resource?.[0]?.uptime || resource?.[0]?.['uptime'] || 'Unknown';
                break hostLoop;
              } catch {
                // Next candidate
              }
            }
          }
        }

        if (isOnline) {
          statusMap[router.id] = {
            online: true,
            identity: identityName,
            uptime: uptimeVal,
          };
          // Auto-heal router.port if it connected on a different port
          if (matchedPort && router.port !== matchedPort) {
            await prisma.router.update({
              where: { id: router.id },
              data: { port: matchedPort },
            }).catch(() => {});
          }
        } else {
          statusMap[router.id] = {
            online: false,
          };
        }
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
