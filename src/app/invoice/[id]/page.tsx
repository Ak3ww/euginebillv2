import { prisma } from '@/server/db/client';
import { notFound, redirect } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import Link from 'next/link';
import { Printer, CreditCard } from 'lucide-react';
import DownloadPdfButton from '@/components/DownloadPdfButton';
export const metadata = {
  title: 'Invoice',
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
}

export default async function PublicInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  const rawInvoice = await prisma.invoice.findUnique({
    where: { invoiceNumber: id },
    include: {
      user: {
        include: { profile: true, area: true }
      },
      payments: { take: 1 },
      manualPayments: { take: 1 },
    }
  });

  if (!rawInvoice) notFound();

  // Redirect removed, both PAID and UNPAID show the same web layout

  const companyRaw = await prisma.company.findFirst();

  const inv: any = {};
  
  inv.company = {
    name: companyRaw?.name || 'EugineBill',
    address: companyRaw?.address || '',
    phone: companyRaw?.phone || '',
    email: companyRaw?.email || '',
    logo: companyRaw?.logo || '',
    poweredBy: 'EugineBill',
  };

  inv.customer = {
    name: rawInvoice.user?.name || 'Pelanggan',
    customerId: rawInvoice.user?.customerId || '',
    phone: rawInvoice.user?.phone || '',
    address: rawInvoice.user?.address || '',
  };

  const approvedManual = rawInvoice.manualPayments?.find((mp: any) => mp.status === 'APPROVED');
  const anyManual = rawInvoice.manualPayments?.[0];

  const paidVia = (() => {
    if (!rawInvoice.paidAt) return null;
    if (approvedManual || rawInvoice.payments?.some((p: any) => p.method === 'manual_transfer' || p.method === 'manual')) return 'transfer';
    if (rawInvoice.payments?.length > 0) return 'gateway';
    return 'admin';
  })();

  inv.paidVia = paidVia;
  inv.destinationBank = approvedManual?.destinationBank || anyManual?.destinationBank || null;

  inv.invoice = {
    number: rawInvoice.invoiceNumber,
    date: new Date(rawInvoice.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' }),
    dueDate: new Date(rawInvoice.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' }),
    paidAt: rawInvoice.paidAt ? new Date(rawInvoice.paidAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' }) : null,
    status: rawInvoice.status,
  };

  inv.paidVia = paidVia;
  inv.paymentLink = rawInvoice.paymentLink || (rawInvoice.paymentToken ? '/pay/' + rawInvoice.paymentToken : '');
  inv.paymentToken = rawInvoice.paymentToken || null;

  const baseAmt = rawInvoice.baseAmount ?? rawInvoice.amount;
  const taxRateNum = rawInvoice.taxRate ? Number(rawInvoice.taxRate) : 0;
  const taxAmt = taxRateNum > 0 ? rawInvoice.amount - baseAmt : 0;

  inv.tax = {
    hasTax: taxRateNum > 0,
    taxRate: taxRateNum,
    baseAmount: baseAmt,
    taxAmount: taxAmt
  };

  const parsedFees = (() => {
    try {
      if (!rawInvoice.additionalFees) return [];
      const parsed = typeof rawInvoice.additionalFees === 'string'
        ? JSON.parse(rawInvoice.additionalFees)
        : rawInvoice.additionalFees;
      return Array.isArray(parsed) ? parsed : (parsed.items || []);
    } catch { return []; }
  })();

  let items = [];
  if (rawInvoice.type === 'INSTALLATION') {
    items.push({ description: 'Biaya Pemasangan', quantity: 1, price: rawInvoice.amount, total: rawInvoice.amount });
  } else if (rawInvoice.type === 'TOPUP') {
    items.push({ description: 'Top Up Saldo', quantity: 1, price: rawInvoice.amount, total: rawInvoice.amount });
  } else if (rawInvoice.invoiceType === 'ADDON' && parsedFees.length > 0) {
    // If it's an ADDON invoice with parsedFees, we don't push anything to items,
    // so that we don't duplicate the additionalFees in the render below.
  } else {
    items.push({ 
      description: 'Langganan Internet (' + new Date(rawInvoice.dueDate).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }) + ') - ' + (rawInvoice.user?.profile?.name || 'Paket Internet'), 
      quantity: 1, 
      price: baseAmt, 
      total: baseAmt 
    });
  }

  inv.items = items;
  inv.additionalFees = parsedFees;

  inv.amountFormatted = formatCurrency(rawInvoice.amount);
  const fmtCurr = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);

import InvoiceTemplate from '@/components/InvoiceTemplate';

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-8 pb-32 flex justify-center text-gray-900 font-sans text-[11px] leading-relaxed print:p-0 print:bg-white">
      <style dangerouslySetInnerHTML={{ __html: '@media print { @page { size: A4; margin: 0; } .no-print { display: none !important; } }' }} />

      <InvoiceTemplate data={inv} />

      {/* Floating Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-md border-t border-gray-200 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] z-50 flex justify-center no-print">
        <div className="w-full max-w-[210mm] flex gap-3">
          <Link href={`/invoice/${inv.invoice.number}/print`} className="flex-1 max-w-[120px] bg-white text-gray-700 border border-gray-300 font-bold text-[13px] py-3 rounded-xl hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
            <Printer className="w-4 h-4" />
            Cetak
          </Link>
          
          <DownloadPdfButton invoiceNumber={inv.invoice.number} />
          
          {inv.invoice.status !== 'PAID' && (inv.paymentToken || inv.paymentLink) && (
            <Link
              href={inv.paymentToken ? `/pay/${inv.paymentToken}` : inv.paymentLink}
              className="flex-1 bg-red-600 text-white font-bold text-[14px] py-3 rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-600/30 flex items-center justify-center gap-2"
            >
              <CreditCard className="w-5 h-5" />
              BAYAR SEKARANG
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
