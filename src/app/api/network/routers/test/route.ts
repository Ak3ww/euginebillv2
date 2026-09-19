import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/server/auth/config'
import { MikroTikConnection } from '@/server/services/mikrotik/client'
import { prisma } from '@/server/db/client'

// POST - Test router connection directly to target host & port without guessing
export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const body = await request.json()
    const { ipAddress, username, password, port, apiPort, vpnClientId, routerId } = body

    if (!ipAddress || !username) {
      return NextResponse.json(
        { error: 'IP Address dan Username wajib diisi' },
        { status: 400 }
      )
    }

    // 1. Resolve vpnClient if present or matching
    let vpnClient: any = null
    if (vpnClientId) {
      vpnClient = await prisma.vpnClient.findUnique({
        where: { id: vpnClientId },
      }).catch(() => null)
    } else if (routerId) {
      const r = await prisma.router.findUnique({
        where: { id: routerId },
        include: { vpnClient: true },
      }).catch(() => null)
      if (r?.vpnClient) vpnClient = r.vpnClient
    }

    if (!vpnClient && ipAddress) {
      vpnClient = await prisma.vpnClient.findFirst({
        where: { vpnIp: ipAddress },
      }).catch(() => null)
    }

    // 2. Direct Target Host (utamakan IP yang diisi admin, fallback ke VPN IP)
    const enteredIp = ipAddress?.trim()
    const vpnIp = vpnClient?.vpnIp?.trim()
    const primaryHost = enteredIp || vpnIp
    const secondaryHost = enteredIp && vpnIp && enteredIp !== vpnIp ? vpnIp : null

    // 3. Direct Target Port: Persis dinamis sesuai isian admin / target VPN (tanpa fallback tebak-tebak port)
    const vpnApiTarget = (vpnClient?.publicPorts as any)?.services?.api?.target
    const targetPort = parseInt(port) || parseInt(apiPort) || (vpnApiTarget ? parseInt(vpnApiTarget) : 8728)
    const isTls = targetPort === 8729

    // 4. Kredensial: Persis dinamis sesuai isian admin
    const user = username.trim()
    const pass = (password && password.trim().length > 0) ? password : (vpnClient?.apiPassword || '')

    console.log(`[RouterTest] Testing MikroTik connection directly to ${primaryHost}:${targetPort} (user: ${user})...`)

    let lastError = 'Koneksi gagal'
    let lastDiagnosis = 'unknown'

    const hostsToTry = [primaryHost, ...(secondaryHost ? [secondaryHost] : [])]

    for (const host of hostsToTry) {
      const mtik = new MikroTikConnection({
        host,
        username: user,
        password: pass,
        port: targetPort,
        timeout: 6000,
        tls: isTls,
      })

      try {
        const result = await mtik.testConnection()
        if (result.success) {
          console.log(`[RouterTest] SUCCESS on ${host}:${targetPort} using ${user}! Identity: ${result.identity}`)
          return NextResponse.json({
            success: true,
            identity: result.identity,
            message: `Koneksi berhasil terhubung ke MikroTik (${result.identity})`,
            usedHost: host,
            usedPort: targetPort,
            usedTls: isTls,
            usedUser: user,
          })
        } else {
          lastError = result.message || lastError
        }
      } catch (err: any) {
        lastError = err?.message || String(err)
      }

      // Evaluate failure signature
      if (lastError.includes('timed out') || lastError.includes('firewall') || lastError.includes('unreachable')) {
        lastDiagnosis = 'firewall_block'
      } else if (lastError.includes('ECONNREFUSED') || lastError.includes('refused')) {
        lastDiagnosis = 'port_refused'
      } else if (lastError.includes('wrong password') || lastError.includes('cannot log in') || lastError.includes('invalid user')) {
        lastDiagnosis = 'auth_failed'
      }
    }

    // Generate dynamic fix script if failed
    const vpsVpnIp = primaryHost.includes('.')
      ? primaryHost.substring(0, primaryHost.lastIndexOf('.')) + '.1'
      : '10.200.0.1'

    let fixScript = `# --- Perintah Fix Service API & Firewall MikroTik ---\n`
    fixScript += `/ip service set api port=${targetPort} disabled=no address=""\n`
    fixScript += `/ip firewall filter add chain=input action=accept protocol=tcp dst-port=${targetPort} comment="Allow EugineBill VPS API" place-before=0\n`
    if (vpnClient) {
      const iface = vpnClient.vpnType === 'WIREGUARD' ? 'wg0-euginebill' : `ebl2-${vpnClient.name}`
      fixScript += `/ip firewall filter add chain=input action=accept in-interface="${iface}" place-before=0 comment="Allow EugineBill VPN Remote Access"\n`
    } else {
      fixScript += `/ip firewall filter add chain=input src-address=${vpsVpnIp} protocol=tcp dst-port=${targetPort} action=accept place-before=0 comment="Allow EugineBill VPS API"\n`
    }

    return NextResponse.json({
      success: false,
      message: `${lastError} (Host: ${primaryHost}, Port: ${targetPort})`,
      diagnosis: lastDiagnosis,
      fixScript,
      usedHost: primaryHost,
      usedPort: targetPort,
    })

  } catch (error: any) {
    console.error('[RouterTest] Test router connection error:', error)
    return NextResponse.json({
      success: false,
      message: error.message || 'Connection test failed',
      diagnosis: 'unknown',
    })
  }
}
