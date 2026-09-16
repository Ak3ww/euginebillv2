import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';
import { prisma } from '@/server/db/client';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const asset = await prisma.inventoryAsset.findUnique({
      where: { id },
      include: {
        item: true,
        customer: true,
        deviceHistories: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, asset });
  } catch (error: any) {
    console.error('Error fetching asset details:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch asset' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    const existing = await prisma.inventoryAsset.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    const {
      serialNumber,
      macAddress,
      vendor,
      model,
      initialLength,
      remainingLength,
      condition,
      status,
      location,
      notes,
    } = body;

    const updated = await prisma.inventoryAsset.update({
      where: { id },
      data: {
        ...(serialNumber && { serialNumber: serialNumber.trim().toUpperCase() }),
        ...(macAddress !== undefined && { macAddress: macAddress?.trim()?.toUpperCase() || null }),
        ...(vendor !== undefined && { vendor }),
        ...(model !== undefined && { model }),
        ...(initialLength !== undefined && { initialLength: initialLength ? parseFloat(String(initialLength)) : null }),
        ...(remainingLength !== undefined && { remainingLength: remainingLength ? parseFloat(String(remainingLength)) : null }),
        ...(condition && { condition }),
        ...(status && { status }),
        ...(location !== undefined && { location }),
        ...(notes !== undefined && { notes }),
      },
      include: {
        item: true,
        customer: true,
      },
    });

    return NextResponse.json({ success: true, asset: updated });
  } catch (error: any) {
    console.error('Error updating asset:', error);
    return NextResponse.json({ error: error.message || 'Failed to update asset' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    await prisma.inventoryAsset.delete({ where: { id } });
    return NextResponse.json({ success: true, message: 'Asset deleted' });
  } catch (error: any) {
    console.error('Error deleting asset:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete asset' }, { status: 500 });
  }
}
