# PANDUAN EKSEKUSI CEPAT: OLT VSOL V1600GS (1 PON) & MIKROTIK FTTH

Panduan praktis lapangan untuk instalasi cepat paket FTTH (1 PON = maks 128 pelanggan) menggunakan template backup EugineBill. Total pengerjaan: **± 10 – 15 menit**.

---

## 1. Skema Pengkabelan Fisik (Topologi Lapangan 100% Work)

```text
[ SUMBER INTERNET KLIEN ] (Indihome / Biznet / Dedicated)
            │
            ▼ (Port WAN Klien: ether1-ISP via DHCP-Client)
   ┌─────────────────┐
   │ MIKROTIK ROUTER │ (RB2011 / CCR / Hex / RB Series)
   └─────────────────┘
     │             │
     │             └───► [ Port ether2, 3, 4: bridge-LAN ] ──► (Laptop Teknisi / AP Kantor: 192.168.50.x)
     │
     ▼ (Port ether5-DISTRIBUSI - Dedicated Trunk, BUKAN anggota bridge-LAN)
[ Kabel LAN UTP Cat6 ]
     ▼
   ┌─────────────────┐
   │  OLT VSOL 1 PON │ (Port Uplink: GE 0/1, GE 0/2, atau GE 0/3 - Speed 1000)
   └─────────────────┘
     │ (Port PON 1 - Kabel Optik Dropcore / Feeder)
     ▼
 [ ODC / ODP ]
     │ (Dropcore 1 Core)
     ▼
 [ MODEM ONT KLIEN ] (ZTE F609/F670, Huawei HG8245, Skyworth)
```

---

## 2. LANGKAH 1: Setup OLT VSOL (3 Menit)

### A. Tentukan Varian Seri OLT VSOL:
1. **Seri V1600GS-ZF (ZTE Falcon Chipset Variant)**:
   - File Konfigurasi: **`01-vsol-1600gs-zf.conf`**
   - **PERINGATAN KRUSIAL**: Seri ZF **wajib** menyertakan baris `service-port 1 gemport 1 uservlan 20 vlan 20` di bawah profile line. Tanpa baris ini, OLT akan men-drop seluruh frame PPPoE dari ONT.
2. **Seri V1600GS Standar (Cortina Chipset Variant)**:
   - File Konfigurasi: **`01-vsol-1600gs-standard.conf`**

### B. Prosedur Import:
1. Tancapkan adaptor listrik OLT VSOL.
2. Colok kabel LAN dari laptop ke port **MGMT** atau port **GE 0/1** OLT.
3. Atur IP statis di laptop Anda:
   * **IP Address**: `192.168.8.2`
   * **Subnet Mask**: `255.255.255.0`
4. Buka browser (Chrome/Edge), akses IP default OLT:
   * URL: **`http://192.168.8.100`**
   * Username: **`admin`** | Password: **`admin`** (atau `admin123`)
5. Masuk ke menu: **System Management** -> **Configuration Management** (atau **System** -> **Config**).
6. Klik tombol **Choose File / Browse**, pilih file sesuai seri (`01-vsol-1600gs-zf.conf` atau `01-vsol-1600gs-standard.conf`).
7. Klik **Upload / Import Configuration** -> **Save Configuration** -> lalu klik **Reboot OLT**.
8. Tunggu OLT selesai reboot (sekitar 1–2 menit).

---

## 3. LANGKAH 2: Setup MikroTik Klien (5 Menit)

1. Buka Winbox -> Connect ke MikroTik klien.
2. Buka menu **New Terminal**.
3. Buka file **`02-mikrotik-ftth-complete.rsc`** di Notepad laptop Anda, **Copy Seluruh Isinya**, lalu **Paste di New Terminal Winbox**.
4. Tekan **Enter** sampai baris terakhir selesai dieksekusi.
5. Hubungkan kabel LAN:
   - **ether1-ISP**: Ke modem internet ISP (Indihome / Biznet / Dedicated).
   - **ether2/3/4**: Ke laptop teknisi atau Switch/AP kantor.
   - **ether5-DISTRIBUSI**: Ke port Uplink OLT (**GE 0/1** atau **GE 0/2**).

---

## 4. LANGKAH 3: Uji Coba Akses Web OLT dari MikroTik (1 Menit)

Setelah kabel MikroTik dan OLT tersambung:
1. Laptop Anda yang dicolok ke port `ether2`, `ether3`, atau `ether4` otomatis mendapat IP `192.168.50.x` dari DHCP server.
2. Buka browser di laptop Anda, langsung ketik IP Management OLT:
   * URL: **`http://192.168.30.2`**
3. Jika halaman login OLT VSOL langsung terbuka, **Jalur Management OLT (VLAN 30) SUDAH 100% SUKSES!**
   *(Inter-VLAN routing ditangani secara native oleh MikroTik tanpa perlu ribet setting IP statis di laptop)*.

---

## 5. LANGKAH 4: Uji Coba Modem ONT Pelanggan (3 Menit)

1. Pasang modul SFP GPON (C+ atau C++) ke slot PON OLT.
2. Colok kabel optik (patch cord) dari OLT menuju modem ONT (misal ZTE F609 / Skyworth).
3. Tunggu 30–60 detik hingga lampu **PON** di modem ONT menyala hijau diam (*solid*).
   *(Karena mode `onu auto-learn` aktif, OLT otomatis me-registrasikan ONT baru ke profile line FTTH)*.
4. Masuk ke web admin modem ONT (misal `192.168.1.1`):
   * Masuk ke menu **Network** -> **WAN Connection**.
   * Mode: **Route** | Service Type: **INTERNET**
   * Enable VLAN: **Centang (ON)** | **VLAN ID**: **`20`** (Wajib VLAN 20!)
   * 802.1p: `0` | Link Type: **PPPoE**
   * Username / Password: Gunakan akun test yang sudah dibuat di MikroTik (misal `RTE` / `eugine0909` atau `Amar12` / `Eugine0909`).
   * Binding Port: Centang LAN 1 - 4 dan SSID 1.
   * Klik **Apply / Save**.
5. Buka Winbox MikroTik -> menu **PPP** -> tab **Active Connections**.
   * Anda akan langsung melihat user PPPoE aktif dan mendapat IP `192.168.20.x`.
   * Di menu **Queue Simple**, otomatis muncul antrean dinamis sesuai limit profile (misal 10 Mbps).
6. Tes browsing / speedtest dari Wi-Fi modem ONT. Internet langsung jalan kencang dengan DNS Cloudflare (`1.1.1.1, 1.0.0.1`) dan TCP MSS Clamping aktif!

---

## 6. Standar Emas Arsitektur Lapangan (Hard Invariants)

1. **Dedicated OLT Trunk Port**: Port trunk ke OLT (misal `ether5-DISTRIBUSI`) **HARUS BERDIRI SENDIRI**, jangan pernah dimasukkan ke dalam `bridge-LAN` agar trunk VLAN tidak tercampur dengan trafik bridge lokal.
2. **VLAN Attachment**: `vlan20-PPPOE` dan `vlan30-MGMT` ditempelkan langsung pada interface fisik ethernet (`ether5-DISTRIBUSI`).
3. **DNS Cloudflare Bebas Blokir**: Selalu gunakan DNS `1.1.1.1, 1.0.0.1` pada IP DNS MikroTik, DHCP Network LAN, dan PPP Profile pelanggan.
4. **TCP MSS Clamping Wajib**: Selalu pasang rule mangle MSS clamping (`new-mss=clamp-to-pmtu`) untuk mencegah website/m-Banking timeout di pelanggan.
5. **Native Queue**: Gunakan parameter `rate-limit` pada `/ppp profile` untuk memanfaatkan Simple Queue dinamis otomatis tanpa membebani CPU router.
