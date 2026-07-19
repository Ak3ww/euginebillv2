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

      setInvoices(data.data.invoices);
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

  return (
    <main className="hallmark-container">
      {/* Page Header */}
      <div className="mb-[var(--space-xl)] pb-[var(--space-lg)] hairline-bottom flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-display font-medium mb-1">Tagihan</h2>
          <p className="text-[var(--color-muted)] text-sm">Lihat dan kelola semua tagihan Anda.</p>
        </div>
        
        {/* Filters */}
        <div className="flex overflow-x-auto gap-2 pb-2 md:pb-0">
          <button 
            onClick={() => setStatusFilter('all')}
            className={`px-4 py-2 rounded-full text-xs uppercase tracking-wider font-medium whitespace-nowrap transition-colors border ${statusFilter === 'all' ? 'bg-[var(--color-accent)] text-[var(--color-accent-ink)] border-[var(--color-accent)]' : 'bg-transparent text-[var(--color-ink)] border-[var(--color-rule)] hover:bg-[var(--color-paper-2)]'}`}
          >
            Semua
          </button>
          <button 
            onClick={() => setStatusFilter('unpaid')}
            className={`px-4 py-2 rounded-full text-xs uppercase tracking-wider font-medium whitespace-nowrap transition-colors border ${statusFilter === 'unpaid' ? 'bg-[var(--color-accent)] text-[var(--color-accent-ink)] border-[var(--color-accent)]' : 'bg-transparent text-[var(--color-ink)] border-[var(--color-rule)] hover:bg-[var(--color-paper-2)]'}`}
          >
            Belum Bayar
          </button>
          <button 
            onClick={() => setStatusFilter('overdue')}
            className={`px-4 py-2 rounded-full text-xs uppercase tracking-wider font-medium whitespace-nowrap transition-colors border ${statusFilter === 'overdue' ? 'bg-[var(--color-accent)] text-[var(--color-accent-ink)] border-[var(--color-accent)]' : 'bg-transparent text-[var(--color-ink)] border-[var(--color-rule)] hover:bg-[var(--color-paper-2)]'}`}
          >
            Jatuh Tempo
          </button>
          <button 
            onClick={() => setStatusFilter('paid')}
            className={`px-4 py-2 rounded-full text-xs uppercase tracking-wider font-medium whitespace-nowrap transition-colors border ${statusFilter === 'paid' ? 'bg-[var(--color-accent)] text-[var(--color-accent-ink)] border-[var(--color-accent)]' : 'bg-transparent text-[var(--color-ink)] border-[var(--color-rule)] hover:bg-[var(--color-paper-2)]'}`}
          >
            Lunas
          </button>
        </div>
      </div>

      {/* Content Area - Hairline List */}
      <div className="bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-[var(--radius-lg)] overflow-hidden">
        {/* Table Header (Desktop) */}
        <div className="hidden md:grid grid-cols-12 gap-4 p-4 hairline-bottom bg-[var(--color-paper-2)] text-[var(--color-muted)] text-xs uppercase tracking-wider font-medium">
          <div className="col-span-3">No. Tagihan</div>
          <div className="col-span-3">Jatuh Tempo</div>
          <div className="col-span-2">Total Amount</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2 text-right">Aksi</div>
        </div>

        {loading ? (
          <div className="p-8 flex justify-center items-center">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" />
          </div>
        ) : invoices.length === 0 ? (
          <div className="p-8 text-center text-[var(--color-muted)] text-sm">
            Tidak ada tagihan ditemukan.
          </div>
        ) : (
          invoices.map((inv, idx) => {
            const isUnpaid = inv.status === 'PENDING';
            const isOverdue = inv.status === 'OVERDUE';
            const isPaid = inv.status === 'PAID';
            const isLast = idx === invoices.length - 1;
            
            return (
              <div key={inv.id} className={`grid grid-cols-1 md:grid-cols-12 gap-4 p-4 items-center hover:bg-[var(--color-paper-2)] transition-colors ${!isLast ? 'hairline-bottom' : ''} ${isPaid ? 'opacity-75' : ''}`}>
                <div className="md:col-span-3 flex flex-col">
                  <span className="md:hidden text-xs uppercase tracking-wider text-[var(--color-muted)] mb-1">No. Tagihan</span>
                  <span className="font-mono font-medium">{inv.invoiceNumber}</span>
                </div>
                
                <div className="md:col-span-3 flex flex-col">
                  <span className="md:hidden text-xs uppercase tracking-wider text-[var(--color-muted)] mb-1">Jatuh Tempo</span>
                  <span className={`text-sm ${isOverdue ? 'text-[var(--color-error)] font-medium' : 'text-[var(--color-ink-2)]'}`}>
                    {formatWIB(inv.dueDate).split(' ')[0]}
                  </span>
                </div>
                
                <div className="md:col-span-2 flex flex-col">
                  <span className="md:hidden text-xs uppercase tracking-wider text-[var(--color-muted)] mb-1">Total Amount</span>
                  <span className="font-mono text-sm">{formatCurrency(inv.amount)}</span>
                </div>
                
                <div className="md:col-span-2 flex flex-col items-start">
                  <span className="md:hidden text-xs uppercase tracking-wider text-[var(--color-muted)] mb-1">Status</span>
                  {isPaid ? (
                    <span className="hallmark-badge badge-success">Lunas</span>
                  ) : isOverdue ? (
                    <span className="hallmark-badge badge-error">Jatuh Tempo</span>
                  ) : (
                    <span className="hallmark-badge border border-[var(--color-rule)] bg-[var(--color-paper-3)] text-[var(--color-ink-2)]">Belum Bayar</span>
                  )}
                </div>
                
                <div className="md:col-span-2 flex md:justify-end mt-2 md:mt-0">
                  {isPaid ? (
                    <button 
                      onClick={() => router.push(`/invoice/${inv.id}/print`)}
                      className="w-full md:w-auto px-4 py-2 bg-transparent text-[var(--color-ink-2)] text-xs uppercase tracking-wider font-medium flex items-center justify-center gap-2 hover:text-[var(--color-accent)] transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px]">download</span>
                      Receipt
                    </button>
                  ) : (
                    <button 
                      onClick={() => router.push(inv.paymentToken ? `/pay/${inv.paymentToken}` : `/invoice/${inv.id}`)}
                      className="hallmark-button w-full md:w-auto"
                    >
                      Bayar
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </main>
  );
}
