'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Info, ChevronLeft } from 'lucide-react';
import { CyberCard, CyberButton } from '@/components/cyberpunk';

export const dynamic = 'force-dynamic';

export default function RenewalPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('customer_token');
    if (!token) {
      router.push('/customer/login');
      return;
    }
    setLoading(false);
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-3 lg:p-6 space-y-4 w-full">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/customer')} className="p-2 rounded-xl hover:bg-muted/20 border border-border/40 transition">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-primary drop-shadow-[0_0_5px_rgba(188,19,254,0.5)]">Perpanjang Langganan</h1>
          <p className="text-xs text-accent mt-0.5">Sistem tagihan otomatis</p>
        </div>
      </div>

      <CyberCard className="p-6 bg-card/80 backdrop-blur-xl border-2 border-primary/30 shadow-[0_0_25px_rgba(188,19,254,0.15)] text-center space-y-4">
        <Info className="w-12 h-12 mx-auto text-primary animate-pulse" />
        <h2 className="text-base font-bold text-foreground">Perpanjangan Mandiri Dinonaktifkan</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
          Layanan Anda menggunakan sistem tagihan bulanan otomatis. Tagihan baru akan diterbitkan secara otomatis setiap bulannya sebelum masa aktif berakhir. Silakan cek menu **Tagihan Aktif** untuk melakukan pembayaran.
        </p>
        <div className="pt-2">
          <CyberButton onClick={() => router.push('/customer/invoices')} variant="cyan" className="mx-auto px-6 py-2.5 text-xs font-bold">
            Cek Tagihan Aktif
          </CyberButton>
        </div>
      </CyberCard>
    </div>
  );
}
