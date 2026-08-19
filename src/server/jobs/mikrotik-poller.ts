import { prisma } from '../db/client'
import { MikroTikConnection } from '../services/mikrotik/client'

interface SyncRouterResult {
  router: string
  success: boolean
  inserted?: number
  updated?: number
  stopped?: number
  error?: string
}

async function syncSingleRouter(router: {
  id: string
  ipAddress: string
  username: string
  password: string
  port?: number | null
  name: string
}): Promise<SyncRouterResult> {
  const apiPort = router.port || 8728
  const useTls = false

  const conn = new MikroTikConnection({
    host: router.ipAddress,
    username: router.username,
    password: router.password,
    port: apiPort,
    tls: useTls,
    timeout: 5000,
  })

  try {
    await conn.connect()

    const [activePPP, interfaces] = await Promise.all([
      conn.execute('/ppp/active/print').catch(() => [] as any[]),
      conn.execute('/interface/print', ['?type=pppoe-in']).catch(() => [] as any[]),
    ])

    const interfaceMap = new Map<string, { rx: bigint; tx: bigint; mac: string }>()
    for (const iface of interfaces) {
      const name = iface.name?.replace('<pppoe-', '')?.replace('>', '')
      if (name) {
        interfaceMap.set(name, {
          rx: BigInt(iface['rx-byte'] || '0'),
          tx: BigInt(iface['tx-byte'] || '0'),
          mac: iface['mac-address'] || '',
        })
      }
    }

    const currentRouterSessions = new Map<string, any>()
    for (const session of activePPP) {
      const username = session.name
      if (!username) continue

      currentRouterSessions.set(username, {
        username,
        ipAddress: session.address || null,
        uptime: session.uptime || null,
        callerId: session['caller-id'] || null,
      })
    }

    const dbActiveSessions = await prisma.mikrotikSession.findMany({
      where: { routerId: router.id, stopTime: null },
    })

    const dbSessionMap = new Map<string, any>()
    for (const ds of dbActiveSessions) {
      dbSessionMap.set(ds.username, ds)
    }

    // Prepare batch operations
    const updateOps: Promise<any>[] = []
    const createData: any[] = []

    let inserted = 0
    let updated = 0

    for (const [username, routerSession] of currentRouterSessions.entries()) {
      const ifaceData = interfaceMap.get(username)
      const macAddress = routerSession.callerId || ifaceData?.mac || null
      const rxBytes = ifaceData?.rx || BigInt(0)
      const txBytes = ifaceData?.tx || BigInt(0)

      if (dbSessionMap.has(username)) {
        const dbSession = dbSessionMap.get(username)
        updateOps.push(
          prisma.mikrotikSession.update({
            where: { id: dbSession.id },
            data: {
              uptime: routerSession.uptime,
              ipAddress: routerSession.ipAddress,
              macAddress,
              rxBytes,
              txBytes,
            },
          })
        )
        updated++
      } else {
        createData.push({
          routerId: router.id,
          username,
          ipAddress: routerSession.ipAddress,
          macAddress,
          uptime: routerSession.uptime,
          rxBytes,
          txBytes,
        })
        inserted++
      }
    }

    // Stopped sessions
    const stoppedIds: string[] = []
    let stopped = 0
    for (const [username, dbSession] of dbSessionMap.entries()) {
      if (!currentRouterSessions.has(username)) {
        stoppedIds.push(dbSession.id)
        stopped++
      }
    }

    if (stoppedIds.length > 0) {
      updateOps.push(
        prisma.mikrotikSession.updateMany({
          where: { id: { in: stoppedIds } },
          data: {
            stopTime: new Date(),
            terminateCause: 'Poller-Disconnect',
          },
        })
      )
    }

    if (createData.length > 0) {
      updateOps.push(prisma.mikrotikSession.createMany({ data: createData }))
    }

    // Execute all DB mutations in parallel
    await Promise.all(updateOps)

    await conn.disconnect()
    return { router: router.name, success: true, inserted, updated, stopped }
  } catch (error: any) {
    try {
      await conn.disconnect()
    } catch {
      /* ignore */
    }
    return { router: router.name, success: false, error: error?.message || 'Sync error' }
  }
}

export async function pollMikrotikSessions() {
  console.log('[Mikrotik Poller] Starting parallel active session polling...')

  const routers = await prisma.router.findMany({
    where: { isActive: true },
    select: { id: true, ipAddress: true, username: true, password: true, port: true, name: true, apiPort: true },
  })

  if (routers.length === 0) {
    return { success: true, totalSynced: 0, totalErrors: 0, results: [] }
  }

  // Poll all routers concurrently in parallel
  const settled = await Promise.allSettled(
    routers.map((router) => syncSingleRouter(router))
  )

  const results: SyncRouterResult[] = []
  let totalSynced = 0
  let totalErrors = 0

  for (const item of settled) {
    if (item.status === 'fulfilled') {
      results.push(item.value)
      if (item.value.success) totalSynced++
      else totalErrors++
    } else {
      results.push({ router: 'Unknown', success: false, error: item.reason?.message })
      totalErrors++
    }
  }

  console.log(`[Mikrotik Poller] Completed: ${totalSynced} synced, ${totalErrors} errors.`)
  return { success: totalErrors === 0, totalSynced, totalErrors, results }
}

export async function cleanupOldMikrotikSessions() {
  console.log('[Mikrotik Poller] Cleaning up old mikrotik sessions (> 7 days)...')
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  try {
    const res = await prisma.mikrotikSession.deleteMany({
      where: {
        stopTime: { not: null, lt: sevenDaysAgo },
      },
    })
    if (res.count > 0) console.log(`[Mikrotik Poller] Deleted ${res.count} old sessions.`)
  } catch (error) {
    console.error('[Mikrotik Poller] Cleanup error:', error)
  }
}
