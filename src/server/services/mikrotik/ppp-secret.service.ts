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
      include: { router: true, profile: true },
    })

    if (!user || !user.router) return false

    const conn = new MikroTikConnection({
      host: user.router.ipAddress,
      username: user.router.username,
      password: user.router.password,
      port: user.router.apiPort,
    })

    try {
      await conn.connect()
      
      const profileName = user.profile.mikrotikProfileName || user.profile.name

      // Check if secret exists
      const existing = await conn.execute('/ppp/secret/print', [`?name=${user.username}`])
      
      if (existing.length > 0) {
        // Update existing secret
        await conn.execute('/ppp/secret/set', [
          `=.id=${existing[0]['.id']}`,
          `=password=${user.password}`,
          `=profile=${profileName}`,
          `=service=pppoe`,
          `=comment=${user.name} - ${user.customerId || ''}`,
          `=disabled=${user.status === 'active' ? 'no' : 'yes'}`
        ])
      } else {
        // Add new secret
        await conn.execute('/ppp/secret/add', [
          `=name=${user.username}`,
          `=password=${user.password}`,
          `=profile=${profileName}`,
          `=service=pppoe`,
          `=comment=${user.name} - ${user.customerId || ''}`,
          `=disabled=${user.status === 'active' ? 'no' : 'yes'}`
        ])
      }
      
      await conn.disconnect()
      return true
    } catch (error) {
      console.error(`Failed to sync secret for ${user?.username}:`, error)
      try { await conn.disconnect() } catch { /* ignore */ }
      return false
    }
  }

  /**
   * Modifies a user's PPP secret profile (e.g. to isolate) and kicks their active connection.
   */
  static async setProfileAndDisconnect(routerId: string, username: string, profileName: string): Promise<boolean> {
    const router = await prisma.router.findUnique({ where: { id: routerId } })
    if (!router) return false

    const conn = new MikroTikConnection({
      host: router.ipAddress,
      username: router.username,
      password: router.password,
      port: router.apiPort,
    })

    try {
      await conn.connect()
      const existing = await conn.execute('/ppp/secret/print', [`?name=${username}`])
      if (existing.length > 0) {
        await conn.execute('/ppp/secret/set', [
          `=.id=${existing[0]['.id']}`,
          `=profile=${profileName}`
        ])
      }
      // Kick active connection to force reconnect with new profile
      const active = await conn.execute('/ppp/active/print', [`?name=${username}`])
      if (active.length > 0) {
        await conn.execute('/ppp/active/remove', [`=.id=${active[0]['.id']}`])
      }
      
      await conn.disconnect()
      return true
    } catch (error) {
      console.error(`Failed to isolate/disconnect secret for ${username}:`, error)
      try { await conn.disconnect() } catch { /* ignore */ }
      return false
    }
  }

  /**
   * Removes a user from the MikroTik router's /ppp secret.
   */
  static async removeSecret(routerId: string, username: string): Promise<boolean> {
    const router = await prisma.router.findUnique({ where: { id: routerId } })
    if (!router) return false

    const conn = new MikroTikConnection({
      host: router.ipAddress,
      username: router.username,
      password: router.password,
      port: router.apiPort,
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
