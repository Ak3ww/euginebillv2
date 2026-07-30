import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/server/auth/config'
import { unauthorized, ok, internalError } from '@/lib/api-response'
import { abortJob } from '@/server/jobs/voucher-sync'

/**
 * POST /api/cron/kill
 * Emergency Kill Switch to immediately abort running cron jobs (e.g. bulk WA invoice reminders)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || (session.user.role !== 'SUPER_ADMIN' && session.user.role !== 'ADMIN')) {
      return unauthorized()
    }

    const body = await request.json().catch(() => ({}))
    const jobType = body.type || 'invoice_reminder'

    const result = await abortJob(jobType)

    return ok({
      success: true,
      message: `Berhasil mengaktifkan Kill Switch. ${result.count} job cron (${jobType}) dihentikan paksa.`,
      killedCount: result.count
    })
  } catch (error: any) {
    console.error('[CRON KILL API] Error:', error)
    return internalError(error.message || 'Gagal menghentikan cron job')
  }
}
