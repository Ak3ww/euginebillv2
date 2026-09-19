import { MikroTikConnection } from './client'
import { prisma } from '@/server/db/client'

export class PPPSecretService {
  /**
   * Syncs a user to the MikroTik router's /ppp secret.
   * Finds the router from user.routerId, connects to it, and updates/adds the secret.
   */
  static async syncSecret(userId: string): Promise<boolean> {
    const user = await prisma.pppoeUser.findUnique({
      where: { id: userId },
      include: { router: { include: { vpnClient: true } }, profile: true },
    })

    if (!user) {
      console.warn(`[PPPSecretService] User ${userId} not found in database`)
      return false
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
      console.warn(`[PPPSecretService] No active router found for user ${user.username}`)
      return false
    }

    const host = targetRouter.ipAddress || targetRouter.nasname
    if (!host) {
      console.error(`[PPPSecretService] Router ${targetRouter.name} has no IP address or NAS name`)
      return false
    }

    // Resolve port: strictly prioritize what admin set in router.port, then vpnTargetPort, then 8728
    const vpnTargetPort = (targetRouter.vpnClient?.publicPorts as any)?.services?.api?.target
    const apiPort = targetRouter.port || vpnTargetPort || 8728
    const useTls = false // Forced non-SSL per user request

    console.log(`[PPPSecretService] Syncing secret for '${user.username}' -> Router '${targetRouter.name}' (${host}:${apiPort}, user: ${targetRouter.username})`)

    const conn = new MikroTikConnection({
      host,
      username: targetRouter.username,
      password: targetRouter.password,
      port: apiPort,
      tls: useTls,
      timeout: 8000,
    })

    try {
      await conn.connect()
      
      const profileName = user.profile?.mikrotikProfileName || user.profile?.name || 'default'
      const statusUpper = String(user.status || '').toUpperCase()
      const isSecretEnabled = ['ACTIVE', 'PENDING_INSTALLATION'].includes(statusUpper)

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
            console.log(`[PPPSecretService] Successfully auto-created profile '${profileName}' on MikroTik`)
          } catch (createErr) {
            console.warn(`[PPPSecretService] Failed to auto-create profile '${profileName}', falling back to 'default':`, createErr)
            targetProfile = 'default'
          }
        }
      } catch (checkErr) {
        console.warn(`[PPPSecretService] Profile check skipped/failed:`, checkErr)
      }

      // Check if secret exists
      const existing = await conn.execute('/ppp/secret/print', [`?name=${user.username}`], 4000)
      
      const secretParams = [
        `=password=${user.password}`,
        `=profile=${targetProfile}`,
        `=service=pppoe`,
        `=comment=${user.name || ''} - ${user.customerId || ''}`.trim(),
        `=disabled=${isSecretEnabled ? 'no' : 'yes'}`
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
        console.log(`[PPPSecretService] Updated existing secret for '${user.username}' on MikroTik`)
      } else {
        // Add new secret
        await conn.execute('/ppp/secret/add', [
          `=name=${user.username}`,
          ...secretParams,
        ], 4000)
        console.log(`[PPPSecretService] Added new secret for '${user.username}' on MikroTik`)
      }
      
      await conn.disconnect()
      return true
    } catch (error) {
      console.error(`[PPPSecretService] Failed to sync secret for ${user?.username} on ${host}:${apiPort}:`, error)
      try { await conn.disconnect() } catch { /* ignore */ }
      return false
    }
  }

  /**
   * Modifies a user's PPP secret profile (e.g. to isolate) and kicks their active connection.
   */
  static async setProfileAndDisconnect(routerId: string, username: string, profileName: string): Promise<boolean> {
    console.log(`[PPPSecretService] setProfileAndDisconnect called: routerId=${routerId}, username=${username}, profile=${profileName}`);
    
    const router = await prisma.router.findUnique({
      where: { id: routerId },
      include: { vpnClient: true },
    })
    if (!router) {
      console.error(`[PPPSecretService] Router not found for routerId: ${routerId}`);
      return false
    }
    
    const host = router.ipAddress || router.nasname
    if (!host) {
      console.error(`[PPPSecretService] Router ${router.name} has no IP address or NAS name`)
      return false
    }

    // Resolve port: strictly prioritize what admin set in router.port, then vpnTargetPort, then 8728
    const vpnTargetPort = (router.vpnClient?.publicPorts as any)?.services?.api?.target
    const apiPort = router.port || vpnTargetPort || 8728
    const useTls = false // Forced non-SSL per user request 
    console.log(`[PPPSecretService] Connecting to router: ${host}:${apiPort} (tls=${useTls}), user=${router.username}`)

    const conn = new MikroTikConnection({
      host,
      username: router.username,
      password: router.password,
      port: apiPort,
      tls: useTls,
      timeout: 8000,
    })

    try {
      await conn.connect()
      console.log(`[PPPSecretService] Connected to MikroTik ${host}:${apiPort}`)
      
      const existing = await conn.execute('/ppp/secret/print', [`?name=${username}`])
      console.log(`[PPPSecretService] PPP secret search result for ${username}:`, existing.length, 'entries')
      
      if (existing.length > 0) {
        await conn.execute('/ppp/secret/set', [
          `=.id=${existing[0]['.id']}`,
          `=profile=${profileName}`
        ])
        console.log(`[PPPSecretService] Profile changed to '${profileName}' for ${username}`)
      } else {
        console.warn(`[PPPSecretService] PPP secret NOT FOUND for username '${username}' on router ${host}`)
      }
      
      // Kick active connection to force reconnect with new profile
      const active = await conn.execute('/ppp/active/print', [`?name=${username}`])
      console.log(`[PPPSecretService] Active sessions for ${username}:`, active.length)
      
      if (active.length > 0) {
        await conn.execute('/ppp/active/remove', [`=.id=${active[0]['.id']}`])
        console.log(`[PPPSecretService] Kicked active session for ${username}`)
      } else {
        console.log(`[PPPSecretService] No active session to kick for ${username} (user is offline)`)
      }
      
      await conn.disconnect()
      console.log(`[PPPSecretService] Done for ${username}`)
      return true
    } catch (error) {
      console.error(`[PPPSecretService] Failed to isolate/disconnect secret for ${username}:`, error)
      try { await conn.disconnect() } catch { /* ignore */ }
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

    const host = router.ipAddress || router.nasname
    if (!host) return false

    // Resolve port: strictly prioritize what admin set in router.port, then vpnTargetPort, then 8728
    const vpnTargetPort = (router.vpnClient?.publicPorts as any)?.services?.api?.target
    const apiPort = router.port || vpnTargetPort || 8728
    const useTls = false // Forced non-SSL per user request

    const conn = new MikroTikConnection({
      host,
      username: router.username,
      password: router.password,
      port: apiPort,
      tls: useTls,
      timeout: 8000,
    })

    try {
      await conn.connect()
      const existing = await conn.execute('/ppp/secret/print', [`?name=${username}`])
      if (existing.length > 0) {
        await conn.execute('/ppp/secret/remove', [`=.id=${existing[0]['.id']}`])
      }
      // Also remove active connection
      const active = await conn.execute('/ppp/active/print', [`?name=${username}`])
      if (active.length > 0) {
        await conn.execute('/ppp/active/remove', [`=.id=${active[0]['.id']}`])
      }
      
      await conn.disconnect()
      return true
    } catch (error) {
      console.error(`Failed to remove secret for ${username}:`, error)
      try { await conn.disconnect() } catch { /* ignore */ }
      return false
    }
  }
}
