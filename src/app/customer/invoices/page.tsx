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
  if (inv.status === 'PAID')    return { label: 'Lunas',       cls: 'bg-green-500/20 text-green-400 border-green-500/30' };
  if (inv.status === 'OVERDUE') return { label: 'Jatuh Tempo', cls: 'bg-red-500/20 text-red-400 border-red-500/30' };
  if (inv.manualPaymentStatus === 'pending')  return { label: 'Menunggu Konfirmasi', cls: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' };
  if (inv.manualPaymentStatus === 'rejected') return { label: 'Ditolak',            cls: 'bg-red-500/20 text-red-400 border-red-500/30' };
  return { label: 'Belum Bayar', cls: 'bg-orange-500/20 text-orange-400 border-orange-500/30' };
};

const getPaymentSourceBadge = (src: string | null) => {
  switch (src) {
    case 'gateway': return { label: 'Payment Gateway',    Icon: CreditCard,   cls: 'text-cyan-400' };
    case 'manual':  return { label: 'Transfer Bank',      Icon: Banknote,     cls: 'text-purple-400' };
    case 'admin':   return { label: 'Dikonfirmasi Admin', Icon: ShieldCheck,  cls: 'text-green-400' };
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
    if (inv.paymentToken) {
      router.push(`/pay/${inv.paymentToken}`);
      return;
    }
    // Skip localhost links (created before baseUrl was configured)
    if (inv.paymentLink && !inv.paymentLink.includes('localhost')) { window.open(inv.paymentLink, '_blank'); return; }
    setPaying(inv.id);
    try {
      const token = localStorage.getItem('customer_token');
      const res = await fetch('/api/customer/invoice/regenerate-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ invoiceId: inv.id }),
      });
      const data = await res.json();
      if (data.paymentUrl || data.paymentLink || data.payment_url) {
        window.open(data.paymentUrl || data.paymentLink || data.payment_url, '_blank');
      } else {
        toast('error', 'Gagal', data.error || 'Gagal membuat link pembayaran');
      }
    } catch {
      toast('error', 'Error', 'Terjadi kesalahan');
    } finally {
      setPaying(null);
    }
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
    <div className="p-4 lg:p-6 space-y-4 w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Receipt className="w-5 h-5 text-cyan-400" />
            Tagihan
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">{pagination.total} tagihan ditemukan</p>
        </div>
        <button
          onClick={() => { setRefreshing(true); fetchInvoices(currentPage.current, statusFilter); }}
          disabled={refreshing || loading}
          className="p-2 rounded-xl border border-cyan-500/30 hover:bg-cyan-500/10 transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 text-cyan-400 ${refreshing ? 'animate-spin' : ''}`} />
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
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                active
                  ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/40 shadow-[0_0_10px_rgba(6,182,212,0.15)]'
                  : 'text-slate-400 border-slate-700/50 hover:border-slate-600 hover:text-slate-300'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Invoice List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full mx-auto" />
            <p className="mt-3 text-slate-400 text-sm">Memuat tagihan…</p>
          </div>
        </div>
      ) : invoices.length === 0 ? (
        <CyberCard className="text-center py-16">
          <Receipt className="w-14 h-14 mx-auto text-slate-600 mb-4" />
          <p className="text-slate-400 font-medium">Tidak ada tagihan</p>
          <p className="text-slate-500 text-sm mt-1">
            {statusFilter !== 'all' ? 'Coba pilih filter lain' : 'Belum ada tagihan tercatat'}
          </p>
        </CyberCard>
      ) : (
        <div className="space-y-3">
          {invoices.map(inv => {
            const statusBadge = getStatusBadge(inv);
            const srcBadge    = getPaymentSourceBadge(inv.paymentSource);
            const payable     = isPayable(inv);
            const isPaying    = paying === inv.id;

            return (
              <CyberCard key={inv.id} className="hover:border-cyan-500/30 transition-colors">
                <div className="p-4 sm:p-5 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Invoice number + type */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-cyan-400 font-mono">{inv.invoiceNumber}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700/50 text-slate-400 border border-slate-600/30">
                        {INVOICE_TYPE_LABEL[inv.invoiceType] || inv.invoiceType}
                      </span>
                    </div>

                    {inv.profileName && (
                      <p className="text-xs text-slate-400 mt-1">Paket: {inv.profileName}</p>
                    )}

                    {/* Amount */}
                    <p className="text-lg font-bold text-white mt-1">
                      Rp {inv.amount.toLocaleString('id-ID')}
                    </p>

                    {/* Dates */}
                    <div className="flex items-center gap-4 mt-2 flex-wrap">
                      <div className="flex items-center gap-1 text-[11px] text-slate-500">
                        <CalendarClock className="w-3 h-3" />
                        Jatuh tempo: {formatWIB(inv.dueDate, 'd MMM yyyy')}
                      </div>
                      {inv.paidAt && (
                        <div className="flex items-center gap-1 text-[11px] text-green-500">
                          <CheckCircle className="w-3 h-3" />
                          Lunas: {formatWIB(inv.paidAt, 'd MMM yyyy')}
                        </div>
                      )}
                    </div>

                    {/* Payment source + manual status */}
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      {srcBadge && (
                        <div className={`flex items-center gap-1 text-[10px] font-medium ${srcBadge.cls}`}>
                          <srcBadge.Icon className="w-3 h-3" />
                          {srcBadge.label}
                        </div>
                      )}
                      {inv.manualPaymentStatus === 'pending' && (
                        <span className="flex items-center gap-1 text-[10px] text-yellow-400 animate-pulse font-medium">
                          <Clock className="w-3 h-3" />
                          Menunggu konfirmasi admin…
                        </span>
                      )}
                      {inv.manualPaymentBank && (
                        <span className="text-[10px] text-slate-500">via {inv.manualPaymentBank}</span>
                      )}
                    </div>
                  </div>

                  {/* Right: status badge + pay button */}
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border whitespace-nowrap ${statusBadge.cls}`}>
                      {statusBadge.label}
                    </span>
                    {payable && (
                      <div className="flex flex-col gap-1.5">
                        <CyberButton
                          onClick={() => handlePayInvoice(inv)}
                          disabled={isPaying}
                          variant="cyan"
                          className="w-full justify-center text-xs"
                          size="sm"
                        >
                          {isPaying ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <><ExternalLink className="w-3.5 h-3.5 mr-1" />Bayar Sekarang</>
                          )}
                        </CyberButton>
                      </div>
                    )}
                  </div>
                </div>
              </CyberCard>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {!loading && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => handlePage(pagination.page - 1)}
            disabled={pagination.page <= 1}
            className="p-2 rounded-xl border border-slate-700 hover:border-cyan-500/40 hover:bg-cyan-500/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4 text-slate-300" />
          </button>
          <span className="text-sm text-slate-400">
            Halaman <span className="font-bold text-white">{pagination.page}</span> / {pagination.totalPages}
          </span>
          <button
            onClick={() => handlePage(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages}
            className="p-2 rounded-xl border border-slate-700 hover:border-cyan-500/40 hover:bg-cyan-500/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4 text-slate-300" />
          </button>
        </div>
      )}

      <SimpleModal isOpen={printDialogInvoice !== null} onClose={() => setPrintDialogInvoice(null)} size="sm">
        <ModalHeader>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-full bg-primary/15 border border-primary/30">
              <Printer className="w-4 h-4 text-primary" />
            </div>
            <div>
              <ModalTitle>Pilih Jenis Printer</ModalTitle>
              <ModalDescription className="font-mono">{printDialogInvoice?.invoiceNumber}</ModalDescription>
            </div>
          </div>
        </ModalHeader>
        <ModalBody className="space-y-2 pb-2">
          <button
            onClick={() => {
              if (!printDialogInvoice) return;
              const invoiceId = printDialogInvoice.id;
              setPrintDialogInvoice(null);
              void handlePrintStandard(invoiceId);
            }}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors"
          >
            <FileText className="w-5 h-5 flex-shrink-0" />
            <div className="text-left">
              <div className="text-sm font-bold">Standar Printer</div>
              <div className="text-[11px] opacity-80">A4 / Letter - invoice lengkap</div>
            </div>
          </button>
          <button
            onClick={() => {
              if (!printDialogInvoice) return;
              const invoiceId = printDialogInvoice.id;
              setPrintDialogInvoice(null);
              void handlePrintThermal(invoiceId);
            }}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
          >
            <Printer className="w-5 h-5 flex-shrink-0" />
            <div className="text-left">
              <div className="text-sm font-bold">Thermal Printer</div>
              <div className="text-[11px] opacity-80">58mm / 80mm - struk kasir</div>
            </div>
          </button>
        </ModalBody>
        <ModalFooter>
          <ModalButton variant="secondary" onClick={() => setPrintDialogInvoice(null)}>Batal</ModalButton>
        </ModalFooter>
      </SimpleModal>


    </div>
  );
}



