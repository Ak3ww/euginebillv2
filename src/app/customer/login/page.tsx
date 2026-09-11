'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { 
  Lock, ArrowRight, Loader2, User, Phone, 
  Eye, EyeOff, KeyRound, MessageSquare, CheckCircle2, 
  AlertCircle, Wifi, ShieldCheck, X
} from 'lucide-react';
import '@/app/customer/customer.css';

export default function CustomerLoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Brand settings
  const [companyName, setCompanyName] = useState('Eugine Media');
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [companyPhone, setCompanyPhone] = useState('');
  const [footerText, setFooterText] = useState('');
  const [brandLoaded, setBrandLoaded] = useState(false);

  // Mode: 'password' | 'otp'
  const [loginMode, setLoginMode] = useState<'password' | 'otp'>('password');
  
  // OTP Login State
  const [otpPhone, setOtpPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0);

  // Forgot Password Modal State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState<1 | 2>(1);
  const [forgotPhone, setForgotPhone] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotShowPassword, setForgotShowPassword] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');

  useEffect(() => {
    const existingToken = localStorage.getItem('customer_token');
    if (existingToken) {
      router.replace('/customer');
      return;
    }

    fetch('/api/public/company')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.company) {
          if (data.company.name) setCompanyName(data.company.name);
          if (data.company.logo) setCompanyLogo(data.company.logo);
          if (data.company.phone) setCompanyPhone(data.company.phone);
          if (data.company.footerCustomer) {
            setFooterText(data.company.footerCustomer);
          } else if (data.company.poweredBy) {
            setFooterText(`Powered by ${data.company.poweredBy}`);
          }
        }
      })
      .catch((err) => console.error('Load company error:', err))
      .finally(() => setBrandLoaded(true));
  }, [router]);

  // Countdown timer for OTP
  useEffect(() => {
    if (otpCountdown > 0) {
      const timer = setTimeout(() => setOtpCountdown(otpCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [otpCountdown]);

  // Handle Standard Password Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !password) {
      setError('ID Pelanggan / No. HP dan Password wajib diisi');
      return;
    }

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
        setError(data.error || 'ID Pelanggan, Nomor HP, atau Password salah');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError('Terjadi kendala koneksi. Silakan coba kembali.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Send OTP Login
  const handleSendOtpLogin = async () => {
    if (!otpPhone) {
      setError('Masukkan nomor WhatsApp Anda');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/customer/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: otpPhone }),
      });

      const data = await res.json();
      if (data.success) {
        setOtpSent(true);
        setOtpCountdown(60);
      } else {
        setError(data.error || 'Gagal mengirim kode OTP ke nomor tersebut');
      }
    } catch {
      setError('Gagal mengirim OTP. Pastikan koneksi internet stabil.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Verify OTP Login
  const handleVerifyOtpLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpPhone || !otpCode) {
      setError('Nomor HP dan Kode OTP wajib diisi');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/customer/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: otpPhone, otpCode }),
      });

      const data = await res.json();
      if (data.success) {
        localStorage.setItem('customer_token', data.token);
        if (data.user) {
          localStorage.setItem('customer_user', JSON.stringify(data.user));
        }
        router.push('/customer');
      } else {
        setError(data.error || 'Kode OTP tidak valid atau telah kedaluwarsa');
      }
    } catch {
      setError('Gagal memverifikasi OTP. Coba beberapa saat lagi.');
    } finally {
      setLoading(false);
    }
  };

  // Forgot Password: Step 1 Send OTP
  const handleForgotSendOtp = async () => {
    if (!forgotPhone) {
      setForgotError('Masukkan nomor WhatsApp terdaftar Anda');
      return;
    }

    setForgotLoading(true);
    setForgotError('');

    try {
      const res = await fetch('/api/customer/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: forgotPhone }),
      });

      const data = await res.json();
      if (data.success) {
        setForgotStep(2);
      } else {
        setForgotError(data.error || 'Nomor WhatsApp tidak terdaftar di sistem kami');
      }
    } catch {
      setForgotError('Gagal menghubungi server');
    } finally {
      setForgotLoading(false);
    }
  };

  // Forgot Password: Step 2 Reset Password
  const handleForgotReset = async () => {
    if (!forgotOtp || !forgotNewPassword) {
      setForgotError('Kode OTP dan Password Baru wajib diisi');
      return;
    }

    if (forgotNewPassword.length < 4) {
      setForgotError('Password minimal 4 karakter');
      return;
    }

    setForgotLoading(true);
    setForgotError('');

    try {
      const res = await fetch('/api/customer/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: forgotPhone,
          otpCode: forgotOtp,
          newPassword: forgotNewPassword,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setForgotSuccess(data.message || 'Password berhasil diubah!');
        setTimeout(() => {
          setShowForgotModal(false);
          setForgotStep(1);
          setForgotPhone('');
          setForgotOtp('');
          setForgotNewPassword('');
          setForgotSuccess('');
          setLoginMode('password');
        }, 2000);
      } else {
        setForgotError(data.error || 'Kode OTP salah atau kedaluwarsa');
      }
    } catch {
      setForgotError('Gagal mereset password. Silakan coba lagi.');
    } finally {
      setForgotLoading(false);
    }
  };

  const resolvedLogo = companyLogo || '/images/logo.png';

  if (!brandLoaded) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#002c60]" />
          <p className="text-xs font-mono text-slate-500 uppercase tracking-wider">Memuat Portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100/70 flex flex-col justify-between selection:bg-[#002c60] selection:text-white font-sans">
      {/* ── Top Subtle Brand Line ── */}
      <div className="h-1.5 w-full bg-gradient-to-r from-[#001c39] via-[#002c60] to-[#0ea5e9]" />

      {/* ── Main Content Container ── */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 my-auto">
        <div className="w-full max-w-md">
          {/* Brand Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-white shadow-sm border border-slate-200/80 mb-3.5">
              <img
                src={companyLogo || '/logo.png'}
                alt={companyName || 'Portal Pelanggan'}
                className="h-14 sm:h-16 w-auto max-w-[220px] object-contain"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
            </div>

            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Portal Pelanggan
            </h1>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">
              Masuk untuk kelola tagihan, pembayaran instan, dan pantau koneksi internet Anda.
            </p>
          </div>

          {/* Form Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/60 p-6 sm:p-8">
            {/* Segmented Mode Switcher */}
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/60 mb-6">
              <button
                type="button"
                onClick={() => { setLoginMode('password'); setError(''); }}
                className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer ${
                  loginMode === 'password'
                    ? 'bg-white text-[#002c60] shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <KeyRound className="w-4 h-4 text-[#1b437c]" />
                Sandi Akun
              </button>
              <button
                type="button"
                onClick={() => { setLoginMode('otp'); setError(''); }}
                className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer ${
                  loginMode === 'otp'
                    ? 'bg-white text-[#002c60] shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Phone className="w-4 h-4 text-[#1b437c]" />
                WhatsApp OTP
              </button>
            </div>

          {/* Global Alert Notification */}
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-50/90 border border-red-200 text-red-700 text-xs flex items-start gap-2.5 animate-in fade-in slide-in-from-top-1">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <span className="leading-snug">{error}</span>
            </div>
          )}

          {/* ── MODE 1: PASSWORD LOGIN ── */}
          {loginMode === 'password' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 font-mono">
                  ID Pelanggan / Nomor HP
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="Contoh: EMG001 atau 08123456789"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#002c60] focus:bg-white focus:ring-2 focus:ring-[#002c60]/10 transition-all"
                    required
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider font-mono">
                    Password Portal
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotPhone(identifier);
                      setShowForgotModal(true);
                      setForgotStep(1);
                      setForgotError('');
                    }}
                    className="text-xs font-bold text-[#1b437c] hover:text-[#002c60] hover:underline"
                  >
                    Lupa Password?
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-11 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#002c60] focus:bg-white focus:ring-2 focus:ring-[#002c60]/10 transition-all font-mono"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3.5 px-4 bg-[#002c60] hover:bg-[#1b437c] active:scale-[0.99] text-white font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-[#002c60]/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Memeriksa Akun...</span>
                  </>
                ) : (
                  <>
                    <span>Masuk ke Akun</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* ── MODE 2: WHATSAPP OTP LOGIN ── */}
          {loginMode === 'otp' && (
            <form onSubmit={handleVerifyOtpLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 font-mono">
                  Nomor WhatsApp Terdaftar
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Phone className="w-4 h-4" />
                  </div>
                  <input
                    type="tel"
                    value={otpPhone}
                    onChange={(e) => setOtpPhone(e.target.value)}
                    placeholder="Contoh: 081234567890"
                    disabled={otpSent}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#002c60] focus:bg-white focus:ring-2 focus:ring-[#002c60]/10 transition-all disabled:opacity-60"
                    required
                  />
                </div>
              </div>

              {!otpSent ? (
                <button
                  type="button"
                  onClick={handleSendOtpLogin}
                  disabled={loading || !otpPhone}
                  className="w-full py-3.5 px-4 bg-[#002c60] hover:bg-[#1b437c] active:scale-[0.99] text-white font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-[#002c60]/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
                  <span>Kirim Kode OTP via WhatsApp</span>
                </button>
              ) : (
                <div className="space-y-4 animate-in fade-in">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 font-mono">
                      Masukkan 6 Digit Kode OTP
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="••••••"
                      className="w-full py-3 text-center tracking-[0.5em] font-mono text-xl font-bold bg-slate-50 border border-slate-200 rounded-xl text-[#002c60] focus:outline-none focus:border-[#002c60] focus:bg-white focus:ring-2 focus:ring-[#002c60]/10 transition-all"
                      required
                      autoFocus
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Tidak menerima kode?</span>
                    {otpCountdown > 0 ? (
                      <span className="font-mono text-slate-400 font-medium">Kirim ulang ({otpCountdown}s)</span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleSendOtpLogin}
                        disabled={loading}
                        className="font-bold text-[#1b437c] hover:underline cursor-pointer"
                      >
                        Kirim Ulang OTP
                      </button>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={loading || otpCode.length < 6}
                    className="w-full py-3.5 px-4 bg-[#002c60] hover:bg-[#1b437c] active:scale-[0.99] text-white font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-[#002c60]/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                    <span>Verifikasi & Masuk</span>
                  </button>
                </div>
              )}
            </form>
          )}

          {/* Quick Help WhatsApp Link */}
          {companyPhone && (
            <div className="mt-6 pt-5 border-t border-slate-100 text-center">
              <p className="text-xs text-slate-500 mb-2 font-medium">
                Kendalanya belum teratasi atau butuh bantuan?
              </p>
              <a
                href={`https://wa.me/${companyPhone.replace(/[^0-9]/g, '')}?text=Halo%20Admin%20${encodeURIComponent(companyName)},%20saya%20butuh%20bantuan%20login%20portal%20pelanggan.`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-[#059669] hover:text-[#047857] hover:underline"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Hubungi Layanan WhatsApp Admin</span>
              </a>
            </div>
          )}
          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="relative z-10 text-center py-6 text-xs text-slate-400">
        <p>{footerText || `© ${new Date().getFullYear()} ${companyName}. Hak Cipta Dilindungi.`}</p>
      </footer>

      {/* ── MODAL LUPA PASSWORD MANDIRI ── */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#002c60] flex items-center justify-center">
                  <KeyRound className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">Atur Ulang Password</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors"
                aria-label="Tutup modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {forgotError && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{forgotError}</span>
              </div>
            )}

            {forgotSuccess && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2 font-medium">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{forgotSuccess}</span>
              </div>
            )}

            {forgotStep === 1 ? (
              <div className="space-y-4">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Masukkan nomor WhatsApp yang terdaftar pada akun internet Anda untuk menerima kode verifikasi OTP.
                </p>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1 font-mono">
                    Nomor WhatsApp
                  </label>
                  <input
                    type="tel"
                    value={forgotPhone}
                    onChange={(e) => setForgotPhone(e.target.value)}
                    placeholder="0812xxxxxxxx"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:border-[#002c60]"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleForgotSendOtp}
                  disabled={forgotLoading || !forgotPhone}
                  className="w-full py-3 bg-[#002c60] hover:bg-[#1b437c] text-white text-xs font-bold rounded-xl shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {forgotLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Kirim Kode Verifikasi'}
                </button>
              </div>
            ) : (
              <div className="space-y-3.5">
                <p className="text-xs text-slate-600">
                  Kode OTP telah dikirim ke WhatsApp <b>{forgotPhone}</b>.
                </p>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1 font-mono">
                    Kode OTP (6 Digit)
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={forgotOtp}
                    onChange={(e) => setForgotOtp(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="000000"
                    className="w-full py-2.5 text-center font-mono font-bold tracking-widest text-base bg-slate-50 border border-slate-200 rounded-xl text-[#002c60] focus:outline-none focus:border-[#002c60]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1 font-mono">
                    Password Baru
                  </label>
                  <div className="relative">
                    <input
                      type={forgotShowPassword ? 'text' : 'password'}
                      value={forgotNewPassword}
                      onChange={(e) => setForgotNewPassword(e.target.value)}
                      placeholder="Minimal 4 karakter"
                      className="w-full pl-3 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-mono focus:outline-none focus:border-[#002c60]"
                    />
                    <button
                      type="button"
                      onClick={() => setForgotShowPassword(!forgotShowPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                    >
                      {forgotShowPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleForgotReset}
                  disabled={forgotLoading || !forgotOtp || !forgotNewPassword}
                  className="w-full py-3 bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-2 cursor-pointer"
                >
                  {forgotLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Simpan Password Baru
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
