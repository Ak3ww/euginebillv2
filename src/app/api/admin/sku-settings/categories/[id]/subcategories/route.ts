import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { requirePermission } from '@/server/middleware/api-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/sku-settings/categories/[id]/subcategories
 * List subcategories under a specific category code (slug param is named [id] to avoid Next.js slug conflict)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authCheck = await requirePermission('inventory.view');
    if (!authCheck.authorized) return authCheck.response;

    const { id } = await params;
    const categoryCode = id.toUpperCase().trim();

    const { searchParams } = new URL(req.url);
    const activeOnly = searchParams.get('activeOnly') === 'true';

    const where: any = { categoryCode };
    if (activeOnly) {
      where.isActive = true;
    }

    const subcategories = await prisma.skuSubCategoryCode.findMany({
      where,
      orderBy: { code: 'asc' },
    });

    return NextResponse.json({
      success: true,
      categoryCode,
      subcategories,
    });
  } catch (error: any) {
    console.error('Error fetching SKU subcategories:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/sku-settings/categories/[id]/subcategories
 * Create a new subcategory under categoryCode
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authCheck = await requirePermission('inventory.manage');
    if (!authCheck.authorized) return authCheck.response;

    const { id } = await params;
    const categoryCode = id.toUpperCase().trim();

    const category = await prisma.skuCategoryCode.findUnique({
      where: { code: categoryCode },
    });

    if (!category) {
      return NextResponse.json(
        { success: false, error: `Kategori SKU induk "${categoryCode}" tidak ditemukan` },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { code: subCode, label, requiresBrand, isActive } = body;

    if (!subCode || typeof subCode !== 'string' || !subCode.trim()) {
      return NextResponse.json(
        { success: false, error: 'Kode sub-kategori wajib diisi' },
        { status: 400 }
      );
    }

    if (!label || typeof label !== 'string' || !label.trim()) {
      return NextResponse.json(
        { success: false, error: 'Nama label sub-kategori wajib diisi' },
        { status: 400 }
      );
    }

    const cleanSubCode = subCode.toUpperCase().trim().replace(/[^A-Z0-9]/g, '').slice(0, 5);
    if (cleanSubCode.length < 2) {
      return NextResponse.json(
        { success: false, error: 'Kode sub-kategori minimal 2 huruf/angka (misal: ONT, DRP)' },
        { status: 400 }
      );
    }

    // Check duplicate
    const existing = await prisma.skuSubCategoryCode.findUnique({
      where: {
        categoryCode_code: {
          categoryCode,
          code: cleanSubCode,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: `Sub-kategori "${cleanSubCode}" sudah ada di bawah kategori "${categoryCode}"` },
        { status: 409 }
      );
    }

    const newSubcategory = await prisma.skuSubCategoryCode.create({
      data: {
        categoryCode,
        code: cleanSubCode,
        label: label.trim(),
        requiresBrand: requiresBrand !== false,
        isActive: isActive !== false,
      },
    });

    return NextResponse.json({
      success: true,
      subcategory: newSubcategory,
      message: `Sub-kategori SKU ${categoryCode}-${cleanSubCode} berhasil dibuat`,
    });
  } catch (error: any) {
    console.error('Error creating SKU subcategory:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
