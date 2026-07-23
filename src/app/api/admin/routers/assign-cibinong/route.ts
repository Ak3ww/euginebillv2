import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { checkAuth } from '@/server/middleware/api-auth';

export const dynamic = 'force-dynamic';

// POST /api/admin/routers/assign-cibinong
export async function POST(req: Request) {
  try {
    const auth = await checkAuth(req);
    if (!auth.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { targetRouterId } = body;

    // Find routers
    const routers = await prisma.router.findMany({
      select: { id: true, name: true, ipAddress: true }
    });

    let selectedRouter = null;

    if (targetRouterId) {
      selectedRouter = routers.find(r => r.id === targetRouterId);
    } else {
      // Auto-detect router named "Cibinong"
      selectedRouter = routers.find(r =>
        r.name.toLowerCase().includes('cibinong') ||
        r.name.toLowerCase().includes('cbn')
      ) || routers[0]; // fallback to first router if only 1 router added
    }

    if (!selectedRouter) {
      return NextResponse.json({
        error: 'Router Cibinong tidak ditemukan di database. Pastikan router sudah ditambahkan di menu Router Mikrotik.',
        routers
      }, { status: 404 });
    }

    // Count unassigned users
    const unassignedCount = await prisma.pppoeUser.count({
      where: {
        OR: [
          { routerId: null },
          { routerId: '' }
        ]
      }
    });

    if (unassignedCount === 0) {
      return NextResponse.json({
        success: true,
        message: 'Semua pelanggan sudah memiliki router masing-masing. Tidak ada data pelanggan yang perlu dipindah.',
        updatedCount: 0,
        router: selectedRouter
      });
    }

    // Bulk update unassigned users to target router
    const updateResult = await prisma.pppoeUser.updateMany({
      where: {
        OR: [
          { routerId: null },
          { routerId: '' }
        ]
      },
      data: {
        routerId: selectedRouter.id
      }
    });

    return NextResponse.json({
      success: true,
      message: `Berhasil menetapkan ${updateResult.count} pelanggan tanpa router ke Router "${selectedRouter.name}" (${selectedRouter.ipAddress}). Pelanggan yang sudah ada router (Citeureup) tetap utuh.`,
      updatedCount: updateResult.count,
      router: selectedRouter
    });
  } catch (error) {
    console.error('[API Assign Cibinong Error]:', error);
    return NextResponse.json({ error: 'Gagal memindahkan pelanggan ke Router Cibinong' }, { status: 500 });
  }
}
