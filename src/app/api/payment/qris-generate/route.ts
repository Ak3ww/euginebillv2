import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { staticToDynamic, generateUniqueAmountSafeAsync, validateQris } from '@/lib/qris';

export const dynamic = 'force-dynamic';

/**
 * POST /api/payment/qris-generate
 * Generates an EMVCo dynamic QRIS string for an invoice with a collision-free unique amount.
 * Body: { invoiceId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { invoiceId } = body;

    if (!invoiceId) {
      return NextResponse.json({ error: 'invoiceId wajib disertakan' }, { status: 400 });
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        user: { select: { id: true, name: true, username: true } },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice tidak ditemukan' }, { status: 404 });
    }

    if (invoice.status === 'PAID') {
      return NextResponse.json({ error: 'Invoice sudah dibayar' }, { status: 400 });
    }

    // Determine static QRIS string from env or payment gateway config
    const qrisGateway = await prisma.paymentGateway.findFirst({
      where: {
        OR: [
          { provider: 'qris' },
          { provider: 'manual_qris' },
          { qrinToken: { not: null } },
        ],
      },
    });

    const staticQris = process.env.QRIS_STATIC_CODE || qrisGateway?.qrinToken || '';

    if (!staticQris) {
      return NextResponse.json(
        { error: 'QRIS statis belum dikonfigurasi di server (QRIS_STATIC_CODE)' },
        { status: 500 }
      );
    }

    if (!validateQris(staticQris)) {
      return NextResponse.json(
        { error: 'Format QRIS statis di sistem tidak valid (gagal validasi CRC-16 EMVCo)' },
        { status: 500 }
      );
    }

    const baseAmount = invoice.amount;
    const now = new Date();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 menit

    // Check if there is already an active qrisPending for this invoice
    const existing = await prisma.qrisPending.findUnique({
      where: { invoiceId: invoice.id },
    });

    let uniqueAmount: number;

    if (existing && existing.matchedAt === null && existing.expiresAt > now) {
      uniqueAmount = existing.uniqueAmount;
    } else {
      // Generate a collision-free unique amount
      uniqueAmount = await generateUniqueAmountSafeAsync(
        baseAmount,
        invoice.id,
        async (testAmount) => {
          const collision = await prisma.qrisPending.findFirst({
            where: {
              uniqueAmount: testAmount,
              matchedAt: null,
              expiresAt: { gt: now },
              invoiceId: { not: invoice.id },
            },
          });
          return Boolean(collision);
        },
        1,
        999
      );

      // Upsert qrisPending record
      await prisma.qrisPending.upsert({
        where: { invoiceId: invoice.id },
        create: {
          invoiceId: invoice.id,
          uniqueAmount,
          baseAmount,
          expiresAt,
        },
        update: {
          uniqueAmount,
          baseAmount,
          expiresAt,
          matchedAt: null,
        },
      });
    }

    // Convert static QRIS to dynamic QRIS with exact unique amount
    const dynamicQris = staticToDynamic(staticQris, uniqueAmount);

    return NextResponse.json({
      success: true,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      baseAmount,
      uniqueAmount,
      dynamicQris,
      expiresAt: expiresAt.toISOString(),
      expiresInSeconds: Math.floor((expiresAt.getTime() - Date.now()) / 1000),
    });
  } catch (error: any) {
    console.error('[QRIS Generate] Error:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
