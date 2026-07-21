'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
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
    <main className="max-w-[1280px] mx-auto px-4 md:px-8 py-6 pb-32 md:pb-8">
      {/* === Hero Section === */}
      <section className="mb-6 flex justify-between items-start md:items-center flex-col md:flex-row gap-4">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--color-muted)] mb-1">ID Pelanggan: {user.customerId || user.username}</p>
          <h2 className="text-2xl md:text-[32px] font-display font-semibold text-[var(--color-ink)] leading-tight">{user.name}</h2>
        </div>
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono font-bold uppercase tracking-wider border ${
          user.status === 'ISOLATED' || isExpired
            ? 'bg-[var(--color-error-bg)] text-[var(--color-error)] border-[var(--color-error-border)]'
            : 'bg-[var(--color-success-bg)] text-[var(--color-success)] border-[var(--color-success-border)]'
        }`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
          {user.status === 'ISOLATED' || isExpired ? 'Terisolir' : 'Aktif'}
        </div>
      </section>

      {/* === Bento Grid === */}
      <div className="grid grid-cols-4 md:grid-cols-8 lg:grid-cols-12 gap-5">

        {/* Paket Langganan Card */}
        <div className={`bento-card col-span-4 ${!latestInvoice ? 'md:col-span-8 lg:col-span-12' : 'md:col-span-8 lg:col-span-8'} relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6`}>
          {/* Subtle router watermark background */}
          <div className="absolute -right-6 -bottom-6 opacity-[0.03] pointer-events-none">
            <span className="material-symbols-outlined text-[140px] text-[var(--color-ink)]" style={{ fontVariationSettings: "'FILL' 1" }}>
              router
            </span>
          </div>

          <div className="flex-1 relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <span className="section-header mb-0">Paket Langganan</span>
              <span className="px-2 py-0.5 rounded-full font-mono text-[9px] font-bold uppercase tracking-wider bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/20">
                Fiber Unlimited
              </span>
            </div>
            <div className="text-2xl md:text-[30px] font-display font-bold text-[var(--color-focus)] leading-tight tracking-tight">
              {user.profile?.name || '-'}
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-3">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[var(--radius-sm)] bg-[var(--color-paper-3)] border border-[var(--color-rule)] text-xs font-mono font-medium text-[var(--color-ink-2)]">
                <span className="material-symbols-outlined text-[16px] text-[var(--color-accent)]">download</span>
                Up to {user.profile?.downloadSpeed || 0} Mbps
              </div>
              {user.profile?.uploadSpeed ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[var(--radius-sm)] bg-[var(--color-paper-3)] border border-[var(--color-rule)] text-xs font-mono font-medium text-[var(--color-ink-2)]">
                  <span className="material-symbols-outlined text-[16px] text-[var(--color-accent)]">upload</span>
                  Up to {user.profile.uploadSpeed} Mbps
                </div>
              ) : null}
            </div>
          </div>

          <div className="w-full md:w-px md:h-16 bg-[var(--color-rule)] md:mx-2 shrink-0 relative z-10" />

          <div className="relative z-10 min-w-[160px]">
            <p className="section-header">Jatuh Tempo</p>
            <div className="text-xl font-display font-semibold text-[var(--color-ink)]">{formattedDueDate}</div>
            <div className="flex items-center gap-2 mt-2">
              <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded font-mono text-[10px] font-bold uppercase tracking-wider border ${
                isExpired
                  ? 'bg-[var(--color-error-bg)] text-[var(--color-error)] border-[var(--color-error-border)]'
                  : daysLeft <= 7
                  ? 'bg-[var(--color-warning-bg)] text-[var(--color-warning)] border-[var(--color-warning-border)]'
                  : 'bg-[var(--color-success-bg)] text-[var(--color-success)] border-[var(--color-success-border)]'
              }`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                {isExpired ? 'Kedaluwarsa' : `Tersisa ${daysLeft} Hari`}
              </div>
            </div>
          </div>
        </div>

        {/* Tagihan Terbaru Card */}
        {latestInvoice && (
          <div className={`bento-card col-span-4 md:col-span-4 lg:col-span-4 relative overflow-hidden flex flex-col justify-between ${
            latestInvoice.status === 'PENDING' || latestInvoice.status === 'OVERDUE'
              ? 'border-l-[3px] border-l-[var(--color-error)]'
              : 'border-l-[3px] border-l-[var(--color-success)]'
          }`}>
            <div className="absolute top-0 right-0 p-4 opacity-[0.03]">
              <span className="material-symbols-outlined text-[96px] text-[var(--color-ink)]" style={{ fontVariationSettings: "'FILL' 1" }}>
                {latestInvoice.status === 'PAID' ? 'check_circle' : 'receipt_long'}
              </span>
            </div>
            <div className="relative z-10">
              <p className={`font-mono text-[10px] font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5 ${
                latestInvoice.status === 'PAID' ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'
              }`}>
                <span className="material-symbols-outlined text-[14px]">receipt_long</span>
                {latestInvoice.status === 'PAID' ? 'Tagihan Terakhir (Lunas)' : 'Tagihan Belum Dibayar'}
              </p>
              <p className="font-mono text-xs text-[var(--color-muted)] mb-3">{latestInvoice.invoiceNumber}</p>
              <div className="text-3xl font-display font-semibold text-[var(--color-ink)]">
                {formatCurrency(latestInvoice.amount)}
              </div>
              <p className="font-mono text-[10px] text-[var(--color-muted)] mt-1.5">
                {latestInvoice.status === 'PAID'
                  ? `Dibayar: ${new Date(latestInvoice.paidAt!).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' })}`
                  : `Jatuh tempo: ${new Date(latestInvoice.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' })}`
                }
              </p>
            </div>
            <div className="flex gap-2 mt-5 relative z-10">
              <button
                onClick={() => router.push(`/invoice/${latestInvoice.invoiceNumber}`)}
                className="flex-1 bg-[var(--color-paper-3)] text-[var(--color-ink-2)] border border-[var(--color-rule)] hover:bg-[var(--color-paper-2)] transition-colors py-2.5 rounded-[var(--radius-sm)] font-mono text-[10px] uppercase font-bold tracking-wider flex justify-center items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[14px]">visibility</span> Lihat
              </button>
              {(latestInvoice.status === 'PENDING' || latestInvoice.status === 'OVERDUE') && latestInvoice.paymentToken && (
                <button
                  onClick={() => router.push(`/pay/${latestInvoice.paymentToken}`)}
                  className="flex-1 bg-[var(--color-accent)] text-[var(--color-accent-ink)] hover:opacity-90 transition-opacity py-2.5 rounded-[var(--radius-sm)] font-mono text-[10px] uppercase font-bold tracking-wider flex justify-center items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[14px]">payment</span> Bayar Sekarang
                </button>
              )}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="col-span-4 md:col-span-8 lg:col-span-12">
          <h3 className="text-base font-display font-semibold text-[var(--color-ink)] mb-4">Aksi Cepat</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: 'receipt_long', label: 'Tagihan', href: '/customer/invoices' },
              { icon: 'router', label: 'Pengaturan Wi-Fi', href: '/customer/wifi' },
              { icon: 'upgrade', label: 'Ubah Paket', href: '/customer/upgrade' },
              { icon: 'contact_support', label: 'Pusat Bantuan', href: '/customer/tickets' },
            ].map(({ icon, label, href }) => (
              <button
                key={href}
                onClick={() => router.push(href)}
                className="bento-card p-4 flex flex-col items-center justify-center gap-3 hover:bg-[var(--color-paper-3)] cursor-pointer group min-h-[96px]"
              >
                <span className="material-symbols-outlined text-[var(--color-accent)] text-3xl group-hover:scale-110 transition-transform duration-200">{icon}</span>
                <span className="font-mono text-[10px] font-bold text-[var(--color-ink)] uppercase tracking-wider text-center leading-snug">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Riwayat Transaksi Singkat */}
        {invoices.length > 0 && (
          <div className="col-span-4 md:col-span-8 lg:col-span-12">
            <div className="bento-card p-0 overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-rule)] bg-[var(--color-paper-2)]">
                <h3 className="text-sm font-display font-semibold text-[var(--color-ink)]">Riwayat Transaksi</h3>
                <button
                  onClick={() => router.push('/customer/invoices')}
                  className="font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--color-accent)] hover:underline"
                >
                  Lihat Semua
                </button>
              </div>
              <table className="hairline-table">
                <thead>
                  <tr>
                    <th>Nomor Tagihan</th>
                    <th>Tanggal</th>
                    <th>Jumlah</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.slice(0, 5).map(inv => (
                    <tr
                      key={inv.id}
                      onClick={() => router.push(`/invoice/${inv.invoiceNumber}`)}
                      className="cursor-pointer"
                    >
                      <td>
                        <span className="font-mono text-xs text-[var(--color-muted)]">{inv.invoiceNumber}</span>
                      </td>
                      <td className="font-mono text-xs text-[var(--color-ink-2)] whitespace-nowrap">
                        {new Date(inv.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' })}
                      </td>
                      <td className="font-mono text-sm font-medium text-[var(--color-ink)] whitespace-nowrap">
                        {formatCurrency(inv.amount)}
                      </td>
                      <td>
                        <span className={`badge ${
                          inv.status === 'PAID' ? 'badge-paid' :
                          inv.status === 'OVERDUE' ? 'badge-overdue' :
                          'badge-pending'
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
        )}

      </div>
    </main>
  );
}
