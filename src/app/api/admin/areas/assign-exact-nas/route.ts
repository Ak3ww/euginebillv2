import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';

export async function GET(request: NextRequest) {
  return handleAssign(request);
}

export async function POST(request: NextRequest) {
  return handleAssign(request);
}

async function handleAssign(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const routers = await prisma.router.findMany({
      select: { id: true, name: true, nasname: true, shortname: true }
    });

    if (routers.length === 0) {
      return NextResponse.json({ error: 'Tidak ada Router/NAS di database' }, { status: 400 });
    }

    // Find Citeureup & Cibinong routers
    const citeureupRouter = routers.find(r => 
      r.name.toUpperCase().includes('CITEUREUP') || 
      r.shortname.toUpperCase().includes('CITEUREUP')
    ) || routers[0];

    const cibinongRouter = routers.find(r => 
      r.name.toUpperCase().includes('CIBINONG') || 
      r.shortname.toUpperCase().includes('CIBINONG')
    ) || routers.find(r => r.id !== citeureupRouter.id) || routers[0];

    const areas = await prisma.pppoeArea.findMany();

    const results = [];

    for (const area of areas) {
      const isTegal = area.name.toUpperCase().includes('TEGAL');
      const targetRouter = isTegal ? citeureupRouter : cibinongRouter;

      // Update area's routerId
      await prisma.pppoeArea.update({
        where: { id: area.id },
        data: { routerId: targetRouter.id }
      });

      // Update all users in this area to match area's routerId
      const userUpdateResult = await prisma.pppoeUser.updateMany({
        where: { areaId: area.id },
        data: { routerId: targetRouter.id }
      });

      results.push({
        areaId: area.id,
        areaName: area.name,
        assignedNasName: targetRouter.name,
        assignedNasId: targetRouter.id,
        usersUpdatedCount: userUpdateResult.count
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Berhasil mengaitkan NAS ke semua Wilayah & Pelanggan',
      routersFound: routers.map(r => ({ id: r.id, name: r.name })),
      assignments: results
    });

  } catch (error: any) {
    console.error('Assign exact NAS error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
