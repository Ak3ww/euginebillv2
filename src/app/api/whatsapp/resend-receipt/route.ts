import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';
import { prisma } from '@/server/db/client';
import { sendPaymentSuccess } from '@/server/services/notifications/whatsapp-templates.service';

/**
 * POST /api/whatsapp/resend-receipt
 * Resend payment receipt via WhatsApp for a paid invoice
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { invoiceId } = body;

    if (!invoiceId) {
      return NextResponse.json({ success: false, error: 'invoiceId is required' }, { status: 400 });
    }

    // Fetch invoice with user, area, and profile details
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        user: {
          include: {
            profile: true,
            area: true,
          },
        },
        payments: {
          where: { status: 'SUCCESS' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        manualPayments: {
          where: { status: 'APPROVED' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!invoice) {
      return NextResponse.json({ success: false, error: 'Tagihan tidak ditemukan' }, { status: 404 });
    }

    // Prioritize active user's phone number over the snapshot invoice.customerPhone
    const phone = (invoice.user?.phone || invoice.customerPhone || '').trim();
    if (!phone) {
      return NextResponse.json({ success: false, error: 'Nomor WhatsApp pelanggan tidak tersedia' }, { status: 400 });
    }

    // Determine payment method label safely
    const paymentMethod =
      (invoice.payments[0] as any)?.method ||
      (invoice.payments[0] as any)?.paymentMethod ||
      (invoice.manualPayments[0] as any)?.bankName ||
      (invoice.manualPayments[0] as any)?.paymentMethod ||
      (invoice as any).paymentMethod ||
      (invoice as any).paymentChannel ||
      'MANUAL';

    const customerName = invoice.user?.name || invoice.customerName || 'Pelanggan';
    const customerId = invoice.user?.customerId || invoice.user?.pppoeCustomerId || invoice.customerUsername || invoice.user?.username || '-';
    const username = invoice.user?.username || invoice.customerUsername || '-';
    const profileName = invoice.user?.profile?.name || '-';
    const area = invoice.user?.area?.name || '-';

    // Synchronize invoice.customerPhone and invoice.customerName if outdated
    if (phone && (invoice.customerPhone !== phone || invoice.customerName !== customerName)) {
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          customerPhone: phone,
          customerName: customerName,
        },
      }).catch(() => {});
    }

    // Resend payment receipt WhatsApp message
    await sendPaymentSuccess({
      customerName,
      customerPhone: phone,
      customerId,
      username,
      password: (invoice.user as any)?.password || '******',
      profileName,
      area,
      invoiceNumber: invoice.invoiceNumber,
      amount: invoice.amount,
      paymentMethod,
      newExpiredAt: invoice.paidAt || invoice.user?.expiredAt,
    });

    // Record WA notification attempt in invoice
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        waNotifiedAt: new Date(),
        waRetryCount: { increment: 1 },
      },
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `Struk lunas ${invoice.invoiceNumber} berhasil dikirim ulang ke nomor ${phone}`,
    });
  } catch (error: any) {
    console.error('[Resend Receipt Error]:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal mengirim ulang struk' },
      { status: 500 }
    );
  }
}
