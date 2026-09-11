# ==============================================================================
# SCRIPT DEPLOYMENT MIKROTIK FTTH (LEAN & CLEAN VERSION)
# Disusun untuk: MikroTik RouterOS v7.x (Kompatibel RB / CCR Series)
# Sinkron 100% dengan OLT VSOL V1600GS (VLAN 20 PPPoE, VLAN 30 MGMT, VLAN 4000 TR069)
# ==============================================================================

# ------------------------------------------------------------------------------
# 1. BRIDGE & VLAN FTTH
# ------------------------------------------------------------------------------
/interface bridge
add name=bridge-FTTH

# PENTING: Masukkan port kabel yang menuju ke OLT ke dalam bridge-FTTH.
# Contoh jika kabel dicolok di ether3 (uncomment dan jalankan di terminal):
# /interface bridge port add bridge=bridge-FTTH interface=ether3

/interface vlan
add comment="VLAN 20 UNTUK TRAFIK PPPOE FTTH" interface=bridge-FTTH name=vlan20-PPPoE vlan-id=20
add comment="VLAN 30 UNTUK MANAGEMENT REMOTE OLT" interface=bridge-FTTH name=vlan30-MGMT-OLT vlan-id=30
add comment="VLAN 4000 UNTUK TR069 ACS MODEM ONT" interface=bridge-FTTH name=vlan4000-tr069 vlan-id=4000

# ------------------------------------------------------------------------------
# 2. IP ADDRESS MANAGEMENT & GATEWAY
# ------------------------------------------------------------------------------
/ip address
add address=192.168.30.1/24 comment="Gateway Management OLT (IP OLT: 192.168.30.6)" interface=vlan30-MGMT-OLT network=192.168.30.0
add address=10.40.10.1/24 comment="Gateway TR069 ACS ONT" interface=vlan4000-tr069 network=10.40.10.0

# ------------------------------------------------------------------------------
# 3. DHCP SERVER TR-069 (AUTO IP UNTUK MODEM ONT)
# ------------------------------------------------------------------------------
/ip pool
add comment="DHCP TR069 POOL" name=dhcp_pool_tr069 ranges=10.40.10.2-10.40.11.254

/ip dhcp-server
add address-pool=dhcp_pool_tr069 comment="DHCP TR069 MODEM" interface=vlan4000-tr069 name=dhcp-tr069 disabled=no

/ip dhcp-server network
add address=10.40.10.0/24 comment="Network TR069 ACS" dns-server=1.1.1.1,8.8.8.8 gateway=10.40.10.1

# ------------------------------------------------------------------------------
# 4. QUEUE CAKE (SMART QUEUE MANAGEMENT - ANTI LAG GAME & BUFFERBLOAT)
# ------------------------------------------------------------------------------
/queue type
add kind=sfq name=SFQ
add cake-ack-filter=filter cake-diffserv=diffserv4 cake-memlimit=32.0MiB \
    cake-mpu=84 cake-nat=yes cake-overhead=38 cake-overhead-scheme=ethernet \
    cake-rtt=50ms kind=cake name=cake

# ------------------------------------------------------------------------------
# 5. IP POOL & PROFILE PPPOE (DENGAN CAKE QUEUE)
# ------------------------------------------------------------------------------
/ip pool
add comment="POOL PPPOE PELANGGAN" name=POOL-PPPOE ranges=192.168.20.2-192.168.21.254,192.168.22.2-192.168.22.254
add comment="IP Pool untuk user isolir" name=pool-isolir ranges=192.168.200.100-192.168.200.200

/ppp profile
add address-list=isolir comment="Profile untuk user isolir" local-address=192.168.200.1 name=isolir rate-limit=64k/64k remote-address=pool-isolir use-compression=no use-encryption=no use-mpls=no
add local-address=192.168.20.1 name="10 Mbps" only-one=yes queue-type=cake rate-limit="10M/10M" remote-address=POOL-PPPOE
add local-address=192.168.20.1 name="20 Mbps" only-one=yes queue-type=cake rate-limit="21M/21M" remote-address=POOL-PPPOE
add local-address=192.168.20.1 name="30 Mbps" only-one=yes queue-type=cake rate-limit="31M/31M" remote-address=POOL-PPPOE
add local-address=192.168.20.1 name="50 Mbps" only-one=yes queue-type=cake rate-limit="51M/51M" remote-address=POOL-PPPOE
add local-address=192.168.20.1 name="75 Mbps" only-one=yes queue-type=cake rate-limit="78M/78M" remote-address=POOL-PPPOE
add local-address=192.168.20.1 name="100 Mbps" only-one=yes queue-type=cake rate-limit="104M/104M" remote-address=POOL-PPPOE
add insert-queue-before=bottom local-address=192.168.20.1 name=FASUM only-one=yes queue-type=cake rate-limit="10M/10M" remote-address=POOL-PPPOE

# ------------------------------------------------------------------------------
# 6. PPPOE SERVER INSTANCE
# ------------------------------------------------------------------------------
/interface pppoe-server server
add authentication=pap disabled=no interface=vlan20-PPPoE keepalive-timeout=20 max-mru=1492 max-mtu=1492 one-session-per-host=yes service-name="PPOE CLIENT VID 20"

# ------------------------------------------------------------------------------
# 7. GAME PRIORITY MANGLE (MLBB, PUBG MOBILE, DLL)
# ------------------------------------------------------------------------------
/ip firewall mangle
add action=change-mss chain=forward new-mss=clamp-to-pmtu passthrough=yes protocol=tcp tcp-flags=syn
add action=mark-connection chain=prerouting comment="Game MLBB" dst-port="5000-5221,5224-5227,5229-5241,5243-5508,5551-5559,5601-5700,9000-9010,9443" new-connection-mark=pkg-game passthrough=yes protocol=tcp
add action=mark-connection chain=prerouting dst-port="5520-5529,10003,30000-30300" new-connection-mark=pkg-game passthrough=yes protocol=tcp
add action=mark-connection chain=prerouting dst-port="4001-4009,5000-5221,5224-5241,5243-5509,5551-5559,5601-5700,8130,9120" new-connection-mark=pkg-game passthrough=yes protocol=udp
add action=mark-connection chain=prerouting dst-port="2702,3702,5517,5520-5529,9000-9010,9992,10003,30000-30300" new-connection-mark=pkg-game passthrough=yes protocol=udp
add action=mark-connection chain=prerouting comment="Game PUBGMobile" dst-port="7889,10012,13004,14000,17000,17500,18081,20000-20002,20371" new-connection-mark=pkg-game passthrough=yes protocol=tcp
add action=mark-connection chain=prerouting dst-port="8011,9030,10491,10612,12235,13004,13748,17000,17500,20000-20002" new-connection-mark=pkg-game passthrough=yes protocol=udp
add action=mark-connection chain=prerouting dst-port="7086-7995,10039,10096,11455,12070-12460,13894,13972,41182-41192" new-connection-mark=pkg-game passthrough=yes protocol=udp
add action=mark-packet chain=forward connection-mark=pkg-game new-packet-mark=paket-game passthrough=no

# ------------------------------------------------------------------------------
# 8. FIREWALL NAT (UNIVERSAL MASQUERADE & REMOTE OLT)
# Bebas dicolok ke port WAN mana saja tanpa tergantung interface list
# ------------------------------------------------------------------------------
/ip firewall nat
# Masquerade Internet PPPoE Pelanggan
add action=masquerade chain=srcnat comment="NAT PPPoE Pelanggan" src-address=192.168.20.0/22

# Masquerade TR-069 ACS
add action=masquerade chain=srcnat comment="NAT TR-069 ACS" src-address=10.40.10.0/24

# Masquerade Management OLT (supaya laptop lokal bisa buka OLT)
add action=masquerade chain=srcnat comment="NAT Management OLT" dst-address=192.168.30.6

# Remote Web OLT VSOL dari laptop lokal melalui port 8003
add action=dst-nat chain=dstnat comment="Remote Web OLT VSOL" dst-port=8003 protocol=tcp to-addresses=192.168.30.6 to-ports=8003

# ------------------------------------------------------------------------------
# 9. DNS RESOLVER
# ------------------------------------------------------------------------------
/ip dns
set allow-remote-requests=yes cache-max-ttl=1d cache-size=65536KiB servers=1.1.1.1,1.0.0.1,8.8.8.8,8.8.4.4

# ------------------------------------------------------------------------------
# 10. SCHEDULER & SCRIPT AUTO-CLEAN (PEMBERSIHAN SUBUH JAM 03.00)
# ------------------------------------------------------------------------------
/system script
add dont-require-permissions=no name="CLEAR TRASH" policy=ftp,reboot,read,write,policy,test,password,sniff,sensitive,romon source="/ip dns cache flush\r\n/system logging action set memory memory-lines=1\r\n/system logging action set memory memory-lines=1000\r\n:log info \"Maintenance Rutin: DNS Cache dan Log berhasil dibersihkan.\""

/system scheduler
add interval=1d name="BERSIH-BERSIH -SUBUH" on-event="CLEAR TRASH" policy=ftp,reboot,read,write,policy,test,password,sniff,sensitive,romon start-time=03:00:00

# ------------------------------------------------------------------------------
# 11. USER TESTING PPPOE
# ------------------------------------------------------------------------------
/ppp secret
add comment="USER TESTING FTTH" name=test profile="20 Mbps" service=pppoe password=123
