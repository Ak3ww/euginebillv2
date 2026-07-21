import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';

/**
 * Get Customer Profile
 * GET /api/customer/profile
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Find session by token
    const session = await prisma.customerSession.findFirst({
      where: {
        token,
        verified: true,
        expiresAt: { gte: new Date() },
      },
    });

    if (!session) {
      return NextResponse.json(
        { success: false, message: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Get fresh user data
    const user = await prisma.pppoeUser.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        username: true,
        customerId: true,
        name: true,
        phone: true,
        email: true,
        status: true,
        expiredAt: true,
        balance: true,
        autoRenewal: true,
        profile: {
          select: {
            id: true,
            name: true,
            downloadSpeed: true,
            uploadSpeed: true,
            price: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id.toString(),
        customerId: user.customerId || '',
        username: user.username,
        name: user.name || user.username,
        email: user.email || '',
        phone: user.phone || '',
        status: user.status,
        profileName: user.profile?.name || 'Unknown',
        profileId: user.profile?.id || '',
        price: user.profile?.price || 0,
        downloadSpeed: user.profile?.downloadSpeed || 0,
        uploadSpeed: user.profile?.uploadSpeed || 0,
        expiredAt: user.expiredAt?.toISOString() || null,
        balance: user.balance || 0,
      },
    });
  } catch (error: any) {
    console.error('Get customer profile error:', error);
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan', error: error.message },
      { status: 500 }
    );
  }
}

/**
 * Update Customer Profile
 * PATCH /api/customer/profile
 * Body: { name?, phone?, email? }
 */
export async function PATCH(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const session = await prisma.customerSession.findFirst({
      where: { token, verified: true, expiresAt: { gte: new Date() } },
    });
    if (!session) {
      return NextResponse.json({ success: false, message: 'Invalid or expired token' }, { status: 401 });
    }

    const body = await request.json();
    const { phone, email, password, phoneOtp } = body;

    // Validate
    if (phone !== undefined && phone !== '' && !/^[0-9+\-\s]{8,20}$/.test(phone)) {
      return NextResponse.json({ success: false, message: 'Format nomor telepon tidak valid' }, { status: 400 });
    }
    if (email !== undefined && email !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ success: false, message: 'Format email tidak valid' }, { status: 400 });
    }
    if (password !== undefined && password !== '' && password.length < 6) {
      return NextResponse.json({ success: false, message: 'Password minimal 6 karakter' }, { status: 400 });
    }

    const updateData: Record<string, string> = {};
    if (email !== undefined) updateData.email = email.trim();
    if (password !== undefined && password !== '') updateData.portalPassword = password;

    const user = await prisma.pppoeUser.findUnique({ where: { id: session.userId } });
    if (!user) {
      return NextResponse.json({ success: false, message: 'User tidak ditemukan' }, { status: 404 });
    }

    if (phone !== undefined && phone.trim() !== '') {
      const cleanNewPhone = phone.replace(/[^0-9]/g, '');
      const cleanNewPhoneWithCountry = cleanNewPhone.startsWith('0') ? '62' + cleanNewPhone.substring(1) : cleanNewPhone;

      if (cleanNewPhoneWithCountry !== user.phone) {
        if (!phoneOtp) {
          return NextResponse.json({ success: false, message: 'Verifikasi OTP diperlukan untuk mengubah nomor HP' }, { status: 400 });
        }

        const otpRecord = await prisma.customerSession.findFirst({
          where: {
            userId: session.userId,
            phone: cleanNewPhoneWithCountry,
            otpCode: phoneOtp,
            otpExpiry: { gte: new Date() },
            verified: false
          }
        });

        if (!otpRecord) {
          return NextResponse.json({ success: false, message: 'Kode OTP salah atau kadaluarsa' }, { status: 400 });
        }

        // Mark OTP as verified
        await prisma.customerSession.update({
          where: { id: otpRecord.id },
          data: { verified: true }
        });

        updateData.phone = cleanNewPhoneWithCountry;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: false, message: 'Tidak ada perubahan' }, { status: 400 });
    }

    const updated = await prisma.pppoeUser.update({
      where: { id: session.userId },
      data: updateData,
      select: { id: true, name: true, phone: true, email: true },
    });

    return NextResponse.json({
      success: true,
      message: 'Profil berhasil diperbarui',
      user: updated,
    });
  } catch (error: any) {
    console.error('Update customer profile error:', error);
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan', error: error.message },
      { status: 500 }
    );
  }
}
