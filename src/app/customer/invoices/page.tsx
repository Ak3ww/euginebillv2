'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

interface Invoice {
  id: string;
  invoiceNumber: string;
  amount: number;
  dueDate: string;
  paidAt?: string | null;
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  profileName?: string;
  invoiceType?: string;
  paymentToken?: string;
}

type StatusFilter = 'all' | 'unpaid' | 'overdue' | 'paid';

export default function CustomerInvoicesPage() {
  const router = useRouter();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const currentPage = useRef(1);
  const totalCount = useRef(0);

  /* ─── Fetch Data ─── */
  const fetchInvoices = useCallback(async (pageNum: number, status: StatusFilter, append = false) => {
    try {
      if (!append) setLoading(true);
      else setLoadingMore(true);

      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: '15',
      });
      if (status !== 'all') {
        params.append('status', status);
      }

      const res = await fetch(`/api/customer/invoices?${params.toString()}`);
      if (!res.ok) {
        if (res.status === 401) {
          router.push('/customer/login');
          return;
        }
        throw new Error('Gagal mengambil data tagihan');
      }

      const data = await res.json();
      const list: Invoice[] = data.invoices || [];

      if (append) {
        setInvoices(prev => [...prev, ...list]);
      } else {
        setInvoices(list);
      }

      totalCount.current = data.total || list.length;
      setHasMore(pageNum * 15 < totalCount.current);
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [router]);

  useEffect(() => {
    currentPage.current = 1;
    fetchInvoices(1, statusFilter);
  }, [statusFilter, fetchInvoices]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

  const totalOutstanding = invoices.filter(inv => inv.status === 'PENDING' || inv.status === 'OVERDUE').reduce((sum, inv) => sum + inv.amount, 0);
  const overdueCount = invoices.filter(inv => inv.status === 'OVERDUE').length;

  /* ─── Direct Asynchronous PDF Download (No page redirect!) ─── */
  const downloadPdf = async (inv: Invoice) => {
    setDownloadingId(inv.id);
    try {
      const res = await fetch(`/invoice/${inv.invoiceNumber}/pdf`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Invoice-${inv.invoiceNumber}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        window.location.href = `/invoice/${inv.invoiceNumber}/pdf`;
      }
    } catch (err) {
      console.error('Download error:', err);
      window.location.href = `/invoice/${inv.invoiceNumber}/pdf`;
    } finally {
      setDownloadingId(null);
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
        {/* Status Filter Pills */}
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

      {/* Summary + List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        {/* Summary Module */}
        <div className="md:col-span-4 bento-card flex flex-col justify-between h-fit">
          <div>
            <p className="section-header">Total Belum Dibayar</p>
            <div className="text-3xl font-display font-semibold text-[var(--color-ink)] mt-1">{formatCurrency(totalOutstanding)}</div>
            {overdueCount > 0 && (
              <p className="text-sm font-body text-[var(--color-error)] mt-2 flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">error</span>
                {overdueCount} Tagihan Jatuh Tempo
              </p>
            )}
          </div>
        </div>

        {/* Invoice List */}
        <div className="md:col-span-8 flex flex-col gap-4">
          {loading ? (
            <div className="p-8 flex justify-center items-center">
              <Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" />
            </div>
          ) : invoices.length === 0 ? (
            <div className="bento-card p-8 text-center">
              <span className="material-symbols-outlined text-[48px] text-[var(--color-muted)] block mb-3">receipt_long</span>
              <p className="text-sm font-body text-[var(--color-muted)]">Tidak ada tagihan ditemukan.</p>
            </div>
          ) : (
            invoices.map((inv) => {
              const isUnpaid = inv.status === 'PENDING';
              const isOverdue = inv.status === 'OVERDUE';
              const isPaid = inv.status === 'PAID';

              const dateLine = isPaid
                ? `Dibayar: ${new Date(inv.paidAt!).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' })}`
                : `Jatuh Tempo: ${new Date(inv.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' })}`;

              return (
                <div
                  key={inv.id}
                  className={`bento-card hover:shadow-md transition-shadow ${
                    isOverdue ? 'border-l-[3px] border-l-[var(--color-error)]' :
                    isUnpaid ? 'border-l-[3px] border-l-[var(--color-warning)]' :
                    'border-l-[3px] border-l-[var(--color-success)]'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    {/* Left: status icon + info */}
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-[var(--radius-sm)] flex items-center justify-center shrink-0 ${
                        isPaid ? 'bg-[var(--color-success-bg)] text-[var(--color-success)]' :
                        isOverdue ? 'bg-[var(--color-error-bg)] text-[var(--color-error)]' :
                        'bg-[var(--color-warning-bg)] text-[var(--color-warning)]'
                      }`}>
                        <span className="material-symbols-outlined text-[20px]">{isPaid ? 'check_circle' : 'receipt_long'}</span>
                      </div>

                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-xs text-[var(--color-muted)]">{inv.invoiceNumber}</span>
                          <span className={`badge ${
                            isPaid ? 'badge-paid' : isOverdue ? 'badge-overdue' : 'badge-pending'
                          }`}>
                            {isPaid ? 'Lunas' : isOverdue ? 'Jatuh Tempo' : 'Menunggu'}
                          </span>
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

                      {/* ── ACTION BUTTONS ── */}
                      <div className="flex gap-2 flex-wrap">
                        {/* Lihat Invoice — always shown */}
                        <button
                          onClick={() => router.push(`/invoice/${inv.invoiceNumber}`)}
                          className="btn-secondary whitespace-nowrap"
                        >
                          <span className="material-symbols-outlined text-[14px]">visibility</span>
                          Lihat Invoice
                        </button>

                        {/* Direct PDF Download with Inline Loading (No Page Redirect!) */}
                        <button
                          onClick={() => downloadPdf(inv)}
                          disabled={downloadingId === inv.id}
                          className="btn-secondary whitespace-nowrap disabled:opacity-50"
                        >
                          {downloadingId === inv.id ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--color-accent)]" />
                              <span>Mengunduh...</span>
                            </>
                          ) : (
                            <>
                              <span className="material-symbols-outlined text-[14px]">download</span>
                              <span>Unduh PDF</span>
                            </>
                          )}
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

          {/* Load More */}
          {hasMore && (
            <div className="text-center pt-2">
              <button
                onClick={() => {
                  currentPage.current += 1;
                  fetchInvoices(currentPage.current, statusFilter, true);
                }}
                disabled={loadingMore}
                className="btn-secondary px-6 py-2.5"
              >
                {loadingMore ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-[var(--color-accent)]" />
                    Memuat...
                  </span>
                ) : (
                  'Muat Lebih Banyak'
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
