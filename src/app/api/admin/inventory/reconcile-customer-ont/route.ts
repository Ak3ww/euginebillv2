import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { requirePermission } from '@/server/middleware/api-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/inventory/reconcile-customer-ont
 * Run diagnostic audit on ONT <> Customer assignments
 */
export async function GET(req: NextRequest) {
  try {
    const authCheck = await requirePermission('inventory.view');
    if (!authCheck.authorized) return authCheck.response;

    // 1. All modem assets
    const allModems = await prisma.inventoryAsset.findMany({
      where: { assetType: 'MODEM' },
      include: {
        customer: {
          select: { id: true, username: true, name: true, status: true, macAddress: true },
        },
      },
    });

    // 2. All customers with macAddress
    const customersWithMac = await prisma.pppoeUser.findMany({
      where: {
        status: { notIn: ['stop', 'deleted'] },
        macAddress: { not: null },
      },
      select: {
        id: true,
        username: true,
        name: true,
        status: true,
        macAddress: true,
        inventoryAssets: {
          select: { id: true, serialNumber: true, macAddress: true, status: true },
        },
      },
    });

    // 3. Completed SPK installation records with SN/MAC
    const completedSpks = await prisma.workOrder.findMany({
      where: {
        status: 'COMPLETED',
        linkedUserId: { not: null },
      },
      select: {
        id: true,
        issueType: true,
        linkedUserId: true,
        customer: { select: { username: true, name: true } },
        reportData: true,
        completedAt: true,
      },
      orderBy: { completedAt: 'desc' },
    });

    // Analyze discrepancies
    const customersWithoutModemAsset = customersWithMac.filter(
      (c) => !c.inventoryAssets || c.inventoryAssets.length === 0
    );

    const orphanedInUseModems = allModems.filter(
      (m) => m.status === 'IN_USE' && (!m.currentCustomerId || !m.customer)
    );

    const spkUnlinkedCandidates: any[] = [];
    for (const spk of completedSpks) {
      const rep = spk.reportData as any;
      if (rep && (rep.sn || rep.mac)) {
        const targetUserId = spk.linkedUserId!;
        const hasLinkedAsset = allModems.some(
          (m) => m.currentCustomerId === targetUserId && (m.serialNumber === rep.sn || (rep.mac && m.macAddress === rep.mac))
        );
        if (!hasLinkedAsset) {
          spkUnlinkedCandidates.push({
            spkId: spk.id,
            customer: spk.customer,
            customerId: targetUserId,
            sn: rep.sn || null,
            mac: rep.mac || null,
            model: rep.model || rep.ontType || null,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        totalModemsInInventory: allModems.length,
        modemsInUse: allModems.filter((m) => m.status === 'IN_USE').length,
        modemsAvailable: allModems.filter((m) => m.status === 'AVAILABLE').length,
        modemsDefective: allModems.filter((m) => m.status === 'DEFECTIVE').length,
        totalCustomersWithMac: customersWithMac.length,
        customersWithoutModemAssetCount: customersWithoutModemAsset.length,
        orphanedInUseModemsCount: orphanedInUseModems.length,
        spkUnlinkedCount: spkUnlinkedCandidates.length,
      },
      discrepancies: {
        customersWithoutModemAsset: customersWithoutModemAsset.map((c) => ({
          id: c.id,
          username: c.username,
          name: c.name,
          macAddress: c.macAddress,
        })),
        orphanedInUseModems: orphanedInUseModems.map((m) => ({
          id: m.id,
          serialNumber: m.serialNumber,
          macAddress: m.macAddress,
          vendor: m.vendor,
          model: m.model,
          currentCustomerId: m.currentCustomerId,
        })),
        spkUnlinkedCandidates: spkUnlinkedCandidates.slice(0, 50),
      },
    });
  } catch (error: any) {
    console.error('Error running ONT reconciliation audit:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/inventory/reconcile-customer-ont
 * Apply reconciliation or bulk-reseed mappings
 */
export async function POST(req: NextRequest) {
  try {
    const authCheck = await requirePermission('inventory.manage');
    if (!authCheck.authorized) return authCheck.response;

    const body = await req.json();
    const { action, mappings } = body; // action: 'auto-reconcile' | 'bulk-reseed'

    // Ensure generic ONT catalog item exists
    let genericOntItem = await prisma.inventoryItem.findFirst({
      where: {
        OR: [
          { sku: 'EMG-CPE-ONT-GENERIC' },
          { categoryCode: 'CPE', subCategory: 'ONT' },
        ],
      },
    });

    if (!genericOntItem) {
      genericOntItem = await prisma.inventoryItem.create({
        data: {
          sku: 'EMG-CPE-ONT-GENERIC',
          name: 'Modem ONT Pelanggan (Generic)',
          categoryCode: 'CPE',
          subCategory: 'ONT',
          unit: 'pcs',
          isSerialized: true,
          currentStock: 0,
          isActive: true,
        },
      });
    }

    if (action === 'auto-reconcile') {
      let linkedCount = 0;
      let createdCount = 0;
      let healedOrphansCount = 0;

      // 1. Heal orphaned IN_USE modems (set to AVAILABLE if customer is deleted)
      const orphanedModems = await prisma.inventoryAsset.findMany({
        where: {
          assetType: 'MODEM',
          status: 'IN_USE',
          currentCustomerId: { not: null },
        },
        include: { customer: { select: { id: true, status: true } } },
      });

      for (const m of orphanedModems) {
        if (!m.customer || m.customer.status === 'deleted') {
          await prisma.inventoryAsset.update({
            where: { id: m.id },
            data: {
              status: 'AVAILABLE',
              currentCustomerId: null,
              notes: `${m.notes ? m.notes + ' • ' : ''}Auto-healed: Customer sebelumnya sudah tidak aktif/dihapus`,
            },
          });
          healedOrphansCount++;
        }
      }

      // 2. Scan completed SPKs and relink/create assets
      const completedSpks = await prisma.workOrder.findMany({
        where: {
          status: 'COMPLETED',
          linkedUserId: { not: null },
        },
        select: {
          id: true,
          linkedUserId: true,
          customer: { select: { id: true, username: true, macAddress: true } },
          reportData: true,
          completedAt: true,
        },
        orderBy: { completedAt: 'desc' },
      });

      for (const spk of completedSpks) {
        const rep = spk.reportData as any;
        if (!rep || (!rep.sn && !rep.mac)) continue;

        const targetUser = spk.customer;
        if (!targetUser) continue;

        const sn = rep.sn ? String(rep.sn).trim().toUpperCase() : null;
        const mac = rep.mac ? String(rep.mac).trim().toUpperCase() : targetUser.macAddress;

        if (sn) {
          const existingAsset = await prisma.inventoryAsset.findUnique({
            where: { serialNumber: sn },
          });

          if (existingAsset) {
            if (existingAsset.currentCustomerId !== targetUser.id || existingAsset.status !== 'IN_USE') {
              await prisma.inventoryAsset.update({
                where: { id: existingAsset.id },
                data: {
                  status: 'IN_USE',
                  currentCustomerId: targetUser.id,
                  macAddress: mac || existingAsset.macAddress,
                  installedAt: existingAsset.installedAt || spk.completedAt || new Date(),
                },
              });
              linkedCount++;
            }
          } else {
            // Create asset
            await prisma.inventoryAsset.create({
              data: {
                itemId: genericOntItem.id,
                assetType: 'MODEM',
                serialNumber: sn,
                macAddress: mac || null,
                vendor: rep.vendor || (sn.startsWith('ZTE') ? 'ZTE' : sn.startsWith('HW') ? 'Huawei' : 'Generic'),
                model: rep.model || rep.ontType || 'Generic ONT',
                condition: 'NEW',
                status: 'IN_USE',
                currentCustomerId: targetUser.id,
                installedAt: spk.completedAt || new Date(),
                notes: `Auto-reconciled dari SPK #${spk.id} pelanggan ${targetUser.username}`,
              },
            });
            createdCount++;
          }

          // Ensure customer macAddress is updated
          if (mac && targetUser.macAddress !== mac) {
            await prisma.pppoeUser.update({
              where: { id: targetUser.id },
              data: { macAddress: mac },
            });
          }
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Auto-rekonsiliasi ONT selesai dieksekusi',
        results: {
          linkedCount,
          createdCount,
          healedOrphansCount,
        },
      });
    }

    if (action === 'bulk-reseed' && Array.isArray(mappings)) {
      let reseededCount = 0;
      let errors: string[] = [];

      for (const item of mappings) {
        const username = item.username ? String(item.username).trim() : '';
        const sn = item.sn ? String(item.sn).trim().toUpperCase() : '';
        const mac = item.mac ? String(item.mac).trim().toUpperCase() : null;
        const model = item.model ? String(item.model).trim() : 'Generic ONT';
        const vendor = item.vendor ? String(item.vendor).trim() : (sn.startsWith('ZTE') ? 'ZTE' : 'Generic');

        if (!username || !sn) {
          errors.push(`Mapping dilewati (username atau SN kosong): ${JSON.stringify(item)}`);
          continue;
        }

        const user = await prisma.pppoeUser.findFirst({
          where: {
            OR: [
              { username: username },
              { name: username },
            ],
          },
        });

        if (!user) {
          errors.push(`Pelanggan "${username}" tidak ditemukan`);
          continue;
        }

        // Upsert asset
        await prisma.inventoryAsset.upsert({
          where: { serialNumber: sn },
          create: {
            itemId: genericOntItem.id,
            assetType: 'MODEM',
            serialNumber: sn,
            macAddress: mac || user.macAddress || null,
            vendor,
            model,
            condition: 'NEW',
            status: 'IN_USE',
            currentCustomerId: user.id,
            installedAt: new Date(),
            notes: `Bulk-reseeded untuk pelanggan ${user.username} (${user.name})`,
          },
          update: {
            status: 'IN_USE',
            currentCustomerId: user.id,
            ...(mac ? { macAddress: mac } : {}),
            notes: `Bulk-reseeded untuk pelanggan ${user.username} (${user.name})`,
          },
        });

        if (mac) {
          await prisma.pppoeUser.update({
            where: { id: user.id },
            data: { macAddress: mac },
          });
        }

        reseededCount++;
      }

      return NextResponse.json({
        success: true,
        message: `Bulk reseed berhasil memetakan ${reseededCount} unit ONT ke pelanggan`,
        reseededCount,
        errors,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Aksi tidak dikenali. Gunakan action: "auto-reconcile" atau "bulk-reseed".' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Error executing ONT reconciliation:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
