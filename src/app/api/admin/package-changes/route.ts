import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { createMidtransPayment } from '@/server/services/payment/midtrans.service';
import { createXenditInvoice } from '@/server/services/payment/xendit.service';
import { createDuitkuClient } from '@/server/services/payment/duitku.service';
import { createTripayClient } from '@/server/services/payment/tripay.service';
import { sendInvoiceReminder } from '@/server/services/notifications/whatsapp-templates.service';

export const dynamic = 'force-dynamic';

// GET - List all package change requests
export async function GET(request: NextRequest) {
  try {
    const requests = await prisma.packageChangeRequest.findMany({
      where: { status: 'PENDING' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            phone: true,
            customerId: true,
            expiredAt: true
          }
        },
        oldProfile: true,
        newProfile: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ success: true, requests });
  } catch (error: any) {
    console.error('List package changes error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Approve or reject a package change request
export async function POST(request: NextRequest) {
  try {
    const { requestId, action } = await request.json();

    if (!requestId || !action) {
      return NextResponse.json({ error: 'Request ID and action (APPROVED/REJECTED) are required' }, { status: 400 });
    }

    const changeRequest = await prisma.packageChangeRequest.findUnique({
      where: { id: requestId },
      include: {
        user: {
          include: {
            profile: true
          }
        },
        oldProfile: true,
        newProfile: true
      }
    });

    if (!changeRequest) {
      return NextResponse.json({ error: 'Package change request not found' }, { status: 404 });
    }

    if (changeRequest.status !== 'PENDING') {
      return NextResponse.json({ error: 'Request is already processed' }, { status: 400 });
    }

    if (action === 'REJECTED') {
      await prisma.packageChangeRequest.update({
        where: { id: requestId },
        data: { status: 'REJECTED' }
      });
      return NextResponse.json({ success: true, message: 'Request rejected successfully' });
    }

    if (action !== 'APPROVED') {
      return NextResponse.json({ error: 'Invalid action. Must be APPROVED or REJECTED' }, { status: 400 });
    }

    const { user, oldProfile, newProfile } = changeRequest;

    // Proration calculations
    let remainingDays = 0;
    let oldUnusedValue = 0;
    let newProratedCost = 0;
    let baseAmount = newProfile.price;
    let isProrated = false;

    if (user.expiredAt && user.expiredAt > new Date()) {
      const today = new Date();
      const timeDiff = user.expiredAt.getTime() - today.getTime();
      remainingDays = Math.max(0, Math.ceil(timeDiff / (1000 * 60 * 60 * 24)));

      if (remainingDays > 0 && remainingDays < 32) {
        isProrated = true;
        const oldDailyRate = oldProfile.proratePricePerDay || (oldProfile.price / 30);
        const newDailyRate = newProfile.proratePricePerDay || (newProfile.price / 30);

        oldUnusedValue = Math.round(remainingDays * oldDailyRate);
        newProratedCost = Math.round(remainingDays * newDailyRate);
        baseAmount = Math.max(0, newProratedCost - oldUnusedValue);
      }
    }

    let finalAmount = baseAmount;
    let taxRateNum: number | null = null;
    if (newProfile.ppnActive && newProfile.ppnRate > 0) {
      taxRateNum = newProfile.ppnRate;
      finalAmount = Math.round(baseAmount + (baseAmount * taxRateNum / 100));
    }

    // Create Invoice (type ADDON)
    const invoiceNumber = `INV-UPG-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;
    const paymentToken = `PAY-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);

    const isUpgrade = newProfile.price > oldProfile.price;
    const actionLabel = isUpgrade ? 'Upgrade Paket' : 'Downgrade Paket';

    const additionalFees = {
      items: [
        {
          name: `${actionLabel} ke ${newProfile.name}`,
          amount: finalAmount,
          metadata: {
            type: 'package_upgrade',
            oldPackageId: oldProfile.id,
            oldPackageName: oldProfile.name,
            newPackageId: newProfile.id,
            newPackageName: newProfile.name,
            isProrated,
            remainingDays,
            oldUnusedValue,
            newProratedCost
          }
        }
      ]
    };

    const invoice = await prisma.invoice.create({
      data: {
        id: `inv-${Date.now()}`,
        userId: user.id,
        invoiceNumber,
        amount: finalAmount,
        dueDate,
        status: 'PENDING',
        paymentToken,
        customerName: user.name,
        customerPhone: user.phone,
        customerEmail: user.email || `${user.username}@customer.com`,
        customerUsername: user.username,
        invoiceType: 'ADDON',
        baseAmount,
        ...(taxRateNum !== null && { taxRate: taxRateNum }),
        additionalFees
      }
    });

    // Determine Active Payment Gateway to generate payment link
    const activeGateway = await prisma.paymentGateway.findFirst({
      where: { isActive: true }
    });

    let paymentUrl = '';
    const orderId = `INV-${invoice.invoiceNumber}-${Date.now()}`;

    // Get Base URL
    const company = await prisma.company.findFirst();
    const appBaseUrl = company?.baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    if (activeGateway) {
      try {
        const customerEmail = user.email || `${user.username}@customer.com`;
        const token = invoice.paymentToken || '';

        if (activeGateway.provider === 'midtrans') {
          const midtransResult = await createMidtransPayment({
            orderId,
            amount: invoice.amount,
            customerName: user.name,
            customerEmail,
            customerPhone: user.phone,
            invoiceToken: token,
            baseUrl: appBaseUrl,
            items: [{
              id: newProfile.id,
              name: `${actionLabel} ke ${newProfile.name}`,
              price: invoice.amount,
              quantity: 1
            }]
          });
          paymentUrl = midtransResult.redirect_url;
        } else if (activeGateway.provider === 'xendit') {
          const xenditResult = await createXenditInvoice({
            externalId: orderId,
            amount: invoice.amount,
            payerEmail: customerEmail,
            description: `${actionLabel} ke ${newProfile.name}`,
            customerName: user.name,
            customerPhone: user.phone,
            invoiceToken: token,
            baseUrl: appBaseUrl,
          });
          paymentUrl = xenditResult.invoiceUrl;
        } else if (activeGateway.provider === 'duitku') {
          const duitku = createDuitkuClient(
            activeGateway.duitkuMerchantCode || '',
            activeGateway.duitkuApiKey || '',
            `${appBaseUrl}/api/payment/webhook`,
            `${appBaseUrl}/customer`,
            activeGateway.duitkuEnvironment === 'sandbox'
          );
          const result = await duitku.createInvoice({
            invoiceId: orderId,
            amount: invoice.amount,
            customerName: user.name,
            customerEmail,
            customerPhone: user.phone,
            description: `${actionLabel} ke ${newProfile.name}`,
            expiryMinutes: 1440,
            paymentMethod: 'SP',
          });
          paymentUrl = result.paymentUrl;
        } else if (activeGateway.provider === 'tripay') {
          const tripay = createTripayClient(
            activeGateway.tripayMerchantCode || '',
            activeGateway.tripayApiKey || '',
            activeGateway.tripayPrivateKey || '',
            activeGateway.tripayEnvironment === 'sandbox'
          );
          const result = await tripay.createTransaction({
            method: 'QRIS',
            merchantRef: orderId,
            amount: invoice.amount,
            customerName: user.name,
            customerEmail,
            customerPhone: user.phone,
            orderItems: [{
              name: `${actionLabel} ke ${newProfile.name}`,
              price: invoice.amount,
              quantity: 1,
            }],
            returnUrl: `${appBaseUrl}/customer`,
            expiredTime: 86400,
          });
          if (result.success && result.data) {
            paymentUrl = result.data.checkout_url || result.data.pay_url || '';
          }
        }
      } catch (payError) {
        console.error('Failed to create online payment link on approval:', payError);
      }
    }

    const checkoutUrl = paymentUrl || `${appBaseUrl}/pay/${paymentToken}`;

    // Update invoice with payment link
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { paymentLink: checkoutUrl }
    });

    // Update Request Status to APPROVED
    await prisma.packageChangeRequest.update({
      where: { id: requestId },
      data: { status: 'APPROVED' }
    });

    // Send WhatsApp notification
    try {
      await sendInvoiceReminder({
        phone: user.phone,
        customerName: user.name,
        customerId: user.customerId || '',
        customerUsername: user.username,
        profileName: newProfile.name,
        invoiceNumber: invoice.invoiceNumber,
        amount: invoice.amount,
        dueDate: invoice.dueDate,
        paymentLink: checkoutUrl,
        companyName: company?.name || 'EugineBill',
        companyPhone: company?.phone || ''
      });
      
      // Update invoice notification status
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { waNotifiedAt: new Date() }
      });
    } catch (waError) {
      console.error('Failed to send WhatsApp notification for approved package change:', waError);
    }

    return NextResponse.json({
      success: true,
      message: 'Request approved and invoice created successfully',
      invoice: {
        invoiceNumber: invoice.invoiceNumber,
        amount: invoice.amount,
        paymentLink: checkoutUrl
      }
    });

  } catch (error: any) {
    console.error('Approve package change error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
