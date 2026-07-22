'use client';

import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

export interface InvoiceTemplateData {
  company: {
    name: string;
    address?: string;
    phone?: string;
    email?: string;
    logo?: string;
    poweredBy?: string;
  };
  customer: {
    name: string;
    customerId?: string;
    phone?: string;
    address?: string;
  };
  invoice: {
    number: string;
    date: string;
    dueDate: string;
    paidAt?: string | null;
    status: string;
  };
  paidVia?: string | null;
  destinationBank?: string | null;
  items: Array<{
    description: string;
    quantity: number;
    price: number;
    total: number;
  }>;
  additionalFees?: Array<{
    name?: string;
    description?: string;
    amount?: number;
    price?: number;
  }>;
  tax: {
    hasTax: boolean;
    taxRate: number;
    baseAmount: number;
    taxAmount: number;
  };
  amountFormatted: string;
  paymentLink?: string;
}

function fmtCurr(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
}

export default function InvoiceTemplate({ data }: { data: InvoiceTemplateData }) {
  const isPaid = data.invoice.status === 'PAID';
  const isOverdue = data.invoice.status === 'OVERDUE';

  return (
    <div 
      id="invoice-capture-area" 
      className="w-full max-w-[794px] min-h-[1123px] bg-white mx-auto shadow-xl border border-gray-200 flex flex-col justify-between relative overflow-hidden text-gray-900 font-sans print:shadow-none print:border-none print:w-[210mm] print:min-h-[297mm] print:m-0 print:p-0"
    >
      {/* Oceanic Blue Top Brand Banner (Standard A4 Top Accent) */}
      <div 
        className="h-3.5 bg-gradient-to-r from-[#002c60] via-[#003875] to-[#1b437c] w-full shrink-0" 
        style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }} 
      />

      <div className="p-8 sm:p-10 flex-1 relative flex flex-col justify-between">
        {/* Full-Color Translucent Background Watermark */}
        {data.company.logo && (
          <div className="absolute inset-0 flex items-center justify-center opacity-[0.06] pointer-events-none z-0 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src={data.company.logo} 
              className="w-[80%] max-w-[650px] object-contain -rotate-12 scale-125" 
              alt="Watermark" 
            />
          </div>
        )}

        <div className="relative z-10 flex-1 flex flex-col justify-between">
          <div>
            {/* Header Section: Logo & Company Name vs INVOICE Title & Status */}
            <div className="flex flex-row justify-between items-start mb-6 gap-4">
              <div className="flex items-center gap-4">
                {data.company.logo && (
                  <div className="w-16 h-16 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center p-2 shadow-sm shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={data.company.logo} className="max-h-12 max-w-12 w-auto object-contain" alt="Logo" />
                  </div>
                )}
                <div>
                  <div className="text-xl font-extrabold text-gray-900 leading-tight">{data.company.name}</div>
                  <div className="text-gray-500 mt-1 text-[10.5px] leading-[1.5]">
                    {data.company.address && <span dangerouslySetInnerHTML={{ __html: data.company.address }} />}
                    {data.company.address && <br />}
                    {data.company.phone && <span>Telp: {data.company.phone}</span>}
                    {data.company.phone && <br />}
                    {data.company.email}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-[26px] font-black text-gray-900 tracking-[2px] leading-tight">INVOICE</div>
                <div className="text-[13px] font-bold text-red-600 my-1 leading-tight">{data.invoice.number}</div>
                <div className="mt-1.5">
                  {isPaid ? (
                    <span className="inline-block px-3 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 print:border-emerald-500" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                      ✓ SUDAH BAYAR
                    </span>
                  ) : isOverdue ? (
                    <span className="inline-block px-3 py-1 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-300 print:border-red-500" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                      ⚠️ TERLAMBAT
                    </span>
                  ) : (
                    <span className="inline-block px-3 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 print:border-amber-500" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                      BELUM BAYAR
                    </span>
                  )}
                </div>
              </div>
            </div>

            <hr className="border-t-[3px] border-black my-5" />

            {/* Grid Information Card 1: DARI vs KEPADA (2 Columns) */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-[#f9fafb] border border-gray-200 rounded-xl p-4">
                <div className="font-bold text-[9.5px] text-gray-400 uppercase tracking-widest mb-1">Dari</div>
                <div className="mb-0.5 font-bold text-gray-900 text-xs">{data.company.name}</div>
                {data.company.address && <div className="mb-0.5 text-gray-600 text-[10.5px]">{data.company.address}</div>}
                {data.company.phone && <div className="mb-0.5 text-gray-600 text-[10.5px]">Telp: {data.company.phone}</div>}
              </div>
              <div className="bg-[#f9fafb] border border-gray-200 rounded-xl p-4">
                <div className="font-bold text-[9.5px] text-gray-400 uppercase tracking-widest mb-1">Kepada</div>
                <div className="mb-0.5 font-bold text-gray-900 text-xs">{data.customer.name}</div>
                {data.customer.customerId && <div className="mb-0.5 text-gray-600 text-[10.5px]"><span className="text-gray-400">ID Pelanggan: </span>{data.customer.customerId}</div>}
                {data.customer.phone && <div className="mb-0.5 text-gray-600 text-[10.5px]"><span className="text-gray-400">Telp: </span>{data.customer.phone}</div>}
                {data.customer.address && <div className="mb-0.5 text-gray-600 text-[10.5px]"><span className="text-gray-400">Alamat: </span>{data.customer.address}</div>}
              </div>
            </div>

            {/* Grid Information Card 2: DETAIL INVOICE vs STATUS PEMBAYARAN (2 Columns) */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-[#f9fafb] border border-gray-200 rounded-xl p-4">
                <div className="font-bold text-[9.5px] text-gray-400 uppercase tracking-widest mb-1">Detail Invoice</div>
                <div className="mb-0.5 text-gray-700 text-[10.5px]"><span className="text-gray-400">No Invoice: </span><strong>{data.invoice.number}</strong></div>
                <div className="mb-0.5 text-gray-700 text-[10.5px]"><span className="text-gray-400">Tanggal: </span>{data.invoice.date}</div>
                <div className="mb-0.5 text-gray-700 text-[10.5px]"><span className="text-gray-400">Jatuh Tempo: </span>{data.invoice.dueDate}</div>
                {data.invoice.paidAt && <div className="mb-0.5 text-gray-700 text-[10.5px]"><span className="text-gray-400">Tgl Bayar: </span>{data.invoice.paidAt}</div>}
              </div>
              <div className="bg-[#f9fafb] border border-gray-200 rounded-xl p-4">
                <div className="font-bold text-[9.5px] text-gray-400 uppercase tracking-widest mb-1">Status Pembayaran</div>
                <div className="mb-0.5 text-gray-700 text-[10.5px]"><span className="text-gray-400">Status: </span><strong>{isPaid ? '✓ LUNAS' : isOverdue ? '⚠️ TERLAMBAT' : 'BELUM BAYAR'}</strong></div>
                {data.invoice.paidAt && (
                  <>
                    <div className="mb-0.5 text-gray-700 text-[10.5px]"><span className="text-gray-400">Dibayar pada: </span>{data.invoice.paidAt}</div>
                    <div className="mb-0.5 text-gray-700 text-[10.5px]"><span className="text-gray-400">Via: </span>{data.paidVia === 'gateway' ? 'Payment Gateway' : data.paidVia === 'transfer' ? `Transfer Manual ${data.destinationBank ? `(ke ${data.destinationBank})` : ''}` : 'Dikonfirmasi Admin'}</div>
                  </>
                )}
              </div>
            </div>

            {/* Rincian Layanan Table */}
            <div className="font-bold text-[9.5px] text-gray-400 uppercase tracking-widest mb-2">Rincian Layanan</div>
            <div className="w-full mb-6">
              <table className="w-full border-collapse table-fixed">
                <thead>
                  <tr>
                    <th className="bg-black text-white px-4 py-3 text-left text-[10.5px] font-bold uppercase tracking-wider rounded-tl-lg" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>Deskripsi</th>
                    <th className="bg-black text-white px-4 py-3 text-center text-[10.5px] font-bold uppercase tracking-wider w-16" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>Qty</th>
                    <th className="bg-black text-white px-4 py-3 text-right text-[10.5px] font-bold uppercase tracking-wider w-32" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>Harga</th>
                    <th className="bg-black text-white px-4 py-3 text-right text-[10.5px] font-bold uppercase tracking-wider w-36 rounded-tr-lg" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item, i) => (
                    <tr key={i}>
                      <td className="p-3 text-[11px] border-b border-gray-200 text-gray-800">{item.description}</td>
                      <td className="p-3 text-[11px] border-b border-gray-200 text-center text-gray-800">{item.quantity}</td>
                      <td className="p-3 text-[11px] border-b border-gray-200 text-right text-gray-800">{fmtCurr(item.price)}</td>
                      <td className="p-3 text-[11px] border-b border-gray-200 text-right text-gray-800">{fmtCurr(item.total)}</td>
                    </tr>
                  ))}
                  {data.additionalFees && data.additionalFees.map((fee, i) => (
                    <tr key={'fee' + i}>
                      <td className="p-3 text-[11px] border-b border-gray-200 text-gray-800">{fee.name || fee.description || 'Biaya Tambahan'}</td>
                      <td className="p-3 text-[11px] border-b border-gray-200 text-center text-gray-800">1</td>
                      <td className="p-3 text-[11px] border-b border-gray-200 text-right text-gray-800">{fmtCurr(fee.amount || fee.price || 0)}</td>
                      <td className="p-3 text-[11px] border-b border-gray-200 text-right text-gray-800">{fmtCurr(fee.amount || fee.price || 0)}</td>
                    </tr>
                  ))}
                  {data.tax.hasTax && (
                    <>
                      <tr className="bg-gray-50">
                        <td colSpan={3} className="text-right text-[10.5px] text-gray-500 p-2.5">Subtotal</td>
                        <td className="text-right text-[10.5px] text-gray-500 p-2.5">{fmtCurr(data.tax.baseAmount)}</td>
                      </tr>
                      <tr className="bg-gray-50">
                        <td colSpan={3} className="text-right text-[10.5px] text-gray-500 p-2.5">PPN {data.tax.taxRate}%</td>
                        <td className="text-right text-[10.5px] text-gray-500 p-2.5">{fmtCurr(data.tax.taxAmount)}</td>
                      </tr>
                    </>
                  )}
                  {/* Highlighted Red Total Box (Exact Match) */}
                  <tr>
                    <td colSpan={3} className="text-right font-bold text-[13px] bg-red-50 border-t-2 border-red-600 p-3 text-gray-900" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>TOTAL</td>
                    <td className="text-right font-bold text-[13px] bg-red-50 border-t-2 border-red-600 p-3 text-red-600" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>{data.amountFormatted}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Stamp LUNAS & QR Code Section */}
            {isPaid && (
              <div className="flex flex-row justify-between items-center mt-6">
                <div className="inline-block p-3.5 px-8 border-[4px] border-emerald-500 rounded-xl text-center w-fit">
                  <div className="text-[22px] font-extrabold text-emerald-600 tracking-[5px]" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>LUNAS</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">Dibayar pada {data.invoice.paidAt}</div>
                </div>

                {data.paymentLink && (
                  <div className="flex flex-col items-center">
                    <QRCodeSVG value={data.paymentLink} size={72} level="M" includeMargin={true} className="border border-gray-200 rounded-lg p-1 bg-white" />
                    <div className="text-[8.5px] mt-1 text-gray-400 font-medium">Scan untuk e-receipt</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer Note */}
          <div className="mt-8 text-center text-gray-400 text-[9.5px] border-t border-gray-200 pt-4 pb-2">
            Terima kasih atas kepercayaan Anda &mdash; {data.company.name}
            {data.company.poweredBy && (
              <div className="mt-0.5 text-[8.5px]">Support by {data.company.poweredBy}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
