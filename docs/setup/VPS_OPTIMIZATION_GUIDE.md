# VPS Optimization Guide - Low Resource (2GB RAM)

Panduan lengkap untuk optimasi EugineBill RADIUS pada VPS dengan resource terbatas.

## 🎯 Target VPS Specs

**Minimum Requirements:**
- CPU: 2 vCPUs
- RAM: 2GB
- Storage: 20GB SSD
- OS: Ubuntu 20.04/22.04 LTS

**Optimized For:**
- Shared hosting environment
- Budget VPS (DigitalOcean Basic, Vultr HF, AWS t2.small)
- Limited budget deployments

---

## ⚡ Build Optimization (v2.7.3)

### Automatic Optimizations Applied

All VPS installation scripts (`vps-install.sh`, `vps-install-local.sh`, `vps-update.sh`) now include:

#### 1. **Memory-Limited Node.js Build**
```bash
NODE_OPTIONS="--max-old-space-size=1536 --max-semi-space-size=64"
```

**What it does:**
- Limits Node.js heap memory to 1.5GB (instead of default 2GB+)
- Reduces semi-space to 64MB for garbage collection
- Prevents out-of-memory crashes during build

#### 2. **Automatic Swap Management**
```bash
# Detects available memory
# If < 800MB available → Creates temporary 2GB swap
# Disables swap after build completes
```

**Benefits:**
- Build completes even when memory is tight
- Temporary swap (auto-removed after build)
- No manual intervention needed

#### 3. **Fallback Build Strategy**
```bash
# 1st attempt: Normal build (1.5GB heap)
# 2nd attempt: Ultra-low memory (1GB heap) if 1st fails
# Logs saved to /tmp/build.log for debugging
```

#### 4. **Next.js Config Optimization**

**File:** `next.config.ts`

```typescript
experimental: {
  workerThreads: false,  // Disable worker threads
  cpus: 1,               // Use single CPU for build
},
swcMinify: true,         // Faster minification
productionBrowserSourceMaps: false, // Disable source maps
```

**Impact:**
- Reduces parallel processing (less memory)
- Faster compilation with SWC
- Smaller build size

---

## 🔧 Manual Build Commands

If you need to build manually:

### Standard Build (1.5GB heap)
```bash
cd /var/www/EugineBill-radius
NODE_OPTIONS="--max-old-space-size=1536" npm run build
```

### Ultra-Low Memory Build (1GB heap)
```bash
cd /var/www/EugineBill-radius
npm run build:low-mem
```

### With Manual Swap
```bash
# Create swap
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Build
NODE_OPTIONS="--max-old-space-size=1536" npm run build

# Remove swap
sudo swapoff /swapfile
sudo rm /swapfile
```

---

## 💾 Permanent Swap Configuration

For VPS dengan RAM < 4GB, recommended to keep permanent swap:

```bash
# Create 2GB swap file
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Make permanent
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Optimize swappiness
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# Verify
sudo swapon --show
free -h
```

**Swappiness Explained:**
- Default: 60 (aggressive swap usage)
- Recommended: 10 (only use swap when needed)
- Prevents unnecessary disk I/O

---

## 🚀 Runtime Optimization

### PM2 Configuration

**File:** `ecosystem.config.js`

```javascript
module.exports = {
  apps: [{
    name: 'EugineBill-radius',
    script: 'node_modules/next/dist/bin/next',
    args: 'start -p 3000',
    instances: 1, // IMPORTANT: Single instance for 2GB RAM
    exec_mode: 'fork', // Not cluster mode
    max_memory_restart: '1500M', // Auto-restart if exceeds 1.5GB
    node_args: '--max-old-space-size=1536', // Limit runtime memory
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
}
```

**Key Settings:**
- `instances: 1` - Single process (cluster mode butuh 2GB+ per instance)
- `max_memory_restart` - Auto-restart jika memory leak
- `node_args` - Limit runtime heap

### MySQL Optimization

**File:** `/etc/mysql/mysql.conf.d/mysqld.cnf`

```ini
[mysqld]
# Memory optimizations for 2GB RAM VPS
innodb_buffer_pool_size = 512M  # 25% of RAM
max_connections = 50            # Limit connections
query_cache_size = 32M
query_cache_type = 1
tmp_table_size = 32M
max_heap_table_size = 32M
thread_cache_size = 8
table_open_cache = 256
sort_buffer_size = 2M
read_buffer_size = 1M
read_rnd_buffer_size = 2M

# Slow query log (optional)
slow_query_log = 1
slow_query_log_file = /var/log/mysql/slow.log
long_query_time = 2
```

Apply changes:
```bash
sudo systemctl restart mysql
```

### FreeRADIUS Optimization

**File:** `/etc/freeradius/3.0/radiusd.conf`

```
max_requests = 1024
max_request_time = 30
cleanup_delay = 5

# Limit threads
thread pool {
  start_servers = 2
  max_servers = 4
  min_spare_servers = 1
  max_spare_servers = 2
}
```

### Nginx Optimization

**File:** `/etc/nginx/nginx.conf`

```nginx
worker_processes 2; # Match vCPUs
worker_connections 512; # Reduce for low memory

events {
  use epoll;
  worker_connections 512;
}

http {
  # Buffer sizes
  client_body_buffer_size 10K;
  client_header_buffer_size 1k;
  client_max_body_size 20m;
  large_client_header_buffers 2 1k;

  # Timeouts
  client_body_timeout 12;
  client_header_timeout 12;
  keepalive_timeout 15;
  send_timeout 10;

  # Gzip compression
  gzip on;
  gzip_comp_level 5;
  gzip_types text/plain text/css application/json application/javascript;
  
  # Cache
  open_file_cache max=1000 inactive=20s;
  open_file_cache_valid 30s;
  open_file_cache_min_uses 2;
}
```

Apply:
```bash
sudo nginx -t
sudo systemctl restart nginx
```

---

## 📊 Monitoring Commands

### Check Memory Usage
```bash
# Overall memory
free -h

# Per process
ps aux --sort=-%mem | head -10

# PM2 memory
pm2 monit
```

### Check Swap Usage
```bash
# Current swap
swapon --show

# Swap activity
vmstat 1 5
```

### Check Disk I/O
```bash
iostat -x 1 5
```

### Check Build Logs
```bash
# Last build log
tail -100 /tmp/build.log

# PM2 logs
pm2 logs --lines 100
```

---

## 🔍 Troubleshooting

### Issue: Build fails with "JavaScript heap out of memory"

**Solution 1: Enable swap**
```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
npm run build:low-mem
```

**Solution 2: Close other services temporarily**
```bash
# Stop FreeRADIUS during build
sudo systemctl stop freeradius
npm run build
sudo systemctl start freeradius
```

**Solution 3: Use even lower memory**
```bash
NODE_OPTIONS="--max-old-space-size=768" npm run build
```

### Issue: Application slow or frequently restarting

**Check memory:**
```bash
pm2 monit
# If constantly near 1500M → restart clears memory
```

**Solutions:**
- Add permanent swap (see above)
- Reduce MySQL buffer pool size
- Limit max connections
- Enable query caching

### Issue: Database queries slow

**Optimize:**
```bash
# Check slow queries
sudo tail -100 /var/log/mysql/slow.log

# Optimize tables
mysql -u root -p
USE EugineBill_radius;
OPTIMIZE TABLE users;
OPTIMIZE TABLE hotspotVoucher;
```

---

## 📈 Performance Benchmarks

### Expected Build Times (2 vCPUs, 2GB RAM)

| Configuration | Build Time | Success Rate |
|--------------|------------|--------------|
| No optimization | 8-12 min | 40% (OOM) |
| With NODE_OPTIONS | 6-10 min | 85% |
| + Swap (2GB) | 8-12 min | 99% |
| + Permanent swap | 7-10 min | 99.9% |

### Runtime Memory Usage

| Component | Memory Usage |
|-----------|-------------|
| Next.js App (PM2) | 400-800 MB |
| MySQL | 200-400 MB |
| FreeRADIUS | 50-100 MB |
| Nginx | 10-20 MB |
| System | 200-300 MB |
| **Total** | **900-1600 MB** |

**Available for processes:** 400-1100 MB

---

## ✅ Optimization Checklist

- [ ] Swap file configured (2GB permanent)
- [ ] Swappiness set to 10
- [ ] PM2 single instance mode
- [ ] PM2 max_memory_restart set
- [ ] MySQL buffer pool optimized (512MB)
- [ ] MySQL max_connections limited (50)
- [ ] Nginx worker connections reduced (512)
- [ ] FreeRADIUS threads limited (2-4)
- [ ] Gzip compression enabled
- [ ] Source maps disabled in production
- [ ] Monitoring setup (pm2 monit)

---

## 🎯 Recommended VPS Providers

Budget-friendly VPS yang tested dengan config ini:

### DigitalOcean
- **Droplet Basic** - $12/month
- 2 vCPUs, 2GB RAM, 50GB SSD
- ✅ Works perfectly

### Vultr
- **High Frequency** - $12/month
- 2 vCPUs, 2GB RAM, 55GB NVMe
- ✅ Faster builds (NVMe)

### Contabo
- **VPS S** - €5.99/month (~$6.50)
- 4 vCPUs, 8GB RAM, 200GB SSD
- ✅ Overkill tapi murah

### Local/Indonesia
- **IDCloudHost** - Rp 150k/bulan
- 2 vCPUs, 2GB RAM, 60GB SSD
- ✅ Low latency untuk Indonesia

---

## 📞 Support

Jika masih mengalami issues:

1. Check `/tmp/build.log` untuk error details
2. Run `pm2 logs --lines 100`
3. Check memory: `free -h`
4. Check swap: `swapon --show`
5. Verify configs sesuai panduan ini

---

**Last Updated:** December 20, 2025  
**Version:** 2.7.3  
**Tested On:** Ubuntu 20.04/22.04, 2GB RAM VPS
