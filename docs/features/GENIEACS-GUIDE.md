# GenieACS TR-069 Integration

Complete guide for GenieACS CPE management integration in EugineBill RADIUS.

## 📡 Overview

GenieACS integration allows remote management of customer ONT devices via TR-069 protocol (CWMP). Features include:

- **Device Monitoring** - Real-time device status, uptime, signal strength
- **WiFi Configuration** - Edit SSID, password, security mode
- **Task Management** - Track all TR-069 operations
- **Multi-WLAN Support** - Manage 2.4GHz, 5GHz, Guest networks
- **WiFi Clients** - View connected devices per WLAN

## 🔧 Setup

### 1. GenieACS Server Installation

Install GenieACS on separate server or same VPS:

```bash
# Install MongoDB
sudo apt install -y mongodb

# Install GenieACS
sudo npm install -g genieacs

# Create systemd services
sudo nano /etc/systemd/system/genieacs-cwmp.service
```

**genieacs-cwmp.service:**
```ini
[Unit]
Description=GenieACS CWMP
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/local/bin/genieacs-cwmp --config /opt/genieacs/config.json
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**genieacs-nbi.service:**
```ini
[Unit]
Description=GenieACS NBI
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/local/bin/genieacs-nbi --config /opt/genieacs/config.json
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**genieacs-fs.service:**
```ini
[Unit]
Description=GenieACS FS
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/local/bin/genieacs-fs --config /opt/genieacs/config.json
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**genieacs-ui.service:**
```ini
[Unit]
Description=GenieACS UI
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/local/bin/genieacs-ui --config /opt/genieacs/config.json
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### 2. GenieACS Configuration

Create `/opt/genieacs/config.json`:

```json
{
  "MONGODB_CONNECTION_URL": "mongodb://127.0.0.1:27017/genieacs",
  "CWMP_INTERFACE": "0.0.0.0",
  "CWMP_PORT": 7547,
  "CWMP_SSL": false,
  "NBI_INTERFACE": "0.0.0.0",
  "NBI_PORT": 7557,
  "FS_INTERFACE": "0.0.0.0",
  "FS_PORT": 7567,
  "UI_INTERFACE": "0.0.0.0",
  "UI_PORT": 3000,
  "LOG_LEVEL": "info"
}
```

### 3. Start Services

```bash
sudo systemctl daemon-reload
sudo systemctl enable genieacs-cwmp genieacs-nbi genieacs-fs genieacs-ui
sudo systemctl start genieacs-cwmp genieacs-nbi genieacs-fs genieacs-ui

# Check status
sudo systemctl status genieacs-*
```

### 4. Configure in EugineBill RADIUS

Go to **Admin → Settings → GenieACS** and configure:

- **GenieACS URL**: `http://YOUR_GENIEACS_IP:7557` (NBI port)
- **Username**: Leave empty (or set if auth enabled)
- **Password**: Leave empty (or set if auth enabled)

Click **Test Connection** to verify.

## 🌐 ONT Configuration

### Huawei HG8145V5 Setup

Configure TR-069 client on ONT:

1. Login to ONT web interface (usually `192.168.100.1`)
2. Go to **Management → TR-069 Configuration**
3. Set:
   - **ACS URL**: `http://YOUR_GENIEACS_IP:7547/`
   - **ACS Username**: (leave empty or as required)
   - **ACS Password**: (leave empty or as required)
   - **Periodic Inform Enable**: `Yes`
   - **Periodic Inform Interval**: `300` (5 minutes, can be lower)
   - **Connection Request Username**: `admin`
   - **Connection Request Password**: `admin`

4. Click **Apply** and wait for device to appear in GenieACS

### Connection Request URL

For GenieACS to send commands immediately (not wait periodic inform), device needs proper Connection Request URL:

- **If ONT has public IP**: `http://ONT_PUBLIC_IP:7547`
- **If ONT behind NAT**: Setup port forwarding or use STUN server

⚠️ **Important**: If connection request doesn't work, changes will still apply on next periodic inform (every 5 minutes).

## 📋 Features

### Device Management

Navigate to **Admin → GenieACS → Devices**

Features:
- View all registered devices
- Real-time status (Online/Offline)
- Device details modal with:
  - Serial number, model, manufacturer
  - PPPoE username and IP
  - TR-069 IP address
  - Uptime, RX power, PON mode
  - WiFi configurations (all WLANs)
  - Connected WiFi clients

Actions:
- **Force Sync** - Trigger connection request immediately
- **Refresh Parameters** - Get latest device data
- **Reboot** - Restart device remotely
- **Edit WiFi** - Configure SSID and password

### WiFi Configuration

Click device → **Edit WiFi** button

Supported parameters:
- **SSID** - Network name (1-32 characters)
- **Security Mode**:
  - None (Open) - No password
  - WPA-PSK - WPA with TKIP
  - WPA2-PSK - WPA2 with AES (recommended)
  - WPA/WPA2-PSK - Mixed mode
- **Password** - 8-63 characters (required for encrypted modes)
- **Enable/Disable** - Turn WiFi on/off

**How it works:**
1. User clicks "Update WiFi"
2. API creates `setParameterValues` task
3. GenieACS sends connection request to device
4. Device connects and receives task
5. Parameters applied instantly
6. API checks task status after 2 seconds
7. Shows success/pending message

**Parameter mapping for Huawei HG8145V5:**
```
InternetGatewayDevice.LANDevice.1.WLANConfiguration.{index}.SSID
InternetGatewayDevice.LANDevice.1.WLANConfiguration.{index}.BeaconType
InternetGatewayDevice.LANDevice.1.WLANConfiguration.{index}.KeyPassphrase
InternetGatewayDevice.LANDevice.1.WLANConfiguration.{index}.IEEE11iAuthenticationMode
InternetGatewayDevice.LANDevice.1.WLANConfiguration.{index}.IEEE11iEncryptionModes
InternetGatewayDevice.LANDevice.1.WLANConfiguration.{index}.Enable
```

### Task Monitoring

Navigate to **Admin → GenieACS → Tasks**

Features:
- Real-time task list with status
- Auto-refresh every 10 seconds (toggle on/off)
- Filter by status: All / Pending / Fault / Done
- Task details:
  - Task ID
  - Device ID
  - Task name (setParameterValues, getParameterValues, etc.)
  - Timestamp
  - Retry count
  - Status badge
  - Error message (if fault)

Actions:
- **Retry** - Re-execute failed tasks
- **Delete** - Remove task from queue
- **Auto-refresh** - Toggle automatic updates

**Task Status:**
- **Pending** (yellow) - Waiting for device to connect
- **Done** (green) - Successfully executed
- **Fault** (red) - Error occurred, check details

## 🔄 API Endpoints

### Device Management

**Get Devices:**
```http
GET /api/settings/genieacs/devices
```

**Get Device Detail:**
```http
GET /api/settings/genieacs/devices/{deviceId}/detail
```

**Refresh Device:**
```http
POST /api/settings/genieacs/devices/{deviceId}/refresh
```

**Reboot Device:**
```http
POST /api/settings/genieacs/devices/{deviceId}/reboot
```

**Delete Device:**
```http
DELETE /api/settings/genieacs/devices/{deviceId}
```

### WiFi Configuration

**Update WiFi:**
```http
POST /api/genieacs/devices/{deviceId}/wifi
Content-Type: application/json

{
  "wlanIndex": 1,
  "ssid": "MyNetwork",
  "password": "MyPassword123",
  "securityMode": "WPA2-PSK",
  "enabled": true
}
```

Response:
```json
{
  "success": true,
  "message": "Konfigurasi WiFi berhasil dikirim ke device",
  "info": "Task berhasil dieksekusi",
  "taskId": "6930ee9736857bde5d1ca3ee",
  "taskStatus": "pending",
  "parameters": {
    "ssid": "MyNetwork",
    "securityMode": "WPA2-PSK",
    "enabled": true,
    "wlanIndex": 1
  }
}
```

### Task Management

**Get Tasks:**
```http
GET /api/genieacs/tasks
```

**Delete Task:**
```http
DELETE /api/genieacs/tasks/{taskId}
```

**Retry Task:**
```http
POST /api/genieacs/tasks/{taskId}/retry
```

### Connection Request

**Trigger Connection Request:**
```http
POST /api/genieacs/devices/{deviceId}/connection-request
```

## 🐛 Troubleshooting

### Device Not Appearing

**Problem**: ONT not showing in GenieACS devices list

**Solutions**:
1. Check TR-069 configuration on ONT
2. Verify ACS URL is correct: `http://GENIEACS_IP:7547/`
3. Check firewall - port 7547 must be open
4. Check GenieACS CWMP service: `systemctl status genieacs-cwmp`
5. View logs: `journalctl -u genieacs-cwmp -f`

### Task Stuck in Pending

**Problem**: WiFi edit task shows "Pending" forever

**Causes**:
- Connection request URL not working (device behind NAT)
- Firewall blocking connection request
- Device offline

**Solutions**:
1. Wait for periodic inform (5 minutes by default)
2. Setup port forwarding if device behind NAT
3. Reduce periodic inform interval on device
4. Click "Force Sync" to retry connection request

### Error cwmp.9002 - Internal Error

**Problem**: Task fails with `cwmp.9002 Internal error`

**Causes**:
- Wrong parameter path
- Parameter is read-only
- Value doesn't match expected type

**Solutions**:
1. Check device data model in GenieACS UI
2. Verify parameter is writable
3. Use correct path for your device model
4. For Huawei HG8145V5: Use `KeyPassphrase` not `PreSharedKey.1.KeyPassphrase`

### Connection Request Failed

**Problem**: "Force Sync" doesn't trigger device

**Check**:
```bash
# From GenieACS server, test connection to device
curl -v http://DEVICE_IP:7547/

# Expected: HTTP 401 Unauthorized (device responds)
# If timeout: Device not reachable
```

**Solutions**:
1. Verify device Connection Request URL is correct
2. Check device firewall allows incoming on port 7547
3. If behind NAT, setup port forwarding
4. Alternative: Wait for periodic inform instead

## 📊 Monitoring

### GenieACS Logs

View logs for debugging:

```bash
# CWMP service (device connections)
journalctl -u genieacs-cwmp -f

# NBI service (API)
journalctl -u genieacs-nbi -f

# UI service
journalctl -u genieacs-ui -f
```

### MongoDB Check

```bash
# Connect to MongoDB
mongo

# Use GenieACS database
use genieacs

# Count devices
db.devices.count()

# View recent devices
db.devices.find().limit(5)

# Count tasks
db.tasks.count()

# View pending tasks
db.tasks.find({ status: { $exists: false } })
```

### Network Test

```bash
# Test GenieACS API
curl http://localhost:7557/devices

# Test CWMP port
nc -zv localhost 7547

# Test from device to GenieACS
# (run on device or router)
curl -v http://GENIEACS_IP:7547/
```

## 🔐 Security

### Best Practices

1. **Use HTTPS** - Setup reverse proxy with SSL
2. **Enable Authentication** - Configure username/password in GenieACS
3. **Firewall Rules** - Only allow necessary ports
4. **VPN** - For devices to reach GenieACS securely
5. **Regular Updates** - Keep GenieACS updated

### Nginx Reverse Proxy (HTTPS)

```nginx
server {
    listen 443 ssl http2;
    server_name genieacs.yourdomain.com;
    
    ssl_certificate /etc/letsencrypt/live/genieacs.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/genieacs.yourdomain.com/privkey.pem;
    
    # GenieACS UI
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    # GenieACS NBI API
    location /api/ {
        proxy_pass http://localhost:7557/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

# CWMP (TR-069) - HTTP only (device connections)
server {
    listen 7547;
    server_name genieacs.yourdomain.com;
    
    location / {
        proxy_pass http://localhost:7547;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 📚 References

- [GenieACS Documentation](https://docs.genieacs.com/)
- [TR-069 CWMP Protocol](https://www.broadband-forum.org/technical/download/TR-069.pdf)
- [Huawei TR-069 Data Model](https://support.huawei.com/)

## 🎯 Roadmap

Future enhancements:
- [ ] Firmware upgrade via GenieACS
- [ ] Backup/restore device configuration
- [ ] Custom presets for common settings
- [ ] Bulk operations (multiple devices)
- [ ] Device grouping
- [ ] Scheduled tasks
- [ ] Alert notifications for device offline
