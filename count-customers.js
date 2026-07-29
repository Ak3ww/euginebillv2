const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const allUsers = await prisma.pppoeUser.findMany({
    include: { router: true }
  });

  const citeureupUsers = allUsers.filter(u => u.router?.name?.toLowerCase().includes('citeureup'));
  const otherUsers = allUsers.filter(u => !u.router?.name?.toLowerCase().includes('citeureup'));

  console.log('====================================');
  console.log('Total Pelanggan Keseluruhan:', allUsers.length);
  console.log('Total Pelanggan Mikrotik Citeureup:', citeureupUsers.length);
  console.log('Total Pelanggan TANPA Citeureup:', otherUsers.length);
  console.log('====================================');
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
