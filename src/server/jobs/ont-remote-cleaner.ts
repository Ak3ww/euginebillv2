import { prisma } from '@/server/db/client'
import { exec as execCb } from 'child_process'
import { promisify } from 'util'

const exec = promisify(execCb)

/**
 * Background job to auto-clean expired ONT remote proxy sessions.
 * Runs periodically (e.g. every 1 minute) via EugineBill cron runner.
 */
export async function cleanExpiredOntSessions() {
  try {
    const now = new Date()

    // Find all expired sessions that are still marked ACTIVE
    const expiredSessions = await prisma.ontRemoteSession.findMany({
      where: {
        status: 'ACTIVE',
        expiresAt: { lte: now },
      },
    })

    if (expiredSessions.length === 0) {
      return
    }

    console.log(`[ont-remote-cleaner] Cleaning ${expiredSessions.length} expired session(s)...`)

    for (const session of expiredSessions) {
      // Clean up Linux iptables forwarder rules if running on Linux
      if (process.platform === 'linux' && session.proxyPort) {
        try {
          await exec(
            `iptables -t nat -D PREROUTING -p tcp --dport ${session.proxyPort} -j DNAT --to-destination ${session.targetIp}:${session.targetPort}`
          )
          await exec(
            `iptables -D FORWARD -p tcp -d ${session.targetIp} --dport ${session.targetPort} -j ACCEPT`
          )
        } catch {
          /* ignore cleanup errors */
        }
      }
    }

    // Mark sessions as EXPIRED in DB
    const expiredIds = expiredSessions.map((s: { id: string }) => s.id)
    await prisma.ontRemoteSession.updateMany({
      where: { id: { in: expiredIds } },
      data: { status: 'EXPIRED' },
    })

    console.log(`[ont-remote-cleaner] Successfully cleaned ${expiredSessions.length} session(s).`)
  } catch (error) {
    console.error('[ont-remote-cleaner] Error cleaning expired ONT sessions:', error)
  }
}
