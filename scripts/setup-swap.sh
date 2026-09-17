#!/bin/bash
# ==============================================================================
# EugineBill VPS Optimization — Automated Swap Memory Setup
# Usage: sudo bash scripts/setup-swap.sh
# 
# Description:
#   Sets up and optimizes permanent Swap Memory (2GB - 4GB) on Ubuntu/Debian VPS.
#   Prevents system freezes, CPU deadlocks, and Out-Of-Memory (OOM) killer crashes
#   during heavy operations like 'npm run build', Next.js bundling, and MySQL spikes.
# ==============================================================================

set -euo pipefail

COLOR_RESET="\033[0m"
COLOR_INFO="\033[36m"
COLOR_SUCCESS="\033[32m"
COLOR_WARN="\033[33m"
COLOR_ERROR="\033[31m"
COLOR_BOLD="\033[1m"

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

echo -e "${COLOR_BOLD}${COLOR_INFO}"
echo "================================================================="
echo "        EugineBill VPS — Pengaturan Swap Memory Otomatis         "
echo "================================================================="
echo -e "${COLOR_RESET}"

# 1. Pastikan dijalankan sebagai root
if [ "$EUID" -ne 0 ]; then
    log_error "Skrip ini wajib dijalankan dengan hak akses root. Gunakan: sudo bash $0"
    exit 1
fi

# 2. Cek RAM fisik dan Swap yang ada saat ini
TOTAL_RAM_MB=$(free -m | awk '/^Mem:/ {print $2}')
CURRENT_SWAP_MB=$(free -m | awk '/^Swap:/ {print $2}')
FREE_DISK_MB=$(df -m / | awk 'NR==2 {print $4}')

log_info "Total RAM Fisik : ${TOTAL_RAM_MB} MB"
log_info "Swap Aktif      : ${CURRENT_SWAP_MB} MB"
log_info "Sisa Ruang Disk : ${FREE_DISK_MB} MB"

# 3. Tentukan apakah swap sudah memadai (minimal 2048 MB)
if [ "${CURRENT_SWAP_MB}" -ge 2048 ]; then
    log_success "Swap Memory sudah memadai (${CURRENT_SWAP_MB} MB >= 2048 MB)."
    
    # Tetap optimalkan swappiness
    sysctl vm.swappiness=10 >/dev/null 2>&1 || true
    sysctl vm.vfs_cache_pressure=50 >/dev/null 2>&1 || true
    cat > /etc/sysctl.d/99-swap-optimization.conf << 'EOF'
vm.swappiness=10
vm.vfs_cache_pressure=50
EOF
    log_success "Kernel swappiness dioptimalkan ke nilai 10 (prioritas RAM, swap saat darurat)."
    exit 0
fi

# 4. Tentukan ukuran swap yang akan dibuat berdasarkan kapasitas disk
# Jika disk >= 10GB: buat 4GB swap
# Jika disk >= 5GB : buat 2GB swap
# Jika disk >= 2GB : buat 1GB swap
TARGET_GB=2
if [ "${FREE_DISK_MB}" -ge 10000 ]; then
    TARGET_GB=4
elif [ "${FREE_DISK_MB}" -ge 5000 ]; then
    TARGET_GB=2
elif [ "${FREE_DISK_MB}" -ge 2000 ]; then
    TARGET_GB=1
else
    log_warn "Sisa ruang disk sangat sedikit (${FREE_DISK_MB} MB). Mencoba alokasi 1GB swap..."
    TARGET_GB=1
fi

SWAPFILE="/swapfile"

# 5. Nonaktifkan swap lama jika ada swapfile yang aktif tetapi kekecilan
if swapon --show | grep -q "${SWAPFILE}"; then
    log_info "Menonaktifkan swap lama untuk penyesuaian ukuran..."
    swapoff "${SWAPFILE}" 2>/dev/null || true
fi

# 6. Alokasikan file swap
log_info "Membuat swap file berukuran ${TARGET_GB}GB pada ${SWAPFILE}..."
rm -f "${SWAPFILE}"

if ! fallocate -l "${TARGET_GB}G" "${SWAPFILE}" 2>/dev/null; then
    log_info "fallocate tidak didukung, menggunakan 'dd' untuk mengalokasikan file swap..."
    dd if=/dev/zero of="${SWAPFILE}" bs=1M count=$((TARGET_GB * 1024)) status=progress
fi

chmod 600 "${SWAPFILE}"
mkswap "${SWAPFILE}" >/dev/null
swapon "${SWAPFILE}"
log_success "Swap file ${TARGET_GB}GB berhasil diaktifkan."

# 7. Daftarkan di /etc/fstab agar persisten saat VPS reboot
if ! grep -q "${SWAPFILE}" /etc/fstab; then
    echo "${SWAPFILE} none swap sw 0 0" >> /etc/fstab
    log_success "Swap file ditambahkan ke /etc/fstab (aktif permanen saat reboot)."
fi

# 8. Optimasi Parameter Kernel (swappiness & vfs_cache_pressure)
# Default Ubuntu swappiness = 60 (terlalu agresif).
# Nilai 10 menjamin RAM fisik dipakai penuh terlebih dahulu, swap hanya dipakai ketika dibutuhkan.
sysctl vm.swappiness=10 >/dev/null 2>&1 || true
sysctl vm.vfs_cache_pressure=50 >/dev/null 2>&1 || true

cat > /etc/sysctl.d/99-swap-optimization.conf << 'EOF'
vm.swappiness=10
vm.vfs_cache_pressure=50
EOF
log_success "Konfigurasi vm.swappiness=10 dan vm.vfs_cache_pressure=50 berhasil disimpan."

# 9. Verifikasi Status Akhir
FINAL_SWAP_MB=$(free -m | awk '/^Swap:/ {print $2}')
echo ""
echo -e "${COLOR_SUCCESS}${COLOR_BOLD}"
echo "================================================================="
echo "             SWAP MEMORY BERHASIL DIKONFIGURASI!                 "
echo "================================================================="
echo -e "${COLOR_RESET}"
echo -e "Status Memori Saat Ini:"
free -h
echo ""
echo -e "${COLOR_SUCCESS}Kini VPS Anda memiliki virtual memory cadangan ${FINAL_SWAP_MB} MB.${COLOR_RESET}"
echo -e "${COLOR_INFO}Proses 'npm run build' dan Next.js compilation dijamin lancar tanpa freeze/hang.${COLOR_RESET}"
echo "================================================================="
