import { prisma } from '@/server/db/client';
import { notFound } from 'next/navigation';
import { Download } from 'lucide-react';
import InvoiceTemplate, { InvoiceTemplateData } from '@/components/InvoiceTemplate';
import ManualInvoicePrintButton from './PrintButton';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoice = await prisma.manualInvoice.findFirst({
    where: { OR: [{ id }, { invoiceNumber: id }] },
    select: { invoiceNumber: true, recipientName: true },
  });
  if (!invoice) return { title: 'Invoice Tidak Ditemukan' };
  return { title: `Invoice ${invoice.invoiceNumber} — ${invoice.recipientName}` };
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
}

export default async function ManualInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Search by either nanoid ID or invoiceNumber (e.g. MINV-...)
  const invoice = await prisma.manualInvoice.findFirst({
    where: { OR: [{ id }, { invoiceNumber: id }] },
  });
  if (!invoice) notFound();

  const companyRaw = await prisma.company.findFirst();

  const companyLogo = companyRaw?.logo
    ? (companyRaw.logo.startsWith('/') || companyRaw.logo.startsWith('http') || companyRaw.logo.startsWith('data:')
        ? companyRaw.logo
        : `/${companyRaw.logo}`)
    : '';

  const parsedItems: Array<{ description: string; qty?: number; quantity?: number; unitPrice?: number; price?: number; total: number }> = (() => {
    try {
      const raw = invoice.items as any;
      return Array.isArray(raw) ? raw : JSON.parse(raw);
    } catch { return []; }
  })();

  const inv: InvoiceTemplateData = {
    company: {
      name: companyRaw?.name || 'Eugine Media Group',
      address: companyRaw?.address || '',
      phone: companyRaw?.phone || '',
      email: companyRaw?.email || '',
      logo: companyLogo,
      poweredBy: 'Eugine Media Group',
    },
    customer: {
      name: invoice.recipientName,
      customerId: invoice.recipientPhone || undefined,
      phone: invoice.recipientPhone || undefined,
      address: invoice.recipientAddress || undefined,
    },
    invoice: {
      number: invoice.invoiceNumber,
      date: new Date(invoice.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' }),
      // User specification: Tidak usah ada tanggal jatuh tempo di design invoice manual!
      dueDate: null,
      paidAt: invoice.paidAt ? new Date(invoice.paidAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' }) : null,
      status: invoice.status,
    },
    paidVia: invoice.paidAt ? 'transfer' : null,
    destinationBank: null,
    items: parsedItems.map((item) => ({
      description: item.description,
      quantity: Number(item.qty ?? item.quantity ?? 1),
      price: Number(item.unitPrice ?? item.price ?? item.total),
      total: Number(item.total),
    })),
    additionalFees: invoice.discountAmount > 0 ? [
      {
        name: 'Potongan / Diskon',
        amount: -invoice.discountAmount,
        price: -invoice.discountAmount,
      }
    ] : [],
    tax: {
      hasTax: false,
      taxRate: 0,
      baseAmount: invoice.subtotal,
      taxAmount: 0,
    },
    amountFormatted: formatCurrency(invoice.totalAmount),
    paymentLink: undefined,
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-8 pb-32 flex justify-center text-gray-900 font-sans text-[11px] leading-relaxed print:p-0 print:bg-white">
      <style dangerouslySetInnerHTML={{ __html: '@media print { @page { size: A4; margin: 0; } .no-print { display: none !important; } }' }} />

      <InvoiceTemplate data={inv} />

      {/* Floating Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-md border-t border-gray-200 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] z-50 flex justify-center no-print">
        <div className="w-full max-w-[210mm] flex gap-3 justify-end">
          <ManualInvoicePrintButton />
          
          <a
            href={`/api/manual-invoices/${invoice.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 max-w-[160px] bg-[#002C60] text-white font-bold text-[13px] py-3 rounded-xl hover:bg-[#1b437c] transition-colors flex items-center justify-center gap-2 shadow-md"
          >
            <Download className="w-4 h-4" />
            Download PDF
          </a>
        </div>
      </div>
    </div>
  );
}
