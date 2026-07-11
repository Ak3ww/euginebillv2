import { prisma } from '@/server/db/client';
import { notFound } from 'next/navigation';
import { Building2, Mail, MapPin, Phone, Printer } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import PrintButton from './PrintButton';

export const metadata = {
  title: 'Invoice',
};

export default async function PublicInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  const invoice = await prisma.invoice.findUnique({
    where: { invoiceNumber: id },
    include: {
      user: {
        include: { profile: true, area: true }
      },
      payment: true,
    }
  });

  if (!invoice) notFound();

  const company = await prisma.company.findFirst();

  const isPaid = invoice.status === 'PAID';
  const dueDateStr = new Date(invoice.dueDate).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta'
  });
  const createdDateStr = new Date(invoice.createdAt).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta'
  });

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8 print:bg-white print:p-0">
      <div className="max-w-3xl mx-auto">
        {/* Action Bar (hidden when printing) */}
        <div className="mb-6 flex justify-between items-center print:hidden bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <Link href="/" className="text-primary hover:underline text-sm font-medium">
            &larr; Kembali ke Beranda
          </Link>
          <div className="flex items-center gap-3">
            {!isPaid && (
              <Link 
                href={invoice.paymentToken ? `/pay-manual?token=${invoice.paymentToken}` : '#'} 
                className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Bayar Sekarang
              </Link>
            )}
            <PrintButton />
          </div>
        </div>

        {/* Invoice Paper */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden print:shadow-none print:rounded-none">
          <div className="p-8 sm:p-12">
            
            {/* Header section */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-10 border-b border-gray-100 pb-10">
              <div className="flex items-center gap-4">
                {company?.logo ? (
                  <Image src={company.logo} alt="Company Logo" width={64} height={64} className="rounded-lg object-contain" />
                ) : (
                  <div className="w-16 h-16 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
                    <Building2 className="w-8 h-8" />
                  </div>
                )}
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{company?.name || 'EugineBill RADIUS'}</h1>
                  <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {company?.address || 'Alamat belum diatur'}
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mt-2 text-xs text-gray-500">
                    {company?.phone && (
                      <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {company.phone}</span>
                    )}
                    {company?.email && (
                      <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {company.email}</span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="text-left sm:text-right">
                <h2 className="text-3xl font-black text-gray-800 tracking-tight uppercase">INVOICE</h2>
                <p className="text-sm text-gray-500 mt-1 font-mono">{invoice.invoiceNumber}</p>
                <div className={`mt-3 inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                  isPaid ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                }`}>
                  {isPaid ? 'LUNAS' : 'BELUM LUNAS'}
                </div>
              </div>
            </div>

            {/* Bill To & Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-10 mb-10">
              <div>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Tagihan Kepada:</h3>
                <div className="text-gray-800 font-semibold text-lg">{invoice.user?.name || 'Pelanggan'}</div>
                <div className="text-gray-500 text-sm mt-1">{invoice.user?.username}</div>
                {invoice.user?.address && (
                  <div className="text-gray-500 text-sm mt-1 max-w-xs leading-relaxed">{invoice.user.address}</div>
                )}
                {invoice.user?.phone && (
                  <div className="text-gray-500 text-sm mt-1">{invoice.user.phone}</div>
                )}
              </div>
              
              <div className="space-y-4">
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <span className="text-gray-500 text-sm">Tanggal Invoice:</span>
                  <span className="text-gray-800 font-medium text-sm">{createdDateStr}</span>
                </div>
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <span className="text-gray-500 text-sm">Jatuh Tempo:</span>
                  <span className="text-gray-800 font-medium text-sm">{dueDateStr}</span>
                </div>
                {isPaid && invoice.paidAt && (
                  <div className="flex justify-between border-b border-gray-100 pb-2">
                    <span className="text-gray-500 text-sm">Tanggal Lunas:</span>
                    <span className="text-green-600 font-medium text-sm">
                      {new Date(invoice.paidAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Items Table */}
            <div className="mb-10 rounded-xl overflow-hidden border border-gray-200">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
                    <th className="py-4 px-6 font-semibold">Deskripsi Layanan</th>
                    <th className="py-4 px-6 font-semibold text-right">Jumlah</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {/* Subscription Line */}
                  <tr>
                    <td className="py-5 px-6">
                      <div className="font-medium text-gray-800">Langganan Internet ({new Date(invoice.dueDate).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })})</div>
                      <div className="text-gray-500 text-xs mt-1">{invoice.user?.profile?.name || 'Paket Internet'}</div>
                    </td>
                    <td className="py-5 px-6 text-right font-medium text-gray-800">
                      Rp {invoice.amount.toLocaleString('id-ID')}
                    </td>
                  </tr>
                  
                  {/* Additional Fees */}
                  {invoice.additionalFees && typeof invoice.additionalFees === 'object' && (invoice.additionalFees as any).items?.map((item: any, idx: number) => (
                    <tr key={idx}>
                      <td className="py-5 px-6">
                        <div className="font-medium text-gray-800">{item.name}</div>
                      </td>
                      <td className="py-5 px-6 text-right font-medium text-gray-800">
                        Rp {Number(item.amount).toLocaleString('id-ID')}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50/50">
                  <tr>
                    <td className="py-4 px-6 font-bold text-gray-800 text-right">TOTAL TAGIHAN</td>
                    <td className="py-4 px-6 font-bold text-gray-900 text-right text-lg">
                      Rp {invoice.amount.toLocaleString('id-ID')}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            
            {/* Footer Notes */}
            <div className="border-t border-gray-100 pt-8 mt-12 flex flex-col sm:flex-row justify-between items-center text-center sm:text-left text-xs text-gray-400">
              <p>Terima kasih atas kepercayaan Anda menggunakan layanan kami.</p>
              <p className="mt-2 sm:mt-0 font-mono">ID: {invoice.id.substring(0,8)}</p>
            </div>
            
          </div>
        </div>
      </div>
    </div>
  );
}
