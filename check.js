const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const pg = await prisma.paymentGateway.findMany();
  console.log(pg);
}

main().catch(console.error).finally(()=>prisma.$disconnect());
