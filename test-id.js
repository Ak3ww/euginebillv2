const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.pppoeUser.findMany({ 
  where: { username: 'AKEW' },
  select: { id: true, username: true, pppoeCustomerId: true, customerId: true }
}).then(res => {
  console.log(res);
}).finally(() => prisma.$disconnect());
