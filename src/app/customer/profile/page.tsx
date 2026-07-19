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
    if (!editName.trim()) {
      toast('error', 'Validasi', 'Nama tidak boleh kosong');
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
          name: editName.trim(),
          email: editEmail.trim() || null,
          phone: editPhone.trim(),
          otpCode: isPhoneChanged ? otpCode.trim() : undefined,
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

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword.trim()) {
      toast('error', 'Validasi', 'Password baru tidak boleh kosong');
      return;
    }
    if (newPassword.length < 6) {
      toast('error', 'Validasi', 'Password minimal 6 karakter');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast('error', 'Validasi', 'Konfirmasi password tidak cocok');
      return;
    }
    
    setChangingPassword(true);
    const token = localStorage.getItem('customer_token');
    try {
      const res = await fetch('/api/customer/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast('error', 'Gagal', data.message || 'Gagal mengubah password');
        return;
      }
      toast('success', 'Berhasil', 'Password portal berhasil diperbarui');
      setNewPassword('');
      setConfirmPassword('');
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
    <main className="flex-1 overflow-y-auto px-margin-mobile md:px-margin-desktop py-8 bg-surface w-full">
      <div className="max-w-[800px] mx-auto space-y-bento-gap">
        
        {/* Page Title */}
        <div className="mb-6">
          <h2 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">Profil Akun</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">Kelola data pribadi dan pengaturan keamanan Anda.</p>
        </div>

        {/* Bento Card: Profile Header */}
        <div className="bg-surface-container-lowest border border-hairline-border rounded-lg p-6 flex flex-col md:flex-row items-center gap-6 shadow-[0_4px_12px_rgba(0,0,0,0.02)]">
          <div className="relative group cursor-pointer">
            <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-hairline-border flex items-center justify-center bg-surface-container-high text-primary">
              <span className="material-symbols-outlined text-4xl">person</span>
            </div>
          </div>
          
          <div className="text-center md:text-left flex-1">
            <h3 className="font-headline-md text-headline-md font-bold text-on-surface">{customer.name}</h3>
            <p className="font-data-mono text-data-mono text-on-surface-variant mt-1">ID: {customer.customerId || customer.username}</p>
            <div className="mt-3 flex items-center justify-center md:justify-start gap-2">
              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full font-label-caps text-label-caps ${customer.status === 'ISOLATED' ? 'bg-status-isolated/10 text-status-isolated border border-status-isolated/20' : 'bg-status-active/10 text-status-active border border-status-active/20'}`}>
                <span className="material-symbols-outlined text-[14px]">
                  {customer.status === 'ISOLATED' ? 'error' : 'check_circle'}
                </span> 
                {customer.status === 'ISOLATED' ? 'Terisolir' : 'Aktif'}
              </span>
            </div>
          </div>
        </div>

        {/* Bento Card: Personal Information */}
        <div className="bg-surface-container-lowest border border-hairline-border rounded-lg p-6 shadow-[0_4px_12px_rgba(0,0,0,0.02)]">
          <div className="flex items-center gap-2 mb-6 border-b border-hairline-border pb-4">
            <span className="material-symbols-outlined text-primary">person</span>
            <h3 className="font-body-lg text-body-lg font-semibold text-on-surface">Informasi Pribadi</h3>
          </div>
          
          <form className="space-y-6" onSubmit={handleSaveProfile}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Name Input */}
              <div className="flex flex-col gap-1.5">
                <label className="font-label-caps text-label-caps text-on-surface-variant uppercase">Nama Lengkap</label>
                <input 
                  type="text" 
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-surface border border-hairline-border rounded-DEFAULT font-body-md text-body-md text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors" 
                />
              </div>
              
              {/* Email Input */}
              <div className="flex flex-col gap-1.5">
                <label className="font-label-caps text-label-caps text-on-surface-variant uppercase">Email</label>
                <input 
                  type="email" 
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full px-4 py-2.5 bg-surface border border-hairline-border rounded-DEFAULT font-body-md text-body-md text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors" 
                />
              </div>
            </div>

            {/* Phone Number & OTP Section */}
            <div className="bg-surface-container-low p-5 rounded-DEFAULT border border-hairline-border space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-label-caps text-label-caps text-on-surface-variant uppercase">Nomor WhatsApp</label>
                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant font-data-mono text-data-mono"></span>
                    <input 
                      type="tel" 
                      value={editPhone}
                      onChange={(e) => {
                        setEditPhone(e.target.value);
                        setOtpRequested(false);
                      }}
                      className="w-full px-4 py-2.5 bg-surface border border-hairline-border rounded-DEFAULT font-data-mono text-data-mono text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors" 
                    />
                  </div>
                  {isPhoneChanged && (
                    <button 
                      type="button"
                      onClick={handleSendOtp}
                      disabled={sendingOtp}
                      className="shrink-0 px-4 py-2.5 bg-surface text-primary border border-primary rounded-DEFAULT font-label-caps text-label-caps uppercase hover:bg-primary-container hover:text-on-primary-container transition-colors active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                      {sendingOtp ? 'Mengirim...' : 'Kirim OTP'}
                    </button>
                  )}
                </div>
              </div>
              
              {otpRequested && (
                <div className="flex flex-col gap-1.5">
                  <label className="font-label-caps text-label-caps text-on-surface-variant uppercase">Kode OTP</label>
                  <input 
                    type="text" 
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="Masukkan 6-digit kode" 
                    className="w-full max-w-[200px] px-4 py-2.5 bg-surface border border-hairline-border rounded-DEFAULT font-data-mono text-data-mono text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors tracking-widest"
                  />
                  <p className="font-label-caps text-label-caps text-on-surface-variant mt-1 lowercase">Cek pesan WhatsApp Anda untuk melihat kode OTP.</p>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button 
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 bg-primary text-on-primary rounded-DEFAULT font-label-caps text-label-caps uppercase hover:bg-primary-container hover:text-on-primary-container transition-colors shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          </form>
        </div>

        {/* Bento Card: Security */}
        <div className="bg-surface-container-lowest border border-hairline-border rounded-lg p-6 shadow-[0_4px_12px_rgba(0,0,0,0.02)]">
          <div className="flex items-center gap-2 mb-6 border-b border-hairline-border pb-4">
            <span className="material-symbols-outlined text-status-warning">lock</span>
            <h3 className="font-body-lg text-body-lg font-semibold text-on-surface">Keamanan</h3>
          </div>
          
          <form className="space-y-5" onSubmit={handleUpdatePassword}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-1.5 relative">
                <label className="font-label-caps text-label-caps text-on-surface-variant uppercase">Password Baru</label>
                <div className="relative">
                  <input 
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••" 
                    className="w-full pl-4 pr-10 py-2.5 bg-surface border border-hairline-border rounded-DEFAULT font-data-mono text-data-mono text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors" 
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {showPassword ? 'visibility' : 'visibility_off'}
                    </span>
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-1.5 relative">
                <label className="font-label-caps text-label-caps text-on-surface-variant uppercase">Ulangi Password</label>
                <div className="relative">
                  <input 
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••" 
                    className="w-full pl-4 pr-10 py-2.5 bg-surface border border-hairline-border rounded-DEFAULT font-data-mono text-data-mono text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors" 
                  />
                  <button 
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {showConfirmPassword ? 'visibility' : 'visibility_off'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end pt-4">
              <button 
                type="submit"
                disabled={changingPassword}
                className="px-6 py-2.5 border border-primary text-primary rounded-DEFAULT font-label-caps text-label-caps uppercase hover:bg-primary hover:text-on-primary transition-colors shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {changingPassword ? 'Memperbarui...' : 'Ubah Password'}
              </button>
            </div>
          </form>
        </div>

      </div>
    </main>
  );
}
