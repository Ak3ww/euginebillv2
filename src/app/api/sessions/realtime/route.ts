import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/server/auth/config'
import { prisma } from '@/server/db/client'
import { RouterOSAPI } from 'node-routeros'

export const dynamic = 'force-dynamic'

// Helper to format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// Helper to format duration
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${secs}s`
  return `${secs}s`
}

// Parse MikroTik uptime format (e.g., "1h30m45s", "5m20s", "30s")
function parseUptime(uptime: string): number {
  let seconds = 0
  const weeks = uptime.match(/(\d+)w/)
  const days = uptime.match(/(\d+)d/)
  const hours = uptime.match(/(\d+)h/)
  const minutes = uptime.match(/(\d+)m/)
  const secs = uptime.match(/(\d+)s/)
  if (weeks) seconds += parseInt(weeks[1]) * 7 * 24 * 3600
  if (days) seconds += parseInt(days[1]) * 24 * 3600
  if (hours) seconds += parseInt(hours[1]) * 3600
  if (minutes) seconds += parseInt(minutes[1]) * 60
  if (secs) seconds += parseInt(secs[1])
  return seconds
}

// Connect to MikroTik router
function makeApi(router: { ipAddress?: string | null; nasname: string; port?: number | null; username: string; password: string }) {
  return new RouterOSAPI({
    host: router.ipAddress || router.nasname,
    port: router.port || 8728,
    user: router.username,
    password: router.password,
    timeout: 5,
  })
}

// Get live hotspot sessions from MikroTik API
async function getHotspotSessionsFromMikrotik(router: any): Promise<{ sessions: any[]; error?: string }> {
  const api = makeApi(router)
  try {
    await api.connect()
    const activeUsers = await api.write('/ip/hotspot/active/print')
    await api.close()
    const sessions = activeUsers.map((user: any) => ({
      type: 'hotspot',
      username: user.user || user.username || '',
      macAddress: user['mac-address'] || '',
      ipAddress: user.address || '',
      uptime: user.uptime || '0s',
      uptimeSeconds: parseUptime(user.uptime || '0s'),
      uploadBytes: parseInt(user['bytes-in'] || '0'),
      downloadBytes: parseInt(user['bytes-out'] || '0'),
      packetsIn: parseInt(user['packets-in'] || '0'),
      packetsOut: parseInt(user['packets-out'] || '0'),
      server: user.server || '',
      sessionId: user['session-id'] || '',
    }))
    return { sessions }
  } catch (error: any) {
    console.error(`[realtime] Hotspot fetch failed for ${router.name}:`, error?.message || error)
    return { sessions: [], error: error?.message || 'Connection failed' }
  }
}

// Get live PPPoE sessions from MikroTik API
async function getPPPoESessionsFromMikrotik(router: any): Promise<{ sessions: any[]; error?: string }> {
  const api = makeApi(router)
  try {
    await api.connect()
    const activePPP = await api.write('/ppp/active/print')
    await api.close()
    const sessions = activePPP.map((user: any) => ({
      type: 'pppoe',
      username: user.name || user.username || '',
      macAddress: user['caller-id'] || '',
      ipAddress: user.address || user['local-address'] || '',
      uptime: user.uptime || '0s',
      uptimeSeconds: parseUptime(user.uptime || '0s'),
      uploadBytes: parseInt(user['bytes-in'] || '0'),
      downloadBytes: parseInt(user['bytes-out'] || '0'),
      packetsIn: parseInt(user['packets-in'] || '0'),
      packetsOut: parseInt(user['packets-out'] || '0'),
      sessionId: user['session-id'] || user['.id'] || '',
      service: user.service || '',
    }))
    return { sessions }
  } catch (error: any) {
    console.error(`[realtime] PPPoE fetch failed for ${router.name}:`, error?.message || error)
    return { sessions: [], error: error?.message || 'Connection failed' }
  }
}

/**
 * GET /api/sessions/realtime
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const searchParams = request.nextUrl.searchParams
    const routerId = searchParams.get('routerId')
    const typeFilter = searchParams.get('type') // hotspot | pppoe | null
    const search = searchParams.get('search')
    const forceApi = searchParams.get('forceApi') === 'true'

    const routerWhere: any = { isActive: true }
    if (routerId) routerWhere.id = routerId

    const routers = await prisma.router.findMany({
      where: routerWhere,
      select: {
        id: true,
        name: true,
        nasname: true,
        ipAddress: true,
        username: true,
        password: true,
        port: true,
      },
    })

    if (routers.length === 0) {
      return NextResponse.json({
        sessions: [],
        stats: { total: 0, hotspot: 0, pppoe: 0, totalBandwidth: 0, totalBandwidthFormatted: '0 B' },
        source: 'database',
        note: 'No active routers found in database',
        routerStatuses: [],
      })
    }

    let formattedSessions: any[] = []
    let sourceUsed = 'database'

    // ── 1. Fast Local DB Read (if not forceApi) ──────────────────────────────
    if (!forceApi) {
      const nasIpList = routers.map((r) => r.ipAddress || r.nasname).filter(Boolean)

      const [dbRadacct, dbMikrotikSessions] = await Promise.all([
        prisma.radacct
          .findMany({
            where: {
              acctstoptime: null,
              ...(nasIpList.length > 0 ? { nasipaddress: { in: nasIpList as string[] } } : {}),
              ...(search
                ? {
                    OR: [
                      { username: { contains: search } },
                      { framedipaddress: { contains: search } },
                      { callingstationid: { contains: search } },
                    ],
                  }
                : {}),
            },
            orderBy: { acctstarttime: 'desc' },
          })
          .catch(() => []),
        prisma.mikrotikSession
          .findMany({
            where: {
              stopTime: null,
              ...(routerId ? { routerId } : {}),
              ...(search
                ? {
                    OR: [
                      { username: { contains: search } },
                      { ipAddress: { contains: search } },
                      { macAddress: { contains: search } },
                    ],
                  }
                : {}),
            },
            include: { router: { select: { id: true, name: true, nasname: true, ipAddress: true } } },
          })
          .catch(() => []),
      ])

      if (dbRadacct.length > 0 || dbMikrotikSessions.length > 0) {
        const routerMapByIp = new Map<string, { id: string; name: string }>()
        for (const r of routers) {
          if (r.ipAddress) routerMapByIp.set(r.ipAddress, { id: r.id, name: r.name })
          if (r.nasname) routerMapByIp.set(r.nasname, { id: r.id, name: r.name })
        }

        const seenUsernames = new Set<string>()

        // Process radacct active sessions
        for (const ra of dbRadacct) {
          if (seenUsernames.has(ra.username)) continue
          seenUsernames.add(ra.username)

          const type = (ra.framedprotocol || '').toLowerCase().includes('ppp') ? 'pppoe' : 'hotspot'
          if (typeFilter && typeFilter !== type) continue

          const uploadBytes = Number(ra.acctinputoctets || 0)
          const downloadBytes = Number(ra.acctoutputoctets || 0)
          const totalBytes = uploadBytes + downloadBytes
          const uptimeSec =
            ra.acctsessiontime ||
            (ra.acctstarttime ? Math.floor((Date.now() - new Date(ra.acctstarttime).getTime()) / 1000) : 0)

          const rInfo = routerMapByIp.get(ra.nasipaddress) || { id: routerId || 'unknown', name: ra.nasipaddress }

          formattedSessions.push({
            id: `rad-${ra.radacctid}`,
            username: ra.username,
            sessionId: ra.acctsessionid,
            type,
            nasIpAddress: ra.nasipaddress,
            framedIpAddress: ra.framedipaddress,
            macAddress: ra.callingstationid,
            startTime: ra.acctstarttime ? new Date(ra.acctstarttime).toISOString() : new Date().toISOString(),
            duration: uptimeSec,
            durationFormatted: formatDuration(uptimeSec),
            uploadBytes,
            downloadBytes,
            totalBytes,
            uploadFormatted: formatBytes(uploadBytes),
            downloadFormatted: formatBytes(downloadBytes),
            totalFormatted: formatBytes(totalBytes),
            router: rInfo,
            source: 'radius-accounting',
          })
        }

        // Process mikrotikSession active sessions
        for (const ms of dbMikrotikSessions) {
          if (seenUsernames.has(ms.username)) continue
          seenUsernames.add(ms.username)

          const uploadBytes = Number(ms.txBytes || 0)
          const downloadBytes = Number(ms.rxBytes || 0)
          const totalBytes = uploadBytes + downloadBytes
          const uptimeSec = ms.uptime
            ? parseUptime(ms.uptime)
            : Math.floor((Date.now() - new Date(ms.startTime).getTime()) / 1000)

          formattedSessions.push({
            id: `ms-${ms.id}`,
            username: ms.username,
            sessionId: ms.id,
            type: 'pppoe',
            nasIpAddress: ms.router?.ipAddress || ms.router?.nasname || '-',
            framedIpAddress: ms.ipAddress || '-',
            macAddress: ms.macAddress || '-',
            startTime: new Date(ms.startTime).toISOString(),
            duration: uptimeSec,
            durationFormatted: formatDuration(uptimeSec),
            uploadBytes,
            downloadBytes,
            totalBytes,
            uploadFormatted: formatBytes(uploadBytes),
            downloadFormatted: formatBytes(downloadBytes),
            totalFormatted: formatBytes(totalBytes),
            router: { id: ms.routerId, name: ms.router?.name || 'MikroTik' },
            source: 'db-session',
          })
        }
      }
    }

    // ── 2. Fallback to MikroTik RouterOS API if local DB returned 0 sessions ──
    const routerStatuses: any[] = []

    if (formattedSessions.length === 0 || forceApi) {
      sourceUsed = 'mikrotik-api'
      formattedSessions = []

      await Promise.all(
        routers.map(async (router) => {
          const fetchHotspot = !typeFilter || typeFilter === 'hotspot'
          const fetchPPPoE = !typeFilter || typeFilter === 'pppoe'

          const [hotspotRes, pppoeRes] = await Promise.all([
            fetchHotspot ? getHotspotSessionsFromMikrotik(router) : Promise.resolve({ sessions: [] }),
            fetchPPPoE ? getPPPoESessionsFromMikrotik(router) : Promise.resolve({ sessions: [] }),
          ])

          const isOnline = !hotspotRes.error && !pppoeRes.error
          routerStatuses.push({
            id: router.id,
            name: router.name,
            ip: router.ipAddress || router.nasname,
            port: router.port || 8728,
            status: isOnline ? 'ONLINE' : 'OFFLINE',
            error: hotspotRes.error || pppoeRes.error || null,
            count: hotspotRes.sessions.length + pppoeRes.sessions.length,
          })

          const combined = [...hotspotRes.sessions, ...pppoeRes.sessions]

          for (const session of combined) {
            if (search) {
              const q = search.toLowerCase()
              if (
                !session.username.toLowerCase().includes(q) &&
                !session.ipAddress?.toLowerCase().includes(q) &&
                !session.macAddress?.toLowerCase().includes(q)
              ) {
                continue
              }
            }

            const totalBytes = session.uploadBytes + session.downloadBytes

            formattedSessions.push({
              id: `${router.id}-${session.username}`,
              username: session.username,
              sessionId: session.sessionId,
              type: session.type,
              nasIpAddress: router.ipAddress || router.nasname,
              framedIpAddress: session.ipAddress,
              macAddress: session.macAddress,
              startTime: new Date(Date.now() - session.uptimeSeconds * 1000).toISOString(),
              duration: session.uptimeSeconds,
              durationFormatted: formatDuration(session.uptimeSeconds),
              uploadBytes: session.uploadBytes,
              downloadBytes: session.downloadBytes,
              totalBytes,
              uploadFormatted: formatBytes(session.uploadBytes),
              downloadFormatted: formatBytes(session.downloadBytes),
              totalFormatted: formatBytes(totalBytes),
              router: { id: router.id, name: router.name },
              source: 'mikrotik-api',
            })
          }
        })
      )
    }

    // ── 3. Batch Enrich User Info (Customer Name, Customer ID, Phone, Profile) ─────
    const allUsernames = [...new Set(formattedSessions.map((s) => s.username))]
    if (allUsernames.length > 0) {
      const pppoeUsers = await prisma.pppoeUser.findMany({
        where: { username: { in: allUsernames } },
        select: {
          id: true,
          customerId: true,
          name: true,
          phone: true,
          username: true,
          profile: { select: { name: true } },
          area: { select: { id: true, name: true } },
        },
      })

      const userMap = new Map(pppoeUsers.map((u) => [u.username, u]))

      for (const s of formattedSessions) {
        const uInfo = userMap.get(s.username)
        if (uInfo) {
          s.user = {
            id: uInfo.id,
            customerId: uInfo.customerId || uInfo.id,
            name: uInfo.name || uInfo.username,
            phone: uInfo.phone || '',
            profile: uInfo.profile?.name || '',
            area: uInfo.area || null,
          }
        }
      }
    }

    const stats = {
      total: formattedSessions.length,
      hotspot: formattedSessions.filter((s) => s.type === 'hotspot').length,
      pppoe: formattedSessions.filter((s) => s.type === 'pppoe').length,
      totalUpload: formattedSessions.reduce((sum, s) => sum + s.uploadBytes, 0),
      totalDownload: formattedSessions.reduce((sum, s) => sum + s.downloadBytes, 0),
      totalBandwidth: formattedSessions.reduce((sum, s) => sum + s.totalBytes, 0),
      totalBandwidthFormatted: formatBytes(formattedSessions.reduce((sum, s) => sum + s.totalBytes, 0)),
    }

    return NextResponse.json({
      success: true,
      sessions: formattedSessions,
      stats,
      source: sourceUsed,
      note: sourceUsed === 'mikrotik-api' ? 'Real-time direct from RouterOS API' : 'Real-time cached DB',
      routersQueried: routers.length,
      routerStatuses,
    })
  } catch (error) {
    console.error('[realtime] Error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
