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
      vpnClientId?: string | null
      vpnClient?: any
    },
    timeoutMsPerPort: number = 3000
  ): Promise<{ conn: MikroTikConnection; connectedPort: number; host: string }> {
    // 0. Auto-resolve vpnClient jika belum dimuat oleh caller
    let vpnClient = router.vpnClient
    if (!vpnClient) {
      if ((router as any).vpnClientId) {
        vpnClient = await prisma.vpnClient.findUnique({
          where: { id: (router as any).vpnClientId },
        }).catch(() => null)
      } else {
        const targetIp = router.ipAddress || router.nasname
        if (targetIp) {
          vpnClient = await prisma.vpnClient.findFirst({
            where: { vpnIp: targetIp },
          }).catch(() => null)
        }
      }
    }

    // 1. Host: utamakan IP VPN tunnel, fallback ke ipAddress / nasname
    const host = vpnClient?.vpnIp || router.ipAddress || router.nasname
    if (!host) {
      throw new Error(`Router '${router.name || 'Unknown'}' tidak memiliki IP Address atau VPN IP`)
    }

    // 2. Kredensial:
    // Utamakan apa yang ditulis admin di Router form, lalu kredensial API vpnClient, lalu tunnel vpnClient
    const credPairs: Array<{ user: string; pass: string; label: string }> = []
    const addCred = (user: string | null | undefined, pass: string | null | undefined, label: string) => {
      if (!user) return
      const trimmedUser = user.trim()
      const trimmedPass = pass || ''
      if (!trimmedUser) return
      const exists = credPairs.some(c => c.user === trimmedUser && c.pass === trimmedPass)
      if (!exists) {
        credPairs.push({ user: trimmedUser, pass: trimmedPass, label })
      }
    }

    // 2a. Kredensial router yang dikonfigurasi admin
    addCred(router.username, router.password, 'router')

    // 2b. Kredensial API di vpnClient (apiUsername / apiPassword)
    addCred(vpnClient?.apiUsername, vpnClient?.apiPassword, 'vpnClient.api')

    // 2c. Kredensial tunnel vpnClient (username / password)
    addCred(vpnClient?.username, vpnClient?.password, 'vpnClient.tunnel')

    // 2d. Default fallback
    if (credPairs.length === 0) {
      addCred('admin', '', 'default')
    }

    // 3. Port: port router (isian admin), target API vpnClient, 8520, 8728
    const vpnApiTarget = (vpnClient?.publicPorts as any)?.services?.api?.target
    const candidatePorts: number[] = Array.from(
      new Set([router.port, vpnApiTarget, 8520, 8728].filter(Boolean) as number[])
    )

    const errors: string[] = []

    for (const cred of credPairs) {
      for (const port of candidatePorts) {
        const conn = new MikroTikConnection({
          host,
          username: cred.user,
          password: cred.pass,
          port,
          tls: false,
          timeout: timeoutMsPerPort,
        })

        try {
          console.log(`[PPPSecretService] Mencoba MikroTik API ke ${host}:${port} (user: ${cred.user}, sumber: ${cred.label})...`)
          await conn.connect()
          console.log(`[PPPSecretService] Berhasil terhubung ke MikroTik ${host}:${port} menggunakan kredensial ${cred.label} (${cred.user})!`)

          // Auto-heal router.port di database jika port yang aktif berbeda
          if (router.id && router.port !== port) {
            await prisma.router.update({
              where: { id: router.id },
              data: { port },
            }).catch(() => {})
            console.log(`[PPPSecretService] Auto-healed router.port di database -> ${port}`)
          }

          // Auto-heal router username/password jika berhasil menggunakan kredensial vpnClient
          if (router.id && cred.label.startsWith('vpnClient') && (router.username !== cred.user || router.password !== cred.pass)) {
            await prisma.router.update({
              where: { id: router.id },
              data: { username: cred.user, password: cred.pass },
            }).catch(() => {})
            console.log(`[PPPSecretService] Auto-healed kredensial router dari ${cred.label} -> ${cred.user}`)
          }

          return { conn, connectedPort: port, host }
        } catch (err: any) {
          const errMsg = err.message || String(err)
          errors.push(`[${cred.label} ${cred.user}@${port}]: ${errMsg}`)
          console.warn(`[PPPSecretService] Gagal konek ke ${host}:${port} (${errMsg})`)
          try { await conn.disconnect() } catch { /* ignore */ }
        }
      }
    }

    const combinedError = errors.join('; ')
    throw new Error(
      `Gagal terhubung ke MikroTik ${host} (Port dicoba: ${candidatePorts.join(', ')}): ${combinedError}`
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
