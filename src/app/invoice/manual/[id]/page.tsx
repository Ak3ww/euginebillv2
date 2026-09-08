import { prisma } from '@/server/db/client';
import { notFound } from 'next/navigation';
import { Download, CheckCircle2, Clock, XCircle } from 'lucide-react';
import ManualInvoicePrintButton from './PrintButton';


export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoice = await prisma.manualInvoice.findUnique({ where: { id }, select: { invoiceNumber: true, recipientName: true } });
  if (!invoice) return { title: 'Invoice Tidak Ditemukan' };
  return { title: `Invoice ${invoice.invoiceNumber} — ${invoice.recipientName}` };
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
}

function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(date));
}

type InvoiceItem = { description: string; qty: number; unitPrice: number; total: number };

export default async function ManualInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const invoice = await prisma.manualInvoice.findUnique({ where: { id } });
  if (!invoice) notFound();

  const company = await prisma.company.findFirst({
    select: { name: true, address: true, phone: true, email: true, logo: true, bankAccounts: true },
  });

  const bankAccounts: Array<{ bankName: string; accountNumber: string; accountName: string }> = (() => {
    try {
      if (!company?.bankAccounts) return [];
      const raw = company.bankAccounts as any;
      return Array.isArray(raw) ? raw : JSON.parse(raw);
    } catch { return []; }
  })();

  const items: InvoiceItem[] = (() => {
    try {
      const raw = invoice.items as any;
      return Array.isArray(raw) ? raw : JSON.parse(raw);
    } catch { return []; }
  })();

  const statusConfig = {
    PENDING: { label: 'Menunggu Pembayaran', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
    PAID: { label: 'LUNAS', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
    CANCELLED: { label: 'Dibatalkan', icon: XCircle, color: 'text-slate-500', bg: 'bg-slate-50 border-slate-200' },
  };

  const statusInfo = statusConfig[invoice.status as keyof typeof statusConfig] || statusConfig.PENDING;
  const StatusIcon = statusInfo.icon;

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4">
      {/* Action Bar — hidden on print */}
      <div className="max-w-3xl mx-auto mb-4 flex items-center justify-between print:hidden">
        <p className="text-sm text-slate-500">
          Invoice Manual &mdash; <span className="font-semibold text-slate-700">{invoice.invoiceNumber}</span>
        </p>
        <div className="flex gap-2">
          <a
            href={`/api/manual-invoices/${id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md bg-[#002C60] px-3 py-2 text-sm font-medium text-white hover:bg-[#1b437c] transition-colors"
          >
            <Download className="h-4 w-4" />
            Download PDF
          </a>
          <ManualInvoicePrintButton />

        </div>
      </div>

      {/* Invoice Card */}
      <div className="max-w-3xl mx-auto bg-white shadow-sm rounded-lg overflow-hidden print:shadow-none print:rounded-none">
        
        {/* Header */}
        <div className="bg-[#002C60] text-white px-8 py-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              {company?.logo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={company.logo.startsWith('/') ? company.logo : `/${company.logo}`}
                  alt="Logo"
                  className="h-12 w-12 object-contain rounded bg-white/10 p-1"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              )}
              <div>
                <h1 className="text-xl font-bold tracking-wide">{company?.name || 'EugineBill'}</h1>
                {company?.address && <p className="text-sm text-blue-200 mt-0.5">{company.address}</p>}
                {company?.phone && <p className="text-sm text-blue-200">{company.phone}</p>}
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-black tracking-wider opacity-80">INVOICE</p>
              <p className="text-lg font-bold mt-1">{invoice.invoiceNumber}</p>
              <p className="text-sm text-blue-200 mt-0.5">Tanggal: {formatDate(invoice.createdAt)}</p>
            </div>
          </div>
        </div>

        {/* Status + Recipient */}
        <div className="px-8 py-5 border-b border-slate-100">
          <div className="flex flex-wrap gap-4 items-start justify-between">
            {/* Recipient */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Tagihan Kepada</p>
              <p className="font-bold text-slate-800 text-lg">{invoice.recipientName}</p>
              {invoice.recipientPhone && <p className="text-sm text-slate-600 mt-0.5">{invoice.recipientPhone}</p>}
              {invoice.recipientAddress && (
                <p className="text-sm text-slate-600 mt-0.5 whitespace-pre-line">{invoice.recipientAddress}</p>
              )}
            </div>

            {/* Status Badge */}
            <div className={`flex items-center gap-2 rounded-lg border px-4 py-2 ${statusInfo.bg}`}>
              <StatusIcon className={`h-5 w-5 ${statusInfo.color}`} />
              <span className={`font-semibold text-sm ${statusInfo.color}`}>{statusInfo.label}</span>
            </div>
          </div>
          {invoice.paidAt && (
            <p className="text-xs text-emerald-600 mt-2 font-medium">
              Dibayar pada: {formatDate(invoice.paidAt)}
            </p>
          )}
        </div>

        {/* Items Table */}
        <div className="px-8 py-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-[#002C60]">
                <th className="text-left pb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 w-8">No</th>
                <th className="text-left pb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Deskripsi</th>
                <th className="text-right pb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 w-16">Qty</th>
                <th className="text-right pb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 w-36">Harga Satuan</th>
                <th className="text-right pb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 w-36">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx} className="border-b border-slate-50">
                  <td className="py-3 text-slate-400">{idx + 1}</td>
                  <td className="py-3 text-slate-800 font-medium">{item.description}</td>
                  <td className="py-3 text-right text-slate-600">{item.qty}</td>
                  <td className="py-3 text-right text-slate-600">{formatCurrency(item.unitPrice)}</td>
                  <td className="py-3 text-right font-semibold text-slate-800">{formatCurrency(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="mt-4 flex justify-end">
            <div className="w-72">
              <div className="flex justify-between py-1.5 text-sm text-slate-600">
                <span>Subtotal</span>
                <span>{formatCurrency(invoice.subtotal)}</span>
              </div>
              {invoice.discountAmount > 0 && (
                <div className="flex justify-between py-1.5 text-sm text-emerald-600">
                  <span>Diskon</span>
                  <span>- {formatCurrency(invoice.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between border-t-2 border-[#002C60] pt-2 mt-1">
                <span className="font-bold text-slate-800">Total</span>
                <span className="font-bold text-[#002C60] text-lg">{formatCurrency(invoice.totalAmount)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        {invoice.notes && (
          <div className="px-8 py-4 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Catatan</p>
            <p className="text-sm text-slate-600 whitespace-pre-line">{invoice.notes}</p>
          </div>
        )}

        {/* Payment Info */}
        {bankAccounts.length > 0 && invoice.status === 'PENDING' && (
          <div className="px-8 py-5 border-t border-slate-100 bg-slate-50">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Informasi Pembayaran</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {bankAccounts.map((acc, idx) => (
                <div key={idx} className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="font-semibold text-slate-700 text-sm">{acc.bankName}</p>
                  <p className="font-bold text-slate-900 text-base tracking-wider mt-0.5">{acc.accountNumber}</p>
                  <p className="text-xs text-slate-500 mt-0.5">a.n. {acc.accountName}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-8 py-4 border-t border-slate-100 bg-slate-50 text-center">
          <p className="text-xs text-slate-400">
            Dokumen ini diterbitkan oleh sistem <span className="font-semibold">{company?.name || 'EugineBill'}</span>
          </p>
        </div>
      </div>

      {/* Print Styles */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          `,
        }}
      />
    </div>

  );
}
