import { prisma } from '@/server/db/client';
import crypto from 'crypto';
import { sendRegistrationApproval } from '@/server/services/notifications/whatsapp-templates.service';

export async function activateAndBillUser(userId: string) {
  const user = await prisma.pppoeUser.findUnique({
    where: { id: userId },
    include: { profile: true },
  });

  if (!user) throw new Error('User not found');

  // Ensure status is ACTIVE
  await prisma.pppoeUser.update({
    where: { id: userId },
    data: { status: 'active' },
  });

  const companyInfo = await prisma.company.findFirst();

  // Push updated status to Mikrotik if needed
  if (!companyInfo?.radiusEnabled) {
    const { PPPSecretService } = await import('@/server/services/mikrotik/ppp-secret.service');
    await PPPSecretService.syncSecret(user.id);
  }

  const registration = await prisma.registrationRequest.findFirst({
    where: { pppoeUserId: userId },
  });

  let additionalFees: any[] = [];
  let installationFee = 0;
  
  if (registration) {
    installationFee = Number(registration.installationFee) || 0;
    if (registration.notes && registration.notes.includes('[ADMIN_FEES]:')) {
      try {
        const feesData = registration.notes.split('[ADMIN_FEES]: ')[1];
        const parsed = JSON.parse(feesData);
        additionalFees = parsed.additionalFees || [];
      } catch(e) {}
    }
    
    await prisma.registrationRequest.update({
      where: { id: registration.id },
      data: { status: 'INSTALLED' },
    });
  }

  // Invoice generation logic
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const invPrefix = `INV-${year}${month}-`;
  const count = await prisma.invoice.count({ where: { invoiceNumber: { startsWith: invPrefix } } });
  const invoiceNumber = `${invPrefix}${String(count + 1).padStart(4, '0')}`;

  let prorateSubscriptionFee = 0;
  if (companyInfo?.enableProrate) {
    const activeBillingDay = user.billingDay || 1;
    const expiredAt = new Date(now.getFullYear(), now.getMonth(), activeBillingDay, 23, 59, 59, 999);
    if (now.getDate() >= activeBillingDay) {
      expiredAt.setMonth(expiredAt.getMonth() + 1);
    }
    const msPerDay = 1000 * 60 * 60 * 24;
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const daysActive = Math.max(1, Math.ceil((expiredAt.getTime() - today.getTime()) / msPerDay));
    const pricePerDay = user.profile.proratePricePerDay || 0;
    prorateSubscriptionFee = Math.ceil(daysActive * pricePerDay);
  }

  let baseAmount: number;
  let invoiceType = 'INSTALLATION';
  let extraFeesTotal = 0;
  if (Array.isArray(additionalFees)) {
    extraFeesTotal = additionalFees.reduce((sum: number, fee: any) => sum + (Number(fee.amount) || 0), 0);
  }
  
  const finalAdditionalFees = [...additionalFees];
  
  if (companyInfo?.enableProrate) {
    baseAmount = Math.round(installationFee) + user.profile.price;
    const prorateDiscount = prorateSubscriptionFee - user.profile.price;
    if (prorateDiscount < 0) {
      finalAdditionalFees.push({
        name: `Diskon Prorata (${user.profile.name})`,
        amount: prorateDiscount
      });
      extraFeesTotal += prorateDiscount;
    }
  } else {
    if (user.subscriptionType === 'PREPAID') {
      baseAmount = Math.round(installationFee) + user.profile.price;
    } else {
      baseAmount = Math.round(installationFee);
    }
  }
  
  baseAmount += extraFeesTotal;
  if (baseAmount < 0) baseAmount = 0;

  let invoiceAmount = baseAmount;
  let taxRate: number | null = null;
  if (user.profile.ppnActive && user.profile.ppnRate > 0) {
    taxRate = user.profile.ppnRate;
    invoiceAmount = Math.round(baseAmount + (baseAmount * taxRate / 100));
  }

  const baseUrl = companyInfo?.baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const paymentToken = crypto.randomBytes(32).toString('hex');
  const paymentLink = `${baseUrl}/pay/${paymentToken}`;
  const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const invoice = await prisma.invoice.create({
    data: {
      id: crypto.randomUUID(),
      invoiceNumber,
      userId: user.id,
      amount: invoiceAmount,
      baseAmount: baseAmount,
      ...(taxRate !== null && { taxRate }),
      status: 'PENDING',
      dueDate,
      customerName: user.name,
      customerPhone: user.phone,
      customerUsername: user.username,
      paymentToken,
      paymentLink,
      invoiceType: invoiceType as any,
      additionalFees: finalAdditionalFees.length > 0 ? finalAdditionalFees : undefined,
    },
  });

  if (registration) {
    await prisma.registrationRequest.update({
      where: { id: registration.id },
      data: { invoiceId: invoice.id },
    });
  }

  // Send WA
  await sendRegistrationApproval({
    customerName: user.name,
    customerPhone: user.phone,
    customerId: user.customerId || undefined,
    username: user.username,
    password: user.password,
    profileName: user.profile.name,
    installationFee: Math.round(installationFee),
    invoiceNumber: invoice.invoiceNumber,
    subscriptionType: user.subscriptionType,
    dueDate,
    paymentLink,
    totalAmount: invoiceAmount,
  });

  return invoice;
}
