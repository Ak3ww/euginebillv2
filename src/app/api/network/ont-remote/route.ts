import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/server/auth/config'
import { prisma } from '@/server/db/client'
import { OntRemoteService, resolveOntIpFromMikrotik } from '@/server/services/mikrotik/ont-remote.service'

export const dynamic = 'force-dynamic'

// VPS public IP for building proxy URL
const VPS_HOST =
  process.env.VPS_HOST ||
  (process.env.NEXTAUTH_URL || '').replace(/^https?:\/\//, '').split(':')[0].split('/')[0] ||
  '127.0.0.1'

const MIN_PROXY_PORT = 24000
const MAX_PROXY_PORT = 24999
const DEFAULT_EXPIRY_MINUTES = 15

// Get next free port
async function getNextAvailableProxyPort(): Promise<number> {
  const activeSessions = await prisma.ontRemoteSession.findMany({
    where: { status: 'ACTIVE', expiresAt: { gt: new Date() } },
    select: { proxyPort: true },
  })
  const usedPorts = new Set(activeSessions.map((s: { proxyPort: number }) => s.proxyPort))
  for (let port = MIN_PROXY_PORT; port <= MAX_PROXY_PORT; port++) {
    if (!usedPorts.has(port)) return port
  }
  throw new Error('Tidak ada port proxy yang tersedia')
}

// ── GET: List sessions ─────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const now = new Date()

    // Auto-expire stale sessions
    await prisma.ontRemoteSession.updateMany({
      where: { status: 'ACTIVE', expiresAt: { lte: now } },
      data: { status: 'EXPIRED' },
    })

    const sessions = await prisma.ontRemoteSession.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return NextResponse.json({
      sessions: sessions.map((s: any) => {
        const remainingSeconds =
          s.status === 'ACTIVE'
            ? Math.max(0, Math.floor((new Date(s.expiresAt).getTime() - now.getTime()) / 1000))
            : 0
        return { ...s, remainingSeconds, isExpired: s.status !== 'ACTIVE' || remainingSeconds <= 0 }
      }),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch sessions' }, { status: 500 })
  }
}

// ── POST: Create ONT remote session ───────────────────────────────────────────
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let ontSessionId: string | null = null

  try {
    const body = await request.json()
    const {
      customerId,
      username,
      targetIp: providedIp,
      targetPort = 80,
      customerName: inputCustomerName,
    } = body

    // 1. Resolve ONT IP from MikroTik /ppp/active/print
    const resolved = await resolveOntIpFromMikrotik({ customerId, username, providedIp })

    if (!resolved.ip) {
      const msg =
        resolved.source === 'offline'
          ? `Pelanggan ${resolved.username} sedang offline (tidak ada sesi PPPoE aktif)`
          : resolved.source === 'mikrotik-error'
          ? 'Gagal terhubung ke MikroTik untuk mengecek sesi aktif'
          : 'IP address ONT tidak ditemukan'
      return NextResponse.json({ error: msg, source: resolved.source }, { status: 400 })
    }

    if (!resolved.routerVpnIp) {
      return NextResponse.json(
        { error: 'IP VPN MikroTik tidak ditemukan. Pastikan router memiliki IP address di database.' },
        { status: 400 }
      )
    }

    const ontIp = resolved.ip
    const mikrotikVpnIp = resolved.routerVpnIp
    const customerName = resolved.customerName || inputCustomerName || 'Pelanggan'
    const finalUsername = resolved.username || username || 'N/A'
    const routerName = resolved.routerName || 'Router'
    const parsedTargetPort = parseInt(String(targetPort)) || 80

    // 2. Allocate free port
    const proxyPort = await getNextAvailableProxyPort()

    // 3. Build proxy URL (Always use VPS raw Public IP to bypass Cloudflare and prevent browser HSTS/SSL error)
    const hostHeader = request.headers.get('host') || ''
    const currentDomain = hostHeader.split(':')[0]
    const isPublicIp = /^\d+\.\d+\.\d+\.\d+$/.test(currentDomain)

    let resolvedPublicIp = isPublicIp ? currentDomain : ''
    if (!resolvedPublicIp) {
      const vpnServer = await prisma.vpnServer.findFirst({
        where: { isActive: true },
        select: { host: true },
      })
      if (vpnServer?.host && /^\d+\.\d+\.\d+\.\d+$/.test(vpnServer.host)) {
        resolvedPublicIp = vpnServer.host
      }
    }
    if (!resolvedPublicIp) {
      resolvedPublicIp = process.env.VPS_PUBLIC_IP || process.env.VPS_HOST || '43.173.14.236'
    }

    const proxyUrl = `http://${resolvedPublicIp}:${proxyPort}/getpage.gch?pid=1002`

    const expiresAt = new Date(Date.now() + DEFAULT_EXPIRY_MINUTES * 60 * 1000)

    // 4. Save session as PENDING
    const ontSession = await prisma.ontRemoteSession.create({
      data: {
        customerId: customerId || null,
        customerName,
        username: finalUsername,
        routerName,
        targetIp: ontIp,         // ONT's actual PPPoE IP
        targetPort: parsedTargetPort,
        proxyPort,
        proxyUrl,
        status: 'PENDING',
        expiresAt,
      },
    })
    ontSessionId = ontSession.id

    // 5. Setup socat on VPS + MikroTik NAT rules
    const setupResult = await OntRemoteService.setupOntRemoteRules({
      sessionId: ontSession.id,
      routerId: resolved.routerId,
      ontIp,
      mikrotikVpnIp,
      targetPort: parsedTargetPort,
      proxyPort,
    })

    if (!setupResult.success) {
      await prisma.ontRemoteSession.update({
        where: { id: ontSession.id },
        data: { status: 'FAILED' },
      })
      return NextResponse.json(
        { error: setupResult.error || 'Gagal setup proxy ONT' },
        { status: 500 }
      )
    }

    // 6. Mark ACTIVE
    const activeSession = await prisma.ontRemoteSession.update({
      where: { id: ontSession.id },
      data: { status: 'ACTIVE' },
    })

    return NextResponse.json({
      success: true,
      session: { ...activeSession, remainingSeconds: DEFAULT_EXPIRY_MINUTES * 60 },
      resolvedFrom: resolved.source,
      ontIp,
      mikrotikVpnIp,
    })
  } catch (error: any) {
    console.error('[ont-remote] POST error:', error)
    if (ontSessionId) {
      await prisma.ontRemoteSession.update({
        where: { id: ontSessionId },
        data: { status: 'FAILED' },
      }).catch(() => {})
    }
    return NextResponse.json({ error: error.message || 'Gagal membuat sesi remote ONT' }, { status: 500 })
  }
}

// ── DELETE: Close session ──────────────────────────────────────────────────────
export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('id')
    if (!sessionId) return NextResponse.json({ error: 'Session ID is required' }, { status: 400 })

    if (sessionId === 'all') {
      const active = await prisma.ontRemoteSession.findMany({
        where: { status: 'ACTIVE' },
      })
      for (const s of active) {
        await OntRemoteService.removeOntRemoteRules({
          sessionId: s.id,
          proxyPort: s.proxyPort,
          ontIp: s.targetIp,
          targetPort: s.targetPort,
        })
      }
      await prisma.ontRemoteSession.updateMany({
        where: { status: 'ACTIVE' },
        data: { status: 'CLOSED' },
      })
      return NextResponse.json({ success: true, message: `Berhasil menutup ${active.length} sesi remote ONT` })
    }

    const ontSession = await prisma.ontRemoteSession.findUnique({ where: { id: sessionId } })
    if (!ontSession) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

    // Resolve routerId for MikroTik rule removal
    let routerId: string | null = null
    if (ontSession.customerId) {
      const u = await prisma.pppoeUser.findUnique({
        where: { id: ontSession.customerId },
        select: { routerId: true },
      }).catch(() => null)
      routerId = u?.routerId || null
    }
    if (!routerId && ontSession.username) {
      const u = await prisma.pppoeUser.findUnique({
        where: { username: ontSession.username },
        select: { routerId: true },
      }).catch(() => null)
      routerId = u?.routerId || null
    }

    await OntRemoteService.removeOntRemoteRules({
      sessionId: ontSession.id,
      routerId,
      proxyPort: ontSession.proxyPort,
      ontIp: ontSession.targetIp,
      targetPort: ontSession.targetPort,
    })

    const updated = await prisma.ontRemoteSession.update({
      where: { id: sessionId },
      data: { status: 'CLOSED' },
    })

    return NextResponse.json({ success: true, session: updated })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal menutup sesi' }, { status: 500 })
  }
}

// ── PATCH: Extend session ──────────────────────────────────────────────────────
export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const { sessionId, extendMinutes = DEFAULT_EXPIRY_MINUTES } = body
    if (!sessionId) return NextResponse.json({ error: 'Session ID is required' }, { status: 400 })

    const ontSession = await prisma.ontRemoteSession.findUnique({ where: { id: sessionId } })
    if (!ontSession) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    if (ontSession.status !== 'ACTIVE') return NextResponse.json({ error: 'Session is not active' }, { status: 400 })

    const newExpiresAt = new Date(Date.now() + extendMinutes * 60 * 1000)
    const updated = await prisma.ontRemoteSession.update({
      where: { id: sessionId },
      data: { expiresAt: newExpiresAt },
    })

    const remainingSeconds = Math.max(0, Math.floor((newExpiresAt.getTime() - Date.now()) / 1000))

    return NextResponse.json({
      success: true,
      session: { ...updated, remainingSeconds },
      message: `Sesi berhasil diperpanjang ${extendMinutes} menit`,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal memperpanjang sesi' }, { status: 500 })
  }
}
