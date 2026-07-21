'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';

export default function DownloadPdfButton({ invoiceNumber }: { invoiceNumber: string }) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleDownload = async () => {
    setIsGenerating(true);
    try {
      let element = document.getElementById('invoice-capture-area');
      let iframe: HTMLIFrameElement | null = null;

      if (!element) {
        iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.top = '0';
        iframe.style.left = '0';
        iframe.style.width = '800px';
        iframe.style.height = '1200px';
        iframe.style.opacity = '0.01';
        iframe.style.pointerEvents = 'none';
        iframe.style.zIndex = '-9999';
        iframe.src = `/invoice/${invoiceNumber}`;
        document.body.appendChild(iframe);

        await new Promise((resolve) => {
          iframe!.onload = resolve;
        });

        // Wait 1000ms for Tailwind styles, logo images & QR codes to settle
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        element = iframeDoc?.getElementById('invoice-capture-area') || null;
      }

      if (!element) {
        window.location.href = `/invoice/${invoiceNumber}/pdf`;
        return;
      }

      // @ts-ignore
      const html2pdf = (await import('html2pdf.js')).default;
      const opt = {
        margin: [5, 5, 5, 5],
        filename: `Invoice-${invoiceNumber}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2, 
          useCORS: true, 
          allowTaint: true,
          logging: false,
          windowWidth: 800
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      await html2pdf().set(opt).from(element).save();

      if (iframe && document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    } catch (err) {
      console.error('PDF generation error:', err);
      window.location.href = `/invoice/${invoiceNumber}/pdf`;
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <button 
      onClick={handleDownload}
      disabled={isGenerating}
      className="flex-1 max-w-[160px] bg-[var(--color-paper-2)] text-[var(--color-ink)] border border-[var(--color-rule)] font-bold text-[13px] py-3 rounded-xl hover:bg-[var(--color-paper)] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
    >
      {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
      {isGenerating ? 'Mengunduh...' : 'Simpan PDF'}
    </button>
  );
}
