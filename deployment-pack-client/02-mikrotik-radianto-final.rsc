# ==============================================================================
# SCRIPT DEPLOYMENT MIKROTIK FTTH (100% WORK VERIFIED CLIENT CONFIG)
# Disusun untuk : MikroTik RouterOS v6.x & v7.x (RB2011 / CCR / Hex Series)
# Klien         : RADIANTO FTTH
# Hardware      : RB2011UiAS-2HnD / Standard RouterBOARD
# Topologi Fisik:
#   - ether1-ISP        : Sumber Internet (Uplink Modem ISP via DHCP Client)
#   - ether2, 3, 4      : bridge-LAN (Akses PC Teknisi, Laptop, atau AP Kantor)
#   - ether5-DISTRIBUSI : Dedicated Trunk ke OLT VSOL (VLAN 20 PPPoE & VLAN 30 MGMT)
# DNS Resolver  : Cloudflare Unfiltered (1.1.1.1 & 1.0.0.1)
# ==============================================================================

# ------------------------------------------------------------------------------
# 1. IDENTIFIKASI & PENAMAAN INTERFACE FISIK
# ------------------------------------------------------------------------------
/interface ethernet
set [ find default-name=ether1 ] name=ether1-ISP comment="UPLINK-MODEM-ISP"
set [ find default-name=ether5 ] name=ether5-DISTRIBUSI comment="TRUNK-TO-OLT-VSOL"

# ------------------------------------------------------------------------------
# 2. LOCAL LAN BRIDGE (AKSES TEKNISI / LAPTOP / AP KANTOR)
# ------------------------------------------------------------------------------
/interface bridge
add comment="BRIDGE-LOCAL-LAN" name=bridge-LAN

/interface bridge port
add bridge=bridge-LAN comment="ACCESS-PORT-TEKNISI" interface=ether2
add bridge=bridge-LAN comment="ACCESS-PORT-TEKNISI" interface=ether3
add bridge=bridge-LAN comment="ACCESS-PORT-TEKNISI" interface=ether4
# Catatan: ether5-DISTRIBUSI TIDAK dimasukkan ke bridge agar isolasi trunk OLT 100% bersih

# ------------------------------------------------------------------------------
# 3. 802.1Q VLAN TRUNK KE OLT (NEMPEL DI ETHER5)
# ------------------------------------------------------------------------------
/interface vlan
add comment="VLAN20-PPPOE-SUBSCRIBERS" interface=ether5-DISTRIBUSI name=vlan20-PPPOE vlan-id=20
add comment="VLAN30-MGMT-OLT-VSOL" interface=ether5-DISTRIBUSI name=vlan30-MGMT vlan-id=30

# ------------------------------------------------------------------------------
# 4. IP ADDRESS ASSIGNMENT
# ------------------------------------------------------------------------------
/ip address
# IP Gateway untuk jaringan lokal kantor / teknisi (192.168.50.1)
add address=192.168.50.1/24 comment="IP-GATEWAY-LAN" interface=bridge-LAN network=192.168.50.0
# IP Gateway Management OLT (192.168.30.1) -> OLT diset IP 192.168.30.2
add address=192.168.30.1/24 comment="IP-GATEWAY-MGMT-OLT" interface=vlan30-MGMT network=192.168.30.0

# ------------------------------------------------------------------------------
# 5. WAN UPLINK (INTERNET DARI MODEM ISP)
# ------------------------------------------------------------------------------
/ip dhcp-client
add add-default-route=yes comment="DHCP-CLIENT-FROM-ISP" disabled=no interface=ether1-ISP use-peer-dns=no use-peer-ntp=no

# ------------------------------------------------------------------------------
# 6. DNS RESOLVER CLOUDFLARE (BEBAS BLOKIR & KENCANG)
# ------------------------------------------------------------------------------
/ip dns
set allow-remote-requests=yes servers=1.1.1.1,1.0.0.1

# ------------------------------------------------------------------------------
# 7. DHCP SERVER UNTUK PC TEKNISI / LAPTOP (PORT ETHER2 - ETHER4)
# ------------------------------------------------------------------------------
/ip pool
add comment="POOL-DHCP-LAN-TEKNISI" name=dhcp_pool_lan ranges=192.168.50.2-192.168.50.254

/ip dhcp-server
add address-pool=dhcp_pool_lan comment="DHCP-SERVER-LOCAL" disabled=no interface=bridge-LAN name=dhcp-lan

/ip dhcp-server network
add address=192.168.50.0/24 comment="NET-LAN-TEKNISI" dns-server=1.1.1.1,1.0.0.1 gateway=192.168.50.1
# Komentari DHCP bawaan pabrik agar tidak mengganggu
set [ find address=192.168.88.0/24 ] comment="DEFAULT-FACTORY-UNUSED"

# ------------------------------------------------------------------------------
# 8. POOL IP & PROFIL PPPOE PELANGGAN FTTH
# ------------------------------------------------------------------------------
/ip pool
add comment="POOL-PELANGGAN-PPPOE" name=POOL-PPPOE ranges=192.168.20.2-192.168.20.254

/ppp profile
# rate-limit otomatis membuat Simple Queue dinamis tanpa perlu queue manual
add dns-server=1.1.1.1,1.0.0.1 local-address=192.168.20.1 name=10mbps only-one=yes rate-limit=10M/10M remote-address=POOL-PPPOE comment="PROFIL-10-MBPS"
add dns-server=1.1.1.1,1.0.0.1 local-address=192.168.20.1 name=20mbps only-one=yes rate-limit=20M/20M remote-address=POOL-PPPOE comment="PROFIL-20-MBPS"

# ------------------------------------------------------------------------------
# 9. PPPOE SERVER SERVICE (KONSENTRATOR BRAS DI VLAN 20)
# ------------------------------------------------------------------------------
/interface pppoe-server server
add authentication=pap disabled=no interface=vlan20-PPPOE max-mru=1492 max-mtu=1492 one-session-per-host=yes service-name=PPPOE-SERVER

# ------------------------------------------------------------------------------
# 10. AKUN TEST / PELANGGAN PPPOE LIVE
# ------------------------------------------------------------------------------
/ppp secret
add comment="PELANGGAN-LIVE" name=RTE password=eugine0909 profile=10mbps service=pppoe
add comment="PELANGGAN-LIVE" name=Amar12 password=Eugine0909 profile=10mbps service=pppoe
add comment="PELANGGAN-LIVE" name=EMG000 password=eugine0909 profile=10mbps service=pppoe

# ------------------------------------------------------------------------------
# 11. FIREWALL NAT (INTERNET MASQUERADE & PRE-CONFIGURED REMOTE OLT)
# ------------------------------------------------------------------------------
/ip firewall nat
# Akses Internet Pelanggan & LAN via WAN ISP
add action=masquerade chain=srcnat comment="NAT-MASQUERADE-WAN-ISP" out-interface=ether1-ISP

# Pre-configured NAT Remote OLT (Disabled - enable jika kelak ingin remote dari luar kantor/VPS)
add action=masquerade chain=srcnat comment="NAT-SRC-MGMT-OLT (Enable saat butuh remote)" disabled=yes dst-address=192.168.30.2
add action=dst-nat chain=dstnat comment="DSTNAT-WEB-OLT-8001 (Enable saat butuh remote)" disabled=yes dst-port=8001 protocol=tcp to-addresses=192.168.30.2 to-ports=80
add action=dst-nat chain=dstnat comment="DSTNAT-SNMP-OLT-1611 (Enable saat butuh remote)" disabled=yes dst-port=1611 protocol=udp to-addresses=192.168.30.2 to-ports=161

# ------------------------------------------------------------------------------
# 12. TCP MSS CLAMPING (MENCEGAH WEB TERTENTU / STREAMING BLANK DI HP PELANGGAN)
# ------------------------------------------------------------------------------
/ip firewall mangle
add action=change-mss chain=forward comment="TCP-MSS-CLAMPING" new-mss=clamp-to-pmtu passthrough=yes protocol=tcp tcp-flags=syn

# ------------------------------------------------------------------------------
# 13. TIMEZONE & SINKRONISASI JAM OTOMATIS (NTP CLIENT)
# ------------------------------------------------------------------------------
/system clock
set time-zone-name=Asia/Jakarta

/system ntp client
set enabled=yes primary-ntp=103.83.142.30 secondary-ntp=14.102.153.110

# ------------------------------------------------------------------------------
# 14. HOUSEKEEPING WIRELESS BAWAAN (OFF SUPAYA AMAN)
# ------------------------------------------------------------------------------
/interface wireless
set [ find default-name=wlan1 ] disabled=yes comment="WIFI-INTERNAL-OFF"
