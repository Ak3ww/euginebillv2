import { MikroTikConnection } from './client'
import { prisma } from '@/server/db/client'
import { exec as execCb } from 'child_process'
import { promisify } from 'util'

const exec = promisify(execCb)

export class OntRemoteService {
  /**
   * Configures MikroTik Firewall NAT & Filter rules + VPS Proxy Forwarder
   */
  static async setupOntRemoteRules(params: {
    sessionId: string
    routerId?: string | null
    routerName?: string | null
    targetIp: string
    targetPort: number
    proxyPort: number
  }): Promise<{ success: boolean; error?: string }> {
    const { sessionId, routerId, routerName, targetIp, targetPort, proxyPort } = params

    // 1. Setup VPS Port Forwarder (socat + iptables on Linux VPS)
    if (process.platform === 'linux') {
      try {
        // Enable IPv4 forwarding on Linux VPS
        await exec('sysctl -w net.ipv4.ip_forward=1 2>/dev/null || true')

        // Clean any pre-existing socat/iptables on this proxyPort
        await exec(`fuser -k ${proxyPort}/tcp 2>/dev/null || true`)
        await exec(`iptables -t nat -D PREROUTING -p tcp --dport ${proxyPort} -j DNAT --to-destination ${targetIp}:${targetPort} 2>/dev/null || true`)

        // Add iptables rules on VPS
        await exec(`iptables -t nat -I PREROUTING -p tcp --dport ${proxyPort} -j DNAT --to-destination ${targetIp}:${targetPort}`)
        await exec(`iptables -I FORWARD -p tcp -d ${targetIp} --dport ${targetPort} -j ACCEPT`)
        await exec(`iptables -t nat -I POSTROUTING -p tcp -d ${targetIp} --dport ${targetPort} -j MASQUERADE`)

        // Also launch robust socat background proxy
        await exec(`nohup socat TCP-LISTEN:${proxyPort},reuseaddr,fork TCP:${targetIp}:${targetPort} >/dev/null 2>&1 &`)
        console.log(`[ont-remote-service] VPS proxy active on port ${proxyPort} -> ${targetIp}:${targetPort}`)
      } catch (err: any) {
        console.warn('[ont-remote-service] VPS forwarder warning:', err?.message || err)
      }
    }

    // 2. Setup MikroTik NAT & Filter Rules via API
    try {
      // Find router in DB
      const router = routerId
        ? await prisma.router.findUnique({ where: { id: routerId } })
        : routerName
        ? await prisma.router.findFirst({ where: { name: { contains: routerName, mode: 'insensitive' } } })
        : await prisma.router.findFirst({ where: { isDefault: true } }) || await prisma.router.findFirst()

      if (router) {
        const apiPort = router.port || 8728
        const conn = new MikroTikConnection({
          host: router.ipAddress,
          username: router.username,
          password: router.password,
          port: apiPort,
          tls: false,
          timeout: 5000,
        })

        await conn.connect()

        const commentSess = `ont-remote sess=${sessionId}`

        // Add Dst-NAT rule on MikroTik
        await conn.execute('/ip/firewall/nat/add', [
          `=chain=dstnat`,
          `=protocol=tcp`,
          `=dst-port=${proxyPort}`,
          `=action=dst-nat`,
          `=to-addresses=${targetIp}`,
          `=to-ports=${targetPort}`,
          `=comment=${commentSess} port=${proxyPort}->${targetPort}`,
        ])

        // Add Filter rule on MikroTik
        await conn.execute('/ip/firewall/filter/add', [
          `=chain=forward`,
          `=protocol=tcp`,
          `=dst-address=${targetIp}`,
          `=dst-port=${targetPort}`,
          `=action=accept`,
          `=comment=${commentSess}`,
        ])

        // Add Src-NAT Masquerade rule on MikroTik
        await conn.execute('/ip/firewall/nat/add', [
          `=chain=srcnat`,
          `=protocol=tcp`,
          `=dst-address=${targetIp}`,
          `=dst-port=${targetPort}`,
          `=action=masquerade`,
          `=comment=${commentSess} srcnat`,
        ])

        await conn.disconnect()
        console.log(`[ont-remote-service] MikroTik rules created on ${router.name} (${router.ipAddress})`)
      }
    } catch (mkErr: any) {
      console.warn('[ont-remote-service] MikroTik API rule creation warning:', mkErr?.message || mkErr)
    }

    return { success: true }
  }

  /**
   * Cleans up MikroTik Firewall NAT & Filter rules + kills VPS Proxy Forwarder
   */
  static async removeOntRemoteRules(params: {
    sessionId: string
    routerId?: string | null
    routerName?: string | null
    proxyPort?: number | null
    targetIp?: string | null
    targetPort?: number | null
  }): Promise<void> {
    const { sessionId, routerId, routerName, proxyPort, targetIp, targetPort } = params

    // 1. Clean VPS forwarder
    if (process.platform === 'linux' && proxyPort) {
      try {
        await exec(`fuser -k ${proxyPort}/tcp 2>/dev/null || true`)
        await exec(`pkill -f "socat TCP-LISTEN:${proxyPort}" 2>/dev/null || true`)
        if (targetIp && targetPort) {
          await exec(`iptables -t nat -D PREROUTING -p tcp --dport ${proxyPort} -j DNAT --to-destination ${targetIp}:${targetPort} 2>/dev/null || true`)
          await exec(`iptables -D FORWARD -p tcp -d ${targetIp} --dport ${targetPort} -j ACCEPT 2>/dev/null || true`)
          await exec(`iptables -t nat -D POSTROUTING -p tcp -d ${targetIp} --dport ${targetPort} -j MASQUERADE 2>/dev/null || true`)
        }
      } catch {
        /* ignore */
      }
    }

    // 2. Remove MikroTik Firewall rules via API
    try {
      const router = routerId
        ? await prisma.router.findUnique({ where: { id: routerId } })
        : routerName
        ? await prisma.router.findFirst({ where: { name: { contains: routerName, mode: 'insensitive' } } })
        : await prisma.router.findFirst({ where: { isDefault: true } }) || await prisma.router.findFirst()

      if (router) {
        const apiPort = router.port || 8728
        const conn = new MikroTikConnection({
          host: router.ipAddress,
          username: router.username,
          password: router.password,
          port: apiPort,
          tls: false,
          timeout: 5000,
        })

        await conn.connect()

        const commentQuery = `?comment=ont-remote sess=${sessionId}`

        // Remove NAT rules
        const natRules = await conn.execute('/ip/firewall/nat/print', [commentQuery])
        for (const r of natRules) {
          if (r['.id']) {
            await conn.execute('/ip/firewall/nat/remove', [`=.id=${r['.id']}`])
          }
        }

        // Remove Filter rules
        const filterRules = await conn.execute('/ip/firewall/filter/print', [commentQuery])
        for (const r of filterRules) {
          if (r['.id']) {
            await conn.execute('/ip/firewall/filter/remove', [`=.id=${r['.id']}`])
          }
        }

        await conn.disconnect()
        console.log(`[ont-remote-service] MikroTik rules removed for session ${sessionId}`)
      }
    } catch {
      /* ignore */
    }
  }
}
