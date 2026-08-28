import { prisma } from '@/server/db/client'
import { exec as execCb, spawn } from 'child_process'
import { promisify } from 'util'
import { writeFile } from 'fs/promises'
import { RouterOSAPI } from 'node-routeros'

const exec = promisify(execCb)

async function runCmd(cmd: string): Promise<string> {
  try {
    const { stdout } = await exec(cmd)
    return stdout ? String(stdout).trim() : ''
  } catch {
    return ''
  }
}

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
   * This way admin browser hits VPS:proxyPort, node HTTP proxy rewrites Host header and forwards to MikroTik VPN IP,
   * MikroTik NAT forwards to ONT web interface internally without 400 Bad Request.
   */
  static async setupOntRemoteRules(params: {
    sessionId: string
    routerId: string | null
    ontIp: string         // IP assigned to customer PPPoE session (from /ppp/active/print)
    mikrotikVpnIp: string // MikroTik's VPN IP — target on VPS
    targetPort: number    // ONT web port (80 or 8080)
    proxyPort: number     // Allocated port on VPS
  }): Promise<{ success: boolean; error?: string }> {
    const { sessionId, routerId, ontIp, mikrotikVpnIp, targetPort, proxyPort } = params
    const pureOntIp = ontIp.replace(/:\d+$/, '')
    const natPort = proxyPort + 1000

    // ── Step 1: VPS HTTP Reverse Proxy (Linux only) ──────────────────────────────────
    if (process.platform === 'linux') {
      try {
        await runCmd('sysctl -w net.ipv4.ip_forward=1')

        // Ensure ufw & iptables allow this port
        await runCmd(`ufw allow ${proxyPort}/tcp`)
        await runCmd(`iptables -I INPUT -p tcp --dport ${proxyPort} -j ACCEPT 2>/dev/null || true`)

        // Kill any existing proxy or socat on this port safely (multi-method cleanup)
        await runCmd(`fuser -k -9 ${proxyPort}/tcp 2>/dev/null || true`)
        await runCmd(`pkill -9 -f "ont-proxy-${proxyPort}.js" 2>/dev/null || true`)
        await runCmd(`pkill -9 -f "socat.*:${proxyPort}" 2>/dev/null || true`)
        await runCmd(`pid=$(ss -lptn "sport = :${proxyPort}" 2>/dev/null | grep -o 'pid=[0-9]*' | cut -d= -f2); [ -n "$pid" ] && kill -9 $pid 2>/dev/null || true`)
        await new Promise((r) => setTimeout(r, 500))

        const pureOntIp = ontIp.replace(/:\d+$/, '')
        const correctHostHeader = targetPort === 80 ? pureOntIp : `${pureOntIp}:${targetPort}`

        const proxyScriptContent = `
'use strict';
const http = require('http');
const fs   = require('fs');

const listenPort    = ${proxyPort};
const natPort       = ${proxyPort + 1000};
const mikrotikVpnIp = '${mikrotikVpnIp}';
const ontIp         = '${pureOntIp}';
const targetPort    = ${targetPort};
const logFile       = '/tmp/ont-remote-' + listenPort + '.log';

function log(msg) {
  const line = '[' + new Date().toISOString().substring(11, 19) + '] ' + msg;
  console.log(line);
  try { fs.appendFileSync(logFile, line + '\\n'); } catch (_) {}
}

const server = http.createServer((req, res) => {
  const clientIp = req.socket.remoteAddress;
  log('[' + req.method + '] ' + req.url + ' from ' + clientIp);

  // Clean and prepare headers for ONT web server
  const cleanHeaders = { ...req.headers };
  cleanHeaders['host'] = targetPort === 80 ? ontIp : ontIp + ':' + targetPort;
  cleanHeaders['connection'] = 'close';
  if (cleanHeaders['referer']) {
    cleanHeaders['referer'] = 'http://' + (targetPort === 80 ? ontIp : ontIp + ':' + targetPort) + '/';
  }
  if (cleanHeaders['origin']) {
    cleanHeaders['origin'] = 'http://' + (targetPort === 80 ? ontIp : ontIp + ':' + targetPort);
  }

  // Strip modern browser headers that overflow thttpd / boa buffers
  delete cleanHeaders['sec-fetch-mode'];
  delete cleanHeaders['sec-fetch-site'];
  delete cleanHeaders['sec-fetch-dest'];
  delete cleanHeaders['sec-fetch-user'];
  delete cleanHeaders['sec-ch-ua'];
  delete cleanHeaders['sec-ch-ua-mobile'];
  delete cleanHeaders['sec-ch-ua-platform'];
  delete cleanHeaders['upgrade-insecure-requests'];

  const options = {
    hostname: mikrotikVpnIp,
    port: natPort,
    path: req.url,
    method: req.method,
    headers: cleanHeaders,
    timeout: 12000,
  };

  const proxyReq = http.request(options, (proxyRes) => {
    log('  <- ONT ' + proxyRes.statusCode + ' for ' + req.url);

    const responseHeaders = { ...proxyRes.headers };

    // Rewrite Location header in redirects from ONT so browser stays on proxy
    if (responseHeaders['location']) {
      const originalLoc = responseHeaders['location'];
      responseHeaders['location'] = originalLoc.replace(/https?:\\/\\/[^\\/]+/i, '');
      log('  -> Rewrote Location: ' + originalLoc + ' -> ' + responseHeaders['location']);
    }

    res.writeHead(proxyRes.statusCode || 200, responseHeaders);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    log('  [PROXY ERROR] ' + req.url + ': ' + err.message);
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<html><body style="font-family:sans-serif;padding:40px;text-align:center;"><h2>Gagal Terhubung ke Modem ONT</h2><p>Pastikan modem ONT aktif dan respon di port ' + targetPort + '.</p><p><small>Error: ' + err.message + '</small></p></body></html>');
    }
  });

  proxyReq.on('timeout', () => {
    proxyReq.destroy();
    log('  [PROXY TIMEOUT] ' + req.url);
    if (!res.headersSent) {
      res.writeHead(504, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<html><body style="font-family:sans-serif;padding:40px;text-align:center;"><h2>Gateway Timeout</h2><p>Modem ONT tidak merespon dalam 12 detik.</p></body></html>');
    }
  });

  req.pipe(proxyReq);
});

server.on('error', (err) => {
  log('Server fatal error: ' + err.message);
  process.exit(1);
});

server.listen(listenPort, '0.0.0.0', () => {
  log('ONT-Proxy HTTP READY on 0.0.0.0:' + listenPort + ' → ' + mikrotikVpnIp + ':' + listenPort + ' (Host: ' + ontIp + ')');
});
`
        const scriptPath = `/tmp/ont-proxy-${proxyPort}.js`
        await writeFile(scriptPath, proxyScriptContent.trim(), 'utf8')

        const nodeBin = process.execPath || '/usr/bin/node'
        const childProcess = spawn(nodeBin, [scriptPath], {
          detached: true,
          stdio: 'ignore',
        })
        childProcess.unref()

        await new Promise((r) => setTimeout(r, 500))
        console.log(`[ont-remote] Reverse HTTP proxy active: VPS:${proxyPort} → ${mikrotikVpnIp}:${proxyPort} → ${ontIp}:${targetPort} (Host: ${correctHostHeader})`)
      } catch (err: any) {
        console.error('[ont-remote] VPS proxy warning:', err?.message || err)
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

      // Clean any pre-existing rules for this session or port
      try {
        const allNat = await api.write('/ip/firewall/nat/print').catch(() => [])
        for (const r of allNat) {
          const matchComment = r.comment && (r.comment.includes(sessionId) || r.comment.includes(`ont-remote sess=${sessionId}`))
          const matchPort = (proxyPort && String(r['dst-port']) === String(proxyPort)) || String(r['dst-port']) === String(natPort)
          if (matchComment || matchPort) {
            if (r['.id']) await api.write('/ip/firewall/nat/remove', [`=.id=${r['.id']}`]).catch(() => {})
          }
        }
        const allFilter = await api.write('/ip/firewall/filter/print').catch(() => [])
        for (const r of allFilter) {
          const matchComment = r.comment && (r.comment.includes(sessionId) || r.comment.includes(`ont-remote sess=${sessionId}`))
          const matchPort = (proxyPort && String(r['dst-port']) === String(proxyPort)) || String(r['dst-port']) === String(natPort)
          if (matchComment || matchPort) {
            if (r['.id']) await api.write('/ip/firewall/filter/remove', [`=.id=${r['.id']}`]).catch(() => {})
          }
        }
      } catch { /* ignore cleanup errors */ }

      // Rule 1: DST-NAT — redirect incoming natPort traffic from VPS proxy to ONT IP (at top of NAT table)
      await api.write('/ip/firewall/nat/add', [
        '=chain=dstnat',
        '=protocol=tcp',
        `=dst-port=${natPort}`,
        '=action=dst-nat',
        `=to-addresses=${pureOntIp}`,
        `=to-ports=${targetPort}`,
        '=place-before=0',
        `=comment=${comment}`,
      ])

      // Rule 2: SRC-NAT masquerade — so ONT sees MikroTik as source (at top of NAT table)
      await api.write('/ip/firewall/nat/add', [
        '=chain=srcnat',
        '=protocol=tcp',
        `=dst-address=${pureOntIp}`,
        '=action=masquerade',
        '=place-before=0',
        `=comment=${comment} srcnat`,
      ])

      // Rule 3: Forward accept — allow forwarded traffic to ONT at top of filter
      await api.write('/ip/firewall/filter/add', [
        '=chain=forward',
        '=protocol=tcp',
        `=dst-address=${pureOntIp}`,
        `=dst-port=${targetPort}`,
        '=action=accept',
        '=place-before=0',
        `=comment=${comment}`,
      ])

      await api.close()
      console.log(`[ont-remote] MikroTik NAT rules created: natPort ${natPort} (proxy ${proxyPort}) -> ${pureOntIp}:${targetPort}`)
    } catch (err: any) {
      if (process.platform === 'linux') {
        await exec(`fuser -k ${proxyPort}/tcp 2>/dev/null || true`).catch(() => {})
        await exec(`pkill -9 -f "ont-proxy-${proxyPort}.js" 2>/dev/null || true`).catch(() => {})
      }
      return { success: false, error: `MikroTik API error: ${err?.message || err}` }
    }

    return { success: true }
  }

  /**
   * Teardown: kill proxy + remove all matching MikroTik NAT & Filter rules
   */
  static async removeOntRemoteRules(params: {
    sessionId: string
    routerId?: string | null
    proxyPort?: number | null
    ontIp?: string | null
    targetPort?: number | null
  }): Promise<void> {
    const { sessionId, routerId, proxyPort, ontIp, targetPort } = params

    // 1. Kill VPS proxy process + close UFW port + remove tmp script
    if (process.platform === 'linux' && proxyPort) {
      try {
        await runCmd(`fuser -k -9 ${proxyPort}/tcp 2>/dev/null || true`)
        await runCmd(`pkill -9 -f "ont-proxy-${proxyPort}.js" 2>/dev/null || true`)
        await runCmd(`pkill -9 -f "socat.*:${proxyPort}" 2>/dev/null || true`)
        await runCmd(`pid=$(ss -lptn "sport = :${proxyPort}" 2>/dev/null | grep -o 'pid=[0-9]*' | cut -d= -f2); [ -n "$pid" ] && kill -9 $pid 2>/dev/null || true`)
        await runCmd(`rm -f /tmp/ont-proxy-${proxyPort}.js /tmp/ont-remote-${proxyPort}.log`)
        await runCmd(`ufw delete allow ${proxyPort}/tcp 2>/dev/null || true`)
      } catch { /* ignore */ }
    }

    // 2. Remove MikroTik rules across target or all active routers
    try {
      const targetRouters = routerId
        ? await prisma.router.findMany({ where: { id: routerId } })
        : await prisma.router.findMany({ where: { isActive: true } })

      const { RouterOSAPI: RAPI } = await import('node-routeros')

      for (const router of targetRouters) {
        try {
          const api = new RAPI({
            host: router.ipAddress || router.nasname,
            port: router.port || 8728,
            user: router.username,
            password: router.password,
            timeout: 4,
          })
          await api.connect()

          // Remove all NAT rules matching this session ID or proxy port / nat port
          const natRules = await api.write('/ip/firewall/nat/print').catch(() => [])
          for (const r of natRules) {
            const matchComment = r.comment && (r.comment.includes(sessionId) || r.comment.includes(`ont-remote sess=${sessionId}`))
            const matchPort = proxyPort && (String(r['dst-port']) === String(proxyPort) || String(r['dst-port']) === String(proxyPort + 1000))
            if (matchComment || matchPort) {
              if (r['.id']) await api.write('/ip/firewall/nat/remove', [`=.id=${r['.id']}`]).catch(() => {})
            }
          }

          // Remove all Filter rules matching this session ID or proxy port
          const filterRules = await api.write('/ip/firewall/filter/print').catch(() => [])
          for (const r of filterRules) {
            const matchComment = r.comment && (r.comment.includes(sessionId) || r.comment.includes(`ont-remote sess=${sessionId}`))
            const matchPort = proxyPort && (String(r['dst-port']) === String(proxyPort) || String(r['dst-port']) === String(proxyPort + 1000))
            if (matchComment || matchPort) {
              if (r['.id']) await api.write('/ip/firewall/filter/remove', [`=.id=${r['.id']}`]).catch(() => {})
            }
          }

          await api.close()
          console.log(`[ont-remote] MikroTik rules removed on router ${router.name} for session ${sessionId} (port ${proxyPort})`)
        } catch (rErr: any) {
          console.warn(`[ont-remote] Failed removing rules on router ${router.name}:`, rErr?.message)
        }
      }
    } catch (err: any) {
      console.warn('[ont-remote] removeOntRemoteRules error:', err?.message)
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
