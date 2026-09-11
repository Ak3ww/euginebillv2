#!/bin/bash
# ==============================================================================
# EugineBill Safe Git Patch & Update Script
# Usage: sudo bash scripts/safe-update.sh
# Description: Safely fetches updates from git repo, runs database backup,
#              synchronizes schema without data loss, builds Next.js, and reloads PM2.
# ==============================================================================

set -e

COLOR_RESET="\033[0m"
COLOR_INFO="\033[36m"
COLOR_SUCCESS="\033[32m"
COLOR_WARN="\033[33m"
COLOR_ERROR="\033[31m"

log_info() {
    echo -e "${COLOR_INFO}[INFO]${COLOR_RESET} $1"
}

log_success() {
    echo -e "${COLOR_SUCCESS}[SUCCESS]${COLOR_RESET} $1"
}

log_warn() {
    echo -e "${COLOR_WARN}[WARN]${COLOR_RESET} $1"
}

log_error() {
    echo -e "${COLOR_ERROR}[ERROR]${COLOR_RESET} $1"
}

# 1. Directory & Permission Verification
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${PROJECT_DIR}"

log_info "Memulai proses pembaruan aman EugineBill di: ${PROJECT_DIR}"

if [ ! -f ".env" ]; then
    log_error "File .env tidak ditemukan di ${PROJECT_DIR}! Pembaruan dihentikan."
    exit 1
fi

# 2. Database Backup Prior to Update
BACKUP_DIR="/var/backups/euginebill"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
mkdir -p "${BACKUP_DIR}"

# Extract DB connection info from .env
DB_URL=$(grep "^DATABASE_URL=" .env | cut -d '=' -f2- | tr -d '"' | tr -d "'")
if [ -n "${DB_URL}" ]; then
    log_info "Membuat snapshot backup database sebelum update..."
    # Format: mysql://user:pass@host:port/dbname
    DB_USER=$(echo "${DB_URL}" | sed -e 's/.*:\/\///' -e 's/:.*//')
    DB_PASS=$(echo "${DB_URL}" | sed -e 's/.*:\/\/[^:]*://' -e 's/@.*//')
    DB_HOST=$(echo "${DB_URL}" | sed -e 's/.*@//' -e 's/:.*//' -e 's/\/.*//')
    DB_PORT=$(echo "${DB_URL}" | grep -o ':[0-9]\+/' | tr -d ':/' || echo "3306")
    DB_NAME=$(echo "${DB_URL}" | sed -e 's/.*\///' -e 's/?.*//')

    DB_PORT=${DB_PORT:-3306}

    BACKUP_FILE="${BACKUP_DIR}/backup_${DB_NAME}_${TIMESTAMP}.sql.gz"
    if mysqldump -h "${DB_HOST}" -P "${DB_PORT}" -u "${DB_USER}" -p"${DB_PASS}" "${DB_NAME}" 2>/dev/null | gzip > "${BACKUP_FILE}"; then
        log_success "Backup database berhasil disimpan: ${BACKUP_FILE}"
    else
        log_warn "Gagal dump database via URL parsial, melanjutkan tanpa henti..."
    fi
fi

# Backup current .env
cp .env "${BACKUP_DIR}/env_backup_${TIMESTAMP}"
log_info "Salinan .env dicadangkan ke: ${BACKUP_DIR}/env_backup_${TIMESTAMP}"

# 3. Safe Git Pull
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
log_info "Mengambil update terbaru dari branch: ${CURRENT_BRANCH}"

# Stash any local temporary changes if exist
git stash save "auto-stash-before-update-${TIMESTAMP}" >/dev/null 2>&1 || true

git pull origin "${CURRENT_BRANCH}"
log_success "Kode terbaru berhasil diunduh dari repository."

# 4. Dependency Installation
log_info "Memeriksa dan memperbarui dependensi npm..."
npm install --no-audit --prefer-offline

# 5. Database Schema Synchronization
log_info "Sinkronisasi skema Prisma ke database..."
npx prisma generate
npx prisma db push --skip-generate

# 6. Production Build
log_info "Membangun Next.js production build..."
npm run build
log_success "Build Next.js berhasil diselesaikan."

# 7. Graceful PM2 Reload
log_info "Memuat ulang proses PM2..."

RELOADED=0
for APP_NAME in "EugineBill-radius" "EugineBill-wa" "EugineBill-cron"; do
    if pm2 describe "${APP_NAME}" > /dev/null 2>&1; then
        pm2 reload "${APP_NAME}" --update-env
        log_success "Proses PM2 [${APP_NAME}] berhasil dimuat ulang."
        RELOADED=1
    fi
done

if [ ${RELOADED} -eq 0 ]; then
    log_warn "Tidak ada proses PM2 standar yang sedang berjalan. Anda dapat menjalankan: pm2 start ecosystem.config.js"
else
    pm2 save > /dev/null 2>&1 || true
fi

log_success "Pembaruan EugineBill selesai tanpa kesalahan!"
log_info "Waktu selesai: $(date)"
