/**
 * GET/POST /api/admin/routers/reassign-areas
 *
 * Memisahkan ulang area dan pelanggan PPPoE antara Router Citeureup dan Router Cibinong:
 * - Wilayah/Area yang mengandung nama "tegal" (misal: Kampung Tegal) → Router Citeureup
 * - Seluruh Wilayah/Area dan Pelanggan sisanya → Router Cibinong
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/server/db/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/server/auth/config'

export async function GET(req: NextRequest) {
  return handleReassign(req)
}

export async function POST(req: NextRequest) {
  return handleReassign(req)
}

async function handleReassign(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const routers = await prisma.router.findMany({
      orderBy: { createdAt: 'asc' },
    })

    if (routers.length === 0) {
      return NextResponse.json({ error: 'Tidak ada router yang terdaftar' }, { status: 400 })
    }

    // Cari router Citeureup & Cibinong
    const citeureupRouter = routers.find((r) => r.name.toLowerCase().includes('citeureup')) ||
      routers.find((r) => r.ipAddress === '103.157.79.178' || r.nasname === '103.157.79.178') ||
      routers[0]

    const cibinongRouter = routers.find((r) => r.id !== citeureupRouter.id && (r.name.toLowerCase().includes('cibinong') || r.ipAddress.startsWith('10.'))) ||
      routers.find((r) => r.id !== citeureupRouter.id) ||
      routers[0]

    if (!citeureupRouter || !cibinongRouter || citeureupRouter.id === cibinongRouter.id) {
      return NextResponse.json({
        error: 'Diperlukan minimal 2 router terpisah (Citeureup & Cibinong). Pastikan Anda sudah menambahkan Router Cibinong baru di menu Routers / NAS.',
        routers,
      }, { status: 400 })
    }

    console.log(`[Reassign] Citeureup Router: ${citeureupRouter.name} (${citeureupRouter.id})`)
    console.log(`[Reassign] Cibinong Router: ${cibinongRouter.name} (${cibinongRouter.id})`)

    // 1. Ambil semua area
    const areas = await prisma.pppoeArea.findMany()

    let citeureupAreaIds: string[] = []
    let cibinongAreaIds: string[] = []

    for (const area of areas) {
      const isTegal = area.name.toLowerCase().includes('tegal')
      if (isTegal) {
        citeureupAreaIds.push(area.id)
      } else {
        cibinongAreaIds.push(area.id)
      }
    }

    // Update routerId di pppoeArea
    if (citeureupAreaIds.length > 0) {
      await prisma.pppoeArea.updateMany({
        where: { id: { in: citeureupAreaIds } },
        data: { routerId: citeureupRouter.id },
      })
    }

    if (cibinongAreaIds.length > 0) {
      await prisma.pppoeArea.updateMany({
        where: { id: { in: cibinongAreaIds } },
        data: { routerId: cibinongRouter.id },
      })
    }

    // 2. Update pppoeUser
    // User yang berada di area Tegal → Citeureup
    const usersInTegalArea = await prisma.pppoeUser.updateMany({
      where: {
        OR: [
          { areaId: { in: citeureupAreaIds } },
          { address: { contains: 'tegal' } },
          { comment: { contains: 'tegal' } },
        ],
      },
      data: { routerId: citeureupRouter.id },
    })

    // Seluruh user sisanya → Cibinong
    const usersInCibinong = await prisma.pppoeUser.updateMany({
      where: {
        NOT: {
          OR: [
            { areaId: { in: citeureupAreaIds } },
            { address: { contains: 'tegal' } },
            { comment: { contains: 'tegal' } },
          ],
        },
      },
      data: { routerId: cibinongRouter.id },
    })

    const citeureupAreaNames = areas.filter((a) => citeureupAreaIds.includes(a.id)).map((a) => a.name)
    const cibinongAreaNames = areas.filter((a) => cibinongAreaIds.includes(a.id)).map((a) => a.name)

    return NextResponse.json({
      success: true,
      message: 'Berhasil memisahkan area & pelanggan ke Router masing-masing!',
      summary: {
        citeureup: {
          routerId: citeureupRouter.id,
          routerName: citeureupRouter.name,
          areasAssigned: citeureupAreaNames,
          usersCount: usersInTegalArea.count,
        },
        cibinong: {
          routerId: cibinongRouter.id,
          routerName: cibinongRouter.name,
          areasAssigned: cibinongAreaNames,
          usersCount: usersInCibinong.count,
        },
      },
    })
  } catch (err: any) {
    console.error('[Reassign Error]:', err)
    return NextResponse.json({ error: 'Gagal reassign area: ' + err.message }, { status: 500 })
  }
}
