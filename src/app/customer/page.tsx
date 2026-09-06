'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Loader2, Wifi, ArrowDown, ArrowUp, Calendar, CreditCard, 
  FileText, ShieldCheck, ChevronRight, Eye, CheckCircle2, 
  AlertCircle, Clock, Zap, Headphones, ArrowRight, ExternalLink,
  Receipt, ArrowUpRight
} from 'lucide-react';
import { useToast } from '@/components/cyberpunk/CyberToast';
import { formatWIB, nowWIB } from '@/lib/timezone';

export const dynamic = 'force-dynamic';

interface CustomerUser {
  id: string;
  username: string;
  name: string;
  phone: string;
  email: string | null;
  status: string;
  expiredAt: Date;
  customerId?: string | null;
  profile: {
    name: string;
    downloadSpeed: number;
    uploadSpeed: number;
    price?: number;
  };
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  amount: number;
  status: string;
  dueDate: string;
  paidAt: string | null;
  paymentLink: string | null;
  paymentToken: string | null;
}

export default function CustomerDashboard() {
  const router = useRouter();
  const { addToast } = useToast();
  const toast = (type: 'success'|'error'|'info'|'warning', title: string, desc?: string) =>
    addToast({ type, title, description: desc, duration: type === 'error' ? 8000 : 5000 });
  const [user, setUser] = useState<CustomerUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [paymentGateways, setPaymentGateways] = useState<any[]>([]);

  useEffect(() => {
    loadUserData();
    loadInvoices();
    loadPaymentGateways();

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadInvoices();
      }
    };

    const handleAdminUpdate = () => {
      loadInvoices();
      loadUserData();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('customer-data-refresh', handleAdminUpdate);

    const interval = setInterval(() => {
      loadInvoices();
    }, 30_000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('customer-data-refresh', handleAdminUpdate);
      clearInterval(interval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const loadPaymentGateways = async () => {
    try {
      const res = await fetch('/api/public/payment-gateways');
      const data = await res.json();
      if (data.success) {
        setPaymentGateways(data.gateways || []);
      }
    } catch (error) {
      console.error('Load payment gateways error:', error);
    }
  };

  const loadUserData = async () => {
    const token = localStorage.getItem('customer_token');
    if (!token) { router.push('/customer/login'); return; }

    try {
      const res = await fetch('/api/customer/me', { headers: { 'Authorization': `Bearer ${token}` } });
      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem('customer_token');
          router.push('/customer/login');
          return;
        }
        throw new Error('Failed to fetch user data');
      }
      const data = await res.json();
      if (data.success && data.user) {
        setUser({
          ...data.user,
          expiredAt: new Date(data.user.expiredAt)
        });
      }
    } catch (error) {
      console.error('Load user data error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadInvoices = async () => {
    const token = localStorage.getItem('customer_token');
    if (!token) return;

    try {
      const res = await fetch('/api/customer/invoices?limit=10', { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      if (data.success && data.data && data.data.invoices) {
        const raw = data.data.invoices;
        const sorted = [
          ...raw.filter((inv: any) => inv.status === 'PENDING' || inv.status === 'OVERDUE'),
          ...raw.filter((inv: any) => inv.status !== 'PENDING' && inv.status !== 'OVERDUE'),
        ];
        setInvoices(sorted);
      }
    } catch (error) {
      console.error('Load invoices error:', error);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

  if (loading) {
    return (
      <div className="p-3 flex justify-center items-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  const expiredDate = new Date(user.expiredAt);
  const formattedDueDate = expiredDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' });
  const isExpired = expiredDate < nowWIB();
  const daysLeft = Math.ceil((expiredDate.getTime() - nowWIB().getTime()) / (1000 * 60 * 60 * 24));
  const activeUnpaidInvoices = invoices.filter(inv => inv.status === 'PENDING' || inv.status === 'OVERDUE');
  const latestInvoice = invoices[0];

    return (
    <main className="max-w-[1280px] mx-auto px-4 md:px-8 py-6 pb-28 md:pb-8">
      {/* ── Hero Section ── */}
      <section className="mb-6 flex justify-between items-start md:items-center flex-col md:flex-row gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-slate-500">
              ID Pelanggan:
            </span>
            <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
              {user.customerId || user.username}
            </span>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 leading-tight tracking-tight">
            {user.name}
          </h2>
        </div>

        <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-bold uppercase tracking-wider border shadow-2xs ${
          user.status === 'ISOLATED' || isExpired
            ? 'bg-red-50 text-red-700 border-red-200'
            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
        }`}>
          <span className={`w-2 h-2 rounded-full ${user.status === 'ISOLATED' || isExpired ? 'bg-red-500 animate-pulse' : 'bg-emerald-500 animate-pulse'}`} />
          <span>{user.status === 'ISOLATED' || isExpired ? 'Terisolir' : 'Layanan Aktif'}</span>
        </div>
      </section>

      {/* ── Bento Grid ── */}
      <div className="grid grid-cols-4 md:grid-cols-8 lg:grid-cols-12 gap-5">

        {/* ── Paket Langganan Card (Oceanic Blue Gradient) ── */}
        <div className={`bento-card col-span-4 ${!latestInvoice ? 'md:col-span-8 lg:col-span-12' : 'md:col-span-8 lg:col-span-8'} relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-gradient-to-r from-[#001c39] via-[#002c60] to-[#0a3674] text-white border-none shadow-lg p-6 sm:p-7 rounded-2xl`}>
          {/* Fiber network abstract background image */}
          <div 
            className="absolute inset-0 opacity-30 mix-blend-luminosity bg-cover bg-center pointer-events-none" 
            style={{ backgroundImage: "url('/images/card_net_bg.png')" }} 
          />
          {/* Glassmorphic gradient overlay for optimal readability */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#001b3e]/90 via-[#002c60]/80 to-transparent pointer-events-none" />

          <div className="flex-1 relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-blue-200/90">
                Paket Langganan
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-mono text-[9px] font-bold uppercase tracking-wider bg-white/10 text-cyan-200 border border-cyan-300/30 backdrop-blur-xs">
                <Wifi className="w-3 h-3 text-cyan-300" />
                Fiber Unlimited
              </span>
            </div>

            <div className="text-2xl md:text-3xl font-bold text-white leading-tight tracking-tight drop-shadow-xs">
              {user.profile?.name || '-'}
            </div>

            <div className="flex flex-wrap items-center gap-2.5 mt-3.5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/10 border border-white/15 backdrop-blur-xs text-xs font-mono font-medium text-blue-100">
                <ArrowDown className="w-3.5 h-3.5 text-cyan-300" />
                <span>Up to {user.profile?.downloadSpeed || 0} Mbps</span>
              </div>
              {user.profile?.uploadSpeed ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/10 border border-white/15 backdrop-blur-xs text-xs font-mono font-medium text-blue-100">
                  <ArrowUp className="w-3.5 h-3.5 text-cyan-300" />
                  <span>Up to {user.profile.uploadSpeed} Mbps</span>
                </div>
              ) : null}
            </div>
          </div>

          <div className="w-full md:w-px md:h-20 bg-white/15 md:mx-2 shrink-0 relative z-10" />

          <div className="relative z-10 min-w-[160px]">
            <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-blue-200/90 mb-1">
              Jatuh Tempo
            </p>
            <div className="text-xl font-bold text-white">{formattedDueDate}</div>
            <div className="flex items-center gap-2 mt-2">
              <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg font-mono text-[10px] font-bold uppercase tracking-wider border backdrop-blur-md ${
                isExpired
                  ? 'bg-red-500/25 text-red-200 border-red-400/40'
                  : daysLeft <= 7
                  ? 'bg-amber-500/25 text-amber-200 border-amber-400/40'
                  : 'bg-emerald-500/25 text-emerald-200 border-emerald-400/40'
              }`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                <span>{isExpired ? 'Kedaluwarsa' : `Tersisa ${daysLeft} Hari`}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Tagihan Terbaru Card ── */}
        {latestInvoice && (
          <div className={`bento-card col-span-4 md:col-span-4 lg:col-span-4 relative overflow-hidden flex flex-col justify-between bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm ${
            latestInvoice.status === 'PENDING' || latestInvoice.status === 'OVERDUE'
              ? 'border-l-[4px] border-l-red-500'
              : 'border-l-[4px] border-l-emerald-500'
          }`}>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-1.5">
                <p className={`font-mono text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                  latestInvoice.status === 'PAID' ? 'text-emerald-700' : 'text-red-700'
                }`}>
                  <Receipt className="w-3.5 h-3.5" />
                  <span>{latestInvoice.status === 'PAID' ? 'Tagihan Terakhir (Lunas)' : 'Tagihan Belum Dibayar'}</span>
                </p>
                <span className={`px-2 py-0.5 rounded-md font-mono text-[9px] font-bold uppercase ${
                  latestInvoice.status === 'PAID' 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                    : latestInvoice.status === 'OVERDUE' 
                    ? 'bg-red-50 text-red-700 border border-red-200' 
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}>
                  {latestInvoice.status === 'PAID' ? 'LUNAS' : latestInvoice.status === 'OVERDUE' ? 'JATUH TEMPO' : 'MENUNGGU'}
                </span>
              </div>

              <p className="font-mono text-xs text-slate-500 mb-2">{latestInvoice.invoiceNumber}</p>
              
              <div className="text-3xl font-bold text-slate-900 tracking-tight">
                {formatCurrency(latestInvoice.amount)}
              </div>

              <p className="font-mono text-[11px] text-slate-500 mt-1.5">
                {latestInvoice.status === 'PAID'
                  ? `Dibayar: ${new Date(latestInvoice.paidAt!).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' })}`
                  : `Jatuh tempo: ${new Date(latestInvoice.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' })}`
                }
              </p>
            </div>

            <div className="flex gap-2 mt-5 relative z-10">
              <button
                onClick={() => router.push(`/invoice/${latestInvoice.invoiceNumber}`)}
                className="flex-1 bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors py-2.5 px-3 rounded-xl font-mono text-xs uppercase font-bold tracking-wider flex justify-center items-center gap-1.5 cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Lihat</span>
              </button>

              {(latestInvoice.status === 'PENDING' || latestInvoice.status === 'OVERDUE') && (latestInvoice.paymentLink || latestInvoice.paymentToken) && (
                <button
                  onClick={() => {
                    if (latestInvoice.paymentLink && latestInvoice.paymentLink.startsWith('http')) {
                      window.location.href = latestInvoice.paymentLink;
                    } else {
                      router.push(`/pay/${latestInvoice.paymentToken}`);
                    }
                  }}
                  className="flex-1 bg-[#002c60] hover:bg-[#1b437c] text-white shadow-sm shadow-[#002c60]/20 transition-all py-2.5 px-3 rounded-xl font-mono text-xs uppercase font-bold tracking-wider flex justify-center items-center gap-1.5 cursor-pointer"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Bayar</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Quick Actions Bento ── */}
        <div className="col-span-4 md:col-span-8 lg:col-span-12">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider font-mono mb-3">
            Aksi Cepat
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            {[
              { icon: FileText, label: 'Tagihan & Invois', href: '/customer/invoices', color: 'bg-blue-50 text-[#002c60]' },
              { icon: Wifi, label: 'Pengaturan Wi-Fi', href: '/customer/wifi', color: 'bg-cyan-50 text-cyan-700' },
              { icon: Zap, label: 'Ubah Kecepatan', href: '/customer/upgrade', color: 'bg-amber-50 text-amber-700' },
              { icon: Headphones, label: 'Pusat Bantuan', href: '/customer/tickets', color: 'bg-emerald-50 text-emerald-700' },
            ].map(({ icon: Icon, label, href, color }) => (
              <button
                key={href}
                onClick={() => router.push(href)}
                className="bg-white rounded-2xl border border-slate-200/80 p-4.5 flex flex-col items-center justify-center gap-2.5 hover:shadow-md hover:border-slate-300 transition-all duration-200 cursor-pointer group min-h-[104px]"
              >
                <div className={`w-11 h-11 rounded-xl ${color} flex items-center justify-center group-hover:scale-110 transition-transform duration-200 shadow-2xs`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="font-mono text-xs font-bold text-slate-800 uppercase tracking-wider text-center leading-snug">
                  {label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Riwayat Transaksi Singkat ── */}
        {invoices.length > 0 && (
          <div className="col-span-4 md:col-span-8 lg:col-span-12">
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider font-mono">
                  Riwayat Transaksi Terakhir
                </h3>
                <button
                  onClick={() => router.push('/customer/invoices')}
                  className="font-mono text-xs font-bold uppercase tracking-wider text-[#002c60] hover:underline cursor-pointer flex items-center gap-1"
                >
                  <span>Lihat Semua</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-mono font-bold uppercase text-slate-500 tracking-wider">
                      <th className="py-3 px-6">Nomor Tagihan</th>
                      <th className="py-3 px-6">Jatuh Tempo</th>
                      <th className="py-3 px-6">Jumlah</th>
                      <th className="py-3 px-6">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {invoices.slice(0, 5).map(inv => (
                      <tr
                        key={inv.id}
                        onClick={() => router.push(`/invoice/${inv.invoiceNumber}`)}
                        className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                      >
                        <td className="py-3.5 px-6 font-mono font-medium text-slate-700">
                          {inv.invoiceNumber}
                        </td>
                        <td className="py-3.5 px-6 font-mono text-slate-600 whitespace-nowrap">
                          {new Date(inv.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' })}
                        </td>
                        <td className="py-3.5 px-6 font-mono font-bold text-slate-900 whitespace-nowrap">
                          {formatCurrency(inv.amount)}
                        </td>
                        <td className="py-3.5 px-6">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider border ${
                            inv.status === 'PAID'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : inv.status === 'OVERDUE'
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            {inv.status === 'PAID' ? 'Lunas' : inv.status === 'OVERDUE' ? 'Jatuh Tempo' : 'Menunggu'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}
