import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function recover() {
  console.log("Recovering offline ACS devices...");
  
  // Find all offline devices
  const offlineDevices = await prisma.acsDevice.findMany({
    where: { status: 'offline' },
    include: { pppoeUser: true }
  });

  let recovered = 0;

  for (const device of offlineDevices) {
    if (device.pppoeUser?.username) {
      const activeSession = await prisma.mikrotikSession.findFirst({
        where: {
          username: device.pppoeUser.username,
          stopTime: null
        }
      });
      
      if (activeSession) {
        // Device is actually online!
        await prisma.acsDevice.update({
          where: { id: device.id },
          data: { 
            status: 'online',
            lastInform: new Date() // reset lastInform so it doesn't get marked offline immediately
          }
        });
        recovered++;
        console.log(`Recovered ${device.serialNumber} (PPPoE: ${device.pppoeUser.username})`);
      }
    }
  }

  console.log(`\nSuccessfully recovered ${recovered} devices to online status.`);
  await prisma.$disconnect();
}

recover().catch(e => {
  console.error(e);
  process.exit(1);
});
