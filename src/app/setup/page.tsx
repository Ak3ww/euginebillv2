'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Building2, UserCheck, ShieldCheck, ArrowRight, ArrowLeft, 
  Loader2, CheckCircle2, AlertCircle, Globe, Phone, Mail, 
  Lock, Calendar, Tag, Server
} from 'lucide-react';

export default function SetupWizardPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    // Step 1: Company Profile
    companyName: '',
    companyAddress: '',
    companyPhone: '',
    companyEmail: '',
    companyLogo: '',
    baseUrl: typeof window !== 'undefined' ? window.location.origin : '',
    timezone: 'Asia/Jakarta',

    // Step 2: Superadmin Account
    adminName: '',
    adminEmail: '',
    adminPassword: '',
    adminPasswordConfirm: '',

    // Step 3: Billing & System Defaults
    customerIdPrefix: 'EB-',
    fixedBillingDate: '20',
  });

  // Verify if system is already initialized
  useEffect(() => {
    async function checkStatus() {
      try {
        const res = await fetch('/api/setup');
        const data = await res.json();
        if (data.isInitialized) {
          router.replace('/admin/login');
        } else {
          setChecking(false);
        }
      } catch (err) {
        console.error('Setup check error:', err);
        setChecking(false);
      }
    }
    checkStatus();
  }, [router]);

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleNext = () => {
    if (currentStep === 1) {
      if (!formData.companyName.trim()) {
        setError('Nama ISP / Perusahaan wajib diisi.');
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (!formData.adminName.trim() || !formData.adminEmail.trim()) {
        setError('Nama dan Email Admin wajib diisi.');
        return;
      }
      if (!formData.adminPassword || formData.adminPassword.length < 6) {
        setError('Password minimal 6 karakter.');
        return;
      }
      if (formData.adminPassword !== formData.adminPasswordConfirm) {
        setError('Konfirmasi password tidak cocok.');
        return;
      }
      setCurrentStep(3);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Gagal melakukan inisialisasi.');
      }

      router.push('/admin/login?setup=success');
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan sistem.');
      setSubmitting(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-4" />
        <p className="text-sm font-medium text-slate-400">Memeriksa status inisialisasi sistem...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      {/* Background radial gradient */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-slate-950 to-slate-950" />

      <div className="sm:mx-auto sm:w-full sm:max-w-xl relative z-10 px-4">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#002c60] to-blue-600 shadow-xl shadow-blue-900/30 mb-4 border border-blue-400/20">
            <Server className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            Inisialisasi Sistem EugineBill
          </h1>
          <p className="mt-2 text-sm text-slate-400 max-w-md mx-auto">
            Selamat datang di platform billing & RADIUS ISP. Lengkapi formulir wizard berikut untuk menyiapkan instans server Anda.
          </p>
        </div>

        {/* Step Indicator */}
        <div className="grid grid-cols-3 gap-2 mb-8 bg-slate-900/80 p-2 rounded-2xl border border-slate-800">
          <div className={`flex items-center gap-2 p-2.5 rounded-xl transition-all ${currentStep === 1 ? 'bg-[#002c60] text-white shadow-sm' : 'text-slate-500'}`}>
            <Building2 className="w-4 h-4 shrink-0" />
            <span className="text-xs font-bold hidden sm:inline">1. ISP / Usaha</span>
          </div>
          <div className={`flex items-center gap-2 p-2.5 rounded-xl transition-all ${currentStep === 2 ? 'bg-[#002c60] text-white shadow-sm' : 'text-slate-500'}`}>
            <UserCheck className="w-4 h-4 shrink-0" />
            <span className="text-xs font-bold hidden sm:inline">2. Akun Admin</span>
          </div>
          <div className={`flex items-center gap-2 p-2.5 rounded-xl transition-all ${currentStep === 3 ? 'bg-[#002c60] text-white shadow-sm' : 'text-slate-500'}`}>
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span className="text-xs font-bold hidden sm:inline">3. Tagihan</span>
          </div>
        </div>

        {/* Wizard Card */}
        <div className="bg-slate-900/90 backdrop-blur-md rounded-3xl border border-slate-800 shadow-2xl p-6 sm:p-8">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-950/50 border border-red-800/80 text-red-200 text-xs sm:text-sm font-medium flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* ── STEP 1: Profil Perusahaan ── */}
            {currentStep === 1 && (
              <div className="space-y-4 animate-in fade-in duration-300">
                <div className="border-b border-slate-800 pb-3 mb-4">
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-blue-400" />
                    Identitas ISP / RT-RW Net
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">Informasi nama perusahaan yang akan tampil di invoice dan portal pelanggan.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Nama ISP / Brand Perusahaan <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.companyName}
                    onChange={(e) => updateField('companyName', e.target.value)}
                    placeholder="Contoh: MediaNet Nusantara"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400" /> No. Telepon / WhatsApp
                    </label>
                    <input
                      type="text"
                      value={formData.companyPhone}
                      onChange={(e) => updateField('companyPhone', e.target.value)}
                      placeholder="081234567890"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-slate-400" /> Email Resmi
                    </label>
                    <input
                      type="email"
                      value={formData.companyEmail}
                      onChange={(e) => updateField('companyEmail', e.target.value)}
                      placeholder="support@isp.net"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-slate-400" /> Domain / URL Aplikasi (Base URL)
                  </label>
                  <input
                    type="url"
                    value={formData.baseUrl}
                    onChange={(e) => updateField('baseUrl', e.target.value)}
                    placeholder="https://billing.isp.net"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-all font-mono"
                  />
                  <p className="text-2xs text-slate-500 mt-1">Digunakan untuk link tagihan otomatis di pesan WhatsApp.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Alamat Kantor
                  </label>
                  <textarea
                    rows={2}
                    value={formData.companyAddress}
                    onChange={(e) => updateField('companyAddress', e.target.value)}
                    placeholder="Jl. Raya No. 123, Kota..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                </div>
              </div>
            )}

            {/* ── STEP 2: Akun Admin ── */}
            {currentStep === 2 && (
              <div className="space-y-4 animate-in fade-in duration-300">
                <div className="border-b border-slate-800 pb-3 mb-4">
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-emerald-400" />
                    Akun Super Admin Utama
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">Akun ini memiliki hak akses penuh ke seluruh menu administrasi EugineBill.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Nama Lengkap Admin <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.adminName}
                    onChange={(e) => updateField('adminName', e.target.value)}
                    placeholder="Administrator"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Email Login <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.adminEmail}
                    onChange={(e) => updateField('adminEmail', e.target.value)}
                    placeholder="admin@isp.net"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-slate-400" /> Password <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="password"
                      required
                      value={formData.adminPassword}
                      onChange={(e) => updateField('adminPassword', e.target.value)}
                      placeholder="Minimal 6 karakter"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-slate-400" /> Ulangi Password <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="password"
                      required
                      value={formData.adminPasswordConfirm}
                      onChange={(e) => updateField('adminPasswordConfirm', e.target.value)}
                      placeholder="Konfirmasi password"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ── STEP 3: Tagihan & Jaringan Awal ── */}
            {currentStep === 3 && (
              <div className="space-y-4 animate-in fade-in duration-300">
                <div className="border-b border-slate-800 pb-3 mb-4">
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-amber-400" />
                    Standar Tagihan & Pelanggan
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">Konfigurasi siklus penagihan bulanan dan format ID pelanggan baru.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-slate-400" /> Prefix ID Pelanggan
                    </label>
                    <input
                      type="text"
                      value={formData.customerIdPrefix}
                      onChange={(e) => updateField('customerIdPrefix', e.target.value)}
                      placeholder="EB-"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-all font-mono"
                    />
                    <p className="text-2xs text-slate-500 mt-1">Format ID pelanggan otomatis (misal EB-0001).</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" /> Tanggal Jatuh Tempo Rutin
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="28"
                      value={formData.fixedBillingDate}
                      onChange={(e) => updateField('fixedBillingDate', e.target.value)}
                      placeholder="20"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                    <p className="text-2xs text-slate-500 mt-1">Tanggal tagihan bulanan jatuh tempo (default: tgl 20).</p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-blue-950/40 border border-blue-900/60 text-xs text-blue-300 space-y-2">
                  <p className="font-bold flex items-center gap-1.5 text-blue-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Sistem Siap Pakai Langsung
                  </p>
                  <p className="leading-relaxed">
                    Setelah inisialisasi selesai, Anda dapat langsung menambahkan router MikroTik, membuat paket internet, dan mengaktifkan bot WhatsApp Baileys di dalam Web Admin.
                  </p>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              {currentStep > 1 ? (
                <button
                  type="button"
                  onClick={() => { setCurrentStep(prev => prev - 1); setError(null); }}
                  className="px-4 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-xs sm:text-sm font-bold text-slate-300 transition-all flex items-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" /> Kembali
                </button>
              ) : <div />}

              {currentStep < 3 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="px-6 py-2.5 rounded-xl bg-[#002c60] hover:bg-blue-800 text-xs sm:text-sm font-bold text-white shadow-md transition-all flex items-center gap-2 ml-auto"
                >
                  Lanjut <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs sm:text-sm font-bold text-white shadow-lg shadow-emerald-900/30 transition-all flex items-center gap-2 ml-auto disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Selesaikan Inisialisasi
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
