/**
 * DIAGNOSTIK SCRIPT - Lihat data mentah penyebab 293 tagihan masih ke Citeureup
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const CITEUREUP_ID = '1dce78d9-3c9d-4c6d-a061-87adaa485fdf'
  const CIBINONG_ID  = '117c091a-cf51-47d0-9d3d-7bbb1d9f10e8'

  // 1. Cek distribusi user by routerId
  const usersCiteureup = await prisma.pppoeUser.count({ where: { routerId: CITEUREUP_ID } })
  const usersCibinong  = await prisma.pppoeUser.count({ where: { routerId: CIBINONG_ID } })
  const usersNull      = await prisma.pppoeUser.count({ where: { OR: [{ routerId: null }, { routerId: '' }] } })
  console.log(`\n=== PPPoE Users ===`)
  console.log(`Citeureup : ${usersCiteureup}`)
  console.log(`Cibinong  : ${usersCibinong}`)
  console.log(`Null/Blank: ${usersNull}`)

  // 2. Cek distribusi user by areaId
  const usersWithArea    = await prisma.pppoeUser.count({ where: { areaId: { not: null } } })
  const usersWithoutArea = await prisma.pppoeUser.count({ where: { areaId: null } })
  console.log(`\n=== Users by areaId ===`)
  console.log(`With areaId   : ${usersWithArea}`)
  console.log(`Without areaId: ${usersWithoutArea}`)

  // 3. Sample 10 user Citeureup - apakah areaId-nya bener?
  const citeureupSample = await prisma.pppoeUser.findMany({
    where: { routerId: CITEUREUP_ID },
    take: 10,
    select: { id: true, username: true, name: true, areaId: true, area: { select: { name: true } } },
  })
  console.log(`\n=== Sample 10 User Citeureup ===`)
  for (const u of citeureupSample) {
    console.log(`  ${u.username} | area: ${u.area?.name ?? 'NULL'}`)
  }

  // 4. Sample 10 user Cibinong - apakah areaId-nya bener?
  const cibinongSample = await prisma.pppoeUser.findMany({
    where: { routerId: CIBINONG_ID },
    take: 10,
    select: { id: true, username: true, name: true, areaId: true, area: { select: { name: true } } },
  })
  console.log(`\n=== Sample 10 User Cibinong ===`)
  for (const u of cibinongSample) {
    console.log(`  ${u.username} | area: ${u.area?.name ?? 'NULL'}`)
  }

  // 5. Cek distribusi invoice by user.routerId
  const invCiteureup = await prisma.invoice.count({ where: { user: { routerId: CITEUREUP_ID } } })
  const invCibinong  = await prisma.invoice.count({ where: { user: { routerId: CIBINONG_ID } } })
  const invNullUser  = await prisma.invoice.count({ where: { userId: null } })
  const invOrphan    = await prisma.invoice.count({ where: { user: { routerId: null } } })
  console.log(`\n=== Invoice by user.routerId ===`)
  console.log(`Citeureup (via user.routerId): ${invCiteureup}`)
  console.log(`Cibinong  (via user.routerId): ${invCibinong}`)
  console.log(`userId = null               : ${invNullUser}`)
  console.log(`user.routerId = null        : ${invOrphan}`)

  // 6. Sample 5 invoice dari Citeureup - siapa usernya, apa areanya?
  const citeureupInvSample = await prisma.invoice.findMany({
    where: { user: { routerId: CITEUREUP_ID } },
    take: 10,
    select: {
      invoiceNumber: true,
      customerName: true,
      customerUsername: true,
      user: { select: { username: true, name: true, areaId: true, area: { select: { name: true } } } },
    },
  })
  console.log(`\n=== Sample 10 Invoice Citeureup ===`)
  for (const inv of citeureupInvSample) {
    const uArea = inv.user?.area?.name ?? 'NULL'
    console.log(`  ${inv.customerUsername ?? inv.customerName} | user area: ${uArea}`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
