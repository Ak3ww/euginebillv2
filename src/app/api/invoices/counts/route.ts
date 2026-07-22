import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';
import { prisma } from '@/server/db/client';

async function handleGetCounts(userIds: string[]) {
  if (!userIds || userIds.length === 0) {
    return NextResponse.json({ success: true, counts: {} });
  }

  // Get unpaid invoice counts for each user
  const invoiceCounts = await prisma.invoice.groupBy({
    by: ['userId'],
    where: {
      userId: { in: userIds },
      status: { in: ['PENDING', 'OVERDUE'] },
    },
    _count: {
      id: true,
    },
  });

  // Convert to map for easier lookup
  const countsMap: Record<string, number> = {};
  invoiceCounts.forEach(item => {
    if (item.userId) {
      countsMap[item.userId] = item._count.id;
    }
  });

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
