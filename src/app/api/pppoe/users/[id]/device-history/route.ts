import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';
import { prisma } from '@/server/db/client';

export const dynamic = 'force-dynamic';

// GET /api/pppoe/users/[id]/device-history
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = params;

    // Verify user exists
    const user = await prisma.pppoeUser.findUnique({ where: { id }, select: { id: true } });
    if (!user) {
      return NextResponse.json({ error: 'Pelanggan tidak ditemukan' }, { status: 404 });
    }

    const histories = await prisma.customerDeviceHistory.findMany({
      where: { customerId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        asset: {
          select: { id: true, serialNumber: true, macAddress: true, vendor: true, model: true, status: true },
        },
      },
    });

    // Also get the current active asset (status = IN_USE, currentCustomerId = id)
    const currentAsset = await prisma.inventoryAsset.findFirst({
      where: { currentCustomerId: id, status: 'IN_USE', assetType: 'MODEM' },
      include: {
        item: { select: { sku: true, name: true } },
      },
    });

    return NextResponse.json({ success: true, histories, currentAsset });
  } catch (error: any) {
    console.error('GET device-history error:', error);
    return NextResponse.json({ error: error.message || 'Gagal mengambil riwayat perangkat' }, { status: 500 });
  }
}
