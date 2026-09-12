# PANDUAN EKSEKUSI CEPAT: OLT VSOL V1600GS (1 PON) & MIKROTIK FTTH

Panduan praktis lapangan untuk instalasi cepat paket FTTH (1 PON = maks 128 pelanggan) menggunakan template backup EugineBill. Total pengerjaan: **± 10 – 15 menit**.

---

## 1. Skema Pengkabelan Fisik (Topologi Lapangan)

```text
[ SUMBER INTERNET KLIEN ] (Indihome / Biznet / Dedicated)
            │
            ▼ (Port WAN Klien, misal ether1)
   ┌─────────────────┐
   │ MIKROTIK ROUTER │ (CCR / RB Series)
   └─────────────────┘
            │ (Port Distribusi, misal ether3)
            ▼
    [ Kabel LAN UTP ]
            ▼
   ┌─────────────────┐
   │  OLT VSOL 1 PON │ (Port Uplink: GE 0/1 atau GE 0/2)
   └─────────────────┘
            │ (Port PON 1 - Kabel Optik Dropcore / Feeder)
            ▼
        [ ODC / ODP ]
            │ (Dropcore 1 Core)
            ▼
     [ MODEM ONT KLIEN ] (ZTE F609/F670, Huawei HG8245, Skyworth)
```

---

## 2. LANGKAH 1: Setup OLT VSOL V1600GS (3 Menit)

1. Tancapkan adaptor listrik OLT VSOL.
2. Colok kabel LAN dari laptop ke port **MGMT** atau port **GE 0/1** OLT.
3. Atur IP statis di laptop Anda:
   * **IP Address**: `192.168.8.2`
   * **Subnet Mask**: `255.255.255.0`
4. Buka browser (Chrome/Edge), akses IP default OLT:
   * URL: **`http://192.168.8.100`**
   * Username: **`admin`** | Password: **`admin`** (atau `admin123`)
5. Masuk ke menu: **System Management** -> **Configuration Management** (atau **System** -> **Config**).
6. Klik tombol **Choose File / Browse**, pilih file:
   - **`01-vsol-1600gs-clean.conf`**
7. Klik **Upload / Import Configuration**.
8. Klik **Save Configuration** -> lalu klik **Reboot OLT**.
9. Tunggu OLT selesai reboot (sekitar 1–2 menit).

> [!IMPORTANT]
> **AKSES WEB MANAGEMENT OLT & SNMP UDP VIA MIKROTIK:**
> Di MikroTik telah disiapkan DST-NAT port:
> - **Web GUI OLT**: Port `8001` (dan fallback `8003`) -> `http://192.168.30.1:8001` atau `http://192.168.50.1:8001`.
> - **SNMP UDP OLT**: Port UDP `1611` (forward ke UDP `161` OLT) untuk monitoring traffic/optical power.
> *(Kredensial login admin OLT: admin / admin)*.

---

## 3. LANGKAH 2: Setup MikroTik Klien (5 Menit)

1. Buka Winbox $\rightarrow$ Connect ke MikroTik klien.
2. Buka menu **New Terminal**.
3. Buka file **`02-mikrotik-ftth-complete.rsc`** di Notepad laptop Anda, **Copy Seluruh Isinya**, lalu **Paste di New Terminal Winbox**.
4. Tekan **Enter** sampai baris terakhir selesai dieksekusi.
5. Hubungkan kabel LAN dari port distribusi MikroTik (misal **ether2**) ke port Uplink OLT (**GE 0/1** atau **GE 0/2**).

---

## 4. LANGKAH 3: Uji Coba Remote OLT dari MikroTik (1 Menit)

Setelah kabel MikroTik dan OLT tersambung:
1. Pastikan laptop Anda tersambung ke port MikroTik (misal colok LAN di `ether3-5` atau via Wi-Fi).
2. Buka browser di laptop Anda, akses Web OLT via IP Gateway MikroTik:
   * **`http://192.168.30.1:8001`** (atau `http://192.168.50.1:8001`)
3. Jika halaman login OLT VSOL langsung terbuka, **SELAMAT! Jalur Management OLT (VLAN 30) SUDAH 100% SUKSES!**
   *(Mulai detik ini, Anda tidak perlu lagi repot colok-cabut kabel ke OLT jika ingin memantau redaman optik atau register ONT).*

---

## 5. LANGKAH 4: Uji Coba Modem ONT Pelanggan (3 Menit)

1. Pasang modul SFP GPON (C+ atau C++) ke slot PON OLT.
2. Colok kabel optik (pigtail/patch cord) dari OLT menuju modem ONT (misal ZTE F609).
3. Tunggu 30–60 detik hingga lampu **PON** di modem ONT menyala hijau diam (*solid*).
   *(Karena mode `onu auto-learn` sudah aktif, OLT otomatis mengenali dan meng-auth ONT baru).*
4. Masuk ke web admin modem ONT (misal `192.168.1.1`):
   * Masuk ke menu **Network** $\rightarrow$ **WAN Connection**.
   * Mode: **Route**
   * Service Type: **INTERNET**
   * Enable VLAN: **Centang (ON)**
   * **VLAN ID**: **`20`** (Wajib 20!)
   * 802.1p: `0`
   * Link Type: **PPPoE**
   * Username: **`test`**
   * Password: **`123`**
   * Binding Port: Centang LAN 1 - 4 dan SSID 1.
   * Klik **Apply / Save**.
5. Buka Winbox MikroTik $\rightarrow$ menu **PPP** $\rightarrow$ tab **Active Connections**.
   * Anda akan langsung melihat user **`test`** aktif dan mendapat IP `192.168.20.x`.
6. Tes browsing / speedtest dari Wi-Fi modem ONT. Internet langsung jalan kencang dengan limitasi profile 20 Mbps native RouterOS!

---

## 6. Apa Saja Fitur yang Sudah Otomatis Aktif di MikroTik Klien?

1. **WAN DHCP Client Otomatis (Port ether1)**:
   MikroTik otomatis mengambil IP, Gateway, dan DNS dari modem ISP. Begitu kabel dari modem dicolok ke ether1, MikroTik langsung terhubung ke internet.
2. **DHCP Server LAN Plug & Play (Port ether2 - ether5)**:
   Teknisi atau klien bisa langsung mencolok laptop atau Access Point ke port ether2 s/d ether5 dan otomatis mendapatkan IP `192.168.50.x` serta akses internet langsung.
3. **Standard Simple Queue Limiting**:
   Limitasi bandwidth rapi, ringan, dan stabil sesuai profil langganan tanpa beban lonjakan CPU.
4. **VLAN FTTH OLT Siap Pakai**:
   VLAN 20 (PPPoE) dan VLAN 30 (Management OLT) langsung aktif di atas bridge distribusi. Jika ingin mengaktifkan TR-069 via VLAN 4000, skrip aktivasi siap salin tersedia di UI EugineBill menu **TR-069 ACS**.
5. **Universal Masquerade NAT**:
   Semua segmen jaringan (PPPoE pelanggan, LAN teknisi) otomatis bisa browsing ke internet tanpa kendala routing.
6. **Auto-Maintenance Subuh (03.00 Pagi)**:
   MikroTik otomatis membersihkan cache DNS sampah dan merapikan log sistem setiap jam 3 subuh.

---

## 7. Checklist Barang Bawaan Sebelum Berangkat:
- [ ] Laptop & Charger
- [ ] Flashdisk (berisi folder `deployment-pack-client`)
- [ ] Patch cord kabel LAN UTP minimal 2 buah (1m - 2m)
- [ ] SFP GPON Module C+ / C++
- [ ] 1 unit Modem ONT untuk tes dial di tempat klien
- [ ] Laser OLS / Tang Stripper / Cleaver (jika perlu tes redaman optik)
