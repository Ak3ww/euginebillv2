# ==============================================================================
# SCRIPT DEPLOYMENT MIKROTIK FTTH (STANDARD ISP ENTERPRISE SPECIFICATION)
# Disusun untuk : MikroTik RouterOS v7.x / v6.x (RB & CCR Series)
# Uplink WAN    : DHCP-Client on ether1 (ISP Modem / ONT Uplink)
# Distribution  : bridge-LAN (ether2-ether5) + Trunk VLAN OLT (VID: 20, 30, 4000)
# Optimization  : Lean Native Queuing, Zero Overhead Mangle
# ==============================================================================

# ------------------------------------------------------------------------------
# 1. SYSTEM IDENTITY, TIMEZONE & TIME SYNCHRONIZATION (NTP)
# ------------------------------------------------------------------------------
/system identity
set name="Eugine-FTTH-Core"

/system clock
set time-zone-name=Asia/Jakarta

/ip cloud
set update-time=yes

/system ntp client
set enabled=yes
/system ntp client servers
add address=id.pool.ntp.org
add address=time.google.com

/ip service
set telnet disabled=yes
set ftp disabled=yes

# ------------------------------------------------------------------------------
# 2. WAN INTERFACE CONFIGURATION (DHCP CLIENT)
# ------------------------------------------------------------------------------
/ip dhcp-client
add add-default-route=yes comment="WAN-UPLINK-MODEM" default-route-distance=1 disabled=no interface=ether1 use-peer-dns=no use-peer-ntp=yes

# ------------------------------------------------------------------------------
# 3. DISTRIBUTION BRIDGE & SWITCHPORTS
# ------------------------------------------------------------------------------
/interface bridge
add comment="BRIDGE-LOCAL-DISTRIBUTION" name=bridge-LAN

/interface bridge port
add bridge=bridge-LAN comment="LAN-ACCESS-PORT" interface=ether2
add bridge=bridge-LAN comment="LAN-ACCESS-PORT" interface=ether3
add bridge=bridge-LAN comment="LAN-ACCESS-PORT" interface=ether4
add bridge=bridge-LAN comment="LAN-ACCESS-PORT" interface=ether5

# ------------------------------------------------------------------------------
# 4. FTTH 802.1Q VLAN INTERFACES (TRUNK TO OLT)
# ------------------------------------------------------------------------------
/interface vlan
add comment="VLAN20-PPPOE-SUBSCRIBERS" interface=bridge-LAN name=vlan20-PPPoE vlan-id=20
add comment="VLAN30-MGMT-OLT" interface=bridge-LAN name=vlan30-MGMT-OLT vlan-id=30
add comment="VLAN4000-TR069-ACS" interface=bridge-LAN name=vlan4000-tr069 vlan-id=4000

# ------------------------------------------------------------------------------
# 5. IP ADDRESS ASSIGNMENT & DEFAULT GATEWAYS
# ------------------------------------------------------------------------------
/ip address
add address=192.168.50.1/24 comment="IP-GATEWAY-LAN" interface=bridge-LAN network=192.168.50.0
add address=192.168.30.1/24 comment="IP-GATEWAY-MGMT-OLT" interface=vlan30-MGMT-OLT network=192.168.30.0
add address=10.40.10.1/24 comment="IP-GATEWAY-TR069-ACS" interface=vlan4000-tr069 network=10.40.10.0

# ------------------------------------------------------------------------------
# 6. DHCP SERVER LOCAL LAN (MANAGEMENT & CLIENT ACCESS)
# ------------------------------------------------------------------------------
/ip pool
add comment="POOL-DHCP-LAN" name=dhcp_pool_lan ranges=192.168.50.10-192.168.50.250

/ip dhcp-server
add address-pool=dhcp_pool_lan comment="DHCP-SERVER-LAN" disabled=no interface=bridge-LAN name=dhcp-lan

/ip dhcp-server network
add address=192.168.50.0/24 comment="NET-LOCAL-LAN" dns-server=192.168.50.1,8.8.8.8,1.1.1.1 gateway=192.168.50.1

# ------------------------------------------------------------------------------
# 7. DHCP SERVER TR-069 ACS (AUTO IP PROVISIONING FOR CPE ONT)
# ------------------------------------------------------------------------------
/ip pool
add comment="POOL-DHCP-TR069" name=dhcp_pool_tr069 ranges=10.40.10.2-10.40.11.254

/ip dhcp-server
add address-pool=dhcp_pool_tr069 comment="DHCP-SERVER-TR069" disabled=no interface=vlan4000-tr069 name=dhcp-tr069

/ip dhcp-server network
add address=10.40.10.0/24 comment="NET-TR069-ACS" dns-server=1.1.1.1,8.8.8.8 gateway=10.40.10.1

# ------------------------------------------------------------------------------
# 8. PPPOE IP POOLS & BANDWIDTH PROFILES
# ------------------------------------------------------------------------------
/ip pool
add comment="POOL-IP-PELANGGAN-PPPOE" name=POOL-PPPOE ranges=192.168.20.2-192.168.21.254,192.168.22.2-192.168.22.254

/ppp profile
add local-address=192.168.20.1 name="10 Mbps" only-one=yes rate-limit="10M/10M" remote-address=POOL-PPPOE
add local-address=192.168.20.1 name="20 Mbps" only-one=yes rate-limit="20M/20M" remote-address=POOL-PPPOE
add local-address=192.168.20.1 name="30 Mbps" only-one=yes rate-limit="30M/30M" remote-address=POOL-PPPOE
add local-address=192.168.20.1 name="50 Mbps" only-one=yes rate-limit="50M/50M" remote-address=POOL-PPPOE
add local-address=192.168.20.1 name="75 Mbps" only-one=yes rate-limit="75M/75M" remote-address=POOL-PPPOE
add local-address=192.168.20.1 name="100 Mbps" only-one=yes rate-limit="100M/100M" remote-address=POOL-PPPOE
add insert-queue-before=bottom local-address=192.168.20.1 name=FASUM only-one=yes rate-limit="10M/10M" remote-address=POOL-PPPOE

# ------------------------------------------------------------------------------
# 9. PPPOE SERVER SERVICE INSTANCE (BRAS CONCENTRATOR)
# ------------------------------------------------------------------------------
/interface pppoe-server server
add authentication=pap disabled=no interface=vlan20-PPPoE keepalive-timeout=20 max-mru=1492 max-mtu=1492 one-session-per-host=yes service-name="PPPOE-FTTH"

# ------------------------------------------------------------------------------
# 10. TCP MSS CLAMPING (PREVENT FRAGMENTATION OVER PPPOE TUNNELS)
# ------------------------------------------------------------------------------
/ip firewall mangle
add action=change-mss chain=forward comment="TCP-MSS-CLAMPING" new-mss=clamp-to-pmtu passthrough=yes protocol=tcp tcp-flags=syn

# ------------------------------------------------------------------------------
# 11. FIREWALL NAT (OUTBOUND MASQUERADE & INBOUND OLT MGMT)
# ------------------------------------------------------------------------------
/ip firewall nat
# Outbound Internet Masquerade via WAN Uplink
add action=masquerade chain=srcnat comment="NAT-MASQUERADE-WAN-OUTBOUND" out-interface=ether1

# Management OLT Access NAT (Forward Web GUI OLT to Port 8001)
add action=masquerade chain=srcnat comment="NAT-SRC-MGMT-OLT" dst-address=192.168.30.6
add action=dst-nat chain=dstnat comment="DSTNAT-MGMT-WEB-OLT-8001" dst-port=8001 protocol=tcp to-addresses=192.168.30.6 to-ports=80

# ------------------------------------------------------------------------------
# 12. RECURSIVE DNS RESOLVER & CACHE
# ------------------------------------------------------------------------------
/ip dns
set allow-remote-requests=yes cache-max-ttl=1d cache-size=65536KiB servers=1.1.1.1,1.0.0.1,8.8.8.8,8.8.4.4

# ------------------------------------------------------------------------------
# 13. AUTOMATED SYSTEM LOG & CACHE MAINTENANCE SCHEDULE
# ------------------------------------------------------------------------------
/system script
add dont-require-permissions=no name="SYS-MAINTENANCE" policy=ftp,reboot,read,write,policy,test,password,sniff,sensitive,romon source="/ip dns cache flush\r\n/system logging action set memory memory-lines=1\r\n/system logging action set memory memory-lines=1000\r\n:log info \"System Maintenance: DNS cache flushed and memory logs rotated.\""

/system scheduler
add interval=1d name="SCHED-DAILY-MAINTENANCE" on-event="SYS-MAINTENANCE" policy=ftp,reboot,read,write,policy,test,password,sniff,sensitive,romon start-time=03:00:00

# ------------------------------------------------------------------------------
# 14. PRE-PROVISIONED TEST PPPOE CREDENTIALS
# ------------------------------------------------------------------------------
/ppp secret
add comment="TEST-SUBSCRIBER-PPPOE" name=test profile="20 Mbps" service=pppoe password=123
