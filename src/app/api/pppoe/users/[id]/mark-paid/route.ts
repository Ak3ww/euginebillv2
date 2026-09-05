import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';
import { prisma } from '@/server/db/client';
import { generateTransactionId, generateCategoryId } from '@/server/services/billing/invoice.service';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;

    // Fetch user with profile data needed for RADIUS restoration
    const userRecord = await prisma.pppoeUser.findUnique({
      where: { id },
      select: {
        username: true,
        password: true,
        ipAddress: true,
        routerId: true,
        billingDay: true,
        subscriptionType: true,
        expiredAt: true,
        profile: { select: { groupName: true, mikrotikProfileName: true, name: true, validityValue: true, validityUnit: true } },
      },
    });

    if (!userRecord) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get unpaid invoices for user
    const unpaidInvoices = await prisma.invoice.findMany({
      where: {
        userId: id,
        status: { in: ['PENDING', 'OVERDUE'] },
      },
      orderBy: { dueDate: 'asc' },
    });

    if (unpaidInvoices.length === 0) {
      return NextResponse.json(
        { error: 'No unpaid invoices found' },
        { status: 404 }
      );
    }

    const now = new Date();
    const markedCount = unpaidInvoices.length;
    const totalAmount = unpaidInvoices.reduce((sum, inv) => sum + inv.amount, 0);

    // Mark all unpaid invoices as paid
    await prisma.invoice.updateMany({
      where: {
        userId: id,
        status: { in: ['PENDING', 'OVERDUE'] },
      },
      data: {
        status: 'PAID',
        paidAt: now,
      },
    });

    // Find or create transaction category for subscription
    let category = await prisma.transactionCategory.findFirst({
      where: { name: 'Subscription', type: 'INCOME' },
    });
    
    if (!category) {
      category = await prisma.transactionCategory.create({
        data: {
          id: generateCategoryId(),
          name: 'Subscription',
          type: 'INCOME',
        },
      });
    }

    // Create transaction records
    for (const invoice of unpaidInvoices) {
      await prisma.transaction.create({
        data: {
          id: await generateTransactionId(),
          categoryId: category.id,
          type: 'INCOME',
          amount: invoice.amount,
          description: `Pembayaran tagihan ${invoice.invoiceNumber}`,
          reference: invoice.invoiceNumber,
          date: now,
        },
      });
    }

    // Calculate new expiredAt for user (extend to next billing cycle at 23:59:59 WIB)
    const companySettings = await prisma.company.findFirst();
    const bd = userRecord.billingDay || companySettings?.fixedBillingDate || 6;
    
    let newExpiredAt: Date;
    if (userRecord.subscriptionType === 'PREPAID') {
      const baseDate = (userRecord.expiredAt && userRecord.expiredAt > now) ? new Date(userRecord.expiredAt) : new Date(now);
      const val = userRecord.profile?.validityValue || 1;
      const unit = userRecord.profile?.validityUnit || 'MONTHS';
      if (unit === 'DAYS') {
        baseDate.setDate(baseDate.getDate() + val);
      } else {
        baseDate.setMonth(baseDate.getMonth() + val);
      }
      baseDate.setUTCHours(23, 59, 59, 999);
      newExpiredAt = baseDate;
    } else {
      // POSTPAID: next month's billingDay at 23:59:59 WIB
      const nextMonth = now.getUTCMonth() + 1;
      const nextYear = nextMonth > 11 ? now.getUTCFullYear() + 1 : now.getUTCFullYear();
      const nm = nextMonth % 12;
      const nextMonthLastDay = new Date(Date.UTC(nextYear, nm + 1, 0)).getUTCDate();
      newExpiredAt = new Date(Date.UTC(nextYear, nm, Math.min(bd, nextMonthLastDay), 23, 59, 59, 999));
    }

    // Update user status to active and advance expiredAt
    const updatedUser = await prisma.pppoeUser.update({
      where: { id },
      data: { 
        status: 'active',
        expiredAt: newExpiredAt,
        lastPaymentDate: now,
      },
      select: { username: true },
    });

    // 1. PRIMARY: Sync MikroTik Direct API (restore normal profile & kick active session)
    if (userRecord.profile && userRecord.routerId) {
      try {
        const { PPPSecretService } = await import('@/server/services/mikrotik/ppp-secret.service');
        const normalProfileName = userRecord.profile.mikrotikProfileName || userRecord.profile.name || userRecord.profile.groupName;
        await PPPSecretService.setProfileAndDisconnect(userRecord.routerId, userRecord.username, normalProfileName);
      } catch (mtErr: any) {
        console.error('[Mark Paid] MikroTik Direct API sync error (non-fatal):', mtErr?.message);
      }
    }

    // Clean up MikroTik firewall isolir address-list (Dual-Mode: RADIUS & Non-RADIUS)
    try {
      const { removeUserFromMikrotikAddressList } = await import('@/server/services/radius/coa-handler.service');
      removeUserFromMikrotikAddressList(userRecord.username, userRecord.routerId, 'isolir')
        .catch(err => console.error('[Mark Paid] Address-list un-isolir error:', err?.message));
    } catch (addrErr) {
      console.error('[Mark Paid] Could not load address-list cleaner:', addrErr);
    }

    // 2. SECONDARY: Restore RADIUS tables if RADIUS mode is enabled
    const company = await prisma.company.findFirst();
    if (company?.radiusEnabled && userRecord.profile) {
      try {
        // Remove any old rejection/suspension markers
        await prisma.radcheck.deleteMany({
          where: { username: userRecord.username, attribute: 'Auth-Type' },
        });
        await prisma.radcheck.deleteMany({
          where: { username: userRecord.username, attribute: 'NAS-IP-Address' },
        });
        await prisma.radreply.deleteMany({
          where: { username: userRecord.username, attribute: 'Reply-Message' },
        });

        // Ensure password exists in radcheck
        await prisma.$executeRaw`
          INSERT INTO radcheck (username, attribute, op, value)
          VALUES (${userRecord.username}, 'Cleartext-Password', ':=', ${userRecord.password})
          ON DUPLICATE KEY UPDATE value = ${userRecord.password}
        `;

        // Restore original subscription group
        await prisma.$executeRaw`
          DELETE FROM radusergroup WHERE username = ${userRecord.username}
        `;
        await prisma.$executeRaw`
          INSERT INTO radusergroup (username, groupname, priority)
          VALUES (${userRecord.username}, ${userRecord.profile.groupName}, 1)
        `;

        // Restore static IP
        await prisma.radreply.deleteMany({
          where: { username: userRecord.username, attribute: 'Framed-IP-Address' },
        });
        if (userRecord.ipAddress) {
          await prisma.$executeRaw`
            INSERT INTO radreply (username, attribute, op, value)
            VALUES (${userRecord.username}, 'Framed-IP-Address', ':=', ${userRecord.ipAddress})
            ON DUPLICATE KEY UPDATE value = ${userRecord.ipAddress}
          `;
        }

        const { disconnectPPPoEUser } = await import('@/server/services/radius/coa-handler.service');
        await disconnectPPPoEUser(userRecord.username);
      } catch (radiusError: any) {
        console.error('[Mark Paid] RADIUS restore error (non-fatal):', radiusError?.message);
      }
    }

    return NextResponse.json({
      success: true,
      markedCount,
      totalAmount,
      message: `${markedCount} tagihan telah dibayar (Total: Rp ${totalAmount.toLocaleString('id-ID')})`,
    });
  } catch (error) {
    console.error('Mark paid error:', error);
    return NextResponse.json(
      { error: 'Failed to mark invoices as paid' },
      { status: 500 }
    );
  }
}
