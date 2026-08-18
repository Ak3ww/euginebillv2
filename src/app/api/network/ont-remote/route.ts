import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/server/auth/config'
import { prisma } from '@/server/db/client'
import { exec as execCb } from 'child_process'
import { promisify } from 'util'

const exec = promisify(execCb)

export const dynamic = 'force-dynamic'

const VPS_HOST = process.env.VPS_HOST || '43.173.14.236'
const MIN_PROXY_PORT = 24000
const MAX_PROXY_PORT = 24999
const DEFAULT_EXPIRY_MINUTES = 10

// Helper: Get next available proxy port
async function getNextAvailableProxyPort(): Promise<number> {
  const activeSessions = await prisma.ontRemoteSession.findMany({
    where: {
      status: 'ACTIVE',
      expiresAt: { gt: new Date() },
    },
    select: { proxyPort: true },
  })

  const usedPorts = new Set(activeSessions.map((s: { proxyPort: number }) => s.proxyPort))

  for (let port = MIN_PROXY_PORT; port <= MAX_PROXY_PORT; port++) {
    if (!usedPorts.has(port)) {
      return port
    }
  }

  // Fallback if all 1000 ports used
  return MIN_PROXY_PORT + Math.floor(Math.random() * 1000)
}

// Helper: Real-time Dynamic IP Resolver
async function resolveRealtimeIp(params: {
  customerId?: string
  username?: string
  providedIp?: string
}): Promise<{ ip: string; username?: string; customerName?: string; routerName?: string }> {
  let targetUsername = params.username?.trim()
  let targetCustomerName = ''
  let routerName = ''

  // 1. Fetch Customer info if customerId is provided
  if (params.customerId) {
    const user = await prisma.pppoeUser.findUnique({
      where: { id: params.customerId },
      select: {
        id: true,
        name: true,
        username: true,
        ipAddress: true,
        router: { select: { name: true } },
      },
    })
    if (user) {
      targetCustomerName = user.name || ''
      if (!targetUsername) targetUsername = user.username
      if (user.router?.name) routerName = user.router.name
    }
  }

  // 2. Check active FreeRADIUS session (radacct) for current framedipaddress
  if (targetUsername) {
    try {
      const activeAcct = await prisma.radacct.findFirst({
        where: {
          username: targetUsername,
          acctstoptime: null,
        },
        orderBy: { acctstarttime: 'desc' },
        select: { framedipaddress: true },
      })
      if (activeAcct?.framedipaddress) {
        return {
          ip: activeAcct.framedipaddress,
          username: targetUsername,
          customerName: targetCustomerName,
          routerName,
        }
      }
    } catch {
      /* ignore if radacct unvailable */
    }

    // 3. Check active MikroTik session (mikrotikSession)
    try {
      const activeMk = await prisma.mikrotikSession.findFirst({
        where: {
          username: targetUsername,
          stopTime: null,
        },
        orderBy: { startTime: 'desc' },
        select: { ipAddress: true },
      })
      if (activeMk?.ipAddress) {
        return {
          ip: activeMk.ipAddress,
          username: targetUsername,
          customerName: targetCustomerName,
          routerName,
        }
      }
    } catch {
      /* ignore */
    }

    // 4. Check ACS Device IP
    try {
      const acsDev = await prisma.acsDevice.findFirst({
        where: { pppoeUsername: targetUsername },
        select: { wanIp: true, ipAddress: true },
      })
      if (acsDev?.wanIp || acsDev?.ipAddress) {
        return {
          ip: (acsDev.wanIp || acsDev.ipAddress)!,
          username: targetUsername,
          customerName: targetCustomerName,
          routerName,
        }
      }
    } catch {
      /* ignore */
    }
  }

  // Fallback to providedIp or default
  return {
    ip: params.providedIp?.trim() || '127.0.0.1',
    username: targetUsername,
    customerName: targetCustomerName,
    routerName,
  }
}

// ── GET: Fetch all active & recent ONT remote sessions ────────────────────────
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()

    // Auto-update expired sessions in database
    await prisma.ontRemoteSession.updateMany({
      where: {
        status: 'ACTIVE',
        expiresAt: { lte: now },
      },
      data: { status: 'EXPIRED' },
    })

    const sessions = await prisma.ontRemoteSession.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    const formattedSessions = sessions.map((s: {
      id: string
      customerId: string | null
      customerName: string | null
      username: string | null
      routerName: string | null
      targetIp: string
      targetPort: number
      proxyPort: number
      proxyUrl: string
      status: string
      expiresAt: Date
      createdAt: Date
    }) => {
      const remainingSeconds = s.status === 'ACTIVE'
        ? Math.max(0, Math.floor((s.expiresAt.getTime() - now.getTime()) / 1000))
        : 0

      return {
        ...s,
        remainingSeconds,
        isExpired: s.status === 'EXPIRED' || remainingSeconds <= 0,
      }
    })

    return NextResponse.json({ sessions: formattedSessions })
  } catch (error: any) {
    console.error('Error fetching ONT remote sessions:', error)
    return NextResponse.json({ error: error.message || 'Failed to fetch sessions' }, { status: 500 })
  }
}

// ── POST: Create a new temporary ONT remote proxy session ──────────────────────
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { customerId, username, targetIp: providedIp, targetPort = 80, routerName: inputRouterName } = body

    // 1. Resolve real-time dynamic IP
    const resolved = await resolveRealtimeIp({ customerId, username, providedIp })
    const targetIp = resolved.ip
    const customerName = resolved.customerName || body.customerName || 'Pelanggan'
    const finalUsername = resolved.username || username || 'N/A'
    const routerName = resolved.routerName || inputRouterName || 'Router'
    const parsedTargetPort = parseInt(String(targetPort)) === 443 ? 443 : 80

    if (!targetIp || targetIp === '127.0.0.1') {
      return NextResponse.json({ error: 'IP target ONT tidak ditemukan / pelanggan sedang offline' }, { status: 400 })
    }

    // 2. Allocate free proxy port
    const proxyPort = await getNextAvailableProxyPort()

    // 3. Build proxy URL (using host header or env VPS_HOST)
    const hostHeader = request.headers.get('host') || ''
    const currentDomain = hostHeader.split(':')[0]
    const vpsPublicIp = currentDomain.match(/^\d+\.\d+\.\d+\.\d+$/) ? currentDomain : VPS_HOST
    const proxyUrl = `http://${vpsPublicIp}:${proxyPort}`

    const expiresAt = new Date(Date.now() + DEFAULT_EXPIRY_MINUTES * 60 * 1000)

    // 4. Setup Linux iptables / socat port forwarding on VPS if running on Linux
    if (process.platform === 'linux') {
      try {
        // Forward port on VPS: proxyPort -> targetIp:parsedTargetPort
        await exec(`iptables -t nat -I PREROUTING -p tcp --dport ${proxyPort} -j DNAT --to-destination ${targetIp}:${parsedTargetPort}`)
        await exec(`iptables -I FORWARD -p tcp -d ${targetIp} --dport ${parsedTargetPort} -j ACCEPT`)
        await exec(`iptables -t nat -I POSTROUTING -p tcp -d ${targetIp} --dport ${parsedTargetPort} -j MASQUERADE`)
      } catch (err) {
        console.warn('[ont-remote] Firewall forwarder warning:', err)
      }
    }

    // 5. Save session record to DB
    const ontSession = await prisma.ontRemoteSession.create({
      data: {
        customerId: customerId || null,
        customerName,
        username: finalUsername,
        routerName,
        targetIp,
        targetPort: parsedTargetPort,
        proxyPort,
        proxyUrl,
        status: 'ACTIVE',
        expiresAt,
      },
    })

    return NextResponse.json({
      success: true,
      session: {
        ...ontSession,
        remainingSeconds: DEFAULT_EXPIRY_MINUTES * 60,
      },
    })
  } catch (error: any) {
    console.error('Error creating ONT remote session:', error)
    return NextResponse.json({ error: error.message || 'Gagal membuat sesi remote ONT' }, { status: 500 })
  }
}

// ── DELETE: Close an active ONT remote session ─────────────────────────────────
export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('id')

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 })
    }

    const ontSession = await prisma.ontRemoteSession.findUnique({
      where: { id: sessionId },
    })

    if (!ontSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Clean up iptables forwarder on VPS if running on Linux
    if (process.platform === 'linux' && ontSession.proxyPort) {
      try {
        await exec(`iptables -t nat -D PREROUTING -p tcp --dport ${ontSession.proxyPort} -j DNAT --to-destination ${ontSession.targetIp}:${ontSession.targetPort}`)
        await exec(`iptables -D FORWARD -p tcp -d ${ontSession.targetIp} --dport ${ontSession.targetPort} -j ACCEPT`)
      } catch {
        /* ignore cleanup errors */
      }
    }

    // Update status to CLOSED
    const updated = await prisma.ontRemoteSession.update({
      where: { id: sessionId },
      data: { status: 'CLOSED' },
    })

    return NextResponse.json({ success: true, session: updated })
  } catch (error: any) {
    console.error('Error closing ONT remote session:', error)
    return NextResponse.json({ error: error.message || 'Gagal menutup sesi' }, { status: 500 })
  }
}
