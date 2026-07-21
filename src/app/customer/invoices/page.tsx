'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/components/cyberpunk/CyberToast';

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

  const [invoices, setInvoices]         = useState<Invoice[]>([]);
  const [pagination, setPagination]     = useState<Pagination>({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [loading, setLoading]           = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const currentPage = useRef(1);

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

  /* ─── Instant Direct PDF Download ─── */
  const downloadPdf = (inv: Invoice) => {
    setDownloadingId(inv.id);
    try {
      const link = document.createElement('a');
      link.href = `/invoice/${inv.invoiceNumber}/pdf`;
      link.download = `Invoice-${inv.invoiceNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast('success', 'PDF diunduh', `${inv.invoiceNumber}.pdf`);
    } catch {
      toast('error', 'Gagal mengunduh PDF', 'Silakan coba lagi.');
    } finally {
      setTimeout(() => setDownloadingId(null), 1000);
    }
  };

  return (
  <main className="max-w-[1280px] mx-auto px-4 md:px-8 py-6 pb-32 md:pb-8">
    {/* Back Button */}
    <button
      onClick={() => router.push('/customer')}
      className="flex items-center gap-1.5 text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors font-mono text-[10px] uppercase tracking-wider font-bold mb-6"
    >
      <span className="material-symbols-outlined text-[16px]">arrow_back</span>
      Kembali
    </button>

    {/* Header */}
    <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
      <div>
        <h2 className="text-2xl md:text-[32px] font-display font-semibold text-[var(--color-ink)] mb-1">Tagihan</h2>
        <p className="text-sm font-body text-[var(--color-ink-2)]">Riwayat tagihan dan pembayaran Anda.</p>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
        {([['all', 'Semua'], ['unpaid', 'Belum Bayar'], ['overdue', 'Jatuh Tempo'], ['paid', 'Lunas']] as [StatusFilter, string][]).map(([val, label]) => (
          <button
            key={val}
            onClick={() => setStatusFilter(val)}
            className={`px-4 py-2 rounded-full font-mono text-[10px] uppercase font-bold tracking-wider whitespace-nowrap transition-colors border ${
              statusFilter === val
                ? 'bg-[var(--color-accent)] text-[var(--color-accent-ink)] border-[var(--color-accent)]'
                : 'bg-[var(--color-paper)] text-[var(--color-ink-2)] border-[var(--color-rule)] hover:bg-[var(--color-paper-3)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
      {/* Summary */}
      <div className="md:col-span-4 bento-card flex flex-col gap-2">
        <p className="section-header">Total Belum Dibayar</p>
        <div className="text-3xl font-display font-semibold text-[var(--color-ink)]">{formatCurrency(totalOutstanding)}</div>
        {overdueCount > 0 && (
          <p className="text-sm font-body text-[var(--color-error)] flex items-center gap-1 mt-1">
            <span className="material-symbols-outlined text-[16px]">error</span>
            {overdueCount} Tagihan Jatuh Tempo
          </p>
        )}
        <div className="mt-4 pt-4 border-t border-[var(--color-rule)]">
          <p className="section-header">Total Tagihan</p>
          <p className="font-mono text-sm font-bold text-[var(--color-ink-2)]">{invoices.length} transaksi</p>
        </div>
      </div>

      {/* Invoice List */}
      <div className="md:col-span-8 flex flex-col gap-4">
        {loading ? (
          <div className="p-8 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" />
          </div>
        ) : invoices.length === 0 ? (
          <div className="bento-card p-8 text-center">
            <span className="material-symbols-outlined text-[48px] text-[var(--color-muted)] block mb-3">receipt_long</span>
            <p className="text-sm font-body text-[var(--color-muted)]">Tidak ada tagihan ditemukan.</p>
          </div>
        ) : (
          invoices.map((inv) => {
            const isPaid   = inv.status === 'PAID';
            const isOverdue = inv.status === 'OVERDUE';
            const isUnpaid  = inv.status === 'PENDING';

            /* badge */
            const badgeClass = isPaid ? 'badge-paid' : isOverdue ? 'badge-overdue' : 'badge-pending';
            const badgeText  = isPaid ? 'Lunas' : isOverdue ? 'Jatuh Tempo' : 'Menunggu';

            /* icon */
            const iconBg  = isPaid ? 'bg-[var(--color-success-bg)] text-[var(--color-success)]'
                          : isOverdue ? 'bg-[var(--color-error-bg)] text-[var(--color-error)]'
                          : 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]';

            /* border left */
            const borderLeft = isOverdue ? 'border-l-[3px] border-l-[var(--color-error)]'
                             : isPaid    ? 'border-l-[3px] border-l-[var(--color-success)]'
                             :             'border-l-[3px] border-l-[var(--color-warning)]';

            /* date line */
            const dateLine = isPaid
              ? `Dibayar: ${new Date(inv.paidAt!).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' })}`
              : `Jatuh Tempo: ${new Date(inv.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' })}`;

            return (
              <div key={inv.id} className={`bento-card hover:shadow-md transition-shadow ${borderLeft}`}>
                {/* ── Top row: icon + info + amount ── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">

                  {/* Left: icon + text */}
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-[var(--radius-sm)] flex items-center justify-center shrink-0 ${iconBg}`}>
                      <span className="material-symbols-outlined text-[20px]">receipt_long</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs text-[var(--color-muted)]">{inv.invoiceNumber}</span>
                        <span className={`badge ${badgeClass}`}>{badgeText}</span>
                      </div>
                      <h4 className="font-display text-base font-semibold text-[var(--color-ink)]">
                        {inv.profileName || (inv.invoiceType === 'INSTALLATION' ? 'Biaya Instalasi' : 'Layanan Internet')}
                      </h4>
                      <p className="font-body text-sm text-[var(--color-ink-2)] mt-0.5">{dateLine}</p>
                    </div>
                  </div>

                  {/* Right: amount + buttons */}
                  <div className="flex flex-col sm:items-end gap-3 border-t sm:border-t-0 border-[var(--color-rule)] pt-4 sm:pt-0">
                    <div className="font-display text-xl font-bold text-[var(--color-ink)]">{formatCurrency(inv.amount)}</div>

                    {/* ── ACTION BUTTONS — same for all ── */}
                    <div className="flex gap-2 flex-wrap">
                      {/* Lihat Invoice — always shown */}
                      <button
                        onClick={() => router.push(`/invoice/${inv.invoiceNumber}`)}
                        className="btn-secondary whitespace-nowrap"
                      >
                        <span className="material-symbols-outlined text-[14px]">visibility</span>
                        Lihat Invoice
                      </button>

                      {/* Unduh PDF — always shown */}
                      <button
                        onClick={() => downloadPdf(inv)}
                        disabled={downloadingId === inv.id}
                        className="btn-secondary whitespace-nowrap"
                      >
                        {downloadingId === inv.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <span className="material-symbols-outlined text-[14px]">download</span>}
                        {downloadingId === inv.id ? 'Mengunduh...' : 'Unduh PDF'}
                      </button>

                      {/* Bayar — only for unpaid/overdue */}
                      {(isUnpaid || isOverdue) && inv.paymentToken && (
                        <button
                          onClick={() => router.push(`/pay/${inv.paymentToken}`)}
                          className="btn-primary whitespace-nowrap"
                        >
                          <span className="material-symbols-outlined text-[14px]">payment</span>
                          Bayar
                        </button>
                      )}
                    </div>
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
