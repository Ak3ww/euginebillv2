import 'server-only'
import { MikroTikConnection } from './client'
import { prisma } from '@/server/db/client'

export interface HotspotVoucherSyncItem {
  code: string
  password?: string | null
  profileName: string
  limitUptime?: string
  comment?: string
}

export class HotspotUserService {
  /**
   * Helper to create a MikroTikConnection for a given router.
   */
  private static async getRouterConnection(routerId: string): Promise<{ conn: MikroTikConnection; routerName: string } | null> {
    const router = await prisma.router.findUnique({
      where: { id: routerId },
    })
    if (!router) {
      console.error(`[HotspotUserService] Router not found: ${routerId}`)
      return null
    }

    const apiPort = router.port || 8728
    const conn = new MikroTikConnection({
      host: router.ipAddress,
      username: router.username,
      password: router.password,
      port: apiPort,
      tls: false,
      timeout: 10000,
    })

    return { conn, routerName: router.name }
  }

  /**
   * Sync a batch of vouchers to MikroTik /ip/hotspot/user.
   */
  static async syncVouchersToMikrotik(
    routerId: string,
    vouchers: HotspotVoucherSyncItem[]
  ): Promise<{ success: boolean; synced: number; failed: number; error?: string }> {
    if (!vouchers.length) return { success: true, synced: 0, failed: 0 }

    const routerInfo = await this.getRouterConnection(routerId)
    if (!routerInfo) return { success: false, synced: 0, failed: vouchers.length, error: 'Router not found' }

    const { conn, routerName } = routerInfo
    let synced = 0
    let failed = 0

    try {
      await conn.connect()
      console.log(`[HotspotUserService] Connected to ${routerName} (${routerId}) for sync of ${vouchers.length} vouchers`)

      for (const v of vouchers) {
        try {
          const pwd = v.password || v.code
          const existing = await conn.execute('/ip/hotspot/user/print', [`?name=${v.code}`])

          const params = [
            `=name=${v.code}`,
            `=password=${pwd}`,
            `=profile=${v.profileName || 'default'}`,
            `=comment=${v.comment || 'EugineBill'}`,
          ]
          if (v.limitUptime) {
            params.push(`=limit-uptime=${v.limitUptime}`)
          }

          if (existing && existing.length > 0) {
            await conn.execute('/ip/hotspot/user/set', [
              `=.id=${existing[0]['.id']}`,
              ...params.slice(1), // omit name on set
            ])
          } else {
            await conn.execute('/ip/hotspot/user/add', params)
          }
          synced++
        } catch (itemErr) {
          console.error(`[HotspotUserService] Failed to sync voucher ${v.code}:`, itemErr)
          failed++
        }
      }

      await conn.disconnect()
      return { success: true, synced, failed }
    } catch (err: any) {
      console.error(`[HotspotUserService] Connection/sync error on ${routerName}:`, err)
      try { await conn.disconnect() } catch { /* ignore */ }
      return { success: false, synced, failed, error: err?.message || 'Connection failed' }
    }
  }

  /**
   * Remove vouchers from MikroTik /ip/hotspot/user.
   */
  static async removeVouchersFromMikrotik(
    routerId: string,
    codes: string[]
  ): Promise<{ success: boolean; removed: number; error?: string }> {
    if (!codes.length) return { success: true, removed: 0 }

    const routerInfo = await this.getRouterConnection(routerId)
    if (!routerInfo) return { success: false, removed: 0, error: 'Router not found' }

    const { conn, routerName } = routerInfo
    let removed = 0

    try {
      await conn.connect()
      console.log(`[HotspotUserService] Connected to ${routerName} to remove ${codes.length} vouchers`)

      for (const code of codes) {
        try {
          const existing = await conn.execute('/ip/hotspot/user/print', [`?name=${code}`])
          if (existing && existing.length > 0) {
            for (const item of existing) {
              await conn.execute('/ip/hotspot/user/remove', [`=.id=${item['.id']}`])
              removed++
            }
          }
        } catch (itemErr) {
          console.error(`[HotspotUserService] Failed to remove voucher ${code}:`, itemErr)
        }
      }

      await conn.disconnect()
      return { success: true, removed }
    } catch (err: any) {
      console.error(`[HotspotUserService] Error removing vouchers on ${routerName}:`, err)
      try { await conn.disconnect() } catch { /* ignore */ }
      return { success: false, removed, error: err?.message || 'Connection failed' }
    }
  }

  /**
   * Reconcile all active/waiting vouchers from DB to MikroTik /ip/hotspot/user.
   * Useful for one-click failover or initial local import.
   */
  static async reconcileAllVouchersToMikrotik(routerId?: string): Promise<{
    totalSynced: number
    routersProcessed: number
    errors: string[]
  }> {
    const errors: string[] = []
    let totalSynced = 0
    let routersProcessed = 0

    // Determine target routers
    const routerWhere: any = { isActive: true }
    if (routerId && routerId !== 'all') {
      routerWhere.id = routerId
    }
    const targetRouters = await prisma.router.findMany({ where: routerWhere })

    for (const r of targetRouters) {
      // Find vouchers belonging to this router or universal (routerId is null)
      const vouchers = await prisma.hotspotVoucher.findMany({
        where: {
          status: { in: ['WAITING', 'ACTIVE'] },
          OR: [{ routerId: r.id }, { routerId: null }],
        },
        include: { profile: true },
      })

      if (!vouchers.length) continue

      const items: HotspotVoucherSyncItem[] = vouchers.map((v) => {
        let limitUptime: string | undefined
        if (v.profile) {
          switch (v.profile.validityUnit) {
            case 'MINUTES': limitUptime = `${v.profile.validityValue}m`; break
            case 'HOURS': limitUptime = `${v.profile.validityValue}h`; break
            case 'DAYS': limitUptime = `${v.profile.validityValue}d`; break
            case 'MONTHS': limitUptime = `${v.profile.validityValue * 30}d`; break
          }
        }
        return {
          code: v.code,
          password: v.password || v.code,
          profileName: v.profile.groupProfile || v.profile.name || 'default',
          limitUptime,
          comment: `EugineBill:${v.batchCode || 'MANUAL'}`,
        }
      })

      const res = await this.syncVouchersToMikrotik(r.id, items)
      if (res.success) {
        totalSynced += res.synced
        routersProcessed++
      } else {
        errors.push(`${r.name}: ${res.error}`)
      }
    }

    return { totalSynced, routersProcessed, errors }
  }

  /**
   * Set use-radius flag on Hotspot Profiles on the specified router.
   */
  static async setHotspotRadiusUsage(routerId: string, useRadius: boolean): Promise<boolean> {
    const routerInfo = await this.getRouterConnection(routerId)
    if (!routerInfo) return false

    const { conn, routerName } = routerInfo
    try {
      await conn.connect()
      const profiles = await conn.execute('/ip/hotspot/profile/print')
      for (const p of profiles) {
        await conn.execute('/ip/hotspot/profile/set', [
          `=.id=${p['.id']}`,
          `=use-radius=${useRadius ? 'yes' : 'no'}`,
        ])
      }
      console.log(`[HotspotUserService] Set use-radius=${useRadius} on ${routerName} (${profiles.length} profiles)`)
      await conn.disconnect()
      return true
    } catch (err) {
      console.error(`[HotspotUserService] Failed to set use-radius on ${routerName}:`, err)
      try { await conn.disconnect() } catch { /* ignore */ }
      return false
    }
  }

  /**
   * Fetch active hotspot sessions directly from MikroTik.
   */
  static async getActiveHotspotSessions(routerId: string): Promise<any[]> {
    const routerInfo = await this.getRouterConnection(routerId)
    if (!routerInfo) return []

    const { conn } = routerInfo
    try {
      await conn.connect()
      const active = await conn.execute('/ip/hotspot/active/print')
      await conn.disconnect()
      return active || []
    } catch (err) {
      console.error(`[HotspotUserService] Failed to get active sessions:`, err)
      try { await conn.disconnect() } catch { /* ignore */ }
      return []
    }
  }
}
