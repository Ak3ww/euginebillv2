import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status') || 'all';
    const search = searchParams.get('search') || '';
    const period = searchParams.get('period') || '24h'; // 24h, 7d, 30d, all, custom
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const skip = (page - 1) * limit;

    // Date range filter clause
    let dateFilter: { gte?: Date; lte?: Date } | undefined = undefined;
    const now = new Date();

    if (period === '24h') {
      const d = new Date(now);
      d.setHours(d.getHours() - 24);
      dateFilter = { gte: d };
    } else if (period === '7d') {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      dateFilter = { gte: d };
    } else if (period === '30d') {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      dateFilter = { gte: d };
    } else if (period === 'custom' && (startDate || endDate)) {
      dateFilter = {};
      if (startDate) dateFilter.gte = new Date(startDate);
      if (endDate) {
        const endD = new Date(endDate);
        endD.setHours(23, 59, 59, 999);
        dateFilter.lte = endD;
      }
    }

    // Build where clause for table listing
    const where: any = {};
    if (status !== 'all') {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { phone: { contains: search } },
        { message: { contains: search } },
      ];
    }
    if (dateFilter) {
      where.sentAt = dateFilter;
    }

    // Get total count for paginated list
    const total = await prisma.whatsapp_history.count({ where });

    // Get history records
    const history = await prisma.whatsapp_history.findMany({
      where,
      orderBy: { sentAt: 'desc' },
      skip,
      take: limit,
    });

    // Compute stats FOR THE SELECTED PERIOD (ignoring status filter so stats cards show breakdown for the whole period)
    const statsWhere: any = {};
    if (dateFilter) statsWhere.sentAt = dateFilter;
    if (search) {
      statsWhere.OR = [
        { phone: { contains: search } },
        { message: { contains: search } },
      ];
    }

    const periodStats = await prisma.whatsapp_history.groupBy({
      by: ['status'],
      where: statsWhere,
      _count: true,
    });

    const totalInPeriod = periodStats.reduce((sum, s) => sum + s._count, 0);
    const sentInPeriod = periodStats.find(s => s.status === 'sent')?._count || 0;
    const failedInPeriod = periodStats.find(s => s.status === 'failed')?._count || 0;

    // Also get last 24h count for quick reference
    const last24hDate = new Date();
    last24hDate.setHours(last24hDate.getHours() - 24);
    const last24hTotal = await prisma.whatsapp_history.count({
      where: { sentAt: { gte: last24hDate } },
    });

    const stats = {
      total: totalInPeriod,
      sent: sentInPeriod,
      failed: failedInPeriod,
      last24Hours: last24hTotal,
      period,
    };

    return NextResponse.json({
      success: true,
      data: history,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats,
    });
  } catch (error: any) {
    console.error('History API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch history' },
      { status: 500 }
    );
  }
}
