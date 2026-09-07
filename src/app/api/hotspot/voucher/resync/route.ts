import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/server/auth/config'
import { prisma } from '@/server/db/client'
import { syncVoucherToRadius } from '@/server/services/radius/hotspot-sync.service'
import { HotspotUserService } from '@/server/services/mikrotik/hotspot-user.service'

/**
 * POST /api/hotspot/voucher/resync
 * Re-sync all active/waiting vouchers to MikroTik local database AND/OR RADIUS
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const routerId = body.routerId || undefined
    const target = body.target || 'all' // 'all', 'mikrotik', 'radius'

    let mikrotikResult = { totalSynced: 0, routersProcessed: 0, errors: [] as string[] }
    let radiusCount = 0
    const radiusErrors: any[] = []

    // 1. Reconcile to MikroTik local database
    if (target === 'all' || target === 'mikrotik') {
      mikrotikResult = await HotspotUserService.reconcileAllVouchersToMikrotik(routerId)
    }

    // 2. Reconcile to RADIUS if enabled or requested
    const company = await prisma.company.findFirst({ select: { radiusHotspotEnabled: true, radiusEnabled: true } })
    const shouldSyncRadius = target === 'radius' || (target === 'all' && Boolean(company?.radiusHotspotEnabled))

    if (shouldSyncRadius) {
      const vouchers = await prisma.hotspotVoucher.findMany({
        where: {
          status: { in: ['WAITING', 'ACTIVE'] },
          ...(routerId && routerId !== 'all' ? { routerId } : {}),
        },
      })

      for (const voucher of vouchers) {
        try {
          await syncVoucherToRadius(voucher.id)
          radiusCount++
        } catch (error: any) {
          radiusErrors.push({ code: voucher.code, error: error.message })
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Sinkronisasi selesai. MikroTik: ${mikrotikResult.totalSynced} voucher di ${mikrotikResult.routersProcessed} router. RADIUS: ${radiusCount} voucher.`,
      mikrotik: mikrotikResult,
      radius: {
        synced: radiusCount,
        failed: radiusErrors.length,
        errors: radiusErrors,
      },
    })
  } catch (error: any) {
    console.error('Voucher resync error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Resync failed',
    }, { status: 500 })
  }
}
