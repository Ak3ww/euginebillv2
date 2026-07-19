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
  const isExpired = expiredDate < nowWIB();
  const daysLeft = Math.ceil((expiredDate.getTime() - nowWIB().getTime()) / (1000 * 60 * 60 * 24));
  const activeUnpaidInvoices = invoices.filter(inv => inv.status === 'PENDING' || inv.status === 'OVERDUE');
  const pendingInvoice = activeUnpaidInvoices[0];

  return (
    <main className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-6 w-full">
      {/* Hero Section */}
      <section className="mb-6 flex justify-between items-start md:items-center flex-col md:flex-row gap-4">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface">{user.name}</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">ID Pelanggan: {user.customerId || user.username}</p>
        </div>
        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${user.status === 'ISOLATED' || isExpired ? 'bg-status-isolated/10 text-status-isolated' : 'bg-status-active/10 text-status-active'}`}>
          <span className="material-symbols-outlined text-[16px]">
            {user.status === 'ISOLATED' || isExpired ? 'error' : 'check_circle'}
          </span>
          <span className="font-label-caps text-label-caps uppercase">
            {user.status === 'ISOLATED' || isExpired ? 'Terisolir' : 'Aktif'}
          </span>
        </div>
      </section>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-4 md:grid-cols-8 lg:grid-cols-12 gap-bento-gap">
        
        {/* Sub/Expiry Module (Spans 8/12 cols depending on screen) */}
        <div className={`bento-card col-span-4 md:col-span-8 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 ${!pendingInvoice ? 'lg:col-span-12' : 'lg:col-span-8'}`}>
          <div>
            <h3 className="font-label-caps text-label-caps text-outline uppercase mb-2">Paket Langganan</h3>
            <div className="font-headline-lg text-headline-lg text-primary">{user.profile?.name || 'Loading...'}</div>
            <div className="font-body-sm text-on-surface-variant mt-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-primary">speed</span>
              Up to {user.profile?.downloadSpeed || 0}Mbps Download / Upload
            </div>
          </div>
          
          <div className="w-full md:w-px md:h-16 bg-hairline-border md:mx-4"></div>
          
          <div>
            <h3 className="font-label-caps text-label-caps text-outline uppercase mb-2">Jatuh Tempo</h3>
            <div className="font-headline-md text-headline-md text-on-surface">
              {formatWIB(user.expiredAt).split(' ')[0]}
            </div>
            <div className={`inline-block mt-2 px-2 py-1 rounded font-label-caps text-label-caps uppercase border border-hairline-border ${isExpired ? 'bg-error-container text-on-error-container' : 'bg-surface-container-high text-status-warning'}`}>
              {isExpired ? 'Kedaluwarsa' : `Tersisa ${daysLeft} Hari`}
            </div>
          </div>
        </div>

        {/* Pending Bill Module */}
        {pendingInvoice && (
          <div className="bento-card col-span-4 md:col-span-4 lg:col-span-4 p-6 border-l-4 border-l-status-isolated relative overflow-hidden bg-surface-bright">
            <div className="absolute top-0 right-0 p-4 opacity-5">
              <span className="material-symbols-outlined text-9xl text-status-isolated" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
            </div>
            <div className="relative z-10 flex flex-col h-full justify-between">
              <div>
                <h3 className="font-label-caps text-label-caps text-status-isolated uppercase mb-1 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">receipt_long</span> Tagihan Belum Dibayar
                </h3>
                <p className="font-data-mono text-data-mono text-on-surface-variant">{pendingInvoice.invoiceNumber}</p>
                <div className="font-headline-lg text-headline-lg text-on-surface mt-4">{formatCurrency(pendingInvoice.amount)}</div>
              </div>
              <button 
                onClick={() => router.push(`/pay/${pendingInvoice.paymentToken}`)}
                className="mt-6 w-full bg-primary-container text-on-primary hover:bg-on-primary-fixed-variant transition-colors py-3 rounded font-label-caps text-label-caps uppercase flex justify-center items-center gap-2"
              >
                Bayar Sekarang <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            </div>
          </div>
        )}

        {/* Quick Actions Grid */}
        <div className="col-span-4 md:col-span-8 lg:col-span-12 mt-4">
          <h3 className="font-headline-md text-headline-md text-on-surface mb-4">Aksi Cepat</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button onClick={() => router.push('/customer/invoices')} className="bento-card p-4 flex flex-col items-center justify-center gap-3 hover:bg-surface-container-low transition-colors duration-200 active:opacity-70 group cursor-pointer">
              <span className="material-symbols-outlined text-primary group-hover:scale-110 transition-transform text-3xl">receipt_long</span>
              <span className="font-label-caps text-label-caps text-on-surface uppercase">Tagihan</span>
            </button>
            <button onClick={() => router.push('/customer/wifi')} className="bento-card p-4 flex flex-col items-center justify-center gap-3 hover:bg-surface-container-low transition-colors duration-200 active:opacity-70 group cursor-pointer">
              <span className="material-symbols-outlined text-primary group-hover:scale-110 transition-transform text-3xl">router</span>
              <span className="font-label-caps text-label-caps text-on-surface uppercase">Pengaturan Wi-Fi</span>
            </button>
            <button onClick={() => router.push('/customer/upgrade')} className="bento-card p-4 flex flex-col items-center justify-center gap-3 hover:bg-surface-container-low transition-colors duration-200 active:opacity-70 group cursor-pointer">
              <span className="material-symbols-outlined text-primary group-hover:scale-110 transition-transform text-3xl">upgrade</span>
              <span className="font-label-caps text-label-caps text-on-surface uppercase">Upgrade Layanan</span>
            </button>
            <button onClick={() => router.push('/customer/tickets')} className="bento-card p-4 flex flex-col items-center justify-center gap-3 hover:bg-surface-container-low transition-colors duration-200 active:opacity-70 group cursor-pointer">
              <span className="material-symbols-outlined text-primary group-hover:scale-110 transition-transform text-3xl">contact_support</span>
              <span className="font-label-caps text-label-caps text-on-surface uppercase">Pusat Bantuan</span>
            </button>
          </div>
        </div>

      </div>
    </main>
  );
}
