import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('=== STEP 1: Rename & Ensure Target Areas ===');
  
  // Target Area Definitions
  const targetAreas = [
    { name: 'KAMPUNG TEGAL', short: 'KTG', keywords: ['tegal', 'ktg'] },
    { name: 'KAMPUNG PISANG', short: 'KPS', keywords: ['pisang', 'kps'] },
    { name: 'KAMPUNG MUARA BERES', short: 'KMB', keywords: ['muara beres', 'muaraberes', 'kmb', 'muara'] },
    { name: 'PURI NIRWANA 3', short: 'PNW3', keywords: ['karadenan', 'puri nirwana', 'pnw3', 'pnw'] },
  ];

  // 1. Rename existing KARADENAN to PURI NIRWANA 3
  const karadenan = await prisma.pppoeArea.findFirst({
    where: { name: { contains: 'KARADENAN' } }
  });
  if (karadenan) {
    await prisma.pppoeArea.update({
      where: { id: karadenan.id },
      data: { name: 'PURI NIRWANA 3' }
    });
    console.log(`✓ Renamed Area "${karadenan.name}" -> "PURI NIRWANA 3" (ID: ${karadenan.id})`);
  }

  // 2. Rename existing MUARA BERES to KAMPUNG MUARA BERES
  const muaraBeres = await prisma.pppoeArea.findFirst({
    where: { name: { equals: 'MUARA BERES' } }
  });
  if (muaraBeres) {
    await prisma.pppoeArea.update({
      where: { id: muaraBeres.id },
      data: { name: 'KAMPUNG MUARA BERES' }
    });
    console.log(`✓ Renamed Area "MUARA BERES" -> "KAMPUNG MUARA BERES" (ID: ${muaraBeres.id})`);
  }

  // 3. Upsert all 4 target areas in Database
  const areaDbMap = new Map<string, string>(); // name -> id

  for (const t of targetAreas) {
    let existing = await prisma.pppoeArea.findFirst({
      where: { name: { equals: t.name } }
    });

    if (!existing) {
      existing = await prisma.pppoeArea.create({
        data: {
          id: `area_${t.short.toLowerCase()}_${Date.now()}`,
          name: t.name,
          description: `Area ${t.name} (${t.short})`,
        }
      });
      console.log(`✓ Created new Area: "${t.name}" (ID: ${existing.id})`);
    } else {
      console.log(`✓ Found Area: "${t.name}" (ID: ${existing.id})`);
    }
    areaDbMap.set(t.name, existing.id);
  }

  console.log('\n=== STEP 2: Auto-Match Unassigned Customers ===');

  const unassignedUsers = await prisma.pppoeUser.findMany({
    where: { areaId: null },
    include: {
      odpAssignment: { include: { odp: true } }
    }
  });

  console.log(`Found ${unassignedUsers.length} unassigned customers to process...\n`);

  let matchedCount = 0;
  let unmatchedCount = 0;

  for (const user of unassignedUsers) {
    const searchableText = [
      user.name || '',
      user.username || '',
      user.address || '',
      user.comment || '',
      user.customerId || '',
      user.odpAssignment?.odp?.name || '',
    ].join(' ').toLowerCase();

    let matchedAreaName: string | null = null;

    // Pattern Matching Logic
    if (searchableText.includes('ktg') || searchableText.includes('tegal')) {
      matchedAreaName = 'KAMPUNG TEGAL';
    } else if (searchableText.includes('kps') || searchableText.includes('pisang')) {
      matchedAreaName = 'KAMPUNG PISANG';
    } else if (searchableText.includes('kmb') || searchableText.includes('muara')) {
      matchedAreaName = 'KAMPUNG MUARA BERES';
    } else if (searchableText.includes('pnw') || searchableText.includes('karadenan') || searchableText.includes('puri')) {
      matchedAreaName = 'PURI NIRWANA 3';
    }

    if (matchedAreaName) {
      const areaId = areaDbMap.get(matchedAreaName);
      if (areaId) {
        await prisma.pppoeUser.update({
          where: { id: user.id },
          data: { areaId }
        });
        matchedCount++;
        console.log(`  [✓ MATCHED] "${user.name}" (${user.username}) -> ${matchedAreaName}`);
      }
    } else {
      unmatchedCount++;
      console.log(`  [? UNMATCHED] "${user.name}" (${user.username}) | Address: "${user.address || '-'}"`);
    }
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`✓ Total Matched & Seeded: ${matchedCount}`);
  console.log(`❓ Remaining Unmatched: ${unmatchedCount}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
