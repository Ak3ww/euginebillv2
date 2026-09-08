import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';
import { prisma } from '@/server/db/client';
import { generateManualInvoiceNumber } from '@/server/services/billing/invoice.service';
import { nanoid } from 'nanoid';
import { startOfDayWIBtoUTC, endOfDayWIBtoUTC } from '@/lib/timezone';
import { ok, created, badRequest, unauthorized, serverError } from '@/lib/api-response';

interface InvoiceItem {
  description: string;
  qty: number;
  unitPrice: number;
  total: number;
}

// GET - List all manual invoices
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorized();

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    const where: any = {};

    if (status && status !== 'all') {
      where.status = status;
    }

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { invoiceNumber: { contains: q } },
        { recipientName: { contains: q } },
        { recipientPhone: { contains: q } },
        { notes: { contains: q } },
      ];
    }

    if (startDate && endDate) {
      where.createdAt = {
        gte: startOfDayWIBtoUTC(startDate),
        lte: endOfDayWIBtoUTC(endDate),
      };
    }

    const [invoices, total] = await Promise.all([
      prisma.manualInvoice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.manualInvoice.count({ where }),
    ]);

    // Summary stats (always across all records, not filtered)
    const [pendingStats, paidStats, cancelledStats] = await Promise.all([
      prisma.manualInvoice.aggregate({
        where: { status: 'PENDING' },
        _count: { id: true },
        _sum: { totalAmount: true },
      }),
      prisma.manualInvoice.aggregate({
        where: { status: 'PAID' },
        _count: { id: true },
        _sum: { totalAmount: true },
      }),
      prisma.manualInvoice.aggregate({
        where: { status: 'CANCELLED' },
        _count: { id: true },
        _sum: { totalAmount: true },
      }),
    ]);

    const stats = {
      pendingCount: pendingStats._count.id,
      pendingAmount: pendingStats._sum.totalAmount || 0,
      paidCount: paidStats._count.id,
      paidAmount: paidStats._sum.totalAmount || 0,
      cancelledCount: cancelledStats._count.id,
    };

    return ok({
      invoices,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      stats,
    });
  } catch (error) {
    console.error('GET /api/manual-invoices error:', error);
    return serverError('Failed to fetch manual invoices');
  }
}

// POST - Create a new manual invoice
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorized();

  try {
    const body = await request.json();
    const {
      recipientName,
      recipientPhone,
      recipientAddress,
      items,
      discountAmount = 0,
      notes,
    } = body;

    if (!recipientName || !recipientName.trim()) {
      return badRequest('Nama penerima wajib diisi');
    }

    if (!Array.isArray(items) || items.length === 0) {
      return badRequest('Minimal 1 item harus diisi');
    }

    // Validate items and compute totals
    const parsedItems: InvoiceItem[] = items.map((item: any, idx: number) => {
      const qty = Number(item.qty);
      const unitPrice = Number(item.unitPrice);
      if (!item.description?.trim()) {
        throw new Error(`Item ${idx + 1}: deskripsi wajib diisi`);
      }
      if (isNaN(qty) || qty <= 0) throw new Error(`Item ${idx + 1}: qty tidak valid`);
      if (isNaN(unitPrice) || unitPrice < 0) throw new Error(`Item ${idx + 1}: harga tidak valid`);
      return {
        description: item.description.trim(),
        qty,
        unitPrice,
        total: qty * unitPrice,
      };
    });

    const subtotal = parsedItems.reduce((sum, i) => sum + i.total, 0);
    const discount = Math.max(0, Number(discountAmount) || 0);
    const totalAmount = Math.max(0, subtotal - discount);

    const invoiceNumber = generateManualInvoiceNumber();

    const invoice = await prisma.manualInvoice.create({
      data: {
        id: nanoid(),
        invoiceNumber,
        recipientName: recipientName.trim(),
        recipientPhone: recipientPhone?.trim() || null,
        recipientAddress: recipientAddress?.trim() || null,
        items: parsedItems as any,
        subtotal,
        discountAmount: discount,
        totalAmount,
        notes: notes?.trim() || null,
        createdBy: session.user?.email || null,
        updatedAt: new Date(),
      },
    });

    return created({ invoice });
  } catch (error: any) {
    console.error('POST /api/manual-invoices error:', error);
    if (error?.message) return badRequest(error.message);
    return serverError('Failed to create manual invoice');
  }
}
