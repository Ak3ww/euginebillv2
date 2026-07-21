'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/components/cyberpunk/CyberToast';

export const dynamic = 'force-dynamic';

interface CustomerData {
  id: string;
  username: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  customerId?: string | null;
}

export default function CustomerProfilePage() {
  const router = useRouter();
  const { addToast } = useToast();
  const toast = (type: 'success' | 'error' | 'info', title: string, desc?: string) =>
    addToast({ type, title, description: desc, duration: type === 'error' ? 8000 : 5000 });
    
  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit state
  const [saving, setSaving] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');

  // OTP change phone state
  const [otpRequested, setOtpRequested] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);

  // Password change state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [passwordOtp, setPasswordOtp] = useState('');
  const [passwordOtpRequested, setPasswordOtpRequested] = useState(false);
  const [sendingPasswordOtp, setSendingPasswordOtp] = useState(false);

  useEffect(() => {
    loadUserData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const loadUserData = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('customer_token') : null;
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
        setCustomer(data.user);
        setEditName(data.user.name || '');
        setEditPhone(data.user.phone || '');
        setEditEmail(data.user.email || '');
      }
    } catch (error) {
      console.error('Load user data error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    if (!editPhone.trim()) {
      toast('error', 'Validasi', 'Nomor WhatsApp wajib diisi');
      return;
    }
    setSendingOtp(true);
    const token = localStorage.getItem('customer_token');
    try {
      const res = await fetch('/api/customer/profile/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ newPhone: editPhone.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setOtpRequested(true);
        toast('success', 'OTP Terkirim', data.message || 'OTP berhasil dikirim ke nomor Anda');
      } else {
        toast('error', 'Gagal mengirim OTP', data.error || 'Terjadi kesalahan');
      }
    } catch {
      toast('error', 'Error', 'Gagal mengirim OTP. Periksa koneksi internet Anda.');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (false) {
      // Name edit disabled
      return;
    }
    const isPhoneChanged = editPhone.trim() !== (customer?.phone || '');
    if (isPhoneChanged && !otpRequested) {
      toast('error', 'Validasi', 'Silakan kirim OTP untuk mengubah nomor HP');
      return;
    }
    if (isPhoneChanged && !otpCode.trim()) {
      toast('error', 'Validasi', 'Silakan masukkan kode OTP');
      return;
    }

    setSaving(true);
    const token = localStorage.getItem('customer_token');
    try {
      const res = await fetch('/api/customer/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          email: editEmail.trim() || null,
          phone: editPhone.trim(),
          phoneOtp: isPhoneChanged ? otpCode.trim() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast('error', 'Gagal', data.message || 'Gagal menyimpan profil');
        return;
      }
      toast('success', 'Tersimpan', 'Profil berhasil diperbarui');
      setOtpRequested(false);
      setOtpCode('');
      loadUserData();
    } catch {
      toast('error', 'Error', 'Terjadi kesalahan sistem');
    } finally {
      setSaving(false);
    }
  };

  const handleSendPasswordOtp = async () => {
    if (!newPassword.trim()) {
      toast('error', 'Validasi', 'Password baru tidak boleh kosong');
      return;
    }
    if (newPassword.length < 8) {
      toast('error', 'Validasi', 'Password minimal 8 karakter');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast('error', 'Validasi', 'Konfirmasi password tidak cocok');
      return;
    }

    setSendingPasswordOtp(true);
    const token = localStorage.getItem('customer_token');
    try {
      const res = await fetch('/api/customer/profile/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ purpose: 'password_change' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPasswordOtpRequested(true);
        toast('success', 'OTP Terkirim', data.message || 'OTP berhasil dikirim ke nomor Anda');
      } else {
        toast('error', 'Gagal mengirim OTP', data.error || 'Terjadi kesalahan');
      }
    } catch {
      toast('error', 'Error', 'Gagal mengirim OTP. Periksa koneksi internet Anda.');
    } finally {
      setSendingPasswordOtp(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword.trim()) {
      toast('error', 'Validasi', 'Password baru tidak boleh kosong');
      return;
    }
    if (newPassword.length < 8) {
      toast('error', 'Validasi', 'Password minimal 8 karakter');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast('error', 'Validasi', 'Konfirmasi password tidak cocok');
      return;
    }
    if (!passwordOtp.trim()) {
      toast('error', 'Validasi', 'Silakan masukkan kode OTP');
      return;
    }
    
    setChangingPassword(true);
    const token = localStorage.getItem('customer_token');
    try {
      const res = await fetch('/api/customer/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ password: newPassword, passwordOtp: passwordOtp.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast('error', 'Gagal', data.message || 'Gagal mengubah password');
        return;
      }
      toast('success', 'Berhasil', 'Password portal berhasil diperbarui');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordOtp('');
      setPasswordOtpRequested(false);
    } catch {
      toast('error', 'Error', 'Terjadi kesalahan sistem');
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="p-3 flex justify-center items-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!customer) return null;

  const isPhoneChanged = editPhone.trim() !== (customer.phone || '');

  return (
  <main className="max-w-[1280px] mx-auto px-4 md:px-8 py-6 pb-32 md:pb-8">
    {/* Back button */}
    <button
      onClick={() => router.push('/customer')}
      className="flex items-center gap-1.5 text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors font-mono text-[10px] uppercase tracking-wider font-bold mb-6"
    >
      <span className="material-symbols-outlined text-[16px]">arrow_back</span>
      Kembali
    </button>

    <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
      {/* Profile Header Card */}
      <div className="md:col-span-4 bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-[var(--radius-lg)] p-6 shadow-sm flex flex-col items-center text-center py-8">
        <div className="w-20 h-20 rounded-full bg-[var(--color-accent)] text-[var(--color-accent-ink)] flex items-center justify-center text-3xl font-display font-bold mb-4">
          {customer.name?.charAt(0)?.toUpperCase() || 'P'}
        </div>
        <h2 className="text-xl font-display font-semibold text-[var(--color-ink)]">{customer.name || '-'}</h2>
        <p className="font-mono text-[10px] text-[var(--color-muted)] uppercase tracking-wider mt-1">{customer.customerId || customer.username}</p>
        <span className={`mt-3 px-3 py-1 rounded-full text-xs font-mono font-bold tracking-wider ${customer.status === 'ISOLATED' ? 'bg-[var(--color-error-bg)] text-[var(--color-error)]' : 'bg-[var(--color-success-bg)] text-[var(--color-success)]'}`}>
          {customer.status === 'ISOLATED' ? 'Terisolir' : 'Pelanggan Aktif'}
        </span>
      </div>

      {/* Forms Column */}
      <div className="md:col-span-8 flex flex-col gap-5">
        {/* Personal Info */}
        <div className="bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-[var(--radius-lg)] p-6 shadow-sm">
          <h3 className="text-base font-display font-semibold text-[var(--color-ink)] mb-5">Informasi Pribadi</h3>
          
          <form className="flex flex-col gap-4" onSubmit={handleSaveProfile}>
            {/* Name */}
            <div>
              <label className="block text-xs font-mono font-bold tracking-wider text-[var(--color-ink-2)] uppercase mb-1.5">Nama Lengkap</label>
              <input
                type="text"
                value={editName}
                readOnly
                className="w-full px-4 py-2.5 bg-[var(--color-paper-2)] border border-[var(--color-rule)] rounded-[var(--radius-sm)] text-[var(--color-ink)] font-mono text-sm opacity-70 cursor-not-allowed"
                placeholder="Nama lengkap Anda"
              />
              <p className="text-[10px] text-[var(--color-muted)] font-mono mt-1">Nama hanya dapat diubah oleh Admin.</p>
            </div>
            {/* Email */}
            <div>
              <label className="block text-xs font-mono font-bold tracking-wider text-[var(--color-ink-2)] uppercase mb-1.5">Email</label>
              <input
                type="email"
                value={editEmail}
                onChange={e => setEditEmail(e.target.value)}
                className="w-full px-4 py-2.5 bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-[var(--radius-sm)] text-[var(--color-ink)] font-mono text-sm focus:outline-none focus:border-[var(--color-focus)] focus:ring-1 focus:ring-[var(--color-focus)]/20 transition-colors"
                placeholder="alamat@email.com"
              />
            </div>
            {/* Phone + OTP */}
            <div>
              <label className="block text-xs font-mono font-bold tracking-wider text-[var(--color-ink-2)] uppercase mb-1.5">Nomor Telepon</label>
              <div className="flex gap-2">
                <input
                  type="tel"
                  value={editPhone}
                  onChange={e => {
                    setEditPhone(e.target.value);
                    setOtpRequested(false);
                  }}
                  className="w-full flex-1 px-4 py-2.5 bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-[var(--radius-sm)] text-[var(--color-ink)] font-mono text-sm focus:outline-none focus:border-[var(--color-focus)] focus:ring-1 focus:ring-[var(--color-focus)]/20 transition-colors"
                  placeholder="08xxxxxxxxxx"
                />
                {isPhoneChanged && (
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={sendingOtp}
                    className="px-4 py-2.5 bg-[var(--color-paper)] text-[var(--color-focus)] border border-[var(--color-focus)] rounded-[var(--radius-sm)] font-mono text-[10px] uppercase font-bold tracking-wider whitespace-nowrap hover:bg-[var(--color-paper-3)] transition-colors disabled:opacity-50"
                  >
                    {sendingOtp ? 'Mengirim...' : 'Kirim OTP'}
                  </button>
                )}
              </div>
              {otpRequested && (
                <div className="mt-2">
                  <input
                    type="text"
                    value={otpCode}
                    onChange={e => setOtpCode(e.target.value)}
                    className="w-full max-w-[200px] px-4 py-2.5 bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-[var(--radius-sm)] text-[var(--color-ink)] font-mono text-sm focus:outline-none focus:border-[var(--color-focus)] focus:ring-1 focus:ring-[var(--color-focus)]/20 transition-colors tracking-widest"
                    placeholder="Masukkan kode OTP"
                    maxLength={6}
                  />
                  <p className="font-mono text-[10px] text-[var(--color-muted)] mt-1">Cek pesan WhatsApp Anda untuk melihat kode OTP.</p>
                </div>
              )}
            </div>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 bg-[var(--color-accent)] text-[var(--color-accent-ink)] rounded-[var(--radius-sm)] font-mono text-[10px] uppercase font-bold tracking-wider w-full md:w-auto md:self-end mt-2 hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </form>
        </div>

        {/* Security / Password */}
        <div className="bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-[var(--radius-lg)] p-6 shadow-sm">
          <h3 className="text-base font-display font-semibold text-[var(--color-ink)] mb-5">Keamanan</h3>
          <form className="flex flex-col gap-4" onSubmit={handleUpdatePassword}>
            <div>
              <label className="block text-xs font-mono font-bold tracking-wider text-[var(--color-ink-2)] uppercase mb-1.5">Password Baru</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full pl-4 pr-12 py-2.5 bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-[var(--radius-sm)] text-[var(--color-ink)] font-mono text-sm focus:outline-none focus:border-[var(--color-focus)] focus:ring-1 focus:ring-[var(--color-focus)]/20 transition-colors"
                  placeholder="Masukkan password baru"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">{showPassword ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-mono font-bold tracking-wider text-[var(--color-ink-2)] uppercase mb-1.5">Ulangi Password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full pl-4 pr-12 py-2.5 bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-[var(--radius-sm)] text-[var(--color-ink)] font-mono text-sm focus:outline-none focus:border-[var(--color-focus)] focus:ring-1 focus:ring-[var(--color-focus)]/20 transition-colors"
                  placeholder="Ulangi password baru"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">{showConfirmPassword ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
            </div>

            {passwordOtpRequested && (
              <div className="mt-2 p-4 bg-[var(--color-paper-2)] border border-[var(--color-rule)] rounded-[var(--radius-sm)]">
                <label className="block text-xs font-mono font-bold tracking-wider text-[var(--color-ink-2)] uppercase mb-1.5">Kode OTP</label>
                <input 
                  type="text" 
                  value={passwordOtp}
                  onChange={(e) => setPasswordOtp(e.target.value)}
                  placeholder="Masukkan 6-digit kode" 
                  className="w-full max-w-[240px] px-4 py-2.5 bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-[var(--radius-sm)] text-[var(--color-ink)] font-mono text-sm placeholder:text-[var(--color-muted)]/50 focus:outline-none focus:border-[var(--color-focus)] focus:ring-1 focus:ring-[var(--color-focus)]/20 transition-colors tracking-widest"
                />
                <p className="font-mono text-[10px] text-[var(--color-muted)] mt-1">Cek pesan WhatsApp Anda untuk melihat kode OTP.</p>
              </div>
            )}
            
            <div className="flex gap-3 mt-2 md:justify-end">
              {!passwordOtpRequested && (
                <button
                  type="button"
                  onClick={handleSendPasswordOtp}
                  disabled={sendingPasswordOtp || changingPassword}
                  className="px-6 py-3 bg-[var(--color-paper)] text-[var(--color-focus)] border border-[var(--color-focus)] rounded-[var(--radius-sm)] font-mono text-[10px] uppercase font-bold tracking-wider w-full md:w-auto hover:bg-[var(--color-paper-3)] transition-colors disabled:opacity-50"
                >
                  {sendingPasswordOtp ? 'Mengirim...' : 'Kirim OTP'}
                </button>
              )}
              <button
                type="submit"
                disabled={changingPassword || !passwordOtpRequested}
                className="px-6 py-3 bg-[var(--color-accent)] text-[var(--color-accent-ink)] rounded-[var(--radius-sm)] font-mono text-[10px] uppercase font-bold tracking-wider w-full md:w-auto hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {changingPassword ? 'Memperbarui...' : 'Ubah Password'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </main>
);
}
