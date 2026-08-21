/**
 * VPN Port Allocator
 *
 * Otomatis mengalokasikan port publik VPS yang unik untuk setiap MikroTik
 * yang terhubung via WireGuard atau L2TP.
 *
 * Setiap router mendapatkan blok 10 port publik berurutan, dimulai dari BASE_PORT (10001).
 * Port target (internal MikroTik) TIDAK diasumsikan sama — harus dikonfigurasi per router
 * karena setiap MikroTik bisa memiliki port layanan yang berbeda.
 *
 * Struktur publicPorts di DB:
 * {
 *   blockStart: 10001,
 *   services: {
 *     winbox:  { public: 10001, target: 8291 },
 *     api:     { public: 10002, target: 8728 },
 *     apiSsl:  { public: 10003, target: 8729 },
 *     www:     { public: 10004, target: 80 },
 *     wwwSsl:  { public: 10005, target: 443 },
 *     ssh:     { public: 10006, target: 22 },
 *     ftp:     { public: 10007, target: 21 },
 *     telnet:  { public: 10008, target: 23 },
 *   }
 * }
 *
 * Saat iptables DNAT dibuat: VPS_IP:public → MikroTik_VPN_IP:target
 */

import { exec as execCb } from 'child_process'
import { promisify } from 'util'
import { prisma } from '@/server/db/client'

const exec = promisify(execCb)

const BASE_PORT = 10001
const BLOCK_SIZE = 10 // 10 port per router (8 services + 2 reserved)

// Nama service yang dikenal
export type ServiceName = 'winbox' | 'api' | 'apiSsl' | 'www' | 'wwwSsl' | 'ssh' | 'ftp' | 'telnet'

// Offset dalam blok per service
export const SERVICE_OFFSET: Record<ServiceName, number> = {
  winbox:  0,
  api:     1,
  apiSsl:  2,
  www:     3,
  wwwSsl:  4,
  ssh:     5,
  ftp:     6,
  telnet:  7,
}

// Port default internal MikroTik — HANYA sebagai default awal, bisa dioverride per router
export const DEFAULT_MIKROTIK_PORTS: Record<ServiceName, number> = {
  winbox:  8291,
  api:     8728,
  apiSsl:  8729,
  www:     80,
  wwwSsl:  443,
  ssh:     22,
  ftp:     21,
  telnet:  23,
}

export interface ServicePortEntry {
  public: number  // Port publik VPS
  target: number  // Port aktual di MikroTik (bisa berbeda per router)
}

export interface PublicPorts {
  blockStart: number
  services: Record<ServiceName, ServicePortEntry>
}

/**
 * Buat PublicPorts dari blockStart dan target ports yang dikonfigurasi admin.
 * targetPorts adalah override dari default — jika tidak ada, pakai default.
 *
 * @param blockStart   - Port publik pertama dalam blok
 * @param targetPorts  - Port target aktual per layanan (misal dari form admin)
 */
export function buildPublicPorts(
  blockStart: number,
  targetPorts: Partial<Record<ServiceName, number>> = {}
): PublicPorts {
  const services = {} as Record<ServiceName, ServicePortEntry>
  for (const [svc, offset] of Object.entries(SERVICE_OFFSET) as [ServiceName, number][]) {
    services[svc] = {
      public: blockStart + offset,
      target: targetPorts[svc] ?? DEFAULT_MIKROTIK_PORTS[svc],
    }
  }
  return { blockStart, services }
}

/**
 * Cari block port berikutnya yang belum terpakai dari DB.
 * Mengembalikan blockStart (kelipatan BLOCK_SIZE dari BASE_PORT).
 */
export async function getNextPortBlock(): Promise<number> {
  // Ambil semua publicPorts yang sudah terpakai dari DB
  const clients = await prisma.vpnClient.findMany({
    select: { publicPorts: true },
  })

  const usedBlocks = new Set<number>()
  for (const c of clients) {
    if (c.publicPorts && typeof c.publicPorts === 'object') {
      const p = c.publicPorts as { blockStart?: number }
      if (p.blockStart) usedBlocks.add(p.blockStart)
    }
  }

  // Cari blockStart pertama yang belum terpakai
  for (let block = BASE_PORT; block < BASE_PORT + BLOCK_SIZE * 500; block += BLOCK_SIZE) {
    if (!usedBlocks.has(block)) return block
  }

  throw new Error('Port pool habis (max 500 router)')
}

/**
 * Daftarkan iptables PREROUTING DNAT rules untuk semua service.
 * Menggunakan target port aktual dari setiap ServicePortEntry (bukan hardcoded).
 * Hanya menambahkan jika rule belum ada (idempotent).
 *
 * @param vpnIp   - IP VPN internal MikroTik (misal 10.200.0.2)
 * @param ports   - PublicPorts yang sudah dialokasikan
 * @param services - Service yang mau diforward (default semua)
 */
export async function addIptablesRules(
  vpnIp: string,
  ports: PublicPorts,
  services: ServiceName[] = Object.keys(SERVICE_OFFSET) as ServiceName[]
): Promise<void> {
  for (const svc of services) {
    const entry = ports.services[svc]
    if (!entry) continue

    const { public: publicPort, target: targetPort } = entry

    try {
      // Cek PREROUTING DNAT rule
      await exec(
        `iptables -t nat -C PREROUTING -p tcp --dport ${publicPort} -j DNAT --to-destination ${vpnIp}:${targetPort} 2>/dev/null` +
        ` || iptables -t nat -A PREROUTING -p tcp --dport ${publicPort} -j DNAT --to-destination ${vpnIp}:${targetPort}`,
        { shell: '/bin/bash' }
      )
      // Cek FORWARD rule
      await exec(
        `iptables -C FORWARD -p tcp -d ${vpnIp} --dport ${targetPort} -j ACCEPT 2>/dev/null` +
        ` || iptables -A FORWARD -p tcp -d ${vpnIp} --dport ${targetPort} -j ACCEPT`,
        { shell: '/bin/bash' }
      )
      // Buka port publik di ufw jika tersedia
      await exec(`ufw allow ${publicPort}/tcp 2>/dev/null || true`, { shell: '/bin/bash' })
    } catch {
      // Non-fatal: VPS mungkin tidak punya iptables (dev environment)
    }
  }
}

/**
 * Hapus iptables PREROUTING DNAT rules untuk semua service (saat peer dihapus).
 *
 * @param vpnIp  - IP VPN internal MikroTik
 * @param ports  - PublicPorts yang sudah dialokasikan
 */
export async function removeIptablesRules(
  vpnIp: string,
  ports: PublicPorts,
  services: ServiceName[] = Object.keys(SERVICE_OFFSET) as ServiceName[]
): Promise<void> {
  for (const svc of services) {
    const entry = ports.services[svc]
    if (!entry) continue

    const { public: publicPort, target: targetPort } = entry

    try {
      await exec(
        `iptables -t nat -D PREROUTING -p tcp --dport ${publicPort} -j DNAT --to-destination ${vpnIp}:${targetPort} 2>/dev/null || true`,
        { shell: '/bin/bash' }
      )
      await exec(
        `iptables -D FORWARD -p tcp -d ${vpnIp} --dport ${targetPort} -j ACCEPT 2>/dev/null || true`,
        { shell: '/bin/bash' }
      )
      await exec(`ufw delete allow ${publicPort}/tcp 2>/dev/null || true`, { shell: '/bin/bash' })
    } catch {
      // Non-fatal
    }
  }
}

/**
 * Lookup publicPorts dari vpnClient berdasarkan vpnIp.
 * Mengembalikan null jika client tidak ditemukan atau belum punya ports.
 */
export async function getPublicPortsByVpnIp(vpnIp: string): Promise<PublicPorts | null> {
  const client = await prisma.vpnClient.findFirst({
    where: { vpnIp },
    select: { publicPorts: true },
  })
  if (!client?.publicPorts) return null
  return client.publicPorts as unknown as PublicPorts
}

/**
 * Helper untuk mendapatkan URL akses remote per layanan.
 * Mengembalikan `VPS_PUBLIC_IP:publicPort` string.
 */
export function getRemoteAccessUrl(
  vpsPublicIp: string,
  ports: PublicPorts,
  service: ServiceName
): string | null {
  const entry = ports.services[service]
  if (!entry) return null
  return `${vpsPublicIp}:${entry.public}`
}
