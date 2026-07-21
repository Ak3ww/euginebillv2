'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { downloadWebInvoiceAsPdf } from '@/lib/client-pdf-downloader';

export default function DownloadPdfButton({ invoiceNumber }: { invoiceNumber: string }) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const element = document.getElementById('invoice-capture-area');
      if (element) {
        // High-DPI 100.0% exact visual DOM capture of the web invoice
        await downloadWebInvoiceAsPdf(element, `Invoice-${invoiceNumber}.pdf`);
      } else {
        // Fallback direct download link
        const link = document.createElement('a');
        link.href = `/invoice/${invoiceNumber}/pdf`;
        link.download = `Invoice-${invoiceNumber}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      console.error('Download error:', err);
      // Fallback
      window.open(`/invoice/${invoiceNumber}/pdf`, '_blank');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <button 
      onClick={handleDownload}
      disabled={isDownloading}
      className="flex-1 max-w-[160px] bg-white text-gray-800 border border-gray-300 font-bold text-[13px] py-3 rounded-xl hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
    >
      {isDownloading ? <Loader2 className="w-4 h-4 animate-spin text-red-600" /> : <Download className="w-4 h-4 text-gray-700" />}
      {isDownloading ? 'Mengolah PDF...' : 'Simpan PDF'}
    </button>
  );
}
