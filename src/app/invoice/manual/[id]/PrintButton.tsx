'use client';

import { Printer } from 'lucide-react';

export default function ManualInvoicePrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="flex-1 max-w-[120px] bg-white text-gray-700 border border-gray-300 font-bold text-[13px] py-3 rounded-xl hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 shadow-sm"
    >
      <Printer className="w-4 h-4" />
      Cetak
    </button>

  );
}
