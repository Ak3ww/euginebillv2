import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/server/auth/config'
import { MikroTikConnection } from '@/server/services/mikrotik/client'
import { prisma } from '@/server/db/client'

// POST - Test router connection with intelligent multi-port and VPN fallback
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

    // 2. Candidate Hosts (utamakan VPN IP jika tersedia, fallback ke ipAddress)
    const rawHosts = [
      ipAddress?.trim(),
      vpnClient?.vpnIp?.trim(),
    ].filter(Boolean) as string[]
    const candidateHosts = Array.from(new Set(rawHosts))

    // 3. Candidate Credentials (utamakan input admin, fallback ke kredensial vpnClient)
    const credPairs: Array<{ user: string; pass: string; label: string }> = []
    const addCred = (u?: string | null, p?: string | null, label = '') => {
      if (!u) return
      const trimmedUser = u.trim()
      const passVal = p || ''
      if (!trimmedUser) return
      if (!credPairs.some(c => c.user === trimmedUser && c.pass === passVal)) {
        credPairs.push({ user: trimmedUser, pass: passVal, label })
      }
    }

    addCred(username, password, 'admin_input')
    if (vpnClient) {
      addCred(vpnClient.apiUsername, vpnClient.apiPassword, 'vpn_api')
      addCred(vpnClient.username, vpnClient.password, 'vpn_tunnel')
    }
    addCred('admin', password, 'default_admin')
    if (password) {
      addCred(username, '', 'empty_pass')
    }

    // 4. Candidate Ports (utamakan port isian admin, fallback ke API target VPN, 8520, 8728, 8729)
    const adminPort = parseInt(port) || parseInt(apiPort) || 8728
    const vpnApiTarget = (vpnClient?.publicPorts as any)?.services?.api?.target
    const rawPorts = [
      adminPort,
      apiPort ? parseInt(apiPort) : null,
      vpnApiTarget ? parseInt(vpnApiTarget) : null,
      8520,
      8728,
      8729,
    ].filter(Boolean) as number[]
    const candidatePorts = Array.from(new Set(rawPorts))

    console.log(`[RouterTest] Testing MikroTik connection for host: ${candidateHosts.join(', ')} | ports: ${candidatePorts.join(', ')} | user: ${username}`)

    let lastError = 'Koneksi gagal'
    let lastDiagnosis = 'unknown'

    // 5. Intelligent Multi-Host, Multi-Cred, Multi-Port Test Loop
    for (const host of candidateHosts) {
      for (const cred of credPairs) {
        for (const testPort of candidatePorts) {
          const isTls = testPort === 8729
          const mtik = new MikroTikConnection({
            host,
            username: cred.user,
            password: cred.pass,
            port: testPort,
            timeout: 3500, // 3.5s per attempt for fast responsive probing
            tls: isTls,
          })

          try {
            const result = await mtik.testConnection()
            if (result.success) {
              console.log(`[RouterTest] SUCCESS on ${host}:${testPort} using ${cred.user} (${cred.label})! Identity: ${result.identity}`)
              return NextResponse.json({
                success: true,
                identity: result.identity,
                message: `Koneksi berhasil terhubung ke MikroTik (${result.identity})`,
                usedHost: host,
                usedPort: testPort,
                usedTls: isTls,
                usedUser: cred.user,
                testedPorts: candidatePorts,
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
      }
    }

    // 6. Generate dynamic fix script if all attempts failed
    const chosenPort = adminPort || 8520
    const chosenHost = candidateHosts[0] || '10.200.0.1'
    const vpsVpnIp = chosenHost.includes('.')
      ? chosenHost.substring(0, chosenHost.lastIndexOf('.')) + '.1'
      : '10.200.0.1'

    let fixScript = `# --- Perintah Fix Service API & Firewall MikroTik ---\n`
    fixScript += `/ip service set api port=${chosenPort} disabled=no address=""\n`
    fixScript += `/ip firewall filter add chain=input action=accept protocol=tcp dst-port=${chosenPort},8728 comment="Allow EugineBill VPS API" place-before=0\n`
    if (vpnClient) {
      const iface = vpnClient.vpnType === 'WIREGUARD' ? 'wg0-euginebill' : `ebl2-${vpnClient.name}`
      fixScript += `/ip firewall filter add chain=input action=accept in-interface="${iface}" place-before=0 comment="Allow EugineBill VPN Remote Access"\n`
    } else {
      fixScript += `/ip firewall filter add chain=input src-address=${vpsVpnIp} protocol=tcp dst-port=${chosenPort},8728 action=accept place-before=0 comment="Allow EugineBill VPS API"\n`
    }

    return NextResponse.json({
      success: false,
      message: lastError,
      diagnosis: lastDiagnosis,
      fixScript,
      testedPorts: candidatePorts,
      testedHosts: candidateHosts,
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

