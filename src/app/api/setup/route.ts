import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [adminCount, companyCount] = await Promise.all([
      prisma.adminUser.count(),
      prisma.company.count(),
    ]);

    return NextResponse.json({
      success: true,
      isInitialized: adminCount > 0 && companyCount > 0,
      adminCount,
      companyCount,
    });
  } catch (error: any) {
    console.error('Setup status check error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Database error' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const [adminCount, companyCount] = await Promise.all([
      prisma.adminUser.count(),
      prisma.company.count(),
    ]);

    if (adminCount > 0 && companyCount > 0) {
      return NextResponse.json(
        { error: 'Sistem sudah diinisialisasi. Setup terkunci.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      companyName,
      companyAddress,
      companyPhone,
      companyEmail,
      companyLogo,
      baseUrl,
      timezone,
      adminName,
      adminUsername,
      adminEmail,
      adminPassword,
      customerIdPrefix,
      fixedBillingDate,
    } = body;

    if (!companyName?.trim() || !adminName?.trim() || !adminEmail?.trim() || !adminPassword?.trim()) {
      return NextResponse.json(
        { error: 'Mohon lengkapi semua field wajib (Nama ISP, Nama Admin, Email, dan Password).' },
        { status: 400 }
      );
    }

    if (adminPassword.length < 6) {
      return NextResponse.json(
        { error: 'Password minimal 6 karakter.' },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    const resolvedCompanyId = randomUUID();
    const resolvedUserId = randomUUID();
    const resolvedUsername = (adminUsername?.trim() || adminEmail.split('@')[0] || 'admin').toLowerCase();

    // Create or update company
    let company;
    if (companyCount > 0) {
      const existing = await prisma.company.findFirst();
      company = await prisma.company.update({
        where: { id: existing!.id },
        data: {
          name: companyName.trim(),
          address: companyAddress?.trim() || null,
          phone: companyPhone?.trim() || null,
          email: companyEmail?.trim() || null,
          logo: companyLogo?.trim() || null,
          baseUrl: baseUrl?.trim() || '',
          timezone: timezone?.trim() || 'Asia/Jakarta',
          poweredBy: 'EugineBill',
          customerIdPrefix: customerIdPrefix?.trim() || 'EB-',
          fixedBillingDate: fixedBillingDate ? parseInt(fixedBillingDate) : 20,
        },
      });
    } else {
      company = await prisma.company.create({
        data: {
          id: resolvedCompanyId,
          name: companyName.trim(),
          address: companyAddress?.trim() || null,
          phone: companyPhone?.trim() || null,
          email: companyEmail?.trim() || null,
          logo: companyLogo?.trim() || null,
          baseUrl: baseUrl?.trim() || '',
          timezone: timezone?.trim() || 'Asia/Jakarta',
          poweredBy: 'EugineBill',
          customerIdPrefix: customerIdPrefix?.trim() || 'EB-',
          fixedBillingDate: fixedBillingDate ? parseInt(fixedBillingDate) : 20,
          invoiceGenerateDays: 7,
          gracePeriodDays: 0,
          isolationEnabled: true,
          isolationIpPool: '192.168.200.0/24',
          isolationRateLimit: '64k/64k',
          isolationAllowDns: true,
          isolationAllowPayment: true,
          isolationNotifyWhatsapp: true,
          bankAccounts: [],
        },
      });
    }

    // Create superadmin user in admin_users if none exists
    let adminUser;
    if (adminCount === 0) {
      adminUser = await prisma.adminUser.create({
        data: {
          id: resolvedUserId,
          name: adminName.trim(),
          username: resolvedUsername,
          email: adminEmail.trim().toLowerCase(),
          password: hashedPassword,
          role: 'SUPER_ADMIN',
          isActive: true,
        },
      });

      // Also mirror to legacy users table for backward compatibility
      try {
        await prisma.users.create({
          data: {
            id: resolvedUserId,
            name: adminName.trim(),
            email: adminEmail.trim().toLowerCase(),
            password: hashedPassword,
            role: 'ADMIN',
          },
        });
      } catch {}
    }

    return NextResponse.json({
      success: true,
      message: 'Inisialisasi sistem berhasil! Silakan login.',
      companyId: company.id,
      adminUsername: adminUser?.username || resolvedUsername,
      adminEmail: adminUser?.email || adminEmail,
    });
  } catch (error: any) {
    console.error('Setup submission error:', error);
    return NextResponse.json(
      { error: error.message || 'Gagal menyimpan konfigurasi setup.' },
      { status: 500 }
    );
  }
}
