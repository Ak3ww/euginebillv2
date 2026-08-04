/**
 * Standalone Cron Runner — src/cron/runner.ts
 *
 * Menjalankan semua cron jobs langsung dari src/server/jobs/ tanpa HTTP.
 * Dijalankan via: tsx src/cron/runner.ts
 * PM2: pm2 start "tsx src/cron/runner.ts" --name EugineBill-cron
 *
 * Keuntungan vs cron-service.js (HTTP polling):
 *  - Tidak bergantung pada Next.js server berjalan
 *  - Tidak ada network overhead / retry loop
 *  - Jobs tetap jalan saat Next.js restart/update
 *  - Error lebih cepat terdeteksi (stack trace lengkap)
 */

import 'dotenv/config';
import cron from 'node-cron';
import { CRON_JOBS } from '@/server/jobs/jobs.config';

// Track running jobs to prevent overlap
const runningJobs = new Set<string>();

const LOCK_JOBS = new Set([
  'invoice_generate',
  'auto_renewal',
  'pppoe_auto_isolir',
  'pppoe_session_sync',
  'telegram_backup',
  'webhook_log_cleanup',
  'activity_log_cleanup',
  'cron_history_cleanup',
]);

async function runJob(type: string, description: string): Promise<void> {
  if (runningJobs.has(type)) {
    console.log(`[CRON] Skipping ${description} — already running`);
    return;
  }

  const job = CRON_JOBS.find(j => j.type === type);
  if (!job) {
    console.warn(`[CRON] Job type not found: ${type}`);
    return;
  }

  if (LOCK_JOBS.has(type)) runningJobs.add(type);
  const start = Date.now();
  const startedAt = new Date();
  let historyId: string | null = null;

  try {
    const { prisma } = await import('@/server/db/client');
    const history = await prisma.cronHistory.create({
      data: {
        id: crypto.randomUUID(),
        jobType: type,
        status: 'running',
        startedAt,
      },
    });
    historyId = history.id;
  } catch (dbErr: any) {
    console.warn(`[CRON] Failed to log start to DB for ${type}:`, dbErr?.message);
  }

  try {
    console.log(`[CRON] Starting: ${description}`);
    const result = await job.handler();
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    const completedAt = new Date();
    const duration = Math.round(Date.now() - start);
    console.log(`[CRON] Done: ${description} (${elapsed}s)`, result?.success !== false ? '✓' : '✗');

    if (historyId) {
      try {
        const { prisma } = await import('@/server/db/client');
        await prisma.cronHistory.update({
          where: { id: historyId },
          data: {
            status: result?.success !== false ? 'success' : 'error',
            completedAt,
            duration,
            result: result ? JSON.stringify(result) : 'Success',
            error: result?.error || null,
          },
        });
      } catch (dbErr: any) {
        console.warn(`[CRON] Failed to update history DB for ${type}:`, dbErr?.message);
      }
    }
  } catch (err: any) {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.error(`[CRON] Error: ${description} (${elapsed}s)`, err?.message ?? err);

    if (historyId) {
      try {
        const { prisma } = await import('@/server/db/client');
        await prisma.cronHistory.update({
          where: { id: historyId },
          data: {
            status: 'error',
            completedAt: new Date(),
            duration: Math.round(Date.now() - start),
            error: err?.message ?? String(err),
          },
        });
      } catch (dbErr: any) {
        console.warn(`[CRON] Failed to update error history DB for ${type}:`, dbErr?.message);
      }
    }
  } finally {
    runningJobs.delete(type);
  }
}

// ==================== STARTUP SEQUENCE ====================

// 1. FreeRADIUS health check — seed isolir radgroupreply sebelum job lain
setTimeout(() => runJob('freeradius_health', 'FreeRADIUS Health Check (startup)'), 5_000);

// 2. PPPoE auto isolir — catch expired users yang missed saat restart
setTimeout(() => runJob('pppoe_auto_isolir', 'PPPoE Auto Isolir (startup)'), 15_000);

// 3. Session recovery — reopen sessions yang salah ditutup saat update
setTimeout(async () => {
  try {
    // Langsung akses DB untuk session recovery tanpa bergantung pada job config
    const { prisma } = await import('@/server/db/client');
    const sixtyMinutesAgo = new Date(Date.now() - 60 * 60 * 1000);
    const result = await prisma.$executeRaw`
      UPDATE radacct
      SET acctstoptime = NULL, acctterminatecause = ''
      WHERE acctterminatecause = 'Lost-Carrier'
        AND acctstoptime >= ${sixtyMinutesAgo}
    `;
    console.log(`[CRON] Session recovery (startup): ${result} sessions restored`);
  } catch (err: any) {
    console.error('[CRON] Session recovery (startup) failed:', err?.message);
  }
}, 30_000);

// ==================== CRON SCHEDULES ====================

// Load schedule overrides from DB, then start all scheduled jobs
async function initSchedules() {
  const { prisma } = await import('@/server/db/client');

  // Load DB overrides (cron_schedule_config table)
  let overrideMap: Record<string, { schedule: string; enabled: boolean }> = {};
  try {
    const overrides = await prisma.cronScheduleConfig.findMany();
    overrideMap = Object.fromEntries(overrides.map(o => [o.jobType, { schedule: o.schedule, enabled: o.enabled }]));
    if (Object.keys(overrideMap).length > 0) {
      console.log(`[CRON RUNNER] Loaded ${Object.keys(overrideMap).length} schedule override(s) from DB`);
    }
  } catch (err: any) {
    console.warn('[CRON RUNNER] Could not load schedule overrides from DB (table may not exist yet):', err?.message);
  }

  // Apply overrides: use DB schedule if available, else default from jobs.config.ts
  const schedulableJobs = CRON_JOBS.filter(j => {
    const override = overrideMap[j.type];
    const enabled = override?.enabled ?? j.enabled;
    const schedule = override?.schedule ?? j.schedule;
    return enabled && schedule !== 'dynamic';
  });

  for (const job of schedulableJobs) {
    const override = overrideMap[job.type];
    const schedule = override?.schedule ?? job.schedule;
    const label = override ? `${schedule} (override)` : job.scheduleLabel;
    cron.schedule(schedule, () => runJob(job.type, job.name));
    console.log(`  ${label.padEnd(30)} → ${job.name}`);
  }

  // Telegram backup/health — schedule diambil dari DB settings saat startup
  setTimeout(async () => {
    try {
      const { startBackupCron, startHealthCron } = await import('@/server/jobs/telegram-cron');
      await startBackupCron();
      await startHealthCron();
      console.log('[CRON] Telegram backup & health crons initialized from DB settings');
    } catch (err: any) {
      console.warn('[CRON] Telegram cron init skipped:', err?.message);
    }
  }, 8_000);

  console.log(`[CRON RUNNER] ${schedulableJobs.length} scheduled jobs active. Waiting for schedules...`);
}

console.log('[CRON RUNNER] Starting...');
initSchedules().catch(err => {
  console.error('[CRON RUNNER] Fatal: failed to initialize schedules:', err);
  process.exit(1);
});

// Keep process alive
process.on('SIGTERM', () => {
  console.log('[CRON RUNNER] Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});
process.on('SIGINT', () => {
  console.log('[CRON RUNNER] Received SIGINT, shutting down...');
  process.exit(0);
});
