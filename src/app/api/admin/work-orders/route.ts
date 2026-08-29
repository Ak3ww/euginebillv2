import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { checkAuth } from '@/server/middleware/api-auth';

export const dynamic = 'force-dynamic';

// GET /api/admin/work-orders — List all work orders with filters
export async function GET(req: Request) {
  try {
    const auth = await checkAuth();
    if (!auth.authorized) {
      return auth.response;
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
            select: { 
              id: true, 
              name: true, 
              username: true, 
              customerId: true,
              invoices: {
                select: { id: true, invoiceNumber: true, status: true },
              }
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.workOrder.count({ where }),
    ]);

    const formattedWorkOrders = workOrders.map(wo => ({
      ...wo,
      hasInvoice: wo.customer?.invoices && wo.customer.invoices.length > 0,
    }));

    return NextResponse.json({
      success: true,
      workOrders: formattedWorkOrders,
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
    const auth = await checkAuth();
    if (!auth.authorized) {
      return auth.response;
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

    // Auto-resolve linkedUserId if not explicitly provided
    let finalLinkedUserId = linkedUserId || null;
    if (!finalLinkedUserId && (customerPhone || customerName)) {
      const cleanPhone = customerPhone.replace(/\D/g, '');
      const phoneVariations = cleanPhone ? [
        cleanPhone,
        '0' + cleanPhone.replace(/^62/, ''),
        '62' + cleanPhone.replace(/^0/, ''),
      ] : [];

      const matchedUser = await prisma.pppoeUser.findFirst({
        where: {
          OR: [
            ...(phoneVariations.length > 0 ? [{ phone: { in: phoneVariations } }] : []),
            { name: { equals: customerName.trim() } },
          ],
        },
        select: { id: true },
      });
      if (matchedUser) {
        finalLinkedUserId = matchedUser.id;
      }
    }

    const status = technicianId ? 'ASSIGNED' : 'OPEN';

    const newWorkOrder = await prisma.workOrder.create({
      data: {
        linkedUserId: finalLinkedUserId,
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
