import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { nanoid } from 'nanoid';
import { prisma } from '@/server/db/client';
import { TECH_JWT_SECRET } from '@/server/auth/technician-secret';
import { sendInvoiceReminder, sendPSBReportToGroup } from '@/server/services/notifications/whatsapp-templates.service';

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

    // Fetch existing work order
    const wo = await prisma.workOrder.findUnique({
      where: { id },
      include: { customer: true }
    });

    if (!wo) return NextResponse.json({ error: 'Work order not found' }, { status: 404 });

    // If customer coordinates provided and linkedUserId exists, update customer location
    if (wo.linkedUserId && customerLat && customerLng) {
      try {
        await prisma.pppoeUser.update({
          where: { id: wo.linkedUserId },
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
        const odpPortNum = parseInt(String(reportData.port || '1').replace(/\D/g, '')) || 1;
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

        // Link customer to ODP assignment if linkedUserId exists
        if (wo.linkedUserId && targetOdp) {
          await prisma.odpCustomerAssignment.upsert({
            where: { customerId: wo.linkedUserId },
            create: {
              id: nanoid(),
              customerId: wo.linkedUserId,
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
    if (isDismantle && wo.linkedUserId) {
      try {
        await prisma.pppoeUser.update({
          where: { id: wo.linkedUserId },
          data: {
            isDismantled: true,
            dismantledAt: new Date(),
            dismantledNote: body.notes || body.reportData?.notes || 'Perangkat berhasil dicabut oleh teknisi',
          },
        });
        // Free ODP port
        await prisma.odpCustomerAssignment.deleteMany({
          where: { customerId: wo.linkedUserId },
        }).catch(() => {});
      } catch (dismantleErr) {
        console.error('Failed to update dismantle status:', dismantleErr);
      }
    }

    // Auto-Billing Trigger & Admin Alert
    if (wo.linkedUserId) {
      // Find the first PENDING or OVERDUE invoice for this customer
      const invoice = await prisma.invoice.findFirst({
        where: {
          userId: wo.linkedUserId,
          status: { in: ['PENDING', 'OVERDUE'] }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      if (invoice && wo.customer) {
        // Send WhatsApp Notification for the Invoice
        const company = await prisma.company.findFirst();
        
        await sendInvoiceReminder({
          phone: wo.customer.phone,
          customerName: wo.customer.name,
          customerId: wo.customer.customerId || undefined,
          customerUsername: wo.customer.username,
          invoiceNumber: invoice.invoiceNumber,
          amount: invoice.amount,
          dueDate: invoice.dueDate,
          paymentLink: invoice.paymentToken ? `${process.env.NEXT_PUBLIC_APP_URL}/pay/${invoice.paymentToken}` : '',
          companyName: company?.name || 'ISP',
          companyPhone: company?.phone || ''
        }).catch(e => console.error('Failed to send WA Invoice on completion:', e));
      } else if (!invoice && wo.customer) {
        // Send alert to Admin that Installation is complete but Invoice is NOT created yet!
        try {
          const { NotificationService } = await import('@/server/services/notifications/dispatcher.service');
          await NotificationService.notifyAdminInstallationCompleteNoInvoice({
            workOrderId: wo.id,
            customerName: wo.customerName,
            customerPhone: wo.customerPhone,
            customerId: wo.customer.customerId || wo.customer.username,
          });
        } catch (notifErr) {
          console.error('Failed to send admin installation completed alert:', notifErr);
        }
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
