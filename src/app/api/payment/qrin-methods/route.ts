import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { createQrinClient } from '@/server/services/payment/qrin.service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const gateway = await prisma.paymentGateway.findUnique({
      where: { provider: 'qrin' },
      select: {
        isActive: true,
        qrinToken: true,
      },
    });

    if (!gateway || !gateway.isActive || !gateway.qrinToken) {
      return NextResponse.json({ methods: [] });
    }

    const qrinClient = createQrinClient(gateway.qrinToken);
    
    try {
      const res = await qrinClient.getPaymentMethods();
      
      if (res.success && res.data) {
        const methods = res.data.map((m: any) => {
           return {
             code: m.payment_method,
             name: m.payment_name,
             fee: 0, 
             group: getGroup(m.payment_method),
             logo: m.logo_url
           };
        });
        return NextResponse.json({ methods });
      }
      
      console.warn('[QRIN Methods] Failed from API:', res.message);
    } catch (apiErr) {
      console.warn('[QRIN Methods] API error:', apiErr);
    }
    
    return NextResponse.json({ methods: [] });
  } catch (error) {
    console.error('[QRIN Methods] Error:', error);
    return NextResponse.json({ methods: [] });
  }
}

function getGroup(code: string): string {
  const qris = ['qris'];
  const va = ['vabri', 'vapermata', 'vamandiri', 'vabni', 'vabca', 'vabtn', 'vabjb', 'vamega', 'vabsi', 'vadki', 'vabankneo', 'vamaybank', 'vacimb', 'vadanamon'];
  if (qris.includes(code)) return 'qris';
  if (va.includes(code)) return 'va';
  return 'other';
}
