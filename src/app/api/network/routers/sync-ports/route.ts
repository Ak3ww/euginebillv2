/**
 * POST /api/network/routers/sync-ports
 *
 * Membaca port layanan aktual dari MikroTik via RouterOS API (/ip/service/print),
 * lalu mengupdate publicPorts di vpnClient yang terhubung ke router ini,
 * dan meregenerasi iptables PREROUTING DNAT rules dengan port yang benar.
 *
 * Flow:
 * 1. Dapatkan router + vpnClient yang terhubung
 * 2. Konek ke MikroTik via API (menggunakan router.ipAddress = VPN IP)
 * 3. Baca /ip/service/print untuk mendapatkan port aktual setiap layanan
 * 4. Bandingkan dengan publicPorts yang tersimpan
 * 5. Jika ada perbedaan: hapus iptables lama, buat iptables baru, update DB
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/server/auth/config'
import { prisma } from '@/server/db/client'
import {
  addIptablesRules,
  removeIptablesRules,
  buildPublicPorts,
  type PublicPorts,
  type ServiceName,
} from '@/lib/vpn-port-allocator'

// Mapping nama service RouterOS → nama service kita
const ROS_SERVICE_MAP: Record<string, ServiceName> = {
  'api':      'api',
  'api-ssl':  'apiSsl',
  'www':      'www',
  'www-ssl':  'wwwSsl',
  'ssh':      'ssh',
  'ftp':      'ftp',
  'telnet':   'telnet',
  'winbox':   'winbox',
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { routerId } = await req.json()
  if (!routerId) return NextResponse.json({ error: 'routerId wajib diisi' }, { status: 400 })

  // 1. Ambil router + vpnClient
  const router = await prisma.router.findUnique({
    where: { id: routerId },
    include: {
      vpnClient: {
        select: {
          id: true,
          vpnIp: true,
          publicPorts: true,
        },
      },
    },
  })

  if (!router) return NextResponse.json({ error: 'Router tidak ditemukan' }, { status: 404 })
  if (!router.vpnClient) return NextResponse.json({ error: 'Router ini tidak terhubung ke VPN Client manapun' }, { status: 400 })
  if (!router.vpnClient.publicPorts) return NextResponse.json({ error: 'Router ini belum memiliki alokasi port publik. Buat ulang VPN Client untuk mendapatkan alokasi port otomatis.' }, { status: 400 })

  const vpnIp = router.vpnClient.vpnIp
  const oldPorts = router.vpnClient.publicPorts as unknown as PublicPorts

  // 2. Konek ke MikroTik via API (via VPN tunnel)
  let actualPorts: Partial<Record<ServiceName, number>> = {}
  let connected = false

  try {
    const RouterOSAPI = require('node-routeros').RouterOSAPI
    const conn = new RouterOSAPI({
      host: router.ipAddress,
      user: router.username,
      password: router.password,
      port: router.port || 8728,
      timeout: 8,
    })

    await Promise.race([
      conn.connect(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout koneksi MikroTik')), 10000)),
    ])

    connected = true

    // Baca semua service dan port yang aktif
    const services = await conn.write('/ip/service/print')
    conn.close()

    for (const svc of services) {
      const rosName = svc.name?.toLowerCase()
      const ourName = ROS_SERVICE_MAP[rosName]
      if (!ourName) continue
      const port = parseInt(svc.port)
      if (!isNaN(port) && port > 0) {
        actualPorts[ourName] = port
      }
    }
  } catch (err: any) {
    return NextResponse.json({
      error: `Gagal konek ke MikroTik (${router.ipAddress}): ${err.message}`,
      hint: 'Pastikan MikroTik sudah terhubung ke VPN dan credentials API sudah benar.',
    }, { status: 503 })
  }

  if (Object.keys(actualPorts).length === 0) {
    return NextResponse.json({ error: 'Tidak ada data service yang dapat dibaca dari MikroTik' }, { status: 500 })
  }

  // 3. Bandingkan dengan publicPorts yang tersimpan
  const changes: Array<{ service: ServiceName; oldTarget: number; newTarget: number; publicPort: number }> = []
  for (const [svc, actualPort] of Object.entries(actualPorts) as [ServiceName, number][]) {
    const existing = oldPorts.services[svc]
    if (existing && existing.target !== actualPort) {
      changes.push({
        service: svc,
        oldTarget: existing.target,
        newTarget: actualPort,
        publicPort: existing.public,
      })
    }
  }

  if (changes.length === 0) {
    return NextResponse.json({
      success: true,
      message: 'Semua port sudah sinkron, tidak ada perubahan.',
      actualPorts,
      publicPorts: oldPorts,
    })
  }

  // 4. Hapus iptables rules lama untuk service yang berubah
  const changedServices = changes.map(c => c.service)
  await removeIptablesRules(vpnIp, oldPorts, changedServices)

  // 5. Buat publicPorts baru dengan target port yang diperbarui
  const updatedTargetPorts: Partial<Record<ServiceName, number>> = {}
  for (const [svc, entry] of Object.entries(oldPorts.services) as [ServiceName, { public: number; target: number }][]) {
    updatedTargetPorts[svc] = actualPorts[svc] ?? entry.target
  }
  const newPorts = buildPublicPorts(oldPorts.blockStart, updatedTargetPorts)

  // 6. Pasang iptables rules baru dengan target port yang benar
  await addIptablesRules(vpnIp, newPorts, changedServices)

  // 7. Update DB
  await prisma.vpnClient.update({
    where: { id: router.vpnClient.id },
    data: { publicPorts: newPorts as any },
  })

  return NextResponse.json({
    success: true,
    message: `${changes.length} port berhasil disinkronkan dari MikroTik.`,
    changes,
    publicPorts: newPorts,
    actualPorts,
  })
}
