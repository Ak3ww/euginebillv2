import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';
import { prisma } from '@/server/db/client';

export const dynamic = 'force-dynamic';

// POST /api/pppoe/users/[id]/replace-device
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id: customerId } = params;
    const body = await request.json();
    const { newSerialNumber, reason, technicianName } = body;

    if (!newSerialNumber || !newSerialNumber.trim()) {
      return NextResponse.json({ error: 'Serial Number modem baru wajib diisi' }, { status: 400 });
    }

    const cleanSN = newSerialNumber.trim().toUpperCase();

    // 1. Verify customer exists
    const customer = await prisma.pppoeUser.findUnique({ where: { id: customerId } });
    if (!customer) {
      return NextResponse.json({ error: 'Pelanggan tidak ditemukan' }, { status: 404 });
    }

    // 2. Find the new asset
    let newAsset = await prisma.inventoryAsset.findUnique({
      where: { serialNumber: cleanSN },
    });

    if (!newAsset) {
      return NextResponse.json({
        error: `Modem SN ${cleanSN} tidak ditemukan di inventori. Pastikan modem sudah didaftarkan terlebih dahulu.`
      }, { status: 404 });
    }

    if (newAsset.assetType !== 'MODEM') {
      return NextResponse.json({ error: 'Perangkat ini bukan tipe MODEM' }, { status: 400 });
    }

    if (newAsset.status !== 'AVAILABLE' && newAsset.status !== 'USED_GOOD') {
      return NextResponse.json({
        error: `Modem SN ${cleanSN} tidak tersedia (status: ${newAsset.status}). Pilih modem yang berstatus AVAILABLE.`
      }, { status: 400 });
    }

    const now = new Date();
    const techName = technicianName?.trim() || session.user.name || session.user.email || 'Admin';
    const replaceReason = reason?.trim() || 'Penggantian modem';

    await prisma.$transaction(async (tx) => {
      // 3. Find old active asset for this customer
      const oldAsset = await tx.inventoryAsset.findFirst({
        where: { currentCustomerId: customerId, status: 'IN_USE', assetType: 'MODEM' },
      });

      if (oldAsset) {
        // 4. Update old asset — set to USED_GOOD, remove customer link
        await tx.inventoryAsset.update({
          where: { id: oldAsset.id },
          data: {
            status: 'USED_GOOD',
            currentCustomerId: null,
            currentWorkOrderId: null,
          },
        });

        // 5. Log old device removal
        await tx.customerDeviceHistory.create({
          data: {
            customerId,
            assetId: oldAsset.id,
            serialNumber: oldAsset.serialNumber,
            macAddress: oldAsset.macAddress,
            vendor: oldAsset.vendor,
            model: oldAsset.model,
            action: 'REPLACED_OLD',
            reason: replaceReason,
            technicianName: techName,
            removedAt: now,
          },
        });
      }

      // 6. Update new asset — set to IN_USE, link to customer
      await tx.inventoryAsset.update({
        where: { id: newAsset!.id },
        data: {
          status: 'IN_USE',
          currentCustomerId: customerId,
          installedAt: now,
          version: { increment: 1 },
        },
      });

      // 7. Log new device installation
      await tx.customerDeviceHistory.create({
        data: {
          customerId,
          assetId: newAsset!.id,
          serialNumber: cleanSN,
          macAddress: newAsset!.macAddress,
          vendor: newAsset!.vendor,
          model: newAsset!.model,
          action: 'REPLACED_NEW',
          reason: replaceReason,
          technicianName: techName,
          installedAt: now,
        },
      });

      // 8. Update pppoeUser macAddress if available
      if (newAsset!.macAddress) {
        await tx.pppoeUser.update({
          where: { id: customerId },
          data: { macAddress: newAsset!.macAddress },
        });
      }
    });

    const updatedAsset = await prisma.inventoryAsset.findUnique({ where: { id: newAsset.id } });

    return NextResponse.json({
      success: true,
      message: `Modem berhasil diganti ke SN ${cleanSN}`,
      newAsset: updatedAsset,
    });
  } catch (error: any) {
    console.error('POST replace-device error:', error);
    return NextResponse.json({ error: error.message || 'Gagal mengganti modem' }, { status: 500 });
  }
}
