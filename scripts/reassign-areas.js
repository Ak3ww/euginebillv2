/**
 * Standalone Script: Reassign Areas & PPPoE Users
 *
 * Mengalokasikan ulang wilayah dan pelanggan PPPoE:
 * - Area/Wilayah dengan nama "Tegal" / "Kampung Tegal" -> Router Citeureup
 * - Seluruh Wilayah & Pelanggan sisanya -> Router Cibinong
 *
 * Jalankan langsung di VPS via:
 *   node scripts/reassign-areas.js
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('=== MEMULAI REASSIGN AREA & PELANGGAN PPPOE ===\n')

  const routers = await prisma.router.findMany({
    orderBy: { createdAt: 'asc' },
  })

  if (routers.length === 0) {
    console.error('❌ Error: Tidak ada router yang terdaftar di database.')
    process.exit(1)
  }

  console.log('Daftar Router ditemukan di DB:')
  for (const r of routers) {
    console.log(` - ID: ${r.id} | Nama: ${r.name} | nasname: ${r.nasname} | IP: ${r.ipAddress}`)
  }
  console.log('')

  // Cari router Citeureup & Cibinong
  const citeureupRouter = routers.find((r) => r.name.toLowerCase().includes('citeureup')) ||
    routers.find((r) => r.ipAddress === '103.157.79.178' || r.nasname === '103.157.79.178') ||
    routers[0]

  const cibinongRouter = routers.find((r) => r.id !== citeureupRouter.id && (r.name.toLowerCase().includes('cibinong') || r.ipAddress.startsWith('10.'))) ||
    routers.find((r) => r.id !== citeureupRouter.id) ||
    routers[0]

  if (!citeureupRouter || !cibinongRouter || citeureupRouter.id === cibinongRouter.id) {
    console.error('❌ Error: Diperlukan minimal 2 router terpisah (Citeureup & Cibinong).')
    console.error('Pastikan Router Cibinong sudah dibuat di menu Routers / NAS.')
    process.exit(1)
  }

  console.log(`✅ Target Router Citeureup: [ID: ${citeureupRouter.id}] ${citeureupRouter.name}`)
  console.log(`✅ Target Router Cibinong : [ID: ${cibinongRouter.id}] ${cibinongRouter.name}\n`)

  // 1. Ambil semua area
  const areas = await prisma.pppoeArea.findMany()

  let citeureupAreaIds = []
  let cibinongAreaIds = []
  let citeureupAreaNames = []
  let cibinongAreaNames = []

  for (const area of areas) {
    const isTegal = area.name.toLowerCase().includes('tegal')
    if (isTegal) {
      citeureupAreaIds.push(area.id)
      citeureupAreaNames.push(area.name)
    } else {
      cibinongAreaIds.push(area.id)
      cibinongAreaNames.push(area.name)
    }
  }

  // Update routerId di pppoeArea
  if (citeureupAreaIds.length > 0) {
    await prisma.pppoeArea.updateMany({
      where: { id: { in: citeureupAreaIds } },
      data: { routerId: citeureupRouter.id },
    })
  }

  if (cibinongAreaIds.length > 0) {
    await prisma.pppoeArea.updateMany({
      where: { id: { in: cibinongAreaIds } },
      data: { routerId: cibinongRouter.id },
    })
  }

  // 2. Update pppoeUser
  // User di area Tegal -> Citeureup
  const usersInTegalArea = await prisma.pppoeUser.updateMany({
    where: {
      OR: [
        { areaId: { in: citeureupAreaIds } },
        { address: { contains: 'tegal' } },
        { comment: { contains: 'tegal' } },
      ],
    },
    data: { routerId: citeureupRouter.id },
  })

  // Seluruh user sisanya -> Cibinong
  const usersInCibinong = await prisma.pppoeUser.updateMany({
    where: {
      NOT: {
        OR: [
          { areaId: { in: citeureupAreaIds } },
          { address: { contains: 'tegal' } },
          { comment: { contains: 'tegal' } },
        ],
      },
    },
    data: { routerId: cibinongRouter.id },
  })

  console.log('=== HASIL EKSEKUSI PEMISAHAN ===')
  console.log(`📍 Citeureup:`)
  console.log(`   - Area assigned : ${citeureupAreaNames.join(', ') || '(tanpa area spesifik)'}`)
  console.log(`   - Pelanggan     : ${usersInTegalArea.count} user`)
  console.log(`📍 Cibinong:`)
  console.log(`   - Area assigned : ${cibinongAreaNames.join(', ') || '(seluruh area lainnya)'}`)
  console.log(`   - Pelanggan     : ${usersInCibinong.count} user\n`)

  console.log('✅ PROSES SELESAI DENGAN SUKSES!')
}

main()
  .catch((err) => {
    console.error('❌ Occurred error:', err)
    process.exit(1)
  })
  .finally(() => {
    prisma.$disconnect()
  })
