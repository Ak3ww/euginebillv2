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
    <main className="hallmark-container">
      {/* Header */}
      <header className="mb-[var(--space-xl)] pb-[var(--space-lg)] hairline-bottom flex justify-between items-end">
        <div>
          <h2 className="text-2xl md:text-3xl font-display font-medium mb-1">{user.name}</h2>
          <p className="text-[var(--color-muted)] text-sm">ID Pelanggan: {user.customerId || user.username}</p>
        </div>
        <div className={`hallmark-badge ${user.status === 'ISOLATED' || isExpired ? 'badge-error' : 'badge-success'}`}>
          {user.status === 'ISOLATED' || isExpired ? 'Terisolir' : 'Aktif'}
        </div>
      </header>

      {/* Bento Grid */}
      <div className="bento-grid">
        
        {/* Package Info Card */}
        <div className={`hallmark-card col-span-12 ${!pendingInvoice ? 'md:col-span-12' : 'md:col-span-8'} flex flex-col justify-between`}>
          <div>
            <div className="text-xs uppercase tracking-wider text-[var(--color-muted)] mb-2 font-medium">Paket Langganan</div>
            <div className="text-3xl font-medium text-[var(--color-accent)]">{user.profile?.name || 'Loading...'}</div>
          </div>
          <div className="mt-6 flex flex-col md:flex-row md:items-center justify-between border-t border-[var(--color-rule)] pt-4 gap-4">
            <div className="text-sm text-[var(--color-ink-2)] flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">speed</span>
              Up to {user.profile?.downloadSpeed || 0}Mbps
            </div>
            <div className="md:text-right">
              <div className="text-xs uppercase tracking-wider text-[var(--color-muted)] mb-1">Jatuh Tempo</div>
              <div className="font-mono text-sm font-medium">{formatWIB(user.expiredAt).split(' ')[0]}</div>
              <div className={`text-xs mt-1 font-medium ${isExpired ? 'text-[var(--color-error)]' : 'text-[var(--color-warning)]'}`}>
                {isExpired ? 'Kedaluwarsa' : `Tersisa ${daysLeft} Hari`}
              </div>
            </div>
          </div>
        </div>

        {/* Pending Invoice Card */}
        {pendingInvoice && (
          <div className="hallmark-card-elevated col-span-12 md:col-span-4 border-l-4 border-l-[var(--color-error)] flex flex-col justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider text-[var(--color-error)] mb-2 font-medium flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">warning</span> Tagihan Tertunda
              </div>
              <div className="font-mono text-sm mb-4 text-[var(--color-muted)]">{pendingInvoice.invoiceNumber}</div>
              <div className="text-3xl font-medium mb-6">{formatCurrency(pendingInvoice.amount)}</div>
            </div>
            <button 
              onClick={() => router.push(`/pay/${pendingInvoice.paymentToken}`)}
              className="hallmark-button w-full"
            >
              Bayar Sekarang
            </button>
          </div>
        )}

        {/* Quick Actions Title */}
        <div className="col-span-12 mt-6 mb-2">
          <h3 className="text-lg font-medium">Aksi Cepat</h3>
        </div>

        {/* Action Widgets */}
        <div 
          className="col-span-6 md:col-span-3 hallmark-card hover:bg-[var(--color-paper-2)] hover:border-[var(--color-rule-2)] cursor-pointer transition-colors flex flex-col items-center text-center p-6"
          onClick={() => router.push('/customer/invoices')}
        >
          <span className="material-symbols-outlined text-3xl text-[var(--color-accent)] mb-3">receipt_long</span>
          <div className="font-medium text-sm">Riwayat Tagihan</div>
        </div>

        <div 
          className="col-span-6 md:col-span-3 hallmark-card hover:bg-[var(--color-paper-2)] hover:border-[var(--color-rule-2)] cursor-pointer transition-colors flex flex-col items-center text-center p-6"
          onClick={() => router.push('/customer/wifi')}
        >
          <span className="material-symbols-outlined text-3xl text-[var(--color-accent)] mb-3">router</span>
          <div className="font-medium text-sm">Pengaturan Wi-Fi</div>
        </div>

        <div 
          className="col-span-6 md:col-span-3 hallmark-card hover:bg-[var(--color-paper-2)] hover:border-[var(--color-rule-2)] cursor-pointer transition-colors flex flex-col items-center text-center p-6"
          onClick={() => router.push('/customer/upgrade')}
        >
          <span className="material-symbols-outlined text-3xl text-[var(--color-accent)] mb-3">upgrade</span>
          <div className="font-medium text-sm">Upgrade Layanan</div>
        </div>

        <div 
          className="col-span-6 md:col-span-3 hallmark-card hover:bg-[var(--color-paper-2)] hover:border-[var(--color-rule-2)] cursor-pointer transition-colors flex flex-col items-center text-center p-6"
          onClick={() => router.push('/customer/tickets')}
        >
          <span className="material-symbols-outlined text-3xl text-[var(--color-accent)] mb-3">contact_support</span>
          <div className="font-medium text-sm">Pusat Bantuan</div>
        </div>

      </div>
    </main>
  );
}
