/**
 * Standalone Script: Force Reassign Areas, PPPoE Users, & Invoices
 *
 * Di-force 100% untuk memperbaiki masalah hapus router sebelumnya:
 * - KAMPUNG TEGAL -> Router Citeureup
 * - KAMPUNG MUARA BERES, PURI NIRWANA 3, KAMPUNG PISANG, & SELURUH AREA LAINNYA -> Router Cibinong
 *
 * Force-update ALL pppoeUser & ALL invoice records!
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

function normStr(str) {
  if (!str) return ''
  return String(str).toLowerCase().trim()
}

async function main() {
  console.log('=== DIAGNOSTIK & PEMISAHAN TOTAL PAKSA (FORCE REASSIGN) ===\n')

  const routers = await prisma.router.findMany({
    orderBy: { createdAt: 'asc' },
  })

  if (routers.length === 0) {
    console.error('❌ Error: Tidak ada router yang terdaftar di database.')
    process.exit(1)
  }

  // Cari router Citeureup & Cibinong
  const citeureupRouter = routers.find((r) => r.name.toLowerCase().includes('citeureup')) ||
    routers.find((r) => r.ipAddress === '103.157.79.178' || r.nasname === '103.157.79.178') ||
    routers[0]

  const cibinongRouter = routers.find((r) => r.id !== citeureupRouter.id && (r.name.toLowerCase().includes('cibinong') || r.ipAddress.startsWith('10.'))) ||
    routers.find((r) => r.id !== citeureupRouter.id) ||
    routers[0]

  console.log(`✅ Router Citeureup ID: ${citeureupRouter.id} (${citeureupRouter.name})`)
  console.log(`✅ Router Cibinong  ID: ${cibinongRouter.id} (${cibinongRouter.name})\n`)

  // 1. Reassign Areas
  const areas = await prisma.pppoeArea.findMany()

  let citeureupAreaIds = []
  let cibinongAreaIds = []

  for (const area of areas) {
    const isTegal = area.name.toLowerCase().includes('tegal')
    if (isTegal) {
      citeureupAreaIds.push(area.id)
    } else {
      cibinongAreaIds.push(area.id)
    }
  }

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

  // 2. Reassign ALL PPPoE Users strictly by Area or address/comment
  await prisma.pppoeUser.updateMany({
    where: {
      OR: [
        { areaId: { in: citeureupAreaIds } },
        { address: { contains: 'tegal' } },
        { comment: { contains: 'tegal' } },
      ],
    },
    data: { routerId: citeureupRouter.id },
  })

  await prisma.pppoeUser.updateMany({
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

  // 3. FORCE RE-LINK ALL INVOICES
  // Fetch all users with their new routerId
  const allUsers = await prisma.pppoeUser.findMany({
    select: { id: true, username: true, name: true, phone: true, customerId: true, routerId: true, areaId: true },
  })

  const userById = new Map(allUsers.map((u) => [u.id, u]))
  const userByUsername = new Map()
  const userByName = new Map()
  const userByPhone = new Map()

  for (const u of allUsers) {
    if (u.username) userByUsername.set(normStr(u.username), u)
    if (u.name) userByName.set(normStr(u.name), u)
    if (u.phone) {
      let cleanP = u.phone.replace(/[^0-9]/g, '')
      if (cleanP.startsWith('62')) cleanP = '0' + cleanP.slice(2)
      userByPhone.set(cleanP, u)
    }
  }

  const allInvoices = await prisma.invoice.findMany({
    select: {
      id: true,
      userId: true,
      customerName: true,
      customerUsername: true,
      customerPhone: true,
      invoiceNumber: true,
      status: true,
    },
  })

  console.log(`Total Invoice di Database: ${allInvoices.length}`)

  let linkedInvoicesCount = 0
  let matchedCiteureupInvoices = 0
  let matchedCibinongInvoices = 0

  for (const inv of allInvoices) {
    let matchedUser = null

    // Match priority: username -> name -> phone -> existing userId
    if (inv.customerUsername && userByUsername.has(normStr(inv.customerUsername))) {
      matchedUser = userByUsername.get(normStr(inv.customerUsername))
    } else if (inv.customerName && userByName.has(normStr(inv.customerName))) {
      matchedUser = userByName.get(normStr(inv.customerName))
    } else if (inv.customerPhone) {
      let cleanP = inv.customerPhone.replace(/[^0-9]/g, '')
      if (cleanP.startsWith('62')) cleanP = '0' + cleanP.slice(2)
      if (userByPhone.has(cleanP)) matchedUser = userByPhone.get(cleanP)
    } else if (inv.userId && userById.has(inv.userId)) {
      matchedUser = userById.get(inv.userId)
    }

    if (matchedUser) {
      // Force update userId agar 100% tersambung ke user yang tepat di DB
      if (inv.userId !== matchedUser.id) {
        await prisma.invoice.update({
          where: { id: inv.id },
          data: { userId: matchedUser.id },
        })
        linkedInvoicesCount++
      }

      if (matchedUser.routerId === citeureupRouter.id) {
        matchedCiteureupInvoices++
      } else {
        matchedCibinongInvoices++
      }
    } else {
      // Unmatched invoice fallback:
      // Check if invoice customerName or customerUsername mentions 'tegal'
      const isTegal = normStr(inv.customerName).includes('tegal') || normStr(inv.customerUsername).includes('tegal')
      if (isTegal) {
        matchedCiteureupInvoices++
      } else {
        // Fallback orphan invoice belongs to Cibinong
        matchedCibinongInvoices++
      }
    }
  }

  // 4. Verification Count
  const usersCiteureupCount = await prisma.pppoeUser.count({ where: { routerId: citeureupRouter.id } })
  const usersCibinongCount = await prisma.pppoeUser.count({ where: { routerId: cibinongRouter.id } })

  const citeureupUnpaid = await prisma.invoice.count({
    where: {
      status: { in: ['PENDING', 'OVERDUE'] },
      user: { routerId: citeureupRouter.id },
    },
  })

  const cibinongUnpaid = await prisma.invoice.count({
    where: {
      status: { in: ['PENDING', 'OVERDUE'] },
      user: { routerId: cibinongRouter.id },
    },
  })

  const citeureupTotalAll = await prisma.invoice.count({
    where: { user: { routerId: citeureupRouter.id } },
  })

  const cibinongTotalAll = await prisma.invoice.count({
    where: { user: { routerId: cibinongRouter.id } },
  })

  console.log('\n=== REAPORT HASIL PEMISAHAN PAKSA ===')
  console.log(`📍 CITEUREUP (Kampung Tegal):`)
  console.log(`   - Pelanggan Aktif   : ${usersCiteureupCount} user`)
  console.log(`   - Tagihan Belum Lunas: ${citeureupUnpaid} tagihan`)
  console.log(`   - Total Riwayat Tagihan: ${citeureupTotalAll} tagihan\n`)

  console.log(`📍 CIBINONG (Muara Beres, Puri Nirwana 3, Pisang, dll):`)
  console.log(`   - Pelanggan Aktif   : ${usersCibinongCount} user`)
  console.log(`   - Tagihan Belum Lunas: ${cibinongUnpaid} tagihan`)
  console.log(`   - Total Riwayat Tagihan: ${cibinongTotalAll} tagihan\n`)

  console.log(`🔗 Di-update / Disambungkan Ulang: ${linkedInvoicesCount} tagihan`)
  console.log('✅ REASSIGNMENT SELESAI!')
}

main()
  .catch((err) => {
    console.error('❌ Occurred error:', err)
    process.exit(1)
  })
  .finally(() => {
    prisma.$disconnect()
  })
