const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting import of 2 new customers (ERNAWATI BATUARA & BIYADIAL KHAIR)...');

  // 1. Fetch or ensure 20 Mbps Profile exists
  let profile20m = await prisma.pppoeProfile.findFirst({
    where: {
      OR: [
        { name: { contains: '20' } },
        { price: 150000 },
      ],
    },
  });

  if (!profile20m) {
    profile20m = await prisma.pppoeProfile.findFirst();
  }

  if (!profile20m) {
    throw new Error('❌ Tidak ditemukan profile PPPoE di database. Buat profile terlebih dahulu!');
  }

  console.log(`✅ Using PPPoE Profile: ${profile20m.name} (ID: ${profile20m.id}, Price: Rp ${profile20m.price.toLocaleString('id-ID')})`);

  // 2. Fetch or create Area 1: Kampung Pisang
  let areaPisang = await prisma.pppoeArea.findFirst({
    where: {
      OR: [
        { name: 'Kampung Pisang' },
        { name: 'KAMPUNG PISANG' },
        { name: { contains: 'Pisang' } },
        { name: { contains: 'PISANG' } },
      ],
    },
  });

  if (!areaPisang) {
    areaPisang = await prisma.pppoeArea.create({
      data: {
        id: crypto.randomUUID(),
        name: 'Kampung Pisang',
      },
    });
    console.log(`✅ Created Area: Kampung Pisang`);
  } else {
    console.log(`✅ Found Area: ${areaPisang.name} (ID: ${areaPisang.id})`);
  }

  // 3. Fetch or create Area 2: Muara Beres
  let areaMuara = await prisma.pppoeArea.findFirst({
    where: {
      OR: [
        { name: 'Muara Beres' },
        { name: 'MUARA BERES' },
        { name: { contains: 'Muara' } },
        { name: { contains: 'MUARA' } },
      ],
    },
  });

  if (!areaMuara) {
    areaMuara = await prisma.pppoeArea.create({
      data: {
        id: crypto.randomUUID(),
        name: 'Muara Beres',
      },
    });
    console.log(`✅ Created Area: Muara Beres`);
  } else {
    console.log(`✅ Found Area: ${areaMuara.name} (ID: ${areaMuara.id})`);
  }

  // 4. Fetch Router: cibinong (used by BOTH customers)
  const routers = await prisma.router.findMany();
  let routerCibinong = routers.find(r => r.name.toLowerCase().includes('cibinong')) || routers[0];

  console.log(`✅ Using Router Cibinong for BOTH customers: ${routerCibinong?.name || 'Default Router'}`);

  // -------------------------------------------------------------
  // CUSTOMER 1: ERNAWATI BATUARA
  // -------------------------------------------------------------
  const cust1Username = 'EMG333';
  const cust1Id = '997150761912';

  const cust1Payload = {
    username: cust1Username,
    customerId: cust1Id,
    name: 'ERNAWATI BATUARA',
    password: '123',
    portalPassword: '123',
    email: 'ernawatinainggolanernawati@gmail.com',
    phone: '081398804397',
    idCardNumber: '3201014506850024',
    address: 'Perum Purimas Perkasa Blok BB NO7 RT06/06, Karadenan, Cibinong, Kab.Bogor',
    status: 'ACTIVE',
    subscriptionType: 'POSTPAID',
    connectionType: 'PPPOE',
    billingDay: 1,
    autoIsolationEnabled: true,
    profileId: profile20m.id,
    areaId: areaPisang.id,
    routerId: routerCibinong?.id || null,
    createdAt: new Date('2026-07-22T00:00:00.000Z'),
  };

  const existingCust1 = await prisma.pppoeUser.findFirst({
    where: { OR: [{ username: cust1Username }, { customerId: cust1Id }] },
  });

  let user1;
  if (existingCust1) {
    user1 = await prisma.pppoeUser.update({
      where: { id: existingCust1.id },
      data: cust1Payload,
    });
    console.log(`🔄 Updated Customer 1: ${user1.name} (${user1.username})`);
  } else {
    user1 = await prisma.pppoeUser.create({
      data: {
        id: crypto.randomUUID(),
        ...cust1Payload,
      },
    });
    console.log(`✨ Inserted Customer 1: ${user1.name} (${user1.username})`);
  }

  // Check / Upsert ODP if exists
  try {
    let odpPisang = await prisma.networkODP.findFirst({
      where: { name: { contains: 'KPS06-A01' } },
    });
    if (!odpPisang) {
      odpPisang = await prisma.networkODP.create({
        data: {
          id: crypto.randomUUID(),
          name: 'ODP KPS06-A01',
          latitude: 0.0,
          longitude: 0.0,
          portCount: 8,
        },
      });
    }

    await prisma.odpCustomerAssignment.upsert({
      where: { customerId: user1.id },
      update: { odpId: odpPisang.id, portNumber: 1 },
      create: {
        id: crypto.randomUUID(),
        customerId: user1.id,
        odpId: odpPisang.id,
        portNumber: 1,
      },
    });
    console.log(`📌 ODP KPS06-A01 assigned to ${user1.name}`);
  } catch (odpErr) {
    console.log(`ℹ️ ODP assignment info for ${user1.name}:`, odpErr.message);
  }

  // -------------------------------------------------------------
  // CUSTOMER 2: BIYADIAL KHAIR
  // -------------------------------------------------------------
  const cust2Username = 'EMG332';
  const cust2Id = '181795008702';

  const cust2Payload = {
    username: cust2Username,
    customerId: cust2Id,
    name: 'BIYADIAL KHAIR',
    password: '123',
    portalPassword: '123',
    email: 'biyadika@gmail.com',
    phone: '087874989822',
    idCardNumber: '3271042808950015',
    address: 'KONTRAKAN BUMI RH NO.3 JALAN PAMEL II RT3 RW1 KAMPUNG JALAN MUARA BERES SUKAHATI CIBINONG KAB BOGOR JAWABARAT',
    status: 'ACTIVE',
    subscriptionType: 'POSTPAID',
    connectionType: 'PPPOE',
    billingDay: 1,
    autoIsolationEnabled: true,
    profileId: profile20m.id,
    areaId: areaMuara.id,
    routerId: routerCibinong?.id || null, // Both use Cibinong router
    createdAt: new Date('2026-07-21T00:00:00.000Z'),
  };

  const existingCust2 = await prisma.pppoeUser.findFirst({
    where: { OR: [{ username: cust2Username }, { customerId: cust2Id }] },
  });

  let user2;
  if (existingCust2) {
    user2 = await prisma.pppoeUser.update({
      where: { id: existingCust2.id },
      data: cust2Payload,
    });
    console.log(`🔄 Updated Customer 2: ${user2.name} (${user2.username})`);
  } else {
    user2 = await prisma.pppoeUser.create({
      data: {
        id: crypto.randomUUID(),
        ...cust2Payload,
      },
    });
    console.log(`✨ Inserted Customer 2: ${user2.name} (${user2.username})`);
  }

  // FreeRADIUS Sync for Both Users
  for (const u of [user1, user2]) {
    try {
      const existingRad = await prisma.radcheck.findFirst({
        where: { username: u.username, attribute: 'Cleartext-Password' },
      });
      if (existingRad) {
        await prisma.radcheck.update({
          where: { id: existingRad.id },
          data: { value: u.password },
        });
      } else {
        await prisma.radcheck.create({
          data: { username: u.username, attribute: 'Cleartext-Password', op: ':=', value: u.password },
        });
      }

      if (profile20m.groupName) {
        const existingGroup = await prisma.radusergroup.findFirst({
          where: { username: u.username },
        });
        if (existingGroup) {
          await prisma.radusergroup.update({
            where: { id: existingGroup.id },
            data: { groupname: profile20m.groupName },
          });
        } else {
          await prisma.radusergroup.create({
            data: { username: u.username, groupname: profile20m.groupName, priority: 0 },
          });
        }
      }
      console.log(`🔐 FreeRADIUS credentials synced for ${u.username}`);
    } catch (radErr) {
      console.log(`ℹ️ FreeRADIUS note for ${u.username}:`, radErr.message);
    }
  }

  console.log('\n🎉 SUCCESS! All 2 new customers successfully imported into database.');
}

main()
  .catch((e) => {
    console.error('❌ Error importing customers:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
