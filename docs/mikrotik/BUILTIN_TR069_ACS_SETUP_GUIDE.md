# Panduan Integrasi Built-in TR-069 ACS EugineBill (In-Band PPPoE)

Dokumentasi ini menjelaskan arsitektur, konfigurasi, dan langkah integrasi perangkat ONT/CPE pelanggan ke **Built-in Auto Configuration Server (ACS)** bawaan EugineBill melalui protokol TR-069 / CWMP.

---

## 1. Ikhtisar & Perbedaan dengan GenieACS

EugineBill dilengkapi dengan engine **Native Built-in CWMP (TR-069) Server** yang berjalan langsung di dalam core Next.js (`src/app/api/cwmp/route.ts` dan `src/server/services/acs/cwmp.service.ts`).

| Aspek | Built-in ACS EugineBill | GenieACS (Eksternal) |
| :--- | :--- | :--- |
| **Arsitektur** | Native Monolith Next.js | Container Terpisah / Node.js Process |
| **Database** | PostgreSQL / MySQL bawaan Prisma (`acsDevice`, `acsTask`) | Wajib MongoDB terpisah |
| **Beban Server / RAM** | 0 MB RAM tambahan (menyatu dengan web app) | 500 MB - 1.5 GB RAM tambahan (Node + Mongo) |
| **VLAN Jaringan** | **In-Band PPPoE** (VLAN 20 eksisting, tanpa VLAN khusus) | Sering memerlukan VLAN terpisah (VLAN 4000) & DHCP |
| **Mapping Pelanggan** | Otomatis via active IP PPPoE (`pppoeUser`) | Perlu script NBI / sync API terpisah |
| **Maintenance** | 100% otomatis ikut PM2 `EugineBill-radius` | Perlu maintain MongoDB, GenieACS CWMP, UI, FS |

> **Catatan Penting:** Anda **TIDAK PERLU** menginstall Docker, MongoDB, atau GenieACS. Cukup arahkan modem ONT pelanggan ke endpoint `/api/cwmp` EugineBill.

---

## 2. Arsitektur Jaringan (In-Band PPPoE)

Dalam topologi FTTH standar EugineBill:
1. **MikroTik Router**: Mengelola VLAN 20 (`vlan20-PPPoE`) untuk sesi internet pelanggan dan VLAN 30 (`vlan30-MGMT-OLT`) untuk remote OLT.
2. **VSOL OLT**: Mengalirkan VLAN 20 ke port PON secara *tagged* (`service ser_1 gemport 1 tag 20`).
3. **ONT Pelanggan**: Terkoneksi ke VLAN 20 dengan mode PPPoE dial-up.

```text
+-------------------+       PPPoE (VLAN 20)       +---------------------+
|   ONT Pelanggan   | =========================== |   MikroTik BNG/NAS  |
| (INTERNET,TR069)  |                             | (10.20.10.1 Gateway)|
+-------------------+                             +---------------------+
          |                                                  |
          | HTTP SOAP Inform via WAN PPPoE                   | Routing / NAT ke VPS
          v                                                  v
+-----------------------------------------------------------------------+
|                       VPS EugineBill                                  |
|   Endpoint: http://<DOMAIN_OR_IP>/api/cwmp                            |
|   Engine: Built-in TR-069 CWMP Service (Next.js Core)                 |
+-----------------------------------------------------------------------+
```

### Mengapa In-Band TR-069?
- **Tanpa VLAN Tambahan**: Tidak perlu membuat VLAN 4000 di MikroTik maupun OLT.
- **Hemat IP Pool**: Modem menggunakan IP WAN PPPoE yang sudah dialokasikan untuk berkomunikasi dengan ACS.
- **Keamanan Tinggi**: Paket TR-069 terenkapsulasi dalam tunnel PPPoE pelanggan dan di-routing secara aman ke EugineBill.
- **Auto-Mapping Akurat**: EugineBill langsung mencocokkan IP pengirim SOAP Inform dengan `mikrotikSession` / `radacct` aktif untuk menautkan perangkat ke nama pelanggan secara instan.

---

## 3. Parameter Koneksi ACS EugineBill

Saat mengkonfigurasi modem ONT/CPE, gunakan parameter berikut:

- **ACS URL**: `http://<DOMAIN_ATAU_IP_VPS>/api/cwmp`  
  *(Contoh: `http://billing.isp-anda.com/api/cwmp` atau `http://103.x.x.x/api/cwmp`)*
- **ACS Username**: *(Kosongkan - Default)*
- **ACS Password**: *(Kosongkan - Default)*
- **Periodic Inform Enable**: **Checked / Enable**
- **Periodic Inform Interval**: `300` *(detik = 5 menit)* atau `60` detik untuk respon lebih cepat.
- **Connection Request Username/Password**: Bebas / default dari ONT.

---

## 4. Panduan Langkah per Merk Modem / ONT

### 4.1 Konfigurasi ONT ZTE (F609 / F670L / F660)

1. Buka browser dan login ke web admin ONT ZTE (biasanya `http://192.168.1.1`).
2. Masuk ke menu: **Network** &rarr; **WAN** &rarr; **WAN Connection**.
3. Pilih koneksi PPPoE yang aktif (misal `omci_ipv4_pppoe_1`).
4. Cari kolom **Service List**, ubah dari `INTERNET` menjadi **`INTERNET_TR069`**.
5. Klik **Modify** untuk menyimpan.
6. Pindah ke menu: **Administration** &rarr; **TR-069**.
7. Lakukan pengaturan:
   - **Enable CWMP**: Centang (Enable)
   - **URL**: `http://<DOMAIN_ATAU_IP>/api/cwmp`
   - **User Name**: *(Kosongkan)*
   - **Password**: *(Kosongkan)*
   - **Periodic Inform Enable**: Centang
   - **Periodic Inform Interval**: `300`
8. Klik **Submit**.

---

### 4.2 Konfigurasi ONT Huawei (HG8245H / HG8245A / EG8145V5)

1. Login ke web management ONT Huawei (`http://192.168.100.1` atau `http://192.168.18.1`).
2. Masuk ke tab **WAN** &rarr; **WAN Configuration**.
3. Klik pada profil koneksi PPPoE pelanggan.
4. Pada opsi **Service Type**, pastikan memilih atau mencentang **`INTERNET, TR069`**.
5. Klik **Apply**.
6. Masuk ke tab **System Tools** &rarr; **TR-069**.
7. Konfigurasikan:
   - **Enable TR-069**: Centang
   - **URL**: `http://<DOMAIN_ATAU_IP>/api/cwmp`
   - **Periodic Inform**: Centang
   - **Periodic Inform Interval**: `300` detik
8. Klik **Apply**.

---

### 4.3 Konfigurasi ONT Fiberhome (HG6243C / HG6245D)

1. Login ke web admin Fiberhome (`http://192.168.1.1`).
2. Masuk ke menu **Network** &rarr; **Broadband Settings** &rarr; **Internet Settings**.
3. Pada WAN PPPoE yang ada, ubah **Service List** menjadi **`INTERNET,TR069`**. Simpan perubahan.
4. Masuk ke menu **Management** &rarr; **TR-069**.
5. Konfigurasi:
   - **CWMP Enable**: Yes
   - **URL**: `http://<DOMAIN_ATAU_IP>/api/cwmp`
   - **Periodic Inform**: Enable
   - **Interval**: `300`
6. Klik **Apply**.

---

### 4.4 Konfigurasi ONT VSOL / XPON Generic

1. Login ke web management ONT (`http://192.168.1.1`).
2. Buka menu **Network** &rarr; **WAN Settings**.
3. Pada interface PPPoE VLAN 20, ubah **Service Mode / Service Type** menjadi **`INTERNET,TR069`**.
4. Buka menu **Management** &rarr; **TR069 Config**.
5. Aktifkan **TR069 Enable**: Centang.
6. Masukkan **ACS Server URL**: `http://<DOMAIN_ATAU_IP>/api/cwmp`.
7. Aktifkan **Inform**: Centang dengan interval `300` detik.
8. Klik **Apply**.

---

## 5. Fitur yang Didukung Built-in ACS

Setelah ONT berhasil melakukan Inform, EugineBill menyediakan berbagai fitur manajemen jarak jauh pada menu **/admin/acs**:

1. **Pemantauan Redaman Optik (Optical Rx/Tx Power)**:
   - Membaca redaman sinyal fiber langsung dari modul GPON/EPON ONT (`dBm`).
   - Memberikan indikator status visual: Bagus (`≥ -20 dBm`), Sedang (`-21 sd -25 dBm`), Buruk (`≤ -26 dBm`).
2. **Manajemen WiFi Terpusat**:
   - Mengubah nama WiFi (SSID 2.4GHz & 5GHz) langsung dari panel admin.
   - Mengubah Password WPA/WPA2 WiFi tanpa perlu teknisi datang ke rumah pelanggan.
3. **Reboot Perangkat Jarak Jauh**:
   - Menjadwalkan perintah reboot SOAP XML yang dieksekusi saat ONT melakukan polling session berikutnya.
4. **Monitoring Perangkat Terkoneksi (Connected LAN/WLAN Clients)**:
   - Menghitung jumlah host/perangkat HP/laptop yang terhubung ke modem pelanggan.
5. **Auto-Mapping Akun Pelanggan**:
   - Secara berkala menghubungkan perangkat dengan akun `pppoeUser` berdasarkan IP WAN aktif.

---

## 6. Verifikasi & Diagnosa

### Cek Endpoint Melalui Browser atau Curl
Buka URL ACS di browser atau terminal:
```bash
curl -i http://<DOMAIN_ATAU_IP>/api/cwmp
```
Response yang diharapkan (HTTP 200 JSON):
```json
{
  "status": "online",
  "service": "EugineBill Built-in TR-069 ACS (CWMP)",
  "version": "2.0",
  "endpoint": "/api/cwmp",
  "connectionMode": "In-Band PPPoE (Service Type: INTERNET,TR069)"
}
```

### Memeriksa Log Inform di VPS
Untuk memantau permintaan TR-069 masuk dari modem pelanggan secara realtime:
```bash
pm2 logs EugineBill-radius --lines 100 | grep -i cwmp
```

Log akan menampilkan proses pertukaran pesan SOAP:
1. `[CWMP] Received Inform from <SERIAL_NUMBER> (Event: 0 BOOTSTRAP / 2 PERIODIC)`
2. `[CWMP] Responding InformResponse`
3. `[CWMP] Device synchronized with ID <DEVICE_ID>`
