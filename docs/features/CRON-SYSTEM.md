# EugineBill RADIUS - Cron Job System Documentation

## Overview

EugineBill RADIUS menggunakan **node-cron** untuk automated background tasks. Sistem ini menjalankan **13 scheduled jobs** untuk maintenance dan operasional otomatis.

## Architecture

```
src/lib/cron/
├── config.ts               # Job definitions & schedules (13 jobs)
├── auto-isolation.ts       # Auto isolir PPPoE users
├── auto-renewal.ts         # Balance auto-renewal (daily 8 AM)
├── freeradius-health.ts    # FreeRADIUS health monitor (every 5 min)
├── helpers.ts              # Shared cron utilities
├── hotspot-sync.ts         # Hotspot voucher sync (every minute)
├── hotspot-voucher-cron.ts # Hotspot voucher batch operations
├── invoice-status-updater.ts # Invoice status sync
├── pppoe-session-sync.ts   # PPPoE session sync ⭐ NEW Mar 2026
├── pppoe-sync.ts           # PPPoE auto isolir (every hour)
├── telegram-cron.ts        # Telegram backup & health
└── voucher-sync.ts         # Voucher & session sync jobs

src/app/api/cron/
└── route.ts            # Manual trigger endpoint

prisma/schema.prisma
└── cronHistory         # Execution history table
```

## Job Definitions

### 1. Hotspot Sync (`hotspot_sync`) ⭐ UPDATED v2.7.4

**Schedule:** Every minute (`* * * * *`)

**Function:**
- ✅ Deteksi first login voucher dari tabel `radacct`
- ✅ Update status WAITING → USED saat first login
- ✅ Set `usedAt` dan `expiredAt` berdasarkan validity profile
- ✅ Deteksi voucher expired (USED → EXPIRED)
- ✅ **Reply-Message for Expired Vouchers** (v2.7.4):
  - Set password = "EXPIRED" di `radcheck` (prevent auth)
  - Add Reply-Message = "Kode Voucher Kadaluarsa" di `radreply`
  - Remove from `radusergroup` (remove bandwidth)

**Handler:** `src/lib/cron/hotspot-sync.ts → syncHotspotWithRadius()`

**Database Tables:**
- **Read:** `hotspot_vouchers`, `radacct`, `radusergroup`
- **Write:** `hotspot_vouchers`, `radcheck`, `radreply`, `radusergroup`
- **Log:** `cron_history`

**Result Example:** `"Synced 150 vouchers, expired 5 with Reply-Message"`

**MikroTik Log Output (When Expired):**
```
user WPCTVR login error: Kode Voucher Kadaluarsa
```

---

### 2. Voucher Sync (`voucher_sync`)

**Schedule:** Every 5 minutes (`*/5 * * * *`)

**Function:**
- Sync voucher status with FreeRADIUS radcheck/radacct tables
- Update firstLoginAt, expiresAt, status fields
- Mark WAITING → ACTIVE when first login detected
- Mark ACTIVE → EXPIRED when expiry time reached

**Handler:** `src/lib/cron/voucher-sync.ts → syncVouchersWithRadius()`

**Result Example:** `"Synced 150 vouchers"`

---

### 3. Disconnect Sessions (`disconnect_sessions`) ⭐ NEW

**Schedule:** Every 5 minutes (`*/5 * * * *`)

**Function:**
- Find expired vouchers with active RADIUS sessions
- Send CoA (Change of Authorization) Disconnect-Request to FreeRADIUS
- Force disconnect users with expired vouchers
- Prevent continued usage after expiration

**Handler:** `src/lib/cron/voucher-sync.ts → disconnectExpiredVoucherSessions()`

**Result Example:** `"Disconnected 5 expired sessions"`

**Technical Details:**
```typescript
// 1. Query expired vouchers with active sessions
const expiredWithSessions = await prisma.hotspotVoucher.findMany({
  where: {
    status: 'EXPIRED',
    expiresAt: { lt: now },
    radacct: { some: { acctstoptime: null } }
  }
})

// 2. Send CoA Disconnect-Request for each session
const coaResult = await disconnectExpiredSessions()

// 3. Record result in cron_history
```

---

### 4. Agent Sales (`agent_sales`)

**Schedule:** Daily at 1 AM (`0 1 * * *`)

**Function:**
- Calculate total sales for each agent
- Update agent statistics
- Reset daily/monthly counters

**Handler:** `src/lib/cron/agent.ts → updateAgentSales()`

---

### 5. Auto Isolir (`auto_isolir`)

**Schedule:** Every hour (`0 * * * *`)

**Function:**
- Find PPPoE users with overdue invoices
- Auto-suspend (isolir) customers beyond grace period
- Send notification via WhatsApp
- Update user status to SUSPENDED

**Handler:** `src/lib/cron/isolir.ts → autoIsolirOverdueUsers()`

**Result Example:** `"Suspended 12 overdue users"`

**Fixed Issues (v2.3.1):**
- ✅ Added missing imports: `nowWIB, formatWIB, startOfDayWIBtoUTC, endOfDayWIBtoUTC`
- ✅ Fixed "nowWIB is not defined" error

---

### 6. Invoice Generation (`invoice_generation`)

**Schedule:** Daily at 2 AM (`0 2 * * *`)

**Function:**
- Generate monthly invoices for active PPPoE users
- Calculate total amount based on profile price
- Set due date based on billing cycle
- Send invoice notification via WhatsApp

**Handler:** `src/lib/cron/invoice.ts → generateMonthlyInvoices()`

---

### 7. Payment Reminder (`payment_reminder`)

**Schedule:** Daily at 8 AM (`0 8 * * *`)

**Function:**
- Find unpaid invoices approaching due date
- Send payment reminder via WhatsApp
- Escalate reminders (first, second, final)

**Handler:** `src/lib/cron/invoice.ts → sendPaymentReminders()`

---

### 8. WhatsApp Queue (`whatsapp_queue`)

**Schedule:** Every 10 minutes (`*/10 * * * *`)

**Function:**
- Process pending WhatsApp messages in queue
- Rate limit: max 20 messages per batch
- Retry failed messages (max 3 attempts)
- Update queue status

**Handler:** `src/lib/cron/whatsapp.ts → processWhatsAppQueue()`

---

### 9. Expired Voucher Cleanup (`expired_voucher_cleanup`)

**Schedule:** Daily at 3 AM (`0 3 * * *`)

**Function:**
- Delete expired vouchers older than 90 days
- Keep vouchers with transaction history
- Clean up unused vouchers

**Handler:** `src/lib/cron/voucher-sync.ts → cleanupExpiredVouchers()`

**Result Example:** `"Deleted 234 expired vouchers"`

---

### 10. Activity Log Cleanup (`activity_log_cleanup`)

**Schedule:** Daily at 2 AM (`0 2 * * *`)

**Function:**
- Delete activity logs older than 30 days
- Maintain database performance
- Keep recent logs for audit trail

**Handler:** `src/lib/activity-log.ts → cleanOldActivities()`

**Result Example:** `"Cleaned 245 old activities (older than 30 days)"`

**Fixed Issues (v2.3.1):**
- ✅ Modified to create/update `cron_history` records
- ✅ Returns proper result message with count

---

### 11. Session Cleanup (`session_cleanup`)

**Schedule:** Daily at 4 AM (`0 4 * * *`)

**Function:**
- Archive old RADIUS session data (radacct)
- Delete sessions older than 6 months
- Optimize radacct table size

**Handler:** `src/lib/cron/session.ts → cleanupOldSessions()`

---

### 12. FreeRADIUS Health Check (`freeradius_health`) ⭐ NEW v2.9.1

**Schedule:** Every 5 minutes (`*/5 * * * *`)

**Function:**
- Monitor FreeRADIUS service status and health
- Check if service is running and responsive
- Monitor CPU and memory usage
- **Auto-restart if service is down or unresponsive**
- Send WhatsApp/Email alerts to admins on issues
- Log all health check results

**Handler:** `src/lib/cron/freeradius-health.ts → freeradiusHealthCheck()`

**Health Checks Performed:**
1. **Service Status:** Check if FreeRADIUS is active via systemctl
2. **Process Info:** Get PID, CPU, Memory usage
3. **Uptime:** Calculate accurate uptime from systemctl
4. **Responsiveness:** Test if FreeRADIUS responds to config check (`freeradius -C`)

**Auto-Recovery Actions:**
- If service is **down** → Automatically restart
- If service is **unresponsive** → Automatically restart
- If **restart succeeds** → Send warning alert to admins
- If **restart fails** → Send critical alert requiring manual intervention

**Alert Thresholds:**
- CPU usage > 80% → Warning alert
- Memory usage > 90% → Warning alert
- Service down → Auto-restart + Warning alert
- Restart failed → Critical alert

**Result Example:**
```json
{
  "success": true,
  "status": {
    "running": true,
    "pid": 248543,
    "uptime": "5h 32m",
    "cpu": 0.2,
    "memory": 2.1,
    "responsive": true
  },
  "action": null  // or "restarted", "restart_failed"
}
```

**Alert Format (WhatsApp/Email):**
```
🚨 FreeRADIUS Alert

Severity: WARNING

FreeRADIUS service was down and has been automatically restarted successfully.

Time: 04/01/2026 12:30:45
```

**Database Logging:**
All health checks are logged to `activity_logs` table with module `system`:
- `action: 'health_check'` - Regular check results
- `action: 'auto_restart'` - Successful auto-restart
- `action: 'auto_restart_failed'` - Failed restart attempt

---

## Execution History

### Database Schema

```prisma
model cronHistory {
  id          String   @id @default(cuid())
  jobType     String   // Job identifier
  status      String   // 'running', 'success', 'error'
  startedAt   DateTime
  completedAt DateTime?
  duration    Int?     // Milliseconds
  result      String?  @db.Text
  error       String?  @db.Text
  createdAt   DateTime @default(now())
  
  @@index([jobType, createdAt])
}
```

### Recording Pattern

All cron jobs follow this pattern:

```typescript
export async function myCronJob() {
  const startedAt = new Date()
  
  // 1. Create history record with 'running' status
  const history = await prisma.cronHistory.create({
    data: {
      id: nanoid(),
      jobType: 'my_job_type',
      status: 'running',
      startedAt,
    }
  })
  
  try {
    // 2. Execute job logic
    const result = await doSomething()
    
    // 3. Update history with success
    const completedAt = new Date()
    await prisma.cronHistory.update({
      where: { id: history.id },
      data: {
        status: 'success',
        completedAt,
        duration: completedAt.getTime() - startedAt.getTime(),
        result: `Processed ${result.count} items`,
      }
    })
    
    return { success: true, count: result.count }
    
  } catch (error: any) {
    // 4. Update history with error
    await prisma.cronHistory.update({
      where: { id: history.id },
      data: {
        status: 'error',
        completedAt: new Date(),
        error: error.message,
      }
    })
    
    return { success: false, error: error.message }
  }
}
```

## Manual Trigger

### Via Admin Panel

1. Navigate to **Settings → Cron**
2. Find the job you want to trigger
3. Click **"Trigger Now"** button
4. Wait for result notification
5. Check **Execution History** table for details

### Via API

```bash
# Trigger specific job
curl -X POST https://your-domain.com/api/cron \
  -H "Content-Type: application/json" \
  -d '{"jobType": "voucher_sync"}'

# Response:
{
  "success": true,
  "synced": 150
}
```

### Job Type IDs

| Job Type | ID for API |
|----------|------------|
| Hotspot Sync | `hotspot_sync` |
| Voucher Sync | `voucher_sync` |
| Disconnect Sessions | `disconnect_sessions` |
| Agent Sales | `agent_sales` |
| Auto Isolir | `auto_isolir` |
| Invoice Generation | `invoice_generation` |
| Payment Reminder | `payment_reminder` |
| WhatsApp Queue | `whatsapp_queue` |
| Expired Voucher | `expired_voucher_cleanup` |
| Activity Log | `activity_log_cleanup` |
| Session Cleanup | `session_cleanup` |
| **FreeRADIUS Health** | `freeradius_health` |

## Frontend UI

### Settings → Cron Page

**Features:**
- Job cards with schedule information
- Enable/disable toggle (coming soon)
- Manual trigger button
- Execution history table with:
  - Job type labels
  - Status badges (success/error/running)
  - Duration display
  - Result/error messages
  - Timestamp (WIB)

**Code Location:** `src/app/admin/settings/cron/page.tsx`

**Type Labels:**
```typescript
const typeLabels: Record<string, string> = {
  voucher_sync: 'Voucher Sync',
  disconnect_sessions: 'Disconnect Sessions',
  agent_sales: 'Agent Sales Update',
  auto_isolir: 'Auto Isolir',
  invoice_generation: 'Invoice Generation',
  payment_reminder: 'Payment Reminder',
  whatsapp_queue: 'WhatsApp Queue',
  expired_voucher_cleanup: 'Expired Voucher Cleanup',
  activity_log_cleanup: 'Activity Log Cleanup',
  session_cleanup: 'Session Cleanup',
}
```

## Troubleshooting

### Cron Jobs Not Running

**Check PM2 logs:**
```bash
pm2 logs EugineBill-radius | grep cron
```

**Check node-cron initialization:**
```bash
pm2 logs EugineBill-radius | grep "Starting cron"
```

**Verify cron config:**
```typescript
// src/lib/cron/config.ts
export const cronJobs: CronJobConfig[] = [
  {
    type: 'voucher_sync',
    enabled: true,  // ⚠️ Must be true
    schedule: '*/5 * * * *',
    handler: async () => { ... }
  }
]
```

### "nowWIB is not defined" Error

**Fixed in v2.3.1**

**Solution:** Ensure all cron files import timezone utilities:
```typescript
import { nowWIB, formatWIB, startOfDayWIBtoUTC, endOfDayWIBtoUTC } from '@/lib/timezone'
```

### Cron History Not Recording

**Check function pattern:**
```typescript
// ✅ CORRECT - Records history
export async function myCronJob() {
  const history = await prisma.cronHistory.create({ ... })
  // ... job logic ...
  await prisma.cronHistory.update({ ... })
}

// ❌ WRONG - No history recording
export async function myCronJob() {
  // ... job logic only ...
  return result
}
```

### CoA Disconnect Not Working

**Check FreeRADIUS CoA configuration:**
```bash
# Verify CoA port open
netstat -tulpn | grep 3799

# Check clients.conf
cat /etc/freeradius/3.0/clients.conf
# Must have: coa_server = 127.0.0.1:3799
```

**Check router NAS configuration:**
```sql
SELECT * FROM nas WHERE coa_port IS NOT NULL;
```

**Test CoA manually:**
```bash
echo "User-Name=vouchercode" | radclient -x 127.0.0.1:3799 disconnect testing123
```

## Multi-Timezone Support

### Indonesia Timezone Regions

Indonesia memiliki 3 timezone berbeda:

| Zona | Nama | UTC Offset | Wilayah | TZ Identifier |
|------|------|------------|---------|---------------|
| **WIB** | Waktu Indonesia Barat | UTC+7 | Sumatera, Jawa, Kalimantan Barat/Tengah | `Asia/Jakarta` |
| **WITA** | Waktu Indonesia Tengah | UTC+8 | Kalimantan Selatan/Timur, Sulawesi, Bali, NTB, NTT | `Asia/Makassar` |
| **WIT** | Waktu Indonesia Timur | UTC+9 | Maluku, Papua | `Asia/Jayapura` |

### Configuration Steps for Different Timezone

#### 1. Update Server System Timezone

```bash
# Untuk WIB (Jakarta, Sumatera, Jawa)
sudo timedatectl set-timezone Asia/Jakarta

# Untuk WITA (Makassar, Bali, Sulawesi)
sudo timedatectl set-timezone Asia/Makassar

# Untuk WIT (Papua, Maluku)
sudo timedatectl set-timezone Asia/Jayapura

# Verifikasi
timedatectl
```

#### 2. Update PM2 Environment

Edit `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'EugineBill-radius',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      // Pilih sesuai wilayah:
      TZ: 'Asia/Jakarta'   // WIB (UTC+7)
      // TZ: 'Asia/Makassar'  // WITA (UTC+8)
      // TZ: 'Asia/Jayapura'  // WIT (UTC+9)
    }
  }]
}
```

#### 3. Update Application Environment Variables

Edit `.env`:

```bash
# Timezone Configuration
TZ="Asia/Jakarta"                    # Sesuaikan: Jakarta/Makassar/Jayapura
NEXT_PUBLIC_TIMEZONE="Asia/Jakarta"  # Untuk display di frontend

# Date-fns timezone identifier
TIMEZONE_IDENTIFIER="Asia/Jakarta"   # Sesuaikan dengan wilayah
```

#### 4. Update Timezone Utility Constants

Edit `src/lib/timezone.ts`:

```typescript
import { toZonedTime, formatInTimeZone } from 'date-fns-tz'

// Pilih timezone sesuai wilayah:
export const LOCAL_TIMEZONE = 'Asia/Jakarta'   // WIB
// export const LOCAL_TIMEZONE = 'Asia/Makassar'  // WITA
// export const LOCAL_TIMEZONE = 'Asia/Jayapura'  // WIT

// Alias untuk backward compatibility
export const WIB_TIMEZONE = LOCAL_TIMEZONE

// Timezone-aware helper functions
export function nowLocal() {
  return toZonedTime(new Date(), LOCAL_TIMEZONE)
}

export function formatLocal(date: Date, format: string = 'yyyy-MM-dd HH:mm:ss') {
  return formatInTimeZone(date, LOCAL_TIMEZONE, format)
}
```

#### 5. Update API Routes (Contoh: Voucher)

Edit `src/app/api/hotspot/voucher/route.ts`:

```typescript
import { formatInTimeZone } from 'date-fns-tz'
import { LOCAL_TIMEZONE } from '@/lib/timezone'  // Akan otomatis menggunakan timezone yang di-set

const vouchersWithLocalTime = vouchers.map(v => ({
  ...v,
  // Convert UTC → Local Timezone (Jakarta/Makassar/Jayapura)
  createdAt: formatInTimeZone(v.createdAt, LOCAL_TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss.SSS"),
  updatedAt: formatInTimeZone(v.updatedAt, LOCAL_TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss.SSS"),
  // FreeRADIUS already stores in local timezone
  firstLoginAt: v.firstLoginAt ? v.firstLoginAt.toISOString().replace('Z', '') : null,
  expiresAt: v.expiresAt ? v.expiresAt.toISOString().replace('Z', '') : null,
}))
```

#### 6. Restart Services

```bash
# Restart PM2 dengan environment baru
pm2 restart ecosystem.config.js --update-env
pm2 save

# Restart FreeRADIUS
sudo systemctl restart freeradius

# Verify timezone
pm2 env 0 | grep TZ
date
```

### International Timezone Examples

Untuk deployment di luar Indonesia:

| Negara | Timezone | TZ Identifier |
|--------|----------|---------------|
| Singapura | SGT (UTC+8) | `Asia/Singapore` |
| Malaysia | MYT (UTC+8) | `Asia/Kuala_Lumpur` |
| Thailand | ICT (UTC+7) | `Asia/Bangkok` |
| Filipina | PHT (UTC+8) | `Asia/Manila` |
| Vietnam | ICT (UTC+7) | `Asia/Ho_Chi_Minh` |
| Australia (Sydney) | AEDT (UTC+11) | `Australia/Sydney` |
| India | IST (UTC+5:30) | `Asia/Kolkata` |

### Testing Timezone Configuration

```bash
# 1. Test system timezone
date
timedatectl

# 2. Test PM2 environment
pm2 env 0 | grep TZ

# 3. Test Node.js timezone
node -e "console.log(new Date().toString())"

# 4. Test database timezone
mysql -u EugineBill_user -pEugineBillradius123 EugineBill_radius -e "SELECT NOW(), UTC_TIMESTAMP();"

# 5. Test FreeRADIUS logs
tail -f /var/log/freeradius/radius.log
# Log timestamps should match server timezone
```

### Multi-Region Deployment

Jika Anda deploy di multiple region dengan timezone berbeda:

**Option 1: Separate Instances (Recommended)**
```bash
# VPS Jakarta (WIB)
TZ=Asia/Jakarta pm2 start ecosystem.config.js --name EugineBill-wib

# VPS Makassar (WITA)
TZ=Asia/Makassar pm2 start ecosystem.config.js --name EugineBill-wita

# VPS Papua (WIT)
TZ=Asia/Jayapura pm2 start ecosystem.config.js --name EugineBill-wit
```

**Option 2: Single Instance with Dynamic Timezone**
```typescript
// src/lib/timezone.ts
import { toZonedTime, formatInTimeZone } from 'date-fns-tz'

// Get timezone from environment or default to Jakarta
export const LOCAL_TIMEZONE = process.env.TZ || 
                              process.env.TIMEZONE_IDENTIFIER || 
                              'Asia/Jakarta'

console.log(`[TIMEZONE] Using ${LOCAL_TIMEZONE}`)
```

### Troubleshooting Timezone Issues

#### Issue 1: Times still showing wrong after timezone change

**Solution:**
```bash
# 1. Clear PM2 cache
pm2 delete all
pm2 kill

# 2. Update ecosystem.config.js with new TZ
# 3. Restart fresh
pm2 start ecosystem.config.js
pm2 save

# 4. Clear browser cache
# Press Ctrl+Shift+Delete, clear all cache
```

#### Issue 2: Cron jobs running at wrong time

**Cause:** Cron schedule uses server local time, but PM2 environment might be different.

**Solution:**
```bash
# Make sure server timezone matches PM2 TZ
sudo timedatectl set-timezone Asia/Jakarta  # Or your timezone
pm2 restart ecosystem.config.js --update-env

# Verify both match
date
pm2 env 0 | grep TZ
```

#### Issue 3: Database and display times don't match

**Cause:** Database stores UTC, but conversion to local timezone is incorrect.

**Solution:**
```typescript
// Always use formatInTimeZone for UTC → Local conversion
import { formatInTimeZone } from 'date-fns-tz'
import { LOCAL_TIMEZONE } from '@/lib/timezone'

// ✅ CORRECT
const localTime = formatInTimeZone(utcDate, LOCAL_TIMEZONE, 'yyyy-MM-dd HH:mm:ss')

// ❌ WRONG - Assumes WIB
const localTime = formatInTimeZone(utcDate, 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss')
```

### Configuration Checklist

When deploying to a new timezone:

- [ ] Set server system timezone (`timedatectl set-timezone`)
- [ ] Update `ecosystem.config.js` TZ environment variable
- [ ] Update `.env` TZ and NEXT_PUBLIC_TIMEZONE
- [ ] Update `src/lib/timezone.ts` LOCAL_TIMEZONE constant
- [ ] Restart PM2 with `--update-env` flag
- [ ] Restart FreeRADIUS service
- [ ] Test voucher generation time
- [ ] Test dashboard statistics date ranges
- [ ] Test cron job execution times
- [ ] Verify all displayed times match server local time
- [ ] Clear browser cache and re-login

## Best Practices

### 1. Always Record History

Every cron job must create and update `cronHistory` records for visibility and debugging.

### 2. Use Timezone Utilities

Always use timezone-aware functions:
```typescript
import { nowLocal, formatLocal, LOCAL_TIMEZONE } from '@/lib/timezone'

// ✅ CORRECT - Works for any timezone
const now = nowLocal()
const formatted = formatLocal(date, 'yyyy-MM-dd HH:mm:ss')

// ❌ WRONG - Hardcoded WIB
const now = nowWIB()  // Only works for Jakarta timezone
```

### 3. Handle Errors Gracefully

```typescript
try {
  const result = await riskyOperation()
  return { success: true, ...result }
} catch (error: any) {
  console.error('[CRON ERROR]', error)
  return { success: false, error: error.message }
}
```

### 4. Use Batching for Large Operations

```typescript
// Process in batches to prevent memory issues
const BATCH_SIZE = 1000
const total = await prisma.model.count()

for (let offset = 0; offset < total; offset += BATCH_SIZE) {
  const batch = await prisma.model.findMany({
    skip: offset,
    take: BATCH_SIZE
  })
  await processBatch(batch)
}
```

### 5. Add Result Messages

```typescript
// ✅ GOOD - Descriptive result
result: `Disconnected ${count} expired sessions`

// ❌ BAD - Generic result
result: 'Success'
```

## Future Enhancements

- [ ] Enable/disable toggle for each job in UI
- [ ] Email notifications for cron failures
- [ ] Custom schedule configuration via admin panel
- [ ] Job dependency management (run job B after job A)
- [ ] Parallel execution for independent jobs
- [ ] Retry mechanism for failed jobs
- [ ] Job execution statistics (average duration, success rate)

## Related Documentation

- [Timezone Architecture](../README.md#-timezone--date-handling)
- [Activity Log System](./ACTIVITY_LOG_IMPLEMENTATION.md)
- [FreeRADIUS Setup](./FREERADIUS-SETUP.md)
- [Deployment Guide](./DEPLOYMENT-GUIDE.md)

---

**Last Updated:** December 7, 2025  
**Version:** 2.3.1
