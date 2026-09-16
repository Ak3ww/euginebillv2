import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { requirePermission } from '@/server/middleware/api-auth';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/admin/sku-settings/categories/[id]
 * Update category details
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
    const { label, sortOrder, isActive } = body;

    const category = await prisma.skuCategoryCode.findUnique({
      where: { id },
    });

    if (!category) {
      return NextResponse.json(
        { success: false, error: 'Kategori SKU tidak ditemukan' },
        { status: 404 }
      );
    }

    const updateData: any = {};
    if (label !== undefined && typeof label === 'string' && label.trim()) {
      updateData.label = label.trim();
    }
    if (sortOrder !== undefined && typeof sortOrder === 'number') {
      updateData.sortOrder = sortOrder;
    }
    if (isActive !== undefined && typeof isActive === 'boolean') {
      updateData.isActive = isActive;
    }

    const updated = await prisma.skuCategoryCode.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      category: updated,
      message: 'Kategori SKU berhasil diperbarui',
    });
  } catch (error: any) {
    console.error('Error updating SKU category:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/sku-settings/categories/[id]
 * Delete category (only if no subcategories exist)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authCheck = await requirePermission('inventory.manage');
    if (!authCheck.authorized) return authCheck.response;

    const { id } = await params;

    const category = await prisma.skuCategoryCode.findUnique({
      where: { id },
      include: {
        _count: {
          select: { subCategories: true },
        },
      },
    });

    if (!category) {
      return NextResponse.json(
        { success: false, error: 'Kategori SKU tidak ditemukan' },
        { status: 404 }
      );
    }

    if (category._count.subCategories > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Kategori ${category.code} masih memiliki ${category._count.subCategories} sub-kategori. Hapus sub-kategori terlebih dahulu atau nonaktifkan kategori.`,
        },
        { status: 400 }
      );
    }

    await prisma.skuCategoryCode.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: `Kategori SKU ${category.code} berhasil dihapus`,
    });
  } catch (error: any) {
    console.error('Error deleting SKU category:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
