import { prisma } from '../db/client'
import { MikroTikConnection } from '../services/mikrotik/client'

export async function pollMikrotikSessions() {
  console.log('[Mikrotik Poller] Starting active session polling...')
  
  const routers = await prisma.router.findMany({
    where: { isActive: true },
    select: { id: true, ipAddress: true, username: true, password: true, port: true, name: true }
  })

  for (const router of routers) {
    // console.log(`[Mikrotik Poller] Syncing router: ${router.name} (${router.ipAddress})`)
    
    const apiPort = router.port || 8728
    const useTls = apiPort === 8729

    const conn = new MikroTikConnection({
      host: router.ipAddress,
      username: router.username,
      password: router.password,
      port: apiPort,
      tls: useTls,
    })

    try {
      await conn.connect()
      
      const activePPP = await conn.execute('/ppp/active/print')
      const interfaces = await conn.execute('/interface/print', ['?type=pppoe-in'])
      
      const interfaceMap = new Map<string, { rx: bigint, tx: bigint, mac: string }>()
      for (const iface of interfaces) {
        const name = iface.name?.replace('<pppoe-', '')?.replace('>', '')
        if (name) {
          interfaceMap.set(name, {
            rx: BigInt(iface['rx-byte'] || '0'),
            tx: BigInt(iface['tx-byte'] || '0'),
            mac: iface['mac-address'] || ''
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
          callerId: session['caller-id'] || null
        })
      }

      const dbActiveSessions = await prisma.mikrotikSession.findMany({
        where: { routerId: router.id, stopTime: null }
      })
      
      const dbSessionMap = new Map<string, any>()
      for (const ds of dbActiveSessions) {
        dbSessionMap.set(ds.username, ds)
      }

      // Process active sessions
      for (const [username, routerSession] of currentRouterSessions.entries()) {
        const ifaceData = interfaceMap.get(username)
        const macAddress = routerSession.callerId || ifaceData?.mac || null
        const rxBytes = ifaceData?.rx || BigInt(0)
        const txBytes = ifaceData?.tx || BigInt(0)

        if (dbSessionMap.has(username)) {
          const dbSession = dbSessionMap.get(username)
          await prisma.mikrotikSession.update({
            where: { id: dbSession.id },
            data: {
              uptime: routerSession.uptime,
              ipAddress: routerSession.ipAddress,
              macAddress: macAddress,
              rxBytes,
              txBytes,
            }
          })
        } else {
          await prisma.mikrotikSession.create({
            data: {
              routerId: router.id,
              username,
              ipAddress: routerSession.ipAddress,
              macAddress: macAddress,
              uptime: routerSession.uptime,
              rxBytes,
              txBytes,
            }
          })
        }
      }

      // Process stopped sessions
      for (const [username, dbSession] of dbSessionMap.entries()) {
        if (!currentRouterSessions.has(username)) {
          await prisma.mikrotikSession.update({
            where: { id: dbSession.id },
            data: {
              stopTime: new Date(),
              terminateCause: 'Poller-Disconnect'
            }
          })
        }
      }

      await conn.disconnect()
    } catch (error: any) {
      console.error(`[Mikrotik Poller] Failed to sync router ${router.name}:`, error.message)
      try { await conn.disconnect() } catch { /* ignore */ }
    }
  }
}

export async function cleanupOldMikrotikSessions() {
  console.log('[Mikrotik Poller] Cleaning up old mikrotik sessions (> 7 days)...')
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  try {
    const res = await prisma.mikrotikSession.deleteMany({
      where: {
        stopTime: { not: null, lt: sevenDaysAgo }
      }
    })
    if (res.count > 0) console.log(`[Mikrotik Poller] Deleted ${res.count} old sessions.`)
  } catch (error) {
    console.error('[Mikrotik Poller] Cleanup error:', error)
  }
}
