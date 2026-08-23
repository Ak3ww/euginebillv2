import { NextRequest, NextResponse } from 'next/server'
import http from 'http'
import https from 'https'
import { prisma } from '@/server/db/client'

export const dynamic = 'force-dynamic'

const httpAgent = new http.Agent({ maxSockets: 4, keepAlive: false, timeout: 20000 })
const httpsAgent = new https.Agent({ maxSockets: 4, keepAlive: false, timeout: 20000, rejectUnauthorized: false })

async function handleProxy(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string; path?: string[] }> }
) {
  const { sessionId, path: pathSegments } = await params
  if (!sessionId) {
    return new NextResponse('Session ID is required', { status: 400 })
  }

  // 1. Fetch ONT Remote Session from database
  const ontSession = await prisma.ontRemoteSession.findUnique({
    where: { id: sessionId },
  })

  if (!ontSession) {
    return new NextResponse(
      `<!DOCTYPE html>
      <html>
      <head><title>Sesi Tidak Ditemukan</title><meta name="viewport" content="width=device-width, initial-scale=1"></head>
      <body style="font-family:sans-serif;background:#0f172a;color:#f8fafc;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
        <div style="text-align:center;padding:30px;background:#1e293b;border-radius:16px;max-width:400px;box-shadow:0 20px 25px -5px rgba(0,0,0,0.5);">
          <h2 style="color:#ef4444;margin-top:0;">Sesi Remote Tidak Ditemukan</h2>
          <p style="color:#94a3b8;font-size:14px;">Sesi remote ONT ini sudah tidak ada atau telah dihapus.</p>
          <a href="/admin/sessions/pppoe" style="display:inline-block;margin-top:12px;padding:8px 16px;background:#0284c7;color:white;text-decoration:none;border-radius:8px;font-size:13px;font-weight:bold;">Kembali ke Sesi PPPoE</a>
        </div>
      </body>
      </html>`,
      { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    )
  }

  // Check expiration
  if (ontSession.status !== 'ACTIVE' || new Date(ontSession.expiresAt) < new Date()) {
    return new NextResponse(
      `<!DOCTYPE html>
      <html>
      <head><title>Sesi Kadaluarsa</title><meta name="viewport" content="width=device-width, initial-scale=1"></head>
      <body style="font-family:sans-serif;background:#0f172a;color:#f8fafc;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
        <div style="text-align:center;padding:30px;background:#1e293b;border-radius:16px;max-width:400px;box-shadow:0 20px 25px -5px rgba(0,0,0,0.5);">
          <h2 style="color:#f59e0b;margin-top:0;">Sesi Remote Kadaluarsa</h2>
          <p style="color:#94a3b8;font-size:14px;">Sesi untuk <b>${ontSession.customerName || 'Pelanggan'}</b> telah berakhir. Silakan buka kembali dari menu Sesi PPPoE.</p>
          <a href="/admin/sessions/pppoe" style="display:inline-block;margin-top:12px;padding:8px 16px;background:#0284c7;color:white;text-decoration:none;border-radius:8px;font-size:13px;font-weight:bold;">Buka Sesi Baru</a>
        </div>
      </body>
      </html>`,
      { status: 410, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    )
  }

  // 2. Resolve MikroTik VPN IP and ONT target details
  const targetPort = ontSession.targetPort || 80
  const isHttps = targetPort === 443
  const ontIp = ontSession.targetIp
  const proxyPort = ontSession.proxyPort

  // Target host in VPN tunnel (MikroTik VPN IP)
  let routerVpnIp = '10.200.0.2'
  try {
    const router = await prisma.router.findFirst({ where: { isActive: true } })
    if (router?.ipAddress || router?.nasname) {
      routerVpnIp = router.ipAddress || router.nasname
    }
  } catch {
    // default fallback
  }

  // Build target URL path and query string
  const subPath = pathSegments && pathSegments.length > 0 ? '/' + pathSegments.join('/') : '/'
  const searchParams = request.nextUrl.search || ''
  const fullTargetPath = subPath + searchParams

  // 3. Read body if POST/PUT
  let bodyBuffer: Buffer | null = null
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    try {
      const arrayBuffer = await request.arrayBuffer()
      bodyBuffer = Buffer.from(arrayBuffer)
    } catch {
      bodyBuffer = null
    }
  }

  // 4. Build outgoing headers matching ONT's expected WAN format
  const outgoingHeaders: Record<string, string> = {
    'Host': targetPort === 80 ? ontIp : `${ontIp}:${targetPort}`,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    'Accept': request.headers.get('accept') || '*/*',
    'Accept-Language': 'id,en-US;q=0.9,en;q=0.8',
    'Connection': 'close',
    'Referer': `${isHttps ? 'https://' : 'http://'}${ontIp}/`,
    'Origin': `${isHttps ? 'https://' : 'http://'}${ontIp}`,
  }

  if (request.headers.get('content-type')) {
    outgoingHeaders['Content-Type'] = request.headers.get('content-type')!
  }
  if (bodyBuffer && bodyBuffer.length > 0) {
    outgoingHeaders['Content-Length'] = bodyBuffer.length.toString()
  }
  if (request.headers.get('cookie')) {
    outgoingHeaders['Cookie'] = request.headers.get('cookie')!
  }
  if (request.headers.get('x-requested-with')) {
    outgoingHeaders['X-Requested-With'] = request.headers.get('x-requested-with')!
  }
  if (request.headers.get('authorization')) {
    outgoingHeaders['Authorization'] = request.headers.get('authorization')!
  }

  // 5. Execute HTTP request to MikroTik DST-NAT port
  const client = isHttps ? https : http
  const agent = isHttps ? httpsAgent : httpAgent

  return new Promise<NextResponse>((resolve) => {
    const options: any = {
      host: routerVpnIp,
      port: proxyPort,
      path: fullTargetPath,
      method: request.method,
      headers: outgoingHeaders,
      agent: agent,
      timeout: 15000,
      rejectUnauthorized: false,
    }

    const proxyReq = client.request(options, (proxyRes) => {
      proxyReq.setTimeout(0) // cancel timeout once response begins

      const chunks: Buffer[] = []
      proxyRes.on('data', (chunk) => chunks.push(Buffer.from(chunk)))

      proxyRes.on('end', () => {
        const rawBody = Buffer.concat(chunks)
        const contentType = proxyRes.headers['content-type'] || 'text/html'
        const statusCode = proxyRes.statusCode || 200

        const responseHeaders = new Headers()
        responseHeaders.set('Content-Type', contentType)
        responseHeaders.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
        responseHeaders.set('Pragma', 'no-cache')

        // Handle Redirects
        if (proxyRes.headers['location']) {
          let loc = proxyRes.headers['location']
          loc = loc.replace(/https?:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?/gi, '')
          if (loc.startsWith('/')) {
            loc = `/api/network/ont-remote/proxy/${sessionId}${loc}`
          }
          responseHeaders.set('Location', loc)
          return resolve(new NextResponse(null, { status: statusCode, headers: responseHeaders }))
        }

        // Handle Cookies
        const rawCookies = proxyRes.headers['set-cookie']
        if (rawCookies) {
          const cookieList = Array.isArray(rawCookies) ? rawCookies : [rawCookies]
          for (const c of cookieList) {
            const cleanCookie = c
              .replace(/domain=[^;]+;?/gi, '')
              .replace(/SameSite=Strict/gi, 'SameSite=Lax')
              .replace(/SameSite=None/gi, 'SameSite=Lax')
            responseHeaders.append('Set-Cookie', cleanCookie)
          }
        }

        // HTML Processing: Inject Base tag and rewrite absolute IPs
        if (contentType.toLowerCase().includes('text/html')) {
          let html = rawBody.toString('utf-8')
          const proxyBasePath = `/api/network/ont-remote/proxy/${sessionId}/`

          // Inject <base> tag to auto-route all relative assets and AJAX
          if (html.includes('<head>') || html.includes('<HEAD>')) {
            html = html.replace(/(<head[^>]*>)/i, `$1\n<base href="${proxyBasePath}">\n`)
          } else {
            html = `<base href="${proxyBasePath}">\n` + html
          }

          // Rewrite any internal IP links in HTML
          html = html.replace(/https?:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?\//gi, proxyBasePath)

          return resolve(new NextResponse(html, { status: statusCode, headers: responseHeaders }))
        }

        // Binary / CSS / JS / Images / AJAX JSON or XML
        return resolve(new NextResponse(rawBody, { status: statusCode, headers: responseHeaders }))
      })
    })

    proxyReq.on('error', (err) => {
      console.error(`[ONT-Proxy-Route] Error fetching ${fullTargetPath}:`, err.message)
      const errorHtml = `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:30px;background:#0f172a;color:#f8fafc;text-align:center;"><div style="max-width:480px;margin:40px auto;background:#1e293b;padding:24px;border-radius:16px;"><h3 style="color:#ef4444;margin-top:0;">Gagal Menghubungi Modem ONT</h3><p style="color:#94a3b8;font-size:13px;">Target IP <b>${ontIp}:${targetPort}</b> tidak merespons via MikroTik.</p><p style="color:#64748b;font-size:12px;">${err.message}</p></div></body></html>`
      return resolve(new NextResponse(errorHtml, { status: 502, headers: { 'Content-Type': 'text/html; charset=utf-8' } }))
    })

    proxyReq.on('timeout', () => {
      proxyReq.destroy(new Error('Gateway Timeout (ONT tidak merespons dalam 15 detik)'))
    })

    if (bodyBuffer && bodyBuffer.length > 0) {
      proxyReq.write(bodyBuffer)
    }
    proxyReq.end()
  })
}

export async function GET(request: NextRequest, context: { params: Promise<{ sessionId: string }> }) {
  return handleProxy(request, context as any)
}

export async function POST(request: NextRequest, context: { params: Promise<{ sessionId: string }> }) {
  return handleProxy(request, context as any)
}

export async function PUT(request: NextRequest, context: { params: Promise<{ sessionId: string }> }) {
  return handleProxy(request, context as any)
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ sessionId: string }> }) {
  return handleProxy(request, context as any)
}

export async function HEAD(request: NextRequest, context: { params: Promise<{ sessionId: string }> }) {
  return handleProxy(request, context as any)
}

export async function OPTIONS(request: NextRequest, context: { params: Promise<{ sessionId: string }> }) {
  return handleProxy(request, context as any)
}
