import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';
import { prisma } from '@/server/db/client';
import { nanoid } from 'nanoid';
import { ok, badRequest, unauthorized, notFound, serverError } from '@/lib/api-response';
import { generateCategoryId } from '@/server/services/billing/invoice.service';

type RouteParams = { params: Promise<{ id: string }> };

// POST - Tandai invoice sebagai LUNAS
export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorized();

  try {
    const { id } = await params;

    const invoice = await prisma.manualInvoice.findUnique({ where: { id } });
    if (!invoice) return notFound('Invoice');
    if (invoice.status === 'PAID') {
      return badRequest('Invoice ini sudah berstatus LUNAS');
    }
    if (invoice.status === 'CANCELLED') {
      return badRequest('Invoice yang dibatalkan tidak bisa ditandai lunas');
    }

    const now = new Date();

    // Cari atau buat kategori "Penjualan Manual"
    let category = await prisma.transactionCategory.findFirst({
      where: { name: 'Penjualan Manual', type: 'INCOME' },
    });

    if (!category) {
      category = await prisma.transactionCategory.create({
        data: {
          id: generateCategoryId(),
          name: 'Penjualan Manual',
          type: 'INCOME',
          description: 'Pemasukan dari invoice manual (penjualan perangkat, jasa, dll)',
          updatedAt: now,
        },
      });
    }

    // Buat record transaksi INCOME
    const transactionId = nanoid();
    await prisma.transaction.create({
      data: {
        id: transactionId,
        categoryId: category.id,
        type: 'INCOME',
        amount: invoice.totalAmount,
        description: `Invoice Manual - ${invoice.recipientName} (${invoice.invoiceNumber})`,
        reference: invoice.invoiceNumber,
        date: now,
        createdBy: session.user?.email || null,
        updatedAt: now,
      },
    });

    // Update invoice status ke PAID
    const updated = await prisma.manualInvoice.update({
      where: { id },
      data: {
        status: 'PAID',
        paidAt: now,
        transactionId,
      },
    });

    return ok({
      invoice: updated,
      message: `Invoice ${invoice.invoiceNumber} berhasil ditandai LUNAS. Pemasukan Rp ${invoice.totalAmount.toLocaleString('id-ID')} telah dicatat.`,
    });
  } catch (error) {
    console.error('POST /api/manual-invoices/[id]/mark-paid error:', error);
    return serverError('Failed to mark invoice as paid');
  }
}
