'use client';

import { useState, useEffect, useCallback } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { downloadVisibleInvoiceAsPdf } from '@/lib/client-pdf-downloader';

export default function DownloadPdfButton({ 
  invoiceNumber, 
  autoTrigger = false,
  variant = 'default',
  label = 'Unduh PDF',
}: { 
  invoiceNumber: string;
  autoTrigger?: boolean;
  variant?: 'default' | 'primary';
  label?: string;
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

  const isPrimary = variant === 'primary';

  return (
    <div className="flex flex-col items-center flex-1 max-w-[170px]">
      <button 
        onClick={handleDownload}
        disabled={isDownloading}
        className={`w-full font-bold text-[13px] py-3 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-60 shadow-sm cursor-pointer ${
          isPrimary
            ? 'bg-[#002C60] text-white hover:bg-[#1b437c] border border-transparent shadow-md'
            : 'bg-white text-gray-800 border border-gray-300 hover:bg-gray-50'
        }`}
      >
        {isDownloading ? (
          <>
            <Loader2 className={`w-4 h-4 animate-spin shrink-0 ${isPrimary ? 'text-white' : 'text-blue-600'}`} />
            <span className={isPrimary ? 'text-white' : 'text-blue-600'}>Membuat PDF...</span>
          </>
        ) : (
          <>
            <Download className={`w-4 h-4 shrink-0 ${isPrimary ? 'text-white' : 'text-gray-700'}`} />
            <span>{label}</span>
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
