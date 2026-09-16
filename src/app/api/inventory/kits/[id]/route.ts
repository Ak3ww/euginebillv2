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

    const kit = await prisma.workOrderTypeKit.findUnique({
      where: { id: params.id },
      include: {
        items: {
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
        },
      },
    });

    if (!kit) {
      return NextResponse.json({ error: 'Kit not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, kit });
  } catch (error: any) {
    console.error('Error fetching kit:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch kit' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, isActive, issueType } = body;

    const data: any = {};
    if (name !== undefined) data.name = String(name).trim();
    if (isActive !== undefined) data.isActive = !!isActive;
    if (issueType !== undefined) data.issueType = String(issueType).trim().toUpperCase();

    const kit = await prisma.workOrderTypeKit.update({
      where: { id: params.id },
      data,
      include: {
        items: {
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
        },
      },
    });

    return NextResponse.json({ success: true, kit });
  } catch (error: any) {
    console.error('Error updating kit:', error);
    return NextResponse.json({ error: error.message || 'Failed to update kit' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await prisma.workOrderTypeKit.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true, message: 'Kit deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting kit:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete kit' }, { status: 500 });
  }
}
