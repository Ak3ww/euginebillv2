import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';
import { prisma } from '@/server/db/client';
import { unauthorized } from '@/lib/api-response';
import { findSmartMatchForOnu, CandidateCustomer } from '@/lib/olt/smart-matcher';

// GET - Preview Smart Auto-Assign for all or unassigned ONUs on this OLT
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorized();

  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const scope = searchParams.get('scope') || 'all'; // 'all' | 'unassigned'
    const minScoreParam = parseInt(searchParams.get('minScore') || '80', 10);
    const minScore = isNaN(minScoreParam) ? 80 : minScoreParam;

    const olt = await prisma.networkOLT.findUnique({
      where: { id },
      include: {
        routers: { select: { routerId: true } },
        onuStatuses: {
          include: {
            customer: { select: { id: true, username: true, name: true, phone: true, status: true, customerId: true } },
          },
          orderBy: [{ port: 'asc' }, { onuId: 'asc' }],
        },
      },
    });

    if (!olt) {
      return NextResponse.json({ error: 'OLT not found' }, { status: 404 });
    }

    const oltRouterIds = olt.routers.map((r) => r.routerId);

    // Fetch all customers (no status restriction — active, isolir, inactive, etc.)
    const rawCustomers = await prisma.pppoeUser.findMany({
      select: {
        id: true,
        username: true,
        name: true,
        phone: true,
        customerId: true,
        status: true,
        macAddress: true,
        routerId: true,
        router: { select: { name: true } },
      },
    });

    const candidates: CandidateCustomer[] = rawCustomers.map((c) => ({
      id: c.id,
      username: c.username,
      name: c.name,
      phone: c.phone,
      customerId: c.customerId,
      status: c.status,
      macAddress: c.macAddress,
      routerId: c.routerId,
      routerName: c.router?.name ?? null,
    }));

    // Filter ONUs based on scope
    const targetOnus = olt.onuStatuses.filter((onu) => {
      if (scope === 'unassigned') {
        return !onu.customerId;
      }
      return true; // 'all'
    });

    const previewList = targetOnus.map((onu) => {
      const { bestMatch, suggestions } = findSmartMatchForOnu(
        {
          serialNumber: onu.serialNumber,
          macAddress: onu.macAddress,
          description: onu.description,
        },
        candidates,
        {
          oltRouterIds,
          minScoreThreshold: minScore,
        }
      );

      let action: 'ASSIGN' | 'CHANGE' | 'KEEP' | 'NO_MATCH' = 'NO_MATCH';

      if (bestMatch) {
        if (!onu.customerId) {
          action = 'ASSIGN';
        } else if (onu.customerId === bestMatch.customer.id) {
          action = 'KEEP';
        } else {
          action = 'CHANGE';
        }
      }

      return {
        onuId: onu.id,
        location: `${onu.frame}/${onu.slot}/${onu.port}:${onu.onuId}`,
        serialNumber: onu.serialNumber,
        macAddress: onu.macAddress,
        description: onu.description,
        status: onu.status,
        rxPower: onu.rxPower,
        currentCustomer: onu.customer,
        matchedCustomer: bestMatch?.customer ?? null,
        score: bestMatch?.score ?? 0,
        matchType: bestMatch?.matchType ?? null,
        reason: bestMatch?.reason ?? (onu.description ? 'Tidak ada kecocokan di atas ambang batas' : 'Deskripsi OLT kosong'),
        action,
        suggestions: suggestions.slice(0, 3),
      };
    });

    const summary = {
      totalOnus: olt.onuStatuses.length,
      unassignedCount: olt.onuStatuses.filter((o) => !o.customerId).length,
      assignedCount: olt.onuStatuses.filter((o) => !!o.customerId).length,
      matchedToAssign: previewList.filter((p) => p.action === 'ASSIGN').length,
      matchedToChange: previewList.filter((p) => p.action === 'CHANGE').length,
      matchedKeep: previewList.filter((p) => p.action === 'KEEP').length,
      noMatchCount: previewList.filter((p) => p.action === 'NO_MATCH').length,
    };

    return NextResponse.json({
      success: true,
      summary,
      scope,
      minScore,
      items: previewList,
    });
  } catch (error: any) {
    console.error('[OLT Auto-Assign GET]', error);
    return NextResponse.json(
      { error: error.message ?? 'Gagal memproses analisis auto-assign' },
      { status: 500 }
    );
  }
}

// POST - Execute batch assignments
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorized();

  try {
    const { id } = await params;
    const body = await request.json();
    const { assignments } = body as {
      assignments: { onuId: string; customerId: string | null }[];
    };

    if (!Array.isArray(assignments) || assignments.length === 0) {
      return NextResponse.json(
        { error: 'Daftar penautan (assignments) wajib diisi' },
        { status: 400 }
      );
    }

    const olt = await prisma.networkOLT.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
    if (!olt) {
      return NextResponse.json({ error: 'OLT not found' }, { status: 404 });
    }

    let updatedCount = 0;
    const logs: string[] = [];

    // Execute in transaction chunks or sequential updates
    for (const item of assignments) {
      if (!item.onuId) continue;
      const updated = await prisma.oltOnuStatus.update({
        where: { id: item.onuId },
        data: { customerId: item.customerId || null },
        include: {
          customer: { select: { username: true, name: true } },
        },
      });
      updatedCount++;
      logs.push(
        `ONU ${updated.port}:${updated.onuId} (${updated.serialNumber || updated.description || 'N/A'}) -> ${updated.customer?.username ?? 'Unassigned'}`
      );
    }

    // Record audit log
    await prisma.oltMonitoringLog.create({
      data: {
        id: crypto.randomUUID(),
        oltId: id,
        logType: 'command',
        severity: 'info',
        message: `Smart Auto-Assign berhasil menautkan ${updatedCount} ONU pada OLT ${olt.name}`,
        data: { updatedCount, sampleLogs: logs.slice(0, 10) },
      },
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `Berhasil menautkan ${updatedCount} ONU`,
      updatedCount,
    });
  } catch (error: any) {
    console.error('[OLT Auto-Assign POST]', error);
    return NextResponse.json(
      { error: error.message ?? 'Gagal menerapkan penautan pelanggan' },
      { status: 500 }
    );
  }
}
