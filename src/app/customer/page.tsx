'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, Wifi, Receipt, Loader2, ExternalLink, FileText, MessageSquare, RefreshCw, Zap, Shield, Key } from 'lucide-react';
import { useToast } from '@/components/cyberpunk/CyberToast';
import { CyberCard } from '@/components/cyberpunk';
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
  const [generatingPayment, setGeneratingPayment] = useState<string | null>(null);
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

  const handleRegeneratePayment = async (invoiceId: string, invoiceNumber: string) => {
    if (paymentGateways.length === 0) {
      toast('warning', 'Gateway Tidak Tersedia', 'Payment gateway belum tersedia. Silakan hubungi admin.');
      return;
    }

    const gateway = paymentGateways[0].provider;
    setGeneratingPayment(invoiceId);
    const token = localStorage.getItem('customer_token');

    try {
      const res = await fetch('/api/customer/invoice/regenerate-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ invoiceId, gateway })
      });

      const data = await res.json();

      if (data.success && data.paymentUrl) {
        await loadInvoices();
        // Gunakan router.push agar tetap dalam app (APK WebView tidak buka browser)
        const match = data.paymentUrl.match(/\/pay\/([^?#]+)/);
        if (match) {
          router.push(`/pay/${match[1]}`);
        } else {
          router.push('/customer/invoices');
        }
      } else {
        toast('error', 'Gagal', data.error || 'Gagal membuat link pembayaran');
      }
    } catch (error) {
      console.error('Regenerate payment error:', error);
      toast('error', 'Gagal', 'Gagal menghubungi server');
    } finally {
      setGeneratingPayment(null);
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

  return (
    <div className="p-4 lg:p-6 w-full space-y-6 text-foreground">
      
      {/* -- Selamat Datang & ID Pelanggan Header ------------------------- */}
      <div className="bg-card border border-border p-5 rounded-2xl shadow-sm flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-primary">Selamat Datang</p>
          <h1 className="text-xl font-bold mt-1">{user.name}</h1>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">ID Pelanggan: {user.customerId || '-'}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
          isExpired
            ? 'bg-red-500/10 text-red-400 border-red-500/20'
            : user.status === 'active'
            ? 'bg-green-500/10 text-green-400 border-green-500/20'
            : 'bg-orange-500/10 text-orange-400 border-orange-500/20'
        }`}>
          {isExpired ? 'Expired' : user.status === 'active' ? 'Aktif' : 'Terisolir'}
        </span>
      </div>

      {/* -- Ringkasan Paket & Masa Aktif --------------------------------- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card border border-border p-4 rounded-xl flex items-center gap-3">
          <div className="p-3 bg-primary/10 rounded-lg text-primary">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Paket Langganan</p>
            <p className="text-sm font-bold text-foreground mt-0.5">{user.profile.name}</p>
            <p className="text-xs text-muted-foreground">{user.profile.downloadSpeed} Mbps</p>
          </div>
        </div>

        <div className={`border p-4 rounded-xl flex items-center gap-3 bg-card ${isExpired ? 'border-red-500/30' : 'border-border'}`}>
          <div className={`p-3 rounded-lg ${isExpired ? 'bg-red-500/15 text-red-400' : 'bg-primary/10 text-primary'}`}>
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Masa Aktif S/D</p>
            <p className="text-sm font-bold mt-0.5">{formatWIB(user.expiredAt, 'd MMMM yyyy')}</p>
            <p className={`text-xs font-semibold ${isExpired ? 'text-red-400' : daysLeft <= 7 ? 'text-yellow-400' : 'text-green-400'}`}>
              {isExpired ? 'Layanan Terisolir' : daysLeft <= 0 ? 'Hari ini terakhir!' : `${daysLeft} hari lagi`}
            </p>
          </div>
        </div>
      </div>

      {/* -- Menu Cepat ---------------------------------------------------- */}
      <div className="space-y-2">
        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">Menu Cepat</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button onClick={() => router.push('/customer/invoices')} className="flex flex-col items-center justify-center p-4 rounded-xl border border-border bg-card hover:border-primary/40 transition-all">
            <Receipt className="w-5 h-5 text-primary mb-2" />
            <span className="text-xs font-bold">Bayar Tagihan</span>
          </button>
          <button onClick={() => router.push('/customer/wifi')} className="flex flex-col items-center justify-center p-4 rounded-xl border border-border bg-card hover:border-primary/40 transition-all">
            <Wifi className="w-5 h-5 text-primary mb-2" />
            <span className="text-xs font-bold">Pengaturan WiFi</span>
          </button>
          <button onClick={() => router.push('/customer/tickets')} className="flex flex-col items-center justify-center p-4 rounded-xl border border-border bg-card hover:border-primary/40 transition-all">
            <MessageSquare className="w-5 h-5 text-primary mb-2" />
            <span className="text-xs font-bold">Bantuan Teknis</span>
          </button>
          <button onClick={() => router.push('/customer/profile')} className="flex flex-col items-center justify-center p-4 rounded-xl border border-border bg-card hover:border-primary/40 transition-all">
            <User className="w-5 h-5 text-primary mb-2" />
            <span className="text-xs font-bold">Ubah Sandi</span>
          </button>
        </div>
      </div>

      {/* -- Tagihan Belum Dibayar (Aksi Pembayaran) ------------------------ */}
      {activeUnpaidInvoices.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">Tagihan Tertunda</h2>
          <div className="space-y-2">
            {activeUnpaidInvoices.map(invoice => (
              <div key={invoice.id} className="bg-card border border-red-500/20 rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-red-500/10 text-red-400 rounded-lg">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-mono font-bold">{invoice.invoiceNumber}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Jatuh Tempo: {formatWIB(invoice.dueDate, 'd MMM yyyy')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-sm text-red-400">{formatCurrency(invoice.amount)}</span>
                  {invoice.paymentToken ? (
                    <button onClick={() => router.push(`/pay/${invoice.paymentToken}`)}
                      className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-lg flex items-center gap-1">
                      Bayar Sekarang <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button onClick={() => handleRegeneratePayment(invoice.id, invoice.invoiceNumber)}
                      disabled={generatingPayment === invoice.id}
                      className="px-4 py-2 bg-yellow-500 text-black text-xs font-bold rounded-lg flex items-center gap-1 disabled:opacity-50">
                      {generatingPayment === invoice.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                      Buat Link
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* -- Riwayat Pembayaran Terakhir --------------------------------- */}
      <CyberCard className="p-5 bg-card border border-border">
        <h2 className="text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" /> Riwayat Tagihan Terakhir
        </h2>
        {invoices.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">Belum ada riwayat tagihan.</p>
        ) : (
          <div className="divide-y divide-border">
            {invoices.slice(0, 3).map((invoice) => {
              const isPaid = invoice.status === 'PAID';
              return (
                <div key={invoice.id} className="py-3 flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <span className="font-mono text-xs font-semibold">{invoice.invoiceNumber}</span>
                    <span className={`ml-2 px-2 py-0.5 text-[9px] rounded-full font-bold ${
                      isPaid ? 'bg-success/20 text-success' : 'bg-yellow-500/20 text-yellow-400'
                    }`}>{invoice.status === 'PAID' ? 'LUNAS' : 'BELUM BAYAR'}</span>
                    <p className="text-[10px] text-muted-foreground mt-1">Jatuh Tempo: {formatWIB(invoice.dueDate, 'd MMM yyyy')}</p>
                  </div>
                  <span className={`font-bold text-sm ${isPaid ? 'text-success' : 'text-yellow-400'}`}>
                    {formatCurrency(invoice.amount)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CyberCard>

    </div>
  );
}
