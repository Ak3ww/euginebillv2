import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Script untuk meng-assign router berdasarkan Area / Kata Kunci / List Username
 */
async function main() {
  console.log('📌 Smart Router Assignment By Area / Keywords...\n');

  const routers = await prisma.router.findMany({
    select: { id: true, name: true, ipAddress: true }
  });

  const citeureupRouter = routers.find(r => r.name.toLowerCase().includes('citeureup') || r.name.toLowerCase().includes('ctr'));
  const cibinongRouter = routers.find(r => r.name.toLowerCase().includes('cibinong') || r.name.toLowerCase().includes('cbn'));

  if (!citeureupRouter || !cibinongRouter) {
    console.log('⚠️ Pastikan kedua Router (Citeureup & Cibinong) terdaftar di database:');
    console.log(routers);
    return;
  }

  console.log(`1️⃣ Router Citeureup: "${citeureupRouter.name}" (ID: ${citeureupRouter.id})`);
  console.log(`2️⃣ Router Cibinong:  "${cibinongRouter.name}" (ID: ${cibinongRouter.id})\n`);

  // Step A: Assign customers matching Citeureup area/address to Citeureup Router
  const citeureupUpdate = await prisma.pppoeUser.updateMany({
    where: {
      OR: [
        { area: { contains: 'Citeureup' } },
        { area: { contains: 'ctr' } },
        { address: { contains: 'Citeureup' } },
        { address: { contains: 'Tajur' } },
        { address: { contains: 'Puspanegara' } },
      ]
    },
    data: {
      routerId: citeureupRouter.id
    }
  });

  console.log(`✅ ${citeureupUpdate.count} pelanggan berhasil di-set ke Router CITEUREUP.`);

  // Step B: Assign remaining unassigned customers to Cibinong Router
  const cibinongUpdate = await prisma.pppoeUser.updateMany({
    where: {
      OR: [
        { routerId: null },
        { routerId: '' }
      ]
    },
    data: {
      routerId: cibinongRouter.id
    }
  });

  console.log(`✅ ${cibinongUpdate.count} pelanggan tanpa router sisanya di-set ke Router CIBINONG.`);

  // Final Summary
  const countCtr = await prisma.pppoeUser.count({ where: { routerId: citeureupRouter.id } });
  const countCbn = await prisma.pppoeUser.count({ where: { routerId: cibinongRouter.id } });

  console.log('\n📊 HASIL AKHIR:');
  console.log(`  - Router Citeureup: ${countCtr} pelanggan`);
  console.log(`  - Router Cibinong:  ${countCbn} pelanggan`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
