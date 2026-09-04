# 🛡️ Isolation System - Complete Workflow Analysis

**Date**: March 27, 2026  
**Version**: 2.11.6  
**Type**: Technical Documentation

---

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Components](#architecture-components)
3. [Database Schema](#database-schema)
4. [Isolation Workflow](#isolation-workflow)
5. [Technical Implementation](#technical-implementation)
6. [MikroTik Integration](#mikrotik-integration)
7. [Troubleshooting Guide](#troubleshooting-guide)

---

## 🎯 System Overview

### What is Isolation System?

Sistem isolasi adalah mekanisme untuk **mengontrol akses internet user yang expired** dengan cara:
- ✅ User **tetap bisa login** (autentikasi RADIUS berhasil)
- ✅ User mendapat **IP dari pool khusus** (isolir pool)
- ✅ User mendapat **bandwidth terbatas** (rate limit)
- ✅ User **di-redirect** ke halaman pembayaran
- ✅ User **tidak bisa browsing** internet (diblokir firewall)
- ✅ User **bisa akses DNS** dan **payment gateway** saja

**Perbedaan dengan SUSPENDED:**
- **SUSPENDED**: User **tidak bisa login** sama sekali (Auth-Type = Reject)
- **ISOLATED**: User **bisa login** tapi akses internet dibatasi

### Key Benefits

1. **User Experience**: User tetap online, bisa lihat halaman pembayaran
2. **Auto-Recovery**: Setelah bayar, langsung aktif kembali
3. **No Manual Intervention**: Semua otomatis via cron
4. **Flexible**: Per-router configuration untuk IP pool & rate limit

---

## 🏗️ Architecture Components

### 1. Database Layer

```
┌─────────────────────────────────────────────────────────┐
│                    MySQL Database                        │
├─────────────────────────────────────────────────────────┤
│ • pppoe_users          - User data & status             │
│ • company              - Global isolation settings       │
│ • radcheck             - RADIUS auth (password)          │
│ • radreply             - RADIUS reply (reject msg)       │
│ • radusergroup         - User group mapping              │
│ • radgroupreply        - Group attributes (pool, rate)   │
│ • radacct              - Active sessions                 │
│ • router (nas)         - NAS/Router config               │
└─────────────────────────────────────────────────────────┘
```

### 2. Application Layer

```
┌─────────────────────────────────────────────────────────┐
│                   Next.js Application                    │
├─────────────────────────────────────────────────────────┤
│ • Cron Service          - Background jobs                │
│ • CoA Service           - RADIUS CoA disconnect          │
│ • MikroTik API          - Direct router control          │
│ • Isolation API         - Settings management            │
│ • Auto-Renewal          - Balance-based renewal          │
└─────────────────────────────────────────────────────────┘
```

### 3. Network Layer

```
┌─────────────────────────────────────────────────────────┐
│                   MikroTik Router                        │
├─────────────────────────────────────────────────────────┤
│ • IP Pool (isolir)      - 192.168.200.0/24              │
│ • PPP Profile (isolir)  - Rate limit 64k/64k            │
│ • Firewall Filter       - Allow DNS + Payment only       │
│ • Firewall NAT          - Redirect HTTP to landing       │
│ • CoA Port 3799         - Accept disconnect requests     │
└─────────────────────────────────────────────────────────┘
```

### 4. RADIUS Layer

```
┌─────────────────────────────────────────────────────────┐
│                    FreeRADIUS Server                     │
├─────────────────────────────────────────────────────────┤
│ • radcheck              - Auth: SUSPENDED = Reject       │
│ • radreply              - Reply message for suspended    │
│ • radusergroup          - Assign group (isolir)          │
│ • radgroupreply         - Group attributes               │
│ • radacct               - Session tracking               │
└─────────────────────────────────────────────────────────┘
```

---

## 💾 Database Schema

### 1. Company Table (Global Settings)

```sql
CREATE TABLE companies (
  id VARCHAR(191) PRIMARY KEY,
  name VARCHAR(255),
  
  -- Isolation Settings
  isolationEnabled BOOLEAN DEFAULT TRUE,
  isolationIpPool VARCHAR(100) DEFAULT '192.168.200.0/24',
  isolationRateLimit VARCHAR(50) DEFAULT '64k/64k',
  isolationRedirectUrl TEXT,
  isolationMessage TEXT,
  isolationAllowDns BOOLEAN DEFAULT TRUE,
  isolationAllowPayment BOOLEAN DEFAULT TRUE,
  isolationNotifyWhatsapp BOOLEAN DEFAULT TRUE,
  isolationNotifyEmail BOOLEAN DEFAULT FALSE,
  
  gracePeriodDays INT DEFAULT 0,
  baseUrl VARCHAR(255) DEFAULT 'http://localhost:3000'
);
```

### 2. PPPoE Users Table

```sql
CREATE TABLE pppoe_users (
  id VARCHAR(191) PRIMARY KEY,
  username VARCHAR(255) UNIQUE,
  password VARCHAR(255),
  status VARCHAR(50) DEFAULT 'ACTIVE',  -- ACTIVE, SUSPENDED, BLOCKED
  expiredAt DATETIME,                    -- NULL untuk POSTPAID
  
  profileId VARCHAR(191),
  routerId VARCHAR(191),
  autoIsolationEnabled BOOLEAN DEFAULT TRUE,
  subscriptionType ENUM('PREPAID', 'POSTPAID') DEFAULT 'POSTPAID',
  
  balance INT DEFAULT 0,                 -- Saldo deposit
  autoRenewal BOOLEAN DEFAULT FALSE      -- Auto renew from balance
);
```

### 3. RADIUS Tables

```sql
-- Authentication (password storage)
CREATE TABLE radcheck (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(64),
  attribute VARCHAR(64),              -- 'Cleartext-Password' atau 'Auth-Type'
  op CHAR(2) DEFAULT ':=',
  value VARCHAR(253),                 -- Password atau 'Reject'
  UNIQUE KEY (username, attribute)
);

-- Reply attributes (reject message untuk SUSPENDED)
CREATE TABLE radreply (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(64),
  attribute VARCHAR(64),              -- 'Reply-Message'
  op CHAR(2) DEFAULT ':=',
  value VARCHAR(253)                  -- 'Akun Ditangguhkan - Hubungi Admin'
);

-- User group mapping
CREATE TABLE radusergroup (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(64),
  groupname VARCHAR(64),              -- 'isolir', 'default', etc.
  priority INT DEFAULT 1,
  UNIQUE KEY (username, groupname)
);

-- Group reply attributes (pool, rate limit)
CREATE TABLE radgroupreply (
  id INT AUTO_INCREMENT PRIMARY KEY,
  groupname VARCHAR(64),              -- 'isolir'
  attribute VARCHAR(64),              -- 'Framed-IP-Address', 'Mikrotik-Rate-Limit'
  op CHAR(2) DEFAULT ':=',
  value VARCHAR(253)                  -- 'pool-isolir', '64k/64k'
);

-- Active sessions
CREATE TABLE radacct (
  radacctid BIGINT AUTO_INCREMENT PRIMARY KEY,
  acctsessionid VARCHAR(64),
  username VARCHAR(64),
  nasipaddress VARCHAR(15),
  framedipaddress VARCHAR(15),
  acctstarttime DATETIME,
  acctstoptime DATETIME,
  acctterminatecause VARCHAR(32)
);
```

---

## 🔄 Isolation Workflow

### Phase 1: Detection (Cron Job Hourly)

```
┌──────────────────────────────────────────────────────────┐
│  Cron: PPPoE Auto-Isolir (Runs Every Hour)              │
├──────────────────────────────────────────────────────────┤
│  Location: src/lib/cron/pppoe-sync.ts                   │
│  Function: autoIsolatePPPoEUsers()                       │
└──────────────────────────────────────────────────────────┘
                          │
                          ▼
         ┌────────────────────────────────┐
         │  Query Expired Users           │
         │  WHERE:                        │
         │  - status = 'ACTIVE'           │
         │  - expiredAt < CURDATE()       │
         │  - autoIsolationEnabled = true │
         └────────────────────────────────┘
                          │
                          ▼
                   ┌──────────┐
                   │ Found?   │
                   └──────────┘
                    │        │
               YES  │        │  NO
                    ▼        ▼
            ┌─────────┐  ┌──────────┐
            │ Process │  │ Skip     │
            │ Isolate │  │ (done)   │
            └─────────┘  └──────────┘
```

### Phase 2: Status Update (SUSPENDED vs ISOLATED)

**Important Note**: Sistem ini menggunakan status **SUSPENDED**, bukan ISOLATED!

```
┌──────────────────────────────────────────────────────────┐
│  Update User Status                                      │
├──────────────────────────────────────────────────────────┤
│  UPDATE pppoe_users                                      │
│  SET status = 'SUSPENDED'                                │
│  WHERE id = :userId                                      │
└──────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────┐
│  Update RADIUS Authentication                            │
├──────────────────────────────────────────────────────────┤
│  1. Keep password (untuk bisa login):                    │
│     INSERT INTO radcheck (username, attribute, value)    │
│     VALUES (:username, 'Cleartext-Password', :password)  │
│                                                           │
│  2. Force REJECT (tidak bisa login):                     │
│     INSERT INTO radcheck (username, attribute, value)    │
│     VALUES (:username, 'Auth-Type', 'Reject')            │
│                                                           │
│  3. Add reject message:                                  │
│     INSERT INTO radreply (username, attribute, value)    │
│     VALUES (:username, 'Reply-Message',                  │
│             'Akun Ditangguhkan - Hubungi Admin')         │
└──────────────────────────────────────────────────────────┘
```

**Current Implementation**:
- Status = **SUSPENDED** (bukan ISOLATED)
- Auth-Type = **Reject** (user **TIDAK BISA LOGIN**)
- Reply-Message = "Akun Ditangguhkan - Hubungi Admin"

**Issue Identified**: ⚠️
Sistem saat ini **SUSPEND** user (reject auth), bukan **ISOLATE** (allow login tapi batasi akses).

### Phase 3: RADIUS Group Assignment

```
┌──────────────────────────────────────────────────────────┐
│  Move to Isolir Group                                    │
├──────────────────────────────────────────────────────────┤
│  DELETE FROM radusergroup                                │
│  WHERE username = :username                              │
│                                                           │
│  INSERT INTO radusergroup                                │
│  VALUES (:username, 'isolir', 1)                         │
└──────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────┐
│  Remove Static IP (use pool instead)                     │
├──────────────────────────────────────────────────────────┤
│  DELETE FROM radreply                                    │
│  WHERE username = :username                              │
│    AND attribute = 'Framed-IP-Address'                   │
└──────────────────────────────────────────────────────────┘
```

**radgroupreply Configuration** (per-router di UI):
```sql
INSERT INTO radgroupreply (groupname, attribute, value)
VALUES 
  ('isolir', 'Framed-IP-Address', 'pool-isolir'),
  ('isolir', 'Mikrotik-Rate-Limit', '64k/64k');
```

### Phase 4: Disconnect Active Session

```
┌──────────────────────────────────────────────────────────┐
│  Method 1: MikroTik API (Primary)                        │
├──────────────────────────────────────────────────────────┤
│  1. Get NAS IP from radacct (active session)             │
│  2. Get router config from DB                            │
│  3. Connect to MikroTik API (port 8728/8729)             │
│  4. Find PPPoE active session by username                │
│  5. Execute /ppp/active/remove                           │
│  6. Close API connection                                 │
└──────────────────────────────────────────────────────────┘
                          │
                          ▼ (if API fails)
┌──────────────────────────────────────────────────────────┐
│  Method 2: CoA Disconnect (Fallback)                     │
├──────────────────────────────────────────────────────────┤
│  1. Get session data (sessionId, framedIp, MAC)          │
│  2. Build CoA packet attributes:                         │
│     - NAS-IP-Address                                     │
│     - Framed-IP-Address                                  │
│     - User-Name                                          │
│     - Acct-Session-Id                                    │
│  3. Send via radclient to NAS:3799                       │
│     radclient -t 2 -r 1 <NAS>:3799 disconnect <secret>   │
│  4. Wait for Disconnect-ACK                              │
└──────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────┐
│  Update radacct (Mark Session Stopped)                   │
├──────────────────────────────────────────────────────────┤
│  UPDATE radacct                                          │
│  SET acctstoptime = NOW(),                               │
│      acctterminatecause = 'Admin-Reset'                  │
│  WHERE username = :username                              │
│    AND acctstoptime IS NULL                              │
└──────────────────────────────────────────────────────────┘
```

### Phase 5: User Re-Authentication

```
┌──────────────────────────────────────────────────────────┐
│  User Tries to Login Again                               │
├──────────────────────────────────────────────────────────┤
│  1. MikroTik sends RADIUS Access-Request                 │
│  2. FreeRADIUS checks radcheck:                          │
│     - Auth-Type = 'Reject' ❌                            │
│  3. FreeRADIUS sends Access-Reject with message          │
│  4. User CANNOT login (current implementation)           │
└──────────────────────────────────────────────────────────┘
```

**Expected Behavior for TRUE Isolation**:
```
┌──────────────────────────────────────────────────────────┐
│  User Tries to Login (TRUE ISOLATION)                    │
├──────────────────────────────────────────────────────────┤
│  1. MikroTik sends RADIUS Access-Request                 │
│  2. FreeRADIUS checks radcheck:                          │
│     - Cleartext-Password = <password> ✅                 │
│     - NO Auth-Type Reject                                │
│  3. FreeRADIUS checks radusergroup:                      │
│     - groupname = 'isolir'                               │
│  4. FreeRADIUS sends Access-Accept with:                 │
│     - Framed-IP-Address = pool-isolir                    │
│     - Mikrotik-Rate-Limit = 64k/64k                      │
│  5. User gets IP from 192.168.200.0/24                   │
│  6. MikroTik firewall rules apply:                       │
│     - Allow DNS                                          │
│     - Allow payment server                               │
│     - Redirect HTTP to landing page                      │
│     - Block all other internet                           │
└──────────────────────────────────────────────────────────┘
```

---

## 🔧 Technical Implementation

### 1. Cron Job Configuration

**File**: `src/lib/cron/config.ts`

```typescript
{
  type: 'pppoe_auto_isolir',
  name: 'PPPoE Auto Isolir',
  description: 'Auto-isolate expired PPPoE users and move to isolir group',
  schedule: '0 * * * *', // Every hour
  enabled: true,
  async execute() {
    const { autoIsolatePPPoEUsers } = await import('./pppoe-sync');
    return autoIsolatePPPoEUsers();
  }
}
```

### 2. Main Isolation Function

**File**: `src/lib/cron/pppoe-sync.ts`

```typescript
export async function autoIsolatePPPoEUsers(): Promise<{ 
  success: boolean
  isolated: number
  error?: string 
}> {
  // 1. Find expired users
  const expiredUsers = await prisma.$queryRaw`
    SELECT id, username, password, status, expiredAt, profileId
    FROM pppoe_users
    WHERE status = 'ACTIVE'
      AND expiredAt < CURDATE()
  `;

  for (const user of expiredUsers) {
    // 2. Update status to SUSPENDED
    await prisma.pppoeUser.update({
      where: { id: user.id },
      data: { status: 'SUSPENDED' }
    });

    // 3. Keep password (for re-auth)
    await prisma.$executeRaw`
      INSERT INTO radcheck (username, attribute, op, value)
      VALUES (${user.username}, 'Cleartext-Password', ':=', ${user.password})
      ON DUPLICATE KEY UPDATE value = ${user.password}
    `;

    // 4. Force reject (CURRENT IMPLEMENTATION - NOT ISOLATION!)
    await prisma.$executeRaw`
      INSERT INTO radcheck (username, attribute, op, value)
      VALUES (${user.username}, 'Auth-Type', ':=', 'Reject')
      ON DUPLICATE KEY UPDATE value = 'Reject'
    `;

    // 5. Add reject message
    await prisma.$executeRaw`
      INSERT INTO radreply (username, attribute, op, value)
      VALUES (${user.username}, 'Reply-Message', ':=', 
              'Akun Ditangguhkan - Hubungi Admin')
      ON DUPLICATE KEY UPDATE 
        value = 'Akun Ditangguhkan - Hubungi Admin'
    `;

    // 6. Move to isolir group (kept for tracking)
    await prisma.$executeRaw`
      DELETE FROM radusergroup WHERE username = ${user.username}
    `;
    await prisma.$executeRaw`
      INSERT INTO radusergroup (username, groupname, priority)
      VALUES (${user.username}, 'isolir', 1)
    `;

    // 7. Remove static IP
    await prisma.$executeRaw`
      DELETE FROM radreply 
      WHERE username = ${user.username} 
        AND attribute = 'Framed-IP-Address'
    `;

    // 8. Disconnect via MikroTik API
    await disconnectViaMikrotikAPI(user.username);
    
    // 9. Fallback: CoA disconnect
    const { disconnectPPPoEUser } = await import('../services/coaService');
    await disconnectPPPoEUser(user.username);
    
    // 10. Close session in radacct
    await prisma.$executeRaw`
      UPDATE radacct 
      SET acctstoptime = NOW(), 
          acctterminatecause = 'Admin-Reset'
      WHERE username = ${user.username} 
        AND acctstoptime IS NULL
    `;
  }
}
```

### 3. MikroTik API Disconnect

**File**: `src/lib/cron/pppoe-sync.ts`

```typescript
async function disconnectViaMikrotikAPI(username: string) {
  // 1. Get active session
  const session = await prisma.radacct.findFirst({
    where: { username, acctstoptime: null },
    select: { nasipaddress: true }
  });

  // 2. Get router config
  const router = await prisma.router.findFirst({
    where: { 
      OR: [
        { nasname: session.nasipaddress },
        { ipAddress: session.nasipaddress }
      ]
    }
  });

  // 3. Connect to MikroTik
  const api = new RouterOSAPI({
    host: router.ipAddress,
    port: router.port || 8728,
    user: router.username,
    password: router.password,
    timeout: 15
  });

  await api.connect();

  // 4. Find active PPPoE session
  const activeSessions = await api.write(
    '/ppp/active/print', 
    [`?name=${username}`]
  );

  // 5. Remove session
  for (const s of activeSessions) {
    await api.write('/ppp/active/remove', [`=.id=${s['.id']}`]);
  }

  await api.close();
}
```

### 4. CoA Disconnect Service

**File**: `src/lib/services/coaService.ts`

```typescript
export async function sendCoADisconnect(
  username: string,
  nasIpAddress: string,
  nasSecret: string,
  sessionId?: string,
  framedIp?: string
) {
  // 1. Mark session in database FIRST (guaranteed)
  if (sessionId) {
    await markSessionStopped(sessionId, username, 'Admin-Reset');
  }

  // 2. Build CoA packet
  const coaAttributes = [
    `NAS-IP-Address=${nasIpAddress}`,
    `User-Name=${username}`
  ];
  
  if (framedIp) {
    coaAttributes.push(`Framed-IP-Address=${framedIp}`);
  }
  
  if (sessionId) {
    coaAttributes.push(`Acct-Session-Id=${sessionId}`);
  }

  // 3. Write to temp file
  const tmpFile = `/tmp/coa-${Date.now()}.txt`;
  await writeFile(tmpFile, coaAttributes.join('\n') + '\n');

  // 4. Send CoA via radclient
  const command = `radclient -t 2 -r 1 -x ${nasIpAddress}:3799 disconnect ${nasSecret} < ${tmpFile}`;
  const { stdout } = await execAsync(command, { timeout: 8000 });

  // 5. Check for ACK
  const success = stdout.includes('Disconnect-ACK') || 
                  stdout.includes('code 44');

  return { success, message: success ? 'ACK' : 'No ACK' };
}
```

---

## 🌐 MikroTik Integration

### Router Configuration (via UI)

**Location**: Network → Routers → Click Router → Shield Icon (Isolation Config)

Per-router settings:
- **IP Pool**: `pool-isolir` (e.g., 192.168.200.2-254)
- **PPP Profile**: `isolir` with rate limit
- **RADIUS Group**: `isolir`

### MikroTik Commands (Auto-Generated)

**1. IP Pool**
```routeros
/ip pool
add name=pool-isolir ranges=192.168.200.2-192.168.200.254 \\
    comment="IP Pool untuk user yang diisolir"
```

**2. PPP Profile**
```routeros
/ppp profile
add name=isolir \\
    local-address=pool-isolir \\
    remote-address=pool-isolir \\
    rate-limit=64k/64k \\
    comment="Profile untuk user yang diisolir"
```

**3. Firewall Filter** (Allow DNS & Payment Only)
```routeros
/ip firewall filter
# Allow DNS
add chain=forward \\
    src-address=192.168.200.0/24 \\
    protocol=udp dst-port=53 \\
    action=accept \\
    comment="Allow DNS for isolated users"

# Allow ICMP
add chain=forward \\
    src-address=192.168.200.0/24 \\
    protocol=icmp \\
    action=accept \\
    comment="Allow ping for isolated users"

# Allow access to payment server
add chain=forward \\
    src-address=192.168.200.0/24 \\
    dst-address=<SERVER_IP> \\
    action=accept \\
    comment="Allow access to payment server"

# Block all other internet
add chain=forward \\
    src-address=192.168.200.0/24 \\
    action=drop \\
    comment="Block internet for isolated users"
```

**4. Firewall NAT** (Redirect HTTP to Landing Page)
```routeros
/ip firewall nat
# Redirect HTTP to landing page
add chain=dstnat \\
    src-address=192.168.200.0/24 \\
    protocol=tcp dst-port=80 \\
    dst-address=!<SERVER_IP> \\
    action=dst-nat \\
    to-addresses=<SERVER_IP> \\
    to-ports=80 \\
    comment="Redirect HTTP to isolation landing page"

# Redirect HTTPS to landing page
add chain=dstnat \\
    src-address=192.168.200.0/24 \\
    protocol=tcp dst-port=443 \\
    dst-address=!<SERVER_IP> \\
    action=dst-nat \\
    to-addresses=<SERVER_IP> \\
    to-ports=443 \\
    comment="Redirect HTTPS to isolation landing page"
```

**5. CoA Configuration**
```routeros
/radius incoming
set accept=yes
```

### RADIUS Group Reply

```sql
-- Konfigurasi group isolir di RADIUS
INSERT INTO radgroupreply (groupname, attribute, op, value)
VALUES 
  ('isolir', 'Framed-IP-Address', ':=', 'pool-isolir'),
  ('isolir', 'Mikrotik-Rate-Limit', ':=', '64k/64k');
```

---

## 🔍 Current Implementation Issues

### ⚠️ Issue #1: SUSPEND vs ISOLATE

**Current Behavior**: System **SUSPENDS** user (Auth-Type = Reject)
**Expected Behavior**: System should **ISOLATE** user (allow login, limit access)

**Problem Code** (`src/lib/cron/pppoe-sync.ts:273-277`):
```typescript
// This BLOCKS login completely
await prisma.$executeRaw`
  INSERT INTO radcheck (username, attribute, op, value)
  VALUES (${user.username}, 'Auth-Type', ':=', 'Reject')
  ON DUPLICATE KEY UPDATE value = 'Reject'
`;
```

**Fix Required**:
```typescript
// Remove Auth-Type Reject completely
// User should be able to login with password
// Group 'isolir' will control IP pool and rate limit
// MikroTik firewall will control access

// DELETE this line:
// - Auth-Type = Reject

// KEEP only:
// - Cleartext-Password (allow login)
// - radusergroup = 'isolir' (apply group attributes)
// - radgroupreply for 'isolir' (pool + rate limit)
```

### ⚠️ Issue #2: Status Naming Confusion

**Current**: `status = 'SUSPENDED'` (implies cannot login)
**Better**: `status = 'ISOLATED'` (implies limited access)

**Recommendation**:
```sql
-- Add new status enum value
ALTER TABLE pppoe_users 
MODIFY COLUMN status ENUM('ACTIVE', 'ISOLATED', 'SUSPENDED', 'BLOCKED');

-- Update cron to use ISOLATED
UPDATE pppoe_users SET status = 'ISOLATED' WHERE ...
```

### ⚠️ Issue #3: Grace Period Not Implemented

**Setting exists**: `company.gracePeriodDays`
**Not used in**: Cron job query

**Fix Required**:
```typescript
// Current query
WHERE expiredAt < CURDATE()

// Should be
WHERE expiredAt < DATE_SUB(CURDATE(), INTERVAL ${gracePeriodDays} DAY)
```

---

## 📊 Complete Workflow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ISOLATION SYSTEM WORKFLOW                     │
└─────────────────────────────────────────────────────────────────────┘

START: Cron Job (Every Hour)
  │
  ├─► Query Expired Users
  │   WHERE status = 'ACTIVE' AND expiredAt < CURDATE()
  │
  ├─► For Each Expired User:
  │   │
  │   ├─► 1. UPDATE pppoe_users SET status = 'SUSPENDED' ❌
  │   │   (Should be 'ISOLATED')
  │   │
  │   ├─► 2. radcheck Table:
  │   │   ├─► INSERT Cleartext-Password (keep for re-auth) ✅
  │   │   └─► INSERT Auth-Type = 'Reject' ❌ (BLOCKS LOGIN!)
  │   │       (Should REMOVE this - let user login)
  │   │
  │   ├─► 3. radreply Table:
  │   │   └─► INSERT Reply-Message = 'Akun Ditangguhkan' ❌
  │   │       (Only needed if Auth-Type = Reject)
  │   │
  │   ├─► 4. radusergroup Table:
  │   │   └─► INSERT groupname = 'isolir' ✅
  │   │
  │   ├─► 5. Remove Static IP:
  │   │   └─► DELETE Framed-IP-Address from radreply ✅
  │   │       (User will get IP from pool-isolir via group)
  │   │
  │   ├─► 6. Disconnect Session:
  │   │   ├─► Try MikroTik API: /ppp/active/remove ✅
  │   │   └─► Fallback CoA: radclient disconnect ✅
  │   │
  │   └─► 7. Close radacct:
  │       └─► UPDATE acctstoptime = NOW() ✅
  │
  └─► END

User Re-Authentication Flow (CURRENT - BROKEN):
  │
  ├─► User enters username/password
  │
  ├─► MikroTik → RADIUS Access-Request
  │
  ├─► FreeRADIUS checks radcheck:
  │   ├─► Auth-Type = 'Reject' ❌
  │   └─► Send Access-Reject
  │
  └─► User CANNOT login ❌ (not isolation, full block!)

User Re-Authentication Flow (EXPECTED - ISOLATION):
  │
  ├─► User enters username/password
  │
  ├─► MikroTik → RADIUS Access-Request
  │
  ├─► FreeRADIUS checks radcheck:
  │   ├─► Cleartext-Password matches ✅
  │   └─► NO Auth-Type Reject
  │
  ├─► FreeRADIUS checks radusergroup:
  │   └─► groupname = 'isolir'
  │
  ├─► FreeRADIUS checks radgroupreply:
  │   ├─► Framed-IP-Address = 'pool-isolir'
  │   └─► Mikrotik-Rate-Limit = '64k/64k'
  │
  ├─► Send Access-Accept with attributes ✅
  │
  ├─► MikroTik assigns:
  │   ├─► IP from 192.168.200.0/24
  │   └─► Rate limit 64k/64k
  │
  ├─► User tries to browse:
  │   ├─► DNS queries: ALLOWED ✅
  │   ├─► Payment server: ALLOWED ✅
  │   ├─► HTTP redirect: TO LANDING PAGE ✅
  │   └─► Other sites: BLOCKED ✅
  │
  └─► User sees payment page, can pay to restore ✅

Payment & Restore Flow:
  │
  ├─► User pays via isolated landing page
  │
  ├─► Payment webhook updates invoice
  │
  ├─► Auto-renewal cron detects paid invoice:
  │   ├─► Extend expiredAt (+30 days)
  │   ├─► UPDATE status = 'ACTIVE'
  │   └─► Restore in RADIUS:
  │       ├─► DELETE Auth-Type Reject
  │       ├─► DELETE Reply-Message
  │       ├─► MOVE to 'default' group
  │       └─► Optional: assign static IP
  │
  ├─► Send CoA disconnect (force re-auth)
  │
  └─► User re-login → gets normal internet ✅
```

---

## 🛠️ Troubleshooting Guide

### Problem: User cannot login after expiry

**Symptom**: User gets "Akun Ditangguhkan" message

**Root Cause**: Auth-Type = 'Reject' in radcheck

**Check**:
```sql
SELECT * FROM radcheck 
WHERE username = 'user123' 
  AND attribute = 'Auth-Type';
```

**Fix**:
```sql
DELETE FROM radcheck 
WHERE username = 'user123' 
  AND attribute = 'Auth-Type';
```

### Problem: User can login but gets normal internet

**Symptom**: Isolated user has full internet access

**Root Cause**: Not in 'isolir' group or no firewall rules

**Check**:
```sql
SELECT * FROM radusergroup WHERE username = 'user123';
SELECT * FROM radgroupreply WHERE groupname = 'isolir';
```

**Fix**:
```sql
-- Ensure user in isolir group
INSERT INTO radusergroup (username, groupname, priority)
VALUES ('user123', 'isolir', 1);

-- Ensure group has attributes
INSERT INTO radgroupreply (groupname, attribute, value)
VALUES 
  ('isolir', 'Framed-IP-Address', 'pool-isolir'),
  ('isolir', 'Mikrotik-Rate-Limit', '64k/64k');
```

**Check MikroTik**:
```routeros
/ip firewall filter print where comment~"isolated"
/ip firewall nat print where comment~"isolation"
```

### Problem: User gets wrong IP (not from isolir pool)

**Symptom**: User gets IP from default pool

**Root Cause**: Static IP in radreply or group not applied

**Check**:
```sql
SELECT * FROM radreply 
WHERE username = 'user123' 
  AND attribute = 'Framed-IP-Address';
```

**Fix**:
```sql
-- Remove static IP
DELETE FROM radreply 
WHERE username = 'user123' 
  AND attribute = 'Framed-IP-Address';
```

### Problem: CoA disconnect not working

**Symptom**: User stays online after isolation

**Check MikroTik**:
```routeros
/radius incoming print
# Should show: accept=yes
```

**Fix**:
```routeros
/radius incoming set accept=yes
```

**Check FreeRADIUS**:
```bash
# Test CoA manually
echo "User-Name=user123" | radclient -x <NAS_IP>:3799 disconnect <SECRET>
```

### Problem: Firewall not blocking traffic

**Symptom**: Isolated user can access all sites

**Check MikroTik**:
```routeros
/ip firewall filter print where src-address~"192.168.200"
```

**Fix**: Re-apply firewall rules from isolation mikrotik page

---

## 📝 Recommendations for Fix

### 1. Update Cron Job Logic

**File**: `src/lib/cron/pppoe-sync.ts`

**Remove** (lines 273-277):
```typescript
// DON'T block login!
await prisma.$executeRaw`
  INSERT INTO radcheck (username, attribute, op, value)
  VALUES (${user.username}, 'Auth-Type', ':=', 'Reject')
  ON DUPLICATE KEY UPDATE value = 'Reject'
`;
```

**Remove** (lines 279-284):
```typescript
// No reject message needed if they can login
await prisma.$executeRaw`
  INSERT INTO radreply (username, attribute, op, value)
  VALUES (${user.username}, 'Reply-Message', ':=', 
          'Akun Ditangguhkan - Hubungi Admin')
  ON DUPLICATE KEY UPDATE value = 'Akun Ditangguhkan - Hubungi Admin'
`;
```

**Keep**:
```typescript
// ✅ Password (allow login)
// ✅ radusergroup = 'isolir' (apply group)
// ✅ Remove static IP
// ✅ Disconnect session
```

### 2. Change Status to ISOLATED

```typescript
// Change this:
data: { status: 'SUSPENDED' }

// To this:
data: { status: 'ISOLATED' }
```

### 3. Implement Grace Period

```typescript
const expiredUsers = await prisma.$queryRaw`
  SELECT id, username, password, status, expiredAt, profileId
  FROM pppoe_users pu
  INNER JOIN companies c ON 1=1
  WHERE pu.status = 'ACTIVE'
    AND pu.expiredAt < DATE_SUB(CURDATE(), INTERVAL c.gracePeriodDays DAY)
    AND pu.autoIsolationEnabled = true
`;
```

### 4. Update UI Status Filter

**File**: `src/app/admin/pppoe/page.tsx`

Add new filter option:
```typescript
const statusOptions = [
  { value: 'all', label: 'Semua' },
  { value: 'ACTIVE', label: 'Aktif' },
  { value: 'ISOLATED', label: 'Isolir' },  // ← NEW
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'BLOCKED', label: 'Blokir' }
];
```

---

## ✅ Success Criteria

A properly working isolation system should:

1. ✅ User can **LOGIN** after expiry (auth succeeds)
2. ✅ User gets **IP from isolation pool** (192.168.200.x)
3. ✅ User gets **limited bandwidth** (64k/64k)
4. ✅ User **can access DNS** (for domain resolution)
5. ✅ User **can access payment server** (to pay)
6. ✅ User **HTTP/HTTPS redirected** to landing page
7. ✅ User **cannot browse** other sites (blocked by firewall)
8. ✅ After payment, user **auto-restored** to normal
9. ✅ Grace period **properly calculated** before isolation
10. ✅ CoA disconnect **forces re-authentication** on status change

## 🔄 Bulk Un-isolation & Billing Realignment System

### 1. CLI Automation Script (`scripts/unisolate-all-and-set-date-6.js`)
Digunakan untuk operasi pemulihan massal langsung di terminal VPS:
```bash
node scripts/unisolate-all-and-set-date-6.js
```
**Alur Kerja Teknis**:
1. Mengambil seluruh user PPPoE dengan status `isolated`.
2. Mengelompokkan koneksi berdasarkan router MikroTik (`routerId`) untuk membuka 1 koneksi per router.
3. Mengembalikan PPP secret profile ke profil paket asli pelanggan (`disabled=no`).
4. Menendang sesi aktif di `/ppp/active` agar ONT melakukan *reconnect* otomatis dengan kecepatan normal.
5. Menghapus IP dan komentar pelanggan dari `/ip/firewall/address-list` list `isolir`.
6. Sinkronisasi tabel FreeRADIUS (membersihkan Auth-Type Reject di `radcheck`, Reply-Message di `radreply`, mengembalikan grup `radusergroup`, dan menutup sesi `radacct`).
7. Memperbarui `company.fixedBillingDate = 6`.
8. Memperbarui `billingDay = 6`, `billingCycleDay = 6`, dan `expiredAt = 2026-09-06T23:59:59.999Z` untuk seluruh pelanggan aktif/terisolir.
9. Memperbarui tagihan belum lunas bulan September 2026 (`PENDING` / `OVERDUE`) ke `dueDate = 2026-09-06T23:59:59.999Z` dan mengubah statusnya menjadi `PENDING`.

### 2. Admin API Route (`POST /api/pppoe/users/unisolate-all`)
Endpoint backend terproteksi sesi admin NextAuth untuk mengeksekusi un-isolir massal langsung dari dashboard web atau cURL:
```bash
curl -X POST http://localhost:3000/api/pppoe/users/unisolate-all \
  -H "Content-Type: application/json"
```

### 3. Antarmuka Web Dashboard (`/admin/isolated-users`)
Tombol **"Unisolir Semua Client (Set Tgl 6)"** tersedia di bagian header pemantauan pelanggan terisolir dengan modal konfirmasi interaktif sebelum eksekusi.

---

## 📚 Related Documentation

- [MIKROTIK_COA_SETUP.md](MIKROTIK_COA_SETUP.md) - CoA configuration guide
- [BALANCE_AUTO_RENEWAL.md](BALANCE_AUTO_RENEWAL.md) - Auto-renewal system
- [CRON-SYSTEM.md](CRON-SYSTEM.md) - Cron job documentation
- [FREERADIUS-SETUP.md](FREERADIUS-SETUP.md) - RADIUS server setup

---

**End of Document**

*Last Updated: February 2, 2026*
*Version: 1.0*
*Author: AI Assistant*
