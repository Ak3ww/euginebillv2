import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { requirePermission } from '@/server/middleware/api-auth';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/admin/sku-settings/subcategories/[id]
 * Update subcategory details
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authCheck = await requirePermission('inventory.manage');
    if (!authCheck.authorized) return authCheck.response;

    const { id } = await params;
    const body = await req.json();
    const { label, requiresBrand, isActive } = body;

    const subcategory = await prisma.skuSubCategoryCode.findUnique({
      where: { id },
    });

    if (!subcategory) {
      return NextResponse.json(
        { success: false, error: 'Sub-kategori SKU tidak ditemukan' },
        { status: 404 }
      );
    }

    const updateData: any = {};
    if (label !== undefined && typeof label === 'string' && label.trim()) {
      updateData.label = label.trim();
    }
    if (requiresBrand !== undefined && typeof requiresBrand === 'boolean') {
      updateData.requiresBrand = requiresBrand;
    }
    if (isActive !== undefined && typeof isActive === 'boolean') {
      updateData.isActive = isActive;
    }

    const updated = await prisma.skuSubCategoryCode.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      subcategory: updated,
      message: 'Sub-kategori SKU berhasil diperbarui',
    });
  } catch (error: any) {
    console.error('Error updating SKU subcategory:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/sku-settings/subcategories/[id]
 * Delete subcategory
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authCheck = await requirePermission('inventory.manage');
    if (!authCheck.authorized) return authCheck.response;

    const { id } = await params;

    const subcategory = await prisma.skuSubCategoryCode.findUnique({
      where: { id },
    });

    if (!subcategory) {
      return NextResponse.json(
        { success: false, error: 'Sub-kategori SKU tidak ditemukan' },
        { status: 404 }
      );
    }

    await prisma.skuSubCategoryCode.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: `Sub-kategori SKU ${subcategory.code} berhasil dihapus`,
    });
  } catch (error: any) {
    console.error('Error deleting SKU subcategory:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
