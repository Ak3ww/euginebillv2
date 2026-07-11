import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/server/auth/config'
import { MikroTikConnection } from '@/server/services/mikrotik/client'

// POST - Test router connection
export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const { ipAddress, username, password, port, apiPort } = await request.json()

    if (!ipAddress || !username || !password) {
      return NextResponse.json(
        { error: 'IP Address, Username, and Password are required' },
        { status: 400 }
      )
    }

    const primaryPort = parseInt(port) || 8728

    // --- Try primary port (non-SSL) ---
    const mtik = new MikroTikConnection({
      host: ipAddress,
      username,
      password,
      port: primaryPort,
      timeout: 8000,
      tls: false,
    })
    const result = await mtik.testConnection()

    if (result.success) {
      return NextResponse.json({ ...result, usedPort: primaryPort, usedTls: false })
    }

    return NextResponse.json({
      success: false,
      message: result.message,
      diagnosis: result.message.includes('timed out') || result.message.includes('firewall')
        ? 'firewall_block'
        : result.message.includes('ECONNREFUSED')
        ? 'port_refused'
        : result.message.includes('wrong password') || result.message.includes('cannot log in')
        ? 'auth_failed'
        : 'unknown',
    })

  } catch (error: any) {
    console.error('Test router connection error:', error)
    return NextResponse.json({
      success: false,
      message: error.message || 'Connection test failed',
    })
  }
}
