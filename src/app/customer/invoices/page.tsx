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
    <main className="flex-1 p-margin-mobile md:p-margin-desktop w-full max-w-container-max mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-primary">Tagihan</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">Lihat dan kelola semua tagihan Anda.</p>
        </div>
        {/* Filters */}
        <div className="flex overflow-x-auto pb-2 md:pb-0 gap-2 hide-scrollbar">
          <button 
            onClick={() => setStatusFilter('all')}
            className={`px-4 py-2 rounded-full font-label-caps text-label-caps whitespace-nowrap ${statusFilter === 'all' ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-dim border border-hairline-border'}`}
          >
            Semua
          </button>
          <button 
            onClick={() => setStatusFilter('unpaid')}
            className={`px-4 py-2 rounded-full font-label-caps text-label-caps whitespace-nowrap ${statusFilter === 'unpaid' ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-dim border border-hairline-border'}`}
          >
            Belum Bayar
          </button>
          <button 
            onClick={() => setStatusFilter('overdue')}
            className={`px-4 py-2 rounded-full font-label-caps text-label-caps whitespace-nowrap ${statusFilter === 'overdue' ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-dim border border-hairline-border'}`}
          >
            Jatuh Tempo
          </button>
          <button 
            onClick={() => setStatusFilter('paid')}
            className={`px-4 py-2 rounded-full font-label-caps text-label-caps whitespace-nowrap ${statusFilter === 'paid' ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-dim border border-hairline-border'}`}
          >
            Lunas
          </button>
        </div>
      </div>

      {/* Content Area - Hairline Table / List */}
      <div className="bg-surface-container-lowest border border-hairline-border rounded-lg overflow-hidden">
        {/* Table Header (Desktop) */}
        <div className="hidden md:grid grid-cols-12 gap-4 p-4 border-b border-hairline-border bg-surface-muted text-on-surface-variant font-label-caps text-label-caps">
          <div className="col-span-3">No. Tagihan</div>
          <div className="col-span-3">Jatuh Tempo</div>
          <div className="col-span-2">Total Amount</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2 text-right">Aksi</div>
        </div>

        {loading ? (
          <div className="p-8 flex justify-center items-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : invoices.length === 0 ? (
          <div className="p-8 text-center text-on-surface-variant font-body-md text-body-md">
            Tidak ada tagihan ditemukan.
          </div>
        ) : (
          invoices.map(inv => {
            const isUnpaid = inv.status === 'PENDING';
            const isOverdue = inv.status === 'OVERDUE';
            const isPaid = inv.status === 'PAID';
            
            return (
              <div key={inv.id} className={`grid grid-cols-1 md:grid-cols-12 gap-4 p-4 border-b border-hairline-border items-center hover:bg-surface-muted transition-colors ${isPaid ? 'opacity-75' : ''}`}>
                <div className="md:col-span-3 flex flex-col">
                  <span className="md:hidden font-label-caps text-label-caps text-on-surface-variant mb-1">No. Tagihan</span>
                  <span className="font-data-mono text-data-mono font-bold text-primary">{inv.invoiceNumber}</span>
                </div>
                <div className="md:col-span-3 flex flex-col">
                  <span className="md:hidden font-label-caps text-label-caps text-on-surface-variant mb-1">Jatuh Tempo</span>
                  <span className={`font-body-md text-body-md ${isOverdue ? 'text-status-isolated' : ''}`}>
                    {formatWIB(inv.dueDate).split(' ')[0]}
                  </span>
                </div>
                <div className="md:col-span-2 flex flex-col">
                  <span className="md:hidden font-label-caps text-label-caps text-on-surface-variant mb-1">Total Amount</span>
                  <span className="font-data-mono text-data-mono">{formatCurrency(inv.amount)}</span>
                </div>
                <div className="md:col-span-2 flex flex-col items-start">
                  <span className="md:hidden font-label-caps text-label-caps text-on-surface-variant mb-1">Status</span>
                  {isPaid ? (
                    <span className="px-2 py-1 rounded-full bg-status-active/10 text-status-active font-label-caps text-label-caps">Lunas</span>
                  ) : isOverdue ? (
                    <span className="px-2 py-1 rounded-full bg-status-isolated/10 text-status-isolated font-label-caps text-label-caps">Jatuh Tempo</span>
                  ) : (
                    <span className="px-2 py-1 rounded-full bg-surface-container-highest text-on-surface-variant font-label-caps text-label-caps border border-hairline-border">Belum Bayar</span>
                  )}
                </div>
                <div className="md:col-span-2 flex md:justify-end mt-2 md:mt-0">
                  {isPaid ? (
                    <button 
                      onClick={() => router.push(`/invoice/${inv.id}/print`)}
                      className="w-full md:w-auto px-4 py-2 bg-transparent text-on-surface-variant font-label-caps text-label-caps flex items-center justify-center gap-2 hover:text-primary cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px]">download</span>
                      Receipt
                    </button>
                  ) : (
                    <button 
                      onClick={() => router.push(`/invoice/${inv.id}`)}
                      className="w-full md:w-auto px-4 py-2 bg-primary-container text-on-primary font-label-caps text-label-caps rounded flex items-center justify-center gap-2 hover:opacity-90 cursor-pointer"
                    >
                      Bayar Sekarang
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
