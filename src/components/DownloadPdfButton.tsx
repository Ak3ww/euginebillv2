'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';

export default function DownloadPdfButton({ invoiceNumber }: { invoiceNumber: string }) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = () => {
    setIsDownloading(true);
    try {
      const link = document.createElement('a');
      link.href = `/invoice/${invoiceNumber}/pdf`;
      link.download = `Invoice-${invoiceNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Download error:', err);
    } finally {
      setTimeout(() => setIsDownloading(false), 1200);
    }
  };

  return (
    <button 
      onClick={handleDownload}
      disabled={isDownloading}
      className="flex-1 max-w-[160px] bg-[var(--color-paper-2)] text-[var(--color-ink)] border border-[var(--color-rule)] font-bold text-[13px] py-3 rounded-xl hover:bg-[var(--color-paper)] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
    >
      {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
      {isDownloading ? 'Mengunduh...' : 'Simpan PDF'}
    </button>
  );
}
