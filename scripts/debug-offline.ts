import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  console.log("Checking acsDevices...");
  const devices = await prisma.acsDevice.findMany({
    include: {
      pppoeUser: {
        select: { username: true }
      }
    }
  });

  let activeCount = 0;
  let offlineCount = 0;

  for (const device of devices) {
    let hasSession = false;
    if (device.pppoeUser?.username) {
      const activeSession = await prisma.$queryRaw<any[]>`
        SELECT radacctid FROM radacct 
        WHERE username = ${device.pppoeUser.username} 
          AND acctstoptime IS NULL
        LIMIT 1
      `;
      if (activeSession && activeSession.length > 0) {
        hasSession = true;
      }
    }
    
    console.log(`Device ${device.serialNumber}: Status=${device.status}, PPPoE=${device.pppoeUser?.username}, HasSession=${hasSession}`);
    if (hasSession) activeCount++;
    if (device.status === 'offline') offlineCount++;
  }

  console.log(`\nTotal Devices: ${devices.length}`);
  console.log(`Total Offline in DB: ${offlineCount}`);
  console.log(`Total with Active PPPoE Session: ${activeCount}`);

  await prisma.$disconnect();
}

check().catch(console.error);
