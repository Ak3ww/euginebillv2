# ==============================================================================
# SCRIPT DEPLOYMENT MIKROTIK FTTH (LEAN, FAST & DIRECT INTERNET VERSION)
# Disusun untuk : MikroTik RouterOS v7.x / v6.x (RB & CCR Series)
# Sumber Internet: Modem ISP (DHCP Client di ether1)
# Distribusi     : bridge-LAN (ether2-ether5) + VLAN FTTH OLT (20, 30, 4000)
# Bebas Queue Cake & Game Mangle (Fokus 100% Internet Cepat, Ringan & Stabil)
# ==============================================================================

# ------------------------------------------------------------------------------
# 1. WAN DHCP CLIENT (SUMBER INTERNET DARI MODEM ISP)
# ------------------------------------------------------------------------------
/ip dhcp-client
add add-default-route=yes comment="WAN DARI MODEM ISP (COLOK ETHER1)" disabled=no interface=ether1 use-peer-dns=yes use-peer-ntp=yes

# ------------------------------------------------------------------------------
# 2. BRIDGE & PORT DISTRIBUSI LAN / OLT
# ------------------------------------------------------------------------------
/interface bridge
add comment="Bridge Distribusi LAN dan OLT" name=bridge-LAN

/interface bridge port
add bridge=bridge-LAN comment="Port LAN / Laptop / OLT" interface=ether2
add bridge=bridge-LAN comment="Port LAN / Laptop / OLT" interface=ether3
add bridge=bridge-LAN comment="Port LAN / Laptop / OLT" interface=ether4
add bridge=bridge-LAN comment="Port LAN / Laptop / OLT" interface=ether5

# ------------------------------------------------------------------------------
# 3. VLAN FTTH (DI ATAS BRIDGE-LAN MENUJU OLT)
# ------------------------------------------------------------------------------
/interface vlan
add comment="VLAN 20 UNTUK TRAFIK PPPOE FTTH" interface=bridge-LAN name=vlan20-PPPoE vlan-id=20
add comment="VLAN 30 UNTUK MANAGEMENT REMOTE OLT" interface=bridge-LAN name=vlan30-MGMT-OLT vlan-id=30
add comment="VLAN 4000 UNTUK TR069 ACS MODEM ONT" interface=bridge-LAN name=vlan4000-tr069 vlan-id=4000

# ------------------------------------------------------------------------------
# 4. IP ADDRESS MANAGEMENT, LAN & GATEWAY
# ------------------------------------------------------------------------------
/ip address
add address=192.168.50.1/24 comment="Gateway LAN dan Laptop Teknisi (Port ether2-5)" interface=bridge-LAN network=192.168.50.0
add address=192.168.30.1/24 comment="Gateway Management OLT (IP OLT: 192.168.30.6)" interface=vlan30-MGMT-OLT network=192.168.30.0
add address=10.40.10.1/24 comment="Gateway TR069 ACS ONT" interface=vlan4000-tr069 network=10.40.10.0

# ------------------------------------------------------------------------------
# 5. DHCP SERVER LAN (LAPTOP / AKSES POINT COLOK LANGSUNG DAPAT IP & INTERNET)
# ------------------------------------------------------------------------------
/ip pool
add comment="Pool DHCP LAN / Laptop Teknisi" name=dhcp_pool_lan ranges=192.168.50.10-192.168.50.250

/ip dhcp-server
add address-pool=dhcp_pool_lan comment="DHCP Server LAN" disabled=no interface=bridge-LAN name=dhcp-lan

/ip dhcp-server network
add address=192.168.50.0/24 comment="Network LAN" dns-server=192.168.50.1,8.8.8.8,1.1.1.1 gateway=192.168.50.1

# ------------------------------------------------------------------------------
# 6. DHCP SERVER TR-069 (AUTO IP UNTUK MODEM ONT PELANGGAN)
# ------------------------------------------------------------------------------
/ip pool
add comment="DHCP TR069 POOL" name=dhcp_pool_tr069 ranges=10.40.10.2-10.40.11.254

/ip dhcp-server
add address-pool=dhcp_pool_tr069 comment="DHCP TR069 MODEM" disabled=no interface=vlan4000-tr069 name=dhcp-tr069

/ip dhcp-server network
add address=10.40.10.0/24 comment="Network TR069 ACS" dns-server=1.1.1.1,8.8.8.8 gateway=10.40.10.1

# ------------------------------------------------------------------------------
# 7. IP POOL & PROFILE PPPOE (STANDARD SIMPLE QUEUE - TANPA BEBAN CAKE QUEUE)
# ------------------------------------------------------------------------------
/ip pool
add comment="POOL PPPOE PELANGGAN" name=POOL-PPPOE ranges=192.168.20.2-192.168.21.254,192.168.22.2-192.168.22.254
add comment="IP Pool untuk user isolir" name=pool-isolir ranges=192.168.200.100-192.168.200.200

/ppp profile
add address-list=isolir comment="Profile untuk user isolir" local-address=192.168.200.1 name=isolir rate-limit=64k/64k remote-address=pool-isolir use-compression=no use-encryption=no use-mpls=no
add local-address=192.168.20.1 name="10 Mbps" only-one=yes rate-limit="10M/10M" remote-address=POOL-PPPOE
add local-address=192.168.20.1 name="20 Mbps" only-one=yes rate-limit="20M/20M" remote-address=POOL-PPPOE
add local-address=192.168.20.1 name="30 Mbps" only-one=yes rate-limit="30M/30M" remote-address=POOL-PPPOE
add local-address=192.168.20.1 name="50 Mbps" only-one=yes rate-limit="50M/50M" remote-address=POOL-PPPOE
add local-address=192.168.20.1 name="75 Mbps" only-one=yes rate-limit="75M/75M" remote-address=POOL-PPPOE
add local-address=192.168.20.1 name="100 Mbps" only-one=yes rate-limit="100M/100M" remote-address=POOL-PPPOE
add insert-queue-before=bottom local-address=192.168.20.1 name=FASUM only-one=yes rate-limit="10M/10M" remote-address=POOL-PPPOE

# ------------------------------------------------------------------------------
# 8. PPPOE SERVER INSTANCE
# ------------------------------------------------------------------------------
/interface pppoe-server server
add authentication=pap disabled=no interface=vlan20-PPPoE keepalive-timeout=20 max-mru=1492 max-mtu=1492 one-session-per-host=yes service-name="PPOE CLIENT VID 20"

# ------------------------------------------------------------------------------
# 9. TCP MSS CLAMPING (MENCEGAH MTU DROP PADA PPPOE - BEBAS MANGLE GAME)
# ------------------------------------------------------------------------------
/ip firewall mangle
add action=change-mss chain=forward comment="Clamp TCP MSS to PMTU" new-mss=clamp-to-pmtu passthrough=yes protocol=tcp tcp-flags=syn

# ------------------------------------------------------------------------------
# 10. FIREWALL NAT (UNIVERSAL MASQUERADE & REMOTE OLT)
# ------------------------------------------------------------------------------
/ip firewall nat
# Masquerade Utama ke Internet (Keluar lewat port WAN ether1)
add action=masquerade chain=srcnat comment="NAT Masquerade Internet WAN ether1" out-interface=ether1

# Masquerade Subnet Internal (LAN Teknisi, PPPoE Pelanggan & TR-069)
add action=masquerade chain=srcnat comment="NAT PPPoE Pelanggan" src-address=192.168.20.0/22
add action=masquerade chain=srcnat comment="NAT LAN dan Teknisi" src-address=192.168.50.0/24
add action=masquerade chain=srcnat comment="NAT TR-069 ACS" src-address=10.40.10.0/24

# Masquerade Management OLT (supaya laptop lokal bisa buka OLT)
add action=masquerade chain=srcnat comment="NAT Management OLT" dst-address=192.168.30.6

# Remote Web OLT VSOL dari laptop lokal melalui port 8003
add action=dst-nat chain=dstnat comment="Remote Web OLT VSOL" dst-port=8003 protocol=tcp to-addresses=192.168.30.6 to-ports=8003

# ------------------------------------------------------------------------------
# 11. DNS RESOLVER
# ------------------------------------------------------------------------------
/ip dns
set allow-remote-requests=yes cache-max-ttl=1d cache-size=65536KiB servers=1.1.1.1,1.0.0.1,8.8.8.8,8.8.4.4

# ------------------------------------------------------------------------------
# 12. SCHEDULER & SCRIPT AUTO-CLEAN (PEMBERSIHAN SUBUH JAM 03.00)
# ------------------------------------------------------------------------------
/system script
add dont-require-permissions=no name="CLEAR TRASH" policy=ftp,reboot,read,write,policy,test,password,sniff,sensitive,romon source="/ip dns cache flush\r\n/system logging action set memory memory-lines=1\r\n/system logging action set memory memory-lines=1000\r\n:log info \"Maintenance Rutin: DNS Cache dan Log berhasil dibersihkan.\""

/system scheduler
add interval=1d name="BERSIH-BERSIH -SUBUH" on-event="CLEAR TRASH" policy=ftp,reboot,read,write,policy,test,password,sniff,sensitive,romon start-time=03:00:00

# ------------------------------------------------------------------------------
# 13. USER TESTING PPPOE
# ------------------------------------------------------------------------------
/ppp secret
add comment="USER TESTING FTTH" name=test profile="20 Mbps" service=pppoe password=123
