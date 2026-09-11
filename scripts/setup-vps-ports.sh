#!/bin/bash
# ==============================================================================
# EugineBill VPS Port & Firewall Setup Script
# Usage: sudo bash scripts/setup-vps-ports.sh
# Description: Configures UFW firewall rules for all EugineBill services:
#              Web (80, 443), WireGuard (51820/udp), FreeRADIUS (1812, 1813, 3799/udp),
#              and ONT Remote Proxy Range (24000:24999/tcp).
# ==============================================================================

set -e

COLOR_RESET="\033[0m"
COLOR_INFO="\033[36m"
COLOR_SUCCESS="\033[32m"
COLOR_WARN="\033[33m"

log_info() { echo -e "${COLOR_INFO}[INFO]${COLOR_RESET} $1"; }
log_success() { echo -e "${COLOR_SUCCESS}[SUCCESS]${COLOR_RESET} $1"; }
log_warn() { echo -e "${COLOR_WARN}[WARN]${COLOR_RESET} $1"; }

if [ "$EUID" -ne 0 ]; then
    echo "Skrip ini harus dijalankan dengan hak akses root (sudo)."
    exit 1
fi

log_info "Memeriksa status UFW firewall..."

if ! command -v ufw >/dev/null 2>&1; then
    log_info "Menginstal ufw..."
    apt-get update && apt-get install -y ufw
fi

# 1. SSH (Ensure we don't lock ourselves out)
log_info "Mengizinkan port SSH (22)..."
ufw allow 22/tcp comment "SSH Remote Access"

# 2. Web Portal (HTTP & HTTPS)
log_info "Mengizinkan port HTTP & HTTPS (80, 443)..."
ufw allow 80/tcp comment "HTTP Web Access"
ufw allow 443/tcp comment "HTTPS SSL Access"

# 3. Next.js Internal Port (opsional)
ufw allow 3000/tcp comment "Next.js Direct Port"

# 4. WireGuard VPN Server
log_info "Mengizinkan port WireGuard VPN Server (51820/udp)..."
ufw allow 51820/udp comment "WireGuard VPN Server"

# 5. FreeRADIUS Ports
log_info "Mengizinkan port FreeRADIUS (1812/udp, 1813/udp, 3799/udp)..."
ufw allow 1812/udp comment "FreeRADIUS Authentication"
ufw allow 1813/udp comment "FreeRADIUS Accounting"
ufw allow 3799/udp comment "RADIUS CoA / Disconnect"

# 6. Remote Winbox & MikroTik Service Forwarding Range (10001-10999)
log_info "Mengizinkan rentang port Remote Winbox & MikroTik Forwarding (10001:10999/tcp)..."
ufw allow 10001:10999/tcp comment "EugineBill Remote Winbox & MikroTik Forwarding"

# 7. ONT Remote Proxy Range (24000-24999)
log_info "Mengizinkan rentang port ONT Remote Proxy (24000:24999/tcp)..."
ufw allow 24000:24999/tcp comment "EugineBill ONT Remote Proxy Range"

# 8. GenieACS TR-069 (CWMP 7547 & File Server 7567)
log_info "Mengizinkan port GenieACS TR-069 (7547/tcp, 7567/tcp)..."
ufw allow 7547/tcp comment "GenieACS CWMP Listener"
ufw allow 7567/tcp comment "GenieACS File Server"

# 9. L2TP / IPSec VPN (500, 4500, 1701/udp)
log_info "Mengizinkan port L2TP/IPSec VPN (500/udp, 4500/udp, 1701/udp)..."
ufw allow 500/udp comment "IPSec IKE"
ufw allow 4500/udp comment "IPSec NAT-T"
ufw allow 1701/udp comment "L2TP Server"

# Enable UFW if not enabled
log_info "Mengaktifkan UFW firewall..."
ufw --force enable
ufw reload

log_success "Konfigurasi port firewall VPS EugineBill berhasil diterapkan!"
ufw status verbose
