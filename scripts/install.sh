#!/bin/bash
# ==============================================================================
# EugineBill All-in-One Automated VPS Installer
# Usage: sudo bash scripts/install.sh
# Or 1-line curl:
#   curl -fsSL https://raw.githubusercontent.com/Ak3ww/euginebillv2/main/scripts/install.sh | sudo bash
#
# Description:
#   Turnkey single-command deployment for fresh Ubuntu/Debian VPS (20.04/22.04/24.04).
#   Bundles:
#     - Node.js 20 LTS & PM2
#     - MySQL Server & database configuration
#     - Nginx Reverse Proxy (Port 80/443 -> Port 3000, WebSockets, 100M upload)
#     - FreeRADIUS 3.x + MySQL + MS-CHAPv2 OpenSSL MD4 Provider
#     - WireGuard VPN Server (10.200.0.1/24, UDP 51820)
#     - L2TP/IPSec VPN Server (10.201.0.1/24, IPSec PSK)
#     - Socat for ONT Remote Proxy (Ports 24000:24999) & Winbox Forwarding (10001:10999)
#     - Full UFW Firewall Rule Setup
#     - Persistent Storage (/var/data/EugineBill/uploads & baileys_auth)
#     - Automatic Next.js Build & 3-Service PM2 Daemon (Web + Cron + WhatsApp)
#     - Interactive First-Time Setup Wizard (/setup)
# ==============================================================================

set -e

COLOR_RESET="\033[0m"
COLOR_INFO="\033[36m"
COLOR_SUCCESS="\033[32m"
COLOR_WARN="\033[33m"
COLOR_ERROR="\033[31m"
COLOR_BOLD="\033[1m"

log_info() { echo -e "${COLOR_INFO}[INFO]${COLOR_RESET} $1"; }
log_success() { echo -e "${COLOR_SUCCESS}[OK]${COLOR_RESET} $1"; }
log_warn() { echo -e "${COLOR_WARN}[WARN]${COLOR_RESET} $1"; }
log_error() { echo -e "${COLOR_ERROR}[ERROR]${COLOR_RESET} $1"; }

# 1. Root Privilege Check
if [ "$EUID" -ne 0 ]; then
    log_error "Skrip ini harus dijalankan dengan hak akses root (sudo)."
    echo "Contoh: sudo bash scripts/install.sh"
    exit 1
fi

echo -e "${COLOR_INFO}${COLOR_BOLD}"
echo "================================================================="
echo "        EUGINEBILL ALL-IN-ONE AUTOMATED VPS INSTALLER            "
echo "        Turnkey Managed Single-Tenant ISP Appliance Setup        "
echo "================================================================="
echo -e "${COLOR_RESET}"

# 2. Path & Repository Resolution (Support 1-line curl execution)
INSTALL_DIR="/var/www/EugineBill-radius"

if [ ! -f "package.json" ]; then
    log_info "Menyiapkan direktori instalasi di ${INSTALL_DIR}..."
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -y -qq
    apt-get install -y -qq git curl
    mkdir -p /var/www
    if [ ! -d "${INSTALL_DIR}" ]; then
        log_info "Mengkloning repositori EugineBill dari GitHub..."
        git clone https://github.com/Ak3ww/euginebillv2.git "${INSTALL_DIR}"
    fi
    cd "${INSTALL_DIR}"
fi

PROJECT_DIR="$(pwd)"
log_info "Direktori project: ${PROJECT_DIR}"

# 3. Auto-Detect Public IP
DETECTED_IP=$(curl -s4 --max-time 3 ifconfig.me || curl -s4 --max-time 3 icanhazip.com || echo "127.0.0.1")
log_info "IP Publik terdeteksi: ${DETECTED_IP}"

echo ""
echo -e "${COLOR_BOLD}Konfigurasi Instalasi (Tekan ENTER untuk menggunakan nilai default):${COLOR_RESET}"

# Auto default or prompt (with 15s timeout for zero-touch auto installation)
read -t 15 -p "1. Domain atau IP Publik VPS [Default: ${DETECTED_IP}]: " INPUT_HOST || INPUT_HOST=""
echo ""
SERVER_HOST="${INPUT_HOST:-$DETECTED_IP}"

# Format APP_URL (Nginx reverse proxy listens on standard port 80/443)
if [[ "${SERVER_HOST}" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    DEFAULT_APP_URL="http://${SERVER_HOST}"
else
    DEFAULT_APP_URL="https://${SERVER_HOST}"
fi

read -t 15 -p "2. App URL untuk pelanggan [Default: ${DEFAULT_APP_URL}]: " INPUT_URL || INPUT_URL=""
echo ""
APP_URL="${INPUT_URL:-$DEFAULT_APP_URL}"

# Generate random secure DB password
GEN_DB_PASS=$(openssl rand -hex 12)
read -t 15 -p "3. Password Database MySQL [Default: ${GEN_DB_PASS}]: " INPUT_DB_PASS || INPUT_DB_PASS=""
echo ""
DB_PASS="${INPUT_DB_PASS:-$GEN_DB_PASS}"

echo ""
log_info "Memulai instalasi sistem secara otomatis..."

# 4. System Updates & Core Packages
log_info "Menginstal dependensi sistem lengkap (Nginx, MySQL, WireGuard, StrongSwan, FreeRADIUS, Socat)..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y \
    curl git ufw socat mysql-server wireguard wireguard-tools \
    gzip openssl build-essential nginx \
    strongswan strongswan-pki libcharon-extra-plugins xl2tpd ppp \
    freeradius freeradius-mysql freeradius-utils iptables iproute2

log_success "Dependensi sistem dasar terpasang."

# 5. Node.js 20 LTS Installation
if ! command -v node >/dev/null 2>&1 || [[ $(node -v) != v20* ]]; then
    log_info "Menginstal Node.js 20.x LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi
log_success "Node.js $(node -v) & npm $(npm -v) siap."

# 6. PM2 Global Installation
if ! command -v pm2 >/dev/null 2>&1; then
    log_info "Menginstal PM2 process manager..."
    npm install -g pm2
fi
log_success "PM2 siap."

# 7. Setup MySQL Database
log_info "Mengonfigurasi database MySQL 'euginebill'..."
systemctl start mysql || service mysql start
systemctl enable mysql || true

mysql -u root <<EOF
CREATE DATABASE IF NOT EXISTS euginebill CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'eugineuser'@'localhost' IDENTIFIED BY '${DB_PASS}';
ALTER USER 'eugineuser'@'localhost' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON euginebill.* TO 'eugineuser'@'localhost';
FLUSH PRIVILEGES;
EOF
log_success "Database 'euginebill' dan user 'eugineuser' berhasil dikonfigurasi."

# 8. Setup Persistent Storage
UPLOAD_DIR="/var/data/EugineBill/uploads"
BAILEYS_DIR="/var/data/EugineBill/baileys_auth"
log_info "Menyiapkan direktori penyimpanan persisten di: /var/data/EugineBill..."
mkdir -p "${UPLOAD_DIR}/receipts"
mkdir -p "${UPLOAD_DIR}/proofs"
mkdir -p "${UPLOAD_DIR}/logos"
mkdir -p "${UPLOAD_DIR}/customers"
mkdir -p "${BAILEYS_DIR}"
mkdir -p "${PROJECT_DIR}/logs"
chmod -R 775 /var/data/EugineBill
log_success "Direktori penyimpanan persisten siap."

# 9. Generate Secret Keys & Write .env
log_info "Menghasilkan kunci keamanan enkripsi dan menulis file .env..."
NEXTAUTH_SEC=$(openssl rand -base64 32)
AGENT_JWT_SEC=$(openssl rand -base64 32)
TECH_JWT_SEC=$(openssl rand -base64 32)
ENC_KEY=$(openssl rand -hex 16)

cat > .env <<EOF
# Auto-generated by EugineBill Installer on $(date)
DATABASE_URL="mysql://eugineuser:${DB_PASS}@localhost:3306/euginebill?connection_limit=10&pool_timeout=20"

TZ="Asia/Jakarta"
NEXT_PUBLIC_TIMEZONE="Asia/Jakarta"

NEXT_PUBLIC_APP_NAME="EugineBill"
NEXT_PUBLIC_APP_URL="${APP_URL}"

VPS_PUBLIC_IP="${SERVER_HOST}"
RADIUS_SERVER_IP="${SERVER_HOST}"

UPLOAD_DIR="${UPLOAD_DIR}"

NEXTAUTH_SECRET="${NEXTAUTH_SEC}"
NEXTAUTH_URL="${APP_URL}"
AGENT_JWT_SECRET="${AGENT_JWT_SEC}"
TECHNICIAN_JWT_SECRET="${TECH_JWT_SEC}"
ENCRYPTION_KEY="${ENC_KEY}"
EOF
log_success "File .env berhasil dibuat dengan kunci keamanan unik."

# 10. Install NPM Dependencies & Sync Schema
log_info "Menginstal modul npm dan sinkronisasi skema database..."
npm install --prefer-offline --no-audit
npx prisma generate
npx prisma db push --skip-generate
log_success "Skema database berhasil disinkronkan ke MySQL."

# 11. Configure Nginx Reverse Proxy
log_info "Mengonfigurasi Nginx Reverse Proxy (Port 80 -> Port 3000)..."
cat > /etc/nginx/sites-available/euginebill <<EOF
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    client_max_body_size 100M;

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript;

    # Static assets long caching
    location /_next/static/ {
        alias ${PROJECT_DIR}/.next/static/;
        expires 365d;
        access_log off;
    }

    # Reverse proxy to Next.js on port 3000
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;

        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }
}
EOF

rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/euginebill /etc/nginx/sites-enabled/euginebill
nginx -t && systemctl restart nginx && systemctl enable nginx
log_success "Nginx Reverse Proxy aktif."

# 12. Configure WireGuard VPN Server (RouterOS 7.x)
log_info "Mengonfigurasi WireGuard VPN Server (Subnet 10.200.0.0/24)..."
if [ -f "vps-install/install-wg-server.sh" ]; then
    bash vps-install/install-wg-server.sh --subnet 10.200.0.0/24 --port 51820
    log_success "WireGuard VPN Server aktif pada 10.200.0.1:51820."
fi

# 13. Configure L2TP/IPSec VPN Server (RouterOS 6.x)
log_info "Mengonfigurasi L2TP/IPSec VPN Server (Subnet 10.201.0.0/24)..."
if [ -f "vps-install/install-l2tp-server.sh" ]; then
    bash vps-install/install-l2tp-server.sh --subnet 10.201.0.0/24
    log_success "L2TP/IPSec VPN Server aktif pada 10.201.0.1."
fi

# 14. Configure FreeRADIUS 3.x with MySQL & OpenSSL MD4 Provider
log_info "Mengonfigurasi FreeRADIUS 3.x dengan MySQL modul..."
FR_DIR="/etc/freeradius/3.0"
if [ ! -d "${FR_DIR}" ] && [ -d "/etc/freeradius" ]; then
    FR_DIR="/etc/freeradius"
fi

# Configure SQL module
if [ -d "${FR_DIR}/mods-available" ]; then
    cat > "${FR_DIR}/mods-available/sql" <<EOF
sql {
    driver = "rlm_sql_mysql"
    dialect = "mysql"
    server = "localhost"
    port = 3306
    login = "eugineuser"
    password = "${DB_PASS}"
    radius_db = "euginebill"

    acct_table1 = "radacct"
    acct_table2 = "radacct"
    postauth_table = "radpostauth"
    authcheck_table = "radcheck"
    groupcheck_table = "radgroupcheck"
    authreply_table = "radreply"
    groupreply_table = "radgroupreply"
    usergroup_table = "radusergroup"
    group_attribute = "SQL-Group"

    read_clients = no
    client_table = "nas"

    pool {
        start = 5
        min = 4
        max = 10
        spare = 3
        uses = 0
        retry_delay = 30
        lifetime = 0
        idle_timeout = 60
    }

    \$INCLUDE \${modconfdir}/\${.:name}/main/\${dialect}/queries.conf
}
EOF
    ln -sf "${FR_DIR}/mods-available/sql" "${FR_DIR}/mods-enabled/sql"

    # Clients directory
    mkdir -p "${FR_DIR}/clients.d"
    touch "${FR_DIR}/clients.d/nas-from-db.conf"
    if ! grep -q 'INCLUDE clients.d/' "${FR_DIR}/clients.conf"; then
        echo '$INCLUDE clients.d/' >> "${FR_DIR}/clients.conf"
    fi

    # Configure OpenSSL legacy provider for MS-CHAPv2 / MD4 on Ubuntu 22+
    if [ -f "/etc/ssl/openssl.cnf" ] && ! grep -q 'legacy_sect' /etc/ssl/openssl.cnf; then
        sed -i 's/^\[openssl_init\]/[openssl_init]\nproviders = provider_sect/' /etc/ssl/openssl.cnf 2>/dev/null || true
        cat >> /etc/ssl/openssl.cnf <<'OPENSSL_EOF'

[provider_sect]
default = default_sect
legacy = legacy_sect

[default_sect]
activate = 1

[legacy_sect]
activate = 1
OPENSSL_EOF
    fi

    chown -R freerad:freerad "${FR_DIR}" 2>/dev/null || true
    systemctl restart freeradius 2>/dev/null || true
    systemctl enable freeradius 2>/dev/null || true
    log_success "FreeRADIUS 3.x terhubung ke database 'euginebill'."
fi

# 15. Configure All Firewall Ports
if [ -f "scripts/setup-vps-ports.sh" ]; then
    log_info "Menerapkan konfigurasi firewall UFW untuk seluruh port..."
    bash scripts/setup-vps-ports.sh
fi

# 16. Build Production
log_info "Membangun Next.js production build..."
npm run build
log_success "Build aplikasi selesai."

# 17. Start PM2 Ecosystem Services (Web + WA + Cron)
log_info "Menjalankan seluruh layanan EugineBill dengan PM2..."
export APP_DIR="${PROJECT_DIR}"
pm2 delete all >/dev/null 2>&1 || true
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true
log_success "Layanan PM2 berjalan: EugineBill-radius, EugineBill-wa, EugineBill-cron."

# 18. Read WireGuard & L2TP Info if available
WG_INFO="Interface wg0 (10.200.0.1/24) on Port 51820/UDP"
L2TP_INFO="xl2tpd (10.201.0.1/24) with IPSec PSK"
if [ -f "/etc/EugineBill/l2tp/ipsec.psk" ]; then
    L2TP_PSK_VAL="$(cat /etc/EugineBill/l2tp/ipsec.psk)"
    L2TP_INFO="Subnet: 10.201.0.0/24 (Gateway: 10.201.0.1) | PSK: ${L2TP_PSK_VAL}"
fi

# 19. Finished Banner
echo ""
echo -e "${COLOR_SUCCESS}${COLOR_BOLD}"
echo "================================================================="
echo "             INSTALASI EUGINEBILL BERHASIL SELESAI!              "
echo "             Turnkey Managed VPS Siap Digunakan                  "
echo "================================================================="
echo -e "${COLOR_RESET}"
echo -e "Layanan yang telah aktif dan berjalan di VPS ini:"
echo -e "  - Web Portal (Nginx Reverse Proxy) : Port 80 & 443"
echo -e "  - FreeRADIUS Server                : Port 1812, 1813, 3799/UDP"
echo -e "  - WireGuard VPN Server (RouterOS 7): ${WG_INFO}"
echo -e "  - L2TP/IPSec VPN Server (RouterOS 6): ${L2TP_INFO}"
echo -e "  - Remote ONT Proxy Range           : Port 24000 - 24999/TCP"
echo -e "  - Remote Winbox Forwarding Range   : Port 10001 - 10999/TCP"
echo -e "  - WhatsApp Baileys & Cron Service  : Managed via PM2"
echo ""
echo -e "Kredensial Database MySQL:"
echo -e "  Database : ${COLOR_BOLD}euginebill${COLOR_RESET}"
echo -e "  User     : ${COLOR_BOLD}eugineuser${COLOR_RESET}"
echo -e "  Password : ${COLOR_BOLD}${DB_PASS}${COLOR_RESET}"
echo ""
echo -e "Langkah Selanjutnya: Buka browser Anda untuk Setup Wizard:"
echo -e "👉 ${COLOR_BOLD}${COLOR_INFO}${APP_URL}/setup${COLOR_RESET}"
echo ""
echo -e "${COLOR_SUCCESS}Di halaman /setup, Anda tinggal mengisi Nama ISP dan membuat akun Super Admin.${COLOR_RESET}"
echo "================================================================="
