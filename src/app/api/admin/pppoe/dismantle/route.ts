import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';
import { prisma } from '@/server/db/client';

// PUT — Quick toggle isDismantled status for a stopped user (Direct Admin Checklist)
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId, isDismantled, note } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const updated = await prisma.pppoeUser.update({
      where: { id: userId },
      data: {
        isDismantled: !!isDismantled,
        dismantledAt: isDismantled ? new Date() : null,
        dismantledNote: note || null,
      },
    });

    // If marked as dismantled, free ODP port if assigned
    if (isDismantled) {
      await prisma.odpCustomerAssignment.deleteMany({
        where: { customerId: userId },
      }).catch(() => {});
    }

    return NextResponse.json({ success: true, user: updated });
  } catch (error: any) {
    console.error('Update dismantle status error:', error);
    return NextResponse.json({ error: error.message || 'Failed to update dismantle status' }, { status: 500 });
  }
}

// POST — Create a DISMANTLE Work Order for a stopped user
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { userId, technicianId, scheduledDate, priority = 'MEDIUM', notes } = body;

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const user = await prisma.pppoeUser.findUnique({
      where: { id: userId },
      select: { name: true, phone: true, address: true, username: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'Pelanggan tidak ditemukan' }, { status: 404 });
    }

    const status = technicianId ? 'ASSIGNED' : 'OPEN';

    const newWorkOrder = await prisma.workOrder.create({
      data: {
        linkedUserId: userId,
        customerName: user.name,
        customerPhone: user.phone,
        customerAddress: user.address || 'Alamat tidak diisi',
        issueType: 'DISMANTLE',
        description: `SPK Penarikan Perangkat / Dismantle ONT (User: ${user.username})`,
        priority,
        status,
        technicianId: technicianId || null,
        scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
        assignedAt: technicianId ? new Date() : null,
        notes: notes || null,
      },
    });

    return NextResponse.json({ success: true, workOrder: newWorkOrder });
  } catch (error: any) {
    console.error('Create dismantle SPK error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create dismantle SPK' }, { status: 500 });
  }
}
