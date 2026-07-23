import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { checkAuth } from '@/server/middleware/api-auth';

export const dynamic = 'force-dynamic';

// GET /api/admin/work-orders — List all work orders with filters
export async function GET(req: Request) {
  try {
    const auth = await checkAuth(req);
    if (!auth.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const technicianId = searchParams.get('technicianId');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    const where: any = {};

    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (technicianId) where.technicianId = technicianId;

    if (search) {
      where.OR = [
        { customerName: { contains: search } },
        { customerPhone: { contains: search } },
        { customerAddress: { contains: search } },
        { description: { contains: search } },
        { issueType: { contains: search } },
      ];
    }

    const [workOrders, total] = await Promise.all([
      prisma.workOrder.findMany({
        where,
        include: {
          technician: {
            select: { id: true, name: true, phoneNumber: true, username: true },
          },
          customer: {
            select: { id: true, name: true, username: true, customerId: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.workOrder.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      workOrders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[API Admin WorkOrders GET Error]:', error);
    return NextResponse.json({ error: 'Gagal mengambil data Surat Tugas' }, { status: 500 });
  }
}

// POST /api/admin/work-orders — Create a new Work Order (SPK)
export async function POST(req: Request) {
  try {
    const auth = await checkAuth(req);
    if (!auth.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      linkedUserId,
      customerName,
      customerPhone,
      customerAddress,
      issueType = 'INSTALLATION',
      description,
      priority = 'MEDIUM',
      technicianId,
      scheduledDate,
      notes,
    } = body;

    if (!customerName || !customerPhone || !customerAddress) {
      return NextResponse.json(
        { error: 'Nama, telepon, dan alamat pelanggan wajib diisi' },
        { status: 400 }
      );
    }

    const status = technicianId ? 'ASSIGNED' : 'OPEN';

    const newWorkOrder = await prisma.workOrder.create({
      data: {
        linkedUserId: linkedUserId || null,
        customerName,
        customerPhone,
        customerAddress,
        issueType,
        description: description || `Pekerjaan ${issueType.replace('_', ' ')} untuk ${customerName}`,
        priority,
        status,
        technicianId: technicianId || null,
        scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
        assignedAt: technicianId ? new Date() : null,
        notes: notes || null,
      },
      include: {
        technician: { select: { id: true, name: true, phoneNumber: true } },
      },
    });

    return NextResponse.json({
      success: true,
      workOrder: newWorkOrder,
      message: 'Surat Tugas (SPK) berhasil diterbitkan!',
    });
  } catch (error) {
    console.error('[API Admin WorkOrders POST Error]:', error);
    return NextResponse.json({ error: 'Gagal membuat Surat Tugas' }, { status: 500 });
  }
}
