'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Receipt, CheckCircle, Clock, AlertCircle, Loader2,
  RefreshCw, CreditCard, ExternalLink, ChevronLeft, ChevronRight,
  Banknote, ShieldCheck, CalendarClock, Printer, FileText, Check,
} from 'lucide-react';
import { CyberCard, CyberButton, SimpleModal, ModalHeader, ModalTitle, ModalDescription, ModalBody, ModalFooter, ModalButton } from '@/components/cyberpunk';
import { useToast } from '@/components/cyberpunk/CyberToast';
import { formatWIB } from '@/lib/timezone';
import { printInvoiceStandard, printInvoiceThermal } from '@/lib/invoice-print';

export const dynamic = 'force-dynamic';

// --- Types -------------------------------------------------------------------
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

// --- Config ------------------------------------------------------------------
const INVOICE_TYPE_LABEL: Record<string, string> = {
  MONTHLY: 'Bulanan', RENEWAL: 'Perpanjangan', ADDON: 'Tambahan',
  TOPUP: 'Top Up', INSTALLATION: 'Pemasangan',
};

type StatusFilter = 'all' | 'unpaid' | 'paid' | 'overdue';

const STATUS_TABS: { key: StatusFilter; label: string; icon: React.ElementType }[] = [
  { key: 'all',     label: 'Semua',        icon: Receipt },
  { key: 'unpaid',  label: 'Belum Bayar',  icon: Clock },
  { key: 'overdue', label: 'Jatuh Tempo',  icon: AlertCircle },
  { key: 'paid',    label: 'Lunas',        icon: CheckCircle },
];

const getStatusBadge = (inv: Invoice) => {
  if (inv.status === 'PAID')    return { label: 'PAID',       cls: 'bg-green-500/10 text-green-600 border-green-500/20' };
  if (inv.status === 'OVERDUE') return { label: 'OVERDUE',    cls: 'bg-red-500/10 text-red-600 border-red-500/20' };
  if (inv.manualPaymentStatus === 'pending')  return { label: 'VERIFIKASI', cls: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' };
  if (inv.manualPaymentStatus === 'rejected') return { label: 'DITOLAK',  cls: 'bg-red-500/10 text-red-600 border-red-500/20' };
  return { label: 'MENUNGGU', cls: 'bg-accent/10 text-accent border-accent/20' };
};

const getPaymentSourceBadge = (src: string | null) => {
  switch (src) {
    case 'gateway': return { label: 'GATEWAY',    Icon: CreditCard,   cls: 'text-accent' };
    case 'manual':  return { label: 'MANUAL',     Icon: Banknote,     cls: 'text-muted' };
    case 'admin':   return { label: 'ADMIN',      Icon: ShieldCheck,  cls: 'text-green-600' };
    default: return null;
  }
};

// --- Component ---------------------------------------------------------------
export default function CustomerInvoicesPage() {
  const router = useRouter();
  const { addToast } = useToast();

  const [invoices, setInvoices]     = useState<Invoice[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [paying, setPaying]         = useState<string | null>(null);
  const [printDialogInvoice, setPrintDialogInvoice] = useState<Invoice | null>(null);

  const pollRef         = useRef<NodeJS.Timeout | null>(null);
  const prevPendingIds  = useRef<Set<string>>(new Set());
  const currentPage     = useRef(1);

  const toast = (type: 'success' | 'error' | 'info', title: string, desc?: string) =>
    addToast({ type, title, description: desc, duration: type === 'error' ? 8000 : 5000 });

  const fetchInvoices = useCallback(async (page: number, filter: StatusFilter, silent = false) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('customer_token') : null;
    if (!token) { router.push('/customer/login'); return; }

    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '10' });
      if (filter !== 'all') params.set('status', filter);

      const res = await fetch(`/api/customer/invoices?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!data.success) {
        if (!silent) toast('error', 'Gagal', data.error || 'Gagal memuat tagihan');
        return;
      }

      const newInvoices: Invoice[] = data.data.invoices;
      setPagination(data.data.pagination);

      // Payment status tracking — detect when pending manual payments get resolved
      if (silent) {
        const pendingNow = new Set(newInvoices.filter(i => i.manualPaymentStatus === 'pending').map(i => i.id));
        prevPendingIds.current.forEach(id => {
          if (!pendingNow.has(id)) {
            const inv = newInvoices.find(i => i.id === id);
            if (inv?.status === 'PAID') {
              toast('success', '? Pembayaran Dikonfirmasi!', `Tagihan ${inv.invoiceNumber} telah lunas`);
            } else if (inv?.manualPaymentStatus === 'rejected') {
              toast('error', 'Pembayaran Ditolak', `Tagihan ${inv?.invoiceNumber} ditolak admin`);
            }
          }
        });
        prevPendingIds.current = pendingNow;
      }

      setInvoices(newInvoices);
    } catch {
      if (!silent) toast('error', 'Error', 'Terjadi kesalahan. Silakan coba lagi.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('customer_token') : null;
    if (!token) { router.push('/customer/login'); return; }
    currentPage.current = 1;
    fetchInvoices(1, statusFilter);
    fetchInvoices(1, statusFilter);
  }, [statusFilter, fetchInvoices, router]);

  // Auto-poll every 15s when pending manual payments exist (real-time payment tracking)
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      fetchInvoices(currentPage.current, statusFilter, true);
    }, 15_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [statusFilter, fetchInvoices]);

  // Global refresh event from notification system
  useEffect(() => {
    const onRefresh = () => fetchInvoices(currentPage.current, statusFilter, true);
    window.addEventListener('customer-data-refresh', onRefresh);
    return () => window.removeEventListener('customer-data-refresh', onRefresh);
  }, [statusFilter, fetchInvoices]);

  const handlePayInvoice = async (inv: Invoice) => {
    // Arahkan ke halaman detail invoice (sama tab, agar APK WebView tidak buka browser)
    router.push(`/invoice/${inv.invoiceNumber}`);
  };

  const handlePage = (p: number) => {
    if (p < 1 || p > pagination.totalPages) return;
    currentPage.current = p;
    fetchInvoices(p, statusFilter);
  };

  const handlePrintStandard = async (invoiceId: string) => {
    await printInvoiceStandard(invoiceId, toast);
  };

  const handlePrintThermal = async (invoiceId: string) => {
    await printInvoiceThermal(invoiceId, toast);
  };

  const isPayable = (inv: Invoice) =>
    inv.status !== 'PAID' && inv.manualPaymentStatus !== 'pending';

  // --- Render --------------------------------------------------------------
  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-6 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-rule">
        <div>
          <h1 className="text-xl lg:text-2xl font-display font-medium text-ink flex items-center gap-2">
            <Receipt className="w-5 h-5 text-cobalt" />
            Billing Records
          </h1>
          <p className="text-[10px] font-mono text-muted uppercase mt-1">FOUND {pagination.total} ENTRIES</p>
        </div>
        <button
          onClick={() => { setRefreshing(true); fetchInvoices(currentPage.current, statusFilter); }}
          disabled={refreshing || loading}
          className="p-2 rounded border border-rule hover:bg-muted/10 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 text-ink ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {STATUS_TABS.map(tab => {
          const Icon = tab.icon;
          const active = statusFilter === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider whitespace-nowrap transition-colors border ${
                active
                  ? 'bg-cobalt/5 text-cobalt border-cobalt/20'
                  : 'bg-paper text-muted border-rule hover:bg-muted/5 hover:text-ink'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Invoice List */}
      <div className="bg-paper border border-rule rounded-[10px] overflow-hidden shadow-sm min-h-[400px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted">
            <Loader2 className="w-6 h-6 animate-spin mb-4" />
            <p className="text-[10px] font-mono uppercase tracking-widest">Fetching records...</p>
          </div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted">
            <Receipt className="w-10 h-10 mb-4 opacity-50" />
            <p className="text-xs font-medium text-ink">NO_RECORDS_FOUND</p>
            <p className="text-[10px] font-mono uppercase mt-1">
              {statusFilter !== 'all' ? 'Try adjusting filters' : 'System log is empty'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-rule">
            {invoices.map(inv => {
              const statusBadge = getStatusBadge(inv);
              const srcBadge    = getPaymentSourceBadge(inv.paymentSource);
              const payable     = isPayable(inv);
              const isPaying    = paying === inv.id;

              return (
                <div key={inv.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/5 transition-colors">
                  <div className="flex-1 min-w-0">
                    {/* Invoice number + type */}
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] font-bold text-ink font-mono tracking-wide">{inv.invoiceNumber}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-mono uppercase tracking-wider bg-muted/10 text-muted border border-rule">
                        {INVOICE_TYPE_LABEL[inv.invoiceType] || inv.invoiceType}
                      </span>
                    </div>

                    {inv.profileName && (
                      <p className="text-[10px] font-mono text-muted uppercase">Plan: {inv.profileName}</p>
                    )}

                    {/* Amount */}
                    <p className="text-lg font-display font-semibold text-ink mt-2">
                      Rp {inv.amount.toLocaleString('id-ID')}
                    </p>

                    {/* Dates */}
                    <div className="flex items-center gap-4 mt-2 flex-wrap">
                      <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted uppercase">
                        <CalendarClock className="w-3.5 h-3.5" />
                        DUE: {formatWIB(inv.dueDate, 'dd MMM yyyy')}
                      </div>
                      {inv.paidAt && (
                        <div className="flex items-center gap-1.5 text-[10px] font-mono text-green-600 uppercase">
                          <CheckCircle className="w-3.5 h-3.5" />
                          PAID: {formatWIB(inv.paidAt, 'dd MMM yyyy')}
                        </div>
                      )}
                    </div>

                    {/* Payment source + manual status */}
                    <div className="flex items-center gap-3 mt-3 flex-wrap">
                      {srcBadge && (
                        <div className={`flex items-center gap-1 text-[9px] font-mono font-bold uppercase ${srcBadge.cls}`}>
                          <srcBadge.Icon className="w-3 h-3" />
                          {srcBadge.label}
                        </div>
                      )}
                      {inv.manualPaymentStatus === 'pending' && (
                        <span className="flex items-center gap-1 text-[9px] font-mono font-bold uppercase text-yellow-600 animate-pulse">
                          <Clock className="w-3 h-3" />
                          VERIFYING_PAYMENT...
                        </span>
                      )}
                      {inv.manualPaymentBank && (
                        <span className="text-[9px] font-mono text-muted uppercase">VIA: {inv.manualPaymentBank}</span>
                      )}
                    </div>
                  </div>

                  {/* Right: status badge + pay button */}
                  <div className="flex flex-col sm:items-end gap-3 flex-shrink-0 mt-4 sm:mt-0">
                    <span className={`text-[9px] font-mono font-bold px-2 py-1 rounded uppercase tracking-wider border ${statusBadge.cls}`}>
                      {statusBadge.label}
                    </span>
                    {payable && (
                      <button
                        onClick={() => handlePayInvoice(inv)}
                        disabled={isPaying}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-paper text-[11px] font-mono font-bold rounded-[6px] transition-colors w-full sm:w-auto"
                      >
                        {isPaying ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
                        Bayar Sekarang
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {!loading && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-2">
          <button
            onClick={() => handlePage(pagination.page - 1)}
            disabled={pagination.page <= 1}
            className="p-2 rounded border border-rule bg-paper hover:bg-muted/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4 text-ink" />
          </button>
          <span className="text-[11px] font-mono text-muted uppercase">
            PAGE <span className="font-bold text-ink">{pagination.page}</span> OF {pagination.totalPages}
          </span>
          <button
            onClick={() => handlePage(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages}
            className="p-2 rounded border border-rule bg-paper hover:bg-muted/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4 text-ink" />
          </button>
        </div>
      )}

      <SimpleModal isOpen={printDialogInvoice !== null} onClose={() => setPrintDialogInvoice(null)} size="sm">
        <ModalHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded bg-muted/10 border border-rule">
              <Printer className="w-4 h-4 text-ink" />
            </div>
            <div>
              <ModalTitle>Print Output Target</ModalTitle>
              <ModalDescription className="font-mono text-[10px] mt-1">{printDialogInvoice?.invoiceNumber}</ModalDescription>
            </div>
          </div>
        </ModalHeader>
        <ModalBody className="space-y-2 pb-4">
          <button
            onClick={() => {
              if (!printDialogInvoice) return;
              const invoiceId = printDialogInvoice.id;
              setPrintDialogInvoice(null);
              void handlePrintStandard(invoiceId);
            }}
            className="flex items-center gap-3 w-full px-4 py-3 rounded border border-rule hover:bg-muted/5 text-ink transition-colors"
          >
            <FileText className="w-5 h-5 text-muted flex-shrink-0" />
            <div className="text-left">
              <div className="text-sm font-display font-medium">Standard A4</div>
              <div className="text-[10px] font-mono text-muted mt-0.5">FULL_DOCUMENT</div>
            </div>
          </button>
          <button
            onClick={() => {
              if (!printDialogInvoice) return;
              const invoiceId = printDialogInvoice.id;
              setPrintDialogInvoice(null);
              void handlePrintThermal(invoiceId);
            }}
            className="flex items-center gap-3 w-full px-4 py-3 rounded border border-rule hover:bg-muted/5 text-ink transition-colors"
          >
            <Printer className="w-5 h-5 text-muted flex-shrink-0" />
            <div className="text-left">
              <div className="text-sm font-display font-medium">Thermal Receipt</div>
              <div className="text-[10px] font-mono text-muted mt-0.5">58mm_POS_FORMAT</div>
            </div>
          </button>
        </ModalBody>
      </SimpleModal>

    </div>
  );
}



