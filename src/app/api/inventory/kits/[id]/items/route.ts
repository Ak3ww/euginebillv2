import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const items = await prisma.workOrderTypeKitItem.findMany({
      where: { kitId: params.id },
      include: {
        item: {
          select: {
            id: true,
            sku: true,
            name: true,
            unit: true,
            categoryCode: true,
            subCategory: true,
            currentStock: true,
            packSize: true,
            isSerialized: true,
          },
        },
      },
      orderBy: { item: { name: 'asc' } },
    });

    return NextResponse.json({ success: true, items });
  } catch (error: any) {
    console.error('Error fetching kit items:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch kit items' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { itemId, defaultQty } = body;

    if (!itemId) {
      return NextResponse.json({ error: 'itemId is required' }, { status: 400 });
    }

    const qty = parseFloat(defaultQty);
    if (isNaN(qty) || qty <= 0) {
      return NextResponse.json({ error: 'defaultQty must be a positive number' }, { status: 400 });
    }

    // Verify kit exists
    const kit = await prisma.workOrderTypeKit.findUnique({
      where: { id: params.id },
    });
    if (!kit) {
      return NextResponse.json({ error: 'Kit not found' }, { status: 404 });
    }

    // Verify item exists
    const item = await prisma.inventoryItem.findUnique({
      where: { id: itemId },
    });
    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    const kitItem = await prisma.workOrderTypeKitItem.upsert({
      where: {
        kitId_itemId: {
          kitId: params.id,
          itemId,
        },
      },
      create: {
        kitId: params.id,
        itemId,
        defaultQty: qty,
      },
      update: {
        defaultQty: qty,
      },
      include: {
        item: {
          select: {
            id: true,
            sku: true,
            name: true,
            unit: true,
            categoryCode: true,
            subCategory: true,
            currentStock: true,
            packSize: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, kitItem }, { status: 201 });
  } catch (error: any) {
    console.error('Error adding/updating kit item:', error);
    return NextResponse.json({ error: error.message || 'Failed to add item to kit' }, { status: 500 });
  }
}
