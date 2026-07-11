'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function IsolationDocsPage() {
  const [mode, setMode] = useState<'non-radius' | 'radius'>('non-radius');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-8 px-4">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <Link href="/admin/settings/isolation" className="text-sm text-blue-600 hover:underline mb-4 inline-block">
            ← Kembali ke Isolation Settings
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Isolation System
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            Dokumentasi lengkap sistem isolasi otomatis untuk PPPoE users yang masa berlangganannya habis (expired).
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded dark:bg-green-900 dark:text-green-200">MikroTik API</span>
            <span className="bg-purple-100 text-purple-800 text-xs font-medium px-2.5 py-0.5 rounded dark:bg-purple-900 dark:text-purple-200">PPPoE</span>
            <span className="bg-orange-100 text-orange-800 text-xs font-medium px-2.5 py-0.5 rounded dark:bg-orange-900 dark:text-orange-200">Cron Job</span>
            <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded dark:bg-blue-900 dark:text-blue-200">FreeRADIUS (opsional)</span>
          </div>
        </div>

        {/* Mode Toggle */}
        <div className="mb-8 flex items-center gap-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
          <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">Mode Billing:</span>
          <button
            onClick={() => setMode('non-radius')}
            className={`px-4 py-1.5 text-sm font-medium rounded-full transition-colors ${
              mode === 'non-radius'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            ✅ Non-RADIUS (Default)
          </button>
          <button
            onClick={() => setMode('radius')}
            className={`px-4 py-1.5 text-sm font-medium rounded-full transition-colors ${
              mode === 'radius'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            FreeRADIUS Mode
          </button>
          {mode === 'non-radius' && (
            <span className="ml-auto text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded px-2 py-0.5">
              Ini mode Anda saat ini
            </span>
          )}
        </div>

        {/* TOC */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5 mb-8">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Daftar Isi</h2>
          <ol className="space-y-1 text-sm text-blue-600 dark:text-blue-400">
            {(mode === 'non-radius' ? [
              'Gambaran Umum',
              'Alur Kerja Lengkap (Non-RADIUS)',
              'Komponen Sistem',
              'Cron Job — Auto Isolir',
              'Konfigurasi MikroTik (Wajib)',
              'Database & Status PPPoE User',
              'Halaman Isolated (Customer-Facing)',
              'Pengaturan Isolasi di Admin Panel',
              'Troubleshooting (Non-RADIUS)',
              'Perbedaan Status: isolated vs blocked vs stop',
            ] : [
              'Gambaran Umum',
              'Alur Kerja Lengkap (RADIUS)',
              'Komponen Sistem',
              'Cron Job — Auto Isolir',
              'Konfigurasi MikroTik',
              'Konfigurasi FreeRADIUS',
              'Database & Status PPPoE User',
              'Halaman Isolated (Customer-Facing)',
              'Pengaturan Isolasi di Admin Panel',
              'Troubleshooting (RADIUS)',
              'Perbedaan Status: isolated vs blocked vs stop',
            ]).map((item, i) => (
              <li key={i}>
                <a href={`#section-${i + 1}`} className="hover:underline">
                  {i + 1}. {item}
                </a>
              </li>
            ))}
          </ol>
        </div>

        <div className="space-y-10 text-gray-800 dark:text-gray-200">

          {/* Section 1 - Gambaran Umum */}
          <section id="section-1">
            <SectionTitle number={1} title="Gambaran Umum" />
            <Prose>
              <p>
                Sistem isolasi bekerja dengan cara <strong>membatasi akses internet</strong> user yang sudah expired —
                bukan memblokir login sepenuhnya. User tetap bisa connect PPPoE, namun:
              </p>
              <ul>
                <li>Mendapat IP dari <Code>pool-isolir</Code> (misal: <Code>192.168.200.x</Code>) bukan IP normal</li>
                <li>Bandwidth dibatasi (misal: <Code>64k/64k</Code>)</li>
                <li>Semua HTTP/HTTPS di-redirect ke halaman <Code>/isolated</Code> (halaman pembayaran)</li>
                <li>Hanya boleh akses DNS, payment gateway, dan billing server</li>
              </ul>
              <p>
                Setelah user melakukan pembayaran dan invoice terverifikasi, status kembali ke <Code>active</Code> dan
                isolasi otomatis dicabut.
              </p>
            </Prose>
            {mode === 'non-radius' ? (
              <InfoBox type="info">
                <strong>Mode Non-RADIUS (Default):</strong> Isolasi dijalankan langsung via <strong>MikroTik API</strong> (port 8728).
                Sistem mengganti PPP Secret profile user ke <Code>isolir</Code> dan langsung memutus sesi aktif.
                Tidak perlu FreeRADIUS, tidak ada akses ke tabel <Code>rad*</Code>.
              </InfoBox>
            ) : (
              <InfoBox type="info">
                <strong>Mode FreeRADIUS:</strong> Isolasi dijalankan dengan mengubah tabel <Code>radusergroup</Code> ke group <Code>isolir</Code>.
                FreeRADIUS membaca tabel ini saat user reconnect dan menerapkan profile isolir otomatis.
              </InfoBox>
            )}
          </section>

          {/* Section 2 - Alur Kerja */}
          <section id="section-2">
            <SectionTitle number={2} title={mode === 'non-radius' ? 'Alur Kerja Lengkap (Non-RADIUS)' : 'Alur Kerja Lengkap (RADIUS)'} />
            {mode === 'non-radius' ? (
              <CodeBlock>{`1. CRON JOB (setiap jam)
   └─► Cek pppoe_users WHERE status='active' AND expiredAt < CURDATE()

2. UNTUK SETIAP USER EXPIRED:
   ├─► Update status DB: active → isolated
   ├─► MikroTik API: /ppp/secret/set profile=isolir (ganti profil PPP Secret)
   ├─► MikroTik API: /ppp/active/remove (kick sesi aktif → user terputus)
   └─► Notifikasi: WhatsApp/Email ke user

3. USER RECONNECT PPPoE:
   ├─► MikroTik: PPP Secret sekarang profile = 'isolir'
   ├─► MikroTik: Rate-limit 64k/64k (dari profile isolir)
   └─► MikroTik: IP dari pool-isolir (192.168.200.x)

4. USER BUKA BROWSER:
   ├─► MikroTik NAT: Redirect HTTP(80) & HTTPS(443) ke billing server
   ├─► Next.js Middleware (proxy.ts): Deteksi IP dari isolation pool
   └─► Redirect ke /isolated?ip=192.168.200.x

5. HALAMAN /isolated:
   ├─► Tampilkan info akun (nama, expired date)
   ├─► Tampilkan invoice belum dibayar + link pembayaran
   └─► Tampilkan kontak support

6. SETELAH PEMBAYARAN:
   ├─► Invoice status: PENDING → PAID
   ├─► Status user DB: isolated → active
   ├─► MikroTik API: /ppp/secret/set profile=NamaProfileNormal
   ├─► MikroTik API: /ppp/active/remove (kick lagi → force reconnect)
   └─► User reconnect → Internet penuh ✅`}</CodeBlock>
            ) : (
              <CodeBlock>{`1. CRON JOB (setiap jam)
   └─► Cek pppoe_users WHERE status='active' AND expiredAt < CURDATE()

2. UNTUK SETIAP USER EXPIRED:
   ├─► Update status: active → isolated
   ├─► Radcheck: Cleartext-Password TETAP ADA (user boleh login!)
   ├─► Radcheck: HAPUS Auth-Type:Reject
   ├─► Radusergroup: Pindah ke group 'isolir'
   ├─► Radreply: HAPUS Framed-IP-Address (IP statis dicopot)
   ├─► MikroTik API: Disconnect session aktif (CoA/API)
   └─► Notifikasi: WhatsApp/Email ke user

3. USER RECONNECT PPPoE:
   ├─► FreeRADIUS: Auth sukses (password OK)
   ├─► FreeRADIUS: Assign PPP profile 'isolir'
   ├─► MikroTik: Rate-limit 64k/64k
   └─► MikroTik: IP dari pool-isolir (192.168.200.x)

4. USER BUKA BROWSER:
   ├─► MikroTik NAT: Redirect HTTP(80) & HTTPS(443) ke billing server
   ├─► Next.js Middleware (proxy.ts): Deteksi IP dari isolation pool
   └─► Redirect ke /isolated?ip=192.168.200.x

5. HALAMAN /isolated:
   ├─► Tampilkan info akun (nama, expired date)
   ├─► Tampilkan invoice belum dibayar + link pembayaran
   └─► Tampilkan kontak support

6. SETELAH PEMBAYARAN:
   ├─► Invoice status: PENDING → PAID
   ├─► Status user: isolated → active
   ├─► Radusergroup: Kembali ke group/profile normal
   └─► User perlu reconnect PPPoE untuk akses penuh`}</CodeBlock>
            )}
          </section>

          {/* Section 3 - Komponen */}
          <section id="section-3">
            <SectionTitle number={3} title="Komponen Sistem" />
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <thead className="bg-gray-100 dark:bg-gray-800">
                  <tr>
                    {['Komponen', 'File', 'Peran'].map(h => (
                      <th key={h} className="text-left px-4 py-2 font-semibold text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {[
                    ['Cron Job', 'src/server/jobs/auto-isolation.ts', 'Logika isolasi otomatis'],
                    ['Cron API', 'src/app/api/cron/route.ts', 'Endpoint handler cron job'],
                    ['Status API', 'src/app/api/pppoe/users/status/route.ts', 'Isolir/aktif manual 1 user'],
                    ['Bulk Status API', 'src/app/api/pppoe/users/bulk-status/route.ts', 'Isolir/aktif massal'],
                    ['Settings API', 'src/app/api/settings/isolation/route.ts', 'GET/PUT isolation settings'],
                    ['Check API', 'src/app/api/pppoe/users/check-isolation/route.ts', 'Cek status isolasi (publik)'],
                    ['PPP Secret Service', 'src/server/services/mikrotik/ppp-secret.service.ts', 'MikroTik API: ganti profil & kick'],
                    ['Middleware', 'src/proxy.ts', 'Deteksi IP isolasi & redirect'],
                    ['Isolated Page', 'src/app/isolated/page.tsx', 'Halaman customer-facing'],
                    ['Admin Settings', 'src/app/admin/settings/isolation/page.tsx', 'Halaman konfigurasi admin'],
                    ['MikroTik Scripts', 'src/app/admin/settings/isolation/mikrotik/page.tsx', 'Generator script MikroTik'],
                  ].map(([comp, file, role]) => (
                    <tr key={comp} className="bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-4 py-2 font-medium border border-gray-200 dark:border-gray-700">{comp}</td>
                      <td className="px-4 py-2 font-mono text-xs text-blue-700 dark:text-blue-300 border border-gray-200 dark:border-gray-700">{file}</td>
                      <td className="px-4 py-2 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700">{role}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 4 - Cron Job */}
          <section id="section-4">
            <SectionTitle number={4} title="Cron Job — Auto Isolir" />
            <Prose>
              <p><strong>Schedule:</strong> <Code>0 * * * *</Code> — Setiap jam tepat (00 menit)</p>
              <p>Cron job berjalan di <Code>EugineBill-cron</Code> (PM2) dan memanggil API endpoint <Code>POST /api/cron</Code> dengan <Code>type: "pppoe_auto_isolir"</Code>.</p>
            </Prose>
            <h3 className="font-semibold text-lg mt-4 mb-2">Yang Dilakukan Per User Expired</h3>
            {mode === 'non-radius' ? (
              <CodeBlock>{`// 1. Update status DB → 'isolated'
// 2. Cek routerId user (wajib ada!)
// 3. PPPSecretService.setProfileAndDisconnect(routerId, username, 'isolir')
//    ├─► /ppp/secret/set profile=isolir  (ganti profil)
//    └─► /ppp/active/remove              (kick sesi aktif)
// 4. Kirim notifikasi WhatsApp/Email`}</CodeBlock>
            ) : (
              <CodeBlock>{`// 1. Update status → 'isolated'
// 2. Cleartext-Password tetap di radcheck (allow login!)
// 3. Hapus Auth-Type:Reject dari radcheck
// 4. Hapus Reply-Message dari radreply
// 5. Pindah ke radusergroup 'isolir'
// 6. Hapus Framed-IP-Address dari radreply
// 7. Disconnect via MikroTik API (port 8728/8729)
// 8. Fallback: CoA disconnect jika MikroTik API gagal
// 9. Update radacct: set acctstoptime=NOW()
// 10. Kirim notifikasi WhatsApp/Email`}</CodeBlock>
            )}
            <h3 className="font-semibold text-lg mt-4 mb-2">Manual Trigger</h3>
            <CodeBlock>{`# Via API (dari server)
curl -X POST http://localhost:3000/api/cron \\
  -H "Content-Type: application/json" \\
  -d '{"type": "pppoe_auto_isolir"}'`}</CodeBlock>
            <h3 className="font-semibold text-lg mt-4 mb-2">Cek Log Cron</h3>
            <CodeBlock>{`pm2 logs EugineBill-cron --lines 50

# Contoh log sukses (Non-RADIUS):
# [AUTO-ISOLATE] Processing: EMG011
# [AUTO-ISOLATE] ✓ Swapped profile to 'isolir' and kicked EMG011 via MikroTik API
# [AUTO-ISOLATE] ✓ Successfully isolated EMG011

# Contoh log sukses (RADIUS):
# [CRON] Running PPPoE Auto Isolir (attempt 1/3)...
# [PPPoE Auto-Isolir] Found 3 expired user(s) to isolate
# ✅ [PPPoE Auto-Isolir] User john123 isolated
# [CRON] PPPoE Auto Isolir completed: ✓ Isolated 3/3 users`}</CodeBlock>
          </section>

          {/* Section 5 - MikroTik */}
          <section id="section-5">
            <SectionTitle number={5} title={mode === 'non-radius' ? 'Konfigurasi MikroTik (Wajib)' : 'Konfigurasi MikroTik'} />
            <InfoBox type="warning">
              Script lengkap bisa di-generate otomatis dari <strong>Admin Panel → Settings → Isolation → MikroTik Setup</strong>
            </InfoBox>

            {mode === 'non-radius' && (
              <InfoBox type="info">
                <strong>Mode Non-RADIUS:</strong> Isolasi bekerja via <strong>address-list</strong> di firewall MikroTik.
                Saat admin meng-isolir user, sistem mengganti profil PPP Secret ke <Code>isolir</Code> dan user reconnect
                mendapat IP dari <Code>pool-isolir</Code>. Profile <Code>isolir</Code> memiliki parameter <Code>address-list=isolir</Code>
                yang otomatis memasukkan IP user ke address-list saat connect.
              </InfoBox>
            )}

            <h3 className="font-semibold text-lg mt-4 mb-2">Script 1: IP Pool</h3>
            <CodeBlock>{`/ip pool
add name=pool-isolir ranges=192.168.200.100-192.168.200.200 \\
    comment="EugineBill - IP Pool untuk user yang diisolir"`}</CodeBlock>

            <h3 className="font-semibold text-lg mt-4 mb-2">Script 2: PPP Profile 'isolir'</h3>
            {mode === 'non-radius' ? (
              <>
                <CodeBlock>{`/ppp profile
add name=isolir \\
    local-address=192.168.200.1 \\
    remote-address=pool-isolir \\
    address-list=isolir \\
    rate-limit=64k/64k \\
    use-mpls=no use-compression=no use-encryption=no \\
    comment="EugineBill - Profile untuk user yang diisolir"`}</CodeBlock>
                <InfoBox type="info">
                  Parameter <Code>address-list=isolir</Code> pada profile sangat penting — saat user reconnect dengan profile ini,
                  MikroTik otomatis memasukkan IP user ke address-list <Code>isolir</Code> yang digunakan oleh rule firewall.
                  Name profile <strong>HARUS</strong> <Code>isolir</Code> karena sistem memanggil <Code>PPPSecretService.setProfileAndDisconnect(..., &quot;isolir&quot;)</Code>.
                </InfoBox>
              </>
            ) : (
              <>
                <CodeBlock>{`/ppp profile
add name=isolir \\
    local-address=pool-isolir \\
    remote-address=pool-isolir \\
    rate-limit=64k/64k \\
    comment="EugineBill - Profile untuk user yang diisolir"`}</CodeBlock>
                <InfoBox type="info">
                  Name profile <strong>HARUS</strong> <Code>isolir</Code> karena sistem menulis <Code>isolir</Code> ke tabel <Code>radusergroup</Code>.
                  FreeRADIUS membaca dari sini untuk menentukan PPP profile yang digunakan.
                </InfoBox>
              </>
            )}

            <h3 className="font-semibold text-lg mt-4 mb-2">Script 3: Firewall Filter</h3>
            {mode === 'non-radius' ? (
              <CodeBlock>{`/ip firewall filter
# [1] Allow ESTABLISHED & RELATED
add chain=forward src-address-list=isolir \\
    connection-state=established,related action=accept \\
    comment="EugineBill - Allow established for isolated users"

add chain=forward dst-address-list=isolir \\
    connection-state=established,related action=accept \\
    comment="EugineBill - Allow return traffic to isolated users"

# [2] Allow DNS
add chain=forward src-address-list=isolir \\
    protocol=udp dst-port=53 action=accept \\
    comment="EugineBill - Allow DNS for isolated users"

# [3] Allow ICMP (ping)
add chain=forward src-address-list=isolir \\
    protocol=icmp action=accept \\
    comment="EugineBill - Allow ping for isolated users"

# [4] Allow billing server — GANTI DENGAN IP ADDRESS SERVER!
add chain=forward src-address-list=isolir \\
    dst-address=103.x.x.x action=accept \\
    comment="EugineBill - Allow access to billing server"

# [5] Allow payment gateway
add chain=forward src-address-list=isolir \\
    dst-address-list=payment-gateways action=accept \\
    comment="EugineBill - Allow access to payment gateways"

# [6] Block semua akses internet lainnya
add chain=forward src-address-list=isolir \\
    action=drop \\
    comment="EugineBill - Block internet for isolated users"`}</CodeBlock>
            ) : (
              <CodeBlock>{`/ip firewall filter
# Allow DNS untuk user isolir (subnet-based)
add chain=forward src-address=192.168.200.0/24 \\
    protocol=udp dst-port=53 action=accept \\
    comment="Allow DNS for isolated users"

# Allow ICMP (ping)
add chain=forward src-address=192.168.200.0/24 \\
    protocol=icmp action=accept \\
    comment="Allow ping for isolated users"

# Allow billing server — GANTI DENGAN IP ADDRESS SERVER!
add chain=forward src-address=192.168.200.0/24 \\
    dst-address=103.x.x.x action=accept \\
    comment="Allow access to billing server"

# Allow payment gateway
add chain=forward src-address=192.168.200.0/24 \\
    dst-address-list=payment-gateways action=accept \\
    comment="Allow access to payment gateways"

# Block semua akses internet lainnya
add chain=forward src-address=192.168.200.0/24 \\
    action=drop \\
    comment="Block internet for isolated users"`}</CodeBlock>
            )}

            <h3 className="font-semibold text-lg mt-4 mb-2">Script 4: Firewall NAT (Redirect ke Halaman Isolir)</h3>
            {mode === 'non-radius' ? (
              <CodeBlock>{`/ip firewall nat
# Redirect HTTP — GANTI 103.x.x.x DENGAN IP SERVER!
add chain=dstnat src-address-list=isolir \\
    protocol=tcp dst-port=80 \\
    dst-address=!103.x.x.x dst-address-list=!payment-gateways \\
    action=dst-nat to-addresses=103.x.x.x to-ports=80 \\
    comment="EugineBill - Redirect HTTP to isolation page"

add chain=dstnat src-address-list=isolir \\
    protocol=tcp dst-port=443 \\
    dst-address=!103.x.x.x dst-address-list=!payment-gateways \\
    action=dst-nat to-addresses=103.x.x.x to-ports=443 \\
    comment="EugineBill - Redirect HTTPS to isolation page"`}</CodeBlock>
            ) : (
              <CodeBlock>{`/ip firewall nat
# Redirect HTTP — GANTI 103.x.x.x DENGAN IP SERVER!
add chain=dstnat src-address=192.168.200.0/24 \\
    protocol=tcp dst-port=80 \\
    dst-address=!103.x.x.x dst-address-list=!payment-gateways \\
    action=dst-nat to-addresses=103.x.x.x to-ports=80 \\
    comment="Redirect HTTP to isolation page"

add chain=dstnat src-address=192.168.200.0/24 \\
    protocol=tcp dst-port=443 \\
    dst-address=!103.x.x.x dst-address-list=!payment-gateways \\
    action=dst-nat to-addresses=103.x.x.x to-ports=443 \\
    comment="Redirect HTTPS to isolation page"`}</CodeBlock>
            )}
          </section>

          {/* Section 6 - RADIUS config (only for radius mode) */}
          {mode === 'radius' && (
            <section id="section-6">
              <SectionTitle number={6} title="Konfigurasi FreeRADIUS" />
              <h3 className="font-semibold text-lg mt-4 mb-2">Tabel yang Digunakan</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <thead className="bg-gray-100 dark:bg-gray-800">
                    <tr>
                      {['Tabel', 'Attribute', 'Nilai saat Isolated'].map(h => (
                        <th key={h} className="text-left px-4 py-2 font-semibold border border-gray-200 dark:border-gray-700">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {[
                      ['radcheck', 'Cleartext-Password', 'Password user (tetap ada)'],
                      ['radcheck', 'Auth-Type', 'DIHAPUS (allow login)'],
                      ['radusergroup', 'groupname', 'isolir'],
                      ['radgroupreply', 'Mikrotik-Rate-Limit (group isolir)', '64k/64k'],
                      ['radgroupreply', 'Framed-Pool (group isolir)', 'pool-isolir'],
                      ['radreply', 'Framed-IP-Address', 'DIHAPUS (pakai pool)'],
                    ].map(([tabel, attr, val]) => (
                      <tr key={attr} className="bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="px-4 py-2 font-mono text-xs border border-gray-200 dark:border-gray-700">{tabel}</td>
                        <td className="px-4 py-2 font-mono text-xs text-blue-700 dark:text-blue-300 border border-gray-200 dark:border-gray-700">{attr}</td>
                        <td className="px-4 py-2 border border-gray-200 dark:border-gray-700">{val}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <h3 className="font-semibold text-lg mt-4 mb-2">Setup radgroupreply untuk Group &apos;isolir&apos;</h3>
              <CodeBlock>{`INSERT INTO radgroupreply (groupname, attribute, op, value) VALUES
('isolir', 'Framed-Pool', ':=', 'pool-isolir'),
('isolir', 'Mikrotik-Rate-Limit', ':=', '64k/64k'),
('isolir', 'Session-Timeout', ':=', '3600');`}</CodeBlock>
            </section>
          )}

          {/* Section 6/7 - Database */}
          <section id={mode === 'radius' ? 'section-7' : 'section-6'}>
            <SectionTitle number={mode === 'radius' ? 7 : 6} title="Database & Status PPPoE User" />
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <thead className="bg-gray-100 dark:bg-gray-800">
                  <tr>
                    {['Status', 'Bisa Login', 'Akses Internet', 'Keterangan'].map(h => (
                      <th key={h} className="text-left px-4 py-2 font-semibold border border-gray-200 dark:border-gray-700">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {(mode === 'non-radius' ? [
                    ['active', '✅ Ya', '✅ Penuh', 'PPP Secret enabled, profile normal'],
                    ['isolated', '✅ Ya', '⚠️ Terbatas', 'PPP Secret profile = isolir, IP dari pool-isolir, redirect ke /isolated'],
                    ['blocked', '❌ Tidak', '❌ Tidak ada', 'PPP Secret disabled=yes, diblokir manual admin'],
                    ['stop', '❌ Tidak', '❌ Tidak ada', 'PPP Secret disabled=yes, berlangganan dihentikan'],
                  ] : [
                    ['active', '✅ Ya', '✅ Penuh', 'Berlangganan aktif normal'],
                    ['isolated', '✅ Ya', '⚠️ Terbatas', 'Expired, redirect ke /isolated. Group: isolir, IP: pool-isolir, BW: 64k/64k'],
                    ['blocked', '❌ Tidak', '❌ Tidak ada', 'Diblokir manual oleh admin (radcheck dihapus)'],
                    ['stop', '❌ Tidak', '❌ Tidak ada', 'Dihentikan (radcheck dihapus)'],
                  ]).map(([status, login, akses, ket]) => (
                    <tr key={status} className="bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-4 py-2 font-mono font-bold border border-gray-200 dark:border-gray-700">{status}</td>
                      <td className="px-4 py-2 border border-gray-200 dark:border-gray-700">{login}</td>
                      <td className="px-4 py-2 border border-gray-200 dark:border-gray-700">{akses}</td>
                      <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700">{ket}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {mode === 'non-radius' && (
              <>
                <h3 className="font-semibold text-lg mt-4 mb-2">API Call yang Dijalankan Saat Isolasi (Non-RADIUS)</h3>
                <CodeBlock>{`// PPPSecretService.setProfileAndDisconnect(routerId, username, 'isolir')

// Langkah 1: Ganti profil PPP Secret
/ppp/secret/print ?name=EMG011
/ppp/secret/set .id=*1 profile=isolir

// Langkah 2: Kick sesi aktif (user terputus, reconnect dengan profil baru)
/ppp/active/print ?name=EMG011
/ppp/active/remove .id=*3

// Saat user reconnect → otomatis pakai profile 'isolir' → IP dari pool-isolir`}</CodeBlock>

                <h3 className="font-semibold text-lg mt-4 mb-2">API Call saat User Aktif Kembali (Setelah Bayar)</h3>
                <CodeBlock>{`// PPPSecretService.setProfileAndDisconnect(routerId, username, 'PAKET HEMAT 20MBPS')

// Langkah 1: Kembalikan profil ke normal
/ppp/secret/set .id=*1 profile=PAKET-HEMAT-20MBPS

// Langkah 2: Kick sesi aktif (reconnect dengan profil normal)
/ppp/active/remove .id=*3

// Saat user reconnect → profile normal → Internet penuh ✅`}</CodeBlock>
              </>
            )}
          </section>

          {/* Section - Halaman Isolated */}
          <section id={mode === 'radius' ? 'section-8' : 'section-7'}>
            <SectionTitle number={mode === 'radius' ? 8 : 7} title="Halaman Isolated (Customer-Facing)" />
            <Prose>
              <p>URL halaman isolasi:</p>
            </Prose>
            <CodeBlock>{`https://domain-anda.com/isolated?ip=192.168.200.50
# atau
https://domain-anda.com/isolated?username=EMG011`}</CodeBlock>
            <h3 className="font-semibold text-lg mt-4 mb-2">Cara Redirect Terjadi</h3>
            <CodeBlock>{`1. MikroTik NAT intercept HTTP/HTTPS dari IP isolation pool (address-list=isolir)
2. Request diteruskan ke billing server (103.x.x.x:80/443)
3. Next.js Middleware (proxy.ts) deteksi source IP dari isolation pool
4. Middleware redirect ke /isolated?ip=192.168.200.x
5. Halaman /isolated tampilkan info akun + invoice + tombol bayar`}</CodeBlock>
            <InfoBox type="info">
              API <Code>/api/pppoe/users/check-isolation</Code> bersifat <strong>publik</strong> (tidak butuh login admin) karena diakses oleh customer yang sedang diisolasi untuk melihat info akun dan invoice mereka sendiri.
            </InfoBox>
          </section>

          {/* Section - Pengaturan Admin */}
          <section id={mode === 'radius' ? 'section-9' : 'section-8'}>
            <SectionTitle number={mode === 'radius' ? 9 : 8} title="Pengaturan Isolasi di Admin Panel" />
            <Prose><p>Lokasi: <strong>Admin Panel → Settings → Isolation</strong></p></Prose>
            <div className="overflow-x-auto mt-3">
              <table className="w-full text-sm border-collapse border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <thead className="bg-gray-100 dark:bg-gray-800">
                  <tr>
                    {['Setting', 'Default', 'Keterangan'].map(h => (
                      <th key={h} className="text-left px-4 py-2 font-semibold border border-gray-200 dark:border-gray-700">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {[
                    ['isolationEnabled', 'true', 'Aktifkan/matikan auto-isolasi'],
                    ['isolationIpPool', '192.168.200.0/24', 'CIDR pool IP untuk user isolated'],
                    ['isolationRateLimit', '64k/64k', 'Bandwidth limit format MikroTik (hanya berlaku di profile MikroTik)'],
                    ['isolationRedirectUrl', '{baseUrl}/isolated', 'URL redirect halaman isolasi'],
                    ['isolationMessage', '(teks default)', 'Pesan yang ditampilkan ke user'],
                    ['isolationAllowDns', 'true', 'User isolated boleh query DNS'],
                    ['isolationAllowPayment', 'true', 'User isolated boleh akses payment gateway'],
                    ['isolationNotifyWhatsapp', 'true', 'Kirim notif WhatsApp saat isolasi'],
                    ['isolationNotifyEmail', 'false', 'Kirim notif email saat isolasi'],
                    ['gracePeriodDays', '0', 'Hari toleransi setelah expired sebelum diisolir'],
                  ].map(([setting, def, ket]) => (
                    <tr key={setting} className="bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-4 py-2 font-mono text-xs text-blue-700 dark:text-blue-300 border border-gray-200 dark:border-gray-700">{setting}</td>
                      <td className="px-4 py-2 font-mono text-xs border border-gray-200 dark:border-gray-700">{def}</td>
                      <td className="px-4 py-2 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700">{ket}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Section - Troubleshooting */}
          <section id={mode === 'radius' ? 'section-10' : 'section-9'}>
            <SectionTitle number={mode === 'radius' ? 10 : 9} title={`Troubleshooting (${mode === 'non-radius' ? 'Non-RADIUS' : 'RADIUS'})`} />

            <TroubleshootBlock title="User Expired Tidak Diisolir">
              <CodeBlock>{`# 1. Cek apakah cron berjalan
pm2 logs EugineBill-cron --lines 100 | grep "AUTO-ISOLATE"

# 2. Trigger manual
curl -X POST http://localhost:3000/api/cron \\
  -H "Content-Type: application/json" \\
  -d '{"type": "pppoe_auto_isolir"}'

# 3. Cek database
SELECT username, status, expiredAt, routerId
FROM pppoe_users
WHERE status = 'active' AND expiredAt < CURDATE();${mode === 'non-radius' ? `

# 4. Pastikan routerId terisi! (Non-RADIUS wajib punya router)
# Jika routerId NULL, sistem tidak bisa menghubungi MikroTik API` : ''}`}</CodeBlock>
            </TroubleshootBlock>

            {mode === 'non-radius' ? (
              <TroubleshootBlock title="User Isolated Masih Bisa Akses Internet">
                <CodeBlock>{`# Di MikroTik — cek profil PPP Secret user
/ppp/secret/print where name=EMG011
# Harus: profile=isolir

# Cek address-list (user harus ada di sini saat connect)
/ip firewall address-list print where list=isolir

# Cek rule firewall (harus ada rule drop untuk src-address-list=isolir)
/ip firewall filter print

# Cek apakah user punya IP dari pool-isolir
/ppp active print where name=EMG011
# Harus: address=192.168.200.x

# Jika profil sudah isolir tapi IP masih normal:
# → User belum reconnect! Kick manual:
/ppp active remove [find name=EMG011]`}</CodeBlock>
              </TroubleshootBlock>
            ) : (
              <TroubleshootBlock title="User Isolated Masih Bisa Akses Internet">
                <CodeBlock>{`# Di MikroTik — cek apakah user dapat IP dari pool-isolir
/ppp active print where name=USERNAME

# Cek radusergroup
SELECT * FROM radusergroup WHERE username = 'USERNAME';
-- Harus: groupname = 'isolir'

# Pastikan user reconnect setelah diisolir!`}</CodeBlock>
              </TroubleshootBlock>
            )}

            <TroubleshootBlock title="Halaman /isolated Tidak Muncul">
              <CodeBlock>{`# Cek rule NAT MikroTik
/ip firewall nat print

${mode === 'non-radius'
  ? `# Cek apakah address-list terisi saat user connect
/ip firewall address-list print where list=isolir

# Cek profile MikroTik
/ppp/secret/print where name=EMG011
# profile HARUS = isolir

# Cek middleware log
pm2 logs EugineBill-radius --lines 20 | grep PROXY`
  : `# Cek apakah user dapat IP dari pool-isolir
/ip pool used print where pool=pool-isolir

# Cek middleware log
pm2 logs EugineBill-radius --lines 20 | grep PROXY`}`}</CodeBlock>
            </TroubleshootBlock>

            <TroubleshootBlock title="Info User Tidak Muncul di Halaman /isolated">
              <CodeBlock>{`# Test endpoint langsung
curl "https://domain-anda.com/api/pppoe/users/check-isolation?ip=192.168.200.50"

# Atau via username
curl "https://domain-anda.com/api/pppoe/users/check-isolation?username=EMG011"

# Pastikan user sudah reconnect PPPoE setelah diisolir
# (IP lama mungkin belum berubah ke pool-isolir)`}</CodeBlock>
            </TroubleshootBlock>

            <TroubleshootBlock title="Setelah Bayar, User Masih Terisolasi">
              <CodeBlock>{`# Cek status di database
SELECT status FROM pppoe_users WHERE username = 'EMG011';
# Harus: active

${mode === 'non-radius'
  ? `# Cek profil PPP Secret di MikroTik
/ppp/secret/print where name=EMG011
# Harus: profile = NamaProfilNormal (bukan isolir)

# Jika masih isolir, kick manual:
/ppp active remove [find name=EMG011]
# User reconnect → dapat profil & IP normal ✅`
  : `# Cek radusergroup
SELECT groupname FROM radusergroup WHERE username = 'USERNAME';
# Harus: profile normal (bukan isolir)

# User HARUS disconnect dan reconnect PPPoE setelah pembayaran!`}`}</CodeBlock>
            </TroubleshootBlock>

            {mode === 'non-radius' && (
              <TroubleshootBlock title="MikroTik API Gagal (routerId tidak ditemukan)">
                <CodeBlock>{`# Pastikan user terhubung ke router
SELECT username, routerId FROM pppoe_users WHERE username = 'EMG011';

# Pastikan router ada dan bisa diakses
SELECT id, name, ipAddress, apiPort FROM routers;

# Test koneksi MikroTik API dari server
curl -u admin:password http://192.168.1.1:8728/rest/ppp/secret

# Cek log isolasi
pm2 logs EugineBill-radius --lines 50 | grep "ISOLATE\|MikroTik"`}</CodeBlock>
              </TroubleshootBlock>
            )}
          </section>

          {/* Section - Status Differences */}
          <section id={mode === 'radius' ? 'section-11' : 'section-10'}>
            <SectionTitle number={mode === 'radius' ? 11 : 10} title="Perbedaan Status: isolated vs blocked vs stop" />
            <InfoBox type="info">
              <strong>Kenapa isolated TIDAK memblokir login sepenuhnya?</strong>
              <br /><br />
              Berbeda dengan <Code>blocked</Code>/<Code>stop</Code>, user <Code>isolated</Code> <strong>masih boleh login</strong> PPPoE karena:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Mereka perlu connect untuk bisa melihat halaman pembayaran</li>
                <li>Tanpa connect, mereka tidak tahu harus bayar ke mana</li>
                <li>Sistem membatasi akses via MikroTik (IP pool + firewall), bukan via {mode === 'non-radius' ? 'disable PPP Secret' : 'RADIUS reject'}</li>
              </ul>
            </InfoBox>
            <CodeBlock>{mode === 'non-radius'
              ? `ALUR SINGKAT (Non-RADIUS):
expiredAt < hari ini
└──► (Cron setiap jam)
     └──► status = isolated
          └──► MikroTik API: profile = isolir + kick session
               └──► (User reconnect)
                    └──► IP: 192.168.200.x (pool-isolir)
                         └──► (Browser)
                              └──► MikroTik NAT redirect → /isolated
                                   └──► User bayar invoice
                                        └──► status = active
                                             └──► MikroTik API: profile = normal + kick
                                                  └──► (Reconnect PPPoE)
                                                       └──► Internet penuh ✅`
              : `ALUR SINGKAT (RADIUS):
expiredAt < hari ini
└──► (Cron setiap jam)
     └──► status = isolated
          └──► radusergroup = 'isolir'
               └──► (User reconnect)
                    └──► IP: 192.168.200.x
                         └──► (Browser)
                              └──► MikroTik NAT redirect → /isolated
                                   └──► User bayar invoice
                                        └──► status = active
                                             └──► radusergroup = profile normal
                                                  └──► (Reconnect PPPoE)
                                                       └──► Internet penuh ✅`}</CodeBlock>
          </section>

        </div>

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-gray-200 dark:border-gray-700 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>EugineBill — Isolation System Documentation</p>
          <p className="mt-1 text-xs">Mode saat ini: <strong>{mode === 'non-radius' ? 'Non-RADIUS (MikroTik API Direct)' : 'FreeRADIUS'}</strong></p>
          <Link href="/admin/settings/isolation" className="text-blue-600 hover:underline mt-1 inline-block">
            ← Kembali ke Isolation Settings
          </Link>
        </div>

      </div>
    </div>
  );
}

// ─── Component helpers ───────────────────────────────────────────────────

function SectionTitle({ number, title }: { number: number; title: string }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <span className="w-8 h-8 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center flex-shrink-0">
        {number}
      </span>
      <h2 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h2>
    </div>
  );
}

function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="prose prose-sm prose-gray dark:prose-invert max-w-none space-y-2 text-gray-700 dark:text-gray-300 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1">
      {children}
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-gray-100 dark:bg-gray-800 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded text-xs font-mono">
      {children}
    </code>
  );
}

function CodeBlock({ children }: { children: React.ReactNode }) {
  return (
    <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto text-xs font-mono leading-relaxed mt-2 mb-4 whitespace-pre-wrap">
      {children}
    </pre>
  );
}

function InfoBox({ type, children }: { type: 'info' | 'warning'; children: React.ReactNode }) {
  const styles = {
    info: 'bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-200',
    warning: 'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-200',
  };
  return (
    <div className={`border rounded-lg p-4 my-3 text-sm ${styles[type]}`}>
      {children}
    </div>
  );
}

function TroubleshootBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h3 className="font-semibold text-base text-gray-800 dark:text-gray-200 mb-2 flex items-center gap-2">
        <span className="text-red-500">●</span> {title}
      </h3>
      {children}
    </div>
  );
}
