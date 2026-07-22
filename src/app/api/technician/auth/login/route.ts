import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { SignJWT } from 'jose';
import bcrypt from 'bcryptjs';
import { TECH_JWT_SECRET } from '@/server/auth/technician-secret';
import { rateLimit, RateLimitPresets } from '@/server/middleware/rate-limit';

export async function POST(req: NextRequest) {
  try {
    const limited = await rateLimit(req, RateLimitPresets.strict);
    if (limited) {
      return NextResponse.json({ error: 'Terlalu banyak percobaan. Silakan coba lagi nanti.' }, { status: 429 });
    }

    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username/No HP dan Password wajib diisi' },
        { status: 400 }
      );
    }

    const cleanInput = username.trim();

    // 1. Try finding in `technician` table by username OR phoneNumber
    const tech = await prisma.technician.findFirst({
      where: {
        OR: [
          { username: cleanInput },
          { phoneNumber: cleanInput },
          { phoneNumber: cleanInput.replace(/^0/, '62') },
        ]
      }
    });

    if (tech) {
      if (!tech.isActive) {
        return NextResponse.json({ error: 'Akun teknisi tidak aktif. Hubungi admin.' }, { status: 403 });
      }

      let isMatch = false;
      if (tech.password) {
        if (tech.password.startsWith('$2a$') || tech.password.startsWith('$2b$')) {
          isMatch = await bcrypt.compare(password, tech.password);
        } else {
          isMatch = tech.password === password;
          // Auto-hash plain text password
          if (isMatch) {
            const hashed = await bcrypt.hash(password, 10);
            await prisma.technician.update({
              where: { id: tech.id },
              data: { password: hashed }
            }).catch(() => {});
          }
        }
      }

      if (!isMatch) {
        return NextResponse.json({ error: 'Username atau password salah' }, { status: 401 });
      }

      // Update last login
      await prisma.technician.update({
        where: { id: tech.id },
        data: { lastLoginAt: new Date() }
      }).catch(() => {});

      const token = await new SignJWT({
        id: tech.id,
        username: tech.username || tech.phoneNumber,
        name: tech.name,
        phone: tech.phoneNumber,
        role: 'technician',
        type: 'technician',
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('7d')
        .sign(TECH_JWT_SECRET);

      const response = NextResponse.json({
        success: true,
        message: 'Login berhasil',
        user: {
          id: tech.id,
          username: tech.username || tech.phoneNumber,
          name: tech.name,
          phone: tech.phoneNumber,
          email: tech.email,
        },
      });

      response.cookies.set('technician-token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/',
      });

      return response;
    }

    // 2. Fallback to `adminUser` table with role TECHNICIAN
    const adminUser = await prisma.adminUser.findUnique({
      where: { username: cleanInput },
    });

    if (adminUser && adminUser.role === 'TECHNICIAN') {
      if (!adminUser.isActive) {
        return NextResponse.json({ error: 'Akun tidak aktif' }, { status: 403 });
      }

      const isValid = await bcrypt.compare(password, adminUser.password);
      if (!isValid) {
        return NextResponse.json({ error: 'Username atau password salah' }, { status: 401 });
      }

      await prisma.adminUser.update({
        where: { id: adminUser.id },
        data: { lastLogin: new Date() },
      });

      const token = await new SignJWT({
        id: adminUser.id,
        username: adminUser.username,
        name: adminUser.name,
        phone: adminUser.phone,
        role: 'technician',
        type: 'admin_user',
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('7d')
        .sign(TECH_JWT_SECRET);

      const response = NextResponse.json({
        success: true,
        message: 'Login berhasil',
        user: {
          id: adminUser.id,
          username: adminUser.username,
          name: adminUser.name,
          phone: adminUser.phone,
          email: adminUser.email,
        },
      });

      response.cookies.set('technician-token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
      });

      return response;
    }

    return NextResponse.json({ error: 'Username atau password salah' }, { status: 401 });
  } catch (error) {
    console.error('Technician login error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
