import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const targetAreaName = 'KAMPUNG TEGAL';
  
  // 1. Find or create the area
  let targetArea = await prisma.pppoeArea.findFirst({
    where: { name: targetAreaName }
  });

  if (!targetArea) {
    console.log(`Area '${targetAreaName}' not found. Creating it...`);
    targetArea = await prisma.pppoeArea.create({
      data: {
        name: targetAreaName,
        description: 'Area otomatis untuk pelanggan tanpa wilayah'
      }
    });
  }
  
  console.log(`Target Area ID: ${targetArea.id}`);

  // 2. Find users without an area
  const usersWithoutArea = await prisma.pppoeUser.findMany({
    where: {
      areaId: null
    }
  });

  console.log(`Found ${usersWithoutArea.length} customers without an area.`);

  if (usersWithoutArea.length > 0) {
    // 3. Update them
    const result = await prisma.pppoeUser.updateMany({
      where: {
        areaId: null
      },
      data: {
        areaId: targetArea.id
      }
    });
    console.log(`Successfully updated ${result.count} customers to '${targetAreaName}'.`);
  } else {
    console.log('No updates needed.');
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
