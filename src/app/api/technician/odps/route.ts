import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { requirePermission } from '@/server/middleware/api-auth';

export const dynamic = 'force-dynamic';

// GET - Fetch ODPs for technician autocomplete and GPS matching
// Includes usedPorts: array of port numbers currently occupied by active customers
export async function GET() {
  const auth = await requirePermission('technician.access');
  if (!auth.authorized) return auth.response;
  try {
    const odps = await prisma.networkODP.findMany({
      select: {
        id: true,
        name: true,
        latitude: true,
        longitude: true,
        portCount: true,
        status: true,
        customers: {
          where: {
            customer: {
              status: {
                // Ports are FREE again for stopped/isolated/suspended customers
                notIn: ['stop', 'isolated', 'suspended', 'blocked', 'cabut'],
              },
            },
          },
          select: {
            portNumber: true,
            customer: {
              select: { name: true, customerId: true },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const result = odps.map((odp) => ({
      id: odp.id,
      name: odp.name,
      latitude: odp.latitude,
      longitude: odp.longitude,
      portCount: odp.portCount,
      status: odp.status,
      usedPorts: odp.customers.map((c) => ({
        portNumber: c.portNumber,
        customerName: c.customer?.name || 'Pelanggan',
        customerId: c.customer?.customerId || '',
      })),
    }));

    return NextResponse.json({ success: true, odps: result });
  } catch (error: any) {
    console.error('Fetch technician ODPs error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch ODPs' },
      { status: 500 }
    );
  }
}
