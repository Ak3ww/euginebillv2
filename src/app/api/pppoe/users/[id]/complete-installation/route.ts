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
        pppoeCustomer: true,
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

    // Safeguard: If user is already active and notification was already sent, return immediately without duplicate notification
    if (user.status?.toUpperCase() === 'ACTIVE' && latestInvoice.waNotifiedAt && (latestInvoice.waRetryCount || 0) > 0) {
      return NextResponse.json({
        success: true,
        hasInvoice: true,
        user,
        waSent: false,
        alreadyActive: true,
        invoiceNumber: latestInvoice.invoiceNumber,
        message: `Pelanggan ${user.name} sudah berstatus AKTIF dan Notifikasi WA Tagihan sudah pernah dikirim sebelumnya.`,
      });
    }

    // Step 2 Execution: Update user status to ACTIVE and sync secret
    const updatedUser = await prisma.pppoeUser.update({
      where: { id: user.id },
      data: {
        status: 'ACTIVE',
        updatedAt: new Date(),
      },
    });

    // Sync enabled secret to MikroTik so customer can immediately connect
    const { PPPSecretService } = await import('@/server/services/mikrotik/ppp-secret.service');
    await PPPSecretService.syncSecret(user.id).catch((syncErr: any) => {
      console.error('[CompleteInstallation] Failed to sync secret to MikroTik:', syncErr);
    });

    // Auto-complete any open work orders linked to this customer
    await prisma.workOrder.updateMany({
      where: { linkedUserId: user.id, status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] } },
      data: { status: 'COMPLETED', completedAt: new Date() },
    }).catch(() => {});

    // Construct payment link
    const company = await prisma.company.findFirst();
    const baseUrl = company?.baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const paymentLink = latestInvoice.paymentToken
      ? `${baseUrl}/pay/${latestInvoice.paymentToken}`
      : `${baseUrl}/invoice/${latestInvoice.invoiceNumber}`;

    // Official 8-digit Customer ID or user.customerId (Never PPPoE username)
    const officialCustomerId = user.customerId || (user as any).pppoeCustomer?.customerId || undefined;

    // Send WhatsApp Installation Invoice notification to customer only if not already notified
    let waSent = false;
    if (!latestInvoice.waNotifiedAt || (latestInvoice.waRetryCount || 0) === 0) {
      try {
        await sendInstallationInvoice({
          customerName: user.name,
          customerPhone: user.phone,
          customerId: officialCustomerId,
          username: user.username,
          invoiceNumber: latestInvoice.invoiceNumber,
          amount: latestInvoice.amount,
          paymentLink,
          dueDate: latestInvoice.dueDate,
          profileName: user.profile?.name || '-',
        });
        waSent = true;

        // Update invoice in DB to record waNotifiedAt timestamp
        await prisma.invoice.update({
          where: { id: latestInvoice.id },
          data: {
            waNotifiedAt: new Date(),
            waRetryCount: { increment: 1 },
          },
        }).catch((e) => console.error('[CompleteInstallation] DB update waNotifiedAt error:', e));
      } catch (waError) {
        console.error('[CompleteInstallation] Failed to send WA notification:', waError);
      }
    } else {
      console.log(`[CompleteInstallation] WA Tagihan sudah pernah dikirim sebelumnya untuk Invoice ${latestInvoice.invoiceNumber}, skip kirim ulang.`);
    }

    await logActivity({
      username: (session.user as any).username || (session.user as any).name || 'admin',
      userRole: (session.user as any).role || 'ADMIN',
      module: 'pppoe',
      action: 'COMPLETE_INSTALLATION',
      description: `Diselesaikan oleh Admin: Status ${user.name} diubah ke ACTIVE. Invoice #${latestInvoice.invoiceNumber} (Rp ${latestInvoice.amount.toLocaleString('id-ID')}). WA Status: ${waSent ? 'Terkirim' : 'Gagal'}.`,
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
