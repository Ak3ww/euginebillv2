import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { requirePermission } from '@/server/middleware/api-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/sku-settings/categories
 * List all SKU category codes with subcategory counts
 */
export async function GET(req: NextRequest) {
  try {
    const authCheck = await requirePermission('inventory.view');
    if (!authCheck.authorized) return authCheck.response;

    const { searchParams } = new URL(req.url);
    const activeOnly = searchParams.get('activeOnly') === 'true';

    const where: any = {};
    if (activeOnly) {
      where.isActive = true;
    }

    const categories = await prisma.skuCategoryCode.findMany({
      where,
      orderBy: [
        { sortOrder: 'asc' },
        { code: 'asc' },
      ],
      include: {
        _count: {
          select: { subCategories: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      categories,
    });
  } catch (error: any) {
    console.error('Error fetching SKU categories:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/sku-settings/categories
 * Create a new SKU category code
 */
export async function POST(req: NextRequest) {
  try {
    const authCheck = await requirePermission('inventory.manage');
    if (!authCheck.authorized) return authCheck.response;

    const body = await req.json();
    const { code, label, sortOrder, isActive } = body;

    if (!code || typeof code !== 'string' || !code.trim()) {
      return NextResponse.json(
        { success: false, error: 'Kode kategori wajib diisi' },
        { status: 400 }
      );
    }

    if (!label || typeof label !== 'string' || !label.trim()) {
      return NextResponse.json(
        { success: false, error: 'Nama label kategori wajib diisi' },
        { status: 400 }
      );
    }

    const cleanCode = code.toUpperCase().trim().replace(/[^A-Z0-9]/g, '').slice(0, 5);
    if (cleanCode.length < 2) {
      return NextResponse.json(
        { success: false, error: 'Kode kategori minimal 2 huruf/angka (misal: HW, CPE)' },
        { status: 400 }
      );
    }

    // Check existing
    const existing = await prisma.skuCategoryCode.findUnique({
      where: { code: cleanCode },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: `Kode kategori "${cleanCode}" sudah ada` },
        { status: 409 }
      );
    }

    const newCategory = await prisma.skuCategoryCode.create({
      data: {
        code: cleanCode,
        label: label.trim(),
        sortOrder: typeof sortOrder === 'number' ? sortOrder : 0,
        isActive: isActive !== false,
      },
    });

    return NextResponse.json({
      success: true,
      category: newCategory,
      message: `Kategori SKU ${cleanCode} berhasil dibuat`,
    });
  } catch (error: any) {
    console.error('Error creating SKU category:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
