import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';
import { prisma } from '@/server/db/client';

async function handleGetCounts(userIds: string[]) {
  if (!userIds || userIds.length === 0) {
    return NextResponse.json({ success: true, counts: {} });
  }

  // Fetch unpaid invoices with user status & expiredAt to verify actual arrears
  const unpaidInvoices = await prisma.invoice.findMany({
    where: {
      userId: { in: userIds },
      status: { in: ['PENDING', 'OVERDUE'] },
    },
    select: {
      id: true,
      userId: true,
      dueDate: true,
      user: {
        select: {
          status: true,
          expiredAt: true,
        },
      },
    },
  });

  const countsMap: Record<string, number> = {};
  const now = new Date();

  for (const inv of unpaidInvoices) {
    if (!inv.userId) continue;

    // Safety check: if user is active and their expiredAt is already extended in the future (e.g. October),
    // it means their subscription for the current cycle is ALREADY paid and active.
    const userExpiredAt = inv.user?.expiredAt ? new Date(inv.user.expiredAt) : null;
    const isUserActive = inv.user?.status === 'active';

    if (isUserActive && userExpiredAt && userExpiredAt > now) {
      // 1. If invoice dueDate is in the future (not due yet) and user is already active, not an arrear
      if (inv.dueDate && new Date(inv.dueDate) > now) {
        continue;
      }
      // 2. If user expiredAt is already past the invoice dueDate by more than 1 day,
      // the period covered by this invoice is already paid/active
      if (inv.dueDate && userExpiredAt.getTime() > new Date(inv.dueDate).getTime() + 24 * 60 * 60 * 1000) {
        continue;
      }
    }

    countsMap[inv.userId] = (countsMap[inv.userId] || 0) + 1;
  }

  return NextResponse.json({
    success: true,
    counts: countsMap,
  });
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const userIds = searchParams.get('userIds')?.split(',').filter(Boolean) || [];

    return await handleGetCounts(userIds);
  } catch (error: any) {
    console.error('Get invoice counts error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get invoice counts' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    const userIds = Array.isArray(body.userIds) ? body.userIds : [];

    return await handleGetCounts(userIds);
  } catch (error: any) {
    console.error('Post invoice counts error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get invoice counts' },
      { status: 500 }
    );
  }
}
