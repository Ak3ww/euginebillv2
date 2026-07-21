import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { WhatsAppService } from '@/server/services/notifications/whatsapp.service';
import { nowWIB } from '@/lib/timezone';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const session = await prisma.customerSession.findFirst({
      where: { token, verified: true, expiresAt: { gte: new Date() } },
    });

    if (!session) {
      return NextResponse.json({ success: false, error: 'Invalid or expired token' }, { status: 401 });
    }

    const { newPhone, purpose } = await request.json();
    let cleanPhone = '';

    if (purpose === 'password_change') {
      const user = await prisma.pppoeUser.findUnique({ where: { id: session.userId } });
      if (!user || !user.phone) {
         return NextResponse.json({ success: false, error: 'Nomor WhatsApp belum terdaftar di akun ini' }, { status: 400 });
      }
      cleanPhone = user.phone;
    } else {
      if (!newPhone) {
        return NextResponse.json({ success: false, error: 'Nomor WhatsApp baru wajib diisi' }, { status: 400 });
      }

      // Clean phone number
      cleanPhone = newPhone.replace(/[^0-9]/g, '');
      if (cleanPhone.startsWith('0')) {
        cleanPhone = '62' + cleanPhone.substring(1);
      }
      if (!cleanPhone.startsWith('62')) {
        cleanPhone = '62' + cleanPhone;
      }

      // Check if phone number is already registered to another user
      const existing = await prisma.pppoeUser.findFirst({
        where: {
          phone: cleanPhone,
          id: { not: session.userId }
        }
      });
      if (existing) {
        return NextResponse.json({ success: false, error: 'Nomor WhatsApp ini sudah digunakan oleh akun lain' }, { status: 400 });
      }
    }

    // Rate limiting: max 3 OTPs per 15 mins for this phone number
    const fifteenMinutesAgo = new Date(nowWIB().getTime() - 15 * 60 * 1000);
    const recentOTPs = await prisma.customerSession.count({
      where: {
        phone: cleanPhone,
        createdAt: { gte: fifteenMinutesAgo },
      },
    });

    if (recentOTPs >= 3) {
      return NextResponse.json(
        { success: false, error: 'Terlalu banyak permintaan OTP. Coba lagi dalam 15 menit.' },
        { status: 429 }
      );
    }

    // Generate 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Create session record for verification
    await prisma.customerSession.create({
      data: {
        userId: session.userId,
        phone: cleanPhone,
        otpCode,
        otpExpiry,
        verified: false,
      },
    });

    const company = await prisma.company.findFirst();
    const companyName = company?.name || 'EugineBill';

    // Send OTP via WhatsApp
    const message = purpose === 'password_change'
      ? `Kode OTP Anda untuk reset password portal: ${otpCode}\n\nBerlaku selama 5 menit.\nJangan bagikan kode ini kepada siapapun.\n\n- ${companyName}`
      : `Kode OTP Anda untuk perubahan nomor WhatsApp: ${otpCode}\n\nBerlaku selama 5 menit.\nJangan bagikan kode ini kepada siapapun.\n\n- ${companyName}`;

    await WhatsAppService.sendMessage({
      phone: cleanPhone,
      message,
    });

    return NextResponse.json({ success: true, message: 'OTP berhasil dikirim ke nomor WhatsApp baru Anda' });

  } catch (error: any) {
    console.error('Send profile OTP error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
