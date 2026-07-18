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
    <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-700">
      
      {/* ── BENTO GRID TOP (Hero) ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-rule border border-rule rounded-[10px] overflow-hidden shadow-sm">
        
        {/* GRAPHITE BAND (Signature 8) */}
        <div className="md:col-span-2 bg-graphite p-6 lg:p-8 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cobalt/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
          <div className="flex flex-col h-full justify-between gap-6">
            <div>
              <p className="text-[10px] font-mono text-cobalt tracking-widest uppercase mb-2">STATUS: {user.status === 'active' ? '200 OK' : '403 FORBIDDEN'}</p>
              <h1 className="text-2xl lg:text-3xl font-display font-medium text-paper tracking-tight">{user.name}</h1>
              <p className="text-xs font-mono text-paper/60 mt-2">ID: {user.customerId || 'SYS_GEN_ID'}</p>
            </div>
            
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[10px] font-mono text-paper/40 uppercase mb-1">SUBSCRIPTION_TIER</p>
                <div className="flex items-center gap-2 text-paper">
                  <Zap className="w-4 h-4 text-cobalt" />
                  <span className="font-medium text-sm">{user.profile.name}</span>
                  <span className="text-xs font-mono text-paper/60">({user.profile.downloadSpeed}Mbps)</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* LIGHT BAND (Status) */}
        <div className="bg-paper p-6 lg:p-8 flex flex-col justify-between border-t md:border-t-0 md:border-l border-rule">
          <div>
            <p className="text-[10px] font-mono text-muted uppercase mb-1">TTL_REMAINING</p>
            <p className="text-sm font-display font-medium text-ink">{formatWIB(user.expiredAt, 'd MMM yyyy')}</p>
          </div>
          <div className="mt-4">
            <div className={`px-2 py-1 inline-flex rounded text-[10px] font-mono font-bold uppercase tracking-wider border ${
              isExpired ? 'border-red-500/20 text-red-600 bg-red-500/5' :
              daysLeft <= 7 ? 'border-yellow-500/20 text-yellow-600 bg-yellow-500/5' :
              'border-cobalt/20 text-cobalt bg-cobalt/5'
            }`}>
              {isExpired ? 'ISOLATED' : daysLeft <= 0 ? 'EXPIRES_TODAY' : `${daysLeft} DAYS_LEFT`}
            </div>
          </div>
        </div>
      </div>

      {/* ── QUICK ACTIONS (Bento Grid Bottom) ── */}
      <div>
        <p className="text-[10px] font-mono font-bold text-muted uppercase tracking-widest mb-3">COMMAND_PALETTE</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-rule border border-rule rounded-[10px] overflow-hidden shadow-sm">
          {[
            { label: 'PAY_BILLS', icon: Receipt, href: '/customer/invoices' },
            { label: 'WIFI_CONFIG', icon: Wifi, href: '/customer/wifi' },
            { label: 'SUPPORT_TKT', icon: MessageSquare, href: '/customer/tickets' },
            { label: 'AUTH_CREDS', icon: Key, href: '/customer/profile' },
          ].map(({ label, icon: Icon, href }) => (
            <button key={href} onClick={() => router.push(href)} className="bg-paper p-5 flex flex-col items-start gap-4 hover:bg-muted/5 transition-colors group">
              <Icon className="w-5 h-5 text-muted group-hover:text-cobalt transition-colors" />
              <span className="text-[11px] font-mono font-bold text-ink tracking-wide">{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* ── ACTIVE UNPAID INVOICES ── */}
        {activeUnpaidInvoices.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <p className="text-[10px] font-mono font-bold text-red-600 uppercase tracking-widest">PENDING_PAYMENTS</p>
            </div>
            <div className="space-y-px bg-rule border border-rule rounded-[10px] overflow-hidden shadow-sm">
              {activeUnpaidInvoices.map(invoice => (
                <div key={invoice.id} className="bg-paper p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-mono font-medium text-ink mb-1">{invoice.invoiceNumber}</p>
                    <p className="text-[10px] font-mono text-muted uppercase">DUE: {formatWIB(invoice.dueDate, 'dd MMM yyyy')}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-display font-semibold text-sm text-ink">{formatCurrency(invoice.amount)}</span>
                    {invoice.paymentToken ? (
                      <button onClick={() => router.push(`/pay/${invoice.paymentToken}`)}
                        className="px-4 py-2 bg-cobalt hover:bg-cobalt-hover text-paper text-[11px] font-mono font-bold rounded-[6px] transition-colors flex items-center gap-1.5">
                        EXEC_PAY <ExternalLink className="w-3 h-3" />
                      </button>
                    ) : (
                      <button onClick={() => handleRegeneratePayment(invoice.id, invoice.invoiceNumber)}
                        disabled={generatingPayment === invoice.id}
                        className="px-4 py-2 bg-paper text-ink border border-rule hover:border-cobalt/50 hover:text-cobalt text-[11px] font-mono font-bold rounded-[6px] transition-colors flex items-center gap-1.5 disabled:opacity-50">
                        {generatingPayment === invoice.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                        GEN_LINK
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── RECENT INVOICES ── */}
        <div>
          <p className="text-[10px] font-mono font-bold text-muted uppercase tracking-widest mb-3">TX_LOGS</p>
          <div className="bg-paper border border-rule rounded-[10px] shadow-sm overflow-hidden">
            {invoices.length === 0 ? (
              <p className="text-[11px] font-mono text-muted text-center py-8 uppercase">NO_RECORDS_FOUND</p>
            ) : (
              <div className="divide-y divide-rule">
                {invoices.slice(0, 5).map((invoice) => {
                  const isPaid = invoice.status === 'PAID';
                  return (
                    <div key={invoice.id} className="p-4 flex items-center justify-between gap-4 hover:bg-muted/5 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isPaid ? 'bg-green-500' : 'bg-red-500'}`} />
                        <div className="min-w-0">
                          <p className="text-[11px] font-mono font-medium text-ink truncate">{invoice.invoiceNumber}</p>
                          <p className="text-[9px] font-mono text-muted uppercase mt-0.5">
                            {formatWIB(invoice.dueDate, 'dd MMM yyyy')}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end flex-shrink-0">
                        <span className="font-display text-sm text-ink">{formatCurrency(invoice.amount)}</span>
                        <span className={`text-[9px] font-mono font-bold uppercase tracking-wider mt-0.5 ${isPaid ? 'text-green-600' : 'text-red-600'}`}>
                          {invoice.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
