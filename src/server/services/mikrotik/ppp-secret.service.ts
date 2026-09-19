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
   * Connect to MikroTik with intelligent multi-host, multi-port, and credential fallback:
   * 1. Tries candidate hosts: router.ipAddress, VPN IP, and nasname
   * 2. Tries candidate ports: router.port, VPN API target, 8520, 8728, 8729
   * 3. Tries candidate credentials: admin input, VPN API credentials, VPN tunnel credentials
   * Once connected, configures generous 15s command execution timeout.
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
    timeoutMsPerTarget: number = 3500
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

    const timeoutMs = Math.min(timeoutMsPerTarget || 3500, 5000)

    interface Candidate {
      host: string
      port: number
      user: string
      pass: string
      tls: boolean
      label: string
    }

    const candidates: Candidate[] = []
    const addCandidate = (host: string | null | undefined, port: number | null | undefined, user: string | null | undefined, pass: string | null | undefined, label: string) => {
      const h = host?.trim()
      const p = port || 8728
      const u = (user || 'admin').trim()
      const pwd = pass || ''
      if (!h || !p || !u) return
      const isTls = p === 8729
      const key = `${h}:${p}:${u}:${pwd}`
      if (!candidates.some(c => `${c.host}:${c.port}:${c.user}:${c.pass}` === key)) {
        candidates.push({ host: h, port: p, user: u, pass: pwd, tls: isTls, label })
      }
    }

    // Candidate 1: Router config persis yang diisi admin
    const configuredIp = router.ipAddress?.trim() || router.nasname?.trim()
    const configuredPort = router.port || (router as any).apiPort || undefined
    addCandidate(configuredIp, configuredPort, router.username, router.password, 'router-config')

    // Candidate 2: VPN Client config (jika router terhubung dengan VPN Client)
    if (vpnClient) {
      const vpnApiTarget = (vpnClient?.publicPorts as any)?.services?.api?.target
      const vpnPort = vpnApiTarget ? parseInt(vpnApiTarget) : (configuredPort || 8728)
      addCandidate(
        vpnClient.vpnIp,
        vpnPort,
        vpnClient.apiUsername || router.username,
        vpnClient.apiPassword || router.password,
        'vpn-client'
      )
    }

    // Candidate 3: Jika port kustom gagal, coba port default 8728 pada host utama
    if (configuredIp && configuredPort && configuredPort !== 8728) {
      addCandidate(configuredIp, 8728, router.username, router.password, 'router-default-8728')
    }

    if (candidates.length === 0) {
      throw new Error(`Router '${router.name || 'Unknown'}' tidak memiliki konfigurasi IP Address atau VPN`)
    }

    const errors: string[] = []

    for (const cand of candidates) {
      console.log(`[PPPSecretService] Menghubungi MikroTik via ${cand.label} ke ${cand.host}:${cand.port} (${cand.user})...`)
      const conn = new MikroTikConnection({
        host: cand.host,
        username: cand.user,
        password: cand.pass,
        port: cand.port,
        tls: cand.tls,
        timeout: timeoutMs,
      })

      try {
        await conn.connect()
        console.log(`[PPPSecretService] Berhasil terhubung ke MikroTik ${cand.host}:${cand.port} (${cand.user}) via ${cand.label}!`)
        return { conn, connectedPort: cand.port, host: cand.host }
      } catch (err: any) {
        try { await conn.disconnect() } catch {}
        const msg = err.message || String(err)
        console.warn(`[PPPSecretService] Gagal via ${cand.label} (${cand.host}:${cand.port}): ${msg}`)
        errors.push(`${cand.label} [${cand.host}:${cand.port}]: ${msg}`)
      }
    }

    throw new Error(`Gagal terhubung ke MikroTik '${router.name || 'Unknown'}': ${errors.join(' | ')}`)
  }

  /**
   * Syncs a user to the MikroTik router's /ppp secret with detailed status feedback.
   * Utilizes lightweight proplist queries and fail-safe fallback to prevent timeouts.
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
      const res = await this.connectToRouter(targetRouter, 3500)
      conn = res.conn
      connectedPort = res.connectedPort
      host = res.host

      const profileName = user.profile?.mikrotikProfileName || user.profile?.name || 'default'
      const statusUpper = String(user.status || '').toUpperCase()
      const isSecretEnabled = ['ACTIVE', 'PENDING_INSTALLATION', 'PENDING'].includes(statusUpper)
      const secretPassword = user.password || user.portalPassword || 'eugine0909'

      // 1. Target profile (fallback ke default ditangani otomatis jika router menolak profil kustom)
      const targetProfile = profileName

      // 2. Check if secret exists (clean query without invalid ?.proplist)
      let existing: any[] = []
      try {
        existing = await conn.execute(
          '/ppp/secret/print',
          [`?name=${user.username}`],
          12000
        )
      } catch (printErr: any) {
        console.warn(`[PPPSecretService] Query /ppp/secret/print failed (${printErr?.message}), attempting direct set/add...`)
      }

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

      if (existing && existing.length > 0) {
        // Update existing secret
        try {
          await conn.execute('/ppp/secret/set', [
            `=.id=${existing[0]['.id']}`,
            ...secretParams,
          ], 12000)
          console.log(`[PPPSecretService] Updated existing secret for '${user.username}' on MikroTik (${host}:${connectedPort})`)
        } catch (setErr: any) {
          if (targetProfile !== 'default' && String(setErr?.message).includes('profile')) {
            // Profile failed, retry with default profile
            secretParams[1] = '=profile=default'
            await conn.execute('/ppp/secret/set', [
              `=.id=${existing[0]['.id']}`,
              ...secretParams,
            ], 12000)
            console.log(`[PPPSecretService] Updated secret for '${user.username}' with fallback profile=default`)
          } else {
            throw setErr
          }
        }
      } else {
        // Add new secret
        try {
          await conn.execute('/ppp/secret/add', [
            `=name=${user.username}`,
            ...secretParams,
          ], 12000)
          console.log(`[PPPSecretService] Added new secret for '${user.username}' on MikroTik (${host}:${connectedPort})`)
        } catch (addErr: any) {
          const addMsg = String(addErr?.message || '')
          if (addMsg.includes('already exists') || addMsg.includes('already have')) {
            // Secret already exists, fetch ID and update
            const fetchAgain = await conn.execute(
              '/ppp/secret/print',
              [`?name=${user.username}`],
              10000
            )
            if (fetchAgain && fetchAgain.length > 0) {
              await conn.execute('/ppp/secret/set', [
                `=.id=${fetchAgain[0]['.id']}`,
                ...secretParams,
              ], 10000)
              console.log(`[PPPSecretService] Successfully updated already-existing secret for '${user.username}'`)
            }
          } else if (targetProfile !== 'default' && addMsg.includes('profile')) {
            secretParams[1] = '=profile=default'
            await conn.execute('/ppp/secret/add', [
              `=name=${user.username}`,
              ...secretParams,
            ], 10000)
            console.log(`[PPPSecretService] Added secret for '${user.username}' with fallback profile=default`)
          } else {
            throw addErr
          }
        }
      }

      // 3. If secret is enabled and active session exists, kick session so client ONT immediately receives new credentials/speed
      if (isSecretEnabled) {
        try {
          const activeSessions = await conn.execute(
            '/ppp/active/print',
            [`?name=${user.username}`],
            8000
          )
          if (activeSessions && activeSessions.length > 0) {
            for (const s of activeSessions) {
              if (s['.id']) await conn.execute('/ppp/active/remove', [`=.id=${s['.id']}`], 6000)
            }
          }
        } catch { /* non-fatal kick */ }
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
   * Dedicated, rock-solid method to un-isolate a user on payment:
   * 1. Re-enables PPP secret (=disabled=no)
   * 2. Sets profile to active package profile (with fallback to default)
   * 3. Kicks active session so ONT/router immediately reconnects
   * 4. Cleans firewall address-list 'isolir'
   * 5. Updates user status in DB
   */
  static async unisolateUser(
    userIdOrUsername: string,
    targetRouterId?: string
  ): Promise<{ success: boolean; message: string }> {
    console.log(`[PPPSecretService] unisolateUser called for: ${userIdOrUsername}`)

    const user = await prisma.pppoeUser.findFirst({
      where: {
        OR: [{ id: userIdOrUsername }, { username: userIdOrUsername }],
      },
      include: {
        router: { include: { vpnClient: true } },
        profile: true,
      },
    })

    if (!user) {
      const msg = `Pelanggan ${userIdOrUsername} tidak ditemukan di database`
      console.warn(`[PPPSecretService] ${msg}`)
      return { success: false, message: msg }
    }

    const routerId = targetRouterId || user.routerId
    let targetRouter = user.router
    if (!targetRouter && routerId) {
      targetRouter = await prisma.router.findUnique({
        where: { id: routerId },
        include: { vpnClient: true },
      })
    }
    if (!targetRouter) {
      targetRouter = await prisma.router.findFirst({
        where: { isActive: true },
        include: { vpnClient: true },
        orderBy: { createdAt: 'asc' },
      })
    }

    if (!targetRouter) {
      const msg = `Tidak ada router aktif di database untuk un-isolir ${user.username}`
      console.warn(`[PPPSecretService] ${msg}`)
      return { success: false, message: msg }
    }

    const normalProfile = user.profile?.mikrotikProfileName || user.profile?.name || user.profile?.groupName || 'default'
    let conn: MikroTikConnection | null = null

    try {
      const res = await this.connectToRouter(targetRouter, 3500)
      conn = res.conn

      // 1. Find and update existing secret
      let secretId: string | null = null
      try {
        const secrets = await conn.execute(
          '/ppp/secret/print',
          [`?name=${user.username}`],
          12000
        )
        if (secrets && secrets.length > 0) {
          secretId = secrets[0]['.id']
        }
      } catch (err: any) {
        console.warn(`[PPPSecretService] Failed to query secret for un-isolation (${err?.message})`)
      }

      if (secretId) {
        try {
          await conn.execute('/ppp/secret/set', [
            `=.id=${secretId}`,
            `=disabled=no`,
            `=profile=${normalProfile}`,
          ], 12000)
          console.log(`[PPPSecretService] Unisolated secret for '${user.username}': disabled=no, profile=${normalProfile}`)
        } catch (setErr: any) {
          if (normalProfile !== 'default') {
            // Profile may not exist on MikroTik, fall back to default
            await conn.execute('/ppp/secret/set', [
              `=.id=${secretId}`,
              `=disabled=no`,
              `=profile=default`,
            ], 12000)
            console.log(`[PPPSecretService] Unisolated secret for '${user.username}' with fallback profile=default`)
          } else {
            throw setErr
          }
        }
      } else {
        // Create secret if not present on MikroTik
        const password = user.password || user.portalPassword || 'eugine0909'
        const secretParams = [
          `=name=${user.username}`,
          `=password=${password}`,
          `=profile=${normalProfile}`,
          `=service=pppoe`,
          `=comment=${user.name || ''} - ${user.customerId || ''}`.trim(),
          `=disabled=no`,
        ]
        if (user.ipAddress) secretParams.push(`=remote-address=${user.ipAddress}`)

        try {
          await conn.execute('/ppp/secret/add', secretParams, 12000)
          console.log(`[PPPSecretService] Created new active secret for '${user.username}' during un-isolation`)
        } catch (addErr: any) {
          if (normalProfile !== 'default') {
            secretParams[2] = '=profile=default'
            await conn.execute('/ppp/secret/add', secretParams, 12000)
          }
        }
      }

      // 2. Kick active session so ONT immediately reconnects with full speed
      try {
        const activeSessions = await conn.execute(
          '/ppp/active/print',
          [`?name=${user.username}`],
          8000
        )
        if (activeSessions && activeSessions.length > 0) {
          for (const s of activeSessions) {
            if (s['.id']) await conn.execute('/ppp/active/remove', [`=.id=${s['.id']}`], 6000)
          }
          console.log(`[PPPSecretService] Kicked active session for '${user.username}' on un-isolation`)
        }
      } catch (kickErr: any) {
        console.warn(`[PPPSecretService] Kick active session error (non-fatal):`, kickErr?.message)
      }

      // 3. Clean MikroTik firewall address-list 'isolir'
      try {
        const addressList = await conn.execute(
          '/ip/firewall/address-list/print',
          [`?list=isolir`],
          8000
        )
        if (addressList && addressList.length > 0) {
          for (const entry of addressList) {
            const matchesUser = entry.comment === user.username || (user.ipAddress && entry.address === user.ipAddress)
            if (matchesUser && entry['.id']) {
              await conn.execute('/ip/firewall/address-list/remove', [`=.id=${entry['.id']}`], 6000)
              console.log(`[PPPSecretService] Removed '${user.username}' (${entry.address}) from firewall address-list 'isolir'`)
            }
          }
        }
      } catch { /* non-fatal address-list cleanup */ }

      await conn.disconnect()

      // 4. Update status in database
      await prisma.pppoeUser.update({
        where: { id: user.id },
        data: { status: 'active', lastSyncAt: new Date() },
      }).catch(() => {})

      return {
        success: true,
        message: `Pelanggan ${user.username} berhasil di-unisolir dan aktif kembali di MikroTik ${targetRouter.name}`,
      }
    } catch (error: any) {
      console.error(`[PPPSecretService] Failed to unisolate user ${user.username}:`, error.message || error)
      if (conn) {
        try { await conn.disconnect() } catch { /* ignore */ }
      }
      return {
        success: false,
        message: `Gagal un-isolir ${user.username} di MikroTik: ${error.message || error}`,
      }
    }
  }

  /**
   * Modifies a user's PPP secret profile (e.g. to isolate or restore) and kicks their active connection.
   */
  static async setProfileAndDisconnect(
    routerId: string,
    username: string,
    profileName: string,
    enableSecret: boolean = true
  ): Promise<boolean> {
    console.log(`[PPPSecretService] setProfileAndDisconnect: routerId=${routerId}, username=${username}, profile=${profileName}, enable=${enableSecret}`)

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
      const res = await this.connectToRouter(router, 3500)
      conn = res.conn

      const existing = await conn.execute(
        '/ppp/secret/print',
        [`?name=${username}`],
        12000
      )

      const disabledValue = enableSecret ? 'no' : 'yes'

      if (existing && existing.length > 0) {
        try {
          await conn.execute('/ppp/secret/set', [
            `=.id=${existing[0]['.id']}`,
            `=profile=${profileName}`,
            `=disabled=${disabledValue}`,
          ], 12000)
          console.log(`[PPPSecretService] Profile set to '${profileName}', disabled=${disabledValue} for ${username}`)
        } catch (setErr: any) {
          // Fallback to default profile if custom profile does not exist
          if (profileName !== 'default') {
            await conn.execute('/ppp/secret/set', [
              `=.id=${existing[0]['.id']}`,
              `=profile=default`,
              `=disabled=${disabledValue}`,
            ], 12000)
            console.log(`[PPPSecretService] Profile fallback to 'default', disabled=${disabledValue} for ${username}`)
          } else {
            throw setErr
          }
        }
      } else {
        console.warn(`[PPPSecretService] PPP secret NOT FOUND for username '${username}' on router ${router.name}`)
      }

      // Kick active connection to force reconnect with new profile
      const active = await conn.execute(
        '/ppp/active/print',
        [`?name=${username}`],
        8000
      )
      if (active && active.length > 0) {
        for (const s of active) {
          if (s['.id']) await conn.execute('/ppp/active/remove', [`=.id=${s['.id']}`], 6000)
        }
        console.log(`[PPPSecretService] Kicked active session for ${username}`)
      } else {
        console.log(`[PPPSecretService] No active session to kick for ${username} (user is offline)`)
      }

      await conn.disconnect()
      return true
    } catch (error: any) {
      console.error(`[PPPSecretService] Failed to set profile/disconnect for ${username}:`, error.message || error)
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
      const res = await this.connectToRouter(router, 3500)
      conn = res.conn

      const existing = await conn.execute(
        '/ppp/secret/print',
        [`?name=${username}`],
        12000
      )
      if (existing && existing.length > 0) {
        for (const s of existing) {
          if (s['.id']) await conn.execute('/ppp/secret/remove', [`=.id=${s['.id']}`], 8000)
        }
      }
      const active = await conn.execute(
        '/ppp/active/print',
        [`?name=${username}`],
        8000
      )
      if (active && active.length > 0) {
        for (const a of active) {
          if (a['.id']) await conn.execute('/ppp/active/remove', [`=.id=${a['.id']}`], 6000)
        }
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
