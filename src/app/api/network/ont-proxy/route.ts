/**
 * GET /api/network/ont-proxy
 *
 * Direct HTTP Reverse Proxy untuk Web GUI ONT pelanggan.
 * Meneruskan request dari Browser Admin ke IP ONT via VPN Tunnel VPS.
 * Membuka langsung Web UI ONT (ZTE, Huawei, Fiberhome, dll) di tab browser baru.
 *
 * Auth: Memerlukan sesi Admin / Staff aktif.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/server/auth/config'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const targetIp = searchParams.get('ip')
  const targetPort = searchParams.get('port') || '80'
  const subPath = searchParams.get('path') || '/'

  if (!targetIp) {
    return new NextResponse('Missing ONT IP address parameter', { status: 400 })
  }

  // Sanitize IP format
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/
  if (!ipRegex.test(targetIp)) {
    return new NextResponse('Invalid ONT IP address format', { status: 400 })
  }

  const portNum = parseInt(targetPort) || 80
  const ontUrl = `http://${targetIp}:${portNum}${subPath.startsWith('/') ? subPath : '/' + subPath}`

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)

    const response = await fetch(ontUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Host': `${targetIp}:${portNum}`,
      },
      signal: controller.signal,
      redirect: 'manual',
    })

    clearTimeout(timeoutId)

    // Tangani HTTP Redirects dari ONT (misal 301 / 302 ke login.asp)
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (location) {
        let redirectPath = location
        if (location.startsWith('http://') || location.startsWith('https://')) {
          try {
            const locUrl = new URL(location)
            redirectPath = locUrl.pathname + locUrl.search
          } catch { /* keep as is */ }
        }
        const proxyRedirectUrl = `/api/network/ont-proxy?ip=${targetIp}&port=${portNum}&path=${encodeURIComponent(redirectPath)}`
        return NextResponse.redirect(new URL(proxyRedirectUrl, req.url))
      }
    }

    const contentType = response.headers.get('content-type') || 'text/html'
    const bodyBuffer = await response.arrayBuffer()

    const resHeaders = new Headers()
    resHeaders.set('Content-Type', contentType)
    resHeaders.set('Cache-Control', 'no-store, no-cache, must-revalidate')

    return new NextResponse(bodyBuffer, {
      status: response.status,
      headers: resHeaders,
    })
  } catch (err: any) {
    const isTimeout = err.name === 'AbortError'
    return new NextResponse(
      `<html><body style="font-family:sans-serif;padding:40px;background:#0f172a;color:#f8fafc;text-align:center;">
        <div style="max-width:500px;margin:0 auto;background:#1e293b;padding:30px;border-radius:16px;border:1px solid #334155;">
          <h2 style="color:#ef4444;margin-top:0;">⚠️ Gagal Mengakses ONT</h2>
          <p style="color:#94a3b8;">${isTimeout ? `Koneksi ke ONT (${targetIp}:${portNum}) mengalami timeout (8 detik).` : `Error: ${err.message}`}</p>
          <p style="font-size:13px;color:#64748b;margin-top:20px;">
            Pastikan ONT sedang online, Web Server ONT aktif, dan MikroTik VPN terhubung ke VPS.
          </p>
        </div>
      </body></html>`,
      {
        status: 504,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }
    )
  }
}
