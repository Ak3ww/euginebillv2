'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Receipt, CheckCircle, Clock, AlertCircle, Loader2,
  RefreshCw, CreditCard, ExternalLink, ChevronLeft, ChevronRight,
  Banknote, ShieldCheck, CalendarClock, Printer, FileText, Check,
} from 'lucide-react';
import { SimpleModal, ModalHeader, ModalTitle, ModalDescription, ModalBody } from '@/components/cyberpunk';
import { useToast } from '@/components/cyberpunk/CyberToast';
import { formatWIB } from '@/lib/timezone';
import { printInvoiceStandard, printInvoiceThermal } from '@/lib/invoice-print';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

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
  if (inv.status === 'PAID')    return { label: 'PAID',       cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
  if (inv.status === 'OVERDUE') return { label: 'OVERDUE',    cls: 'bg-red-500/10 text-red-400 border-red-500/20' };
  if (inv.manualPaymentStatus === 'pending')  return { label: 'VERIFIKASI', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
  if (inv.manualPaymentStatus === 'rejected') return { label: 'DITOLAK',  cls: 'bg-red-500/10 text-red-400 border-red-500/20' };
  return { label: 'MENUNGGU', cls: 'bg-white/10 text-white border-white/20' };
};

const getPaymentSourceBadge = (src: string | null) => {
  switch (src) {
    case 'gateway': return { label: 'GATEWAY',    Icon: CreditCard,   cls: 'text-blue-400' };
    case 'manual':  return { label: 'MANUAL',     Icon: Banknote,     cls: 'text-purple-400' };
    case 'admin':   return { label: 'ADMIN',      Icon: ShieldCheck,  cls: 'text-emerald-400' };
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
  const containerRef    = useRef<HTMLDivElement>(null);

  const toast = (type: 'success' | 'error' | 'info', title: string, desc?: string) =>
    addToast({ type, title, description: desc, duration: type === 'error' ? 8000 : 5000 });

  useGSAP(() => {
    if (!loading && invoices.length > 0) {
      gsap.fromTo('.invoice-row', 
        { y: 30, opacity: 0, scale: 0.98, rotationX: 5 },
        { y: 0, opacity: 1, scale: 1, rotationX: 0, duration: 0.6, stagger: 0.05, ease: 'power2.out', clearProps: 'all' }
      );
    }
  }, { scope: containerRef, dependencies: [invoices, loading] });

  // 3D Hover Effect
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -2;
    const rotateY = ((x - centerX) / centerX) * 2;
    gsap.to(card, { rotateX, rotateY, duration: 0.4, ease: "power2.out", transformPerspective: 1000 });
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    gsap.to(e.currentTarget, { rotateX: 0, rotateY: 0, duration: 0.7, ease: "power2.out" });
  };

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
  }, [statusFilter, fetchInvoices, router]);

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      fetchInvoices(currentPage.current, statusFilter, true);
    }, 15_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [statusFilter, fetchInvoices]);

  useEffect(() => {
    const onRefresh = () => fetchInvoices(currentPage.current, statusFilter, true);
    window.addEventListener('customer-data-refresh', onRefresh);
    return () => window.removeEventListener('customer-data-refresh', onRefresh);
  }, [statusFilter, fetchInvoices]);

  const handlePayInvoice = async (inv: Invoice) => {
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

  return (
    <div ref={containerRef} className="p-4 lg:p-8 max-w-5xl mx-auto space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-white/10">
        <div>
          <h1 className="text-xl lg:text-3xl font-display font-medium flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.15)]">
              <Receipt className="w-6 h-6 text-blue-400" />
            </div>
            Billing Records
          </h1>
          <p className="text-[10px] font-mono opacity-50 uppercase mt-2 tracking-widest">FOUND {pagination.total} ENTRIES</p>
        </div>
        <button
          onClick={() => { setRefreshing(true); fetchInvoices(currentPage.current, statusFilter); }}
          disabled={refreshing || loading}
          className="p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
        {STATUS_TABS.map(tab => {
          const Icon = tab.icon;
          const active = statusFilter === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider whitespace-nowrap transition-all border ${
                active
                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.15)]'
                  : 'glass-panel text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Invoice List */}
      <div className="min-h-[400px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin mb-4 text-blue-400" />
            <p className="text-xs font-mono uppercase tracking-widest">Fetching records...</p>
          </div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-gray-400">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 mb-4">
              <Receipt className="w-12 h-12 opacity-50" />
            </div>
            <p className="text-sm font-medium">NO_RECORDS_FOUND</p>
            <p className="text-[10px] font-mono uppercase mt-2 opacity-50">
              {statusFilter !== 'all' ? 'Try adjusting filters' : 'System log is empty'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {invoices.map((inv, idx) => {
              const statusBadge = getStatusBadge(inv);
              const srcBadge    = getPaymentSourceBadge(inv.paymentSource);
              const payable     = isPayable(inv);
              const isPaying    = paying === inv.id;

              return (
                <div 
                  key={inv.id} 
                  className="invoice-row glass-panel p-5 lg:p-6 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative overflow-hidden group hover:bg-white/[0.05] transition-colors floating-element"
                  onMouseMove={handleMouseMove}
                  onMouseLeave={handleMouseLeave}
                >
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                    inv.status === 'PAID' ? 'bg-emerald-500/50' : inv.status === 'OVERDUE' ? 'bg-red-500/50' : 'bg-blue-500/50'
                  }`} />
                  
                  <div className="flex-1 min-w-0 pl-2">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-sm font-bold font-mono tracking-wide">{inv.invoiceNumber}</span>
                      <span className="text-[9px] px-2 py-0.5 rounded font-mono uppercase tracking-wider bg-white/5 text-gray-400 border border-white/10">
                        {INVOICE_TYPE_LABEL[inv.invoiceType] || inv.invoiceType}
                      </span>
                    </div>

                    {inv.profileName && (
                      <p className="text-xs font-mono opacity-60 uppercase mb-3">Plan: {inv.profileName}</p>
                    )}

                    <p className="text-xl lg:text-2xl font-display font-semibold mt-1">
                      Rp {inv.amount.toLocaleString('id-ID')}
                    </p>

                    <div className="flex items-center gap-4 mt-3 flex-wrap">
                      <div className="flex items-center gap-1.5 text-[10px] font-mono opacity-60 uppercase">
                        <CalendarClock className="w-3.5 h-3.5" />
                        DUE: {formatWIB(inv.dueDate, 'dd MMM yyyy')}
                      </div>
                      {inv.paidAt && (
                        <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400 uppercase">
                          <CheckCircle className="w-3.5 h-3.5" />
                          PAID: {formatWIB(inv.paidAt, 'dd MMM yyyy')}
                        </div>
                      )}
                    </div>

                    {/* Payment source */}
                    <div className="flex items-center gap-3 mt-4 flex-wrap">
                      {srcBadge && (
                        <div className={`flex items-center gap-1 text-[10px] font-mono font-bold uppercase ${srcBadge.cls}`}>
                          <srcBadge.Icon className="w-3.5 h-3.5" />
                          {srcBadge.label}
                        </div>
                      )}
                      {inv.manualPaymentStatus === 'pending' && (
                        <span className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase text-amber-400 animate-pulse">
                          <Clock className="w-3.5 h-3.5" />
                          VERIFYING_PAYMENT...
                        </span>
                      )}
                      {inv.manualPaymentBank && (
                        <span className="text-[10px] font-mono opacity-60 uppercase">VIA: {inv.manualPaymentBank}</span>
                      )}
                    </div>
                  </div>

                  {/* Right Actions */}
                  <div className="flex flex-col sm:items-end gap-4 flex-shrink-0 mt-4 sm:mt-0">
                    <span className={`text-[10px] font-mono font-bold px-3 py-1.5 rounded uppercase tracking-wider border shadow-sm ${statusBadge.cls}`}>
                      {statusBadge.label}
                    </span>
                    {payable && (
                      <button
                        onClick={() => handlePayInvoice(inv)}
                        disabled={isPaying}
                        className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-400 text-xs font-mono font-bold rounded-xl transition-all shadow-[0_0_15px_rgba(59,130,246,0.1)] hover:shadow-[0_0_20px_rgba(59,130,246,0.2)] w-full sm:w-auto group-hover:scale-105"
                      >
                        {isPaying ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
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
        <div className="flex items-center justify-center gap-4 pt-6">
          <button
            onClick={() => handlePage(pagination.page - 1)}
            disabled={pagination.page <= 1}
            className="p-3 rounded-xl border border-white/10 glass-panel hover:bg-white/10 transition-colors disabled:opacity-30"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-xs font-mono opacity-60 uppercase bg-white/5 px-4 py-2 rounded-lg border border-white/10">
            PAGE <span className="font-bold text-white opacity-100">{pagination.page}</span> OF {pagination.totalPages}
          </span>
          <button
            onClick={() => handlePage(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages}
            className="p-3 rounded-xl border border-white/10 glass-panel hover:bg-white/10 transition-colors disabled:opacity-30"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}
