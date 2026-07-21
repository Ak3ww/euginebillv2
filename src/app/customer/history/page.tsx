'use client';
import { useRouter } from 'next/navigation';

export default function HistoryPage() {
  const router = useRouter();
  
  return (
    <main className="max-w-[1280px] mx-auto px-4 md:px-8 py-6">
      <button 
        onClick={() => router.push('/customer')}
        className="flex items-center gap-1.5 text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors font-mono text-[10px] uppercase tracking-wider font-bold mb-6"
      >
        <span className="material-symbols-outlined text-[16px]">arrow_back</span>
        Kembali
      </button>
      <div className="text-center py-20 text-[var(--color-muted)]">
        Belum ada riwayat transaksi yang dapat ditampilkan.
      </div>
    </main>
  );
}
