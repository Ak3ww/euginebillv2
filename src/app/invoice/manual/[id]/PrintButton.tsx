'use client';

import { Printer } from 'lucide-react';

export default function ManualInvoicePrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
    >
      <Printer className="h-4 w-4" />
      Print
    </button>
  );
}
