import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';
import { prisma } from '@/server/db/client';
import { sendInstallationInvoice } from '@/server/services/notifications/whatsapp-templates.service';
import { logActivity } from '@/server/services/activity-log.service';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Find customer by CUID, customerId, or username
    const user = await prisma.pppoeUser.findFirst({
      where: {
        OR: [
          { id },
          { customerId: id },
          { username: id },
        ],
      },
      include: {
        profile: true,
        router: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'Pelanggan tidak ditemukan' }, { status: 404 });
    }

    // Step 1 Check: Verify if an invoice has been created for this customer
    const latestInvoice = await prisma.invoice.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    if (!latestInvoice) {
      return NextResponse.json(
        {
          success: false,
          hasInvoice: false,
          error: 'Tagihan / Invoice belum dibuat oleh Admin. Silakan terbitkan invoice terlebih dahulu (termasuk biaya tambahan jika ada) sebelum menyelesaikan pemasangan.',
        },
        { status: 400 }
      );
    }

    // Step 2 Execution: Update user status to ACTIVE
    const updatedUser = await prisma.pppoeUser.update({
      where: { id: user.id },
      data: {
        status: 'ACTIVE',
        updatedAt: new Date(),
      },
    });

    // Construct payment link
    const company = await prisma.company.findFirst();
    const baseUrl = company?.baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const paymentLink = latestInvoice.paymentToken
      ? `${baseUrl}/pay/${latestInvoice.paymentToken}`
      : `${baseUrl}/invoice/${latestInvoice.invoiceNumber}`;

    // Send WhatsApp Installation Invoice notification to customer
    let waSent = false;
    try {
      await sendInstallationInvoice({
        customerName: user.name,
        customerPhone: user.phone,
        invoiceNumber: latestInvoice.invoiceNumber,
        amount: latestInvoice.amount,
        paymentLink,
        dueDate: latestInvoice.dueDate,
        profileName: user.profile?.name || '-',
      });
      waSent = true;
    } catch (waError) {
      console.error('[CompleteInstallation] Failed to send WA notification:', waError);
    }

    // Log Activity
    await logActivity({
      adminId: (session.user as any).id,
      action: 'COMPLETE_INSTALLATION',
      entity: 'pppoe_user',
      entityId: user.id,
      details: `Diselesaikan oleh Admin: Status ${user.name} diubah ke ACTIVE. Invoice #${latestInvoice.invoiceNumber} (Rp ${latestInvoice.amount.toLocaleString('id-ID')}). WA Status: ${waSent ? 'Terkirim' : 'Gagal'}.`,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      hasInvoice: true,
      user: updatedUser,
      waSent,
      invoiceNumber: latestInvoice.invoiceNumber,
      message: `Pemasangan untuk ${user.name} telah diselesaikan! Status pelanggan kini AKTIF dan Notifikasi WA Tagihan telah dikirim.`,
    });
  } catch (error: any) {
    console.error('[CompleteInstallation API Error]:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan server saat menyelesaikan pemasangan' },
      { status: 500 }
    );
  }
}
