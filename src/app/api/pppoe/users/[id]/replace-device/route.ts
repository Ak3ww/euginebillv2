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

    // 2. Find or auto-create the asset
    let newAsset = await prisma.inventoryAsset.findFirst({
      where: {
        OR: [
          { serialNumber: cleanSN },
          { serialNumber: newSerialNumber.trim() },
        ],
      },
    });

    if (!newAsset) {
      // Auto-register new modem unit if not in inventory yet
      let catalogItem = await prisma.inventoryItem.findFirst({
        where: {
          OR: [
            { sku: { contains: 'CPE-ONT' } },
            { name: { contains: 'ONT' } },
            { name: { contains: 'Modem' } },
          ],
        },
      });

      if (!catalogItem) {
        catalogItem = await prisma.inventoryItem.findFirst();
      }

      if (!catalogItem) {
        try {
          catalogItem = await prisma.inventoryItem.create({
            data: {
              sku: 'EMG-CPE-ONT-GENERIC',
              name: 'Modem ONT GPON Standar',
              categoryCode: 'CPE',
              subCategory: 'ONT',
              unit: 'pcs',
              isSerialized: true,
            },
          });
        } catch {
          catalogItem = await prisma.inventoryItem.findFirst();
        }
      }

      if (catalogItem) {
        let vendor = 'Generic';
        let model = 'GPON ONT';
        if (cleanSN.startsWith('ZTEG')) { vendor = 'ZTE'; model = 'ZTE F609 V3'; }
        else if (cleanSN.startsWith('SKYW')) { vendor = 'Skyworth'; model = 'GN542VF'; }
        else if (cleanSN.startsWith('RTEG')) { vendor = 'Realtek'; model = 'RTL8672 GPON'; }
        else if (cleanSN.startsWith('YHTC')) { vendor = 'Yuhua'; model = 'YH-100G'; }
        else if (cleanSN.startsWith('FHTT')) { vendor = 'FiberHome'; model = 'HG6243C'; }
        else if (cleanSN.startsWith('HWTC')) { vendor = 'Huawei'; model = 'HG8245H'; }
        else if (cleanSN.startsWith('AZVG')) { vendor = 'VSOL'; model = 'V2801 Series'; }

        newAsset = await prisma.inventoryAsset.create({
          data: {
            itemId: catalogItem.id,
            assetType: 'MODEM',
            serialNumber: cleanSN,
            vendor,
            model,
            condition: 'NEW',
            status: 'AVAILABLE',
            notes: `Auto-registered saat pergantian modem pelanggan ${customer.name} (${customer.username})`,
          },
        });
      }
    }

    if (!newAsset) {
      return NextResponse.json({
        error: `Gagal mendaftarkan modem SN ${cleanSN}. Pastikan katalog barang tersedia.`
      }, { status: 400 });
    }

    if (newAsset.assetType !== 'MODEM') {
      return NextResponse.json({ error: 'Perangkat ini bukan tipe MODEM' }, { status: 400 });
    }

    if (newAsset.status !== 'AVAILABLE' && newAsset.status !== 'USED_GOOD' && newAsset.currentCustomerId !== customerId) {
      return NextResponse.json({
        error: `Modem SN ${cleanSN} sedang digunakan pelanggan lain (status: ${newAsset.status}). Pilih modem yang berstatus AVAILABLE.`
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
