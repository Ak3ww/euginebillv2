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
      const element = document.getElementById('invoice-capture-area');
      if (element) {
        await downloadVisibleInvoiceAsPdf(element, `Invoice-${invoiceNumber}.pdf`);
      } else {
        // Element not in DOM — navigate to invoice page with autoDownload flag
        // Uses location.href (same-tab) to keep WebView compatibility
        window.location.href = `/invoice/${invoiceNumber}?autoDownload=true`;
        return; // Don't reset isDownloading since we're navigating away
      }
    } catch (err) {
      console.error('PDF download error:', err);
      setError('Gagal mengunduh PDF. Coba lagi.');
    } finally {
      setIsDownloading(false);
    }
  }, [invoiceNumber]);

  useEffect(() => {
    if (autoTrigger) {
      // Wait 1500ms for the page + images + fonts to fully render
      const timer = setTimeout(() => {
        handleDownload();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [autoTrigger, handleDownload]);

  return (
    <div className="flex flex-col items-center flex-1 max-w-[160px]">
      <button 
        onClick={handleDownload}
        disabled={isDownloading}
        className="w-full bg-white text-gray-800 border border-gray-300 font-bold text-[13px] py-3 rounded-xl hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
      >
        {isDownloading ? <Loader2 className="w-4 h-4 animate-spin text-blue-600" /> : <Download className="w-4 h-4 text-gray-700" />}
        {isDownloading ? 'Mengolah...' : 'Unduh PDF'}
      </button>
      {error && (
        <button 
          onClick={handleDownload}
          className="mt-1 text-[10px] text-red-500 hover:text-red-700 underline"
        >
          {error}
        </button>
      )}
    </div>
  );
}
