import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';

export const dynamic = 'force-dynamic';

/**
 * POST /api/inventory/sku/generate
 * Generate formatted EMG SKU based on category, subcategory, brand/model or spec
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { categoryCode, subCategoryCode, isBranded, brand, model, spec } = body;

    if (!categoryCode || !subCategoryCode) {
      return NextResponse.json(
        { success: false, error: 'Kategori dan sub-kategori wajib dipilih' },
        { status: 400 }
      );
    }

    const clean = (s?: string) => (s || '').toUpperCase().trim().replace(/[^A-Z0-9]/g, '');
    const cat = clean(categoryCode);
    const sub = clean(subCategoryCode);

    let detail = '';
    if (isBranded) {
      const cleanBrand = clean(brand).slice(0, 4);
      const cleanModel = clean(model);
      if (cleanBrand && cleanModel) {
        detail = `${cleanBrand}-${cleanModel}`;
      } else if (cleanBrand) {
        detail = cleanBrand;
      } else if (cleanModel) {
        detail = cleanModel;
      }
    } else {
      detail = clean(spec);
    }

    const sku = `EMG-${cat}-${sub}${detail ? `-${detail}` : ''}`.replace(/-+$/, '');

    // Check for duplicates in inventoryItem
    let existingItem: any = null;
    let isDuplicate = false;

    if (sku && sku !== `EMG-${cat}-${sub}`) {
      existingItem = await prisma.inventoryItem.findUnique({
        where: { sku },
        select: {
          id: true,
          sku: true,
          name: true,
          currentStock: true,
          unit: true,
          categoryCode: true,
          subCategory: true,
        },
      });

      if (existingItem) {
        isDuplicate = true;
      }
    }

    return NextResponse.json({
      success: true,
      sku,
      isDuplicate,
      existingItem,
    });
  } catch (error: any) {
    console.error('Error generating SKU:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
