import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('q') || 'EMG083';

    const users = await prisma.pppoeUser.findMany({
      where: {
        OR: [
          { username: { contains: search } },
          { name: { contains: search } },
          { customerId: { contains: search } },
          { pppoeCustomerId: { contains: search } },
        ]
      },
      include: {
        profile: { select: { id: true, name: true, price: true } },
        invoices: {
          take: 3,
          orderBy: { createdAt: 'desc' },
          select: { id: true, invoiceNumber: true, amount: true, status: true, dueDate: true, createdAt: true }
        }
      }
    });

    const now = new Date();

    return NextResponse.json({
      success: true,
      nowServerUTC: now.toISOString(),
      nowServerLocal: now.toLocaleString(),
      foundCount: users.length,
      users: users.map(u => ({
        id: u.id,
        username: u.username,
        name: u.name,
        phone: u.phone,
        status: u.status,
        subscriptionType: u.subscriptionType,
        expiredAtRaw: u.expiredAt,
        expiredAtISO: u.expiredAt ? new Date(u.expiredAt).toISOString() : null,
        isExpiredNow: u.expiredAt ? new Date(u.expiredAt) <= now : false,
        autoIsolationEnabled: u.autoIsolationEnabled,
        waNotificationEnabled: u.waNotificationEnabled,
        invoices: u.invoices,
      }))
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
