# VPN Client Setup Guide

## Masalah yang Terjadi

Saat test connection ke router via VPN Client IP (172.16.17.10), terjadi **timeout error** karena:
- VPS belum terkoneksi ke VPN Server
- IP 172.16.17.x hanya accessible melalui VPN tunnel
- Perlu setup VPN client di VPS terlebih dahulu

## Workflow yang Benar

### 1. Setup VPN Server di MikroTik

Di halaman **VPN Server**, klik tombol "Auto Setup VPN Server":
- VPN Type: L2TP/IPSec (recommended)
- Subnet: 41.216.178.0/24
- Secret: EugineBill-vpn-secret

Ini akan:
- Create IP pool untuk VPN
- Create PPP profile
- Enable L2TP server dengan IPSec
- Setup NAT masquerade

### 2. Setup VPN Client di VPS

**Option A: Manual via Web Interface**

1. Buka halaman **VPN Client**
2. Klik "Add Client"
3. Isi form:
   - Name: RADIUS-SERVER
   - VPN Server: Pilih server MikroTik
   - Username: radius-vps
   - Password: (set password)
   - ✅ Centang "Default RADIUS Server"
4. Save

**Option B: Setup di VPS (Linux L2TP Client)**

Jalankan script setup di VPS:

```bash
cd /var/www/EugineBill-radius
chmod +x setup-vpn-client.sh
sudo ./setup-vpn-client.sh
```

Input yang diperlukan:
- VPN Server IP: **IP PUBLIC MikroTik** (misal: 103.xx.xx.xx)
- VPN Username: **radius-vps** (username yang dibuat di web)
- VPN Password: password yang di-set
- IPSec Secret: **EugineBill-vpn-secret** (default)

Setelah setup, cek koneksi:
```bash
# Cek interface VPN
ip addr show | grep ppp

# Output yang diharapkan:
# ppp0: <POINTOPOINT,MULTICAST,NOARP,UP,LOWER_UP> mtu 1410 qdisc ...
#     inet 41.216.178.XX peer 41.216.178.1/32 scope global ppp0

# Cek routing
ip route | grep ppp

# Test ping ke router via VPN IP
ping 172.16.17.10
```

### 3. Add Router via VPN

Setelah VPS terkoneksi ke VPN, baru bisa add router:

1. Buka halaman **Router / NAS**
2. Klik "Add Router"
3. Isi form:
   - Router Name: Main Router
   - ✅ **Centang "Connect via VPN Client"**
   - VPN Client: Pilih **cabang1** (172.16.17.10) ★
   - IP Address: **172.16.17.10** (auto-fill dari VPN client)
   - Username: mikhmon
   - Password: (password MikroTik)
   - RADIUS Secret: secret123
4. Klik **Test Connection** → Harus success!
5. Klik **Add Router**

### 4. Add Router Direct (Tanpa VPN)

Jika router punya IP public dan accessible dari VPS:

1. **Jangan centang** "Connect via VPN Client"
2. IP Address: **IP PUBLIC router** (misal: 103.67.244.xxx)
3. Username: admin
4. Password: password MikroTik
5. Test Connection → Save

## Troubleshooting

### L2TP VPN Tidak Connect via Web Interface

**Gejala:** Setelah input data di L2TP Control modal, VPN tidak connect atau PPP interface tidak muncul.

**Penyebab Umum:**

1. **File `/etc/ppp/chap-secrets` kosong**
   ```bash
   # Cek file
   sudo cat /etc/ppp/chap-secrets
   
   # Jika kosong atau hanya ada comment, tambahkan credentials:
   echo 'vpn-username * vpn-password *' | sudo tee -a /etc/ppp/chap-secrets
   sudo chmod 600 /etc/ppp/chap-secrets
   ```

2. **Duplicate settings di `/etc/ppp/options.l2tpd.client`**
   
   **Masalah:** File options mengandung `name`, `password`, atau `plugin pppol2tp.so` yang sudah ada di xl2tpd.conf
   
   ```bash
   # Cek file
   sudo cat /etc/ppp/options.l2tpd.client
   
   # File yang BENAR (tanpa duplicate):
   ipcp-accept-local
   ipcp-accept-remote
   refuse-eap
   require-mschap-v2
   noccp
   noauth
   nodefaultroute
   usepeerdns
   debug
   connect-delay 5000
   
   # File yang SALAH (dengan duplicate - akan menyebabkan error):
   # JANGAN TAMBAHKAN INI:
   # name vpn-username
   # password vpn-password  
   # plugin pppol2tp.so
   # pppol2tp 7
   ```

3. **Check error log**
   ```bash
   # Cek log xl2tpd
   sudo journalctl -u xl2tpd -n 30 --no-pager
   
   # Cari error seperti:
   # "pppd exited for call xxxx with code 2" → Authentication failed (cek chap-secrets)
   # "Plugin pppol2tp.so loaded" muncul 2x → Duplicate plugin (cek options file)
   ```

**Solusi via Web Interface:**

1. Klik tombol **Configure & Connect** di L2TP Control modal
2. Tunggu 8-10 detik untuk koneksi establish
3. Cek output di hasil untuk melihat status PPP interface
4. Jika gagal, klik **Logs** untuk lihat error detail
5. Perbaiki sesuai error yang muncul, lalu klik **Restart**
### IPSec Negotiation Failed

**Gejala:** Log MikroTik menunjukkan "ipsec, error - phase1 negotiation failed" atau "no suitable proposal found"

**Penyebab:**

1. **Firewall MikroTik block IPSec packets**
   - Port UDP 500, 4500, 1701 di-block
   - ESP protocol (IP protocol 50) di-block

2. **IPSec proposal tidak cocok**
   - Encryption algorithm berbeda
   - PSK (Pre-Shared Key) tidak sama

**Solusi di MikroTik:**

```routeros
# 1. Allow IPSec dari IP VPS (ganti dengan IP VPS Anda)
/ip firewall filter add chain=input protocol=udp dst-port=500,4500,1701 \
  src-address=103.191.165.156 action=accept place-before=0 \
  comment="Allow IPSec L2TP from VPS"

# 2. Allow ESP protocol
/ip firewall filter add chain=input protocol=ipsec-esp \
  src-address=103.191.165.156 action=accept place-before=0 \
  comment="Allow ESP from VPS"

# 3. Cek firewall rules yang mungkin block
/ip firewall filter print where chain=input and action=drop

# 4. Pastikan L2TP Server enabled
/interface l2tp-server server print
# Should show: enabled: yes

# 5. Cek IPSec Secret sama dengan di VPS
/interface l2tp-server server print
# ipsec-secret: EugineBill-vpn-secret (harus sama!)
```

**Test Firewall:**
```bash
# Dari VPS, test apakah port terbuka
nc -zvu 103.146.202.131 500   # IPSec IKE
nc -zvu 103.146.202.131 1701  # L2TP
nc -zvu 103.146.202.131 4500  # IPSec NAT-T

# Cek IPSec status
sudo ipsec statusall
```

**Encryption Compatibility:**
VPS config sekarang sudah support MikroTik L2TP Server:
- IKE: 3DES-SHA1-MODP1024 (default MikroTik)
- ESP: 3DES-SHA1, AES256-SHA1, AES128-SHA1
### Test Connection Loading Terus

**Penyebab:** Timeout karena IP tidak reachable

**Solusi:**
1. Cek apakah VPN sudah connect:
   ```bash
   ip addr show | grep ppp
   ```

2. Test ping ke router:
   ```bash
   ping 172.16.17.10
   ```

3. Cek firewall MikroTik:
   ```
   /ip firewall filter print
   # Pastikan ada allow API port 8728 dari VPN
   ```

### VPN Tidak Connect

**Cek log IPSec:**
```bash
journalctl -u strongswan -f
```

**Cek log L2TP:**
```bash
tail -f /var/log/xl2tpd.log
```

**Reconnect manual:**
```bash
# Disconnect
echo 'd myvpn' > /var/run/xl2tpd/l2tp-control

# Connect
echo 'c myvpn' > /var/run/xl2tpd/l2tp-control
```

### Auto-Connect on Boot

Edit `/etc/rc.local`:
```bash
#!/bin/bash
sleep 5 && echo 'c myvpn' > /var/run/xl2tpd/l2tp-control &
exit 0
```

Make executable:
```bash
chmod +x /etc/rc.local
systemctl enable rc-local
```

## Network Diagram

```
Internet
    │
    ├─── MikroTik Router (VPN Server)
    │    ├─ Public IP: 103.67.244.xxx
    │    ├─ VPN IP: 41.216.178.1
    │    ├─ LAN IP: 172.16.17.1
    │    └─ API Port: 8728
    │
    └─── VPS (RADIUS Server)
         ├─ Public IP: 103.67.244.131
         ├─ VPN IP: 41.216.178.10 (setelah connect)
         └─ Services: FreeRADIUS, Web App

VPN Tunnel (L2TP/IPSec):
VPS (41.216.178.10) <──> MikroTik (41.216.178.1)

Setelah VPN connect, VPS bisa:
- Akses LAN router: 172.16.17.x
- Manage router via API: 172.16.17.10:8728
- FreeRADIUS authenticate: 172.16.17.10:1812
```

## Summary

**Untuk Router di LAN (Private IP):**
- Setup VPN Server di MikroTik ✅
- Setup VPN Client di VPS ✅
- Add router dengan "Connect via VPN Client" ✅
- Test connection via VPN IP

**Untuk Router dengan IP Public:**
- Add router langsung tanpa VPN
- IP Address = Public IP
- Test connection langsung

**Bintang (★) di VPN Client list:**
- Menandakan VPN client yang di-set sebagai "Default RADIUS Server"
- Router yang menggunakan VPN client ini akan gunakan VPN IP sebagai RADIUS server
