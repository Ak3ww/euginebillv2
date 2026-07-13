import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function test() {
  try {
    const user = await prisma.pppoeUser.findFirst({
      where: {
        OR: [
          { id: '22196028' },
          { customerId: '22196028' }
        ]
      }
    });
    console.log(user);
  } catch (err) {
    console.error('ERROR:', err);
  } finally {
    await prisma.$disconnect();
  }
}

test();
