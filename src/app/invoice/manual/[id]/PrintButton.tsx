'use client';

import { useEffect } from 'react';
import { Printer } from 'lucide-react';

export default function ManualInvoicePrintButton({ autoPrint = false }: { autoPrint?: boolean }) {
  useEffect(() => {
    if (autoPrint) {
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [autoPrint]);

  return (
    <button
      onClick={() => window.print()}
      className="bg-[#002C60] text-white font-bold text-[13px] px-6 py-3 rounded-xl hover:bg-[#1b437c] transition-colors flex items-center justify-center gap-2 shadow-md cursor-pointer"
    >
      <Printer className="w-4 h-4" />
      Cetak
    </button>
  );
}
