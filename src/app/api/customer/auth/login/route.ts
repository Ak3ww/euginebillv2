import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { nanoid } from 'nanoid';

export async function POST(request: NextRequest) {
  try {
    const { identifier, password } = await request.json();
    
    console.log('[Customer Login] Input:', identifier);

    if (!identifier || !password) {
      return NextResponse.json(
        { success: false, error: 'ID Pelanggan dan Password wajib diisi' },
        { status: 400 }
      );
    }

    // Find user by customerId
    const user = await prisma.pppoeUser.findFirst({
      where: {
        customerId: identifier,
      },
      select: {
        id: true,
        username: true,
        customerId: true,
        password: true,
        name: true,
        phone: true,
        email: true,
        status: true,
        expiredAt: true,
        profile: {
          select: {
            name: true,
            downloadSpeed: true,
            uploadSpeed: true,
          },
        },
      },
    });

    console.log('[Customer Login] User found:', user ? 'Yes' : 'No');

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'ID Pelanggan tidak terdaftar' },
        { status: 404 }
      );
    }

    // Verify password
    if (user.password !== password) {
      return NextResponse.json(
        { success: false, error: 'Password salah' },
        { status: 401 }
      );
    }

    // Create session and return token
    const token = nanoid(64);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await prisma.customerSession.create({
      data: {
        userId: user.id,
        phone: user.phone || identifier,
        token,
        expiresAt,
        verified: true,
      },
    });

    // Remove password from returned user object
    const { password: _, ...safeUser } = user;

    return NextResponse.json({
      success: true,
      user: safeUser,
      token,
    });
  } catch (error: any) {
    console.error('Login check error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
