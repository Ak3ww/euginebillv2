import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';

export const dynamic = 'force-dynamic';

/**
 * POST /api/inventory/assets/bulk
 * Bulk insert assets (e.g. multiple modem serial numbers)
 * Auto-creates master catalog item if custom vendor/model is entered
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      assetType = 'MODEM',
      vendor,
      model,
      condition = 'NEW',
      status = 'AVAILABLE',
      location,
      notes,
      serialNumbers = [],
    } = body;

    if (!Array.isArray(serialNumbers) || serialNumbers.length === 0) {
      return NextResponse.json(
        { error: 'Daftar serial number tidak boleh kosong' },
        { status: 400 }
      );
    }

    // Clean SN list
    const cleanSNs = Array.from(
      new Set(
        serialNumbers
          .map((s: string) => String(s).trim().toUpperCase())
          .filter((s: string) => s.length >= 4)
      )
    );

    if (cleanSNs.length === 0) {
      return NextResponse.json(
        { error: 'Tidak ada serial number valid untuk disimpan' },
        { status: 400 }
      );
    }

    // Check existing SNs
    const existingAssets = await prisma.inventoryAsset.findMany({
      where: { serialNumber: { in: cleanSNs } },
      select: { serialNumber: true },
    });
    const existingSet = new Set(existingAssets.map((a) => a.serialNumber));

    const newSNs = cleanSNs.filter((sn) => !existingSet.has(sn));

    if (newSNs.length === 0) {
      return NextResponse.json(
        {
          error: 'Semua serial number yang dimasukkan sudah terdaftar di sistem',
          existingCount: existingSet.size,
        },
        { status: 400 }
      );
    }

    // Resolve or auto-create master itemId
    const clean = (s?: string) => (s || '').toUpperCase().trim().replace(/[^A-Z0-9]/g, '');
    const cleanV = clean(vendor).slice(0, 4);
    const cleanM = clean(model);

    let resolvedItemId: string;

    if (cleanV || cleanM) {
      const existingItem = await prisma.inventoryItem.findFirst({
        where: {
          OR: [
            ...(cleanV && cleanM ? [{ sku: { contains: `${cleanV}-${cleanM}` } }] : []),
            ...(vendor && model ? [{ name: { contains: `${vendor} ${model}` } }] : []),
            ...(model ? [{ name: { contains: model } }] : []),
          ],
        },
      });

      if (existingItem) {
        resolvedItemId = existingItem.id;
      } else {
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

    // Batch create assets
    const createdAssets = await prisma.$transaction(
      newSNs.map((sn) =>
        prisma.inventoryAsset.create({
          data: {
            itemId: resolvedItemId,
            assetType,
            serialNumber: sn,
            vendor: vendor?.trim() || null,
            model: model?.trim() || null,
            condition,
            status,
            location: location?.trim() || null,
            notes: notes || null,
          },
        })
      )
    );

    return NextResponse.json({
      success: true,
      message: `Berhasil menambahkan ${createdAssets.length} unit ke inventori.`,
      count: createdAssets.length,
      skippedCount: existingSet.size,
    });
  } catch (error: any) {
    console.error('Error in bulk asset creation:', error);
    return NextResponse.json(
      { error: error.message || 'Gagal menyimpan bulk assets' },
      { status: 500 }
    );
  }
}
