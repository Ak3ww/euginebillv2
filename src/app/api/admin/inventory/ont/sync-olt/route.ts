import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';
import { previewOltInventorySync, syncAllOltsToInventory } from '@/server/services/olt-inventory-sync.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/inventory/ont/sync-olt
 * Previews synchronization status between all OLT ONUs and Inventory Assets
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const preview = await previewOltInventorySync();
    return NextResponse.json({
      success: true,
      data: preview,
    });
  } catch (error: any) {
    console.error('[OLT Inventory Sync GET]', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat pratinjau sinkronisasi OLT' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/inventory/ont/sync-olt
 * Executes batch sync from all OLTs into Inventory Assets
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await syncAllOltsToInventory();
    return NextResponse.json({
      success: true,
      message: `Berhasil menyinkronkan ${result.totalProcessed} unit ONU OLT ke inventori modem. ${result.createdCount} unit baru ditambahkan, ${result.updatedCount} unit diperbarui, dan ${result.linkedCustomerCount} unit tertaut ke pelanggan.`,
      data: result,
    });
  } catch (error: any) {
    console.error('[OLT Inventory Sync POST]', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal mengeksekusi sinkronisasi OLT ke inventori' },
      { status: 500 }
    );
  }
}
