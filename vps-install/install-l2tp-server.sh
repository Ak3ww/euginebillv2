#!/bin/bash
# ============================================================================
# EugineBill RADIUS — Pure L2TP VPN Server Installer (UltraVPN Standard)
# ============================================================================
# Mengkonfigurasi VPS sebagai Pure L2TP VPN Server (xl2tpd + ppp murni)
# Tanpa IPsec / strongSwan — Sangat ringan, stabil, dan battle-tested persis UltraVPN.
# Cocok untuk seluruh router MikroTik (RouterOS 6.x & 7.x).
#
# Arsitektur:
#   NAS (MikroTik RouterOS 6+/7+) <-- L2TP Client (use-ipsec=no) --> VPS (xl2tpd:1701)
#   VPS assign IP pool 10.201.0.x per NAS -> FreeRADIUS / Winbox remote
#
# Usage:
#   bash install-l2tp-server.sh [--subnet 10.201.0.0/24]
# ============================================================================

set -euo pipefail

# ── Nilai default ──────────────────────────────────────────────────────────
L2TP_SUBNET="${L2TP_SUBNET:-10.201.0.0/24}"
L2TP_CONF_DIR="/etc/EugineBill/l2tp"
INFO_FILE="${L2TP_CONF_DIR}/l2tp-server-info.json"

# Parse CLI args
while [[ $# -gt 0 ]]; do
  case $1 in
    --subnet)    L2TP_SUBNET="$2"; shift 2 ;;
    *) shift ;;
  esac
done

# ── Helper functions ───────────────────────────────────────────────────────
print_header() {
  echo ""
  echo "╔══════════════════════════════════════════════════════════╗"
  echo "║  Pure L2TP VPN Server (UltraVPN Standard) — EugineBill  ║"
  echo "╚══════════════════════════════════════════════════════════╝"
  echo ""
}
print_info()    { echo "[INFO]  $*"; }
print_ok()      { echo "[OK]    $*"; }
print_warn()    { echo "[WARN]  $*"; }
print_error()   { echo "[ERROR] $*" >&2; }

derive_ip() {
  local subnet="$1" octet="$2"
  local base="${subnet%/*}"
  echo "$(echo "$base" | cut -d. -f1-3).${octet}"
}

# ── Root check ─────────────────────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
  print_error "Harus dijalankan sebagai root"
  exit 1
fi

print_header

# ── Stop and disable legacy strongSwan/IPsec if present ─────────────────────
print_info "Mematikan strongSwan/IPsec legacy jika ada (Pure L2TP mode)..."
systemctl stop strongswan-starter ipsec strongswan 2>/dev/null || true
systemctl disable strongswan-starter ipsec strongswan 2>/dev/null || true

# ── Derive IPs ─────────────────────────────────────────────────────────────
L2TP_LOCAL_IP="${L2TP_LOCAL_IP:-$(derive_ip "${L2TP_SUBNET}" 1)}"
L2TP_POOL_START="$(derive_ip "${L2TP_SUBNET}" 10)"
L2TP_POOL_END="$(derive_ip "${L2TP_SUBNET}" 254)"

PUBLIC_IP=""
PUBLIC_IP=$(curl -4 -s --connect-timeout 5 ifconfig.me 2>/dev/null || \
            curl -4 -s --connect-timeout 5 api.ipify.org 2>/dev/null || \
            hostname -I 2>/dev/null | awk '{print $1}' || echo "unknown")

print_info "Subnet      : ${L2TP_SUBNET}"
print_info "VPS local IP: ${L2TP_LOCAL_IP}"
print_info "Pool        : ${L2TP_POOL_START} – ${L2TP_POOL_END}"
print_info "Public IP   : ${PUBLIC_IP}"
print_info "Mode        : Pure L2TP (use-ipsec=no, UltraVPN Standard)"

# ── [1] Install packages ───────────────────────────────────────────────────
print_info "[1/5] Install xl2tpd + ppp (Pure L2TP)..."
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y \
  xl2tpd ppp iptables || { print_error "apt-get install gagal"; exit 1; }

if ! command -v xl2tpd &>/dev/null; then
  print_error "xl2tpd tidak terinstall"
  exit 1
fi
print_ok "xl2tpd: $(xl2tpd --version 2>&1 | head -1 || echo 'installed')"

# ── [2] xl2tpd server config ───────────────────────────────────────────────
print_info "[2/5] Konfigurasi xl2tpd server..."
mkdir -p "${L2TP_CONF_DIR}"
chmod 700 "${L2TP_CONF_DIR}"
mkdir -p /etc/xl2tpd
mkdir -p /etc/ppp

cat > /etc/xl2tpd/xl2tpd.conf << XEOF
[global]
port = 1701
auth file = /etc/ppp/chap-secrets
access control = no

[lns default]
ip range = ${L2TP_POOL_START}-${L2TP_POOL_END}
local ip = ${L2TP_LOCAL_IP}
require chap = yes
require authentication = yes
refuse pap = yes
ppp debug = no
pppoptfile = /etc/ppp/options.xl2tpd.server
length bit = yes
XEOF

cat > /etc/ppp/options.xl2tpd.server << PPPEOF
# PPP options for Pure L2TP server (UltraVPN Standard)
ipcp-accept-local
ipcp-accept-remote
ms-dns 1.1.1.1
ms-dns 1.0.0.1
noccp
auth
require-chap
require-mschap-v2
refuse-pap
mtu 1450
mru 1450
nodefaultroute
proxyarp
connect-delay 5000
# LCP keepalive
lcp-echo-interval 30
lcp-echo-failure 4
PPPEOF

# Pastikan chap-secrets ada dengan permission aman
touch /etc/ppp/chap-secrets
chmod 600 /etc/ppp/chap-secrets

print_ok "xl2tpd server dikonfigurasi murni tanpa IPsec"

# ── [3] IP forwarding + firewall rules ─────────────────────────────────────
print_info "[3/5] Aktifkan IP forwarding + firewall rules..."
sysctl -w net.ipv4.ip_forward=1 > /dev/null

SYSCTL_FILE="/etc/sysctl.d/99-l2tp-forward.conf"
if [[ ! -f "${SYSCTL_FILE}" ]]; then
  echo "net.ipv4.ip_forward = 1" > "${SYSCTL_FILE}"
fi

# UFW atau iptables
if command -v ufw &>/dev/null && ufw status | grep -q "Status: active"; then
  ufw allow 1701/udp comment "Pure L2TP VPN Server (UltraVPN Standard)" > /dev/null 2>&1 || true
  # Hapus port IPsec jika ada
  ufw delete allow 500/udp > /dev/null 2>&1 || true
  ufw delete allow 4500/udp > /dev/null 2>&1 || true
  print_ok "UFW: Port 1701/udp dibuka (500/4500 IPsec dinonaktifkan)"
else
  iptables -C INPUT -p udp --dport 1701 -j ACCEPT 2>/dev/null || \
    iptables -I INPUT -p udp --dport 1701 -j ACCEPT
  print_ok "iptables: Port 1701/udp dibuka"
fi

# NAT Masquerade untuk tunnel subnet
iptables -t nat -C POSTROUTING -s "${L2TP_SUBNET}" -j MASQUERADE 2>/dev/null || \
  iptables -t nat -A POSTROUTING -s "${L2TP_SUBNET}" -j MASQUERADE

# RADIUS dari L2TP pool
for port in 1812 1813 3799; do
  iptables -C INPUT -s "${L2TP_SUBNET}" -p udp --dport "${port}" -j ACCEPT 2>/dev/null || \
    iptables -I INPUT -s "${L2TP_SUBNET}" -p udp --dport "${port}" -j ACCEPT
done
print_ok "Subnet routing & RADIUS ports terkonfigurasi"

# ── [4] Enable + start xl2tpd ──────────────────────────────────────────────
print_info "[4/5] Mengaktifkan dan menjalankan layanan xl2tpd..."
systemctl enable xl2tpd 2>/dev/null || true
systemctl restart xl2tpd

sleep 1
if systemctl is-active --quiet xl2tpd; then
  print_ok "xl2tpd running (listening on 0.0.0.0:1701 UDP)"
else
  print_warn "xl2tpd mungkin tidak jalan — cek: journalctl -u xl2tpd -n 20"
fi

# ── [5] Simpan server info ─────────────────────────────────────────────────
print_info "[5/5] Simpan server info..."

cat > "${INFO_FILE}" << JSONEOF
{
  "type": "pure-l2tp",
  "localIp": "${L2TP_LOCAL_IP}",
  "subnet": "${L2TP_SUBNET}",
  "poolStart": "${L2TP_POOL_START}",
  "poolEnd": "${L2TP_POOL_END}",
  "publicIp": "${PUBLIC_IP}",
  "installedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
JSONEOF
chmod 640 "${INFO_FILE}"

# ── Helper script: tambah/hapus NAS credentials ────────────────────────────
cat > /usr/local/bin/EugineBill-l2tp-peer << 'PEEREOF'
#!/bin/bash
# Usage:
#   EugineBill-l2tp-peer add <username> <password> <vpn_ip>
#   EugineBill-l2tp-peer remove <username>
#   EugineBill-l2tp-peer list

set -euo pipefail
CMD="${1:-list}"
CHAP_FILE="/etc/ppp/chap-secrets"

case "${CMD}" in
  add)
    USER="$2"; PASS="$3"; VPN_IP="${4:-*}"
    CHAP_TMP=$(mktemp)
    grep -v "^\"${USER}\"" "${CHAP_FILE}" > "${CHAP_TMP}" 2>/dev/null || true
    mv "${CHAP_TMP}" "${CHAP_FILE}" 2>/dev/null || true
    echo "\"${USER}\" * \"${PASS}\" ${VPN_IP}" >> "${CHAP_FILE}"
    chmod 600 "${CHAP_FILE}"
    systemctl reload xl2tpd 2>/dev/null || systemctl restart xl2tpd 2>/dev/null || true
    echo "OK: peer ${USER} ditambahkan"
    ;;
  remove)
    USER="$2"
    CHAP_TMP=$(mktemp)
    grep -v "^\"${USER}\"" "${CHAP_FILE}" > "${CHAP_TMP}" 2>/dev/null || true
    mv "${CHAP_TMP}" "${CHAP_FILE}" 2>/dev/null || true
    chmod 600 "${CHAP_FILE}"
    systemctl reload xl2tpd 2>/dev/null || true
    echo "OK: peer ${USER} dihapus"
    ;;
  list)
    echo "=== L2TP NAS Peers ==="
    cat "${CHAP_FILE}" 2>/dev/null || echo "(kosong)"
    ;;
  *) echo "Usage: $0 add|remove|list"; exit 1 ;;
esac
PEEREOF
chmod +x /usr/local/bin/EugineBill-l2tp-peer
print_ok "Helper /usr/local/bin/EugineBill-l2tp-peer siap"

# ── Summary ────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║      Pure L2TP VPN Server (UltraVPN Standard) READY ✅   ║"
echo "╠══════════════════════════════════════════════════════════╣"
printf "║  Public IP   : %-41s ║\n" "${PUBLIC_IP}"
printf "║  VPS local IP: %-41s ║\n" "${L2TP_LOCAL_IP}"
printf "║  Pool        : %-41s ║\n" "${L2TP_POOL_START} – ${L2TP_POOL_END}"
printf "║  Port        : %-41s ║\n" "1701 / UDP"
printf "║  Mode        : %-41s ║\n" "Pure L2TP (use-ipsec=no)"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║  MikroTik setup (RouterOS 6.x & 7.x):                    ║"
echo "║  profile: ebvpn-remote (use-encryption=no)               ║"
echo "║  use-ipsec: no                                           ║"
echo "║  allow: chap,mschap2                                     ║"
echo "║  (Gunakan script 1-klik otomatis dari admin panel)       ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
