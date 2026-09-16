import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';

export const dynamic = 'force-dynamic';

// GET - List all standard kits with their items
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const issueType = searchParams.get('issueType');

    const where: any = {};
    if (issueType) {
      where.issueType = issueType.toUpperCase();
    }

    const kits = await prisma.workOrderTypeKit.findMany({
      where,
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
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ success: true, kits });
  } catch (error: any) {
    console.error('Error fetching kits:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch kits' }, { status: 500 });
  }
}

// POST - Create or upsert a kit
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { issueType, name, isActive } = body;

    if (!issueType || !name) {
      return NextResponse.json({ error: 'issueType and name are required' }, { status: 400 });
    }

    const upperIssue = String(issueType).trim().toUpperCase();

    const kit = await prisma.workOrderTypeKit.upsert({
      where: { issueType: upperIssue },
      create: {
        issueType: upperIssue,
        name: String(name).trim(),
        isActive: isActive !== undefined ? !!isActive : true,
      },
      update: {
        name: String(name).trim(),
        ...(isActive !== undefined ? { isActive: !!isActive } : {}),
      },
      include: {
        items: {
          include: { item: true },
        },
      },
    });

    return NextResponse.json({ success: true, kit }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating kit:', error);
    return NextResponse.json({ error: error.message || 'Failed to create kit' }, { status: 500 });
  }
}
