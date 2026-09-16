import { prisma } from '../src/server/db/client';

async function main() {
  console.log('[Seed OLTs] Starting seeding 3 field OLTs...');

  // 1. Find Cibinong Router
  const cibinongRouter = await prisma.router.findFirst({
    where: {
      OR: [
        { name: { contains: 'CIBINONG' } },
        { ipAddress: '10.200.0.2' },
      ],
    },
  });

  if (cibinongRouter) {
    console.log(`[Seed OLTs] Found Uplink Router: ${cibinongRouter.name} (${cibinongRouter.ipAddress})`);
  } else {
    console.warn('[Seed OLTs] Warning: Cibinong router not found by name or IP 10.200.0.2');
  }

  const routerId = cibinongRouter?.id || null;

  const targetOlts = [
    {
      name: 'HSGQ-G02ID Cibinong',
      ipAddress: '192.168.30.2',
      vendor: 'hsgq',
      model: 'HSGQ-G02ID',
      firmwareVersion: 'V1.0',
      snmpCommunity: 'public',
      snmpPort: 161,
      snmpEnabled: true,
      monitoringEnabled: true,
      pollingInterval: 300,
      status: 'active',
      latitude: -6.4800,
      longitude: 106.8500,
      username: 'admin',
      password: '',
    },
    {
      name: 'VSOL-GPON Cibinong',
      ipAddress: '192.168.30.6',
      vendor: 'vsol',
      model: 'V1600GS',
      firmwareVersion: 'V2.0',
      snmpCommunity: 'public',
      snmpPort: 161,
      snmpEnabled: true,
      monitoringEnabled: true,
      pollingInterval: 300,
      status: 'active',
      latitude: -6.4800,
      longitude: 106.8500,
      username: 'admin',
      password: '',
    },
    {
      name: 'VSOL-1600GT Cibinong',
      ipAddress: '192.168.30.7',
      vendor: 'vsol',
      model: 'V1600GT',
      firmwareVersion: 'V2.0',
      snmpCommunity: 'public',
      snmpPort: 161,
      snmpEnabled: true,
      monitoringEnabled: true,
      pollingInterval: 300,
      status: 'active',
      latitude: -6.4800,
      longitude: 106.8500,
      username: 'admin',
      password: '',
    },
  ];

  for (const item of targetOlts) {
    let olt = await prisma.networkOLT.findFirst({
      where: { ipAddress: item.ipAddress },
    });

    if (!olt) {
      olt = await prisma.networkOLT.create({
        data: {
          id: crypto.randomUUID(),
          name: item.name,
          ipAddress: item.ipAddress,
          vendor: item.vendor,
          model: item.model,
          firmwareVersion: item.firmwareVersion,
          snmpCommunity: item.snmpCommunity,
          snmpPort: item.snmpPort,
          snmpEnabled: item.snmpEnabled,
          monitoringEnabled: item.monitoringEnabled,
          pollingInterval: item.pollingInterval,
          status: item.status,
          latitude: item.latitude,
          longitude: item.longitude,
          username: item.username,
          password: item.password,
        },
      });
      console.log(`[Seed OLTs] Created OLT: ${olt.name} (${olt.ipAddress})`);
    } else {
      olt = await prisma.networkOLT.update({
        where: { id: olt.id },
        data: {
          name: item.name,
          vendor: item.vendor,
          model: item.model,
          firmwareVersion: item.firmwareVersion,
          snmpCommunity: item.snmpCommunity,
          snmpPort: item.snmpPort,
          snmpEnabled: item.snmpEnabled,
          monitoringEnabled: item.monitoringEnabled,
          pollingInterval: item.pollingInterval,
          status: item.status,
        },
      });
      console.log(`[Seed OLTs] Updated OLT: ${olt.name} (${olt.ipAddress})`);
    }

    if (routerId) {
      await prisma.networkOLTRouter.upsert({
        where: {
          oltId_routerId: {
            oltId: olt.id,
            routerId,
          },
        },
        create: {
          id: crypto.randomUUID(),
          oltId: olt.id,
          routerId,
          priority: 0,
          isActive: true,
        },
        update: {
          isActive: true,
          priority: 0,
        },
      });
      console.log(`[Seed OLTs] Bound ${olt.name} -> Router ${cibinongRouter?.name}`);
    }
  }

  console.log('[Seed OLTs] Completed successfully!');
}

main()
  .catch(err => {
    console.error('[Seed OLTs] Failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
