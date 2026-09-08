import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';
import { prisma } from '@/server/db/client';
import { ok, badRequest, unauthorized, notFound, serverError } from '@/lib/api-response';

type RouteParams = { params: Promise<{ id: string }> };

// GET - Single invoice (NO auth required — public view by ID)
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const invoice = await prisma.manualInvoice.findUnique({ where: { id } });
    if (!invoice) return notFound('Invoice');

    // Fetch company info for display
    const company = await prisma.company.findFirst({
      select: { name: true, address: true, phone: true, email: true, logo: true, bankAccounts: true },
    });

    const bankAccounts = (() => {
      try {
        if (!company?.bankAccounts) return [];
        const raw = company.bankAccounts as any;
        return Array.isArray(raw) ? raw : JSON.parse(raw);
      } catch { return []; }
    })();

    return ok({
      invoice,
      company: {
        name: company?.name || 'EugineBill',
        address: company?.address || '',
        phone: company?.phone || '',
        email: company?.email || '',
        logo: company?.logo || null,
        bankAccounts,
      },
    });
  } catch (error) {
    console.error('GET /api/manual-invoices/[id] error:', error);
    return serverError('Failed to fetch invoice');
  }
}

// PUT - Update invoice (only when PENDING)
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorized();

  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.manualInvoice.findUnique({ where: { id } });
    if (!existing) return notFound('Invoice');
    if (existing.status !== 'PENDING') {
      return badRequest('Hanya invoice dengan status PENDING yang bisa diedit');
    }

    const {
      recipientName,
      recipientPhone,
      recipientAddress,
      items,
      discountAmount = 0,
      notes,
    } = body;

    if (!recipientName?.trim()) return badRequest('Nama penerima wajib diisi');
    if (!Array.isArray(items) || items.length === 0) return badRequest('Minimal 1 item harus diisi');

    const parsedItems = items.map((item: any, idx: number) => {
      const qty = Number(item.qty);
      const unitPrice = Number(item.unitPrice);
      if (!item.description?.trim()) throw new Error(`Item ${idx + 1}: deskripsi wajib diisi`);
      if (isNaN(qty) || qty <= 0) throw new Error(`Item ${idx + 1}: qty tidak valid`);
      if (isNaN(unitPrice) || unitPrice < 0) throw new Error(`Item ${idx + 1}: harga tidak valid`);
      return { description: item.description.trim(), qty, unitPrice, total: qty * unitPrice };
    });

    const subtotal = parsedItems.reduce((sum: number, i: any) => sum + i.total, 0);
    const discount = Math.max(0, Number(discountAmount) || 0);
    const totalAmount = Math.max(0, subtotal - discount);

    const updated = await prisma.manualInvoice.update({
      where: { id },
      data: {
        recipientName: recipientName.trim(),
        recipientPhone: recipientPhone?.trim() || null,
        recipientAddress: recipientAddress?.trim() || null,
        items: parsedItems as any,
        subtotal,
        discountAmount: discount,
        totalAmount,
        notes: notes?.trim() || null,
      },
    });

    return ok({ invoice: updated });
  } catch (error: any) {
    console.error('PUT /api/manual-invoices/[id] error:', error);
    if (error?.message) return badRequest(error.message);
    return serverError('Failed to update invoice');
  }
}

// DELETE - Delete invoice
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorized();

  try {
    const { id } = await params;

    const existing = await prisma.manualInvoice.findUnique({ where: { id } });
    if (!existing) return notFound('Invoice');

    await prisma.manualInvoice.delete({ where: { id } });

    return ok({ success: true, message: 'Invoice berhasil dihapus' });
  } catch (error) {
    console.error('DELETE /api/manual-invoices/[id] error:', error);
    return serverError('Failed to delete invoice');
  }
}
