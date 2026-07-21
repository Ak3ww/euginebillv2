'use client';

import { useState, useEffect } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { downloadVisibleInvoiceAsPdf } from '@/lib/client-pdf-downloader';

export default function DownloadPdfButton({ 
  invoiceNumber, 
  autoTrigger = false 
}: { 
  invoiceNumber: string;
  autoTrigger?: boolean;
}) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const element = document.getElementById('invoice-capture-area');
      if (element) {
        await downloadVisibleInvoiceAsPdf(element, `Invoice-${invoiceNumber}.pdf`);
      } else {
        // Redirect to invoice page with autoDownload query if element not in DOM
        window.location.href = `/invoice/${invoiceNumber}?autoDownload=true`;
      }
    } catch (err) {
      console.error('Download error:', err);
      // Silent direct file download fallback (No Print Popup!)
      const link = document.createElement('a');
      link.href = `/invoice/${invoiceNumber}/pdf`;
      link.download = `Invoice-${invoiceNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setIsDownloading(false);
    }
  };

  useEffect(() => {
    if (autoTrigger) {
      const timer = setTimeout(() => {
        handleDownload();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [autoTrigger]);

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
