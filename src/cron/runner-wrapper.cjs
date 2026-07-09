/**
 * runner-wrapper.cjs — CJS entry point for EugineBill-cron PM2 process.
 *
 * Execution order:
 *  1. preload.cjs  — patches require.cache so 'server-only' is a no-op
 *  2. tsx/cjs      — registers TypeScript transform for subsequent require()
 *  3. runner.ts    — starts the cron scheduler (reads DB schedules, sets up jobs)
 *
 * PM2 command:
 *   pm2 start src/cron/runner-wrapper.cjs --name EugineBill-cron --cwd /var/www/EugineBill-frontend
 */
'use strict';

require('./preload.cjs');   // step 1: mock server-only
require('tsx/cjs');         // step 2: enable TypeScript via tsx
require('./runner.ts');     // step 3: start cron runner
