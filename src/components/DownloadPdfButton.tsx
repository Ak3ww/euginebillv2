'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';

export default function DownloadPdfButton({ invoiceNumber }: { invoiceNumber: string }) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleDownload = async () => {
    try {
      setIsGenerating(true);
      const html2pdfModule = await import('html2pdf.js');
      const html2pdf = html2pdfModule.default || html2pdfModule;
      
      const element = document.getElementById('invoice-capture-area');
      if (!element) throw new Error('Invoice container not found');

      const opt = {
        margin:       [10, 0], // Top/Bottom margin 10mm
        filename:     `Invoice-${invoiceNumber}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      await html2pdf().set(opt).from(element).save();
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      alert('Gagal membuat PDF. Silakan coba Cetak A4 sebagai alternatif.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <button 
      onClick={handleDownload} 
      disabled={isGenerating}
      className="flex-1 max-w-[150px] bg-[var(--color-paper-2)] text-[var(--color-ink)] border border-[var(--color-rule)] font-bold text-[13px] py-3 rounded-xl hover:bg-[var(--color-paper)] transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isGenerating ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Download className="w-4 h-4" />
      )}
      Simpan PDF
    </button>
  );
}
