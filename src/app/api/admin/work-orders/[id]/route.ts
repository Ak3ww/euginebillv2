import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { checkAuth } from '@/server/middleware/api-auth';

export const dynamic = 'force-dynamic';

// GET /api/admin/work-orders/[id] — Detail SPK with report & photos
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await checkAuth(req);
    if (!auth.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workOrder = await prisma.workOrder.findUnique({
      where: { id: params.id },
      include: {
        technician: { select: { id: true, name: true, phoneNumber: true, username: true } },
        customer: { select: { id: true, name: true, username: true, customerId: true, address: true, phone: true } },
      },
    });

    if (!workOrder) {
      return NextResponse.json({ error: 'Surat Tugas tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json({ success: true, workOrder });
  } catch (error) {
    console.error('[API Admin WorkOrders GET ID Error]:', error);
    return NextResponse.json({ error: 'Gagal mengambil detail Surat Tugas' }, { status: 500 });
  }
}

// PUT /api/admin/work-orders/[id] — Update SPK (Assign technician, status, notes)
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await checkAuth(req);
    if (!auth.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { technicianId, status, priority, description, notes, scheduledDate } = body;

    const existing = await prisma.workOrder.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ error: 'Surat Tugas tidak ditemukan' }, { status: 404 });
    }

    const updateData: any = {};
    if (priority !== undefined) updateData.priority = priority;
    if (description !== undefined) updateData.description = description;
    if (notes !== undefined) updateData.notes = notes;
    if (scheduledDate !== undefined) updateData.scheduledDate = scheduledDate ? new Date(scheduledDate) : null;

    if (technicianId !== undefined) {
      updateData.technicianId = technicianId || null;
      if (technicianId && !existing.technicianId) {
        updateData.assignedAt = new Date();
        if (existing.status === 'OPEN') updateData.status = 'ASSIGNED';
      }
    }

    if (status !== undefined) {
      updateData.status = status;
      if (status === 'COMPLETED' && !existing.completedAt) {
        updateData.completedAt = new Date();
      }
    }

    const updated = await prisma.workOrder.update({
      where: { id: params.id },
      data: updateData,
      include: {
        technician: { select: { id: true, name: true, phoneNumber: true } },
        customer: true,
      },
    });

    // If status changed to COMPLETED, trigger auto-billing WhatsApp notification
    if (status === 'COMPLETED' && existing.status !== 'COMPLETED' && updated.linkedUserId) {
      const invoice = await prisma.invoice.findFirst({
        where: { userId: updated.linkedUserId, status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
      });

      if (invoice && updated.customer) {
        const company = await prisma.company.findFirst();
        const { sendInvoiceReminder } = await import('@/server/services/notifications/whatsapp-templates.service');
        await sendInvoiceReminder({
          phone: updated.customer.phone,
          customerName: updated.customer.name,
          customerId: updated.customer.customerId,
          customerUsername: updated.customer.username,
          invoiceNumber: invoice.invoiceNumber,
          amount: invoice.amount,
          dueDate: invoice.dueDate,
          paymentLink: invoice.paymentToken ? `${process.env.NEXT_PUBLIC_APP_URL}/pay/${invoice.paymentToken}` : '',
          companyName: company?.name || 'ISP',
          companyPhone: company?.phone || '',
        }).catch((e) => console.error('Failed to send WA Invoice on admin completion:', e));
      }
    }

    return NextResponse.json({
      success: true,
      workOrder: updated,
      message: 'Surat Tugas berhasil diperbarui',
    });
  } catch (error) {
    console.error('[API Admin WorkOrders PUT Error]:', error);
    return NextResponse.json({ error: 'Gagal memperbarui Surat Tugas' }, { status: 500 });
  }
}

// DELETE /api/admin/work-orders/[id] — Hapus / Batalkan SPK
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await checkAuth(req);
    if (!auth.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await prisma.workOrder.delete({ where: { id: params.id } });

    return NextResponse.json({ success: true, message: 'Surat Tugas telah dihapus' });
  } catch (error) {
    console.error('[API Admin WorkOrders DELETE Error]:', error);
    return NextResponse.json({ error: 'Gagal menghapus Surat Tugas' }, { status: 500 });
  }
}
