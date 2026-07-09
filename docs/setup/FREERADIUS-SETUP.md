# FreeRADIUS Setup Guide for EugineBill RADIUS

This guide explains how to configure FreeRADIUS for both PPPoE and Hotspot authentication.

## Overview

EugineBill RADIUS uses FreeRADIUS 3.0 with MySQL backend to authenticate:
1. **PPPoE Users** - Customer accounts with `username@realm` format
2. **Hotspot Vouchers** - One-time codes without `@` symbol

## Installation

### Install FreeRADIUS
```bash
apt-get install -y freeradius freeradius-mysql freeradius-utils
```

### Verify Installation
```bash
freeradius -v
# Should show: FreeRADIUS Version 3.0.x
```

## ⚠️ IMPORTANT: Remove BOM from Config Files

If config files were edited on Windows or with editors that save UTF-8 BOM (Byte Order Mark), FreeRADIUS will silently fail to parse them. This causes:
- FreeRADIUS not binding to ports 1812/1813
- SQL module showing "Ignoring sql"
- REST module not loading

**Always remove BOM after copying config files:**
```bash
# Function to remove BOM
remove_bom() {
    sed -i '1s/^\xEF\xBB\xBF//' "$1"
}

# Apply to all config files
remove_bom /etc/freeradius/3.0/mods-available/sql
remove_bom /etc/freeradius/3.0/mods-available/rest
remove_bom /etc/freeradius/3.0/sites-available/default
remove_bom /etc/freeradius/3.0/clients.conf
```

**Verify no BOM exists:**
```bash
# Should show 's' for sql, 'r' for rest, '#' for default
xxd /etc/freeradius/3.0/mods-available/sql | head -1
# If you see "fffe" at the beginning, there's a BOM that needs to be removed
```

## Configuration Files

### 1. SQL Module (`/etc/freeradius/3.0/mods-enabled/sql`)

```
sql {
    driver = "rlm_sql_mysql"
    dialect = "mysql"
    
    server = "localhost"
    port = 3306
    login = "EugineBill_user"
    password = "EugineBillradius123"
    
    radius_db = "EugineBill_radius"
    
    acct_table1 = "radacct"
    acct_table2 = "radacct"
    postauth_table = "radpostauth"
    authcheck_table = "radcheck"
    groupcheck_table = "radgroupcheck"
    authreply_table = "radreply"
    groupreply_table = "radgroupreply"
    usergroup_table = "radusergroup"
    
    # Load NAS/clients from database
    read_clients = yes
    client_table = "nas"
    
    # Required for PPPoE group profiles
    read_groups = yes
    read_profiles = yes
    
    # Username format for queries
    sql_user_name = "%{%{Stripped-User-Name}:-%{User-Name}}"
    
    # Group attribute
    group_attribute = "SQL-Group"
    
    # Delete stale sessions on startup
    delete_stale_sessions = yes
    
    pool {
        start = 5
        min = 4
        max = 32
        spare = 3
        uses = 0
        lifetime = 0
        idle_timeout = 60
    }
    
    $INCLUDE ${modconfdir}/${.:name}/main/${dialect}/queries.conf
}
```

### 2. REST Module (`/etc/freeradius/3.0/mods-enabled/rest`)

```
rest {
    tls {
        check_cert = no
        check_cert_cn = no
    }

    connect_uri = "http://localhost:3000"

    # Post-auth: call webhook for voucher management
    post-auth {
        uri = "${..connect_uri}/api/radius/post-auth"
        method = "post"
        body = "json"
        data = "{ \"username\": \"%{User-Name}\", \"reply\": \"%{reply:Packet-Type}\", \"nasIp\": \"%{NAS-IP-Address}\", \"framedIp\": \"%{Framed-IP-Address}\" }"
        tls = ${..tls}
    }

    # Accounting: track session data
    accounting {
        uri = "${..connect_uri}/api/radius/accounting"
        method = "post"
        body = "json"
        data = "{ \"username\": \"%{User-Name}\", \"statusType\": \"%{Acct-Status-Type}\", \"sessionId\": \"%{Acct-Session-Id}\", \"nasIp\": \"%{NAS-IP-Address}\", \"framedIp\": \"%{Framed-IP-Address}\", \"sessionTime\": \"%{Acct-Session-Time}\", \"inputOctets\": \"%{Acct-Input-Octets}\", \"outputOctets\": \"%{Acct-Output-Octets}\" }"
        tls = ${..tls}
    }

    pool {
        start = 5
        min = 4
        max = 32
        spare = 3
        uses = 0
        lifetime = 0
        idle_timeout = 60
    }
}
```

### 3. Default Site (`/etc/freeradius/3.0/sites-enabled/default`)

Key modifications needed:

#### a. Enable SQL in authorize section
```
authorize {
    ...
    -sql
    ...
}
```

#### b. Conditional REST in post-auth section
Add after `-sql` in post-auth:
```
post-auth {
    ...
    -sql
    
    # Call REST API for voucher only (username without @)
    # PPPoE uses username@realm format, voucher does not have @
    if (!("%{User-Name}" =~ /@/)) {
        rest.post-auth
    }
    ...
}
```

This ensures:
- PPPoE users (with `@`) skip REST API call
- Hotspot vouchers (without `@`) call REST for expiry management

### 4. Policy Filter (`/etc/freeradius/3.0/policy.d/filter`)

#### ⚠️ PENTING: PPPoE Realm Without Dot Separator

Default FreeRADIUS policy `filter_username` akan menolak username dengan format `user@realm` jika realm tidak memiliki titik (dot separator). Contohnya:
- `user@domain.com` ✅ Valid (default)
- `user@cimerta` ❌ Ditolak (default) → ✅ Valid setelah modifikasi

**Perubahan yang dilakukan pada `policy.d/filter`:**

Bagian ini dikomentari untuk mengizinkan realm tanpa titik:
```
#  DISABLED: must have at least 1 string-dot-string after @
#  This check is disabled to allow realm without dot separator
#  e.g. "user@cimerta" is now allowed (previously required "user@site.com")
#
#if ((&User-Name =~ /@/) && (&User-Name !~ /@(.+)\.(.+)$/))  {
#        update request {
#                &Module-Failure-Message += 'Rejected: Realm does not have at least one dot separator'
#        }
#        reject
#}
```

**Cara Restore dari Backup:**
```bash
# Copy file policy.d-filter dari backup
sudo cp /var/www/EugineBill-radius/freeradius-config/policy.d-filter /etc/freeradius/3.0/policy.d/filter

# Remove BOM
sudo sed -i '1s/^\xEF\xBB\xBF//' /etc/freeradius/3.0/policy.d/filter

# Test konfigurasi
sudo freeradius -CX 2>&1 | tail -5
```

**Cara Modifikasi Manual:**
```bash
# Komentari bagian dot separator check
sudo sed -i '/must have at least 1 string-dot-string/,/reject$/{s/^/#/}' /etc/freeradius/3.0/policy.d/filter

# Hapus kurung kurawal berlebih jika ada
sudo sed -i '/^#.*reject$/,/^[[:space:]]*}$/{/^[[:space:]]*}$/d}' /etc/freeradius/3.0/policy.d/filter 2>/dev/null || true

# Test konfigurasi
sudo freeradius -CX 2>&1 | tail -5
```

### 5. CoA/Disconnect Support

Add to the bottom of `/etc/freeradius/3.0/sites-available/default`:
```
# CoA/Disconnect support for isolir and user disconnect
listen {
    type = coa
    ipaddr = *
    port = 3799
}
```

This enables:
- Disconnect-Request: Force disconnect user sessions
- CoA-Request: Change authorization attributes (for isolir feature)

## Verify Port Binding

After starting FreeRADIUS, verify it's listening on all required ports:
```bash
ss -tulnp | grep radiusd
```

Expected output:
- **Port 1812**: Authentication requests
- **Port 1813**: Accounting requests  
- **Port 3799**: CoA/Disconnect requests

If ports are not binding, check:
1. No BOM in config files (see above)
2. No syntax errors: `freeradius -C`
3. Debug mode: `freeradius -X`

## Database Tables

### Required RADIUS Tables

```sql
-- User authentication
CREATE TABLE radcheck (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(64) NOT NULL DEFAULT '',
    attribute VARCHAR(64) NOT NULL DEFAULT '',
    op CHAR(2) NOT NULL DEFAULT ':=',
    value VARCHAR(253) NOT NULL DEFAULT ''
);

-- User reply attributes
CREATE TABLE radreply (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(64) NOT NULL DEFAULT '',
    attribute VARCHAR(64) NOT NULL DEFAULT '',
    op CHAR(2) NOT NULL DEFAULT ':=',
    value VARCHAR(253) NOT NULL DEFAULT ''
);

-- User to group mapping
CREATE TABLE radusergroup (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(64) NOT NULL DEFAULT '',
    groupname VARCHAR(64) NOT NULL DEFAULT '',
    priority INT NOT NULL DEFAULT 1
);

-- Group check attributes
CREATE TABLE radgroupcheck (
    id INT AUTO_INCREMENT PRIMARY KEY,
    groupname VARCHAR(64) NOT NULL DEFAULT '',
    attribute VARCHAR(64) NOT NULL DEFAULT '',
    op CHAR(2) NOT NULL DEFAULT ':=',
    value VARCHAR(253) NOT NULL DEFAULT ''
);

-- Group reply attributes (bandwidth, session timeout)
CREATE TABLE radgroupreply (
    id INT AUTO_INCREMENT PRIMARY KEY,
    groupname VARCHAR(64) NOT NULL DEFAULT '',
    attribute VARCHAR(64) NOT NULL DEFAULT '',
    op CHAR(2) NOT NULL DEFAULT ':=',
    value VARCHAR(253) NOT NULL DEFAULT ''
);

-- NAS/Router clients
CREATE TABLE nas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nasname VARCHAR(128) NOT NULL,
    shortname VARCHAR(32),
    type VARCHAR(30) DEFAULT 'other',
    ports INT,
    secret VARCHAR(60) NOT NULL DEFAULT 'secret',
    server VARCHAR(64),
    community VARCHAR(50),
    description VARCHAR(200) DEFAULT 'RADIUS Client'
);

-- Accounting
CREATE TABLE radacct (
    radacctid BIGINT AUTO_INCREMENT PRIMARY KEY,
    acctsessionid VARCHAR(64) NOT NULL DEFAULT '',
    acctuniqueid VARCHAR(32) NOT NULL DEFAULT '',
    username VARCHAR(64) NOT NULL DEFAULT '',
    realm VARCHAR(64) DEFAULT '',
    nasipaddress VARCHAR(15) NOT NULL DEFAULT '',
    nasportid VARCHAR(32) DEFAULT NULL,
    nasporttype VARCHAR(32) DEFAULT NULL,
    acctstarttime DATETIME NULL DEFAULT NULL,
    acctupdatetime DATETIME NULL DEFAULT NULL,
    acctstoptime DATETIME NULL DEFAULT NULL,
    acctinterval INT DEFAULT NULL,
    acctsessiontime INT UNSIGNED DEFAULT NULL,
    acctauthentic VARCHAR(32) DEFAULT NULL,
    connectinfo_start VARCHAR(50) DEFAULT NULL,
    connectinfo_stop VARCHAR(50) DEFAULT NULL,
    acctinputoctets BIGINT DEFAULT NULL,
    acctoutputoctets BIGINT DEFAULT NULL,
    calledstationid VARCHAR(50) NOT NULL DEFAULT '',
    callingstationid VARCHAR(50) NOT NULL DEFAULT '',
    acctterminatecause VARCHAR(32) NOT NULL DEFAULT '',
    servicetype VARCHAR(32) DEFAULT NULL,
    framedprotocol VARCHAR(32) DEFAULT NULL,
    framedipaddress VARCHAR(15) NOT NULL DEFAULT '',
    framedipv6address VARCHAR(45) NOT NULL DEFAULT '',
    framedipv6prefix VARCHAR(45) NOT NULL DEFAULT '',
    framedinterfaceid VARCHAR(44) NOT NULL DEFAULT '',
    delegatedipv6prefix VARCHAR(45) NOT NULL DEFAULT ''
);

-- Post-auth logging
CREATE TABLE radpostauth (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(64) NOT NULL DEFAULT '',
    pass VARCHAR(64) NOT NULL DEFAULT '',
    reply VARCHAR(32) NOT NULL DEFAULT '',
    authdate TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

## Example Data

### PPPoE User
```sql
-- User credentials
INSERT INTO radcheck (username, attribute, op, value) VALUES
('john@rw01', 'Cleartext-Password', ':=', 'password123'),
('john@rw01', 'NAS-IP-Address', ':=', '192.168.1.1');

-- Assign to profile group
INSERT INTO radusergroup (username, groupname, priority) VALUES
('john@rw01', 'pppoe-10mbps', 1);

-- Group reply (bandwidth)
INSERT INTO radgroupreply (groupname, attribute, op, value) VALUES
('pppoe-10mbps', 'Mikrotik-Group', ':=', 'pppoe-10mbps'),
('pppoe-10mbps', 'Mikrotik-Rate-Limit', ':=', '10M/10M');
```

### Hotspot Voucher
```sql
-- Voucher credentials
INSERT INTO radcheck (username, attribute, op, value) VALUES
('ABC12345', 'Cleartext-Password', ':=', 'ABC12345');

-- Assign to profile group
INSERT INTO radusergroup (username, groupname, priority) VALUES
('ABC12345', 'hotspot-3jam', 1);

-- Group reply (session timeout, bandwidth)
INSERT INTO radgroupreply (groupname, attribute, op, value) VALUES
('hotspot-3jam', 'Mikrotik-Group', ':=', 'hotspot-3jam'),
('hotspot-3jam', 'Mikrotik-Rate-Limit', ':=', '5M/5M'),
('hotspot-3jam', 'Session-Timeout', ':=', '10800');
```

### NAS/Router Client
```sql
INSERT INTO nas (nasname, shortname, type, secret, description) VALUES
('192.168.1.1', 'mikrotik-hap', 'other', 'secret123', 'MikroTik hAP');
```

## Testing

### Test Configuration
```bash
freeradius -XC
# Should show: Configuration appears to be OK
```

### Test Authentication
```bash
# Stop service first
systemctl stop freeradius

# Run in debug mode
freeradius -X

# In another terminal, test:
radtest 'john@rw01' 'password123' 127.0.0.1 0 testing123
radtest 'ABC12345' 'ABC12345' 127.0.0.1 0 testing123
```

### Expected Results

**PPPoE User:**
```
Received Access-Accept Id 123
    Mikrotik-Group = "pppoe-10mbps"
    Mikrotik-Rate-Limit = "10M/10M"
```

**Hotspot Voucher:**
```
Received Access-Accept Id 124
    Mikrotik-Group = "hotspot-3jam"
    Mikrotik-Rate-Limit = "5M/5M"
    Session-Timeout = 10800
```

## Troubleshooting

### Common Issues

1. **Access-Reject for PPPoE users with @**
   - Cause: `filter_username` policy enabled
   - Fix: Comment out `filter_username` in sites-enabled/default

2. **Voucher getting rejected after REST API call**
   - Cause: REST API returning error
   - Fix: Check API logs, ensure `/api/radius/post-auth` returns success

3. **NAS not loading from database**
   - Cause: `read_clients = yes` not set
   - Fix: Add `read_clients = yes` and `client_table = "nas"` to sql module

4. **Duplicate module error**
   - Cause: Multiple symlinks in mods-enabled
   - Fix: `rm /etc/freeradius/3.0/mods-enabled/sql; ln -s ../mods-available/sql mods-enabled/`

### Debug Commands
```bash
# Check FreeRADIUS status
systemctl status freeradius

# View logs
tail -f /var/log/freeradius/radius.log

# Test specific user in database
mysql -u EugineBill_user -p EugineBill_radius -e "SELECT * FROM radcheck WHERE username='john@rw01'"
```

## Backup & Restore

### Backup Current Config
```bash
mkdir -p /tmp/freeradius-backup
cp -r /etc/freeradius/3.0/sites-enabled /tmp/freeradius-backup/
cp -r /etc/freeradius/3.0/mods-enabled /tmp/freeradius-backup/
cp /etc/freeradius/3.0/clients.conf /tmp/freeradius-backup/
tar -czvf freeradius-config-backup.tar.gz -C /tmp freeradius-backup
```

### Restore Config
```bash
tar -xzvf freeradius-config-backup.tar.gz -C /tmp
cp /tmp/freeradius-backup/sites-enabled/* /etc/freeradius/3.0/sites-enabled/
cp /tmp/freeradius-backup/mods-enabled/* /etc/freeradius/3.0/mods-enabled/
# Edit credentials as needed
freeradius -XC
systemctl restart freeradius
```

## MikroTik Configuration

### PPPoE Server
```
/ppp profile add name=pppoe-radius use-radius=yes
/ppp secret set default-profile=pppoe-radius

/radius add address=VPS_IP secret=SECRET service=ppp
/radius incoming set accept=yes port=3799
```

### Hotspot Server
```
/ip hotspot profile set default use-radius=yes
/ip hotspot user profile set default use-radius=yes

/radius add address=VPS_IP secret=SECRET service=hotspot
/radius incoming set accept=yes port=3799
```

## Security Notes

1. Use strong secrets for NAS clients
2. Restrict RADIUS ports (1812, 1813, 3799) to known NAS IPs
3. Use SSL/TLS for REST API in production
4. Regularly rotate database passwords
5. Monitor failed authentication attempts
