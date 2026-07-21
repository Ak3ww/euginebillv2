'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/components/cyberpunk/CyberToast';
import { formatWIB } from '@/lib/timezone';

export const dynamic = 'force-dynamic';

interface Invoice {
  id: string;
  invoiceNumber: string;
  amount: number;
  status: string;
  dueDate: string;
  paidAt: string | null;
  paymentToken: string | null;
  paymentLink: string | null;
  createdAt: string;
  invoiceType: string;
  profileName: string | null;
  paymentSource: string | null;
  manualPaymentStatus: string | null;
  manualPaymentBank: string | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

type StatusFilter = 'all' | 'unpaid' | 'overdue' | 'paid';

export default function CustomerInvoicesPage() {
  const router = useRouter();
  const { addToast } = useToast();

  const [invoices, setInvoices]     = useState<Invoice[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [loading, setLoading]       = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const currentPage     = useRef(1);

  const toast = (type: 'success' | 'error' | 'info', title: string, desc?: string) =>
    addToast({ type, title, description: desc, duration: type === 'error' ? 8000 : 5000 });

  const fetchInvoices = useCallback(async (page: number, filter: StatusFilter, silent = false) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('customer_token') : null;
    if (!token) { router.push('/customer/login'); return; }

    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (filter !== 'all') params.set('status', filter);

      const res = await fetch(`/api/customer/invoices?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!data.success) {
        if (!silent) toast('error', 'Gagal', data.error || 'Gagal memuat tagihan');
        return;
      }

      const raw: typeof invoices = data.data.invoices;
      // Belum bayar selalu tampil di atas
      const sorted = [
        ...raw.filter(inv => inv.status === 'PENDING' || inv.status === 'OVERDUE'),
        ...raw.filter(inv => inv.status !== 'PENDING' && inv.status !== 'OVERDUE'),
      ];
      setInvoices(sorted);
      setPagination(data.data.pagination);
    } catch {
      if (!silent) toast('error', 'Error', 'Terjadi kesalahan. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => {
    currentPage.current = 1;
    fetchInvoices(1, statusFilter);
  }, [statusFilter, fetchInvoices]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

    const totalOutstanding = invoices.filter(inv => inv.status === 'PENDING' || inv.status === 'OVERDUE').reduce((sum, inv) => sum + inv.amount, 0);
  const overdueCount = invoices.filter(inv => inv.status === 'OVERDUE').length;

  return (
    <main className="max-w-[1280px] mx-auto px-4 md:px-8 py-6">
      <button 
        onClick={() => router.push('/customer')}
        className="flex items-center gap-1.5 text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors font-mono text-[10px] uppercase tracking-wider font-bold mb-6"
      >
        <span className="material-symbols-outlined text-[16px]">arrow_back</span>
        Kembali
      </button>
      {/* Header & Filters */}
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-display font-medium text-[var(--color-ink)] mb-2">Tagihan</h2>
          <p className="text-sm font-body text-[var(--color-ink-2)]">Riwayat tagihan dan pembayaran Anda.</p>
        </div>
        
        {/* Tabs/Pills */}
        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 hide-scrollbar" style={{ scrollbarWidth: 'none' }}>
          <button 
            onClick={() => setStatusFilter('all')}
            className={`px-4 py-2 rounded-full font-mono text-[10px] uppercase font-bold tracking-wider whitespace-nowrap transition-colors border ${statusFilter === 'all' ? 'bg-[var(--color-accent)] text-[var(--color-accent-ink)] border-[var(--color-accent)]' : 'bg-[var(--color-paper)] text-[var(--color-ink)] border-[var(--color-rule)] hover:bg-[var(--color-paper-3)]'}`}
          >
            Semua
          </button>
          <button 
            onClick={() => setStatusFilter('unpaid')}
            className={`px-4 py-2 rounded-full font-mono text-[10px] uppercase font-bold tracking-wider whitespace-nowrap transition-colors border ${statusFilter === 'unpaid' ? 'bg-[var(--color-accent)] text-[var(--color-accent-ink)] border-[var(--color-accent)]' : 'bg-[var(--color-paper)] text-[var(--color-ink)] border-[var(--color-rule)] hover:bg-[var(--color-paper-3)]'}`}
          >
            Belum Bayar
          </button>
          <button 
            onClick={() => setStatusFilter('overdue')}
            className={`px-4 py-2 rounded-full font-mono text-[10px] uppercase font-bold tracking-wider whitespace-nowrap transition-colors border ${statusFilter === 'overdue' ? 'bg-[var(--color-accent)] text-[var(--color-accent-ink)] border-[var(--color-accent)]' : 'bg-[var(--color-paper)] text-[var(--color-ink)] border-[var(--color-rule)] hover:bg-[var(--color-paper-3)]'}`}
          >
            Jatuh Tempo
          </button>
          <button 
            onClick={() => setStatusFilter('paid')}
            className={`px-4 py-2 rounded-full font-mono text-[10px] uppercase font-bold tracking-wider whitespace-nowrap transition-colors border ${statusFilter === 'paid' ? 'bg-[var(--color-accent)] text-[var(--color-accent-ink)] border-[var(--color-accent)]' : 'bg-[var(--color-paper)] text-[var(--color-ink)] border-[var(--color-rule)] hover:bg-[var(--color-paper-3)]'}`}
          >
            Lunas
          </button>
        </div>
      </div>

      {/* Bento Grid for Invoices */}
      <div className="grid grid-cols-1 md:grid-cols-8 lg:grid-cols-12 gap-5">
        
        {/* Summary Module */}
        <div className="md:col-span-8 lg:col-span-4 bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-[var(--radius-lg)] p-6 flex flex-col justify-between shadow-sm">
          <div>
            <h3 className="font-mono text-[10px] text-[var(--color-muted)] font-bold uppercase tracking-wider mb-2">Total Outstanding</h3>
            <div className="text-4xl font-display font-medium text-[var(--color-ink)]">{formatCurrency(totalOutstanding)}</div>
            {overdueCount > 0 && (
              <p className="font-body text-sm text-[var(--color-error)] mt-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-[18px]">error</span>
                {overdueCount} Invoices Overdue
              </p>
            )}
          </div>
        </div>

        {/* List Module */}
        <div className="md:col-span-8 lg:col-span-8 flex flex-col gap-4">
          {loading ? (
            <div className="p-8 flex justify-center items-center">
              <Loader2 className="w-8 h-8 animate-spin text-[var(--color-focus)]" />
            </div>
          ) : invoices.length === 0 ? (
            <div className="p-8 text-center text-[var(--color-muted)] text-sm">
              Tidak ada tagihan ditemukan.
            </div>
          ) : (
            invoices.map((inv) => {
              const isUnpaid = inv.status === 'PENDING';
              const isOverdue = inv.status === 'OVERDUE';
              const isPaid = inv.status === 'PAID';

              let borderColor = 'border-[var(--color-rule)]';
              let iconBg = 'bg-[var(--color-paper-3)]';
              let iconColor = 'text-[var(--color-muted)]';
              let badgeBg = 'bg-[var(--color-paper-3)]';
              let badgeColor = 'text-[var(--color-ink-2)]';
              let badgeText = 'Belum Bayar';

              if (isOverdue) {
                borderColor = 'border-[var(--color-error)]';
                iconBg = 'bg-[var(--color-error-bg)]';
                iconColor = 'text-[var(--color-error)]';
                badgeBg = 'bg-[var(--color-error-bg)]';
                badgeColor = 'text-[var(--color-error)] border border-[var(--color-error)]';
                badgeText = 'Jatuh Tempo';
              } else if (isPaid) {
                iconBg = 'bg-[var(--color-success-bg)]';
                iconColor = 'text-[var(--color-success)]';
                badgeBg = 'bg-[var(--color-success-bg)]';
                badgeColor = 'text-[var(--color-success)] border border-[var(--color-success)]';
                badgeText = 'Lunas';
              }

              return (
                <div key={inv.id} className={`bg-[var(--color-paper)] border ${borderColor} rounded-[var(--radius-lg)] p-6 hover:shadow-md transition-shadow`}>
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-[var(--radius-sm)] ${iconBg} ${iconColor} flex items-center justify-center shrink-0`}>
                        <span className="material-symbols-outlined">{isPaid ? 'check_circle' : 'receipt_long'}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-sm text-[var(--color-muted)]">{inv.invoiceNumber}</span>
                          <span className={`px-2 py-0.5 rounded-full font-mono text-[10px] uppercase font-bold tracking-wider ${badgeBg} ${badgeColor}`}>
                            {badgeText}
                          </span>
                        </div>
                        <h4 className="font-display text-lg font-medium text-[var(--color-ink)]">{inv.profileName || (inv.invoiceType === 'INSTALLATION' ? 'Biaya Instalasi' : 'Layanan Internet')}</h4>
                        <p className="font-body text-sm text-[var(--color-ink-2)] mt-1">
                          {isPaid 
                            ? `Dibayar pada: ${new Date(inv.paidAt!).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' })}` 
                            : `Jatuh Tempo: ${new Date(inv.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' })}`}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex flex-col sm:items-end gap-3 border-t sm:border-t-0 border-[var(--color-rule)] pt-4 sm:pt-0">
                      <div className="font-display text-xl font-bold text-[var(--color-ink)]">{formatCurrency(inv.amount)}</div>
                      {isPaid ? (
                        <button 
                          onClick={() => window.open(`/invoice/${inv.invoiceNumber}/print`, '_blank')}
                          className="bg-transparent border border-[var(--color-rule)] text-[var(--color-ink-2)] hover:bg-[var(--color-paper-3)] px-4 py-2 rounded-[var(--radius-sm)] font-mono text-[10px] uppercase font-bold tracking-wider transition-colors flex items-center justify-center gap-2"
                        >
                          <span className="material-symbols-outlined text-[14px]">download</span> Lihat Receipt
                        </button>
                      ) : (
                        <div className="flex gap-2">
                          <button 
                            onClick={() => router.push(`/invoice/${inv.invoiceNumber}`)}
                            className="bg-transparent border border-[var(--color-rule)] text-[var(--color-ink-2)] hover:bg-[var(--color-paper-3)] px-4 py-2 rounded-[var(--radius-sm)] font-mono text-[10px] uppercase font-bold tracking-wider transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                          >
                            <span className="material-symbols-outlined text-[14px]">visibility</span> Lihat Invoice
                          </button>
                          <button 
                            onClick={() => router.push(`/pay/${inv.paymentToken}`)}
                            className="bg-[var(--color-accent)] text-[var(--color-accent-ink)] hover:opacity-90 px-4 py-2 rounded-[var(--radius-sm)] font-mono text-[10px] uppercase font-bold tracking-wider transition-opacity whitespace-nowrap flex items-center justify-center gap-2"
                          >
                            <span className="material-symbols-outlined text-[14px]">payment</span> Bayar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </main>
  );
}
