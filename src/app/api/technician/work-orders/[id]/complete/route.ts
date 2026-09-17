import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { nanoid } from 'nanoid';
import { prisma } from '@/server/db/client';
import { TECH_JWT_SECRET } from '@/server/auth/technician-secret';
import { sendInstallationInvoice, sendInvoiceReminder, sendPSBReportToGroup } from '@/server/services/notifications/whatsapp-templates.service';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Verify token or NextAuth session
    let authenticated = false;
    const session = await getServerSession(authOptions);
    if (session?.user) {
      authenticated = true;
    } else {
      const token = req.cookies.get('technician-token')?.value;
      if (token) {
        const { payload } = await jwtVerify(token, TECH_JWT_SECRET);
        if (payload.id) authenticated = true;
      }
    }

    if (!authenticated) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await req.json();
    const { isPrepared, equipmentChecklist, reportData, reportPhotos, customerLat, customerLng } = body;

    // Fetch existing work order with customer profile and area
    const wo = await prisma.workOrder.findUnique({
      where: { id },
      include: {
        customer: {
          include: {
            profile: true,
            area: true,
          }
        }
      }
    });

    if (!wo) return NextResponse.json({ error: 'Work order not found' }, { status: 404 });

    // 1. Robust customer resolution: resolve targetUserId if missing on the work order
    let targetUserId = wo.linkedUserId;
    let targetCustomer = wo.customer;

    if (!targetUserId && (wo.customerPhone || wo.customerName)) {
      const cleanPhone = (wo.customerPhone || '').replace(/\D/g, '');
      const phoneVariations = cleanPhone ? [
        cleanPhone,
        '0' + cleanPhone.replace(/^62/, ''),
        '62' + cleanPhone.replace(/^0/, ''),
      ] : [];

      const matchedUser = await prisma.pppoeUser.findFirst({
        where: {
          OR: [
            ...(phoneVariations.length > 0 ? [{ phone: { in: phoneVariations } }] : []),
            { name: { equals: wo.customerName.trim() } },
          ],
        },
        include: {
          profile: true,
          area: true,
        },
      });

      if (matchedUser) {
        targetUserId = matchedUser.id;
        targetCustomer = matchedUser as any;
        // Auto-link workOrder to this customer in DB
        await prisma.workOrder.update({
          where: { id: wo.id },
          data: { linkedUserId: targetUserId },
        }).catch(() => {});
      }
    }

    // If customer coordinates provided and targetUserId exists, update customer location
    if (targetUserId && customerLat && customerLng) {
      try {
        await prisma.pppoeUser.update({
          where: { id: targetUserId },
          data: {
            latitude: parseFloat(String(customerLat)),
            longitude: parseFloat(String(customerLng)),
          },
        });
      } catch (geoErr) {
        console.error('Failed to update customer GPS location:', geoErr);
      }
    }

    // Auto-Seed ODP to Network DB & Create ODP Customer Assignment
    if (reportData?.odpName && String(reportData.odpName).trim()) {
      try {
        const odpNameTrimmed = String(reportData.odpName).trim();
        const odpPortNum = parseInt(String(reportData.port || reportData.portNumber || '1').replace(/\D/g, '')) || 1;
        const odpLatNum = parseFloat(String(reportData.odpLat || customerLat || '0'));
        const odpLngNum = parseFloat(String(reportData.odpLng || customerLng || '0'));

        // Find existing ODP by case-insensitive name
        let targetOdp = await prisma.networkODP.findFirst({
          where: {
            name: { equals: odpNameTrimmed }
          }
        });

        // If not found, create new ODP automatically
        if (!targetOdp) {
          targetOdp = await prisma.networkODP.create({
            data: {
              id: nanoid(),
              name: odpNameTrimmed,
              latitude: odpLatNum,
              longitude: odpLngNum,
              portCount: 16,
              status: 'active',
            }
          });
        }

        // If found, update ODP location if lat/lng are provided
        if (targetOdp && (odpLatNum !== 0 || odpLngNum !== 0)) {
          await prisma.networkODP.update({
            where: { id: targetOdp.id },
            data: {
              latitude: odpLatNum,
              longitude: odpLngNum,
            }
          }).catch(e => console.error('Failed to update ODP coordinates:', e));
        }

        // Link customer to ODP assignment if targetUserId exists
        if (targetUserId && targetOdp) {
          await prisma.odpCustomerAssignment.upsert({
            where: { customerId: targetUserId },
            create: {
              id: nanoid(),
              customerId: targetUserId,
              odpId: targetOdp.id,
              portNumber: odpPortNum,
            },
            update: {
              odpId: targetOdp.id,
              portNumber: odpPortNum,
            }
          });
        }
      } catch (odpSeedErr) {
        console.error('Failed to auto-seed ODP / customer assignment:', odpSeedErr);
      }
    }

    // Update Work Order to COMPLETED and attach JSON reports
    const updated = await prisma.workOrder.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        isPrepared: isPrepared || false,
        equipmentChecklist: equipmentChecklist || {},
        reportData: reportData || {},
        reportPhotos: reportPhotos || {},
      }
    });

    // Dismantle Logic
    const isDismantle = wo.issueType?.toUpperCase().includes('DISMANTLE') || wo.issueType?.toUpperCase().includes('CABUT');
    if (isDismantle && targetUserId) {
      try {
        await prisma.pppoeUser.update({
          where: { id: targetUserId },
          data: {
            isDismantled: true,
            dismantledAt: new Date(),
            dismantledNote: body.notes || body.reportData?.notes || 'Perangkat berhasil dicabut oleh teknisi',
          },
        });
        // Free ODP port and return modem to warehouse stock
        await prisma.odpCustomerAssignment.deleteMany({
          where: { customerId: targetUserId },
        }).catch(() => {});

        // 1-Pintu: Return modem to warehouse stock as USED_GOOD, unassign OLT ONU, log DISMANTLED
        const { dismantleCustomerDevice } = await import('@/server/services/olt-inventory-sync.service');
        await dismantleCustomerDevice(
          targetUserId,
          body.notes || body.reportData?.notes || 'Perangkat dicabut oleh teknisi via SPK',
          session?.user?.name || body.technicianName || 'Teknisi'
        ).catch((e) => console.error('[WO Complete Dismantle Device Error]', e));
      } catch (dismantleErr) {
        console.error('Failed to update dismantle status:', dismantleErr);
      }
    }

    // Installation / Active User Auto-Activation
    if (!isDismantle && targetUserId) {
      try {
        await prisma.pppoeUser.update({
          where: { id: targetUserId },
          data: {
            status: 'ACTIVE',
          },
        });

        // Also update registrationRequest if linked
        await prisma.registrationRequest.updateMany({
          where: { pppoeUserId: targetUserId, status: { in: ['PENDING', 'APPROVED'] } },
          data: { status: 'INSTALLED' },
        }).catch(() => {});

        // Sync enabled secret to MikroTik so customer can immediately connect
        const { PPPSecretService } = await import('@/server/services/mikrotik/ppp-secret.service');
        await PPPSecretService.syncSecret(targetUserId).catch((syncErr: any) => {
          console.error('[WorkOrder Complete] Failed to sync secret to MikroTik:', syncErr);
        });

        // ── Auto-Link & Register Modem ONT to Inventory Asset & Device History ──
        try {
          const rawSn = reportData?.sn ? String(reportData.sn).trim() : '';
          const rawMac = reportData?.mac ? String(reportData.mac).trim() : '';

          // Update user MAC Address if provided
          if (rawMac) {
            await prisma.pppoeUser.update({
              where: { id: targetUserId },
              data: { macAddress: rawMac },
            }).catch(() => {});
          }

          if (rawSn) {
            const upperSn = rawSn.toUpperCase();
            const existingAsset = await prisma.inventoryAsset.findFirst({
              where: {
                OR: [
                  { serialNumber: upperSn },
                  { serialNumber: rawSn },
                  ...(rawMac ? [{ macAddress: rawMac.toUpperCase() }] : []),
                ],
              },
            });

            const techName = (session?.user as any)?.name || 'Teknisi Lapangan';

            if (existingAsset) {
              await prisma.inventoryAsset.update({
                where: { id: existingAsset.id },
                data: {
                  status: 'IN_USE',
                  currentCustomerId: targetUserId,
                  macAddress: rawMac ? rawMac.toUpperCase() : existingAsset.macAddress,
                  installedAt: new Date(),
                },
              });

              await prisma.customerDeviceHistory.create({
                data: {
                  customerId: targetUserId,
                  assetId: existingAsset.id,
                  serialNumber: existingAsset.serialNumber,
                  vendor: existingAsset.vendor,
                  model: existingAsset.model,
                  macAddress: rawMac ? rawMac.toUpperCase() : existingAsset.macAddress,
                  action: 'INSTALLED',
                  reason: `Pemasangan via SPK #${wo.id}`,
                  workOrderId: wo.id,
                  installedAt: new Date(),
                  technicianName: techName,
                },
              }).catch(() => {});
              console.log(`[WorkOrder Complete] Linked existing asset ${existingAsset.serialNumber} to user ${targetUserId}`);
            } else {
              // Auto-create catalog item & new inventory asset
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
                      description: 'Katalog default auto-generated untuk modem ONT pelanggan',
                      categoryCode: 'CPE',
                      subCategory: 'ONT',
                      unit: 'pcs',
                      minimumStock: 5,
                      isSerialized: true,
                    },
                  });
                } catch {
                  catalogItem = await prisma.inventoryItem.findFirst();
                }
              }

              let vendor = 'Generic';
              let model = reportData?.modemType ? String(reportData.modemType).trim() : 'GPON ONT';
              if (upperSn.startsWith('ZTEG')) { vendor = 'ZTE'; if (!reportData?.modemType) model = 'ZTE F609 V3'; }
              else if (upperSn.startsWith('SKYW')) { vendor = 'Skyworth'; if (!reportData?.modemType) model = 'GN542VF'; }
              else if (upperSn.startsWith('RTEG')) { vendor = 'Realtek'; if (!reportData?.modemType) model = 'RTL8672 GPON'; }
              else if (upperSn.startsWith('YHTC')) { vendor = 'Yuhua'; if (!reportData?.modemType) model = 'YH-100G'; }
              else if (upperSn.startsWith('FHTT')) { vendor = 'FiberHome'; if (!reportData?.modemType) model = 'HG6243C'; }
              else if (upperSn.startsWith('HWTC')) { vendor = 'Huawei'; if (!reportData?.modemType) model = 'HG8245H'; }
              else if (upperSn.startsWith('AZVG')) { vendor = 'VSOL'; if (!reportData?.modemType) model = 'V2801 Series'; }

              if (catalogItem) {
                const newAsset = await prisma.inventoryAsset.create({
                  data: {
                    itemId: catalogItem.id,
                    assetType: 'MODEM',
                    serialNumber: upperSn,
                    macAddress: rawMac ? rawMac.toUpperCase() : null,
                    vendor,
                    model,
                    condition: 'NEW',
                    status: 'IN_USE',
                    currentCustomerId: targetUserId,
                    installedAt: new Date(),
                    notes: `Auto-registered via SPK #${wo.id} (${wo.issueType})`,
                  },
                });

                await prisma.customerDeviceHistory.create({
                  data: {
                    customerId: targetUserId,
                    assetId: newAsset.id,
                    serialNumber: upperSn,
                    vendor,
                    model,
                    macAddress: rawMac ? rawMac.toUpperCase() : null,
                    action: 'INSTALLED',
                    reason: `Pemasangan via SPK #${wo.id}`,
                    workOrderId: wo.id,
                    installedAt: new Date(),
                    technicianName: techName,
                  },
                }).catch(() => {});
                console.log(`[WorkOrder Complete] Auto-created new asset ${upperSn} for user ${targetUserId}`);
              }
            }
          }
        } catch (deviceSyncErr) {
          console.error('[WorkOrder Complete] Failed to auto-link modem to inventoryAsset:', deviceSyncErr);
        }

        console.log(`[WorkOrder Complete] Successfully activated pppoeUser ${targetUserId} to ACTIVE`);
      } catch (userActivateErr) {
        console.error('[WorkOrder Complete] Failed to activate pppoeUser:', userActivateErr);
      }
    }

    // Auto-Billing Trigger & Admin Alert
    let invoice = null;
    if (targetUserId) {
      invoice = await prisma.invoice.findFirst({
        where: {
          userId: targetUserId,
          status: { in: ['PENDING', 'OVERDUE'] },
        },
        include: {
          user: {
            include: {
              profile: true,
              area: true,
            }
          }
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    }

    if (!invoice && (wo.customerPhone || wo.customerName)) {
      const cleanPhone = (wo.customerPhone || '').replace(/\D/g, '');
      const phoneVariations = cleanPhone ? [
        cleanPhone,
        '0' + cleanPhone.replace(/^62/, ''),
        '62' + cleanPhone.replace(/^0/, ''),
      ] : [];

      invoice = await prisma.invoice.findFirst({
        where: {
          OR: [
            ...(phoneVariations.length > 0 ? [{ customerPhone: { in: phoneVariations } }] : []),
            ...(phoneVariations.length > 0 ? [{ user: { phone: { in: phoneVariations } } }] : []),
            { customerName: { equals: wo.customerName.trim() } },
          ],
          status: { in: ['PENDING', 'OVERDUE'] },
        },
        include: {
          user: {
            include: {
              profile: true,
              area: true,
            }
          }
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      // Link invoice to targetUserId if found without userId
      if (invoice && !invoice.userId && targetUserId) {
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: { userId: targetUserId },
        }).catch(() => {});
      }
    }

    const company = await prisma.company.findFirst();
    const appBaseUrl = company?.baseUrl || process.env.NEXT_PUBLIC_APP_URL || '';
    const isInstallType = wo.issueType?.toUpperCase().includes('INSTAL') || wo.issueType?.toUpperCase() === 'INSTALLATION';

    // Auto-create missing installation invoice if customer has no invoice yet upon SPK completion
    if (!invoice && isInstallType && targetCustomer && targetCustomer.profile) {
      try {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth();
        const currentDay = today.getDate();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        let invoiceAmount = Number(targetCustomer.profile.price);
        if (company?.enableProrate && targetCustomer.subscriptionType !== 'PREPAID') {
          if (currentDay > 5) {
            const remainingDays = Math.max(1, daysInMonth - currentDay + 1);
            const rawProrate = (targetCustomer.profile as any).proratePricePerDay;
            const proratePrice = rawProrate ? Number(rawProrate) : Math.ceil(invoiceAmount / daysInMonth);
            const pricePerDay = proratePrice > 0 ? proratePrice : Math.ceil(invoiceAmount / daysInMonth);
            invoiceAmount = Math.min(invoiceAmount, Math.max(pricePerDay, remainingDays * pricePerDay));
          }
        }

        let finalAmount = Math.round(invoiceAmount);
        let taxRate: number | null = null;
        if (targetCustomer.profile.ppnActive && targetCustomer.profile.ppnRate) {
          taxRate = Number(targetCustomer.profile.ppnRate);
          if (taxRate > 0) {
            finalAmount = Math.round(invoiceAmount + (invoiceAmount * taxRate / 100));
          }
        }

        const { generateInvoiceNumber } = await import('@/server/services/billing/invoice.service');
        const invoiceNumber = generateInvoiceNumber();
        const { randomBytes } = await import('crypto');
        const paymentToken = randomBytes(32).toString('hex');
        const paymentLink = `${appBaseUrl}/pay/${paymentToken}`;

        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 2);
        dueDate.setHours(23, 59, 59, 999);

        invoice = await prisma.invoice.create({
          data: {
            id: crypto.randomUUID(),
            invoiceNumber,
            userId: targetCustomer.id,
            amount: finalAmount,
            baseAmount: Math.round(invoiceAmount),
            ...(taxRate !== null && taxRate > 0 ? { taxRate } : {}),
            dueDate,
            status: 'PENDING',
            invoiceType: 'INSTALLATION',
            customerName: targetCustomer.name,
            customerPhone: targetCustomer.phone,
            customerUsername: targetCustomer.username,
            paymentToken,
            paymentLink,
          },
          include: {
            user: {
              include: {
                profile: true,
                area: true,
              },
            },
          },
        });
        console.log(`[WorkOrder Complete] Auto-created missing installation invoice ${invoiceNumber} for ${targetCustomer.username}`);
      } catch (autoInvErr) {
        console.error('[WorkOrder Complete] Failed to auto-create installation invoice:', autoInvErr);
      }
    }

    if (invoice) {
      // Auto-generate paymentLink and paymentToken if missing
      let paymentLink = invoice.paymentLink || '';
      let paymentToken = invoice.paymentToken || '';
      if (!paymentLink || !paymentToken) {
        const { randomBytes } = await import('crypto');
        paymentToken = paymentToken || randomBytes(32).toString('hex');
        paymentLink = `${appBaseUrl}/pay/${paymentToken}`;
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: { paymentLink, paymentToken },
        }).catch(() => {});
      }

      const targetPhone = targetCustomer?.phone || wo.customerPhone || invoice.customerPhone || invoice.user?.phone;
      const targetCustomerName = targetCustomer?.name || wo.customerName || invoice.customerName || invoice.user?.name || 'Pelanggan';
      const targetCustomerId = targetCustomer?.customerId || invoice.user?.customerId || undefined;
      const targetUsername = targetCustomer?.username || invoice.customerUsername || invoice.user?.username || undefined;
      const profileName = targetCustomer?.profile?.name || invoice.user?.profile?.name || '-';
      const areaName = targetCustomer?.area?.name || invoice.user?.area?.name || '-';

      // Only send if not already notified to prevent duplicate invoices
      if (targetPhone && (!invoice.waNotifiedAt || (invoice.waRetryCount || 0) === 0)) {
        try {
          const isInstallType = wo.issueType?.toUpperCase().includes('INSTAL') || wo.issueType?.toUpperCase() === 'INSTALLATION';
          if (isInstallType) {
            await sendInstallationInvoice({
              customerName: targetCustomerName,
              customerPhone: targetPhone,
              customerId: targetCustomerId,
              username: targetUsername,
              invoiceNumber: invoice.invoiceNumber,
              amount: invoice.amount,
              dueDate: invoice.dueDate,
              paymentLink,
              profileName,
            });
          } else {
            await sendInvoiceReminder({
              phone: targetPhone,
              customerName: targetCustomerName,
              customerId: targetCustomerId,
              customerUsername: targetUsername,
              profileName,
              area: areaName,
              invoiceNumber: invoice.invoiceNumber,
              amount: invoice.amount,
              dueDate: invoice.dueDate,
              paymentLink,
              companyName: company?.name || 'ISP',
              companyPhone: company?.phone || '',
            });
          }

          await prisma.invoice.update({
            where: { id: invoice.id },
            data: {
              waNotifiedAt: new Date(),
              waRetryCount: { increment: 1 },
            },
          }).catch(() => {});

          console.log(`[WorkOrder Complete] WA Tagihan berhasil dikirim otomatis ke ${targetPhone} untuk Invoice ${invoice.invoiceNumber}`);
        } catch (e) {
          console.error('[WorkOrder Complete] Gagal mengirim WA Tagihan otomatis:', e);
        }
      }
    } else {
      // Send alert to Admin that Installation is complete but Invoice is NOT created yet!
      try {
        const { NotificationService } = await import('@/server/services/notifications/dispatcher.service');
        await NotificationService.notifyAdminInstallationCompleteNoInvoice({
          workOrderId: wo.id,
          customerName: wo.customerName,
          customerPhone: wo.customerPhone,
          customerId: targetCustomer?.customerId || targetCustomer?.username || wo.customerPhone,
        });
      } catch (notifErr) {
        console.error('[WorkOrder Complete] Failed to send admin installation completed alert:', notifErr);
      }
    }

    // PSB WA Group Report — send after successful completion if issueType is INSTALLATION
    if (wo.issueType?.toUpperCase().includes('INSTAL') || wo.issueType?.toUpperCase() === 'INSTALLATION') {
      try {
        const company = await prisma.company.findFirst({
          select: { psbWaGroupId: true, baseUrl: true, name: true },
        });

        if (company?.psbWaGroupId) {
          // Get technician name from token/session
          let technicianName = 'Teknisi';
          try {
            const token = req.cookies.get('technician-token')?.value;
            if (token) {
              const { payload } = await jwtVerify(token, TECH_JWT_SECRET);
              if (payload.name) technicianName = payload.name as string;
              else if (payload.username) technicianName = payload.username as string;
            }
          } catch { }

          const appBaseUrl = company.baseUrl || process.env.NEXT_PUBLIC_APP_URL || '';

          // Fire and forget — don't block the response
          sendPSBReportToGroup({
            groupId: company.psbWaGroupId,
            reportData: {
              ...((body.reportData as any) || {}),
              customerLat: body.customerLat,
              customerLng: body.customerLng,
            },
            reportPhotos: body.reportPhotos || {},
            customerName: wo.customerName,
            customerPhone: wo.customerPhone,
            customerAddress: wo.customerAddress,
            technicianName,
            appBaseUrl,
          }).catch(e => console.error('[PSB WA Report] Failed:', e));
        }
      } catch (reportErr) {
        console.error('[PSB WA Report] Setup error:', reportErr);
      }
    }

    // Auto-Deduct Cable Roll if selected
    const selectedRollId = reportData?.selectedRollId;
    const dwRoll = reportData?.dwRoll;
    if (selectedRollId && dwRoll && parseFloat(String(dwRoll)) > 0) {
      try {
        const cableAsset = await prisma.inventoryAsset.findUnique({
          where: { id: selectedRollId },
          include: { item: true },
        });

        if (cableAsset && cableAsset.assetType === 'CABLE_ROLL') {
          const material = await prisma.workOrderMaterial.create({
            data: {
              workOrderId: updated.id,
              itemId: cableAsset.itemId,
              assetId: selectedRollId,
              quantityRequested: parseFloat(String(dwRoll)),
              quantityUsed: parseFloat(String(dwRoll)),
              unit: 'meter',
              isDeducted: false,
            },
          });

          const { deductWorkOrderMaterial } = await import('@/server/services/inventory-deduct.service');
          await deductWorkOrderMaterial(material.id);
          console.log(`[WorkOrder Complete] Cable roll ${selectedRollId} deducted: ${dwRoll}m`);
        }
      } catch (deductErr) {
        console.error('[WorkOrder Complete] Cable deduct warning (non-fatal):', deductErr);
      }
    }

    // Auto-Deduct Kit Standar (consumable generic) berdasarkan issueType
    try {
      const issueTypeUpper = (wo.issueType || '').toUpperCase();
      const kit = await prisma.workOrderTypeKit.findFirst({
        where: {
          OR: [
            { issueType: issueTypeUpper },
            ...(issueTypeUpper.includes('INSTAL') ? [{ issueType: 'INSTALLATION' }] : []),
          ],
          isActive: true,
        },
        include: { items: true },
      });

      if (kit?.isActive && kit.items?.length > 0) {
        const { deductWorkOrderMaterial } = await import('@/server/services/inventory-deduct.service');
        for (const kitItem of kit.items) {
          try {
            const material = await prisma.workOrderMaterial.create({
              data: {
                workOrderId: updated.id,
                itemId: kitItem.itemId,
                quantityRequested: kitItem.defaultQty,
                quantityUsed: kitItem.defaultQty,
                unit: 'pcs',
                isDeducted: false,
              },
            });
            await deductWorkOrderMaterial(material.id);
          } catch (kitItemErr) {
            console.warn(`[WorkOrder Complete] Kit item ${kitItem.itemId} deduct warning (non-fatal):`, kitItemErr);
          }
        }
        console.log(`[WorkOrder Complete] Kit standar "${kit.name}" (${kit.items.length} items) processed for WO #${updated.id}`);
      }
    } catch (kitErr) {
      console.error('[WorkOrder Complete] Kit deduct warning (non-fatal):', kitErr);
    }

    return NextResponse.json({ success: true, workOrder: updated });
  } catch (error: any) {
    console.error('Work order completion error:', error);
    return NextResponse.json({ error: error.message || 'Failed to complete work order' }, { status: 500 });
  }
}
