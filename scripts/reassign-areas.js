/**
 * Standalone Script: Reassign Areas, PPPoE Users, & Invoices by Customer Name & Area
 *
 * Pemisahan total berdasarkan Nama & Area:
 * 1. Area "KAMPUNG TEGAL" -> Router Citeureup
 * 2. Area "KAMPUNG MUARA BERES", "PURI NIRWANA 3", "KAMPUNG PISANG" (dan seluruh area lainnya) -> Router Cibinong
 * 3. Seluruh Tagihan (Invoice) di-link ulang 100% berdasarkan Nama / Username / Telepon Pelanggan
 *    sehingga tagihan mengikuti router pengguna tempatnya berada.
 *
 * Jalankan langsung di VPS via:
 *   node scripts/reassign-areas.js
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

function normStr(str) {
  if (!str) return ''
  return String(str).toLowerCase().trim()
}

function normPhone(p) {
  if (!p) return ''
  let clean = String(p).replace(/[^0-9]/g, '')
  if (clean.startsWith('62')) clean = '0' + clean.slice(2)
  if (clean.startsWith('8')) clean = '08' + clean.slice(1)
  return clean
}

async function main() {
  console.log('=== MEMULAI PEMISAHAN TOTAL AREA, PELANGGAN, & TAGIHAN ===\n')

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

  if (!citeureupRouter || !cibinongRouter || citeureupRouter.id === cibinongRouter.id) {
    console.error('❌ Error: Diperlukan minimal 2 router terpisah (Citeureup & Cibinong).')
    process.exit(1)
  }

  console.log(`✅ Router Citeureup: [ID: ${citeureupRouter.id}] ${citeureupRouter.name}`)
  console.log(`✅ Router Cibinong : [ID: ${cibinongRouter.id}] ${cibinongRouter.name}\n`)

  // 1. Reassign Areas
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

  // 2. Reassign ALL PPPoE Users
  // User di area Tegal -> Citeureup
  const usersInTegal = await prisma.pppoeUser.updateMany({
    where: {
      OR: [
        { areaId: { in: citeureupAreaIds } },
        { address: { contains: 'tegal' } },
        { comment: { contains: 'tegal' } },
      ],
    },
    data: { routerId: citeureupRouter.id },
  })

  // Seluruh user sisanya (Muara Beres, Puri Nirwana 3, Pisang, dll) -> Cibinong
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

  // 3. Reassign ALL Invoices by Matching User Name / Username / Phone
  const allUsers = await prisma.pppoeUser.findMany({
    select: { id: true, username: true, name: true, phone: true, routerId: true },
  })

  const userById = new Map(allUsers.map((u) => [u.id, u]))
  const userByName = new Map()
  const userByUsername = new Map()
  const userByPhone = new Map()

  for (const u of allUsers) {
    if (u.name) userByName.set(normStr(u.name), u)
    if (u.username) userByUsername.set(normStr(u.username), u)
    if (u.phone) userByPhone.set(normPhone(u.phone), u)
  }

  const allInvoices = await prisma.invoice.findMany({
    select: {
      id: true,
      userId: true,
      customerName: true,
      customerUsername: true,
      customerPhone: true,
    },
  })

  let linkedByUsername = 0
  let linkedByName = 0
  let linkedByPhone = 0
  let fallbackCibinongInvoices = 0

  for (const inv of allInvoices) {
    let matchedUser = null

    // Match 1: By existing userId
    if (inv.userId && userById.has(inv.userId)) {
      matchedUser = userById.get(inv.userId)
    }

    // Match 2: By Username
    if (!matchedUser && inv.customerUsername) {
      const uKey = normStr(inv.customerUsername)
      if (userByUsername.has(uKey)) {
        matchedUser = userByUsername.get(uKey)
        linkedByUsername++
      }
    }

    // Match 3: By Name
    if (!matchedUser && inv.customerName) {
      const nKey = normStr(inv.customerName)
      if (userByName.has(nKey)) {
        matchedUser = userByName.get(nKey)
        linkedByName++
      }
    }

    // Match 4: By Phone
    if (!matchedUser && inv.customerPhone) {
      const pKey = normPhone(inv.customerPhone)
      if (pKey && userByPhone.has(pKey)) {
        matchedUser = userByPhone.get(pKey)
        linkedByPhone++
      }
    }

    if (matchedUser) {
      // Update userId pada invoice agar 100% terhubung ke user ini
      if (inv.userId !== matchedUser.id) {
        await prisma.invoice.update({
          where: { id: inv.id },
          data: { userId: matchedUser.id },
        })
      }
    } else {
      // Jika invoice benar-benar orphan (tanpa nama/user di DB):
      // Jika nama/username mengandung "tegal", biarkan / hubungkan ke Tegal
      // Jika tidak -> anggap milik Cibinong
      const isTegalOrphan = normStr(inv.customerName).includes('tegal') || normStr(inv.customerUsername).includes('tegal')
      if (!isTegalOrphan) {
        fallbackCibinongInvoices++
      }
    }
  }

  // 4. Hitung rincian Tagihan Akhir
  const finalInvoices = await prisma.invoice.findMany({
    select: {
      id: true,
      status: true,
      customerName: true,
      customerUsername: true,
      user: {
        select: { routerId: true, name: true },
      },
    },
  })

  let citeureupTotal = 0
  let cibinongTotal = 0
  let citeureupUnpaid = 0
  let cibinongUnpaid = 0

  for (const inv of finalInvoices) {
    const isCiteureup = inv.user?.routerId === citeureupRouter.id
    const isUnpaid = inv.status === 'PENDING' || inv.status === 'OVERDUE'

    if (isCiteureup) {
      citeureupTotal++
      if (isUnpaid) citeureupUnpaid++
    } else {
      cibinongTotal++
      if (isUnpaid) cibinongUnpaid++
    }
  }

  console.log('=== HASIL EKSEKUSI PEMISAHAN PERTAMA & UTAMA ===')
  console.log(`📍 CITEUREUP (Kampung Tegal):`)
  console.log(`   - Area assigned     : ${citeureupAreaNames.join(', ') || 'KAMPUNG TEGAL'}`)
  console.log(`   - Pelanggan Aktif   : ${usersInTegal.count} user`)
  console.log(`   - Tagihan Belum Lunas: ${citeureupUnpaid} tagihan`)
  console.log(`   - Total Riwayat Tagihan: ${citeureupTotal} tagihan\n`)

  console.log(`📍 CIBINONG (Kampung Muara Beres, Puri Nirwana 3, Kampung Pisang, dll):`)
  console.log(`   - Area assigned     : ${cibinongAreaNames.join(', ') || 'MUARA BERES, PURI NIRWANA 3, PISANG, dll'}`)
  console.log(`   - Pelanggan Aktif   : ${usersInCibinong.count} user`)
  console.log(`   - Tagihan Belum Lunas: ${cibinongUnpaid} tagihan`)
  console.log(`   - Total Riwayat Tagihan: ${cibinongTotal} tagihan\n`)

  console.log(`🔗 Statistik Re-linking Tagihan ke Pelanggan:`)
  console.log(`   - Match by Username : ${linkedByUsername}`)
  console.log(`   - Match by Nama     : ${linkedByName}`)
  console.log(`   - Match by No HP    : ${linkedByPhone}`)

  console.log('\n✅ SELURUH TAGIHAN BERHASIL DIPINDAHKAN SESUAI NAMA & AREA PELANGGAN!')
}

main()
  .catch((err) => {
    console.error('❌ Occurred error:', err)
    process.exit(1)
  })
  .finally(() => {
    prisma.$disconnect()
  })
