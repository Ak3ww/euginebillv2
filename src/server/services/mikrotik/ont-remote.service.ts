import { prisma } from '@/server/db/client'
import { exec as execCb } from 'child_process'
import { promisify } from 'util'
import { RouterOSAPI } from 'node-routeros'

const exec = promisify(execCb)

/**
 * Resolve ONT IP address — supports both RADIUS and non-RADIUS mode.
 *
 * Network flow when proxy is active:
 *   Admin (anywhere) → http://VPS:proxyPort
 *        ↓ socat on VPS
 *   MikroTik VPN IP:proxyPort   (VPS can reach this via VPN)
 *        ↓ MikroTik DST-NAT rule
 *   ONT IP (remote-address):targetPort   (MikroTik can reach this locally)
 *
 * RADIUS mode:   framedipaddress from radacct = IP assigned to ONT PPPoE session
 * Non-RADIUS:    "address" field from /ppp/active/print = same IP, from MikroTik API
 */
export async function resolveOntIpFromMikrotik(params: {
  username?: string
  customerId?: string
  providedIp?: string
}): Promise<{
  ip: string | null
  username: string
  customerName: string
  routerId: string | null
  routerName: string
  routerVpnIp: string | null
  source: string
}> {
  let targetUsername = params.username?.trim() || ''
  let customerName = ''
  let routerId: string | null = null
  let routerName = ''
  let routerVpnIp: string | null = null

  // 1. Resolve customer + router info from DB
  if (params.customerId) {
    const [user, company] = await Promise.all([
      prisma.pppoeUser.findUnique({
        where: { id: params.customerId },
        select: {
          name: true,
          username: true,
          routerId: true,
          router: {
            select: {
              id: true,
              name: true,
              ipAddress: true,
              nasname: true,
              username: true,
              password: true,
              port: true,
            },
          },
        },
      }),
      prisma.company.findFirst({ select: { radiusEnabled: true } }),
    ])

    if (user) {
      customerName = user.name || ''
      if (!targetUsername) targetUsername = user.username
      routerId = user.routerId || null
      routerName = user.router?.name || ''
      routerVpnIp = user.router?.ipAddress || user.router?.nasname || null

      const radiusEnabled = company?.radiusEnabled ?? false

      // 2. RADIUS mode: fast DB lookup via radacct
      //    framedipaddress = IP assigned to PPPoE client = ONT IP
      if (radiusEnabled && targetUsername) {
        try {
          const activeAcct = await prisma.radacct.findFirst({
            where: { username: targetUsername, acctstoptime: null },
            orderBy: { acctstarttime: 'desc' },
            select: { framedipaddress: true },
          })
          if (activeAcct?.framedipaddress) {
            return {
              ip: activeAcct.framedipaddress,
              username: targetUsername,
              customerName,
              routerId,
              routerName,
              routerVpnIp,
              source: 'radius-radacct',
            }
          }
        } catch { /* fall through to MikroTik API */ }
      }

      // 3. Non-RADIUS mode (or RADIUS fallback): query MikroTik /ppp/active/print
      //    "address" field = remote-address = IP assigned to ONT/customer device
      if (user.router && targetUsername) {
        try {
          const api = new RouterOSAPI({
            host: user.router.ipAddress || user.router.nasname,
            port: user.router.port || 8728,
            user: user.router.username,
            password: user.router.password,
            timeout: 5,
          })
          await api.connect()
          const activeSessions = await api.write('/ppp/active/print')
          await api.close()

          const matched = activeSessions.find(
            (s: any) => (s.name || '').toLowerCase() === targetUsername.toLowerCase()
          )

          if (matched?.address) {
            return {
              ip: matched.address,
              username: targetUsername,
              customerName,
              routerId,
              routerName,
              routerVpnIp,
              source: 'mikrotik-ppp-active',
            }
          }

          return {
            ip: null,
            username: targetUsername,
            customerName,
            routerId,
            routerName,
            routerVpnIp,
            source: 'offline',
          }
        } catch (err: any) {
          console.warn('[ont-remote] MikroTik /ppp/active/print failed:', err?.message)
          return {
            ip: null,
            username: targetUsername,
            customerName,
            routerId,
            routerName,
            routerVpnIp,
            source: 'mikrotik-error',
          }
        }
      }
    }
  }

  // 4. Scan all routers (no customerId — username only lookup)
  if (targetUsername) {
    const routers = await prisma.router.findMany({
      where: { isActive: true },
      select: {
        id: true, name: true, ipAddress: true,
        nasname: true, username: true, password: true, port: true,
      },
    })

    for (const router of routers) {
      try {
        const api = new RouterOSAPI({
          host: router.ipAddress || router.nasname,
          port: router.port || 8728,
          user: router.username,
          password: router.password,
          timeout: 4,
        })
        await api.connect()
        const activeSessions = await api.write('/ppp/active/print')
        await api.close()

        const matched = activeSessions.find(
          (s: any) => (s.name || '').toLowerCase() === targetUsername.toLowerCase()
        )
        if (matched?.address) {
          return {
            ip: matched.address,
            username: targetUsername,
            customerName,
            routerId: router.id,
            routerName: router.name,
            routerVpnIp: router.ipAddress || router.nasname,
            source: 'mikrotik-ppp-active-scan',
          }
        }
      } catch { /* try next */ }
    }
  }

  // 5. Last resort: manually provided IP
  if (params.providedIp?.trim()) {
    return {
      ip: params.providedIp.trim(),
      username: targetUsername,
      customerName,
      routerId,
      routerName,
      routerVpnIp,
      source: 'provided-ip',
    }
  }

  return {
    ip: null, username: targetUsername, customerName,
    routerId, routerName, routerVpnIp, source: 'not-found',
  }
}

export class OntRemoteService {
  /**
   * Setup ONT remote proxy:
   *  1. VPS socat: VPS:proxyPort -> MikroTik_VPN_IP:proxyPort
   *  2. MikroTik DST-NAT: proxyPort -> ONT_IP:targetPort
   *  3. MikroTik masquerade: so ONT sees MikroTik as source
   *  4. MikroTik forward accept rule
   *
   * This way admin browser hits VPS:proxyPort, socat sends to MikroTik VPN IP,
   * MikroTik NAT forwards to ONT web interface internally.
   */
  static async setupOntRemoteRules(params: {
    sessionId: string
    routerId: string | null
    ontIp: string         // IP assigned to customer PPPoE session (from /ppp/active/print)
    mikrotikVpnIp: string // MikroTik's VPN IP — socat target on VPS
    targetPort: number    // ONT web port (80 or 8080)
    proxyPort: number     // Allocated port on VPS
  }): Promise<{ success: boolean; error?: string }> {
    const { sessionId, routerId, ontIp, mikrotikVpnIp, targetPort, proxyPort } = params

    // ── Step 1: VPS socat (Linux only) ──────────────────────────────────────────
    if (process.platform === 'linux') {
      try {
        // Enable IP forwarding
        await exec('sysctl -w net.ipv4.ip_forward=1 2>/dev/null || true')

        // Ensure socat is installed
        const socatCheck = await exec('which socat 2>/dev/null || echo ""')
        if (!socatCheck.stdout.trim()) {
          console.log('[ont-remote] Installing socat...')
          await exec('apt-get install -y socat 2>/dev/null || true')
        }

        // Kill any existing socat on this port
        await exec(`fuser -k ${proxyPort}/tcp 2>/dev/null || true`)
        await exec(`pkill -f "socat TCP-LISTEN:${proxyPort}" 2>/dev/null || true`)
        await new Promise((r) => setTimeout(r, 300))

        // Launch socat: VPS:proxyPort -> MikroTik VPN IP:proxyPort
        // MikroTik then DST-NATs to ONT internally
        await exec(
          `nohup socat TCP-LISTEN:${proxyPort},reuseaddr,fork TCP:${mikrotikVpnIp}:${proxyPort} >/var/log/ont-remote-${proxyPort}.log 2>&1 &`
        )

        // Verify socat started
        await new Promise((r) => setTimeout(r, 600))
        const { stdout: pid } = await exec(
          `pgrep -f "socat TCP-LISTEN:${proxyPort}" 2>/dev/null || echo ""`
        )
        if (!pid.trim()) {
          throw new Error(`socat gagal dijalankan pada port ${proxyPort}`)
        }

        console.log(`[ont-remote] socat aktif: VPS:${proxyPort} -> ${mikrotikVpnIp}:${proxyPort} -> (MikroTik NAT) -> ${ontIp}:${targetPort}`)
      } catch (err: any) {
        return { success: false, error: `VPS proxy error: ${err?.message || err}` }
      }
    }

    // ── Step 2: MikroTik NAT & Filter rules ────────────────────────────────────
    try {
      const router = routerId
        ? await prisma.router.findUnique({ where: { id: routerId } })
        : await prisma.router.findFirst({ where: { isActive: true } })

      if (!router) {
        return { success: false, error: 'Router tidak ditemukan di database' }
      }

      const { RouterOSAPI: RAPI } = await import('node-routeros')
      const api = new RAPI({
        host: router.ipAddress || router.nasname,
        port: router.port || 8728,
        user: router.username,
        password: router.password,
        timeout: 5,
      })

      await api.connect()

      const comment = `ont-remote sess=${sessionId}`

      // Clean any pre-existing rules for this session
      try {
        const oldNat = await api.write('/ip/firewall/nat/print', [`?comment=${comment}`]).catch(() => [])
        for (const r of oldNat) {
          if (r['.id']) await api.write('/ip/firewall/nat/remove', [`=.id=${r['.id']}`]).catch(() => {})
        }
        const oldFilter = await api.write('/ip/firewall/filter/print', [`?comment=${comment}`]).catch(() => [])
        for (const r of oldFilter) {
          if (r['.id']) await api.write('/ip/firewall/filter/remove', [`=.id=${r['.id']}`]).catch(() => {})
        }
      } catch { /* ignore cleanup errors */ }

      // Rule 1: DST-NAT — redirect incoming proxyPort traffic to ONT IP
      await api.write('/ip/firewall/nat/add', [
        '=chain=dstnat',
        '=protocol=tcp',
        `=dst-port=${proxyPort}`,
        '=action=dst-nat',
        `=to-addresses=${ontIp}`,
        `=to-ports=${targetPort}`,
        `=comment=${comment}`,
      ])

      // Rule 2: SRC-NAT masquerade — so ONT sees MikroTik as source (response returns correctly)
      await api.write('/ip/firewall/nat/add', [
        '=chain=srcnat',
        '=protocol=tcp',
        `=dst-address=${ontIp}`,
        `=dst-port=${targetPort}`,
        '=action=masquerade',
        `=comment=${comment} srcnat`,
      ])

      // Rule 3: Forward accept — allow forwarded traffic to ONT
      await api.write('/ip/firewall/filter/add', [
        '=chain=forward',
        '=protocol=tcp',
        `=dst-address=${ontIp}`,
        `=dst-port=${targetPort}`,
        '=action=accept',
        `=comment=${comment}`,
      ])

      await api.close()
      console.log(`[ont-remote] MikroTik NAT rules created: port ${proxyPort} -> ${ontIp}:${targetPort}`)
    } catch (err: any) {
      // If MikroTik API fails, kill the socat too to avoid dangling proxy
      if (process.platform === 'linux') {
        await exec(`fuser -k ${proxyPort}/tcp 2>/dev/null || true`).catch(() => {})
        await exec(`pkill -f "socat TCP-LISTEN:${proxyPort}" 2>/dev/null || true`).catch(() => {})
      }
      return { success: false, error: `MikroTik API error: ${err?.message || err}` }
    }

    return { success: true }
  }

  /**
   * Teardown: kill socat + remove MikroTik rules
   */
  static async removeOntRemoteRules(params: {
    sessionId: string
    routerId?: string | null
    proxyPort?: number | null
    ontIp?: string | null
    targetPort?: number | null
  }): Promise<void> {
    const { sessionId, routerId, proxyPort, ontIp, targetPort } = params

    // 1. Kill VPS socat
    if (process.platform === 'linux' && proxyPort) {
      try {
        await exec(`fuser -k ${proxyPort}/tcp 2>/dev/null || true`)
        await exec(`pkill -f "socat TCP-LISTEN:${proxyPort}" 2>/dev/null || true`)
        await exec(`rm -f /var/log/ont-remote-${proxyPort}.log 2>/dev/null || true`)
      } catch { /* ignore */ }
    }

    // 2. Remove MikroTik rules
    try {
      const router = routerId
        ? await prisma.router.findUnique({ where: { id: routerId } })
        : await prisma.router.findFirst({ where: { isActive: true } })

      if (router) {
        const { RouterOSAPI: RAPI } = await import('node-routeros')
        const api = new RAPI({
          host: router.ipAddress || router.nasname,
          port: router.port || 8728,
          user: router.username,
          password: router.password,
          timeout: 4,
        })
        await api.connect()

        const comment = `ont-remote sess=${sessionId}`

        const natRules = await api.write('/ip/firewall/nat/print', [`?comment=${comment}`]).catch(() => [])
        for (const r of natRules) {
          if (r['.id']) await api.write('/ip/firewall/nat/remove', [`=.id=${r['.id']}`]).catch(() => {})
        }

        const filterRules = await api.write('/ip/firewall/filter/print', [`?comment=${comment}`]).catch(() => [])
        for (const r of filterRules) {
          if (r['.id']) await api.write('/ip/firewall/filter/remove', [`=.id=${r['.id']}`]).catch(() => {})
        }

        await api.close()
        console.log(`[ont-remote] MikroTik rules removed for session ${sessionId}`)
      }
    } catch (err: any) {
      console.warn('[ont-remote] removeOntRemoteRules MikroTik error:', err?.message)
    }
  }

  /**
   * Cleanup all expired/orphaned sessions at startup or on cron
   */
  static async cleanupExpiredSessions(): Promise<void> {
    const expired = await prisma.ontRemoteSession.findMany({
      where: {
        OR: [
          { status: 'ACTIVE', expiresAt: { lte: new Date() } },
          { status: 'PENDING', createdAt: { lte: new Date(Date.now() - 5 * 60 * 1000) } },
        ],
      },
      select: { id: true, proxyPort: true, targetIp: true, targetPort: true, customerId: true },
    })

    for (const sess of expired) {
      // Resolve routerId for cleanup
      let routerId: string | null = null
      if (sess.customerId) {
        const u = await prisma.pppoeUser.findUnique({ where: { id: sess.customerId }, select: { routerId: true } }).catch(() => null)
        routerId = u?.routerId || null
      }
      await OntRemoteService.removeOntRemoteRules({
        sessionId: sess.id,
        routerId,
        proxyPort: sess.proxyPort,
        ontIp: sess.targetIp,
        targetPort: sess.targetPort,
      })
    }

    if (expired.length > 0) {
      await prisma.ontRemoteSession.updateMany({
        where: { id: { in: expired.map((s) => s.id) } },
        data: { status: 'EXPIRED' },
      })
      console.log(`[ont-remote] Cleaned up ${expired.length} expired session(s)`)
    }
  }
}
