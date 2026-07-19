'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { User, Wifi, Receipt, Loader2, ExternalLink, FileText, MessageSquare, RefreshCw, Zap, Shield, Key } from 'lucide-react';
import { useToast } from '@/components/cyberpunk/CyberToast';
import { formatWIB, nowWIB } from '@/lib/timezone';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

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

  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!loading && user) {
      gsap.from('.antigravity-card', {
        y: 60,
        opacity: 0,
        rotationX: 15,
        duration: 0.8,
        stagger: 0.1,
        ease: 'power3.out',
        clearProps: 'all'
      });
    }
  }, { scope: containerRef, dependencies: [loading, user] });

  // 3D Hover Effect
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    const rotateX = ((y - centerY) / centerY) * -5;
    const rotateY = ((x - centerX) / centerX) * 5;

    gsap.to(card, {
      rotateX,
      rotateY,
      duration: 0.4,
      ease: "power2.out",
      transformPerspective: 1000
    });
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    gsap.to(e.currentTarget, {
      rotateX: 0,
      rotateY: 0,
      duration: 0.7,
      ease: "power2.out"
    });
  };

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
        <Loader2 className="w-8 h-8 animate-spin text-cobalt" />
      </div>
    );
  }

  if (!user) return null;

  const expiredDate = new Date(user.expiredAt);
  const isExpired = expiredDate < nowWIB();
  const daysLeft = Math.ceil((expiredDate.getTime() - nowWIB().getTime()) / (1000 * 60 * 60 * 24));
  const activeUnpaidInvoices = invoices.filter(inv => inv.status === 'PENDING' || inv.status === 'OVERDUE');

  return (
    <div ref={containerRef} className="p-4 lg:p-8 max-w-6xl mx-auto space-y-8 pb-24">
      
      {/* ── BENTO GRID TOP (Hero) ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* HERO CARD */}
        <div 
          className="antigravity-card md:col-span-2 glass-panel floating-element p-8 relative overflow-hidden group rounded-2xl"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-50" />
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          
          <div className="relative z-10 flex flex-col h-full justify-between gap-8">
            <div>
              <p className="text-[10px] font-mono text-emerald-400 tracking-widest uppercase mb-2">
                STATUS: {user.status === 'active' ? 'Aktif' : 'Terisolir'}
              </p>
              <h1 className="text-3xl lg:text-4xl font-display font-medium tracking-tight mb-1">{user.name}</h1>
              <p className="text-xs font-mono opacity-60">ID Pelanggan: {user.customerId || 'Belum diatur'}</p>
            </div>
            
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[10px] font-mono opacity-40 uppercase mb-2">Paket Langganan</p>
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-white/5 rounded-lg border border-white/10">
                    <Zap className="w-5 h-5 text-amber-400" />
                  </div>
                  <span className="font-medium text-lg">{user.profile.name}</span>
                  <span className="text-xs font-mono opacity-60 ml-2">({user.profile.downloadSpeed}Mbps)</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* STATUS CARD */}
        <div 
          className="antigravity-card glass-panel floating-element p-8 flex flex-col justify-between rounded-2xl relative overflow-hidden"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
           <div className="absolute inset-0 bg-gradient-to-bl from-white/5 to-transparent opacity-50" />
          <div className="relative z-10">
            <p className="text-[10px] font-mono opacity-60 uppercase mb-2">Masa Aktif Berakhir</p>
            <p className="text-xl font-display font-medium">{formatWIB(user.expiredAt, 'd MMM yyyy')}</p>
          </div>
          <div className="mt-8 relative z-10">
            <div className={`px-3 py-1.5 inline-flex rounded-lg text-xs font-mono font-bold uppercase tracking-wider border backdrop-blur-md ${
              isExpired ? 'border-red-500/30 text-red-400 bg-red-500/10 shadow-[0_0_15px_rgba(239,68,68,0.2)]' :
              daysLeft <= 7 ? 'border-amber-500/30 text-amber-400 bg-amber-500/10 shadow-[0_0_15px_rgba(245,158,11,0.2)]' :
              'border-emerald-500/30 text-emerald-400 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
            }`}>
              {isExpired ? 'Terisolir' : daysLeft <= 0 ? 'Kedaluwarsa Hari Ini' : `Tersisa ${daysLeft} Hari`}
            </div>
          </div>
        </div>
      </div>

      {/* ── QUICK ACTIONS (Bento Grid Bottom) ── */}
      <div>
        <p className="text-[10px] font-mono font-bold opacity-50 uppercase tracking-widest mb-4 ml-1">Akses Cepat</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Tagihan', icon: Receipt, href: '/customer/invoices', color: 'text-blue-400', bg: 'bg-blue-400/10' },
            { label: 'Pengaturan Wi-Fi', icon: Wifi, href: '/customer/wifi', color: 'text-purple-400', bg: 'bg-purple-400/10' },
            { label: 'Pusat Bantuan', icon: MessageSquare, href: '/customer/tickets', color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
            { label: 'Profil Akun', icon: Key, href: '/customer/profile', color: 'text-amber-400', bg: 'bg-amber-400/10' },
          ].map(({ label, icon: Icon, href, color, bg }) => (
            <button 
              key={href} 
              onClick={() => router.push(href)} 
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              className="antigravity-card glass-panel floating-element p-6 flex flex-col items-center justify-center gap-4 rounded-2xl group transition-colors hover:bg-white/5 relative overflow-hidden"
            >
              <div className={`p-3 rounded-xl ${bg} border border-white/5 group-hover:scale-110 transition-transform duration-500`}>
                <Icon className={`w-6 h-6 ${color}`} />
              </div>
              <span className="text-[11px] font-mono font-bold tracking-wide text-center">{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* ── ACTIVE UNPAID INVOICES ── */}
        {activeUnpaidInvoices.length > 0 && (
          <div className="antigravity-card">
            <div className="flex items-center gap-2 mb-4 ml-1">
              <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)] animate-pulse" />
              <p className="text-[10px] font-mono font-bold text-red-400 uppercase tracking-widest">Menunggu Pembayaran</p>
            </div>
            <div className="space-y-4">
              {activeUnpaidInvoices.map(invoice => (
                <div 
                  key={invoice.id} 
                  className="glass-panel p-6 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative overflow-hidden group"
                >
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500/50" />
                  <div>
                    <p className="text-xs font-mono font-medium mb-1">{invoice.invoiceNumber}</p>
                    <p className="text-[10px] font-mono opacity-60 uppercase">Batas Waktu: {formatWIB(invoice.dueDate, 'dd MMM yyyy')}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-display font-semibold text-lg">{formatCurrency(invoice.amount)}</span>
                    {invoice.paymentToken ? (
                      <button onClick={() => router.push(`/pay/${invoice.paymentToken}`)}
                        className="px-5 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 text-[11px] font-mono font-bold rounded-xl transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(239,68,68,0.1)] hover:shadow-[0_0_20px_rgba(239,68,68,0.2)]">
                        Bayar Sekarang <ExternalLink className="w-3 h-3" />
                      </button>
                    ) : (
                      <button onClick={() => handleRegeneratePayment(invoice.id, invoice.invoiceNumber)}
                        disabled={generatingPayment === invoice.id}
                        className="px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-mono font-bold rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50">
                        {generatingPayment === invoice.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                        Buat Link
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── RECENT INVOICES ── */}
        <div className="antigravity-card">
          <p className="text-[10px] font-mono font-bold opacity-50 uppercase tracking-widest mb-4 ml-1">Riwayat Tagihan</p>
          <div className="glass-panel rounded-2xl overflow-hidden p-2">
            {invoices.length === 0 ? (
              <p className="text-[11px] font-mono opacity-50 text-center py-10 uppercase">Belum ada tagihan</p>
            ) : (
              <div className="space-y-1">
                {invoices.slice(0, 5).map((invoice) => {
                  const isPaid = invoice.status === 'PAID';
                  return (
                    <div key={invoice.id} className="p-4 rounded-xl flex items-center justify-between gap-4 hover:bg-white/5 transition-colors group">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className={`p-2 rounded-lg border ${isPaid ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                          <FileText className={`w-4 h-4 ${isPaid ? 'text-emerald-400' : 'text-red-400'}`} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-mono font-medium truncate group-hover:text-white transition-colors">{invoice.invoiceNumber}</p>
                          <p className="text-[10px] font-mono opacity-50 uppercase mt-1">
                            {formatWIB(invoice.dueDate, 'dd MMM yyyy')}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end flex-shrink-0">
                        <span className="font-display text-sm font-medium">{formatCurrency(invoice.amount)}</span>
                        <span className={`text-[9px] font-mono font-bold uppercase tracking-wider mt-1 ${isPaid ? 'text-emerald-400' : 'text-red-400'}`}>
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
