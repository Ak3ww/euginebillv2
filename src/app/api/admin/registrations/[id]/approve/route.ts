import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { genCustomerId } from '@/lib/utils';
import { sendRegistrationApproval } from '@/server/services/notifications/whatsapp-templates.service';
import crypto from 'crypto';
import { generateUniqueReferralCode } from '@/server/services/referral.service';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';

// generateUsername removed

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    const body = await request.json();
    const { installationFee = 0, subscriptionType = 'POSTPAID', billingDay = 1, areaId, routerId, additionalFees = [], username, password } = body;

    // Installation fee is optional, default to 0
    const fee = installationFee || 0;
    
    // Validate subscriptionType
    if (!['POSTPAID', 'PREPAID'].includes(subscriptionType)) {
      return NextResponse.json(
        { error: 'Invalid subscription type' },
        { status: 400 }
      );
    }
    
    // Validate billingDay (1-31)
    const validBillingDay = Math.min(Math.max(parseInt(billingDay) || 1, 1), 31);

    // Get registration
    const registration = await prisma.registrationRequest.findUnique({
      where: { id },
      include: { profile: true, area: true },
    });

    if (!registration) {
      return NextResponse.json(
        { error: 'Registration not found' },
        { status: 404 }
      );
    }

    if (registration.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Registration is not pending' },
        { status: 400 }
      );
    }

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    // Check if username already exists
    const existingUser = await prisma.pppoeUser.findUnique({
      where: { username },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Username already exists. Please contact admin.' },
        { status: 400 }
      );
    }

    // Generate unique customerId (with company prefix if configured)
    const companyInfo = await prisma.company.findFirst();
    const prefix = companyInfo?.customerIdPrefix?.trim() || '';

    async function generateUniqueCustomerId() {
      for (let i = 0; i < 10; i++) {
        const candidate = prefix + genCustomerId();
        const exists = await prisma.pppoeUser.findFirst({ where: { customerId: candidate } as any });
        if (!exists) return candidate;
      }
      while (true) {
        const candidate = prefix + genCustomerId();
        const exists = await prisma.pppoeUser.findFirst({ where: { customerId: candidate } as any });
        if (!exists) return candidate;
      }
    }

    const customerId = await generateUniqueCustomerId();

    // Determine billing day (prioritize input, then company setting, then 1)
    const activeBillingDay = billingDay ? validBillingDay : (companyInfo?.fixedBillingDate || 1);

    // Calculate expiredAt and Prorate (if enabled)
    let expiredAt: Date;
    let prorateSubscriptionFee = 0;
    const now = new Date();
    
    if (companyInfo?.enableProrate) {
      // PRORATE LOGIC
      expiredAt = new Date(now.getFullYear(), now.getMonth(), activeBillingDay, 23, 59, 59, 999);
      if (now.getDate() >= activeBillingDay) {
        expiredAt.setMonth(expiredAt.getMonth() + 1);
      }
      
      const msPerDay = 1000 * 60 * 60 * 24;
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const daysActive = Math.max(1, Math.ceil((expiredAt.getTime() - today.getTime()) / msPerDay));
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      
      // 2026 update: calculate by proratePricePerDay
      const pricePerDay = registration.profile.proratePricePerDay || 0;
      prorateSubscriptionFee = Math.ceil(daysActive * pricePerDay);
    } else {
      if (subscriptionType === 'POSTPAID') {
        expiredAt = new Date(now);
        expiredAt.setMonth(expiredAt.getMonth() + 1); // Next month
        expiredAt.setDate(activeBillingDay); // Set to billing day
        expiredAt.setHours(23, 59, 59, 999);
      } else {
        expiredAt = new Date(now);
        if (registration.profile.validityUnit === 'MONTHS') {
          expiredAt.setMonth(expiredAt.getMonth() + registration.profile.validityValue);
        } else {
          expiredAt.setDate(expiredAt.getDate() + registration.profile.validityValue);
        }
        expiredAt.setHours(23, 59, 59, 999);
      }
    }

    // Resolve referral code to referrer ID
    let referredById: string | null = null;
    if (registration.referralCode) {
      const referrer = await prisma.pppoeUser.findUnique({
        where: { referralCode: registration.referralCode },
        select: { id: true },
      });
      if (referrer) {
        referredById = referrer.id;
      }
    }

    // Create PPPoE user
    const pppoeUser = await prisma.pppoeUser.create({
      data: {
        id: crypto.randomUUID(),
        username,
        customerId,
        password,
        name: registration.name,
        phone: registration.phone,
        email: registration.email,
        address: registration.address,
        profileId: registration.profileId,
        areaId: areaId || (registration as any).areaId || null,
        routerId: routerId || null,
        status: 'PENDING_INSTALLATION', // Create as PENDING_INSTALLATION
        syncedToRadius: false,
        subscriptionType: subscriptionType as 'POSTPAID' | 'PREPAID',
        billingDay: activeBillingDay,
        expiredAt: expiredAt,
        referredById: referredById,
        referralCode: await generateUniqueReferralCode(),
      } as any,
    });

    // Process referral bonus (REGISTRATION type)
    if (referredById) {
      try {
        const companyRef = await prisma.company.findFirst({
          select: {
            referralEnabled: true,
            referralRewardAmount: true,
            referralRewardType: true,
          },
        });

        if (companyRef?.referralEnabled && companyRef.referralRewardType === 'REGISTRATION') {
          const rewardAmount = companyRef.referralRewardAmount ?? 10000;

          await prisma.referralReward.create({
            data: {
              referrerId: referredById,
              referredId: pppoeUser.id,
              amount: rewardAmount,
              status: 'CREDITED',
              type: 'REGISTRATION',
              creditedAt: new Date(),
            },
          });
          console.log(`✅ Referral registration reward ${rewardAmount} recorded for ${referredById}`);
        } else if (companyRef?.referralEnabled && companyRef.referralRewardType === 'FIRST_PAYMENT') {
          // Create PENDING reward to be credited on first payment
          await prisma.referralReward.create({
            data: {
              referrerId: referredById,
              referredId: pppoeUser.id,
              amount: companyRef.referralRewardAmount ?? 10000,
              status: 'PENDING',
              type: 'FIRST_PAYMENT',
            },
          });
          console.log(`✅ Referral PENDING reward created for ${referredById}`);
        }
      } catch (referralError) {
        console.error('Referral bonus error:', referralError);
      }
    }

    // Sync to RADIUS or Mikrotik
    if (companyInfo?.radiusEnabled) {
      // Password
      await prisma.radcheck.upsert({
        where: { username_attribute: { username, attribute: 'Cleartext-Password' } },
        create: { username, attribute: 'Cleartext-Password', op: ':=', value: password },
        update: { value: password },
      });

      // Add to group
      await prisma.radusergroup.upsert({
        where: { username_groupname: { username, groupname: registration.profile.groupName } },
        create: { username, groupname: registration.profile.groupName, priority: 1 },
        update: { groupname: registration.profile.groupName },
      });

      await prisma.pppoeUser.update({
        where: { id: pppoeUser.id },
        data: { syncedToRadius: true },
      });
    } else {
      const { PPPSecretService } = await import('@/server/services/mikrotik/ppp-secret.service');
      await PPPSecretService.syncSecret(pppoeUser.id);
      await prisma.pppoeUser.update({
        where: { id: pppoeUser.id },
        data: { syncedToRadius: true },
      });
    }

    // Save additionalFees to notes to be used in activate-and-bill
    let updatedNotes = registration.notes;
    if (additionalFees && additionalFees.length > 0) {
      const feesData = JSON.stringify({ additionalFees });
      updatedNotes = updatedNotes ? `${updatedNotes}\n\n[ADMIN_FEES]: ${feesData}` : `[ADMIN_FEES]: ${feesData}`;
    }

    // Update registration
    await prisma.registrationRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        installationFee: fee,
        pppoeUserId: pppoeUser.id,
        notes: updatedNotes,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Registration approved and PPPoE user created',
      pppoeUser: {
        id: pppoeUser.id,
        username: pppoeUser.username,
        password: pppoeUser.password,
        status: pppoeUser.status,
        subscriptionType: subscriptionType,
      },
    });
  } catch (error: any) {
    console.error('Approve registration error:', error);
    return NextResponse.json(
      { error: 'Failed to approve registration' },
      { status: 500 }
    );
  }
}
