import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { prisma } from '@/server/db/client';
import { TECH_JWT_SECRET } from '@/server/auth/technician-secret';
import { sendInvoiceReminder } from '@/server/services/notifications/whatsapp-templates.service';

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

    // Auto-Billing Trigger
    if (wo.linkedUserId) {
      // Find the first PENDING invoice for this customer
      const invoice = await prisma.invoice.findFirst({
        where: {
          userId: wo.linkedUserId,
          status: 'PENDING'
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
          customerId: wo.customer.customerId,
          customerUsername: wo.customer.username,
          invoiceNumber: invoice.invoiceNumber,
          amount: invoice.amount,
          dueDate: invoice.dueDate,
          paymentLink: invoice.paymentToken ? `${process.env.NEXT_PUBLIC_APP_URL}/pay/${invoice.paymentToken}` : '',
          companyName: company?.name || 'ISP',
          companyPhone: company?.phone || ''
        }).catch(e => console.error('Failed to send WA Invoice on completion:', e));
      }
    }

    return NextResponse.json({ success: true, workOrder: updated });
  } catch (error: any) {
    console.error('Work order completion error:', error);
    return NextResponse.json({ error: error.message || 'Failed to complete work order' }, { status: 500 });
  }
}
