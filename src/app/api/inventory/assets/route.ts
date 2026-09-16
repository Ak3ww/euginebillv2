import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';
import { prisma } from '@/server/db/client';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const assetType = searchParams.get('assetType');
    const status = searchParams.get('status');
    const condition = searchParams.get('condition');
    const vendor = searchParams.get('vendor');
    const search = searchParams.get('search');
    const itemId = searchParams.get('itemId');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const skip = (page - 1) * limit;

    const where: any = {};

    if (assetType) where.assetType = assetType;
    if (status) where.status = status;
    if (condition) where.condition = condition;
    if (vendor) where.vendor = vendor;
    if (itemId) where.itemId = itemId;

    if (search) {
      where.OR = [
        { serialNumber: { contains: search } },
        { macAddress: { contains: search } },
        { vendor: { contains: search } },
        { model: { contains: search } },
        {
          customer: {
            OR: [
              { name: { contains: search } },
              { username: { contains: search } },
              { customerId: { contains: search } },
              { phone: { contains: search } },
            ],
          },
        },
      ];
    }

    const [assets, total, counts] = await Promise.all([
      prisma.inventoryAsset.findMany({
        where,
        include: {
          item: {
            select: { id: true, sku: true, name: true, unit: true, categoryCode: true },
          },
          customer: {
            select: { id: true, name: true, username: true, customerId: true, phone: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        skip,
      }),
      prisma.inventoryAsset.count({ where }),
      prisma.inventoryAsset.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
    ]);

    const statusCounts = counts.reduce((acc: Record<string, number>, curr) => {
      acc[curr.status] = curr._count.id;
      return acc;
    }, {});

    return NextResponse.json({
      success: true,
      assets,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      statusCounts,
    });
  } catch (error: any) {
    console.error('Error fetching inventory assets:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch assets' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      itemId,
      assetType = 'MODEM',
      serialNumber,
      macAddress,
      vendor,
      model,
      initialLength,
      remainingLength,
      condition = 'NEW',
      status = 'AVAILABLE',
      location,
      notes,
    } = body;

    if (!serialNumber) {
      return NextResponse.json({ error: 'Serial number / Kode roll wajib diisi' }, { status: 400 });
    }

    const cleanSN = serialNumber.trim().toUpperCase();

    // Check duplicate serialNumber
    const existing = await prisma.inventoryAsset.findUnique({
      where: { serialNumber: cleanSN },
    });

    if (existing) {
      return NextResponse.json(
        { error: `Perangkat/Roll dengan nomor seri ${cleanSN} sudah terdaftar di sistem` },
        { status: 400 }
      );
    }

    // Resolve or auto-create master itemId if not provided
    let resolvedItemId = itemId;
    if (!resolvedItemId) {
      const clean = (s?: string) => (s || '').toUpperCase().trim().replace(/[^A-Z0-9]/g, '');
      const cleanV = clean(vendor).slice(0, 4);
      const cleanM = clean(model);

      if (cleanV || cleanM) {
        // Try finding matching item in inventoryItem
        const existing = await prisma.inventoryItem.findFirst({
          where: {
            OR: [
              ...(cleanV && cleanM ? [{ sku: { contains: `${cleanV}-${cleanM}` } }] : []),
              ...(vendor && model ? [{ name: { contains: `${vendor} ${model}` } }] : []),
              ...(model ? [{ name: { contains: model } }] : []),
            ],
          },
        });

        if (existing) {
          resolvedItemId = existing.id;
        } else {
          // Auto-create new master item so manually typed model is automatically saved
          const catCode = assetType === 'MODEM' ? 'CPE' : 'CAB';
          const subCode = assetType === 'MODEM' ? 'ONT' : 'ROLL';
          const detail = cleanV && cleanM ? `${cleanV}-${cleanM}` : cleanM || cleanV || 'GENERIC';
          const sku = `EMG-${catCode}-${subCode}-${detail}`;
          const itemName = assetType === 'MODEM'
            ? `Modem ${vendor || ''} ${model || ''}`.trim()
            : `Kabel ${vendor || ''} ${model || ''}`.trim();

          const created = await prisma.inventoryItem.upsert({
            where: { sku },
            create: {
              sku,
              name: itemName || `${catCode} ${detail}`,
              categoryCode: catCode,
              subCategory: subCode,
              isSerialized: true,
              unit: assetType === 'MODEM' ? 'unit' : 'meter',
              isActive: true,
            },
            update: {},
          });
          resolvedItemId = created.id;
        }
      } else {
        // Fallback to any serialized item or create generic
        const defaultItem = await prisma.inventoryItem.findFirst({
          where: {
            OR: [
              { isSerialized: true },
              { sku: { contains: assetType } },
            ],
          },
        });

        if (defaultItem) {
          resolvedItemId = defaultItem.id;
        } else {
          const genericSku = assetType === 'MODEM' ? 'EMG-CPE-ONT-GENERIC' : 'EMG-CAB-ROLL-GENERIC';
          const generic = await prisma.inventoryItem.upsert({
            where: { sku: genericSku },
            create: {
              sku: genericSku,
              name: assetType === 'MODEM' ? 'Modem ONT Generic' : 'Roll Kabel Generic',
              categoryCode: assetType === 'MODEM' ? 'CPE' : 'CAB',
              subCategory: assetType === 'MODEM' ? 'ONT' : 'ROLL',
              isSerialized: true,
              unit: assetType === 'MODEM' ? 'unit' : 'meter',
              isActive: true,
            },
            update: {},
          });
          resolvedItemId = generic.id;
        }
      }
    }

    const asset = await prisma.inventoryAsset.create({
      data: {
        itemId: resolvedItemId,
        assetType,
        serialNumber: cleanSN,
        macAddress: macAddress?.trim()?.toUpperCase() || null,
        vendor: vendor?.trim() || null,
        model: model?.trim() || null,
        initialLength: initialLength ? parseFloat(String(initialLength)) : null,
        remainingLength: remainingLength
          ? parseFloat(String(remainingLength))
          : initialLength
          ? parseFloat(String(initialLength))
          : null,
        condition,
        status,
        location: location?.trim() || null,
        notes: notes || null,
      },
      include: {
        item: true,
      },
    });

    return NextResponse.json({ success: true, asset });
  } catch (error: any) {
    console.error('Error creating inventory asset:', error);
    return NextResponse.json({ error: error.message || 'Failed to create asset' }, { status: 500 });
  }
}
