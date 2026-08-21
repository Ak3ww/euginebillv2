/**
 * Standalone Script: Reassign Areas, PPPoE Users, & Invoices
 *
 * Mengalokasikan ulang wilayah, pelanggan PPPoE, dan tagihan:
 * - Area/Wilayah dengan nama "Tegal" / "Kampung Tegal" -> Router Citeureup
 * - Seluruh Wilayah, Pelanggan, dan Tagihan sisanya -> Router Cibinong
 *
 * Jalankan langsung di VPS via:
 *   node scripts/reassign-areas.js
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('=== MEMULAI REASSIGN AREA, PELANGGAN, & TAGIHAN PPPOE ===\n')

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

  // 3. Auto-link unlinked invoices (userId = null) to pppoeUser by customerUsername or customerPhone
  const unlinkedInvoices = await prisma.invoice.findMany({
    where: { userId: null },
    select: { id: true, customerUsername: true, customerPhone: true },
  })

  let linkedInvoicesCount = 0
  if (unlinkedInvoices.length > 0) {
    const allUsers = await prisma.pppoeUser.findMany({
      select: { id: true, username: true, phone: true },
    })
    const userByUsername = new Map(allUsers.filter(u => u.username).map(u => [u.username, u.id]))
    const userByPhone = new Map(allUsers.filter(u => u.phone).map(u => [u.phone, u.id]))

    for (const inv of unlinkedInvoices) {
      let matchedUserId = null
      if (inv.customerUsername && userByUsername.has(inv.customerUsername)) {
        matchedUserId = userByUsername.get(inv.customerUsername)
      } else if (inv.customerPhone && userByPhone.has(inv.customerPhone)) {
        matchedUserId = userByPhone.get(inv.customerPhone)
      }

      if (matchedUserId) {
        await prisma.invoice.update({
          where: { id: inv.id },
          data: { userId: matchedUserId },
        })
        linkedInvoicesCount++
      }
    }
  }

  // Hitung jumlah tagihan per router sekarang
  const citeureupUsers = await prisma.pppoeUser.findMany({
    where: { routerId: citeureupRouter.id },
    select: { id: true, username: true },
  })
  const citeureupUserIds = citeureupUsers.map(u => u.id)
  const citeureupUsernames = citeureupUsers.map(u => u.username)

  const cibinongUsers = await prisma.pppoeUser.findMany({
    where: { routerId: cibinongRouter.id },
    select: { id: true, username: true },
  })
  const cibinongUserIds = cibinongUsers.map(u => u.id)
  const cibinongUsernames = cibinongUsers.map(u => u.username)

  const citeureupInvoicesCount = await prisma.invoice.count({
    where: {
      OR: [
        { userId: { in: citeureupUserIds } },
        { customerUsername: { in: citeureupUsernames } },
      ],
    },
  })

  const cibinongInvoicesCount = await prisma.invoice.count({
    where: {
      OR: [
        { userId: { in: cibinongUserIds } },
        { customerUsername: { in: cibinongUsernames } },
      ],
    },
  })

  console.log('=== HASIL EKSEKUSI PEMISAHAN ===')
  console.log(`📍 Citeureup:`)
  console.log(`   - Area assigned : ${citeureupAreaNames.join(', ') || '(tanpa area spesifik)'}`)
  console.log(`   - Pelanggan     : ${usersInTegalArea.count} user`)
  console.log(`   - Tagihan       : ${citeureupInvoicesCount} tagihan`)
  console.log(`📍 Cibinong:`)
  console.log(`   - Area assigned : ${cibinongAreaNames.join(', ') || '(seluruh area lainnya)'}`)
  console.log(`   - Pelanggan     : ${usersInCibinong.count} user`)
  console.log(`   - Tagihan       : ${cibinongInvoicesCount} tagihan`)
  if (linkedInvoicesCount > 0) {
    console.log(`🔗 Auto-linked ${linkedInvoicesCount} tagihan tanpa userId ke akun pelanggan`)
  }
  console.log('\n✅ PROSES SELESAI DENGAN SUKSES!')
}

main()
  .catch((err) => {
    console.error('❌ Occurred error:', err)
    process.exit(1)
  })
  .finally(() => {
    prisma.$disconnect()
  })
