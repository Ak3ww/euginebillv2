import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';

export const dynamic = 'force-dynamic';

// Helper to verify customer token
async function verifyCustomerToken(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return null;

    const session = await prisma.customerSession.findFirst({
      where: {
        token,
        verified: true,
        expiresAt: { gte: new Date() },
      },
    });

    if (!session) return null;

    return await prisma.pppoeUser.findUnique({
      where: { id: session.userId },
      include: {
        profile: true
      }
    });
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

// GET - Calculate proration breakdown and check for pending requests
export async function GET(request: NextRequest) {
  try {
    const pppoeUser = await verifyCustomerToken(request);
    if (!pppoeUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if there is already a pending change request
    const pendingRequest = await prisma.packageChangeRequest.findFirst({
      where: {
        userId: pppoeUser.id,
        status: 'PENDING'
      },
      include: {
        newProfile: true,
        oldProfile: true
      }
    });

    const { searchParams } = new URL(request.url);
    const newProfileId = searchParams.get('newProfileId');

    if (!newProfileId) {
      return NextResponse.json({
        success: true,
        pendingRequest: pendingRequest ? {
          id: pendingRequest.id,
          newProfileName: pendingRequest.newProfile.name,
          newProfilePrice: pendingRequest.newProfile.price,
          createdAt: pendingRequest.createdAt
        } : null
      });
    }

    const newProfile = await prisma.pppoeProfile.findUnique({
      where: { id: newProfileId }
    });

    if (!newProfile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Default calculations
    let oldPackagePrice = pppoeUser.profile?.price || 0;
    let newPackagePrice = newProfile.price;
    let daysActive = 30;
    let remainingDays = 0;
    let oldUnusedValue = 0;
    let newProratedCost = 0;
    let proratedBaseAmount = newPackagePrice;
    let isProrated = false;

    // Proration calculation
    if (pppoeUser.expiredAt && pppoeUser.expiredAt > new Date() && pppoeUser.profile) {
      const today = new Date();
      const timeDiff = pppoeUser.expiredAt.getTime() - today.getTime();
      remainingDays = Math.max(0, Math.ceil(timeDiff / (1000 * 60 * 60 * 24)));

      if (remainingDays > 0 && remainingDays < 32) {
        isProrated = true;
        daysActive = remainingDays;

        const oldDailyRate = pppoeUser.profile.proratePricePerDay || (pppoeUser.profile.price / 30);
        const newDailyRate = newProfile.proratePricePerDay || (newProfile.price / 30);

        oldUnusedValue = Math.round(remainingDays * oldDailyRate);
        newProratedCost = Math.round(remainingDays * newDailyRate);

        // Clamp to 0 if negative (free change)
        proratedBaseAmount = Math.max(0, newProratedCost - oldUnusedValue);
      }
    }

    // Apply PPN if active on profile
    let taxAmount = 0;
    let taxRate = 0;
    let totalAmount = proratedBaseAmount;

    if (newProfile.ppnActive && newProfile.ppnRate > 0) {
      taxRate = newProfile.ppnRate;
      taxAmount = Math.round(proratedBaseAmount * taxRate / 100);
      totalAmount = proratedBaseAmount + taxAmount;
    }

    return NextResponse.json({
      success: true,
      pendingRequest: pendingRequest ? {
        id: pendingRequest.id,
        newProfileName: pendingRequest.newProfile.name,
        newProfilePrice: pendingRequest.newProfile.price,
        createdAt: pendingRequest.createdAt
      } : null,
      calculation: {
        isProrated,
        remainingDays,
        oldPackagePrice,
        newPackagePrice,
        oldUnusedValue,
        newProratedCost,
        baseAmount: proratedBaseAmount,
        taxRate,
        taxAmount,
        totalAmount
      }
    });

  } catch (error: any) {
    console.error('Upgrade calculation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Submit package change request (upgrade/downgrade) for admin approval
export async function POST(request: NextRequest) {
  try {
    // Verify customer token
    const pppoeUser = await verifyCustomerToken(request);
    if (!pppoeUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { newProfileId } = await request.json();

    if (!newProfileId) {
      return NextResponse.json({ error: 'Profile ID is required' }, { status: 400 });
    }

    // Check if there are any unpaid invoices
    const unpaidInvoices = await prisma.invoice.count({
      where: {
        userId: pppoeUser.id,
        status: { in: ['PENDING', 'OVERDUE'] }
      }
    });

    if (unpaidInvoices > 0) {
      return NextResponse.json({ 
        error: 'Anda memiliki tagihan yang belum dibayar. Harap lunasi tagihan Anda terlebih dahulu sebelum mengajukan perubahan paket.' 
      }, { status: 400 });
    }

    // Get new profile
    const newProfile = await prisma.pppoeProfile.findUnique({
      where: { id: newProfileId }
    });

    if (!newProfile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Check if same profile
    if (pppoeUser.profileId === newProfileId) {
      return NextResponse.json({ error: 'Paket yang dipilih sama dengan paket saat ini' }, { status: 400 });
    }

    // Check if there is already a pending request
    const existingRequest = await prisma.packageChangeRequest.findFirst({
      where: {
        userId: pppoeUser.id,
        status: 'PENDING'
      }
    });

    if (existingRequest) {
      return NextResponse.json({ error: 'Anda sudah memiliki pengajuan perubahan paket yang sedang diproses' }, { status: 400 });
    }

    // Create the package change request record
    const changeRequest = await prisma.packageChangeRequest.create({
      data: {
        userId: pppoeUser.id,
        oldProfileId: pppoeUser.profileId,
        newProfileId: newProfileId,
        status: 'PENDING'
      },
      include: {
        newProfile: true
      }
    });

    return NextResponse.json({
      success: true,
      message: `Pengajuan ganti paket ke ${changeRequest.newProfile.name} berhasil dikirim dan menunggu persetujuan admin`,
      request: {
        id: changeRequest.id,
        status: changeRequest.status,
        newPackageName: changeRequest.newProfile.name
      }
    });

  } catch (error: any) {
    console.error('Upgrade request error:', error);
    return NextResponse.json(
      { error: error.message || 'Gagal mengirim pengajuan ganti paket' },
      { status: 500 }
    );
  }
}
