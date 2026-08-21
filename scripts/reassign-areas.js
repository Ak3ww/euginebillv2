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

// Normalize phone helper
function normalizePhone(p) {
  if (!p) return ''
  let clean = String(p).replace(/[^0-9]/g, '')
  if (clean.startsWith('62')) clean = '0' + clean.slice(2)
  if (clean.startsWith('8')) clean = '08' + clean.slice(1)
  return clean
}

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

  // 3. Deep Match & Link ALL Invoices to pppoeUser
  const allUsers = await prisma.pppoeUser.findMany({
    select: { id: true, username: true, name: true, phone: true, customerId: true, routerId: true },
  })

  const userById = new Map(allUsers.map((u) => [u.id, u]))
  const userByUsername = new Map()
  const userByPhone = new Map()
  const userByName = new Map()

  for (const u of allUsers) {
    if (u.username) userByUsername.set(u.username.toLowerCase().trim(), u)
    if (u.phone) userByPhone.set(normalizePhone(u.phone), u)
    if (u.name) userByName.set(u.name.toLowerCase().trim(), u)
  }

  const allInvoices = await prisma.invoice.findMany({
    select: {
      id: true,
      userId: true,
      customerUsername: true,
      customerPhone: true,
      customerName: true,
      status: true,
      createdAt: true,
    },
  })

  let updatedInvoiceUserLinks = 0

  for (const inv of allInvoices) {
    let targetUser = null

    // 1. Check existing userId link
    if (inv.userId && userById.has(inv.userId)) {
      targetUser = userById.get(inv.userId)
    }

    // 2. Check customerUsername match
    if (!targetUser && inv.customerUsername) {
      const uKey = inv.customerUsername.toLowerCase().trim()
      if (userByUsername.has(uKey)) targetUser = userByUsername.get(uKey)
    }

    // 3. Check customerPhone match
    if (!targetUser && inv.customerPhone) {
      const pKey = normalizePhone(inv.customerPhone)
      if (pKey && userByPhone.has(pKey)) targetUser = userByPhone.get(pKey)
    }

    // 4. Check customerName match
    if (!targetUser && inv.customerName) {
      const nKey = inv.customerName.toLowerCase().trim()
      if (userByName.has(nKey)) targetUser = userByName.get(nKey)
    }

    if (targetUser && inv.userId !== targetUser.id) {
      await prisma.invoice.update({
        where: { id: inv.id },
        data: { userId: targetUser.id },
      })
      updatedInvoiceUserLinks++
    }
  }

  // 4. Hitung rincian Tagihan setelah re-linking
  const updatedInvoices = await prisma.invoice.findMany({
    select: {
      id: true,
      userId: true,
      customerUsername: true,
      status: true,
      createdAt: true,
      user: {
        select: { routerId: true },
      },
    },
  })

  let citeureupTotalInvoices = 0
  let cibinongTotalInvoices = 0
  let citeureupUnpaidInvoices = 0
  let cibinongUnpaidInvoices = 0
  let unlinkedInvoicesCount = 0

  for (const inv of updatedInvoices) {
    const rId = inv.user?.routerId

    if (rId === citeureupRouter.id) {
      citeureupTotalInvoices++
      if (inv.status === 'PENDING' || inv.status === 'OVERDUE') citeureupUnpaidInvoices++
    } else if (rId === cibinongRouter.id) {
      cibinongTotalInvoices++
      if (inv.status === 'PENDING' || inv.status === 'OVERDUE') cibinongUnpaidInvoices++
    } else {
      // Default unlinked fallback to Cibinong if not Tegal
      cibinongTotalInvoices++
      if (inv.status === 'PENDING' || inv.status === 'OVERDUE') cibinongUnpaidInvoices++
      unlinkedInvoicesCount++
    }
  }

  console.log('=== HASIL EKSEKUSI PEMISAHAN PELANGGAN & TAGIHAN ===')
  console.log(`📍 Citeureup:`)
  console.log(`   - Area assigned     : ${citeureupAreaNames.join(', ') || '(KAMPUNG TEGAL)'}`)
  console.log(`   - Pelanggan Aktif   : ${usersInTegalArea.count} user`)
  console.log(`   - Tagihan Belum Lunas: ${citeureupUnpaidInvoices} tagihan`)
  console.log(`   - Total Riwayat     : ${citeureupTotalInvoices} tagihan (termasuk riwayat bulan-bulan lalu)\n`)

  console.log(`📍 Cibinong:`)
  console.log(`   - Area assigned     : ${cibinongAreaNames.join(', ') || '(MUARA BERES, PURI NIRWANA 3, PISANG, dll)'}`)
  console.log(`   - Pelanggan Aktif   : ${usersInCibinong.count} user`)
  console.log(`   - Tagihan Belum Lunas: ${cibinongUnpaidInvoices} tagihan`)
  console.log(`   - Total Riwayat     : ${cibinongTotalInvoices} tagihan (termasuk riwayat bulan-bulan lalu)\n`)

  if (updatedInvoiceUserLinks > 0) {
    console.log(`🔗 Berhasil menyatukan ${updatedInvoiceUserLinks} tagihan ke akun pelanggan yang pas (by username/phone/name)`)
  }

  console.log('✅ PROSES REASSIGNMENT SELESAI 100%!')
}

main()
  .catch((err) => {
    console.error('❌ Occurred error:', err)
    process.exit(1)
  })
  .finally(() => {
    prisma.$disconnect()
  })
