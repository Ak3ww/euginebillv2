'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Receipt, ArrowLeft, Loader2, CheckCircle2, Clock, 
  XCircle, Download, Eye, Search, AlertCircle, CreditCard,
  Building2, Banknote, ShieldCheck
} from 'lucide-react';

interface PaymentItem {
  id: string;
  invoiceNumber: string;
  amount: number;
  status: string;
  dueDate: string;
  paidAt: string | null;
  paymentToken: string | null;
  paymentLink: string | null;
  createdAt: string;
  invoiceType?: string;
  isPackageChange?: boolean;
  packageChangeDescription?: string | null;
  manualPaymentId?: string | null;
  manualPaymentStatus?: string | null;
  manualPaymentBank?: string | null;
  manualPaymentAccountName?: string | null;
  manualPaymentRejectionReason?: string | null;
  paymentSource?: 'gateway' | 'manual' | 'admin' | null;
}

export default function HistoryPage() {
  const router = useRouter();
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'paid' | 'pending' | 'rejected'>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadPaymentHistory();
  }, []);

  const loadPaymentHistory = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('customer_token') : null;
    if (!token) {
      router.push('/customer/login');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/customer/payment-history', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem('customer_token');
          router.push('/customer/login');
          return;
        }
        throw new Error('Gagal mengambil data riwayat pembayaran');
      }

      const data = await res.json();
      if (data.success && Array.isArray(data.payments)) {
        setPayments(data.payments);
      }
    } catch (err) {
      console.error('Fetch payment history error:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

  const downloadPdf = async (item: PaymentItem) => {
    setDownloadingId(item.id);
    try {
      const res = await fetch(`/invoice/${item.invoiceNumber}/pdf`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Faktur-${item.invoiceNumber}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        window.location.href = `/invoice/${item.invoiceNumber}/pdf`;
      }
    } catch {
      window.location.href = `/invoice/${item.invoiceNumber}/pdf`;
    } finally {
      setDownloadingId(null);
    }
  };

  // Metrics
  const paidPayments = payments.filter(p => p.status === 'PAID');
  const totalPaidAmount = paidPayments.reduce((sum, p) => sum + p.amount, 0);
  const pendingCount = payments.filter(p => p.status === 'PENDING' || p.manualPaymentStatus === 'pending').length;

  // Filtered list
  const filteredPayments = payments.filter(p => {
    // Filter status
    if (filter === 'paid' && p.status !== 'PAID') return false;
    if (filter === 'pending' && p.status !== 'PENDING' && p.manualPaymentStatus !== 'pending') return false;
    if (filter === 'rejected' && p.manualPaymentStatus !== 'rejected') return false;

    // Search query
    if (search) {
      const q = search.toLowerCase();
      const matchInv = p.invoiceNumber.toLowerCase().includes(q);
      const matchBank = p.manualPaymentBank?.toLowerCase().includes(q);
      if (!matchInv && !matchBank) return false;
    }

    return true;
  });

  return (
    <main className="max-w-[1280px] mx-auto px-4 md:px-8 py-6 pb-28 md:pb-8">
      {/* ── Back button ── */}
      <button 
        onClick={() => router.push('/customer')}
        className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors uppercase font-mono tracking-wider mb-6 cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Kembali ke Beranda</span>
      </button>

      {/* ── Page Header ── */}
      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
            Riwayat Pembayaran
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Catatan transaksi pembayaran tagihan dan riwayat langganan Anda.
          </p>
        </div>

        {/* Status Filter Pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
          {[
            { id: 'all', label: 'Semua' },
            { id: 'paid', label: 'Lunas' },
            { id: 'pending', label: 'Menunggu' },
            { id: 'rejected', label: 'Ditolak' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id as any)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-mono font-bold uppercase tracking-wider whitespace-nowrap transition-all border cursor-pointer ${
                filter === tab.id
                  ? 'bg-[#002c60] text-white border-[#002c60] shadow-xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Total Terbayar
            </p>
            <p className="text-xl font-bold text-slate-900 mt-0.5">
              {formatCurrency(totalPaidAmount)}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#002c60] flex items-center justify-center shrink-0">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Transaksi Lunas
            </p>
            <p className="text-xl font-bold text-slate-900 mt-0.5">
              {paidPayments.length} Transaksi
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Menunggu Pembayaran
            </p>
            <p className="text-xl font-bold text-slate-900 mt-0.5">
              {pendingCount} Transaksi
            </p>
          </div>
        </div>
      </div>

      {/* ── Search Bar ── */}
      <div className="mb-5 relative">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
          <Search className="w-4 h-4" />
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari nomor invoice (contoh: INV-2026...)"
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#002c60] transition-colors shadow-2xs"
        />
      </div>

      {/* ── Payments List ── */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#002c60]" />
          <p className="text-xs font-mono text-slate-500 uppercase tracking-wider">Memuat riwayat pembayaran...</p>
        </div>
      ) : filteredPayments.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Receipt className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">Belum Ada Riwayat Pembayaran</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Transaksi pembayaran Anda yang telah selesai atau sedang diproses akan muncul di halaman ini.
          </p>
          <button
            onClick={() => router.push('/customer/invoices')}
            className="mt-4 px-4 py-2 bg-[#002c60] hover:bg-[#1b437c] text-white text-xs font-bold font-mono uppercase tracking-wider rounded-xl transition-all shadow-xs cursor-pointer"
          >
            Lihat Tagihan Aktif
          </button>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredPayments.map((item) => {
            const isPaid = item.status === 'PAID';
            const isRejected = item.manualPaymentStatus === 'rejected';
            const isPending = !isPaid && !isRejected;

            const dateDisplay = item.paidAt
              ? new Date(item.paidAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' })
              : new Date(item.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' });

            const sourceLabel = item.paymentSource === 'gateway' 
              ? 'Payment Gateway / QRIS' 
              : item.manualPaymentBank 
              ? `Transfer Bank (${item.manualPaymentBank})`
              : item.paymentSource === 'admin'
              ? 'Kasir / Loket Pembayaran'
              : 'Pembayaran Tagihan';

            return (
              <div 
                key={item.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                {/* Left: Info */}
                <div className="flex items-start gap-3.5">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                    isPaid ? 'bg-emerald-50 text-emerald-600' :
                    isRejected ? 'bg-red-50 text-red-600' :
                    'bg-amber-50 text-amber-600'
                  }`}>
                    {isPaid ? <CheckCircle2 className="w-5 h-5" /> :
                     isRejected ? <XCircle className="w-5 h-5" /> :
                     <Clock className="w-5 h-5" />}
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-mono text-sm font-bold text-slate-900">
                        {item.invoiceNumber}
                      </span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider border ${
                        isPaid 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                          : isRejected 
                          ? 'bg-red-50 text-red-700 border-red-200' 
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {isPaid ? 'Lunas' : isRejected ? 'Ditolak' : 'Menunggu'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 flex items-center gap-2">
                      <span>{dateDisplay}</span>
                      <span>•</span>
                      <span className="font-medium text-slate-600">{sourceLabel}</span>
                    </p>

                    {item.packageChangeDescription && (
                      <p className="text-[11px] text-blue-600 font-medium mt-1">
                        {item.packageChangeDescription}
                      </p>
                    )}

                    {isRejected && item.manualPaymentRejectionReason && (
                      <p className="text-[11px] text-red-600 font-medium mt-1">
                        Alasan Ditolak: {item.manualPaymentRejectionReason}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right: Amount & Actions */}
                <div className="flex items-center justify-between sm:justify-end gap-3 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                  <div className="text-left sm:text-right">
                    <p className="font-mono text-base sm:text-lg font-bold text-slate-900">
                      {formatCurrency(item.amount)}
                    </p>
                    <p className="font-mono text-[10px] text-slate-400 uppercase tracking-wider">
                      {isPaid ? 'Terverifikasi' : 'Total Tagihan'}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => router.push(`/invoice/${item.invoiceNumber}`)}
                      className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer"
                      title="Lihat Faktur"
                    >
                      <Eye className="w-4 h-4" />
                    </button>

                    {isPaid && (
                      <button
                        onClick={() => downloadPdf(item)}
                        disabled={downloadingId === item.id}
                        className="p-2.5 bg-blue-50 hover:bg-blue-100 text-[#002c60] rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                        title="Unduh PDF"
                      >
                        {downloadingId === item.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
