import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Find Cibinong Router
    const cibinongRouter = await prisma.router.findFirst({
      where: {
        OR: [
          { name: { contains: 'CIBINONG' } },
          { ipAddress: '10.200.0.2' },
        ],
      },
    });

    const routerId = cibinongRouter?.id || null;

    // 2. Define the 3 field OLTs
    const targetOlts = [
      {
        name: 'HSGQ-G02ID Cibinong',
        ipAddress: '192.168.30.2',
        vendor: 'hsgq',
        model: 'HSGQ-G02ID',
        firmwareVersion: 'V1.0',
        snmpCommunity: 'public',
        snmpPort: 1611,
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
        snmpPort: 1615,
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

    const results = [];

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
      }

      // Link to Cibinong router if found
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
      }

      results.push({
        id: olt.id,
        name: olt.name,
        ipAddress: olt.ipAddress,
        vendor: olt.vendor,
        model: olt.model,
        linkedRouter: cibinongRouter ? cibinongRouter.name : 'None',
      });
    }

    return NextResponse.json({
      success: true,
      message: `Seeded ${results.length} field OLTs linked to ${cibinongRouter ? cibinongRouter.name : 'Cibinong Router'}`,
      olts: results,
    });
  } catch (error: any) {
    console.error('Seed OLTs error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
