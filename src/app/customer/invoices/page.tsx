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

  /* ─── PDF Download via html2pdf.js ─── */
  const downloadPdf = async (inv: Invoice) => {
    setDownloadingId(inv.id);
    try {
      const token = localStorage.getItem('customer_token');
      const res = await fetch(`/api/customer/me`, { headers: { Authorization: `Bearer ${token}` } });
      const meData = await res.json();
      const user = meData.data || {};

      const serviceName = inv.profileName || (inv.invoiceType === 'INSTALLATION' ? 'Biaya Instalasi' : 'Layanan Internet');
      const dateLabel = inv.status === 'PAID'
        ? `Dibayar: ${new Date(inv.paidAt!).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' })}`
        : `Jatuh Tempo: ${new Date(inv.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' })}`;
      const statusLabel = inv.status === 'PAID' ? 'LUNAS' : inv.status === 'OVERDUE' ? 'JATUH TEMPO' : 'BELUM DIBAYAR';
      const statusColor = inv.status === 'PAID' ? '#059669' : inv.status === 'OVERDUE' ? '#DC2626' : '#D97706';
      const statusBg = inv.status === 'PAID' ? '#ecfdf5' : inv.status === 'OVERDUE' ? '#fef2f2' : '#fffbeb';
      const printDate = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' });

      const html = `
<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8"/>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 13px; color: #1a1c20; background: #fff; }
  .page { width: 210mm; min-height: 148mm; padding: 32px 40px; }

  .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 20px; border-bottom: 2px solid #002c60; margin-bottom: 24px; }
  .brand { display: flex; flex-direction: column; gap: 2px; }
  .brand-name { font-size: 22px; font-weight: 700; color: #002c60; letter-spacing: -0.5px; }
  .brand-sub { font-size: 11px; color: #737781; }
  .inv-meta { text-align: right; }
  .inv-number { font-family: 'Courier New', monospace; font-size: 14px; font-weight: 700; color: #1b437c; }
  .inv-date { font-size: 11px; color: #737781; margin-top: 4px; }

  .status-badge { display: inline-block; padding: 5px 14px; border-radius: 999px; font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; border: 1px solid ${statusColor}; background: ${statusBg}; color: ${statusColor}; margin-bottom: 24px; }

  .section-label { font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #737781; margin-bottom: 6px; }

  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
  .info-block {}
  .info-value { font-size: 14px; font-weight: 600; color: #1a1c20; margin-top: 2px; }

  .line-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  .line-table th { padding: 8px 12px; font-size: 10px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: #737781; background: #f9f9fe; border-bottom: 1px solid #E2E8F0; text-align: left; }
  .line-table td { padding: 12px 12px; font-size: 13px; border-bottom: 1px solid #E2E8F0; }
  .line-table tr:last-child td { border-bottom: none; }
  .text-right { text-align: right; }
  .amount-cell { font-family: 'Courier New', monospace; font-weight: 700; font-size: 14px; color: #002c60; }

  .total-row { background: #002c60; color: #fff; }
  .total-row td { padding: 14px 12px; font-weight: 700; font-size: 15px; }

  .footer { border-top: 1px solid #E2E8F0; padding-top: 16px; display: flex; justify-content: space-between; align-items: center; }
  .footer-note { font-size: 10px; color: #737781; max-width: 60%; line-height: 1.5; }
  .print-date { font-size: 10px; color: #c3c6d1; font-family: 'Courier New', monospace; }

  .paid-stamp { position: absolute; top: 60px; right: 40px; transform: rotate(-15deg); border: 3px solid #059669; border-radius: 8px; padding: 4px 16px; color: #059669; font-weight: 900; font-size: 18px; letter-spacing: 4px; opacity: 0.15; pointer-events: none; }
</style>
</head>
<body>
<div class="page" style="position:relative;">
  ${inv.status === 'PAID' ? '<div class="paid-stamp">LUNAS</div>' : ''}

  <div class="header">
    <div class="brand">
      <div class="brand-name">EugineBill</div>
      <div class="brand-sub">Penyedia Layanan Internet</div>
    </div>
    <div class="inv-meta">
      <div class="inv-number">${inv.invoiceNumber}</div>
      <div class="inv-date">Dicetak: ${printDate}</div>
    </div>
  </div>

  <div class="status-badge">${statusLabel}</div>

  <div class="info-grid">
    <div class="info-block">
      <div class="section-label">Pelanggan</div>
      <div class="info-value">${user.name || '-'}</div>
      <div style="font-size:11px;color:#737781;margin-top:2px;">${user.customerId || user.username || '-'}</div>
    </div>
    <div class="info-block">
      <div class="section-label">Tanggal</div>
      <div class="info-value">${dateLabel}</div>
    </div>
  </div>

  <table class="line-table">
    <thead>
      <tr>
        <th>Deskripsi Layanan</th>
        <th>Tipe</th>
        <th class="text-right">Jumlah</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>${serviceName}</strong></td>
        <td style="color:#737781;font-size:12px;">${inv.invoiceType === 'INSTALLATION' ? 'Instalasi' : 'Bulanan'}</td>
        <td class="text-right amount-cell">${formatCurrency(inv.amount)}</td>
      </tr>
    </tbody>
    <tfoot>
      <tr class="total-row">
        <td colspan="2">TOTAL</td>
        <td class="text-right">${formatCurrency(inv.amount)}</td>
      </tr>
    </tfoot>
  </table>

  <div class="footer">
    <div class="footer-note">
      ${inv.status === 'PAID'
        ? `Pembayaran diterima melalui ${inv.paymentSource || 'sistem'}. Terima kasih telah membayar tepat waktu.`
        : 'Harap lakukan pembayaran sebelum tanggal jatuh tempo. Hubungi kami jika ada pertanyaan.'}
    </div>
    <div class="print-date">EugineBill · ${printDate}</div>
  </div>
</div>
</body>
</html>`;

      const container = document.createElement('div');
      container.innerHTML = html;
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      document.body.appendChild(container);

      // @ts-ignore
      const html2pdf = (await import('html2pdf.js')).default;
      await html2pdf()
        .set({
          margin: 0,
          filename: `${inv.invoiceNumber}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, logging: false },
          jsPDF: { unit: 'mm', format: 'a5', orientation: 'portrait' },
          pagebreak: { mode: 'avoid-all' },
        })
        .from(container.firstElementChild)
        .save();

      document.body.removeChild(container);
      toast('success', 'PDF diunduh', `${inv.invoiceNumber}.pdf`);
    } catch (err) {
      toast('error', 'Gagal mengunduh PDF', 'Silakan coba lagi.');
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
