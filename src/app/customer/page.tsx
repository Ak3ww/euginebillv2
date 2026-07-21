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
  const pendingInvoice = activeUnpaidInvoices[0];

    return (
    <main className="max-w-[1280px] mx-auto px-4 md:px-8 py-6">
      {/* Hero Section */}
      <section className="mb-6 relative overflow-hidden bg-cover bg-center bg-no-repeat rounded-2xl p-6 md:p-8 border border-[var(--color-rule)] shadow-sm" style={{ backgroundImage: 'url(/images/customer_card_bg.png)' }}>
        <div className="absolute inset-0 bg-[var(--color-accent)]/80 mix-blend-multiply backdrop-blur-[1px]"></div>
        <div className="relative z-10 flex justify-between items-start md:items-center flex-col md:flex-row gap-4">
          <div>
            <h2 className="text-3xl md:text-4xl font-display font-medium text-white drop-shadow-md">{user.name}</h2>
            <p className="text-sm md:text-base font-body text-white/80 mt-1 drop-shadow-sm font-medium tracking-wide">ID Pelanggan: {user.customerId || user.username}</p>
          </div>
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-md shadow-sm border border-white/20 ${user.status === 'ISOLATED' || isExpired ? 'bg-red-500/80 text-white' : 'bg-emerald-500/80 text-white'}`}>
            <span className="material-symbols-outlined text-[18px]">
              {user.status === 'ISOLATED' || isExpired ? 'error' : 'check_circle'}
            </span>
            <span className="font-mono text-xs md:text-sm uppercase font-bold tracking-wider drop-shadow-sm">
              {user.status === 'ISOLATED' || isExpired ? 'Terisolir' : 'Aktif'}
            </span>
          </div>
        </div>
      </section>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-4 md:grid-cols-8 lg:grid-cols-12 gap-5">
        
        {/* Sub/Expiry Module */}
        <div className={`col-span-4 ${!pendingInvoice ? 'md:col-span-8 lg:col-span-12' : 'md:col-span-8 lg:col-span-8'} bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-[var(--radius-lg)] p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-sm`}>
          <div>
            <h3 className="font-mono text-[10px] text-[var(--color-muted)] font-bold uppercase tracking-wider mb-2">Paket Langganan</h3>
            <div className="text-3xl font-display font-medium text-[var(--color-focus)]">{user.profile?.name || 'Loading...'}</div>
            <div className="text-sm font-body text-[var(--color-ink-2)] mt-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-[var(--color-focus)]">speed</span>
              Up to {user.profile?.downloadSpeed || 0}Mbps Download / Upload
            </div>
          </div>
          <div className="w-full md:w-px md:h-16 bg-[var(--color-rule)] md:mx-4 hidden md:block"></div>
          <div>
            <h3 className="font-mono text-[10px] text-[var(--color-muted)] font-bold uppercase tracking-wider mb-2">Jatuh Tempo</h3>
            <div className="text-2xl font-display font-medium text-[var(--color-ink)]">{formattedDueDate}</div>
            <div className={`inline-block mt-2 px-2 py-1 bg-[var(--color-paper-3)] rounded font-mono text-[10px] uppercase font-bold tracking-wider border border-[var(--color-rule)] ${isExpired ? 'text-[var(--color-error)]' : 'text-[var(--color-warning)]'}`}>
              {isExpired ? 'Kedaluwarsa' : `Tersisa ${daysLeft} Hari`}
            </div>
          </div>
        </div>

        {/* Pending Bill Module */}
        {pendingInvoice && (
          <div className="col-span-4 md:col-span-4 lg:col-span-4 bg-[var(--color-paper)] border border-[var(--color-rule)] border-l-4 border-l-[var(--color-error)] rounded-[var(--radius-lg)] p-6 relative overflow-hidden shadow-sm flex flex-col justify-between">
            <div className="absolute top-0 right-0 p-4 opacity-5">
              <span className="material-symbols-outlined text-9xl text-[var(--color-error)]" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
            </div>
            <div className="relative z-10 flex flex-col h-full justify-between">
              <div>
                <h3 className="font-mono text-[10px] text-[var(--color-error)] font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">receipt_long</span> Tagihan Belum Dibayar
                </h3>
                <p className="font-mono text-sm text-[var(--color-ink-2)]">{pendingInvoice.invoiceNumber}</p>
                <div className="text-3xl font-display font-medium text-[var(--color-ink)] mt-4">{formatCurrency(pendingInvoice.amount)}</div>
              </div>
              <button 
                onClick={() => router.push(`/pay/${pendingInvoice.paymentToken}`)}
                className="mt-6 w-full bg-[var(--color-accent)] text-[var(--color-accent-ink)] hover:opacity-90 transition-opacity py-3 rounded-[var(--radius-sm)] font-mono text-[10px] uppercase font-bold tracking-wider flex justify-center items-center gap-2"
              >
                Bayar Sekarang <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
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
