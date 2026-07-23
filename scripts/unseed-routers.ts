import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Resetting Router Assignments for Recently Assigned Users...\n');

  // Option 1: Find Cibinong Router
  const cibinongRouter = await prisma.router.findFirst({
    where: {
      OR: [
        { name: { contains: 'Cibinong' } },
        { name: { contains: 'CBN' } },
        { name: { contains: 'cibinong' } },
      ]
    }
  });

  if (!cibinongRouter) {
    console.log('⚠️ Router Cibinong tidak ditemukan.');
    return;
  }

  console.log(`🎯 Targeting Router: "${cibinongRouter.name}" (ID: ${cibinongRouter.id})`);

  // Unseed / Reset routerId back to null for users on Cibinong router
  const result = await prisma.pppoeUser.updateMany({
    where: {
      routerId: cibinongRouter.id
    },
    data: {
      routerId: null
    }
  });

  console.log(`\n✅ UNSEED BERHASIL! ${result.count} pelanggan telah dikembalikan ke status TANPA ROUTER (routerId = null).`);
  console.log('Sekarang Anda bisa mengelompokkan pelanggan ke Citeureup atau Cibinong dengan rapi.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
