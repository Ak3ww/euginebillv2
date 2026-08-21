import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { RouterOSAPI } from 'node-routeros';
import { sendDisconnectRequest, isRadclientAvailable } from '@/server/services/radius/coa.service';
import { logActivity } from '@/server/services/activity-log.service';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';

// Check if CoA is available (radclient installed)
let coaAvailable: boolean | null = null;

// Get router secret by NAS IP
async function getRouterSecret(nasIpAddress: string): Promise<string | null> {
  const router = await prisma.router.findFirst({
    where: {
      OR: [
        { nasname: nasIpAddress },
        { ipAddress: nasIpAddress },
      ],
    },
    select: { secret: true },
  });
  return router?.secret || null;
}

// Disconnect PPPoE user via RADIUS CoA (sends directly to MikroTik NAS)
async function disconnectPPPoEViaCoA(
  username: string,
  session: { acctSessionId?: string; nasIpAddress?: string; framedIpAddress?: string }
): Promise<{ success: boolean; error?: string; targetNas?: string }> {
  try {
    if (!session.nasIpAddress) {
      return {
        success: false,
        error: 'No NAS IP address - cannot send CoA',
      };
    }

    // Get router secret from database
    const nasSecret = await getRouterSecret(session.nasIpAddress);
    
    console.log(`[Disconnect CoA] Sending to NAS ${session.nasIpAddress} for user ${username}`);
    
    const result = await sendDisconnectRequest({
      username,
      acctSessionId: session.acctSessionId,
      nasIpAddress: session.nasIpAddress,
      framedIpAddress: session.framedIpAddress,
      nasSecret: nasSecret || undefined,
    });
    
    return {
      success: result.success,
      error: result.error,
      targetNas: session.nasIpAddress,
    };
  } catch (error: any) {
    console.error(`[Disconnect CoA] Error for ${username}:`, error);
    return {
      success: false,
      error: error.message || 'CoA disconnect failed',
    };
  }
}

// Disconnect hotspot user via MikroTik API
async function disconnectHotspotUser(router: any, username: string): Promise<{ success: boolean; error?: string }> {
  const host = router.ipAddress || router.nasname;
  const port = router.port || 8728;
  
  console.log(`[Disconnect] Connecting to router ${router.name} (${host}:${port}) for user ${username}`);
  
  const apiOpts: any = {
    host,
    port,
    user: router.username,
    password: router.password,
    timeout: 5,
  };
  if (port === 8729 || port === router.apiPort) {
    apiOpts.tls = { rejectUnauthorized: false };
  }
  const api = new RouterOSAPI(apiOpts);

  try {
    await api.connect();
    console.log(`[Disconnect] Connected to ${router.name}`);
    
    // Find active hotspot user - try both "user" and "username" fields
    let activeUsers = await api.write('/ip/hotspot/active/print', [
      `?user=${username}`,
    ]);
    
    // If not found by "user", try printing all and filtering
    if (activeUsers.length === 0) {
      console.log(`[Disconnect] User not found by ?user filter, fetching all active users...`);
      const allUsers = await api.write('/ip/hotspot/active/print');
      console.log(`[Disconnect] All active users:`, JSON.stringify(allUsers, null, 2));
      
      // Filter manually by multiple possible fields
      activeUsers = allUsers.filter((u: any) => 
        u.user === username || 
        u.username === username || 
        u.name === username
      );
    }
    
    console.log(`[Disconnect] Found ${activeUsers.length} active sessions for ${username}`);
    
    if (activeUsers.length === 0) {
      await api.close();
      return { success: false, error: `User ${username} not found in hotspot active list` };
    }
    
    // Remove the user (disconnect)
    for (const user of activeUsers) {
      const userId = user['.id'];
      console.log(`[Disconnect] Removing user with .id=${userId}`);
      
      try {
        const removeResult = await api.write('/ip/hotspot/active/remove', [
          `=.id=${userId}`,
        ]);
        console.log(`[Disconnect] Remove result:`, removeResult);
      } catch (removeErr: any) {
        console.error(`[Disconnect] Remove error:`, removeErr);
        await api.close();
        return { success: false, error: `Failed to remove: ${removeErr.message || removeErr}` };
      }
    }
    
    await api.close();
    console.log(`[Disconnect] Successfully disconnected ${username}`);
    return { success: true };
  } catch (error: any) {
    console.error(`[Disconnect] Failed to disconnect hotspot user ${username}:`, error);
    try { await api.close(); } catch {}
    return { success: false, error: error.message || error.toString() || 'Unknown error' };
  }
}

// Helper: hard timeout wrapper for RouterOS API calls
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      v => { clearTimeout(timer); resolve(v); },
      e => { clearTimeout(timer); reject(e); },
    );
  });
}

// Disconnect PPPoE user via MikroTik API with fallback to CoA
async function disconnectPPPoEUser(router: any, username: string): Promise<{ success: boolean; error?: string }> {
  const host = router.ipAddress || router.nasname;
  if (!host) return { success: false, error: 'Host IP router belum diatur' };

  const primaryPort = router.port || 8728;
  const secondaryPort = router.apiPort || (primaryPort === 8729 ? 8728 : 8729);
  const portsToTry = [primaryPort, ...(secondaryPort !== primaryPort ? [secondaryPort] : [])];

  for (const tryPort of portsToTry) {
    try {
      const result = await withTimeout(
        (async () => {
          const apiOpts: any = {
            host,
            port: tryPort,
            user: router.username,
            password: router.password,
            timeout: 5,
          };
          if (tryPort === 8729 || (router.apiPort && tryPort === router.apiPort)) {
            apiOpts.tls = { rejectUnauthorized: false };
          }
          const api = new RouterOSAPI(apiOpts);

          try {
            await api.connect();
            
            // 1. Fetch active PPPoE sessions
            const allActive = await api.write('/ppp/active/print');
            const targetLower = username.toLowerCase().trim();
            const activeSessions = allActive.filter((s: any) => 
              (s.name && s.name.toLowerCase().trim() === targetLower) || 
              (s.user && s.user.toLowerCase().trim() === targetLower) ||
              (s['service-name'] && s['service-name'].toLowerCase().trim() === targetLower)
            );
            
            let removedCount = 0;
            for (const s of activeSessions) {
              if (s['.id']) {
                await api.write('/ppp/active/remove', [`=.id=${s['.id']}`]);
                removedCount++;
              }
            }

            // 2. Remove dynamic PPPoE interface if present
            try {
              const ifaces = await api.write('/interface/print', [`?name=<pppoe-${username}>`]);
              for (const iface of ifaces) {
                if (iface['.id']) {
                  await api.write('/interface/remove', [`=.id=${iface['.id']}`]);
                }
              }
            } catch { /* ignore */ }
            
            await api.close();
            
            if (removedCount > 0) {
              console.log(`[Disconnect] Successfully removed ${removedCount} PPPoE session(s) for ${username} from ${host}:${tryPort}`);
              return { success: true };
            } else {
              return { success: false, error: `Sesi ${username} tidak ditemukan aktif di MikroTik ${router.name}` };
            }
          } catch (error: any) {
            try { await api.close(); } catch {}
            return { success: false, error: error?.message || String(error) };
          }
        })(),
        7000,
        `MikroTik API ${host}:${tryPort}`
      );
      if (result.success) return result;
    } catch (err: any) {
      console.log(`[Disconnect] PPPoE API failed on ${host}:${tryPort}: ${err?.message}`);
    }
  }
  return { success: false, error: `Gagal terhubung ke API MikroTik ${router.name} (${host})` };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionIds, usernames } = body;

    if ((!sessionIds || !sessionIds.length) && (!usernames || !usernames.length)) {
      return NextResponse.json(
        { error: 'sessionIds or usernames required' },
        { status: 400 }
      );
    }

    if (coaAvailable === null) {
      coaAvailable = await isRadclientAvailable();
    }

    const routers = await prisma.router.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        nasname: true,
        ipAddress: true,
        username: true,
        password: true,
        port: true,
        apiPort: true,
        secret: true,
      },
    });

    if (routers.length === 0) {
      return NextResponse.json(
        { error: 'Tidak ada Router aktif yang terdaftar' },
        { status: 400 }
      );
    }

    // Collect all target usernames to disconnect
    const targetUsernames = new Set<string>();
    if (Array.isArray(usernames)) {
      usernames.filter(Boolean).forEach((u: string) => targetUsernames.add(u.trim()));
    }

    if (Array.isArray(sessionIds) && sessionIds.length > 0) {
      const stringIds = sessionIds.map(s => String(s));
      const [radaccts, mikrotikSessions] = await Promise.all([
        prisma.radacct.findMany({
          where: {
            OR: [
              { acctsessionid: { in: stringIds } },
              { username: { in: stringIds } },
            ]
          },
          select: { username: true }
        }),
        prisma.mikrotikSession.findMany({
          where: {
            OR: [
              { id: { in: stringIds } },
              { username: { in: stringIds } },
            ]
          },
          select: { username: true }
        })
      ]);

      radaccts.forEach(r => { if (r.username) targetUsernames.add(r.username.trim()); });
      mikrotikSessions.forEach(m => { if (m.username) targetUsernames.add(m.username.trim()); });
      stringIds.forEach(s => {
        if (s && !s.startsWith('rad-') && !s.startsWith('voucher-')) {
          targetUsernames.add(s.trim());
        }
      });
    }

    const results: any[] = [];

    for (const username of targetUsernames) {
      try {
        const pppoeUser = await prisma.pppoeUser.findFirst({
          where: {
            OR: [
              { username },
              { username: username.toLowerCase() },
              { username: username.toUpperCase() },
            ]
          },
          include: { router: true }
        });

        const sessionType = pppoeUser ? 'pppoe' : 'hotspot';

        // Order router candidates: assigned router first
        const routerCandidates: any[] = [];
        if (pppoeUser?.router && pppoeUser.router.isActive) {
          routerCandidates.push(pppoeUser.router);
        }
        for (const r of routers) {
          if (!routerCandidates.find(c => c.id === r.id)) {
            routerCandidates.push(r);
          }
        }

        let disconnectResult: { success: boolean; error?: string } = { success: false, error: 'Router tidak ditemukan' };
        let matchedRouter: any = null;
        let method = 'api';

        if (sessionType === 'pppoe') {
          for (const r of routerCandidates) {
            disconnectResult = await disconnectPPPoEUser(r, username);
            if (disconnectResult.success) {
              matchedRouter = r;
              break;
            }
          }

          // CoA Fallback if API fails
          if (!disconnectResult.success && coaAvailable) {
            const activeRad = await prisma.radacct.findFirst({
              where: { username, acctstoptime: null },
              orderBy: { acctstarttime: 'desc' },
            });
            if (activeRad?.nasipaddress) {
              method = 'coa';
              disconnectResult = await disconnectPPPoEViaCoA(username, {
                acctSessionId: activeRad.acctsessionid || undefined,
                nasIpAddress: activeRad.nasipaddress,
                framedIpAddress: activeRad.framedipaddress || undefined,
              });
            }
          }
        } else {
          // Hotspot disconnect
          for (const r of routerCandidates) {
            disconnectResult = await disconnectHotspotUser(r, username);
            if (disconnectResult.success) {
              matchedRouter = r;
              break;
            }
          }
        }

        // Update database accounting records
        await Promise.all([
          prisma.radacct.updateMany({
            where: { username, acctstoptime: null },
            data: { acctstoptime: new Date(), acctterminatecause: 'Admin-Reset' }
          }).catch(() => {}),
          prisma.mikrotikSession.updateMany({
            where: { username, stopTime: null },
            data: { stopTime: new Date(), terminateCause: 'Admin-Reset' }
          }).catch(() => {})
        ]);

        results.push({
          username,
          type: sessionType,
          router: matchedRouter?.name || (disconnectResult.success ? 'MikroTik' : 'Unknown'),
          method,
          success: disconnectResult.success,
          error: disconnectResult.error,
        });

      } catch (err: any) {
        results.push({
          username,
          success: false,
          error: err.message || 'Error saat memutuskan sesi',
        });
      }
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    // Log activity
    try {
      const session = await getServerSession(authOptions);
      const usernamesStr = Array.isArray(usernames) ? usernames.join(', ') : String(usernames || '');
      await logActivity({
        userId: (session?.user as any)?.id,
        username: (session?.user as any)?.username || 'Admin',
        userRole: (session?.user as any)?.role,
        action: 'DISCONNECT_SESSION',
        description: `Disconnected ${successful} session(s): ${usernamesStr.substring(0, 100)}`,
        module: 'session',
        status: failed > 0 ? 'warning' : 'success',
        request,
        metadata: {
          total: results.length,
          successful,
          failed,
        },
      });
    } catch (logError) {
      console.error('Activity log error:', logError);
    }

    return NextResponse.json({
      success: true,
      summary: {
        total: results.length,
        successful,
        failed,
      },
      results,
    });
  } catch (error: any) {
    console.error('Disconnect sessions error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
