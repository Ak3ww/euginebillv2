import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');

    // Allow via super_admin session OR bypass secret
    if (secret !== 'eugine123') {
      const session = await getServerSession(authOptions);
      if (!session) {
        return NextResponse.json({ success: false, error: 'Unauthorized. Use ?secret=eugine123 or login as admin.' }, { status: 401 });
      }
    }

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
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: { id: true, invoiceNumber: true, amount: true, status: true, dueDate: true, createdAt: true }
        }
      }
    });

    const now = new Date();

    return NextResponse.json({
      success: true,
      nowServerUTC: now.toISOString(),
      nowServerLocalWIB: new Date(now.getTime() + 7 * 3600 * 1000).toISOString(),
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
