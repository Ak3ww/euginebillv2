/**
 * FORCE FIX: Reassign semua user & invoice berdasarkan area yang benar.
 *
 * Root cause fix: NULL address/comment menyebabkan NOT OR clause gagal di MySQL.
 * Solusi: SET SEMUA → Cibinong dulu, lalu override Tegal → Citeureup.
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const CITEUREUP_ID = '1dce78d9-3c9d-4c6d-a061-87adaa485fdf'
  const CIBINONG_ID  = '117c091a-cf51-47d0-9d3d-7bbb1d9f10e8'

  console.log('=== FORCE FIX: REASSIGN USER & TAGIHAN BERDASARKAN AREA ===\n')

  // 1. Ambil ID area Tegal
  const tegalAreas = await prisma.pppoeArea.findMany({
    where: { name: { contains: 'tegal' } },
    select: { id: true, name: true },
  })

  const cibinongAreas = await prisma.pppoeArea.findMany({
    where: { name: { not: { contains: 'tegal' } } },
    select: { id: true, name: true },
  })

  const tegalAreaIds = tegalAreas.map(a => a.id)

  console.log(`Area Citeureup (Tegal)  : ${tegalAreas.map(a => a.name).join(', ')}`)
  console.log(`Area Cibinong (Lainnya) : ${cibinongAreas.map(a => a.name).join(', ')}\n`)

  // 2. Update pppoeArea routerId
  await prisma.pppoeArea.updateMany({
    where: { id: { in: tegalAreaIds } },
    data: { routerId: CITEUREUP_ID },
  })
  await prisma.pppoeArea.updateMany({
    where: { id: { notIn: tegalAreaIds } },
    data: { routerId: CIBINONG_ID },
  })

  // 3. STEP A: Set SEMUA user ke Cibinong dulu (clear semua yang salah)
  const allToCibinong = await prisma.pppoeUser.updateMany({
    where: {},
    data: { routerId: CIBINONG_ID },
  })
  console.log(`✅ Step A: Set semua ${allToCibinong.count} user → Cibinong`)

  // 4. STEP B: Override user dengan area Tegal → Citeureup
  const tegalToCiteureup = await prisma.pppoeUser.updateMany({
    where: { areaId: { in: tegalAreaIds } },
    data: { routerId: CITEUREUP_ID },
  })
  console.log(`✅ Step B: Override ${tegalToCiteureup.count} user Tegal → Citeureup`)

  // Verifikasi distribusi user
  const usersCiteureup = await prisma.pppoeUser.count({ where: { routerId: CITEUREUP_ID } })
  const usersCibinong  = await prisma.pppoeUser.count({ where: { routerId: CIBINONG_ID } })
  console.log(`\n--- Distribusi User Setelah Fix ---`)
  console.log(`  Citeureup : ${usersCiteureup} user`)
  console.log(`  Cibinong  : ${usersCibinong} user`)

  // 5. Fix invoices: update userId berdasarkan customerUsername
  //    Ambil semua user setelah reassign
  const allUsers = await prisma.pppoeUser.findMany({
    select: { id: true, username: true, name: true, phone: true, routerId: true },
  })

  const byUsername = new Map(allUsers.filter(u => u.username).map(u => [u.username.toLowerCase().trim(), u]))
  const byName     = new Map(allUsers.filter(u => u.name).map(u => [u.name.toLowerCase().trim(), u]))
  const byPhone    = new Map()
  for (const u of allUsers) {
    if (u.phone) {
      let p = u.phone.replace(/[^0-9]/g, '')
      if (p.startsWith('62')) p = '0' + p.slice(2)
      byPhone.set(p, u)
    }
  }

  const allInvoices = await prisma.invoice.findMany({
    select: { id: true, userId: true, customerUsername: true, customerName: true, customerPhone: true },
  })

  let linked = 0
  let already = 0
  let unmatched = 0

  for (const inv of allInvoices) {
    let user = null

    const uKey = inv.customerUsername?.toLowerCase().trim()
    const nKey = inv.customerName?.toLowerCase().trim()
    let pKey   = inv.customerPhone?.replace(/[^0-9]/g, '') ?? ''
    if (pKey.startsWith('62')) pKey = '0' + pKey.slice(2)

    if (uKey && byUsername.has(uKey))  user = byUsername.get(uKey)
    else if (nKey && byName.has(nKey)) user = byName.get(nKey)
    else if (pKey && byPhone.has(pKey)) user = byPhone.get(pKey)

    if (user) {
      if (inv.userId !== user.id) {
        await prisma.invoice.update({ where: { id: inv.id }, data: { userId: user.id } })
        linked++
      } else {
        already++
      }
    } else {
      unmatched++
    }
  }

  console.log(`\n--- Relinking Invoice ---`)
  console.log(`  Diperbarui (userId beda): ${linked}`)
  console.log(`  Sudah benar (skip)      : ${already}`)
  console.log(`  Tidak cocok (orphan)    : ${unmatched}`)

  // Verifikasi akhir distribusi invoice
  const invCiteureup = await prisma.invoice.count({ where: { user: { routerId: CITEUREUP_ID } } })
  const invCibinong  = await prisma.invoice.count({ where: { user: { routerId: CIBINONG_ID } } })
  const invNull      = await prisma.invoice.count({ where: { userId: null } })

  const invCiteureupUnpaid = await prisma.invoice.count({ where: { status: { in: ['PENDING','OVERDUE'] }, user: { routerId: CITEUREUP_ID } } })
  const invCibinongUnpaid  = await prisma.invoice.count({ where: { status: { in: ['PENDING','OVERDUE'] }, user: { routerId: CIBINONG_ID } } })

  console.log(`\n=== HASIL AKHIR ===`)
  console.log(`📍 CITEUREUP (Kampung Tegal):`)
  console.log(`   Pelanggan      : ${usersCiteureup} user`)
  console.log(`   Tagihan Unpaid : ${invCiteureupUnpaid}`)
  console.log(`   Total Tagihan  : ${invCiteureup}`)
  console.log(`📍 CIBINONG (Muara Beres, Puri Nirwana 3, Pisang, dll):`)
  console.log(`   Pelanggan      : ${usersCibinong} user`)
  console.log(`   Tagihan Unpaid : ${invCibinongUnpaid}`)
  console.log(`   Total Tagihan  : ${invCibinong}`)
  if (invNull > 0) console.log(`\n⚠️  ${invNull} invoice masih tanpa userId (orphan)`)
  console.log(`\n✅ DONE!`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
