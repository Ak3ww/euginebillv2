import { prisma } from '@/server/db/client';
import { notFound } from 'next/navigation';
import InvoiceTemplate from '@/components/InvoiceTemplate';
import PrintAction from './PrintAction';

export const metadata = {
  title: 'Invoice',
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
}

export default async function PrintInvoicePage({ params }: { params: Promise<{ id: string }> }) {
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

  // Enforce that this print page can ONLY be viewed if the invoice is PAID
  if (!rawInvoice.paidAt && rawInvoice.status !== 'PAID') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 text-gray-900 p-4 print:hidden">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-red-100">
          <h2 className="text-2xl font-bold mb-2">Akses Ditolak</h2>
          <p className="text-gray-500 mb-6">Halaman cetak ini hanya dapat diakses untuk invoice yang sudah lunas.</p>
        </div>
      </div>
    );
  }

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
    // If it's an ADDON invoice with parsedFees, we don't push anything to items
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

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-8 pb-32 flex justify-center text-gray-900 font-sans text-[11px] leading-relaxed print:p-0 print:bg-white">
      <style dangerouslySetInnerHTML={{ __html: '@media print { @page { size: A4; margin: 0; } .no-print { display: none !important; } }' }} />

      <InvoiceTemplate data={inv} />

      <PrintAction />
    </div>
  );
}
