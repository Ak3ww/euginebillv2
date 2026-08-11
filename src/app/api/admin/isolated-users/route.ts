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

    const isolatedUsers = await prisma.pppoeUser.findMany({
      where: {
        status: { in: ['isolated', 'suspended'] }
      },
      select: {
        id: true,
        username: true,
        name: true,
        phone: true,
        email: true,
        status: true,
        expiredAt: true,
        createdAt: true,
        customerId: true,
        waNotificationEnabled: true,
        waNotificationNote: true,
        area: { select: { name: true } },
        profile: { select: { name: true, price: true } },
        invoices: {
          where: { status: { in: ['PENDING', 'OVERDUE'] } },
          select: {
            id: true,
            amount: true,
            invoiceNumber: true,
            dueDate: true,
            status: true,
            paymentLink: true,
            paymentToken: true,
          },
          orderBy: { createdAt: 'desc' },
        }
      },
      orderBy: { expiredAt: 'desc' }
    });

    const usernames = isolatedUsers.map((u: any) => u.username);
    const activeSessions = await prisma.radacct.findMany({
      where: { username: { in: usernames }, acctstoptime: null },
      select: { username: true, framedipaddress: true, acctstarttime: true, nasipaddress: true }
    });

    const sessionsMap = new Map();
    activeSessions.forEach((s: any) => sessionsMap.set(s.username, s));

    const result = isolatedUsers.map((user: any) => {
      const session = sessionsMap.get(user.username);
      const totalUnpaid = user.invoices.reduce((sum: number, inv: any) => sum + Number(inv.amount), 0);
      return {
        id: user.id,
        username: user.username,
        name: user.name,
        phone: user.phone,
        email: user.email,
        status: user.status,
        expiredAt: user.expiredAt,
        createdAt: user.createdAt,
        customerId: user.customerId || null,
        areaName: user.area?.name || null,
        profileName: user.profile?.name,
        profilePrice: user.profile?.price,
        waNotificationEnabled: user.waNotificationEnabled ?? true,
        waNotificationNote: user.waNotificationNote || null,
        unpaidInvoicesCount: user.invoices.length,
        totalUnpaid,
        unpaidInvoices: user.invoices,
        isOnline: !!session,
        ipAddress: session?.framedipaddress || null,
        loginTime: session?.acctstarttime || null,
        nasIp: session?.nasipaddress || null,
      };
    });

    const stats = {
      totalIsolated: result.length,
      totalOnline: result.filter((u: any) => u.isOnline).length,
      totalOffline: result.filter((u: any) => !u.isOnline).length,
      totalUnpaidAmount: result.reduce((sum: number, u: any) => sum + u.totalUnpaid, 0),
      totalUnpaidInvoices: result.reduce((sum: number, u: any) => sum + u.unpaidInvoicesCount, 0),
    };

    return NextResponse.json({ success: true, data: result, stats });

  } catch (error: any) {
    console.error('Get isolated users error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { userId, waNotificationEnabled, waNotificationNote } = body;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId required' }, { status: 400 });
    }

    const updated = await prisma.pppoeUser.update({
      where: { id: userId },
      data: {
        waNotificationEnabled: Boolean(waNotificationEnabled),
        waNotificationNote: waNotificationNote ?? null,
      },
      select: { id: true, username: true, waNotificationEnabled: true, waNotificationNote: true },
    });

    return NextResponse.json({ success: true, data: updated });

  } catch (error: any) {
    console.error('Update wa notification error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

