# Panduan Lengkap Konfigurasi Hotspot MikroTik (VLAN 10, Dual-Storage Zero-Downtime, & EugineBill)

Dokumentasi ini merinci arsitektur jaringan, alokasi subnet IP standar, konfigurasi DNS captive portal, strategi fail-safe Zero-Downtime, langkah-langkah konfigurasi multi-router (Cibinong Site & Citeureup Site), serta integrasi dengan sistem billing EugineBill untuk layanan Hotspot Voucher.

---

## 1. Topologi & Arsitektur Jaringan Multi-Site

```text
       ┌────────────────────────────────────────────────────────┐
       │             EugineBill Billing & Database              │
       │    - Single Source of Truth (pppoeUser, hotspotVoucher)│
       │    - Dual-Storage Mirroring (Local MikroTik + RADIUS)  │
       └───────────────────────────┬────────────────────────────┘
                                   │ (VPN WireGuard / API Socket)
                    ┌──────────────┴──────────────┐
                    ▼                             ▼
        [MIKROTIK CIBINONG SITE]      [MIKROTIK CITEUREUP SITE]
           IP: 10.200.0.2                IP: 10.201.0.15
                    │                             │
               [bridge-LAN]                  [bridge-LAN]
                    ├── vlan10-hotspot            ├── vlan10-hotspot
                    │   VLAN ID: 10                   │   VLAN ID: 10
                    │   IP: 10.50.10.1/24             │   IP: 10.50.10.1/24
                    │   DNS: wifi.euginemediagroup.com│   DNS: wifi.euginemediagroup.com
                    │                             │
                    ▼ (Tagged Trunk)              ▼ (Tagged Trunk)
               [OLT Cibinong]                [OLT Citeureup]
                    │ (PON Fiber)                 │ (PON Fiber)
                    ▼                             ▼
          [Modem / ONT AP SK-D748S]     [Modem / ONT AP SK-D748S]
          Mode: IP_Bridged (VLAN 10)    Mode: IP_Bridged (VLAN 10)
          DHCP Passthrough: ON          DHCP Passthrough: ON
                    ▼                             ▼
              [Wi-Fi: SSID1/SSID5]          [Wi-Fi: SSID1/SSID5]
```

---

## 2. Standardisasi Subnet & VLAN Identik (Bebas Konflik)

Untuk mempermudah operasional lapangan, **VLAN dan Subnet diseragamkan 100% pada kedua site**:

| Parameter | Nilai | Keterangan |
| :--- | :--- | :--- |
| **Interface** | `vlan10-hotspot` | VLAN ID 10 di atas interface `bridge-LAN` |
| **Subnet IP** | `10.50.10.0/24` | Berlaku identik di Cibinong maupun Citeureup |
| **IP Gateway** | `10.50.10.1` | Netmask: `255.255.255.0` (`/24`) |
| **DHCP Pool** | `10.50.10.10 - 10.50.10.250` | Kapasitas 241 klien simultan per router |
| **DNS Name** | `wifi.euginemediagroup.com` | Domain captive portal otomatis redirect |
| **DNS Server** | `10.50.10.1`, `1.1.1.1`, `8.8.8.8` | DNS lokal resolver + upstream |
| **Lease Time** | `1h` (1 Jam) | Cepat mendaur ulang IP voucher non-aktif |

> [!IMPORTANT]
> **Keuntungan Subnet & VLAN Seragam**:
> Seluruh modem ONT pelanggan (SK-D748S, ZTE, Huawei) memiliki konfigurasi profil yang identik: **Port Binding Bridge ke VLAN 10**. Teknisi lapangan tidak perlu menghafal perbedaan subnet antar lokasi. Karena router terpisah secara fisik dan bridge domain, tidak ada konflik IP antar router.

---

## 3. Arsitektur Zero-Downtime (Dual-Storage Mirroring)

Sistem billing EugineBill menerapkan prinsip **Active-Active Dual-Storage Mirroring**:

1. **Database EugineBill sebagai Single Source of Truth**:
   - Data tersimpan aman di tabel `hotspotVoucher` dan `pppoeUser`.
2. **Mirroring Otomatis ke MikroTik**:
   - Setiap kali voucher dibuat, sistem **selalu menyuntikkannya ke `/ip/hotspot/user`** pada router target.
   - Jika toggle **RADIUS Hotspot** sedang **ON**, sistem juga menyuntikkannya ke database FreeRADIUS (`radcheck`, `radgroupreply`).
3. **Fail-Safe Built-in RouterOS**:
   - Pada RouterOS, jika `use-radius=yes` diaktifkan:
     1. RouterOS akan memverifikasi ke FreeRADIUS.
     2. Jika FreeRADIUS crash, mati, atau timeout 3 detik, **RouterOS otomatis mengecek database lokal (`/ip/hotspot/user`)**.
     3. Karena voucher sudah ter-mirror di lokal, login tetap berhasil tanpa downtime!
4. **Router-Scoped Authentication (Mencegah Voucher Melenceng)**:
   - Voucher dapat dikunci ke router tertentu (`MIKROTIK CIBINONG SITE` atau `MIKROTIK CITEUREUP SITE`).
   - Pada mode MikroTik: Voucher hanya ada di `/ip/hotspot/user` router tersebut.
   - Pada mode RADIUS: `radcheck` menyertakan check attribute `NAS-IP-Address == router.nasname`. Jika dicoba di site lain, RADIUS otomatis menolaknya.

---

## 4. Setup Script Generator di Web UI Billing

Admin tidak perlu mengetik konfigurasi manual di terminal MikroTik. Konfigurasi dapat digenerate dan diterapkan langsung dari Billing:

1. Buka menu **Admin Portal -> Jaringan -> Routers** (`/admin/network/routers`).
2. Klik tombol **Setup Hotspot** (ikon Wi-Fi hijau) pada router yang ingin dikonfigurasi.
3. Parameter default akan otomatis terisi (`VLAN 10`, `bridge-LAN`, `10.50.10.1/24`, `wifi.euginemediagroup.com`).
4. Klik **Terapkan Otomatis via API** untuk langsung mengeksekusi ke MikroTik, atau klik **Salin Script** (tersedia untuk RouterOS 6.x dan RouterOS 7.x).

---

## 5. Script Produksi RouterOS (Winbox Terminal Manual)

Jika ingin mengeksekusi langsung via terminal Winbox MikroTik:

```routeros
# ==============================================================================
# 1. INTERFACE VLAN HOTSPOT
# ==============================================================================
/interface vlan
add name=vlan10-hotspot vlan-id=10 interface=bridge-LAN comment="EugineBill Hotspot VLAN 10"

# ==============================================================================
# 2. IP ADDRESS GATEWAY
# ==============================================================================
/ip address
add address=10.50.10.1/24 network=10.50.10.0 interface=vlan10-hotspot comment="EugineBill Hotspot Gateway"

# ==============================================================================
# 3. IP POOL & DHCP SERVER
# ==============================================================================
/ip pool
add name=hs-pool-10 ranges=10.50.10.10-10.50.10.250 comment="EugineBill Hotspot Pool"

/ip dhcp-server network
add address=10.50.10.0/24 gateway=10.50.10.1 dns-server=10.50.10.1,1.1.1.1,8.8.8.8 domain=wifi.euginemediagroup.com comment="EugineBill Hotspot Network"

/ip dhcp-server
add name=dhcp-hs10 interface=vlan10-hotspot address-pool=hs-pool-10 lease-time=1h disabled=no comment="EugineBill Hotspot DHCP"

# ==============================================================================
# 4. HOTSPOT SERVER PROFILE (DENGAN DNS CAPTIVE PORTAL)
# ==============================================================================
/ip hotspot profile
add name=hsprof-10 hotspot-address=10.50.10.1 dns-name="wifi.euginemediagroup.com" html-directory=hotspot \
    login-by=http-chap,http-pap use-radius=yes radius-accounting=yes \
    radius-interim-update=received nas-port-type=wireless-802.11 comment="EugineBill Hotspot Profile"

# ==============================================================================
# 5. HOTSPOT SERVER INSTANCE
# ==============================================================================
/ip hotspot
add name=hotspot-vlan10 interface=vlan10-hotspot profile=hsprof-10 address-pool=hs-pool-10 disabled=no comment="EugineBill Hotspot Server"

# ==============================================================================
# 6. FIREWALL NAT (MASQUERADE)
# ==============================================================================
/ip firewall nat
add chain=srcnat action=masquerade src-address=10.50.10.0/24 comment="EugineBill Hotspot NAT"

# ==============================================================================
# 7. WALLED GARDEN (ONLINE E-VOUCHER PAYMENT GATEWAY)
# ==============================================================================
/ip hotspot walled-garden
add dst-host="*.euginemediagroup.com" action=allow comment="EugineBill Billing Domain"
add dst-host="euginemediagroup.com" action=allow comment="EugineBill Billing Root"
add dst-host="*.midtrans.com" action=allow comment="Payment Gateway Midtrans"
add dst-host="*.xendit.co" action=allow comment="Payment Gateway Xendit"
add dst-host="*.tripay.co.id" action=allow comment="Payment Gateway Tripay"
add dst-host="*.duitku.com" action=allow comment="Payment Gateway Duitku"
```

---

## 6. Konfigurasi Standar di Sisi Modem / ONT (AP Hotspot)

Untuk modem ONT AP (Skyworth SK-D748S, ZTE F609/F670, atau Huawei HG8245H):

1. **Tab WAN**:
   - **Mode**: `Bridge`
   - **Bearer / Service Type**: `INTERNET`
   - **Bridge Type**: `IP_Bridged` *(Wajib `IP_Bridged`, jangan `PPPoE_Bridged`)*
   - **Binding Options**: Centang `SSID1`, `SSID5`, dan `LAN4`
   - **Enable DHCP Pass-through**: **Wajib Centang (ON)**
   - **DHCP Server Enabled**: **Wajib Matikan (OFF)**
   - **VLAN Mode**: `TAG`
   - **VLAN ID**: `10`
   - **802.1p (Priority)**: `0`
2. **Tab WLAN**:
   - **SSID Name**: e.g. `EUGINE-WIFI`
   - **Security**: `Open` / `None` (Tanpa kata sandi Wi-Fi)
   - **AP Isolation**: `Disabled`
3. **Tab Binding / VLAN Binding**:
   - **Kosongkan** (pemetaan port sudah ditangani oleh kotak centang di menu WAN).

---

## 7. Fitur QR Code Auto-Login pada Struk & Kartu Voucher

Pelanggan dapat terhubung ke internet tanpa perlu mengetik kode voucher maupun kata sandi secara manual. Sistem EugineBill menyediakan kode QR pintar yang dicetak langsung pada struk thermal maupun kartu voucher A4.

### A. Alur Kerja (User Flow)
1. Pelanggan menghubungkan smartphone / perangkat ke sinyal Wi-Fi Hotspot (misal `EUGINE-WIFI`).
2. Pelanggan membuka aplikasi kamera bawaan smartphone atau Google Lens lalu mengarahkan ke **QR Code** pada struk voucher.
3. Kamera mendeteksi tautan:  
   `http://wifi.euginemediagroup.com/login?username=KODE&password=PASS`
4. Pelanggan mengetuk link tersebut. Browser membuka captive portal MikroTik.
5. Skrip otomatis di dalam `login.html` membaca kredensial dari URL lalu melakukan auto-submit ke form login MikroTik via metode CHAP MD5 atau PAP dalam 200ms.
6. Internet langsung aktif seketika tanpa input manual!

### B. JavaScript Handler pada Captive Portal MikroTik (`hotspot/login.html`)
Skrip auto-login berikut disuntikkan secara otomatis oleh EugineBill pada saat melakukan "Terapkan Otomatis via API" di menu Router:

```html
<script>
(function() {
    try {
        var p = new URLSearchParams(window.location.search);
        var u = p.get('username') || p.get('code');
        var pass = p.get('password') || p.get('secret') || u;
        if (u && document.login) {
            if (document.login.username) document.login.username.value = u;
            if (document.login.password) document.login.password.value = pass;
            setTimeout(function() {
                if (typeof doLogin === 'function') {
                    doLogin();
                } else {
                    document.login.submit();
                }
            }, 200);
        }
    } catch(e) {}
})();
</script>
```

### C. Pilihan Template Voucher yang Didukung
- **Voucher Card (QR Auto-Login)**: Desain kartu modern 220px dengan palet warna Oceanic Blue (`#002c60`), layout 2 kolom (rincian kuota/masa aktif di kiri, QR Code di kanan), ideal untuk pencetakan massal di kertas A4.
- **Struk Kasir Thermal (58mm / 80mm)**: Desain monokrom vertikal dengan QR Code berukuran 100px di tengah, teks kode voucher besar berbingkai, serta petunjuk pemindaian yang jelas, ideal untuk printer kasir mini thermal.

---

## 8. Pemecahan Masalah (Troubleshooting)

### A. Klien Membuka Browser Tapi Tidak Muncul Login Page
- **Penyebab**: Browser membuka situs HTTPS sebelum captive portal sempat membajak HTTP.
- **Solusi**: Akses `http://wifi.euginemediagroup.com` atau `http://10.50.10.1` secara manual.

### B. Kamera HP Scan QR Code Tapi Tidak Mengarah ke Login
- **Penyebab**: Smartphone belum terhubung ke jaringan Wi-Fi Hotspot sehingga tidak dapat me-resolve DNS lokal `wifi.euginemediagroup.com`.
- **Solusi**: Pastikan smartphone sudah terhubung ke SSID Hotspot terlebih dahulu sebelum memindai QR Code.

### C. DHCP Debug Packet Spam di Log MikroTik
- **Penyebab**: Terdapat aturan manual logging di `/system logging` dengan `topics=dhcp`.
- **Solusi**: Hapus aturan tersebut dengan `/system logging remove [find where topics~"dhcp"]`. Log MikroTik hanya boleh berisi `info`, `error`, `warning`, dan `critical`.

### D. Gagal Login Hotspot saat RADIUS Dimatikan
- **Penyebab**: Voucher belum tersinkronisasi ke lokal router.
- **Solusi**: Buka menu **Pengaturan Perusahaan** (`/admin/settings/company`) lalu klik tombol **"Sinkronkan Ulang Voucher ke MikroTik"** untuk mengimpor seluruh voucher aktif ke `/ip/hotspot/user`.

