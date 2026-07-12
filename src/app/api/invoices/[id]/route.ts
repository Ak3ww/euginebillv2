import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';
import { prisma } from '@/server/db/client';

/**
 * PATCH /api/invoices/[id]
 * Edit invoice metadata: amount, dueDate, notes, additionalFees
 * Only allowed for PENDING or OVERDUE invoices.
 * Use negative amount in additionalFees for discounts.
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const { dueDate, notes, additionalFees } = body;

    // Fetch existing invoice
    const existing = await prisma.invoice.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Only allow editing if status is PENDING or OVERDUE
    if (!['PENDING', 'OVERDUE'].includes(existing.status)) {
      return NextResponse.json(
        { error: 'Hanya tagihan berstatus PENDING atau OVERDUE yang bisa diedit.' },
        { status: 400 }
      );
    }

    // Recalculate total amount
    // baseAmount stays the same (original invoice amount before fees)
    const base = existing.baseAmount ?? existing.amount;
    let feesTotal = 0;
    if (Array.isArray(additionalFees)) {
      feesTotal = additionalFees.reduce((sum: number, fee: { name: string; amount: number }) => {
        return sum + (Number(fee.amount) || 0);
      }, 0);
    }
    const newAmount = Math.max(0, base + feesTotal);

    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        amount: newAmount,
        ...(dueDate && { dueDate: new Date(dueDate) }),
        ...(notes !== undefined && { notes }),
        ...(additionalFees !== undefined && { additionalFees }),
      },
    });

    return NextResponse.json({ success: true, invoice: updated });
  } catch (error: any) {
    console.error('[PATCH /api/invoices/[id]] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
