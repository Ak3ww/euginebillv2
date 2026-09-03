import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';

export async function POST(request: NextRequest) {
  try {
    const { phone, otpCode, newPassword } = await request.json();

    if (!phone || !otpCode || !newPassword) {
      return NextResponse.json(
        { success: false, error: 'Nomor HP, Kode OTP, dan Password baru wajib diisi' },
        { status: 400 }
      );
    }

    if (newPassword.length < 4) {
      return NextResponse.json(
        { success: false, error: 'Password baru minimal 4 karakter' },
        { status: 400 }
      );
    }

    // Clean phone number
    let cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '62' + cleanPhone.substring(1);
    }
    if (!cleanPhone.startsWith('62')) {
      cleanPhone = '62' + cleanPhone;
    }

    // Find active OTP session
    const session = await prisma.customerSession.findFirst({
      where: {
        phone: cleanPhone,
        otpCode: otpCode,
        verified: false,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Kode OTP tidak valid atau sudah kedaluwarsa' },
        { status: 400 }
      );
    }

    // Check if expired
    if (session.otpExpiry && new Date() > session.otpExpiry) {
      return NextResponse.json(
        { success: false, error: 'Kode OTP sudah kedaluwarsa. Silakan minta kode baru.' },
        { status: 400 }
      );
    }

    // Update portalPassword for the user
    await prisma.pppoeUser.update({
      where: { id: session.userId },
      data: {
        portalPassword: newPassword,
      },
    });

    // Invalidate the OTP session
    await prisma.customerSession.update({
      where: { id: session.id },
      data: {
        verified: true,
        otpCode: null,
        otpExpiry: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Password berhasil diperbarui! Silakan login dengan password baru Anda.',
    });
  } catch (error: any) {
    console.error('[Customer Reset Password] Error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Gagal mereset password' },
      { status: 500 }
    );
  }
}
