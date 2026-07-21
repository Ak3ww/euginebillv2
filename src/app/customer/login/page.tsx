'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Shield, Lock, ArrowRight, Loader2, User, Sun, Moon, Wifi } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';

export default function CustomerLoginPage() {
  const router = useRouter();
  const { isDark, toggleTheme } = useTheme();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [footerText, setFooterText] = useState('');
  const [brandLoaded, setBrandLoaded] = useState(false);

  useEffect(() => {
    // If already logged in as customer, redirect to customer portal
    const existingToken = localStorage.getItem('customer_token');
    if (existingToken) {
      router.replace('/customer');
      return;
    }

    fetch('/api/public/company')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.company.name) {
          setCompanyName(data.company.name);
        }
        if (data.success && data.company.logo) {
          setCompanyLogo(data.company.logo);
        }
        if (data.success && data.company.footerCustomer) {
          setFooterText(data.company.footerCustomer);
        } else if (data.success && data.company.poweredBy) {
          setFooterText(`Powered by ${data.company.poweredBy}`);
        }
      })
      .catch(err => console.error('Load company name error:', err))
      .finally(() => setBrandLoaded(true));
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/customer/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });

      const data = await res.json();

      if (data.success) {
        localStorage.setItem('customer_token', data.token);
        localStorage.setItem('customer_user', JSON.stringify(data.user));
        router.push('/customer');
      } else {
        setError(data.error || 'ID Pelanggan atau Password salah');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError('Terjadi kesalahan. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  if (!brandLoaded) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background transition-colors duration-300">
      {/* ── Mobile Brand Header (mobile only) ── */}
      <div className="lg:hidden bg-gradient-to-br from-cyan-500 to-blue-700 px-6 pt-10 pb-8 relative overflow-hidden flex-shrink-0">
        <div className="absolute top-[-50px] right-[-50px] w-40 h-40 bg-white/10 rounded-full pointer-events-none" />
        <div className="absolute bottom-[-30px] left-[-30px] w-28 h-28 bg-white/5 rounded-full pointer-events-none" />
        <div className="relative z-10">
          <span className="text-xs font-semibold uppercase tracking-widest text-cyan-100">Portal Pelanggan</span>
          <h1 className="text-3xl font-extrabold text-white mt-1 leading-tight">
            {companyName}
          </h1>
          <p className="text-sm text-blue-100/80 mt-2 leading-relaxed">
            Cek tagihan, bayar online, dan pantau status langganan internet Anda kapan saja.
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            {['Tagihan Online', 'Bayar Mudah', 'Notifikasi WA'].map(f => (
              <span key={f} className="text-xs font-medium bg-white/20 text-white px-3 py-1 rounded-full">{f}</span>
            ))}
          </div>
        </div>
      </div>
      {/* ── Left Panel: Login Form ── */}
      <div className="flex items-start justify-center w-full lg:w-[430px] lg:min-h-screen bg-card border-r border-border shadow-xl px-8 pt-10 lg:pt-14 pb-10 flex-shrink-0 relative">

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="absolute top-4 right-4 p-2 rounded-xl border border-border bg-muted hover:bg-muted/80 text-muted-foreground transition-all shadow-sm"
          title={isDark ? 'Mode Terang' : 'Mode Gelap'}
        >
          {isDark ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-slate-500" />}
        </button>

        <div className="w-full max-w-[320px]">

          {/* Logo */}
          <div className="flex justify-center mb-5">
            {companyLogo ? (
              <div className="w-24 h-24 p-2 rounded-xl border border-border bg-card shadow-sm flex items-center justify-center overflow-hidden">
                <Image unoptimized src={companyLogo} alt={companyName} width={220} height={110} className="max-h-full max-w-full w-auto h-auto object-contain" />
              </div>
            ) : (
              <div className="inline-flex items-center justify-center w-14 h-14 bg-primary rounded-2xl shadow-lg shadow-primary/25">
                <Shield className="w-7 h-7 text-white" />
              </div>
            )}
          </div>

          {/* Subtitle */}
          <p className="text-center text-sm text-primary font-semibold mb-6">
            Portal Pelanggan
          </p>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/50 rounded-xl">
              <p className="text-xs text-red-600 dark:text-red-400 font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="flex rounded-lg overflow-hidden border border-border focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all">
              <div className="bg-primary px-4 flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5 text-white" />
              </div>
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="flex-1 px-4 py-3 text-sm bg-muted text-foreground placeholder:text-muted-foreground focus:bg-input focus:outline-none transition-colors"
                placeholder="ID Pelanggan (UID)"
                disabled={loading}
                autoComplete="username"
              />
            </div>

            <div className="flex rounded-lg overflow-hidden border border-border focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all">
              <div className="bg-primary px-4 flex items-center justify-center flex-shrink-0">
                <Lock className="w-5 h-5 text-white" />
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="flex-1 px-4 py-3 text-sm bg-muted text-foreground placeholder:text-muted-foreground focus:bg-input focus:outline-none transition-colors"
                placeholder="Password"
                disabled={loading}
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-sm font-semibold rounded-lg transition-all shadow-sm flex items-center justify-center gap-2"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Memproses...</>
              ) : (
                <>Masuk<ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          {/* Register Buttons */}
          <div className="mt-5 pt-4 border-t border-gray-100 dark:border-slate-700">
            <p className="text-xs text-center text-muted-foreground mb-3 uppercase tracking-wider font-medium">Layanan Lainnya</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => router.push('/daftar')}
                className="py-2.5 px-3 bg-muted hover:bg-primary/5 border border-border text-foreground text-xs font-medium rounded-lg transition-all"
              >
                Daftar Pelanggan
              </button>
              <button
                type="button"
                onClick={() => router.push('/cek-tagihan')}
                className="py-2.5 px-3 bg-muted hover:bg-primary/5 border border-border text-foreground text-xs font-medium rounded-lg transition-all"
              >
                Cek Tagihan
              </button>
            </div>
            <button
              type="button"
              onClick={() => router.push('/evoucher')}
              className="w-full mt-3 py-2.5 bg-muted hover:bg-primary/5 border border-border text-muted-foreground text-xs font-medium rounded-lg transition-all flex items-center justify-center gap-2"
            >
              <Wifi className="w-4 h-4" />
              Beli Voucher WiFi
            </button>
          </div>

          {/* Footer */}
          <p className="text-center text-xs text-muted-foreground mt-6">{footerText}</p>
          <p className="text-center mt-2">
            <a
              href="/admin/login"
              className="text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              Admin? Masuk di sini →
            </a>
          </p>
        </div>
      </div>

      {/* ── Right Panel: Brand Info ── */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-slate-100 via-white to-cyan-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900 items-center justify-center px-12 py-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 bg-cyan-100/60 dark:bg-cyan-900/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-56 h-56 bg-blue-100/50 dark:bg-blue-900/20 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-lg w-full relative z-10">
          <div className="mb-2">
            <span className="text-xs font-semibold uppercase tracking-widest text-primary">Portal Pelanggan</span>
          </div>
          <h1 className="text-5xl font-extrabold leading-tight mb-1 text-foreground">
            {companyName}
          </h1>
          <div className="mb-4 h-1.5 w-28 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600" />
              <p className="text-base text-muted-foreground mb-8 leading-relaxed">
            Portal layanan mandiri pelanggan ISP. Cek tagihan, bayar online, dan pantau status langganan internet Anda kapan saja.
          </p>

          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-card rounded-2xl p-4 shadow-sm border border-border text-center">
              <div className="w-10 h-10 bg-cyan-100 dark:bg-cyan-900/40 rounded-xl flex items-center justify-center mx-auto mb-3">
                <svg className="w-5 h-5 text-cyan-600 dark:text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              </div>
              <p className="text-sm font-bold text-foreground mb-1">Tagihan Online</p>
              <p className="text-xs text-muted-foreground leading-snug">Lihat &amp; unduh invoice kapan saja</p>
            </div>
            <div className="bg-card rounded-2xl p-4 shadow-sm border border-border text-center">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/40 rounded-xl flex items-center justify-center mx-auto mb-3">
                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
              </div>
              <p className="text-sm font-bold text-foreground mb-1">Bayar Mudah</p>
              <p className="text-xs text-muted-foreground leading-snug">QRIS, bank &amp; retail</p>
            </div>
            <div className="bg-card rounded-2xl p-4 shadow-sm border border-border text-center">
              <div className="w-10 h-10 bg-green-100 dark:bg-green-900/40 rounded-xl flex items-center justify-center mx-auto mb-3">
                <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
              </div>
              <p className="text-sm font-bold text-foreground mb-1">Notifikasi WA</p>
              <p className="text-xs text-muted-foreground leading-snug">Pengingat otomatis WhatsApp</p>
            </div>
          </div>

          <div className="space-y-3">
            {[
              { color: 'bg-primary', text: 'Invoice Digital — Unduh &amp; cetak tagihan bulanan dengan mudah' },
              { color: 'bg-blue-500', text: 'Riwayat Pembayaran — Pantau semua histori transaksi kapan saja' },
              { color: 'bg-green-500', text: 'Portal Self-Service — Kelola akun sendiri tanpa perlu telepon' },
            ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 bg-card/70 rounded-xl px-4 py-3 border border-border/60">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${item.color}`} />
                <p className="text-sm text-foreground/80" dangerouslySetInnerHTML={{ __html: item.text }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
