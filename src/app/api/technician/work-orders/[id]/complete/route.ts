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
        // Free ODP port
        await prisma.odpCustomerAssignment.deleteMany({
          where: { customerId: targetUserId },
        }).catch(() => {});
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
    const appBaseUrl = company?.baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://euginemediagroup.com';

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

          const appBaseUrl = company.baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://euginemediagroup.com';

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

    return NextResponse.json({ success: true, workOrder: updated });
  } catch (error: any) {
    console.error('Work order completion error:', error);
    return NextResponse.json({ error: error.message || 'Failed to complete work order' }, { status: 500 });
  }
}
