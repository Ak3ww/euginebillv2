import 'server-only';
import { prisma } from '@/server/db/client';

export interface DeductItemInput {
  workOrderId: string;
  itemId: string;
  assetId?: string | null;
  quantityUsed: number;
  customerId?: string | null;
}

/**
 * Deduct material according to Section 4 of EMG_INVENTORY_DOCUMENT_NUMBERING_SPEC.md:
 * - Jalur A: Serialized (CABLE_ROLL: reduces remainingLength, sets DEPLETED if <= 10m; MODEM: sets IN_USE & customer)
 * - Jalur B: Quantity-based (Consumable generic: reduces stockQuantity on inventoryItem)
 * - Uses optimistic locking (version) and transaction to prevent race conditions.
 */
export async function deductWorkOrderMaterial(
  materialId: string,
  tx?: any
): Promise<{ success: boolean; message: string }> {
  const db = tx || prisma;

  return await db.$transaction(async (prismaTx: any) => {
    // 1. Fetch material record with locks
    const material = await prismaTx.workOrderMaterial.findUnique({
      where: { id: materialId },
      include: {
        item: true,
        asset: true,
        workOrder: true,
      },
    });

    if (!material) {
      throw new Error(`WorkOrderMaterial not found: ${materialId}`);
    }

    // Idempotency check: don't deduct twice!
    if (material.isDeducted) {
      return { success: true, message: 'Material already deducted' };
    }

    const item = material.item;
    const targetCustomerId = material.workOrder?.linkedUserId || null;

    if (item.isSerialized) {
      // ─── Jalur A: Serialized (Roll kabel atau Modem) ─────────────────
      if (!material.assetId) {
        throw new Error(`Asset ID required for serialized item ${item.sku}`);
      }

      const asset = await prismaTx.inventoryAsset.findUnique({
        where: { id: material.assetId },
      });

      if (!asset) {
        throw new Error(`InventoryAsset not found: ${material.assetId}`);
      }

      const currentVersion = asset.version;

      if (asset.assetType === 'CABLE_ROLL') {
        const remaining = asset.remainingLength ?? asset.initialLength ?? 0;
        const used = material.quantityUsed || 0;
        const newRemaining = remaining - used;

        if (newRemaining < 0) {
          throw new Error(`Sisa roll kabel ${asset.serialNumber} tidak mencukupi (${remaining}m tersedia, butuh ${used}m)`);
        }

        const newStatus = newRemaining <= 10 ? 'DEPLETED' : 'AVAILABLE';

        // Optimistic locking update
        const updatedAsset = await prismaTx.inventoryAsset.updateMany({
          where: {
            id: asset.id,
            version: currentVersion,
          },
          data: {
            remainingLength: newRemaining,
            status: newStatus,
            version: { increment: 1 },
          },
        });

        if (updatedAsset.count === 0) {
          throw new Error(`Konflik pembaruan kabel roll ${asset.serialNumber}. Silakan coba lagi.`);
        }

        // Record stock movement
        await prismaTx.inventoryMovement.create({
          data: {
            itemId: item.id,
            movementType: 'OUT',
            quantity: Math.round(used),
            previousStock: Math.round(remaining),
            newStock: Math.round(newRemaining),
            referenceNo: `SPK-${material.workOrderId.slice(-6)}`,
            notes: `Auto-deduct pemakaian kabel roll ${asset.serialNumber} (terpakai ${used}m, sisa ${newRemaining}m) di SPK #${material.workOrderId}`,
          },
        });
      } else {
        // MODEM / ROUTER
        const updatedAsset = await prismaTx.inventoryAsset.updateMany({
          where: {
            id: asset.id,
            version: currentVersion,
          },
          data: {
            status: 'IN_USE',
            currentCustomerId: targetCustomerId,
            installedAt: new Date(),
            version: { increment: 1 },
          },
        });

        if (updatedAsset.count === 0) {
          throw new Error(`Konflik pembaruan perangkat ${asset.serialNumber}. Silakan coba lagi.`);
        }

        // Create customer device history record
        if (targetCustomerId) {
          await prismaTx.customerDeviceHistory.create({
            data: {
              customerId: targetCustomerId,
              assetId: asset.id,
              serialNumber: asset.serialNumber,
              macAddress: asset.macAddress,
              vendor: asset.vendor,
              model: asset.model,
              action: 'INSTALLED',
              reason: 'Pemasangan SPK',
              workOrderId: material.workOrderId,
              installedAt: new Date(),
            },
          });
        }
      }
    } else {
      // ─── Jalur B: Consumable Generic (Kabel Tis, Isolasi, Paku Klem) ──
      // Soft-limit: boleh minus, jangan diblokir (SPK tetap selesai, angka minus tanda restock)
      const currentStock = item.currentStock ?? 0;
      const used = material.quantityUsed || 0;
      const newStock = currentStock - used;

      if (newStock < 0) {
        console.warn(`[Stock Warning] ${item.sku} minus: ${newStock} (perlu restock)`);
      }

      await prismaTx.inventoryItem.update({
        where: { id: item.id },
        data: {
          currentStock: newStock,
        },
      });

      // Record movement
      await prismaTx.inventoryMovement.create({
        data: {
          itemId: item.id,
          movementType: 'OUT',
          quantity: used,
          previousStock: currentStock,
          newStock: newStock,
          referenceNo: `SPK-${material.workOrderId.slice(-6)}`,
          notes: `Auto-deduct pemakaian consumable ${item.name} di SPK #${material.workOrderId}`,
        },
      });
    }

    // Mark workOrderMaterial as deducted
    await prismaTx.workOrderMaterial.update({
      where: { id: material.id },
      data: {
        isDeducted: true,
        deductedAt: new Date(),
      },
    });

    return { success: true, message: 'Deduction completed successfully' };
  });
}
