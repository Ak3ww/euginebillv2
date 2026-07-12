import { prisma } from '@/server/db/client';
import { notFound } from 'next/navigation';
import PrintAction from './PrintAction';
import { QRCodeSVG } from 'qrcode.react';

export const metadata = {
  title: 'Print Invoice',
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
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 text-gray-800 p-4 print:hidden">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-red-100">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
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

  const paidVia = (() => {
    if (!rawInvoice.paidAt) return null;
    if (rawInvoice.payments?.length > 0) return 'gateway';
    if (rawInvoice.manualPayments?.length > 0) return 'transfer';
    return 'admin';
  })();

  inv.invoice = {
    number: rawInvoice.invoiceNumber,
    date: new Date(rawInvoice.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' }),
    dueDate: new Date(rawInvoice.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' }),
    paidAt: rawInvoice.paidAt ? new Date(rawInvoice.paidAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' }) : null,
    status: rawInvoice.status,
  };

  inv.paidVia = paidVia;
  inv.paymentLink = rawInvoice.paymentLink || (rawInvoice.paymentToken ? '/pay/' + rawInvoice.paymentToken : '');

  const baseAmt = rawInvoice.baseAmount ?? rawInvoice.amount;
  const taxRateNum = rawInvoice.taxRate ? Number(rawInvoice.taxRate) : 0;
  const taxAmt = taxRateNum > 0 ? rawInvoice.amount - baseAmt : 0;

  inv.tax = {
    hasTax: taxRateNum > 0,
    taxRate: taxRateNum,
    baseAmount: baseAmt,
    taxAmount: taxAmt
  };

  let items = [];
  if (rawInvoice.type === 'INSTALLATION') {
    items.push({ description: 'Biaya Pemasangan', quantity: 1, price: rawInvoice.amount, total: rawInvoice.amount });
  } else if (rawInvoice.type === 'TOPUP') {
    items.push({ description: 'Top Up Saldo', quantity: 1, price: rawInvoice.amount, total: rawInvoice.amount });
  } else {
    items.push({ 
      description: 'Langganan Internet (' + new Date(rawInvoice.dueDate).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }) + ') - ' + (rawInvoice.user?.profile?.name || 'Paket Internet'), 
      quantity: 1, 
      price: baseAmt, 
      total: baseAmt 
    });
  }

  inv.items = items;

  inv.additionalFees = (() => {
    try {
      if (!rawInvoice.additionalFees) return [];
      const raw = rawInvoice.additionalFees as any;
      return (Array.isArray(raw) ? raw : JSON.parse(raw));
    } catch { return []; }
  })();

  inv.amountFormatted = formatCurrency(rawInvoice.amount);
  const fmtCurr = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);

  return (
    <div className="min-h-screen bg-gray-50 p-8 print:p-0 print:bg-white text-gray-800 font-sans text-[11px] leading-relaxed flex justify-center">
      <PrintAction />
      
      <style dangerouslySetInnerHTML={{ __html: '@media print { @page { size: A4; margin: 10mm; } }' }} />

      <div className="w-[210mm] max-w-full bg-white shadow-[0_18px_50px_rgba(15,118,110,0.08)] print:shadow-none border border-[#dbe7e4] print:border-none rounded-[18px] print:rounded-none overflow-hidden flex flex-col relative">
        <div className="h-[7px] bg-gradient-to-r from-teal-600 via-teal-500 to-teal-300 print:hidden" />
        
        <div className="p-6 print:p-0 flex-1 mt-4 print:mt-0">
          {/* Header */}
          <div className="flex justify-between items-start mb-5 gap-5">
            <div className="flex items-center gap-3.5">
              {inv.company.logo && (
                <div className="w-[78px] h-[78px] rounded-2xl bg-gradient-to-b from-cyan-50 to-teal-50 border border-teal-100 flex items-center justify-center p-2.5 print:border-none print:bg-none">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={inv.company.logo} className="max-h-[58px] max-w-[58px] w-auto object-contain" alt="Logo" />
                </div>
              )}
              <div>
                <div className="text-xl font-bold text-gray-900">{inv.company.name}</div>
                <div className="text-gray-500 mt-1 text-[10px] leading-[1.6]">
                  {inv.company.address && <span dangerouslySetInnerHTML={{__html: inv.company.address}} />}
                  {inv.company.address && <br />}
                  {inv.company.phone && <span>Telp: {inv.company.phone}</span>}
                  {inv.company.phone && <br />}
                  {inv.company.email}
                </div>
              </div>
            </div>
            <div className="text-right pt-0.5">
              <div className="text-[26px] font-bold text-gray-900 tracking-[2px] leading-[1.25]">INVOICE</div>
              <div className="text-[13px] font-bold text-red-600 my-1 leading-[1.35]">{inv.invoice.number}</div>
              <div>
                <span className="inline-block px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 print:border-emerald-500 print:text-emerald-900" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                  &#10003; SUDAH BAYAR
                </span>
              </div>
            </div>
          </div>

          <hr className="border-t-2 border-red-600 my-3.5" />

          {/* Grid Information */}
          <div className="grid grid-cols-2 gap-6 mb-4.5">
            <div className="bg-slate-50 border border-gray-200 rounded-xl p-3.5 print:bg-transparent print:border-gray-300">
              <div className="font-bold text-[10px] text-gray-400 uppercase tracking-widest mb-1.5">Dari</div>
              <div className="mb-0.5"><strong>{inv.company.name}</strong></div>
              {inv.company.address && <div className="mb-0.5">{inv.company.address}</div>}
              {inv.company.phone && <div className="mb-0.5">Telp: {inv.company.phone}</div>}
            </div>
            <div className="bg-slate-50 border border-gray-200 rounded-xl p-3.5 print:bg-transparent print:border-gray-300">
              <div className="font-bold text-[10px] text-gray-400 uppercase tracking-widest mb-1.5">Kepada</div>
              <div className="mb-0.5"><strong>{inv.customer.name}</strong></div>
              {inv.customer.customerId && <div className="mb-0.5"><span className="text-gray-500">ID Pelanggan: </span>{inv.customer.customerId}</div>}
              {inv.customer.phone && <div className="mb-0.5"><span className="text-gray-500">Telp: </span>{inv.customer.phone}</div>}
              {inv.customer.address && <div className="mb-0.5"><span className="text-gray-500">Alamat: </span>{inv.customer.address}</div>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-4.5 mt-4">
            <div className="bg-slate-50 border border-gray-200 rounded-xl p-3.5 print:bg-transparent print:border-gray-300">
              <div className="font-bold text-[10px] text-gray-400 uppercase tracking-widest mb-1.5">Detail Invoice</div>
              <div className="mb-0.5"><span className="text-gray-500">No Invoice: </span><strong>{inv.invoice.number}</strong></div>
              <div className="mb-0.5"><span className="text-gray-500">Tanggal: </span>{inv.invoice.date}</div>
              <div className="mb-0.5"><span className="text-gray-500">Jatuh Tempo: </span>{inv.invoice.dueDate}</div>
              {inv.invoice.paidAt && <div className="mb-0.5"><span className="text-gray-500">Tgl Bayar: </span>{inv.invoice.paidAt}</div>}
            </div>
            <div className="bg-slate-50 border border-gray-200 rounded-xl p-3.5 print:bg-transparent print:border-gray-300">
              <div className="font-bold text-[10px] text-gray-400 uppercase tracking-widest mb-1.5">Status Pembayaran</div>
              <div className="mb-0.5"><span className="text-gray-500">Status: </span><strong>✓ LUNAS</strong></div>
              {inv.invoice.paidAt && (
                <>
                  <div className="mb-0.5"><span className="text-gray-500">Dibayar pada: </span>{inv.invoice.paidAt}</div>
                  <div className="mb-0.5"><span className="text-gray-500">Via: </span>{inv.paidVia === 'gateway' ? 'Payment Gateway' : inv.paidVia === 'transfer' ? 'Transfer Manual' : 'Dikonfirmasi Admin'}</div>
                </>
              )}
            </div>
          </div>

          <div className="font-bold text-[10px] text-gray-400 uppercase tracking-widest mb-1.5 mt-6">Rincian Layanan</div>
          <table className="w-full border-collapse mb-4 table-fixed">
            <thead>
              <tr>
                <th className="bg-black text-white px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider rounded-tl-lg">Deskripsi</th>
                <th className="bg-black text-white px-3 py-2 text-center text-[11px] font-bold uppercase tracking-wider w-16">Qty</th>
                <th className="bg-black text-white px-3 py-2 text-right text-[11px] font-bold uppercase tracking-wider w-28">Harga</th>
                <th className="bg-black text-white px-3 py-2 text-right text-[11px] font-bold uppercase tracking-wider w-32 rounded-tr-lg">Total</th>
              </tr>
            </thead>
            <tbody>
              {inv.items.map((item: any, i: number) => (
                <tr key={i}>
                  <td className="p-2 text-[11px] border-b border-gray-100 print:border-gray-300">{item.description}</td>
                  <td className="p-2 text-[11px] border-b border-gray-100 print:border-gray-300 text-center">{item.quantity}</td>
                  <td className="p-2 text-[11px] border-b border-gray-100 print:border-gray-300 text-right">{fmtCurr(item.price)}</td>
                  <td className="p-2 text-[11px] border-b border-gray-100 print:border-gray-300 text-right">{fmtCurr(item.total)}</td>
                </tr>
              ))}
              {inv.additionalFees && inv.additionalFees.map((fee: any, i: number) => (
                <tr key={'fee'+i}>
                  <td className="p-2 text-[11px] border-b border-gray-100 print:border-gray-300">{fee.name}</td>
                  <td className="p-2 text-[11px] border-b border-gray-100 print:border-gray-300 text-center">1</td>
                  <td className="p-2 text-[11px] border-b border-gray-100 print:border-gray-300 text-right">{fmtCurr(fee.amount)}</td>
                  <td className="p-2 text-[11px] border-b border-gray-100 print:border-gray-300 text-right">{fmtCurr(fee.amount)}</td>
                </tr>
              ))}
              {inv.tax.hasTax && (
                <>
                  <tr className="bg-gray-50 print:bg-transparent">
                    <td colSpan={3} className="text-right text-[11px] text-gray-500 p-1.5 px-2.5">Subtotal</td>
                    <td className="text-right text-[11px] text-gray-500 p-1.5 px-2.5">{fmtCurr(inv.tax.baseAmount)}</td>
                  </tr>
                  <tr className="bg-amber-50 print:bg-transparent">
                    <td colSpan={3} className="text-right text-[11px] text-amber-600 p-1.5 px-2.5">PPN {inv.tax.taxRate}%</td>
                    <td className="text-right text-[11px] text-amber-600 p-1.5 px-2.5">{fmtCurr(inv.tax.taxAmount)}</td>
                  </tr>
                </>
              )}
              <tr>
                <td colSpan={3} className="text-right font-bold text-[13px] bg-red-50 border-t-2 border-red-600 print:bg-transparent print:border-t-[2px] print:border-red-700 p-2 text-gray-900" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>TOTAL</td>
                <td className="text-right font-bold text-[13px] bg-red-50 border-t-2 border-red-600 print:bg-transparent print:border-t-[2px] print:border-red-700 p-2 text-gray-900" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>{inv.amountFormatted}</td>
              </tr>
            </tbody>
          </table>

          <div className="flex justify-between items-end mt-10">
            <div className="flex items-center gap-6">
              {/* LUNAS Stamp */}
              <div className="inline-block p-3 px-7 border-[4px] border-emerald-500 rounded-xl text-center w-fit print:border-emerald-600">
                <div className="text-[24px] font-bold text-emerald-500 tracking-[6px] print:text-emerald-600" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>LUNAS</div>
                <div className="text-[11px] text-gray-500 mt-0.5">Dibayar pada {inv.invoice.paidAt}</div>
              </div>
              
              {/* QR Code for Payment Link (Online Receipt) */}
              {inv.paymentLink && (
                <div className="flex flex-col items-center ml-10">
                  <QRCodeSVG value={inv.paymentLink} size={80} level="M" includeMargin={true} className="border border-gray-200 rounded-lg p-1" />
                  <div className="text-[9px] mt-1.5 text-gray-500 font-medium">Scan untuk e-receipt</div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-7 text-center text-gray-400 text-[10px] border-t border-gray-200 pt-4 pb-4">
          Terima kasih atas kepercayaan Anda &mdash; {inv.company.name}
          {inv.company.poweredBy && (
            <div className="mt-1 text-[9px]">Support by {inv.company.poweredBy}</div>
          )}
        </div>
      </div>
    </div>
  );
}
