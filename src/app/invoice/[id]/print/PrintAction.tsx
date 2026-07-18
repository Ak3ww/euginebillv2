'use client';
import { useEffect, useState } from 'react';
import { Printer, Home } from 'lucide-react';

export default function PrintAction() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    setTimeout(() => {
      window.print();
    }, 500);
  }, []);

  if (!isClient) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-md border-t border-gray-200 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] z-50 flex justify-center no-print">
      <div className="w-full max-w-[210mm] flex gap-3">
        <button 
          onClick={() => window.print()} 
          className="flex-1 max-w-[150px] bg-white text-gray-700 border border-gray-300 font-bold text-[13px] py-3 rounded-xl hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
        >
          <Printer className="w-4 h-4" />
          Simpan / Cetak
        </button>
        
        <button 
          onClick={() => window.location.href = '/customer'}
          className="flex-1 bg-black text-white font-bold text-[14px] py-3 rounded-xl hover:bg-neutral-800 transition-colors flex items-center justify-center gap-2"
        >
          <Home className="w-5 h-5" />
          Kembali ke Beranda
        </button>
      </div>
    </div>
  );
}
