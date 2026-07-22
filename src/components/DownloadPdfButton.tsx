'use client';

import { useState, useEffect, useCallback } from 'react';
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
  const [error, setError] = useState<string | null>(null);

  const handleDownload = useCallback(async () => {
    setIsDownloading(true);
    setError(null);
    try {
      // 1. Try vector server PDF generation first (100% 1:1 match, crisp text, instant download)
      const res = await fetch(`/invoice/${invoiceNumber}/pdf`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Invoice-${invoiceNumber}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return;
      }

      // 2. Fallback to client-side DOM capture if server fetch failed
      const element = document.getElementById('invoice-capture-area');
      if (element) {
        await downloadVisibleInvoiceAsPdf(element, `Invoice-${invoiceNumber}.pdf`);
      } else {
        window.location.href = `/invoice/${invoiceNumber}?autoDownload=true`;
      }
    } catch (err) {
      console.error('PDF download error:', err);
      try {
        const element = document.getElementById('invoice-capture-area');
        if (element) {
          await downloadVisibleInvoiceAsPdf(element, `Invoice-${invoiceNumber}.pdf`);
        } else {
          setError('Gagal mengunduh PDF. Coba lagi.');
        }
      } catch {
        setError('Gagal mengunduh PDF. Coba lagi.');
      }
    } finally {
      setIsDownloading(false);
    }
  }, [invoiceNumber]);

  useEffect(() => {
    if (autoTrigger) {
      const timer = setTimeout(() => {
        handleDownload();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [autoTrigger, handleDownload]);

  return (
    <div className="flex flex-col items-center flex-1 max-w-[170px]">
      <button 
        onClick={handleDownload}
        disabled={isDownloading}
        className="w-full bg-white text-gray-800 border border-gray-300 font-bold text-[13px] py-3 rounded-xl hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-60 shadow-sm cursor-pointer"
      >
        {isDownloading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin text-blue-600 shrink-0" />
            <span className="text-blue-600">Membuat PDF...</span>
          </>
        ) : (
          <>
            <Download className="w-4 h-4 text-gray-700 shrink-0" />
            <span>Unduh PDF</span>
          </>
        )}
      </button>
      {error && (
        <button 
          onClick={handleDownload}
          className="mt-1.5 text-[10px] text-red-500 hover:text-red-700 underline"
        >
          {error}
        </button>
      )}
    </div>
  );
}
