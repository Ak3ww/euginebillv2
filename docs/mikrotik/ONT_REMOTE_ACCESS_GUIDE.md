# Panduan & Dokumentasi Arsitektur Remote Access Modem ONT (ZTE & Multi-Vendor)

Dokumentasi ini menjelaskan arsitektur teknis, protokol keamanan, dan alur kerja fitur **Remote ONT Web GUI** pada EugineBill RADIUS untuk mengakses Web Management modem pelanggan (terutama ZTE F609, F670, F670L, F660, Huawei, FiberHome) secara aman langsung dari browser admin melalui jaringan VPN dan MikroTik.

---

## 1. Latar Belakang & Tantangan Teknis Modem ZTE

Modem ONT ZTE (menggunakan webserver internal *Boa* / *thttpd*) memiliki beberapa mekanisme proteksi bawaan pabrik yang sering menggagalkan akses jarak jauh (*remote access*):

1. **Blokir Web GUI WAN (Port 80 Terkunci)**:
   - Secara default, modem ZTE menolak koneksi HTTP yang datang dari arah WAN/PPPoE (`WebWANEnable = 0`).
   - Namun, port Telnet (Port 23) tetap dapat diakses dari arah gateway lokal.
2. **Restriksi Header `Host` (HTTP 400 Bad Request)**:
   - Web server ZTE menolak request yang memiliki header `Host` berupa IP publik VPS atau domain (`Host: 43.173.14.236:24000`) dengan pesan error `400 Bad Request - Your request has bad syntax`.
   - Web server ZTE hanya menerima request dengan header `Host` yang persis sama dengan IP WAN/LAN lokal modem (`Host: 192.168.20.xxx`).
3. **Penyimpangan Redirect Firmware**:
   - Sebagian firmware ZTE lama menggunakan `/getpage.gch?pid=1002`, sementara firmware baru menggunakan root `/` atau `/login.gch`.

---

## 2. Diagram Alur & Arsitektur Jaringan (Architecture Flow)

```
[ Admin Browser ]
       │  (1) Akses HTTP http://VPS_IP:proxyPort (Port 24000-24999)
       ▼
[ VPS Node.js Reverse Proxy ]
       │  - Menyamarkan header Host -> Host: 192.168.20.xxx
       │  - Auto-Probing ZTE Paths (/, /login.gch, /getpage.gch)
       │  (2) Forward TCP ke MikroTik VPN IP di natPort (proxyPort + 1000)
       ▼
[ MikroTik RouterOS Gateway ]
       │  - DST-NAT natPort -> ONT_IP:80
       │  - DST-NAT telnetPort -> ONT_IP:23 (untuk auto-unlock)
       │  - SRCNAT Masquerade (menyamarkan asal koneksi sebagai IP Gateway MikroTik)
       │  - Filter Forward Accept Rule
       │  (3) Komunikasi Lokal PPPoE Subnet
       ▼
[ Modem Pelanggan ZTE ONT ] (IP: 192.168.20.xxx)
```

---

## 3. Komponen & Fitur Unggulan

### A. Telnet Auto-Unlock Engine (`WebWANEnable = 1`)
Saat sesi remote ONT dimulai, sistem melakukan *TCP probe* ke port HTTP. Jika port HTTP modem belum terbuka:
1. Server secara otomatis membuka sesi Telnet ke modem pelanggan melalui `telnetPort` di MikroTik.
2. Sistem mengeksekusi kredensial default admin ZTE dan menjalankan perintah CLI:
   ```bash
   sendcmd 1 DB set SecurityMng 0 WebWANEnable 1
   sendcmd 1 DB set SecurityMng 0 WebWANPort 80
   sendcmd 1 DB saveasy
   exit
   ```
3. Pintu Web GUI WAN modem terbuka seketika dalam tempo 1–2 detik tanpa perlu campur tangan fisik teknisi ke rumah pelanggan.

### B. Dynamic Host Header Masking (Solusi 400 Bad Request)
Proxy Node.js di VPS membersihkan dan menyusun ulang HTTP Headers:
* `Host` diubah menjadi `ONT_IP:targetPort` (contoh: `192.168.20.113:80`).
* `Connection` di-set `close` untuk mencegah *connection leaking* pada server Boa ZTE.
* Path redirect header `Location` dinormalisasi menjadi path relatif.

### C. Multi-Path Transparent Fallback
Proxy otomatis mencoba rangkaian *entry point* firmware jika path awal mengembalikan kode status 400/403/404:
1. `/getpage.gch?pid=1002`
2. `/login.gch`
3. `/web/frame/login.asp`
4. `/cgi-bin/webim`
5. `/index.html`

### D. Manajemen Siklus Hidup Sesi (Lifecycle & Cleanup)
* **Alokasi Port Dinamis**: Port proxy VPS dialokasikan dalam rentang aman `24000–24999`.
* **Auto-Teardown**: Sesi remote memiliki masa aktif otomatis (default 30 menit).
* **Pembersihan MikroTik**: Saat sesi ditutup atau kedaluwarsa, seluruh aturan firewall NAT dan Filter di MikroTik dihapus secara otomatis berdasarkan session ID (`comment=ont-remote sess=...`).

---

## 4. Parameter & Kredensial Default ZTE yang Didukung

Sistem auto-unlock mendukung kredensial bawaan ZTE:
* `root` / `Zte521`
* `root` / `root`
* `admin` / `admin`
* `admin` / `Admin`

---

## 5. File Referensi dalam Kode Program

* **Service Engine**: `src/server/services/mikrotik/ont-remote.service.ts`
* **API Handler**: `src/app/api/network/ont-proxy/route.ts` & `src/app/api/network/ont-remote/route.ts`
* **UI Modal**: `src/components/admin/OntRemoteModal.tsx`
