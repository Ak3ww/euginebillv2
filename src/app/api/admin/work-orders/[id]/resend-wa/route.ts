import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { checkAuth } from '@/server/middleware/api-auth';
import { sendPSBReportToGroup } from '@/server/services/notifications/whatsapp-templates.service';

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const { id } = params;

    const auth = await checkAuth();
    if (!auth.authorized) return auth.response;

    const wo = await prisma.workOrder.findUnique({
      where: { id },
      include: { technician: true, customer: true },
    });

    if (!wo) {
      return NextResponse.json({ error: 'Surat Tugas tidak ditemukan' }, { status: 404 });
    }

    const company = await prisma.company.findFirst({
      select: { psbWaGroupId: true, baseUrl: true },
    });

    if (!company?.psbWaGroupId) {
      return NextResponse.json({
        error: 'Group ID WhatsApp belum diatur. Silakan atur Group ID di menu Pengaturan ➔ Perusahaan.',
      }, { status: 400 });
    }

    const appBaseUrl = company.baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://euginemediagroup.com';
    const reportData = typeof wo.reportData === 'string' ? JSON.parse(wo.reportData) : (wo.reportData || {});
    const reportPhotos = typeof wo.reportPhotos === 'string' ? JSON.parse(wo.reportPhotos) : (wo.reportPhotos || {});

    await sendPSBReportToGroup({
      groupId: company.psbWaGroupId,
      reportData,
      reportPhotos,
      customerName: wo.customerName,
      customerPhone: wo.customerPhone,
      customerAddress: wo.customerAddress,
      technicianName: wo.technician?.name || 'Teknisi',
      appBaseUrl,
    });

    return NextResponse.json({
      success: true,
      message: 'Laporan PSB berhasil dikirim ulang ke Grup WA!',
    });
  } catch (error: any) {
    console.error('[Resend PSB WA Report Error]:', error);
    return NextResponse.json({ error: error?.message || 'Gagal mengirim laporan ke Grup WA' }, { status: 500 });
  }
}
