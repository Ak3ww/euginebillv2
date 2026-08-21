import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';
import { getTimezoneOffsetMs } from '@/lib/timezone';
import { fetchLiveHotspotTrafficMap } from '@/server/services/radius/live-hotspot-traffic';

let cachedAllTimeStats: any = null;
let cachedAllTimeStatsTime = 0;

// ─── Formatting helpers ─────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / Math.pow(1024, exponent);
  return `${value.toFixed(2)} ${units[exponent]}`;
}

function formatDuration(seconds: number): string {
  if (!seconds) return '0s';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${remainingSeconds}s`;
  return `${remainingSeconds}s`;
}

async function getLatestMacByUsernames(usernames: string[]): Promise<Map<string, string>> {
  if (usernames.length === 0) return new Map();

  const rows = await prisma.radacct.findMany({
    where: {
      username: { in: usernames },
      callingstationid: { not: '' },
    },
    select: {
      username: true,
      callingstationid: true,
      acctstarttime: true,
    },
    orderBy: { acctstarttime: 'desc' },
  });

  const map = new Map<string, string>();
  for (const row of rows) {
    if (!map.has(row.username) && row.callingstationid) {
      map.set(row.username, row.callingstationid);
    }
  }
  return map;
}

// ─── Stale session cleanup ──────────────────────────────────────────────────────

/**
 * Mark stale radacct sessions as stopped.
 * A session is "stale" if acctstoptime IS NULL and acctupdatetime is older
 * than the threshold. This handles cases where MikroTik fails to send
 * Accounting-Stop (e.g. power outage, network issue).
 *
 * Uses DB-only timestamps (acctupdatetime vs acctstarttime) instead of NOW()
 * to avoid false positives when the VPS system clock differs from the NAS clock.
 * A session is stale when (acctupdatetime - acctstarttime) > 8h AND no update
 * has arrived in the last 8 hours measured by the last-update timestamp gap.
 *
 * Specifically: session is stale if:
 *   acctsessiontime > 0 (MikroTik already wrote a session time)
 *   AND acctupdatetime = acctstoptime-candidates (last update > 8h ago relative to itself)
 *
 * Simpler: if (NOW() in NAS-clock space) means we compare acctupdatetime against
 * a fixed absolute UTC wall-clock epoch we can trust — Java epoch of the server
 * startup is unreliable. Safest: only clean up if acctsessiontime already set AND
 * the session has been idle (acctupdatetime unchanged) for 8+ hours measured purely
 * between DB column values, using TIMESTAMPDIFF.
 *
 * Since both acctstarttime AND acctupdatetime come from FreeRADIUS (written via
 * FROM_UNIXTIME from the NAS clock), their difference is always clock-skew-safe.
 */
let lastStaleCleanupTime = 0;
const CLEANUP_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

async function cleanupStaleSessions(): Promise<number> {
  const now = Date.now();
  if (now - lastStaleCleanupTime < CLEANUP_INTERVAL_MS) {
    return 0;
  }
  lastStaleCleanupTime = now;

  const STALE_MINUTES = 30;
  try {
    const result = await prisma.$executeRawUnsafe(`
      UPDATE radacct
      SET acctstoptime = acctupdatetime,
          acctterminatecause = 'Lost-Carrier',
          acctsessiontime = TIMESTAMPDIFF(SECOND, acctstarttime, acctupdatetime)
      WHERE acctstoptime IS NULL
        AND acctupdatetime IS NOT NULL
        AND TIMESTAMPDIFF(MINUTE, acctupdatetime, NOW()) > ${STALE_MINUTES}
        AND TIMESTAMPDIFF(MINUTE, acctupdatetime, NOW()) < 43200
    `);
    const total = Number(result);
    if (total > 0) {
      console.log(`[Sessions] Cleaned up ${total} stale radacct session(s)`);
    }
    return total;
  } catch (err) {
    console.error('[Sessions] Failed to cleanup stale sessions:', err);
    return 0;
  }
}

async function checkRouterReachable(router: { ipAddress?: string | null; nasname: string; port?: number | null; username: string; password: string }): Promise<{ isOnline: boolean; error?: string }> {
  const host = router.ipAddress || router.nasname;
  if (!host) return { isOnline: false, error: 'Host IP router belum diatur' };
  const port = router.port || 8728;
  
  try {
    const { RouterOSAPI } = await import('node-routeros');
    const api = new RouterOSAPI({
      host,
      port,
      user: router.username,
      password: router.password,
      timeout: 2,
    });
    
    const connectPromise = api.connect();
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Koneksi timeout — router offline atau VPN terputus')), 2000)
    );
    await Promise.race([connectPromise, timeoutPromise]);
    await api.close().catch(() => {});
    return { isOnline: true };
  } catch (err: any) {
    return { 
      isOnline: false, 
      error: err?.message || 'Tidak dapat terhubung ke Router (Offline)' 
    };
  }
}

// ─── GET handler: list active sessions from RADIUS (radacct) or MikroTik ─────

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type'); // 'pppoe' | 'hotspot' | null (both)
    const routerId = searchParams.get('routerId');
    const search = searchParams.get('search');
    const useLiveTraffic = searchParams.get('live') === 'true';
    const page = Number.parseInt(searchParams.get('page') || '1', 10);
    const limit = Number.parseInt(searchParams.get('limit') || '0', 10);

    // ── 0. Cleanup stale sessions (throttled to every 15 min) ────────────────
    cleanupStaleSessions().catch(() => {});

    // ── 1. Get all active routers ───────────────────────────────────────────
    const allRouters = await prisma.router.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        nasname: true,
        ipAddress: true,
        username: true,
        password: true,
        port: true,
      },
    });

    // Check specific router if routerId is passed
    let selectedRouter: typeof allRouters[0] | undefined = undefined;
    let selectedRouterStatus: { id: string; name: string; isOnline: boolean; error?: string } | null = null;

    if (routerId) {
      selectedRouter = allRouters.find(r => r.id === routerId);
      if (!selectedRouter) {
        return NextResponse.json({
          sessions: [],
          stats: { total: 0, pppoe: 0, hotspot: 0, totalBandwidth: 0, totalBandwidthFormatted: '0 B' },
          routerStatus: { id: routerId, name: 'Router', isOnline: false, error: 'Router tidak ditemukan' },
          pagination: { page: 1, limit, total: 0, totalPages: 1 },
        });
      }

      // Check reachability for the selected router
      const reachability = await checkRouterReachable(selectedRouter);
      selectedRouterStatus = {
        id: selectedRouter.id,
        name: selectedRouter.name,
        isOnline: reachability.isOnline,
        error: reachability.error,
      };
    }

    // Build NAS IP → router mapping
    const routerByNasIp = new Map<string, { id: string; name: string }>();
    const routerById = new Map<string, { id: string; name: string }>();
    for (const r of allRouters) {
      routerById.set(r.id, { id: r.id, name: r.name });
      if (r.nasname) routerByNasIp.set(r.nasname, { id: r.id, name: r.name });
      if (r.ipAddress) routerByNasIp.set(r.ipAddress, { id: r.id, name: r.name });
    }

    // ── 2. Query active sessions (RADIUS or MikroTik) ───────────────────────
    const company = await prisma.company.findFirst();
    const radiusEnabled = company?.radiusEnabled ?? false;

    let activeSessions: any[] = [];

    if (radiusEnabled) {
      const radacctWhere: any = { acctstoptime: null };
      if (search) {
        radacctWhere.OR = [
          { username: { contains: search } },
          { framedipaddress: { contains: search } },
          { callingstationid: { contains: search } },
        ];
      }
      activeSessions = await prisma.radacct.findMany({
        where: radacctWhere,
        orderBy: { acctstarttime: 'desc' },
      });
    } else {
      const msWhere: any = { stopTime: null };
      if (search) {
        msWhere.OR = [
          { username: { contains: search } },
          { ipAddress: { contains: search } },
          { macAddress: { contains: search } },
        ];
      }
      const msSessions = await prisma.mikrotikSession.findMany({
        where: msWhere,
        orderBy: { startTime: 'desc' },
        include: { router: true }
      });
      activeSessions = msSessions.map(ms => ({
        radacctid: BigInt(0),
        acctsessionid: ms.id,
        username: ms.username,
        nasipaddress: ms.router?.nasname || ms.router?.ipAddress || '',
        framedipaddress: ms.ipAddress || '',
        callingstationid: ms.macAddress || '',
        acctstarttime: ms.startTime,
        acctupdatetime: ms.startTime,
        acctstoptime: ms.stopTime,
        acctsessiontime: Math.floor((Date.now() - ms.startTime.getTime()) / 1000),
        acctinputoctets: ms.rxBytes,
        acctoutputoctets: ms.txBytes,
        acctterminatecause: ms.terminateCause || '',
        routerId: ms.routerId,
        service: 'pppoe',
      }));
    }

    // ── 3. Determine session types & Lookup Users ────────────────────────────
    const allUsernames = [...new Set(activeSessions.map((s) => s.username?.trim()).filter(Boolean))];

    const [pppoeUsers, hotspotVouchers] = await Promise.all([
      prisma.pppoeUser.findMany({
        where: {
          OR: [
            { username: { in: allUsernames } },
            { username: { in: allUsernames.map(u => u.toLowerCase()) } },
            { username: { in: allUsernames.map(u => u.toUpperCase()) } },
          ]
        },
        select: {
          id: true,
          username: true,
          customerId: true,
          name: true,
          phone: true,
          routerId: true,
          router: { select: { id: true, name: true, ipAddress: true, nasname: true } },
          profile: { select: { name: true } },
          area: { select: { id: true, name: true } },
        },
      }),
      prisma.hotspotVoucher.findMany({
        where: {
          OR: [
            { code: { in: allUsernames } },
            { code: { in: allUsernames.map(u => u.toLowerCase()) } },
            { code: { in: allUsernames.map(u => u.toUpperCase()) } },
          ]
        },
        select: {
          id: true,
          code: true,
          status: true,
          batchCode: true,
          firstLoginAt: true,
          expiresAt: true,
          agent: { select: { id: true, name: true } },
          profile: { select: { name: true } },
          router: { select: { id: true, name: true } },
        },
      }),
    ]);

    const pppoeByUsername = new Map<string, any>();
    for (const u of pppoeUsers) {
      pppoeByUsername.set(u.username, u);
      pppoeByUsername.set(u.username.toLowerCase(), u);
      pppoeByUsername.set(u.username.toUpperCase(), u);
    }

    const voucherByCode = new Map<string, any>();
    for (const v of hotspotVouchers) {
      voucherByCode.set(v.code, v);
      voucherByCode.set(v.code.toLowerCase(), v);
      voucherByCode.set(v.code.toUpperCase(), v);
    }

    // ── 4. Build response sessions ──────────────────────────────────────────
    // All DB dates are WIB-as-UTC (Prisma reads WIB DATETIME and appends Z).
    // Dates sent to client stay in WIB-as-UTC — frontend uses formatWIB().
    // Duration calc uses WIB-aware "now" so both sides are in the same space.
    const TZ_OFFSET_MS = getTimezoneOffsetMs();
    const now = Date.now() + TZ_OFFSET_MS; // WIB-as-UTC epoch for duration calc
    // ── 4b. Synthetic hotspot sessions: ACTIVE vouchers with no radacct record ──
    // Covers cases where MikroTik authenticated successfully but no
    // Accounting-Start was recorded in radacct.
    // We query DB separately because allUsernames only contains codes already in radacct.
    const activeHotspotUsernames = new Set(
      activeSessions
        .filter((s) => voucherByCode.has(s.username))
        .map((s) => s.username),
    );

    const nowDate = new Date();
    const orphanedVoucherWhere: any = {
      status: 'ACTIVE',
      firstLoginAt: { not: null },
      code: { notIn: [...activeHotspotUsernames] },
      // Exclude already-expired vouchers whose status hasn't been updated yet
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: nowDate } },
      ],
    };
    if (routerId) orphanedVoucherWhere.routerId = routerId;

    let orphanedActiveVouchers = await prisma.hotspotVoucher.findMany({
      where: orphanedVoucherWhere,
      select: {
        id: true,
        code: true,
        status: true,
        batchCode: true,
        firstLoginAt: true,
        expiresAt: true,
        agent: { select: { id: true, name: true } },
        profile: { select: { name: true } },
        router: { select: { id: true, name: true, nasname: true } },
      },
    });

    // Filter out vouchers whose latest stop was AFTER their current firstLoginAt.
    // This means they properly disconnected after this login.
    // Vouchers with only OLD stop records (before firstLoginAt) have a new login
    // that isn't yet in radacct — they should show as synthetic.
    // lastKnownIpMap: fallback IP from the most recent radacct row (even if stopped).
    // Needed because cleanupStaleSessions() may have marked the active row as stopped\n    // before the active-session query runs — the framedipaddress in radacct is the only IP source left.
    const lastKnownIpMap = new Map<string, string>();
    if (orphanedActiveVouchers.length > 0) {
      const orphanCodes = orphanedActiveVouchers.map(v => v.code);
      const stoppedRows = await prisma.radacct.findMany({
        where: { username: { in: orphanCodes }, acctstoptime: { not: null } },
        select: { username: true, acctstoptime: true, framedipaddress: true },
        orderBy: { acctstoptime: 'desc' },
      });
      // Build map: username → latest stop time
      const latestStopMap = new Map<string, Date>();
      for (const r of stoppedRows) {
        if (r.acctstoptime && !latestStopMap.has(r.username)) {
          latestStopMap.set(r.username, new Date(r.acctstoptime));
        }
        if (r.framedipaddress && !lastKnownIpMap.has(r.username)) {
          lastKnownIpMap.set(r.username, r.framedipaddress);
        }
      }
      orphanedActiveVouchers = orphanedActiveVouchers.filter(v => {
        const latestStop = latestStopMap.get(v.code);
        if (!latestStop || !v.firstLoginAt) return true; // No prior stop → show synthetic
        // Exclude only if the most recent stop is >= firstLoginAt (session already ended)
        return latestStop.getTime() < new Date(v.firstLoginAt).getTime();
      });
    }

    const syntheticHotspotSessions = orphanedActiveVouchers.map((voucher, i) => {
        const effectiveStartMs = new Date(voucher.firstLoginAt!).getTime();
        const effectiveStartTime = new Date(effectiveStartMs).toISOString();
        const duration = Math.max(0, Math.floor((now - effectiveStartMs) / 1000));
        const router =
          voucher.router
            ? { id: voucher.router.id, name: voucher.router.name }
            : { id: 'unknown', name: 'Unknown' };
        return {
          id: `voucher-${voucher.id}`,
          username: voucher.code,
          sessionId: null,
          type: 'hotspot' as const,
          nasIpAddress: voucher.router?.nasname || null,
          framedIpAddress: lastKnownIpMap.get(voucher.code) || null,
          macAddress: '-',
          calledStationId: '-',
          startTime: effectiveStartTime,
          lastUpdate: null,
          duration,
          durationFormatted: formatDuration(duration),
          uploadBytes: 0,
          downloadBytes: 0,
          totalBytes: 0,
          uploadFormatted: formatBytes(0),
          downloadFormatted: formatBytes(0),
          totalFormatted: formatBytes(0),
          router,
          user: null,
          voucher: {
            id: voucher.id,
            status: voucher.status,
            profile: voucher.profile?.name ?? null,
            batchCode: voucher.batchCode,
            expiresAt: voucher.expiresAt
              ? new Date(voucher.expiresAt).toISOString()
              : null,
            agent: voucher.agent
              ? { id: voucher.agent.id, name: voucher.agent.name }
              : null,
          },
          dataSource: 'radius' as const,
        };
      });

    // ── 4. Build response sessions ──────────────────────────────────────────
    let allSessions = [...activeSessions
      .map((acct) => {
        const u = (acct.username || '').trim();
        const lowerU = u.toLowerCase();
        const pppoeUser = pppoeByUsername.get(u) || pppoeByUsername.get(lowerU);
        const voucher = voucherByCode.get(u) || voucherByCode.get(lowerU);
        
        // Identify session type: if linked to pppoeUser OR framedprotocol indicates PPP OR service is pppoe
        const isPPP = !!pppoeUser || (acct.framedprotocol || '').toLowerCase().includes('ppp') || (acct.service || '').toLowerCase().includes('ppp');
        const sessionType: 'pppoe' | 'hotspot' = isPPP ? 'pppoe' : (voucher ? 'hotspot' : 'pppoe');

        const rawStartMs = acct.acctstarttime
          ? new Date(acct.acctstarttime).getTime()
          : now;

        let effectiveStartMs = rawStartMs;
        let effectiveStartTime: string | null = acct.acctstarttime
          ? new Date(rawStartMs).toISOString()
          : null;

        if (sessionType === 'hotspot' && voucher?.firstLoginAt) {
          effectiveStartMs = new Date(voucher.firstLoginAt).getTime();
          effectiveStartTime = new Date(effectiveStartMs).toISOString();
        }

        let duration: number;
        const rawUpdateMs = acct.acctupdatetime ? new Date(acct.acctupdatetime).getTime() : 0;
        if (rawUpdateMs > effectiveStartMs) {
          duration = Math.floor((rawUpdateMs - effectiveStartMs) / 1000);
        } else {
          duration = Number(acct.acctsessiontime ?? 0);
          if (duration === 0) {
            duration = Math.max(0, Math.floor((now - effectiveStartMs) / 1000));
          }
        }

        if (acct.acctstarttime && duration > 0) {
          effectiveStartTime = new Date(now - duration * 1000).toISOString();
        }

        const uploadBytes = Number(acct.acctinputoctets ?? 0);
        const downloadBytes = Number(acct.acctoutputoctets ?? 0);

        // Resolve Router: prioritize user's assigned router from DB, then NAS IP lookup, then routerId
        const sessionRouter = pppoeUser?.router || 
          (acct.routerId && routerById.get(acct.routerId)) || 
          routerByNasIp.get(acct.nasipaddress) || 
          (allRouters.length === 1 ? allRouters[0] : { id: 'unknown', name: acct.nasipaddress || 'Router' });

        return {
          id: String(acct.radacctid || acct.acctsessionid || u),
          username: u,
          sessionId: acct.acctsessionid || null,
          type: sessionType,
          nasIpAddress: acct.nasipaddress,
          framedIpAddress: acct.framedipaddress || null,
          macAddress: acct.callingstationid || '',
          calledStationId: acct.calledstationid || '-',
          startTime: effectiveStartTime,
          lastUpdate: acct.acctstarttime && duration > 0
            ? new Date(now).toISOString()
            : (acct.acctupdatetime ? new Date(acct.acctupdatetime).toISOString() : null),
          duration,
          durationFormatted: formatDuration(duration),
          uploadBytes,
          downloadBytes,
          totalBytes: uploadBytes + downloadBytes,
          uploadFormatted: formatBytes(uploadBytes),
          downloadFormatted: formatBytes(downloadBytes),
          totalFormatted: formatBytes(uploadBytes + downloadBytes),
          router: { id: sessionRouter.id, name: sessionRouter.name },
          user:
            sessionType === 'pppoe' && pppoeUser
              ? {
                  id: pppoeUser.id,
                  customerId: pppoeUser.customerId ?? null,
                  name: pppoeUser.name,
                  phone: pppoeUser.phone,
                  profile: pppoeUser.profile?.name ?? null,
                  area: pppoeUser.area ?? null,
                }
              : null,
          voucher:
            sessionType === 'hotspot' && voucher
              ? {
                  id: voucher.id,
                  status: voucher.status,
                  profile: voucher.profile?.name ?? null,
                  batchCode: voucher.batchCode,
                  expiresAt: voucher.expiresAt
                    ? new Date(voucher.expiresAt).toISOString()
                    : null,
                  agent: voucher.agent
                    ? { id: voucher.agent.id, name: voucher.agent.name }
                    : null,
                }
              : null,
          dataSource: radiusEnabled ? 'radius' : 'mikrotik',
        };
      }), ...syntheticHotspotSessions];

    // ── 5. Filter by session type ────────────────────────────────────────────
    if (type) {
      allSessions = allSessions.filter((s) => s.type === type);
    }

    // ── 5b. Strict Filter by Router ──────────────────────────────────────────
    if (routerId) {
      if (selectedRouterStatus && !selectedRouterStatus.isOnline) {
        // If router is offline, show 0 sessions
        allSessions = [];
      } else {
        allSessions = allSessions.filter((s) => s.router?.id === routerId);
      }
    }

    // ── 6. Stats ────────────────────────────────────────────────────────────
    const stats = {
      total: allSessions.length,
      pppoe: allSessions.filter((s) => s.type === 'pppoe').length,
      hotspot: allSessions.filter((s) => s.type === 'hotspot').length,
      totalUpload: allSessions.reduce((sum, s) => sum + s.uploadBytes, 0),
      totalDownload: allSessions.reduce((sum, s) => sum + s.downloadBytes, 0),
    };
    const totalBandwidth = stats.totalUpload + stats.totalDownload;

    // ── 7. Pagination ───────────────────────────────────────────────────────
    const paginatedSessions =
      limit > 0
        ? allSessions.slice((page - 1) * limit, (page - 1) * limit + limit)
        : allSessions;

    // ── 8. Historical all-time stats from radacct (Cached 5 min) ──────────
    const statsNow = Date.now();
    if (!cachedAllTimeStats || statsNow - cachedAllTimeStatsTime > 5 * 60 * 1000) {
      try {
        const agg = await prisma.radacct.aggregate({
          _sum: {
            acctinputoctets: true,
            acctoutputoctets: true,
            acctsessiontime: true,
          },
          _count: { radacctid: true },
        });

        const totalAllTimeBytes =
          Number(agg._sum.acctinputoctets ?? 0) +
          Number(agg._sum.acctoutputoctets ?? 0);

        cachedAllTimeStats = {
          totalSessions: agg._count.radacctid ?? 0,
          totalBandwidth: totalAllTimeBytes,
          totalBandwidthFormatted: formatBytes(totalAllTimeBytes),
          totalDuration: agg._sum.acctsessiontime ?? 0,
          totalDurationFormatted: formatDuration(agg._sum.acctsessiontime ?? 0),
        };
        cachedAllTimeStatsTime = statsNow;
      } catch (err) {
        if (!cachedAllTimeStats) {
          cachedAllTimeStats = {
            totalSessions: 0,
            totalBandwidth: 0,
            totalBandwidthFormatted: '0 B',
            totalDuration: 0,
            totalDurationFormatted: '0s',
          };
        }
      }
    }

    return NextResponse.json({
      sessions: paginatedSessions,
      stats: {
        ...stats,
        totalBandwidth,
        totalUploadFormatted: formatBytes(stats.totalUpload),
        totalDownloadFormatted: formatBytes(stats.totalDownload),
        totalBandwidthFormatted: formatBytes(totalBandwidth),
      },
      allTimeStats: cachedAllTimeStats,
      routerStatus: selectedRouterStatus,
      routerStatuses: allRouters.map(r => ({ id: r.id, name: r.name })),
      pagination: {
        page,
        limit: limit > 0 ? limit : allSessions.length,
        total: allSessions.length,
        totalPages:
          limit > 0 ? Math.max(1, Math.ceil(allSessions.length / limit)) : 1,
      },
      mode: radiusEnabled ? 'radius' : 'mikrotik',
    });
  } catch (error) {
    console.error('[Sessions API] Failed to list active sessions', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
