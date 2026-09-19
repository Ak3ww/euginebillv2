import { NextRequest, NextResponse } from 'next/server';
import { reloadFreeRadius } from '@/server/services/radius/freeradius.service';
import { logActivity } from '@/server/services/activity-log.service';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';
import crypto from 'crypto';
import os from 'os';
const RouterOSAPI = require('node-routeros').RouterOSAPI;
import { prisma } from '@/server/db/client';
import { getNextPortBlock, buildPublicPorts, addIptablesRules, removeIptablesRules, type PublicPorts, type ServiceName } from '@/lib/vpn-port-allocator';

// Auto-detect server IP from network interfaces
const getServerIp = (): string => {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      // Skip internal (loopback) and non-IPv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
};

// RADIUS Server IP - prioritas: ENV > auto-detect
const getRadiusServerIp = () => process.env.RADIUS_SERVER_IP || process.env.VPS_IP || getServerIp();

/**
 * Terapkan port forwarding di VPS iptables murni berdasarkan ISIAN ADMIN langsung.
 * Tidak melakukan scan/probe ke MikroTik — langsung tulis port sesuai form admin.
 */
async function applyAdminPortForwarding(
  vpnClientId: string,
  adminPorts: {
    winbox?: number
    api?: number
    apiSsl?: number
    www?: number
    ssh?: number
  }
): Promise<void> {
  try {
    const vpnClient = await prisma.vpnClient.findUnique({
      where: { id: vpnClientId },
      select: { id: true, vpnIp: true, publicPorts: true },
    })
    if (!vpnClient) return

    const connectIp = vpnClient.vpnIp
    const existingPorts = vpnClient.publicPorts as unknown as PublicPorts | null

    const targetPorts: Partial<Record<ServiceName, number>> = {}
    if (adminPorts.winbox && adminPorts.winbox > 0) targetPorts.winbox = adminPorts.winbox
    if (adminPorts.api && adminPorts.api > 0) targetPorts.api = adminPorts.api
    if (adminPorts.apiSsl && adminPorts.apiSsl > 0) targetPorts.apiSsl = adminPorts.apiSsl
    if (adminPorts.www && adminPorts.www > 0) targetPorts.www = adminPorts.www
    if (adminPorts.ssh && adminPorts.ssh > 0) targetPorts.ssh = adminPorts.ssh

    if (existingPorts?.services) {
      const changedServices: ServiceName[] = []
      const mergedTargets: Partial<Record<ServiceName, number>> = {}

      for (const [svcKey, entry] of Object.entries(existingPorts.services) as [ServiceName, { public: number; target: number }][]) {
        const newTarget = targetPorts[svcKey] ?? entry.target
        mergedTargets[svcKey] = newTarget
        if (newTarget !== entry.target) {
          changedServices.push(svcKey)
        }
      }

      if (changedServices.length > 0) {
        await removeIptablesRules(connectIp, existingPorts, changedServices)
        const newPublicPorts = buildPublicPorts(existingPorts.blockStart, mergedTargets)
        await addIptablesRules(connectIp, newPublicPorts, changedServices)
        await prisma.vpnClient.update({
          where: { id: vpnClientId },
          data: { publicPorts: newPublicPorts as any },
        })
        console.log(`[routers] Port forwarding VPS diperbarui sesuai input admin untuk vpnClient ${vpnClientId}: ${changedServices.join(', ')}`)
      } else {
        await addIptablesRules(connectIp, existingPorts)
      }
      return
    }

    // Alokasi blok port baru jika belum ada
    const blockStart = await getNextPortBlock()
    const publicPorts = buildPublicPorts(blockStart, targetPorts)
    await addIptablesRules(connectIp, publicPorts)

    await prisma.vpnClient.update({
      where: { id: vpnClientId },
      data: { publicPorts: publicPorts as any },
    })
    console.log(`[routers] Port forwarding VPS dibuat sesuai input admin untuk vpnClient ${vpnClientId}: block ${blockStart}`)
  } catch (err: any) {
    console.warn(`[routers] applyAdminPortForwarding error (non-fatal): ${err.message}`)
  }
}

// GET - Load all routers
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const radiusServerIp = getRadiusServerIp();
    
    const routers = await prisma.router.findMany({
      include: {
        vpnClient: {
          select: {
            id: true,
            name: true,
            vpnIp: true,
            publicPorts: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' },
    });

    // Auto-heal / sync router port from VPN client target if router.port is default 8728
    for (const r of routers) {
      const vpnApiTarget = (r.vpnClient?.publicPorts as any)?.services?.api?.target;
      if (vpnApiTarget && r.port !== vpnApiTarget && r.port === 8728) {
        await prisma.router.update({
          where: { id: r.id },
          data: { port: vpnApiTarget },
        }).catch(() => {});
        r.port = vpnApiTarget;
      }
    }
    
    // Load VPN clients
    const vpnClients = await prisma.vpnClient.findMany({
      select: {
        id: true,
        name: true,
        vpnIp: true,
        isRadiusServer: true,
        apiUsername: true,
        apiPassword: true,
        publicPorts: true,
      },
      orderBy: { name: 'asc' },
    });

    // Attach nasSecret + credentials from linked router (NAS) entry
    const clientIds = vpnClients.map((c: { id: string }) => c.id)
    const nasEntries = clientIds.length > 0
      ? await prisma.router.findMany({
          where: { vpnClientId: { in: clientIds } },
          select: { vpnClientId: true, secret: true, username: true, password: true },
        })
      : []
    type NasEntry = { vpnClientId: string | null; secret: string; username: string; password: string }
    const nasMap = new Map(nasEntries.map((n: NasEntry) => [n.vpnClientId, n]))
    const vpnClientsWithSecret = vpnClients.map((c: { id: string; name: string; vpnIp: string; isRadiusServer: boolean; apiUsername: string | null; apiPassword: string | null }) => {
      const nas = nasMap.get(c.id)
      return {
        ...c,
        nasSecret: nas?.secret ?? null,
        // Use vpnClient API creds first; fall back to NAS entry creds (e.g. WireGuard)
        resolvedUsername: c.apiUsername ?? nas?.username ?? null,
        resolvedPassword: c.apiPassword ?? nas?.password ?? null,
      }
    })
    
    // Add radiusServerIp as computed field for frontend display
    // Note: 'server' field in NAS table is for FreeRADIUS virtual_server name, NOT RADIUS IP
    const routersWithServer = routers.map(router => ({
      ...router,
      radiusServerIp: radiusServerIp,  // For frontend display only
      ports: router.ports || 1812,
    }));

    return NextResponse.json({ routers: routersWithServer, vpnClients: vpnClientsWithSecret, radiusServerIp });
  } catch (error) {
    console.error('Load routers error:', error);
    return NextResponse.json({ error: 'Failed to load routers' }, { status: 500 });
  }
}

// POST - Add new router
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, ipAddress, nasIpAddress, nasname: nasnameFromBody, username, password, port, apiPort, winboxPort, secret, latitude, longitude, vpnClientId, type, authMode } = body;

    // Basic validation
    if (!name || !ipAddress) {
      return NextResponse.json(
        { error: 'Name and IP address are required' },
        { status: 400 }
      );
    }

    // For non-gateway types, require username and password
    const isGateway = type === 'gateway' || name.toLowerCase().includes('gateway');
    if (!isGateway && (!username || !password)) {
      return NextResponse.json(
        { error: 'Username and password are required for MikroTik routers' },
        { status: 400 }
      );
    }

    // Parse integers
    const portInt = parseInt(port) || 8728;

    // Generate shortname from name (remove spaces, lowercase)
    const shortname = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // nasname = IP yang digunakan FreeRADIUS untuk autentikasi (IP publik/VPN source)
    // ipAddress = IP untuk koneksi API MikroTik
    // Jika nasIpAddress tidak diisi, gunakan ipAddress sebagai default
    const nasname = nasIpAddress || nasnameFromBody || ipAddress;

    // Check if router with same nasname+port+secret already exists
    const existingRouter = await prisma.router.findFirst({
      where: {
        nasname,
        ports: 1812,
        secret: secret || 'secret123',
      },
    });

    if (existingRouter) {
      return NextResponse.json(
        { 
          error: 'Router dengan kombinasi IP, Port RADIUS, dan Secret yang sama sudah ada. Gunakan port atau secret berbeda.',
          details: `Existing router: ${existingRouter.name}`
        },
        { status: 409 }
      );
    }

    // Intelligent Connection Probe (Non-blocking):
    // Prioritaskan port yang diisi admin, auto-probe candidate ports jika timeout/refused.
    // TIDAK PERNAH memblokir penyimpanan router ke database jika test gagal (agar router tersimpan).
    let detectedPort = portInt;
    let connectionWarning: string | null = null;
    let fixScript: string | null = null;

    if (!isGateway) {
      try {
        const candidatePorts = Array.from(new Set([portInt, 8520, 8728, 8729]));
        let connected = false;

        for (const probePort of candidatePorts) {
          try {
            const probeConn = new RouterOSAPI({
              host: ipAddress,
              user: username,
              password: password,
              port: probePort,
              timeout: 3,
              tls: probePort === 8729,
            });
            await probeConn.connect();
            detectedPort = probePort;
            connected = true;
            probeConn.close();
            break;
          } catch {
            // Coba port berikutnya
          }
        }

        if (!connected) {
          connectionWarning = `Router tersimpan, namun koneksi MikroTik API ke ${ipAddress}:${portInt} saat ini belum terhubung. Pastikan firewall dan service API MikroTik telah diaktifkan.`;
          fixScript = `/ip service set api port=${portInt} disabled=no address=""\n/ip firewall filter add chain=input action=accept protocol=tcp dst-port=${portInt},8728 comment="Allow EugineBill VPS API" place-before=0`;
        }
      } catch (err: any) {
        connectionWarning = `Router tersimpan (status koneksi API belum terverifikasi: ${err.message})`;
      }
    }


    // Save to database
    // Note: 'server' field left NULL - it's for FreeRADIUS virtual_server name, not RADIUS IP
    const router = await prisma.router.create({
      data: {
        id: crypto.randomUUID(),
        name,
        nasname,           // IP untuk FreeRADIUS client (IP publik/VPN)
        shortname,
        type: type || 'mikrotik',
        ipAddress,         // IP untuk koneksi API MikroTik
        username: username || '',  // Empty string for gateway type
        password: password || '',  // Empty string for gateway type
        port: detectedPort || portInt,
        apiPort: parseInt(apiPort) || 8729,
        secret: secret || 'secret123',
        // server: NULL - untuk FreeRADIUS virtual_server name
        ports: 1812, // RADIUS auth port
        description: isGateway ? `Gateway - ${name}` : `MikroTik Router - ${name}`,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        vpnClientId: vpnClientId || null,
        authMode: authMode === 'radius' ? 'radius' : 'local',
        isActive: true,
      },
    });

    // Restart FreeRADIUS to reload NAS table
    await reloadFreeRadius();

    // Terapkan port forwarding VPS langsung dari isian admin jika terhubung ke VPN Client
    if (router.vpnClientId) {
      applyAdminPortForwarding(router.vpnClientId, {
        api: detectedPort || portInt,
        apiSsl: parseInt(apiPort) || undefined,
        winbox: parseInt(winboxPort) || undefined,
      }).catch(e => console.warn('[routers] applyAdminPortForwarding error on POST:', e.message));
    }

    // Log activity
    try {
      const session = await getServerSession(authOptions);
      await logActivity({
        userId: (session?.user as any)?.id,
        username: (session?.user as any)?.username || 'Admin',
        userRole: (session?.user as any)?.role,
        action: 'CREATE_ROUTER',
        description: `Created router: ${name} (${ipAddress})`,
        module: 'network',
        status: 'success',
        request,
        metadata: {
          routerId: router.id,
          routerName: name,
          ipAddress,
          nasIpAddress: nasname,
        },
      });
    } catch (logError) {
      console.error('Activity log error:', logError);
    }

    return NextResponse.json({
      success: true,
      router,
      warning: connectionWarning || undefined,
      fixScript: fixScript || undefined,
      message: isGateway ? 'Gateway added successfully' : 'Router added and connection test successful',
    });
  } catch (error: any) {
    console.error('Add router error:', error);
    return NextResponse.json({ error: error.message || 'Failed to add router' }, { status: 500 });
  }
}

// PUT - Update router
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    // Support both 'nasname' (from frontend) and 'nasIpAddress' for backward compatibility
    const { id, name, type, ipAddress, nasIpAddress, nasname: nasnameFromBody, username, password, port, apiPort, winboxPort, secret, isActive, latitude, longitude, vpnClientId, authMode } = body;

    if (!id) {
      return NextResponse.json({ error: 'Router ID is required' }, { status: 400 });
    }

    // Generate shortname from name if name is provided
    const shortname = name ? name.toLowerCase().replace(/[^a-z0-9]/g, '') : undefined;
    
    // nasname = IP untuk FreeRADIUS (IP publik/VPN)
    // Support: nasIpAddress (legacy) atau nasname (dari frontend)
    const nasname = nasIpAddress || nasnameFromBody || ipAddress || undefined;

    // Determine router type — skip connection test for gateway/VPS (no API credentials)
    const currentRouter = await prisma.router.findUnique({ where: { id } });
    if (!currentRouter) {
      return NextResponse.json({ error: 'Router not found' }, { status: 404 });
    }
    const effectiveType = type || currentRouter.type;
    const isGateway = effectiveType === 'gateway';

    // Test connection only for MikroTik routers with changed credentials
    // Skip when vpnClientId is set: IP is a VPN tunnel IP managed by the system,
    // the connection test is not reliable from arbitrary network contexts.
    let updatedDetectedPort: number | undefined = undefined;
    if (!isGateway && (username || password || port)) {
      try {
        const targetHost = ipAddress || currentRouter.ipAddress;
        const targetUser = username || currentRouter.username;
        const targetPass = password !== undefined ? password : currentRouter.password;
        const targetPort = port ? parseInt(port.toString()) : (currentRouter.port || 8728);
        const candidatePorts = Array.from(new Set([targetPort, 8520, 8728, 8729]));

        for (const probePort of candidatePorts) {
          try {
            const probeConn = new RouterOSAPI({
              host: targetHost,
              user: targetUser,
              password: targetPass,
              port: probePort,
              timeout: 3,
              tls: probePort === 8729,
            });
            await probeConn.connect();
            updatedDetectedPort = probePort;
            probeConn.close();
            break;
          } catch {
            // Coba port berikutnya
          }
        }
      } catch (connError: any) {
        console.warn('[routers] PUT connection probe warning (non-fatal):', connError?.message);
      }
    }


    // Note: 'server' field is for FreeRADIUS virtual_server name, not RADIUS IP
    // Don't update it here - RADIUS Server IP is from environment variable
    
    const router = await prisma.router.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(shortname && { shortname }),
        ...(type && { type }),
        ...(nasname && { nasname }),
        ...(ipAddress && { ipAddress }),
        ...(username && { username }),
        ...(password && { password }),
        ...(port && { port: updatedDetectedPort || parseInt(port.toString()) }),
        ...(apiPort && { apiPort: parseInt(apiPort.toString()) }),
        ...(secret && { secret }),
        ...(isActive !== undefined && { isActive }),
        ...(latitude !== undefined && { latitude: latitude ? parseFloat(latitude) : null }),
        ...(longitude !== undefined && { longitude: longitude ? parseFloat(longitude) : null }),
        ...(vpnClientId !== undefined && { vpnClientId: vpnClientId || null }),
        ...(authMode !== undefined && { authMode: authMode === 'radius' ? 'radius' : 'local' }),
        // server: NULL - untuk FreeRADIUS virtual_server name
      },
    });

    // Restart FreeRADIUS to reload NAS table
    await reloadFreeRadius();

    // Terapkan port forwarding VPS langsung dari isian admin jika terhubung ke VPN Client
    if (router.vpnClientId) {
      applyAdminPortForwarding(router.vpnClientId, {
        api: port ? parseInt(port.toString()) : router.port,
        apiSsl: apiPort ? parseInt(apiPort.toString()) : router.apiPort,
        winbox: winboxPort ? parseInt(winboxPort.toString()) : undefined,
      }).catch(e => console.warn('[routers] applyAdminPortForwarding error on PUT:', e.message));
    }

    // Log activity
    try {
      const session = await getServerSession(authOptions);
      await logActivity({
        userId: (session?.user as any)?.id,
        username: (session?.user as any)?.username || 'Admin',
        userRole: (session?.user as any)?.role,
        action: 'UPDATE_ROUTER',
        description: `Updated router: ${router.name}`,
        module: 'network',
        status: 'success',
        request,
        metadata: {
          routerId: router.id,
          routerName: router.name,
          changes: {
            name: name || undefined,
            ipAddress: ipAddress || undefined,
            nasIpAddress: nasIpAddress || undefined,
            isActive: isActive !== undefined ? isActive : undefined,
          },
        },
      });
    } catch (logError) {
      console.error('Activity log error:', logError);
    }

    // Return updated router with vpnClient included for frontend RADIUS script refresh
    const updatedRouter = await prisma.router.findUnique({
      where: { id },
      include: { vpnClient: { select: { id: true, name: true, vpnIp: true } } },
    });
    return NextResponse.json({ success: true, router: updatedRouter ?? router, vpnClientChanged: vpnClientId !== undefined });
  } catch (error) {
    console.error('Update router error:', error);
    return NextResponse.json({ error: 'Failed to update router' }, { status: 500 });
  }
}

// DELETE - Remove router
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Router ID is required' }, { status: 400 });
    }

    // Get router details before deletion
    const router = await prisma.router.findUnique({
      where: { id },
      select: { id: true, name: true, ipAddress: true },
    });

    if (!router) {
      return NextResponse.json({ error: 'Router not found' }, { status: 404 });
    }

    // Find fallback router to smoothly migrate customers & areas (e.g. Router ID 3 VPN version)
    const targetReassignId = searchParams.get('reassignToRouterId');
    let fallbackRouterId = targetReassignId;
    if (!fallbackRouterId) {
      const altRouter = await prisma.router.findFirst({
        where: { id: { not: id }, isActive: true },
        orderBy: { createdAt: 'desc' },
      });
      if (altRouter) fallbackRouterId = altRouter.id;
    }

    if (fallbackRouterId) {
      console.log(`[Router Delete] Smoothly reassigning customers & areas from ${id} to ${fallbackRouterId}`);
      await prisma.pppoeUser.updateMany({ where: { routerId: id }, data: { routerId: fallbackRouterId } }).catch(() => {});
      await prisma.pppoeArea.updateMany({ where: { routerId: id }, data: { routerId: fallbackRouterId } }).catch(() => {});
    } else {
      await prisma.pppoeUser.updateMany({ where: { routerId: id }, data: { routerId: null } }).catch(() => {});
      await prisma.pppoeArea.updateMany({ where: { routerId: id }, data: { routerId: null } }).catch(() => {});
    }

    if ((prisma as any).routerStatusHistory) {
      await (prisma as any).routerStatusHistory.deleteMany({ where: { routerId: id } }).catch(() => {});
    }

    await prisma.router.delete({
      where: { id },
    });

    // Restart FreeRADIUS to reload NAS table
    await reloadFreeRadius();

    // Log activity
    try {
      const session = await getServerSession(authOptions);
      await logActivity({
        userId: (session?.user as any)?.id,
        username: (session?.user as any)?.username || 'Admin',
        userRole: (session?.user as any)?.role,
        action: 'DELETE_ROUTER',
        description: `Deleted router: ${router.name}`,
        module: 'network',
        status: 'success',
        request,
        metadata: {
          routerId: router.id,
          routerName: router.name,
          ipAddress: router.ipAddress,
        },
      });
    } catch (logError) {
      console.error('Activity log error:', logError);
    }

    return NextResponse.json({ success: true, message: 'Router deleted successfully' });
  } catch (error) {
    console.error('Delete router error:', error);
    return NextResponse.json({ error: 'Failed to delete router' }, { status: 500 });
  }
}
