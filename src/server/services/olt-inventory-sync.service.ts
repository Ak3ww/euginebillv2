/**
 * OLT <-> Inventory Asset Synchronization Service
 * Provides single-source-of-truth reconciliation between live OLT ONUs,
 * warehouse inventory assets, and customer device assignments.
 */

import { prisma } from '@/server/db/client';
import { detectOntVendorAndModel, normalizeSerialNumber } from '@/lib/olt/ont-detector';

export interface SyncOnuInput {
  serialNumber: string;
  macAddress?: string | null;
  onuType?: string | null;
  customerId?: string | null;
  oltVendor?: string | null;
  oltName?: string | null;
  installedAt?: Date;
}

export interface SyncResult {
  assetId: string;
  serialNumber: string;
  vendor: string;
  model: string;
  status: string;
  isNew: boolean;
  customerId: string | null;
}

/**
 * Ensure default ONT master catalog item exists in inventory
 */
export async function getOrCreateDefaultOntItem(vendor?: string): Promise<{ id: string; sku: string }> {
  // Check for vendor-specific or generic ONT master item
  const existingItem = await prisma.inventoryItem.findFirst({
    where: {
      OR: [
        { sku: 'EMG-CPE-ONT-GENERIC' },
        { categoryCode: 'CPE', subCategory: 'ONT' },
      ],
    },
    select: { id: true, sku: true },
  });

  if (existingItem) return existingItem;

  // Create default master item if missing
  const newItem = await prisma.inventoryItem.create({
    data: {
      sku: 'EMG-CPE-ONT-GENERIC',
      name: 'Modem ONT Pelanggan (Generic)',
      categoryCode: 'CPE',
      subCategory: 'ONT',
      unit: 'pcs',
      isSerialized: true,
      currentStock: 0,
      isActive: true,
      description: 'Master katalog unit modem ONT pelanggan terdeteksi dari OLT',
    },
    select: { id: true, sku: true },
  });

  return newItem;
}

/**
 * Synchronize a single OLT ONU to the inventory assets table and link customer
 */
export async function syncOnuToInventory(input: SyncOnuInput): Promise<SyncResult | null> {
  const cleanSn = normalizeSerialNumber(input.serialNumber);
  if (!cleanSn) return null;

  const detected = detectOntVendorAndModel(cleanSn, input.onuType, input.oltVendor);
  const defaultItem = await getOrCreateDefaultOntItem(detected.vendor);

  const existingAsset = await prisma.inventoryAsset.findUnique({
    where: { serialNumber: cleanSn },
    include: { customer: { select: { id: true, username: true } } },
  });

  let assetId: string;
  let isNew = false;
  const targetStatus = input.customerId ? 'IN_USE' : 'AVAILABLE';

  if (existingAsset) {
    assetId = existingAsset.id;
    // Update existing asset
    const updateData: any = {
      status: targetStatus,
      currentCustomerId: input.customerId || null,
      updatedAt: new Date(),
    };

    // Enrich vendor & model if previously generic or empty
    if (!existingAsset.vendor || existingAsset.vendor === 'Generic') {
      updateData.vendor = detected.vendor;
    }
    if (!existingAsset.model || existingAsset.model.toLowerCase().includes('generic')) {
      updateData.model = detected.model;
    }
    if (input.macAddress && !existingAsset.macAddress) {
      updateData.macAddress = input.macAddress;
    }
    if (input.customerId && !existingAsset.installedAt) {
      updateData.installedAt = input.installedAt || new Date();
    }

    await prisma.inventoryAsset.update({
      where: { id: existingAsset.id },
      data: updateData,
    });
  } else {
    isNew = true;
    // Create new inventory asset
    const created = await prisma.inventoryAsset.create({
      data: {
        itemId: defaultItem.id,
        assetType: 'MODEM',
        serialNumber: cleanSn,
        macAddress: input.macAddress || null,
        vendor: detected.vendor,
        model: detected.model,
        condition: input.customerId ? 'USED_GOOD' : 'NEW',
        status: targetStatus,
        currentCustomerId: input.customerId || null,
        installedAt: input.customerId ? (input.installedAt || new Date()) : null,
        notes: `Otomatis disinkronkan dari OLT ${input.oltName || input.oltVendor || ''}`,
      },
      select: { id: true },
    });
    assetId = created.id;
  }

  // Update customer PPPoE record & Device History if assigned
  if (input.customerId) {
    const customer = await prisma.pppoeUser.findUnique({
      where: { id: input.customerId },
      select: { id: true, macAddress: true, username: true },
    });

    if (customer) {
      // Update customer MAC if missing or different
      if (input.macAddress && customer.macAddress !== input.macAddress) {
        await prisma.pppoeUser.update({
          where: { id: customer.id },
          data: { macAddress: input.macAddress },
        }).catch(() => {});
      }

      // Check device history to prevent duplicates
      const lastHistory = await prisma.customerDeviceHistory.findFirst({
        where: { customerId: customer.id },
        orderBy: { createdAt: 'desc' },
      });

      if (!lastHistory || lastHistory.serialNumber !== cleanSn) {
        await prisma.customerDeviceHistory.create({
          data: {
            customerId: customer.id,
            assetId,
            serialNumber: cleanSn,
            macAddress: input.macAddress || null,
            vendor: detected.vendor,
            model: detected.model,
            action: 'INSTALLED',
            reason: `Sinkronisasi 1-Pintu OLT ${input.oltName || ''}`,
            installedAt: input.installedAt || new Date(),
          },
        }).catch(() => {});
      }
    }
  }

  return {
    assetId,
    serialNumber: cleanSn,
    vendor: detected.vendor,
    model: detected.model,
    status: targetStatus,
    isNew,
    customerId: input.customerId || null,
  };
}

/**
 * Preview full sync of all OLT ONUs to inventory
 */
export async function previewOltInventorySync() {
  const [onus, existingAssets] = await Promise.all([
    prisma.oltOnuStatus.findMany({
      include: {
        olt: { select: { id: true, name: true, vendor: true } },
        customer: { select: { id: true, username: true, name: true, status: true } },
      },
    }),
    prisma.inventoryAsset.findMany({
      where: { assetType: 'MODEM' },
      select: { id: true, serialNumber: true, vendor: true, model: true, status: true, currentCustomerId: true },
    }),
  ]);

  const existingMap = new Map<string, typeof existingAssets[0]>();
  for (const a of existingAssets) {
    if (a.serialNumber) existingMap.set(a.serialNumber.toUpperCase().trim(), a);
  }

  let alreadyInInventory = 0;
  let newToImport = 0;
  let assignedToCustomer = 0;
  const vendorBreakdown: Record<string, number> = {};

  const items = onus.map((onu) => {
    const cleanSn = normalizeSerialNumber(onu.serialNumber);
    const detected = detectOntVendorAndModel(cleanSn, null, onu.olt?.vendor);
    const existing = cleanSn ? existingMap.get(cleanSn) : null;

    if (existing) {
      alreadyInInventory++;
    } else if (cleanSn) {
      newToImport++;
    }

    if (onu.customer) {
      assignedToCustomer++;
    }

    const v = detected.vendor || 'Lainnya';
    vendorBreakdown[v] = (vendorBreakdown[v] || 0) + 1;

    return {
      onuId: onu.id,
      serialNumber: cleanSn || onu.macAddress || 'N/A',
      macAddress: onu.macAddress,
      oltName: onu.olt?.name || 'OLT',
      oltVendor: onu.olt?.vendor,
      location: `${onu.port}:${onu.onuId}`,
      status: onu.status,
      detectedVendor: detected.vendor,
      detectedModel: detected.model,
      alreadyInInventory: !!existing,
      currentCustomer: onu.customer
        ? {
            id: onu.customer.id,
            username: onu.customer.username,
            name: onu.customer.name,
            status: onu.customer.status,
          }
        : null,
    };
  });

  return {
    totalOnus: onus.length,
    alreadyInInventory,
    newToImport,
    assignedToCustomer,
    vendorBreakdown,
    items,
  };
}

/**
 * Execute full sync of all OLT ONUs into inventory
 */
export async function syncAllOltsToInventory(): Promise<{
  totalProcessed: number;
  createdCount: number;
  updatedCount: number;
  linkedCustomerCount: number;
}> {
  const onus = await prisma.oltOnuStatus.findMany({
    include: {
      olt: { select: { id: true, name: true, vendor: true } },
    },
  });

  let createdCount = 0;
  let updatedCount = 0;
  let linkedCustomerCount = 0;

  for (const onu of onus) {
    if (!onu.serialNumber && !onu.macAddress) continue;

    const res = await syncOnuToInventory({
      serialNumber: onu.serialNumber || onu.macAddress!,
      macAddress: onu.macAddress,
      customerId: onu.customerId,
      oltVendor: onu.olt?.vendor,
      oltName: onu.olt?.name,
      installedAt: onu.updatedAt,
    });

    if (res) {
      if (res.isNew) createdCount++;
      else updatedCount++;
      if (res.customerId) linkedCustomerCount++;
    }
  }

  return {
    totalProcessed: onus.length,
    createdCount,
    updatedCount,
    linkedCustomerCount,
  };
}
