'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';

export default function DownloadPdfButton({ invoiceNumber }: { invoiceNumber: string }) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = `/invoice/${invoiceNumber}/pdf`;
    a.download = `Invoice-${invoiceNumber}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <button 
      onClick={handleDownload} 
      className="flex-1 max-w-[150px] bg-[var(--color-paper-2)] text-[var(--color-ink)] border border-[var(--color-rule)] font-bold text-[13px] py-3 rounded-xl hover:bg-[var(--color-paper)] transition-colors flex items-center justify-center gap-2"
    >
      <Download className="w-4 h-4" />
      Simpan PDF
    </button>
  );
}
