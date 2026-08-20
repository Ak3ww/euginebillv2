import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { checkAuth } from '@/server/middleware/api-auth';

export const dynamic = 'force-dynamic';

// POST /api/admin/routers/merge-cibinong
export async function POST(req: Request) {
  try {
    const auth = await checkAuth(req);
    if (!auth.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const routers = await prisma.router.findMany({
      orderBy: { createdAt: 'asc' }
    });

    if (routers.length < 2) {
      return NextResponse.json({
        message: 'Tidak ditemukan 2 router untuk digabungkan.',
        routers
      });
    }

    // Find router 1 (old) and router 3 (new VPN)
    const oldRouter = routers.find(r => r.ipAddress === '103.157.79.178' || r.nasname === '103.157.79.178') || routers[0];
    const newRouter = routers.find(r => r.id !== oldRouter.id && (r.ipAddress.startsWith('10.') || r.name.toLowerCase().includes('vpn'))) || routers[routers.length - 1];

    if (!oldRouter || !newRouter || oldRouter.id === newRouter.id) {
      return NextResponse.json({ error: 'Tidak dapat menemukan pasangan router lama & baru.', routers });
    }

    console.log([Merge Router] Copying config from newRouter () into oldRouter ());

    // 1. Update oldRouter (ID 1) with config from newRouter (ID 3)
    await prisma.router.update({
      where: { id: oldRouter.id },
      data: {
        name: newRouter.name,
        ipAddress: newRouter.ipAddress,
        nasname: newRouter.nasname,
        shortname: newRouter.shortname,
        type: newRouter.type,
        ports: newRouter.ports,
        secret: newRouter.secret,
        apiUsername: newRouter.apiUsername,
        apiPassword: newRouter.apiPassword,
        apiPort: newRouter.apiPort,
        vpnClientId: newRouter.vpnClientId,
        isActive: true,
      }
    });

    // 2. Reassign all users & areas from newRouter (ID 3) to oldRouter (ID 1)
    const usersUpdated = await prisma.pppoeUser.updateMany({
      where: { routerId: newRouter.id },
      data: { routerId: oldRouter.id }
    });

    const areasUpdated = await prisma.pppoeArea.updateMany({
      where: { routerId: newRouter.id },
      data: { routerId: oldRouter.id }
    });

    // Reassign unassigned users as well
    const unassignedUpdated = await prisma.pppoeUser.updateMany({
      where: { OR: [{ routerId: null }, { routerId: '' }] },
      data: { routerId: oldRouter.id }
    });

    // 3. Delete newRouter (ID 3)
    if ((prisma as any).routerStatusHistory) {
      await (prisma as any).routerStatusHistory.deleteMany({ where: { routerId: newRouter.id } }).catch(() => {});
    }

    await prisma.router.delete({
      where: { id: newRouter.id }
    });

    return NextResponse.json({
      success: true,
      message: Berhasil menggabungkan Router! Pengaturan VPN telah dipindahkan ke Router ID 1 (), dan Router ID 3 telah dihapus.,
      keptRouterId: oldRouter.id,
      deletedRouterId: newRouter.id,
      migratedUsers: usersUpdated.count + unassignedUpdated.count,
      migratedAreas: areasUpdated.count
    });

  } catch (error: any) {
    console.error('[API Merge Cibinong Error]:', error);
    return NextResponse.json({ error: 'Gagal merge router: ' + error?.message }, { status: 500 });
  }
}

// GET - Trigger merge directly via browser or curl
export async function GET(req: Request) {
  return POST(req);
}
