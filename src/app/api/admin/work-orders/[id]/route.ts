import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { checkAuth } from '@/server/middleware/api-auth';

export const dynamic = 'force-dynamic';

// GET /api/admin/work-orders/[id] — Detail SPK with report & photos
export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const { id } = params;

    const auth = await checkAuth();
    if (!auth.authorized) {
      return auth.response;
    }

    const workOrder = await prisma.workOrder.findUnique({
      where: { id },
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
export async function PUT(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const { id } = params;

    const auth = await checkAuth();
    if (!auth.authorized) {
      return auth.response;
    }

    const body = await req.json();
    const { 
      customerName, customerPhone, customerAddress, issueType,
      technicianId, status, priority, description, notes, scheduledDate 
    } = body;

    const existing = await prisma.workOrder.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Surat Tugas tidak ditemukan' }, { status: 404 });
    }

    const updateData: any = {};
    if (customerName !== undefined) updateData.customerName = customerName;
    if (customerPhone !== undefined) updateData.customerPhone = customerPhone;
    if (customerAddress !== undefined) updateData.customerAddress = customerAddress;
    if (issueType !== undefined) updateData.issueType = issueType;
    if (priority !== undefined) updateData.priority = priority;
    if (description !== undefined) updateData.description = description;
    if (notes !== undefined) updateData.notes = notes;
    if (scheduledDate !== undefined) updateData.scheduledDate = scheduledDate ? new Date(scheduledDate) : null;
    if (body.reportPhotos !== undefined) updateData.reportPhotos = body.reportPhotos;
    if (body.reportData !== undefined) updateData.reportData = body.reportData;

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
    // Auto-sync updated customerPhone or customerName to linked pppoeUser and unpaid invoices
    if (existing.linkedUserId && (customerPhone !== undefined || customerName !== undefined)) {
      await prisma.pppoeUser.update({
        where: { id: existing.linkedUserId },
        data: {
          ...(customerPhone !== undefined && { phone: customerPhone }),
          ...(customerName !== undefined && { name: customerName }),
        },
      }).catch(() => {});

      await prisma.invoice.updateMany({
        where: { userId: existing.linkedUserId, status: { in: ['PENDING', 'OVERDUE'] } },
        data: {
          ...(customerPhone !== undefined && { customerPhone }),
          ...(customerName !== undefined && { customerName }),
        },
      }).catch(() => {});
    }

    const updated = await prisma.workOrder.update({
      where: { id },
      data: updateData,
      include: {
        technician: { select: { id: true, name: true, phoneNumber: true } },
        customer: true,
      },
    });

    // If status changed to COMPLETED, trigger auto-billing WhatsApp notification
    if (status === 'COMPLETED' && existing.status !== 'COMPLETED') {
      let invoice = null;
      if (updated.linkedUserId) {
        invoice = await prisma.invoice.findFirst({
          where: { userId: updated.linkedUserId, status: { in: ['PENDING', 'OVERDUE'] } },
          include: { user: { include: { profile: true, area: true } } },
          orderBy: { createdAt: 'desc' },
        });
      }

      if (!invoice && (updated.customerPhone || existing.customerPhone)) {
        const phone = updated.customerPhone || existing.customerPhone;
        invoice = await prisma.invoice.findFirst({
          where: {
            OR: [
              { customerPhone: phone },
              { user: { phone } },
            ],
            status: { in: ['PENDING', 'OVERDUE'] },
          },
          include: { user: { include: { profile: true, area: true } } },
          orderBy: { createdAt: 'desc' },
        });
      }

      if (invoice) {
        const company = await prisma.company.findFirst();
        const appBaseUrl = company?.baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://euginemediagroup.com';

        let paymentLink = invoice.paymentLink || '';
        let paymentToken = invoice.paymentToken || '';
        if (!paymentLink || !paymentToken) {
          const { randomBytes } = await import('crypto');
          paymentToken = paymentToken || randomBytes(32).toString('hex');
          paymentLink = `${appBaseUrl}/pay/${paymentToken}`;
          await prisma.invoice.update({
            where: { id: invoice.id },
            data: { paymentLink, paymentToken },
          }).catch(() => {});
        }

        const targetPhone = updated.customer?.phone || updated.customerPhone || invoice.customerPhone || invoice.user?.phone;
        const targetCustomerName = updated.customer?.name || updated.customerName || invoice.customerName || invoice.user?.name || 'Pelanggan';
        const targetCustomerId = updated.customer?.customerId || invoice.user?.customerId || undefined;
        const targetUsername = updated.customer?.username || invoice.customerUsername || invoice.user?.username || undefined;
        const profileName = invoice.user?.profile?.name || '-';
        const areaName = invoice.user?.area?.name || '-';

        if (targetPhone) {
          try {
            const { sendInvoiceReminder } = await import('@/server/services/notifications/whatsapp-templates.service');
            await sendInvoiceReminder({
              phone: targetPhone,
              customerName: targetCustomerName,
              customerId: targetCustomerId,
              customerUsername: targetUsername,
              profileName,
              area: areaName,
              invoiceNumber: invoice.invoiceNumber,
              amount: invoice.amount,
              dueDate: invoice.dueDate,
              paymentLink,
              companyName: company?.name || 'ISP',
              companyPhone: company?.phone || '',
            });

            await prisma.invoice.update({
              where: { id: invoice.id },
              data: {
                waNotifiedAt: new Date(),
                waRetryCount: { increment: 1 },
              },
            }).catch(() => {});
          } catch (e) {
            console.error('Failed to send WA Invoice on admin completion:', e);
          }
        }
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
export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const { id } = params;

    const auth = await checkAuth();
    if (!auth.authorized) {
      return auth.response;
    }

    await prisma.workOrder.delete({ where: { id } });

    return NextResponse.json({ success: true, message: 'Surat Tugas telah dihapus' });
  } catch (error) {
    console.error('[API Admin WorkOrders DELETE Error]:', error);
    return NextResponse.json({ error: 'Gagal menghapus Surat Tugas' }, { status: 500 });
  }
}
