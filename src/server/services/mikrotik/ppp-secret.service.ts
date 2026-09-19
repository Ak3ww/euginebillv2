import { MikroTikConnection } from './client'
import { prisma } from '@/server/db/client'

export interface SyncSecretDetailedResult {
  success: boolean
  message: string
  connectedPort?: number
  host?: string
}

export class PPPSecretService {
  /**
   * Connect to MikroTik with intelligent multi-port fallback:
   * 1. Tries configured port (e.g. 8520)
   * 2. If it fails/times out, tries 8728 (default MikroTik API port)
   * 3. If it fails, tries VPN client target port
   * If a fallback port succeeds, auto-updates the database so subsequent connections are instant.
   */
  static async connectToRouter(
    router: {
      id?: string
      name?: string
      ipAddress?: string | null
      nasname?: string | null
      port?: number | null
      username?: string | null
      password?: string | null
      vpnClient?: any
    },
    timeoutMsPerPort: number = 4000
  ): Promise<{ conn: MikroTikConnection; connectedPort: number; host: string }> {
    const host = router.ipAddress || router.nasname || (router.vpnClient?.vpnIp as string | undefined)
    if (!host) {
      throw new Error(`Router '${router.name || 'Unknown'}' tidak memiliki IP Address atau NAS Name`)
    }

    const vpnTargetPort = (router.vpnClient?.publicPorts as any)?.services?.api?.target
    const configuredPort = router.port || vpnTargetPort || 8728

    // Candidate ports in prioritized order (deduplicated)
    const candidatePorts: number[] = Array.from(
      new Set([configuredPort, 8728, 8520, vpnTargetPort].filter(Boolean) as number[])
    )

    const errors: string[] = []

    for (const port of candidatePorts) {
      const conn = new MikroTikConnection({
        host,
        username: router.username || 'admin',
        password: router.password || '',
        port,
        tls: false,
        timeout: timeoutMsPerPort,
      })

      try {
        console.log(`[PPPSecretService] Mencoba koneksi MikroTik API: ${host}:${port} (user: ${router.username})...`)
        await conn.connect()
        console.log(`[PPPSecretService] Berhasil terhubung ke MikroTik ${host}:${port}!`)

        // If connected on a different port than router.port, auto-heal router.port in DB
        if (router.id && router.port !== port) {
          await prisma.router.update({
            where: { id: router.id },
            data: { port },
          }).catch(() => {})
          console.log(`[PPPSecretService] Auto-healed router.port di database -> ${port}`)
        }

        return { conn, connectedPort: port, host }
      } catch (err: any) {
        const errMsg = err.message || String(err)
        errors.push(`Port ${port}: ${errMsg}`)
        console.warn(`[PPPSecretService] Gagal konek ke ${host}:${port} (${errMsg})`)
        try { await conn.disconnect() } catch { /* ignore */ }
      }
    }

    const combinedError = errors.join('; ')
    throw new Error(
      `Gagal terhubung ke MikroTik ${host} (Port dicoba: ${candidatePorts.join(', ')}): ${combinedError}. Pastikan: (1) Service API aktif di MikroTik (/ip service enable api; /ip service set api port=${configuredPort} address=""), (2) Firewall MikroTik mengizinkan port ${candidatePorts.join('/')} dari VPS: /ip firewall filter add chain=input action=accept protocol=tcp dst-port=${candidatePorts.join(',')} place-before=0 comment="Allow EugineBill API"`
    )
  }

  /**
   * Syncs a user to the MikroTik router's /ppp secret with detailed status feedback.
   */
  static async syncSecretDetailed(userId: string): Promise<SyncSecretDetailedResult> {
    const user = await prisma.pppoeUser.findUnique({
      where: { id: userId },
      include: { router: { include: { vpnClient: true } }, profile: true },
    })

    if (!user) {
      const msg = `User ${userId} tidak ditemukan di database`
      console.warn(`[PPPSecretService] ${msg}`)
      return { success: false, message: msg }
    }

    // Auto-resolve router if user.routerId is missing or empty
    let targetRouter = user.router
    if (!targetRouter) {
      const activeRouter = await prisma.router.findFirst({
        where: { isActive: true },
        include: { vpnClient: true },
        orderBy: { createdAt: 'asc' },
      })
      if (activeRouter) {
        targetRouter = activeRouter
        await prisma.pppoeUser.update({
          where: { id: userId },
          data: { routerId: activeRouter.id },
        }).catch(() => {})
        console.log(`[PPPSecretService] Auto-assigned active router '${activeRouter.name}' to user '${user.username}'`)
      }
    }

    if (!targetRouter) {
      const msg = `Tidak ada router aktif di database untuk pelanggan ${user.username}`
      console.warn(`[PPPSecretService] ${msg}`)
      return { success: false, message: msg }
    }

    let conn: MikroTikConnection | null = null
    let connectedPort = 8728
    let host = ''

    try {
      const res = await this.connectToRouter(targetRouter, 4000)
      conn = res.conn
      connectedPort = res.connectedPort
      host = res.host

      const profileName = user.profile?.mikrotikProfileName || user.profile?.name || 'default'
      const statusUpper = String(user.status || '').toUpperCase()
      const isSecretEnabled = ['ACTIVE', 'PENDING_INSTALLATION', 'PENDING'].includes(statusUpper)
      const secretPassword = user.password || user.portalPassword || 'eugine0909'

      // Ensure profile exists on MikroTik, or auto-create it with rate-limit, or fallback to 'default'
      let targetProfile = profileName
      try {
        const existingProfiles = await conn.execute('/ppp/profile/print', [`?name=${profileName}`], 4000)
        if (!existingProfiles || existingProfiles.length === 0) {
          try {
            const createParams = [`=name=${profileName}`]
            const rateLimit = user.profile?.rateLimit || (user.profile ? `${user.profile.uploadSpeed}M/${user.profile.downloadSpeed}M` : '')
            if (rateLimit && rateLimit !== '0M/0M') createParams.push(`=rate-limit=${rateLimit}`)
            await conn.execute('/ppp/profile/add', createParams, 4000)
            console.log(`[PPPSecretService] Auto-created profile '${profileName}' on MikroTik`)
          } catch (createErr) {
            console.warn(`[PPPSecretService] Auto-create profile '${profileName}' failed, fallback to 'default':`, createErr)
            targetProfile = 'default'
          }
        }
      } catch (checkErr) {
        console.warn(`[PPPSecretService] Profile check skipped/failed:`, checkErr)
        targetProfile = 'default'
      }

      // Check if secret exists
      const existing = await conn.execute('/ppp/secret/print', [`?name=${user.username}`], 4000)

      const secretParams = [
        `=password=${secretPassword}`,
        `=profile=${targetProfile}`,
        `=service=pppoe`,
        `=comment=${user.name || ''} - ${user.customerId || ''}`.trim(),
        `=disabled=${isSecretEnabled ? 'no' : 'yes'}`,
      ]
      if (user.ipAddress) {
        secretParams.push(`=remote-address=${user.ipAddress}`)
      }

      if (existing.length > 0) {
        // Update existing secret
        await conn.execute('/ppp/secret/set', [
          `=.id=${existing[0]['.id']}`,
          ...secretParams,
        ], 4000)
        console.log(`[PPPSecretService] Updated existing secret for '${user.username}' on MikroTik (${host}:${connectedPort})`)
      } else {
        // Add new secret
        await conn.execute('/ppp/secret/add', [
          `=name=${user.username}`,
          ...secretParams,
        ], 4000)
        console.log(`[PPPSecretService] Added new secret for '${user.username}' on MikroTik (${host}:${connectedPort})`)
      }

      await conn.disconnect()
      return {
        success: true,
        message: `Secret berhasil ditulis ke MikroTik ${targetRouter.name} (${host}:${connectedPort})`,
        connectedPort,
        host,
      }
    } catch (error: any) {
      const errMsg = error.message || String(error)
      console.error(`[PPPSecretService] Failed to sync secret for ${user?.username}:`, errMsg)
      if (conn) {
        try { await conn.disconnect() } catch { /* ignore */ }
      }
      return {
        success: false,
        message: errMsg,
        connectedPort,
        host,
      }
    }
  }

  /**
   * Syncs a user to the MikroTik router's /ppp secret.
   * Backward-compatible boolean wrapper.
   */
  static async syncSecret(userId: string): Promise<boolean> {
    const res = await this.syncSecretDetailed(userId)
    return res.success
  }

  /**
   * Modifies a user's PPP secret profile (e.g. to isolate) and kicks their active connection.
   */
  static async setProfileAndDisconnect(routerId: string, username: string, profileName: string): Promise<boolean> {
    console.log(`[PPPSecretService] setProfileAndDisconnect: routerId=${routerId}, username=${username}, profile=${profileName}`)

    const router = await prisma.router.findUnique({
      where: { id: routerId },
      include: { vpnClient: true },
    })
    if (!router) {
      console.error(`[PPPSecretService] Router not found for routerId: ${routerId}`)
      return false
    }

    let conn: MikroTikConnection | null = null
    try {
      const res = await this.connectToRouter(router, 4000)
      conn = res.conn

      const existing = await conn.execute('/ppp/secret/print', [`?name=${username}`])
      if (existing.length > 0) {
        await conn.execute('/ppp/secret/set', [
          `=.id=${existing[0]['.id']}`,
          `=profile=${profileName}`,
        ])
        console.log(`[PPPSecretService] Profile changed to '${profileName}' for ${username}`)
      } else {
        console.warn(`[PPPSecretService] PPP secret NOT FOUND for username '${username}' on router ${router.name}`)
      }

      // Kick active connection to force reconnect with new profile
      const active = await conn.execute('/ppp/active/print', [`?name=${username}`])
      if (active.length > 0) {
        await conn.execute('/ppp/active/remove', [`=.id=${active[0]['.id']}`])
        console.log(`[PPPSecretService] Kicked active session for ${username}`)
      } else {
        console.log(`[PPPSecretService] No active session to kick for ${username} (user is offline)`)
      }

      await conn.disconnect()
      return true
    } catch (error: any) {
      console.error(`[PPPSecretService] Failed to isolate/disconnect secret for ${username}:`, error.message || error)
      if (conn) {
        try { await conn.disconnect() } catch { /* ignore */ }
      }
      return false
    }
  }

  /**
   * Removes a user from the MikroTik router's /ppp secret.
   */
  static async removeSecret(routerId: string, username: string): Promise<boolean> {
    const router = await prisma.router.findUnique({
      where: { id: routerId },
      include: { vpnClient: true },
    })
    if (!router) return false

    let conn: MikroTikConnection | null = null
    try {
      const res = await this.connectToRouter(router, 4000)
      conn = res.conn

      const existing = await conn.execute('/ppp/secret/print', [`?name=${username}`])
      if (existing.length > 0) {
        await conn.execute('/ppp/secret/remove', [`=.id=${existing[0]['.id']}`])
      }
      const active = await conn.execute('/ppp/active/print', [`?name=${username}`])
      if (active.length > 0) {
        await conn.execute('/ppp/active/remove', [`=.id=${active[0]['.id']}`])
      }

      await conn.disconnect()
      return true
    } catch (error: any) {
      console.error(`Failed to remove secret for ${username}:`, error.message || error)
      if (conn) {
        try { await conn.disconnect() } catch { /* ignore */ }
      }
      return false
    }
  }
}
