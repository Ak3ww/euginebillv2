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
      if (data.success && data.invoices) {
        setInvoices(data.invoices);
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
    <main className="max-w-[1280px] mx-auto px-4 md:px-8 py-6">

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-4 md:grid-cols-8 lg:grid-cols-12 gap-5">
        
        {/* Paket Langganan + Info Pelanggan Module */}
        <div className={`relative overflow-hidden col-span-4 ${!latestInvoice ? 'md:col-span-8 lg:col-span-12' : 'md:col-span-8 lg:col-span-8'} bg-gradient-to-br from-[var(--color-focus)]/10 to-[var(--color-paper)] border border-[var(--color-rule)] border-l-4 border-l-[var(--color-focus)] rounded-[var(--radius-lg)] p-6 shadow-sm`}>
          {/* Watermark */}
          <span className="material-symbols-outlined text-[120px] text-[var(--color-focus)]/8 absolute -bottom-4 -right-4 select-none">router</span>
          
          {/* Top row: ID + Status */}
          <div className="flex items-center justify-between mb-4">
            <span className="font-mono text-[10px] text-[var(--color-muted)] uppercase tracking-widest">
              ID: <span className="text-[var(--color-ink)] font-bold tracking-[0.2em]">{(user.customerId || user.username).toString()}</span>
            </span>
            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border font-mono text-[10px] uppercase font-bold tracking-wider ${
              user.status === 'ISOLATED' || isExpired 
                ? 'bg-[var(--color-error)]/10 border-[var(--color-error)]/20 text-[var(--color-error)]' 
                : 'bg-[var(--color-success)]/10 border-[var(--color-success)]/20 text-[var(--color-success)]'
            }`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse"></span>
              {user.status === 'ISOLATED' || isExpired ? 'Terisolir' : 'Aktif'}
            </div>
          </div>

          {/* Customer Name */}
          <div className="font-display text-2xl md:text-3xl font-medium text-[var(--color-ink)] truncate mb-5">
            {user.name}
          </div>

          {/* Bottom row: Package + Due Date */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h3 className="font-mono text-[10px] text-[var(--color-muted)] font-bold uppercase tracking-wider mb-1">Paket Langganan</h3>
              <div className="text-lg font-display font-medium text-[var(--color-focus)]">{user.profile?.name || '-'}</div>
              <div className="text-xs font-body text-[var(--color-ink-2)] mt-1 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[14px] text-[var(--color-focus)]">speed</span>
                Hingga {user.profile?.downloadSpeed || 0} Mbps
              </div>
            </div>
            <div className="md:w-px md:h-12 bg-[var(--color-rule)] hidden md:block self-stretch"></div>
            <div>
              <h3 className="font-mono text-[10px] text-[var(--color-muted)] font-bold uppercase tracking-wider mb-1">Jatuh Tempo</h3>
              <div className="text-lg font-display font-medium text-[var(--color-ink)]">{formattedDueDate}</div>
              <div className={`inline-block mt-1.5 px-2 py-0.5 rounded font-mono text-[10px] uppercase font-bold tracking-wider border border-[var(--color-rule)] ${
                isExpired ? 'text-[var(--color-error)] bg-[var(--color-error)]/5' : 'text-[var(--color-warning)] bg-[var(--color-warning)]/5'
              }`}>
                {isExpired ? 'Kedaluwarsa' : `Tersisa ${daysLeft} Hari`}
              </div>
            </div>
          </div>
        </div>

        {/* Latest Invoice Module */}
        {latestInvoice && (
          <div className={`col-span-4 md:col-span-4 lg:col-span-4 bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-[var(--radius-lg)] p-6 relative overflow-hidden shadow-sm flex flex-col justify-between ${latestInvoice.status === 'PENDING' || latestInvoice.status === 'OVERDUE' ? 'border-l-4 border-l-[var(--color-error)]' : 'border-l-4 border-l-[var(--color-success)]'}`}>
            <div className="absolute top-0 right-0 p-4 opacity-5">
              <span className={`material-symbols-outlined text-9xl ${latestInvoice.status === 'PENDING' || latestInvoice.status === 'OVERDUE' ? 'text-[var(--color-error)]' : 'text-[var(--color-success)]'}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                {latestInvoice.status === 'PENDING' || latestInvoice.status === 'OVERDUE' ? 'warning' : 'check_circle'}
              </span>
            </div>
            <div className="relative z-10 flex flex-col h-full justify-between">
              <div>
                <h3 className={`font-mono text-[10px] font-bold uppercase tracking-wider mb-1 flex items-center gap-1 ${latestInvoice.status === 'PENDING' || latestInvoice.status === 'OVERDUE' ? 'text-[var(--color-error)]' : 'text-[var(--color-success)]'}`}>
                  <span className="material-symbols-outlined text-[14px]">receipt_long</span> 
                  {latestInvoice.status === 'PENDING' || latestInvoice.status === 'OVERDUE' ? 'Tagihan Belum Dibayar' : 'Tagihan Terakhir (Lunas)'}
                </h3>
                <p className="font-mono text-sm text-[var(--color-ink-2)]">{latestInvoice.invoiceNumber}</p>
                <div className="text-3xl font-display font-medium text-[var(--color-ink)] mt-4">{formatCurrency(latestInvoice.amount)}</div>
                <div className="font-mono text-[10px] text-[var(--color-ink-2)] mt-2">
                  {latestInvoice.status === 'PAID' ? `Dibayar pada: ${new Date(latestInvoice.paidAt!).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' })}` : `Jatuh Tempo: ${new Date(latestInvoice.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' })}`}
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <button 
                  onClick={() => router.push(`/invoice/${latestInvoice.invoiceNumber}`)}
                  className="w-full bg-[var(--color-paper-2)] text-[var(--color-ink)] border border-[var(--color-rule)] hover:bg-[var(--color-paper-3)] transition-colors py-3 rounded-[var(--radius-sm)] font-mono text-[10px] uppercase font-bold tracking-wider flex justify-center items-center gap-2"
                >
                  <span className="material-symbols-outlined text-[16px]">visibility</span> Lihat
                </button>
                {(latestInvoice.status === 'PENDING' || latestInvoice.status === 'OVERDUE') && (
                  <button 
                    onClick={() => router.push(`/pay/${latestInvoice.paymentToken}`)}
                    className="w-full bg-[var(--color-accent)] text-[var(--color-accent-ink)] hover:opacity-90 transition-opacity py-3 rounded-[var(--radius-sm)] font-mono text-[10px] uppercase font-bold tracking-wider flex justify-center items-center gap-2"
                  >
                    Bayar
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions Grid */}
        <div className="col-span-4 md:col-span-8 lg:col-span-12 mt-4">
          <h3 className="text-2xl font-display font-medium text-[var(--color-ink)] mb-4">Aksi Cepat</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            
            <button 
              onClick={() => router.push('/customer/invoices')}
              className="bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-[var(--radius-lg)] p-4 flex flex-col items-center justify-center gap-3 hover:bg-[var(--color-paper-3)] transition-colors duration-200 active:opacity-70 group shadow-sm"
            >
              <span className="material-symbols-outlined text-[var(--color-focus)] group-hover:scale-110 transition-transform text-3xl">receipt_long</span>
              <span className="font-mono text-[10px] font-bold text-[var(--color-ink)] uppercase tracking-wider">Tagihan</span>
            </button>
            
            <button 
              onClick={() => router.push('/customer/wifi')}
              className="bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-[var(--radius-lg)] p-4 flex flex-col items-center justify-center gap-3 hover:bg-[var(--color-paper-3)] transition-colors duration-200 active:opacity-70 group shadow-sm"
            >
              <span className="material-symbols-outlined text-[var(--color-focus)] group-hover:scale-110 transition-transform text-3xl">router</span>
              <span className="font-mono text-[10px] font-bold text-[var(--color-ink)] uppercase tracking-wider">Pengaturan Wi-Fi</span>
            </button>

            <button 
              onClick={() => router.push('/customer/upgrade')}
              className="bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-[var(--radius-lg)] p-4 flex flex-col items-center justify-center gap-3 hover:bg-[var(--color-paper-3)] transition-colors duration-200 active:opacity-70 group shadow-sm"
            >
              <span className="material-symbols-outlined text-[var(--color-focus)] group-hover:scale-110 transition-transform text-3xl">upgrade</span>
              <span className="font-mono text-[10px] font-bold text-[var(--color-ink)] uppercase tracking-wider">Upgrade Layanan</span>
            </button>

            <button 
              onClick={() => router.push('/customer/tickets')}
              className="bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-[var(--radius-lg)] p-4 flex flex-col items-center justify-center gap-3 hover:bg-[var(--color-paper-3)] transition-colors duration-200 active:opacity-70 group shadow-sm"
            >
              <span className="material-symbols-outlined text-[var(--color-focus)] group-hover:scale-110 transition-transform text-3xl">contact_support</span>
              <span className="font-mono text-[10px] font-bold text-[var(--color-ink)] uppercase tracking-wider">Pusat Bantuan</span>
            </button>
            
          </div>
        </div>

      </div>
    </main>
  );
}
