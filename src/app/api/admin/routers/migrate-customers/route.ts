import { NextResponse } from 'next/server'
import { prisma } from '@/server/db/client'
import { checkAuth } from '@/server/middleware/api-auth'

export const dynamic = 'force-dynamic'

// POST /api/admin/routers/migrate-customers
// Body: { fromRouterId: string, toRouterId: string }
export async function POST(req: Request) {
  try {
    const auth = await checkAuth()
    if (!auth.authorized) {
      return auth.response
    }

    const body = await req.json().catch(() => ({}))
    const { fromRouterId, toRouterId } = body

    if (!fromRouterId || !toRouterId) {
      return NextResponse.json({ error: 'fromRouterId dan toRouterId wajib diisi' }, { status: 400 })
    }

    if (fromRouterId === toRouterId) {
      return NextResponse.json({ error: 'Router asal dan router tujuan tidak boleh sama' }, { status: 400 })
    }

    const [fromRouter, toRouter] = await Promise.all([
      prisma.router.findUnique({ where: { id: fromRouterId } }),
      prisma.router.findUnique({ where: { id: toRouterId } }),
    ])

    if (!fromRouter) {
      return NextResponse.json({ error: 'Router asal tidak ditemukan' }, { status: 404 })
    }
    if (!toRouter) {
      return NextResponse.json({ error: 'Router tujuan tidak ditemukan' }, { status: 404 })
    }

    // Pindahkan semua relasi dalam transaction
    const [users, areas, vouchers, agents, olt] = await prisma.$transaction([
      prisma.pppoeUser.updateMany({
        where: { routerId: fromRouterId },
        data: { routerId: toRouterId },
      }),
      prisma.pppoeArea.updateMany({
        where: { routerId: fromRouterId },
        data: { routerId: toRouterId },
      }),
      prisma.hotspotVoucher.updateMany({
        where: { routerId: fromRouterId },
        data: { routerId: toRouterId },
      }),
      prisma.agent.updateMany({
        where: { routerId: fromRouterId },
        data: { routerId: toRouterId },
      }),
      prisma.networkOLTRouter.updateMany({
        where: { routerId: fromRouterId },
        data: { routerId: toRouterId },
      }),
    ])

    return NextResponse.json({
      success: true,
      message: `Berhasil memindahkan seluruh data dari ${fromRouter.name} ke ${toRouter.name}`,
      migrated: {
        pppoeUsers: users.count,
        pppoeAreas: areas.count,
        hotspotVouchers: vouchers.count,
        agents: agents.count,
        oltRouters: olt.count,
      },
    })
  } catch (error: any) {
    console.error('Error migrating router customers:', error)
    return NextResponse.json({ error: error.message || 'Gagal memindahkan data pelanggan' }, { status: 500 })
  }
}
