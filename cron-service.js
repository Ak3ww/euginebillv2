#!/usr/bin/env node

/**
 * Standalone Cron Service for EugineBill RADIUS
 *
 * DEPRECATED: Penggunaan HTTP polling ke /api/cron.
 * Sebaiknya gunakan runner langsung: npx tsx src/cron/runner.ts
 * (sudah dikonfigurasi di production/ecosystem.config.js)
 *
 * File ini dipertahankan sebagai FALLBACK jika tsx tidak tersedia di VPS.
 * Untuk migrasi ke runner baru, jalankan:
 *   pm2 delete EugineBill-cron
 *   pm2 start production/ecosystem.config.js --only EugineBill-cron
 *   pm2 save
 */

const cron = require('node-cron');
const { execSync } = require('child_process');

// Use node-fetch for Node.js versions without built-in fetch
let fetch;
try {
  fetch = globalThis.fetch;
} catch (e) {
  fetch = require('node-fetch');
}

const API_URL = process.env.API_URL || 'http://localhost:3000';

console.log('[CRON SERVICE] Starting cron service...');
console.log('[CRON SERVICE] API URL:', API_URL);
console.log('[CRON SERVICE] Node version:', process.version);

/**
 * Execute cron job via API endpoint.
 * @param {string} jobType
 * @param {string} description
 * @param {{ lockTtl?: number }} [options] - lockTtl: detik lock (0 = no lock)
 */
async function runCronJob(jobType, description, options = {}) {
  const maxRetries = 3;
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[CRON] Running ${description} (attempt ${attempt}/${maxRetries})...`);

      const controller = new AbortController();
      // 5 minute timeout for long-running jobs like backup + telegram upload
      const timeoutMs = ['telegram_backup', 'telegram_health'].includes(jobType) ? 300000 : 30000;
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(`${API_URL}/api/cron`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'EugineBill-CRON-SERVICE',
          ...(process.env.CRON_SECRET ? { 'x-cron-secret': process.env.CRON_SECRET } : {}),
        },
        body: JSON.stringify({ type: jobType }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`[CRON] ${description} completed:`, result.success ? '✓' : '✗', result.message || '');
      return result;
    } catch (error) {
      lastError = error;
      console.error(`[CRON] ${description} failed (attempt ${attempt}):`, error.message);

      if (attempt < maxRetries) {
        const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        console.log(`[CRON] Retrying in ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  console.error(`[CRON] ${description} failed after ${maxRetries} attempts`);
  return { success: false, error: lastError?.message || 'Unknown error' };
}

// ==================== CRON SCHEDULES ====================

async function start() {
  console.log('[CRON SERVICE] Loading schedule configs from database...');
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();

  let overrideMap = {};
  try {
    const overrides = await prisma.cronScheduleConfig.findMany();
    overrides.forEach(o => {
      overrideMap[o.jobType] = { schedule: o.schedule, enabled: o.enabled };
    });
    console.log(`[CRON SERVICE] Successfully loaded ${overrides.length} schedule configurations from DB.`);
  } catch (err) {
    console.warn('[CRON SERVICE] Could not load schedules from DB (using defaults):', err.message);
  } finally {
    await prisma.$disconnect();
  }

  // Helper to get configuration for a job (merged with DB overrides)
  const getJobConfig = (jobType, defaultSchedule, defaultEnabled = true) => {
    const override = overrideMap[jobType];
    return {
      schedule: override ? override.schedule : defaultSchedule,
      enabled: override ? override.enabled : defaultEnabled
    };
  };

  // Helper to schedule a job
  const scheduleJob = (jobType, defaultSchedule, description, handlerOpts = {}, defaultEnabled = true) => {
    const conf = getJobConfig(jobType, defaultSchedule, defaultEnabled);
    if (!conf.enabled) {
      console.log(`  - [DISABLED] ${description} (${jobType})`);
      return;
    }
    if (conf.schedule === 'dynamic') {
      console.log(`  - [DYNAMIC]  ${description} (${jobType}) - Managed externally`);
      return;
    }
    cron.schedule(conf.schedule, async () => {
      await runCronJob(jobType, description, handlerOpts);
    });
    console.log(`  - [ACTIVE]   ${description} (${jobType}) → ${conf.schedule}`);
  };

  // 1. Startup: run FreeRADIUS health check immediately
  const radiusHealthConf = getJobConfig('freeradius_health', '*/5 * * * *');
  if (radiusHealthConf.enabled) {
    setTimeout(async () => {
      console.log('[CRON SERVICE] Startup: running freeradius_health to seed isolir radgroupreply...');
      await runCronJob('freeradius_health', 'FreeRADIUS Health Check (startup)');
    }, 10000); // 10s delay so Next.js app is fully up before we call the API
  }

  // 2. Startup: run PPPoE Auto Isolir immediately
  const pppoeIsolirConf = getJobConfig('pppoe_auto_isolir', '0 * * * *');
  if (pppoeIsolirConf.enabled) {
    setTimeout(async () => {
      console.log('[CRON SERVICE] Startup: running pppoe_auto_isolir to catch missed expirations...');
      await runCronJob('pppoe_auto_isolir', 'PPPoE Auto Isolir (startup)', { lockTtl: 300 });
    }, 20000); // 20s delay
  }

  // 3. Startup: run Session Recovery immediately
  const sessionRecoveryConf = getJobConfig('session_recovery', 'dynamic'); // Startup fallback only
  if (sessionRecoveryConf.enabled) {
    setTimeout(async () => {
      console.log('[CRON SERVICE] Startup: running session_recovery to restore sessions closed during update...');
      await runCronJob('session_recovery', 'Session Recovery (startup)');
    }, 35000); // 35s delay
  }

  console.log('[CRON SERVICE] Initializing scheduled jobs:');

  // Job registrations
  scheduleJob('hotspot_sync', '* * * * *', 'Hotspot Voucher Sync');
  scheduleJob('pppoe_auto_isolir', '0 * * * *', 'PPPoE Auto Isolir', { lockTtl: 300 });
  scheduleJob('agent_sales', '*/5 * * * *', 'Agent Sales Recording');
  scheduleJob('invoice_generate', '0 7 * * *', 'Invoice Generation', { lockTtl: 600 });
  scheduleJob('invoice_reminder', '0 * * * *', 'Invoice Reminder');
  scheduleJob('invoice_status_update', '0 * * * *', 'Invoice Status Update');
  scheduleJob('notification_check', '0 */6 * * *', 'Notification Check');
  scheduleJob('session_monitor', '*/15 * * * *', 'Session Security Monitoring');
  scheduleJob('disconnect_sessions', '*/5 * * * *', 'Disconnect Expired Sessions');
  scheduleJob('activity_log_cleanup', '0 2 * * *', 'Activity Log Cleanup', { lockTtl: 300 });
  scheduleJob('auto_renewal', '0 8 * * *', 'Auto Renewal', { lockTtl: 600 });
  scheduleJob('webhook_log_cleanup', '0 3 * * *', 'Webhook Log Cleanup', { lockTtl: 300 });
  scheduleJob('freeradius_health', '*/5 * * * *', 'FreeRADIUS Health Check');
  scheduleJob('pppoe_session_sync', '*/5 * * * *', 'PPPoE Session Sync', { lockTtl: 120 });
  scheduleJob('suspend_check', '0 * * * *', 'Suspend Check');
  scheduleJob('cron_history_cleanup', '0 4 * * *', 'Cron History Cleanup', { lockTtl: 120 });
  scheduleJob('mikrotik_session_sync', '*/5 * * * *', 'MikroTik Session Sync', { lockTtl: 120 });
  scheduleJob('mikrotik_session_cleanup', '0 3 * * *', 'MikroTik Session Cleanup', { lockTtl: 120 });

  // Telegram crons integration (dynamic settings)
  setTimeout(async () => {
    try {
      const backupConf = getJobConfig('telegram_backup', 'dynamic');
      const healthConf = getJobConfig('telegram_health', 'dynamic');
      
      if (backupConf.enabled) {
        console.log('  - [ACTIVE]   Telegram Backup (telegram_backup) -> Managed dynamically');
      }
      if (healthConf.enabled) {
        console.log('  - [ACTIVE]   Telegram Health Check (telegram_health) -> Managed dynamically');
      }
    } catch (err) {
      console.warn('[CRON SERVICE] Telegram settings loading skipped:', err.message);
    }
  }, 40000);

  console.log('[CRON SERVICE] All cron jobs initialized successfully!');
}

start().catch(err => {
  console.error('[CRON SERVICE] Fatal initialization error:', err);
  process.exit(1);
});

// Keep the process running
process.on('SIGINT', () => {
  console.log('[CRON SERVICE] Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('[CRON SERVICE] Received SIGTERM, shutting down...');
  process.exit(0);
});
