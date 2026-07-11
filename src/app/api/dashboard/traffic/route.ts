import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth/config";
import { prisma } from "@/server/db/client";

// Disable caching - always fetch fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get all active routers
    const routers = await prisma.router.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        nasname: true,
        ipAddress: true,
      },
    });

    if (routers.length === 0) {
      return NextResponse.json({
        success: true,
        routers: [],
        message: 'No active routers found',
      });
    }

    const company = await prisma.company.findFirst();
    const radiusEnabled = company?.radiusEnabled ?? true;

    const aggByNas = new Map<string, { rxBytes: number; txBytes: number; sessions: number }>();
    const aggByRouterId = new Map<string, { rxBytes: number; txBytes: number; sessions: number }>();

    if (radiusEnabled) {
      const sessionAggs = await prisma.radacct.groupBy({
        by: ['nasipaddress'],
        where: { acctstoptime: null },
        _sum: {
          acctinputoctets: true,
          acctoutputoctets: true,
        },
        _count: { radacctid: true },
      });

      for (const agg of sessionAggs) {
        aggByNas.set(agg.nasipaddress, {
          rxBytes: Number(agg._sum.acctoutputoctets ?? 0),
          txBytes: Number(agg._sum.acctinputoctets ?? 0),
          sessions: agg._count.radacctid,
        });
      }
    } else {
      const mikrotikSessionAggs = await prisma.mikrotikSession.groupBy({
        by: ['routerId'],
        where: { stopTime: null },
        _sum: {
          rxBytes: true,
          txBytes: true,
        },
        _count: { id: true },
      });

      for (const agg of mikrotikSessionAggs) {
        aggByRouterId.set(agg.routerId, {
          rxBytes: Number(agg._sum.rxBytes ?? 0),
          txBytes: Number(agg._sum.txBytes ?? 0),
          sessions: agg._count.id,
        });
      }
    }

    // Build response in the same format as the original RouterOSAPI-based route
    // so frontend components (TrafficMonitor, TrafficChartMonitor) work without changes.
    const routerTraffic = routers.map((router) => {
      let stats = { rxBytes: 0, txBytes: 0, sessions: 0 };
      if (radiusEnabled) {
        stats = aggByNas.get(router.nasname) || aggByNas.get(router.ipAddress) || stats;
      } else {
        stats = aggByRouterId.get(router.id) || stats;
      }

      return {
        routerId: router.id,
        routerName: router.name,
        interfaces: [
          {
            name: 'active-sessions',
            rxBytes: stats.rxBytes,
            txBytes: stats.txBytes,
            rxRate: 0, // calculated on frontend between polls
            txRate: 0,
            rxPackets: 0,
            txPackets: 0,
            running: stats.sessions > 0,
          },
        ],
      };
    });

    return NextResponse.json({
      success: true,
      routers: routerTraffic,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[Traffic] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch traffic data",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
