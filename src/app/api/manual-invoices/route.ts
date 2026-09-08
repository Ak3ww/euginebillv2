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

// Auto-heal / Ensure manual_invoices table exists
async function ensureManualInvoiceTable() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`manual_invoices\` (
        \`id\` VARCHAR(191) NOT NULL,
        \`invoiceNumber\` VARCHAR(191) NOT NULL,
        \`recipientName\` VARCHAR(191) NOT NULL,
        \`recipientPhone\` VARCHAR(191) NULL,
        \`recipientAddress\` TEXT NULL,
        \`items\` JSON NOT NULL,
        \`subtotal\` INT NOT NULL,
        \`discountAmount\` INT NOT NULL DEFAULT 0,
        \`totalAmount\` INT NOT NULL,
        \`status\` ENUM('PENDING', 'PAID', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
        \`notes\` TEXT NULL,
        \`paidAt\` DATETIME(3) NULL,
        \`transactionId\` VARCHAR(191) NULL,
        \`createdBy\` VARCHAR(191) NULL,
        \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`manual_invoices_invoiceNumber_key\` (\`invoiceNumber\`),
        INDEX \`manual_invoices_status_idx\` (\`status\`),
        INDEX \`manual_invoices_createdAt_idx\` (\`createdAt\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  } catch (e: any) {
    console.error('[ensureManualInvoiceTable] warning:', e?.message);
  }
}

// GET - List all manual invoices
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorized();

  await ensureManualInvoiceTable();

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
      pendingCount: pendingStats._count.id || 0,
      pendingAmount: pendingStats._sum.totalAmount || 0,
      paidCount: paidStats._count.id || 0,
      paidAmount: paidStats._sum.totalAmount || 0,
      cancelledCount: cancelledStats._count.id || 0,
    };

    return ok({
      invoices,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      stats,
    });
  } catch (error: any) {
    console.error('GET /api/manual-invoices error:', error);
    return serverError(error?.message || 'Failed to fetch manual invoices');
  }
}

// POST - Create a new manual invoice
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorized();

  await ensureManualInvoiceTable();

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

    const rawItems = Array.isArray(items) ? items : [];
    // Lenient filter: ignore completely empty rows instead of failing
    const validRawItems = rawItems.filter(
      (item: any) => item && typeof item.description === 'string' && item.description.trim() !== ''
    );

    if (validRawItems.length === 0) {
      return badRequest('Minimal 1 item dengan nama / deskripsi harus diisi');
    }

    // Validate items and compute totals
    const parsedItems: InvoiceItem[] = validRawItems.map((item: any) => {
      const qty = Math.max(1, parseInt(String(item.qty)) || 1);
      const unitPrice = Math.max(0, parseInt(String(item.unitPrice)) || 0);
      return {
        description: item.description.trim(),
        qty,
        unitPrice,
        total: qty * unitPrice,
      };
    });

    const subtotal = parsedItems.reduce((sum, i) => sum + i.total, 0);
    const discount = Math.max(0, parseInt(String(discountAmount)) || 0);
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
    return badRequest(error?.message || 'Gagal menyimpan invoice');
  }
}

