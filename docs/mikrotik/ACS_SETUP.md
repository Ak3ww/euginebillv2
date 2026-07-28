# Panduan Setup TR-069 ACS di MikroTik

## Gambaran Umum

Dokumen ini menjelaskan cara mengkonfigurasi MikroTik agar ONT/ONU pelanggan bisa terhubung ke **Built-in ACS EugineBill** via protokol TR-069/CWMP.

**ACS URL:** `http://[IP_VPS]:3000/api/cwmp`  
(atau via Nginx reverse proxy: `http://domain-anda.com/api/cwmp`)

---

## Bagian 1: Setup DHCP Option 43 (ACS URL via DHCP)

DHCP Option 43 memungkinkan MikroTik menyisipkan ACS URL langsung ke dalam lease DHCP, sehingga ONT yang belum dikonfigurasi pun bisa otomatis menemukan ACS.

> **Catatan:** Tidak semua ONT/modem mendukung DHCP Option 43 untuk TR-069. ONT ZTE umumnya mendukung. Jika tidak, konfigurasi ACS URL manual di web interface ONT atau lewat Telnet/SSH ke ONT.

### 1.1 Buat DHCP Option untuk ACS URL

```routeros
# Di terminal MikroTik (WinBox: New Terminal atau SSH):

/ip dhcp-server option
add code=43 name=tr069-acs-url value="'http://[IP_VPS]:3000/api/cwmp'"
```

Ganti `[IP_VPS]` dengan IP publik VPS Anda.

### 1.2 Buat Option Set

```routeros
/ip dhcp-server option sets
add name=ont-options options=tr069-acs-url
```

### 1.3 Terapkan ke DHCP Server yang Melayani ONT

```routeros
# Lihat daftar DHCP Server dulu:
/ip dhcp-server print

# Terapkan option set ke DHCP server yang melayani subnet ONT:
/ip dhcp-server
set [find name=<nama-dhcp-server-anda>] dhcp-option-set=ont-options
```

### 1.4 Verifikasi

```routeros
/ip dhcp-server print detail
# Pastikan dhcp-option-set=ont-options sudah terpasang
```

---

## Bagian 2: Verifikasi DHCP Lease ONT

Cek lease yang masuk dari ONT pelanggan:

```routeros
/ip dhcp-server lease print

# Filter hanya lease aktif:
/ip dhcp-server lease print where status=bound

# Cari berdasarkan IP atau MAC:
/ip dhcp-server lease print where address=192.168.x.x
```

Output yang diharapkan:
```
# ADDRESS         MAC-ADDRESS       HOST-NAME        STATUS
0 192.168.1.100  AA:BB:CC:DD:EE:FF ZTE-ONT-ABCDEF   bound
```

Setelah ONT mendapat lease DHCP, dia akan mencoba konek ke ACS URL dalam beberapa menit.

---

## Bagian 3: DHCP Lease Sync ke ACS (Kandidat Perangkat Baru)

Sistem ACS EugineBill dapat menarik daftar DHCP lease dari MikroTik secara otomatis (setiap 2 menit via cron) untuk mendeteksi ONT baru yang belum Inform.

Setup ini menggunakan RouterOS API yang sudah terkonfigurasi di admin panel EugineBill (**Admin → Network → Routers**).

Pastikan router MikroTik sudah terdaftar di EugineBill dengan:
- IP Address yang benar
- Username & Password MikroTik
- API Port: 8728 (default)

---

## Bagian 4: Konfigurasi ONT ZTE Manual (jika DHCP Option 43 tidak bekerja)

Jika ONT tidak mengambil ACS URL dari DHCP, konfigurasi manual:

### 4.1 Via Web Interface ONT

1. Akses web ONT: `http://192.168.1.1` (atau IP gateway LAN)
2. Login (default: `admin/admin` atau `user/user`)
3. Masuk ke: **Administration → TR-069 Client** atau **Management → ACS**
4. Isi:
   - **ACS URL:** `http://[IP_VPS]:3000/api/cwmp`
   - **ACS Username:** (kosongkan)
   - **ACS Password:** (kosongkan)
   - **Periodic Inform Enable:** ✅ Centang
   - **Periodic Inform Interval:** `300` (detik = 5 menit)
5. Klik **Save / Apply**

### 4.2 Via Telnet ke ONT ZTE

```bash
# Dari laptop/VPS yang terhubung ke jaringan ONT:
telnet 192.168.1.1

# Login dengan admin/admin

# Set ACS URL:
sendcmd 1 DB set ACSServer 0 URL http://[IP_VPS]:3000/api/cwmp

# Set periodic inform interval (300 detik):
sendcmd 1 DB set ManagementServer 0 PeriodicInformInterval 300
sendcmd 1 DB set ManagementServer 0 PeriodicInformEnable 1

# Simpan dan reboot:
sendcmd 1 DB save
sendcmd 1 RCM reboot
```

---

## Bagian 5: Troubleshooting

### 5.1 ONT Tidak Muncul di ACS

**Langkah diagnosis:**

1. **Cek apakah ONT sudah dapat DHCP lease:**
   ```routeros
   /ip dhcp-server lease print where address=[IP-ONT]
   ```

2. **Cek apakah ada koneksi ke port ACS dari IP ONT (di VPS):**
   ```bash
   # Di VPS:
   sudo netstat -tnp | grep :3000
   # atau
   sudo ss -tnp | grep :3000
   
   # Cek access log Nginx (jika pakai Nginx):
   sudo tail -f /var/log/nginx/access.log | grep cwmp
   ```

3. **Cek CWMP debug log di VPS:**
   ```bash
   # Log CWMP masuk dari device:
   pm2 logs EugineBill-radius --lines 50 | grep CWMP
   
   # Atau cek file debug (legacy):
   cat /var/www/EugineBill-radius/cwmp-debug.log | tail -50
   ```

4. **Pastikan firewall VPS mengizinkan koneksi dari subnet ONT:**
   ```bash
   # Di VPS (Ubuntu/Debian):
   sudo ufw allow from [subnet-ont]/24 to any port 3000
   # Contoh: sudo ufw allow from 192.168.1.0/24 to any port 3000
   ```

### 5.2 ONT Muncul tapi Status Selalu Offline

- Cek apakah `PeriodicInformInterval` sudah 300 (akan otomatis diset oleh ACS pada Inform pertama)
- Jika interval masih 1800 (30 menit), status akan sering offline karena ACS mendeteksi offline setelah 12 menit

```routeros
# Verifikasi dari MikroTik apakah ONT aktif di jaringan:
/ping [IP-ONT]
```

### 5.3 SSID Tidak Muncul di ACS

ONT perlu mengirimkan GetParameterValues response. Pastikan task tidak stuck di status `pending`:
- Buka **Admin → ACS → [device] → Riwayat Task**
- Jika ada task `GetParameterValues` stuck di `pending`, klik **Tarik Semua Data** untuk re-queue

### 5.4 Connection Request Gagal

Connection Request hanya bisa berhasil jika VPS dapat reach IP private ONT. Biasanya ini **tidak memungkinkan** karena NAT.

**Solusi:** Percepat interval Inform ke 5 menit (300 detik) — otomatis dilakukan ACS setelah Inform pertama.

---

## Bagian 6: Konfigurasi OLT (GPON)

### OLT HSGQ (Sudah Dikonfigurasi ✅)

- TR-069 ACS URL sudah aktif
- ONT langsung Inform ke ACS setelah mendapat DHCP lease

### OLT VSOL GS & GT (Belum Dikonfigurasi ❌)

**Yang perlu dilakukan di OLT VSOL:**

1. Masuk ke web interface OLT VSOL
2. Pergi ke: **GPON Management → ONT Management → TR-069 Profile** (atau OMCI TR-069 Config)
3. Buat TR-069 Profile baru:
   - **Profile Name:** `EugineBill-ACS`
   - **ACS URL:** `http://[IP_VPS]:3000/api/cwmp`
   - **Periodic Inform:** Enable
   - **Inform Interval:** 300
4. Terapkan profile ke semua ONT yang terhubung ke OLT ini
5. Pastikan VLAN untuk management ONT sudah dikonfigurasi agar ONT bisa reach VPS

**Catatan VSOL VLAN:**
- ONT perlu mendapat akses ke internet (atau minimal ke IP VPS) lewat WAN VLAN
- Biasanya TR-069 jalan di VLAN management yang terpisah dari VLAN data pelanggan
- Setup VLAN di VSOL: **VLAN → VLAN Configuration → Add VLAN [ID] → Assign to PON port**

---

## Bagian 7: Ringkasan Flow Lengkap

```
[ONT Power On]
    ↓
[DHCP Request → MikroTik DHCP Server]
    ↓
[Dapat IP + Option 43 (ACS URL)]
    ↓ ~30 detik – 2 menit
[ONT TR-069 Client → POST /api/cwmp → VPS]
    ↓ (Inform message)
[ACS: upsertDevice → auto-queue GetParameterValues]
    ↓ (Inform response 200 OK)
[ONT empty POST → ACS kirim GetParameterValues task]
    ↓ (GetParameterValuesResponse)
[ACS: simpan SSID, RxPower, PPPoE username, Connected Devices]
[ACS: auto-link ke pppoeUser jika username cocok]
[ACS: auto-set PeriodicInformInterval = 300s jika > 300s]
    ↓
[Device muncul di /admin/acs dengan data lengkap ✅]
```

---

## Referensi

- TR-069 Standard (BBF): https://www.broadband-forum.org/technical/download/TR-069.pdf
- ZTE ONT TR-069 Configuration Guide (internal)
- [MikroTik DHCP Option Sets](https://wiki.mikrotik.com/wiki/Manual:IP/DHCP_Server)
