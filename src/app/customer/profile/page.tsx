'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { User, Mail, Phone, CreditCard, Calendar, Package, LogOut, Shield, Edit3, Save, X, Loader2 } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { formatWIB } from '@/lib/timezone';
import { useToast } from '@/components/cyberpunk/CyberToast';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

interface CustomerData {
  id: string;
  username: string;
  name: string;
  email: string | null;
  phone: string | null;
  address?: string | null;
  status: string;
  customerId?: string | null;
  packageName: string | null;
  packagePrice: number | null;
  expiryDate: string | null;
  createdAt?: string;
  profile?: {
    id: string;
    name: string;
    downloadSpeed: string;
    uploadSpeed: string;
  };
}

export default function CustomerProfilePage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { addToast } = useToast();
  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState('Radius');

  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!loading && customer) {
      gsap.fromTo('.profile-item', 
        { y: 40, opacity: 0, rotationX: 10, scale: 0.98 },
        { y: 0, opacity: 1, rotationX: 0, scale: 1, duration: 0.6, stagger: 0.1, ease: 'power3.out', clearProps: 'all' }
      );
    }
  }, { scope: containerRef, dependencies: [loading, customer] });

  // 3D Hover Effect
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -4;
    const rotateY = ((x - centerX) / centerX) * 4;
    gsap.to(card, { rotateX, rotateY, duration: 0.4, ease: "power2.out", transformPerspective: 1000 });
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    gsap.to(e.currentTarget, { rotateX: 0, rotateY: 0, duration: 0.7, ease: "power2.out" });
  };

  // Edit state
  const [editing, setEditing]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [editName, setEditName]   = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');

  // OTP change phone state
  const [otpRequested, setOtpRequested] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);

  const handleSendOtp = async () => {
    if (!editPhone.trim()) {
      toast('error', 'Validasi', 'Nomor WhatsApp baru wajib diisi');
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
        toast('success', 'OTP Terkirim', data.message || 'OTP berhasil dikirim ke nomor baru Anda');
      } else {
        toast('error', 'Gagal mengirim OTP', data.error || 'Terjadi kesalahan');
      }
    } catch {
      toast('error', 'Error', 'Gagal mengirim OTP. Periksa koneksi internet Anda.');
    } finally {
      setSendingOtp(false);
    }
  };

  // Password change state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

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

  const toast = (type: 'success' | 'error' | 'info', title: string, desc?: string) =>
    addToast({ type, title, description: desc, duration: type === 'error' ? 8000 : 5000 });

  useEffect(() => {
    const token = localStorage.getItem('customer_token');
    
    if (!token) {
      router.push('/customer/login');
      return;
    }

    fetchCustomerProfile(token);
    fetch('/api/public/company').then(r => r.json()).then(d => { if (d.success && d.company?.name) setCompanyName(d.company.name); }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const fetchCustomerProfile = async (token: string) => {
    try {
      const response = await fetch('/api/customer/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('customer_token');
          localStorage.removeItem('customer_user');
          router.push('/customer/login');
          return;
        }
        throw new Error('Failed to fetch profile');
      }

      const data = await response.json();
      if (data.success && data.user) {
        const user = data.user;
        const c = {
          id: user.id,
          username: user.username,
          name: user.name,
          email: user.email,
          phone: user.phone,
          status: user.status,
          customerId: user.customerId || null,
          packageName: user.profile?.name || null,
          packagePrice: null,
          expiryDate: user.expiredAt,
          profile: user.profile
        };
        setCustomer(c);
        setEditName(user.name || '');
        setEditPhone(user.phone || '');
        setEditEmail(user.email || '');
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('customer_token');
    localStorage.removeItem('customer_user');
    router.push('/customer/login');
  };

  const handleSave = async () => {
    const token = localStorage.getItem('customer_token');
    if (!token) return;
    if (editPhone && !/^[0-9+\-\s]{8,20}$/.test(editPhone)) {
      toast('error', 'Validasi', 'Format nomor telepon tidak valid');
      return;
    }
    if (editEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editEmail)) {
      toast('error', 'Validasi', 'Format email tidak valid');
      return;
    }

    const payload: any = { email: editEmail.trim() || null };
    const isPhoneChanged = editPhone.trim() !== (customer?.phone || '');
    if (isPhoneChanged) {
      if (!otpCode.trim()) {
        toast('error', 'Validasi', 'Masukkan kode OTP yang dikirim ke nomor WhatsApp baru Anda');
        return;
      }
      payload.phone = editPhone.trim();
      payload.phoneOtp = otpCode.trim();
    }

    setSaving(true);
    try {
      const res = await fetch('/api/customer/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) {
        toast('error', 'Gagal menyimpan', data.message || data.error || 'Terjadi kesalahan');
        return;
      }
      const u = data.user;
      setCustomer(prev => prev ? { ...prev, name: u.name, phone: u.phone, email: u.email } : prev);
      setEditing(false);
      setOtpRequested(false);
      setOtpCode('');
      toast('success', 'Profil diperbarui', 'Data berhasil disimpan');
    } catch {
      toast('error', 'Error', 'Terjadi kesalahan saat menyimpan');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (!customer) return;
    setEditName(customer.name || '');
    setEditPhone(customer.phone || '');
    setEditEmail(customer.email || '');
    setEditing(false);
    setOtpRequested(false);
    setOtpCode('');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.2)]';
      case 'SUSPENDED':
        return 'bg-red-500/10 text-red-400 border border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.2)]';
      case 'EXPIRED':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.2)]';
      default:
        return 'bg-white/10 text-white border border-white/20';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-gray-400">
        <Loader2 className="w-8 h-8 animate-spin mb-4 text-blue-400" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-4">
        <div className="p-6 text-center glass-panel border border-red-500/30 rounded-2xl shadow-[0_0_20px_rgba(239,68,68,0.1)]">
          <p className="text-red-400 text-sm font-bold">
            {t('profile.loadError')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="p-4 lg:p-8 max-w-4xl mx-auto space-y-6 pb-24">
      
      {/* Profile Header */}
      <div 
        className="profile-item glass-panel floating-element rounded-2xl p-6 lg:p-8 relative overflow-hidden group"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-blue-400/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
        <div className="flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 shadow-[0_0_15px_rgba(255,255,255,0.05)]">
            <User size={36} className="text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl lg:text-3xl font-display font-medium truncate mb-1">{customer.name}</h1>
            <p className="text-xs font-mono opacity-50 uppercase tracking-widest">@{customer.username}</p>
          </div>
          <span className={`px-4 py-2 rounded-xl text-xs font-mono font-bold uppercase tracking-wider ${getStatusBadge(customer.status)} flex-shrink-0 self-start sm:self-center`}>
            {customer.status}
          </span>
        </div>
      </div>

      {/* Contact Information */}
      <div 
        className="profile-item glass-panel floating-element rounded-2xl p-6 lg:p-8 relative overflow-hidden"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <div className="flex items-center justify-between mb-6 border-b border-white/10 pb-4">
          <h2 className="text-xs font-mono font-bold flex items-center gap-3 uppercase tracking-widest">
            <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
              <Mail size={16} className="text-blue-400" />
            </div>
            {t('profile.contactInfo')}
          </h2>
          {!editing ? (
            <button onClick={() => setEditing(true)} className="flex items-center gap-2 px-4 py-2 text-[10px] font-mono font-bold uppercase text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/10">
              <Edit3 className="w-3.5 h-3.5" /> Edit
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 text-[10px] font-mono font-bold rounded-xl transition-all shadow-[0_0_10px_rgba(59,130,246,0.1)] disabled:opacity-50">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Save className="w-3.5 h-3.5" /> Save</>}
              </button>
              <button onClick={handleCancelEdit} disabled={saving} className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl transition-all disabled:opacity-50">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
        
        <div className="space-y-6">
          <div className="grid grid-cols-[120px_1fr] gap-4 items-center">
            <p className="text-[10px] font-mono opacity-50 uppercase tracking-wider">FULL_NAME</p>
            <p className="text-sm font-display font-medium bg-white/5 px-4 py-2 rounded-lg border border-white/10 inline-block w-fit">{customer.name || '-'}</p>
          </div>
          
          <div className="grid grid-cols-[120px_1fr] gap-4 items-start">
            <p className="text-[10px] font-mono opacity-50 uppercase tracking-wider mt-3">EMAIL_ADDR</p>
            <div>
              {editing ? (
                <input
                  type="email"
                  value={editEmail}
                  onChange={e => setEditEmail(e.target.value)}
                  className="w-full bg-black/20 border border-white/20 focus:border-blue-400/50 rounded-xl px-4 py-3 text-sm outline-none transition-all font-mono"
                  placeholder="name@domain.com"
                />
              ) : (
                <p className="text-sm font-mono mt-2">{customer.email || <span className="opacity-30 italic text-[11px]">NOT_SET</span>}</p>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-[120px_1fr] gap-4 items-start">
            <p className="text-[10px] font-mono opacity-50 uppercase tracking-wider mt-3">PHONE_NUM</p>
            <div>
              {editing ? (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="tel"
                      value={editPhone}
                      onChange={e => {
                        setEditPhone(e.target.value);
                        setOtpRequested(false);
                        setOtpCode('');
                      }}
                      className="flex-1 bg-black/20 border border-white/20 focus:border-blue-400/50 rounded-xl px-4 py-3 text-sm outline-none transition-all font-mono"
                      placeholder="+62..."
                    />
                    {editPhone.trim() !== (customer?.phone || '') && (
                      <button
                        type="button"
                        onClick={handleSendOtp}
                        disabled={sendingOtp}
                        className="px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 text-[10px] font-mono font-bold rounded-xl transition-all flex items-center gap-2 disabled:opacity-50 uppercase"
                      >
                        {sendingOtp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Kirim OTP'}
                      </button>
                    )}
                  </div>
                  {otpRequested && (
                    <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                      <p className="text-[10px] opacity-60 font-mono uppercase tracking-widest mb-2">VERIFICATION_CODE (OTP)</p>
                      <input
                        type="text"
                        maxLength={6}
                        value={otpCode}
                        onChange={e => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                        className="w-full bg-black/40 border border-blue-500/30 focus:border-blue-400/60 rounded-xl px-4 py-3 text-sm outline-none transition-all font-mono text-center tracking-[0.5em] font-bold text-blue-400"
                        placeholder="000000"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm font-mono mt-2">{customer.phone || <span className="opacity-30 italic text-[11px]">NOT_SET</span>}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Package Information */}
        {customer.profile && (
          <div 
            className="profile-item glass-panel floating-element rounded-2xl p-6 relative overflow-hidden"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            <h2 className="text-xs font-mono font-bold mb-5 pb-4 border-b border-white/10 flex items-center gap-3 uppercase tracking-widest">
              <div className="p-2 bg-purple-500/10 rounded-lg border border-purple-500/20">
                <Package size={16} className="text-purple-400" />
              </div>
              {t('profile.packageInfo')}
            </h2>
            <div className="space-y-5">
              <div>
                <p className="text-[10px] font-mono opacity-50 uppercase tracking-wider mb-1.5">PLAN_NAME</p>
                <p className="text-base font-display font-medium text-white">{customer.profile.name}</p>
              </div>
              <div>
                <p className="text-[10px] font-mono opacity-50 uppercase tracking-wider mb-1.5">BANDWIDTH (DL/UL)</p>
                <p className="text-sm font-mono font-bold text-white bg-white/5 px-3 py-1.5 rounded-lg border border-white/10 inline-block">
                  {customer.profile.downloadSpeed} Mbps / {customer.profile.uploadSpeed} Mbps
                </p>
              </div>
              {customer.expiryDate && (
                <div>
                  <p className="text-[10px] font-mono opacity-50 uppercase tracking-wider mb-1.5">EXPIRATION_DATE</p>
                  <p className="text-sm font-mono font-bold text-white">
                    {formatWIB(customer.expiryDate, 'dd MMM yyyy')}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Account Information */}
        <div 
          className="profile-item glass-panel floating-element rounded-2xl p-6 relative overflow-hidden"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <h2 className="text-xs font-mono font-bold mb-5 pb-4 border-b border-white/10 flex items-center gap-3 uppercase tracking-widest">
            <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
              <Shield size={16} className="text-emerald-400" />
            </div>
            {t('profile.accountInfo')}
          </h2>
          <div className="space-y-5">
            {customer.customerId && (
              <div>
                <p className="text-[10px] font-mono opacity-50 uppercase tracking-wider mb-1.5">CUSTOMER_ID</p>
                <p className="text-sm font-mono font-bold text-white bg-white/5 px-4 py-2 rounded-lg inline-block border border-white/10">{customer.customerId}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Change Password Card */}
      <div 
        className="profile-item glass-panel floating-element rounded-2xl p-6 lg:p-8 relative overflow-hidden"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <h2 className="text-xs font-mono font-bold mb-5 pb-4 border-b border-white/10 flex items-center gap-3 uppercase tracking-widest">
          <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/20">
            <Shield size={16} className="text-amber-400" />
          </div>
          PORTAL_AUTH_KEY
        </h2>
        <form onSubmit={handleUpdatePassword} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <p className="text-[10px] font-mono opacity-50 uppercase tracking-wider mb-2">NEW_PASSWORD</p>
              <input
                type="password"
                required
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full bg-black/20 border border-white/20 focus:border-amber-400/50 rounded-xl px-4 py-3 text-sm outline-none transition-all font-mono"
                placeholder="Minimal 6 karakter"
              />
            </div>
            <div>
              <p className="text-[10px] font-mono opacity-50 uppercase tracking-wider mb-2">CONFIRM_PASSWORD</p>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full bg-black/20 border border-white/20 focus:border-amber-400/50 rounded-xl px-4 py-3 text-sm outline-none transition-all font-mono"
                placeholder="Ulangi password"
              />
            </div>
          </div>
          <div className="flex justify-end pt-3">
            <button type="submit" disabled={changingPassword} className="flex items-center gap-2 px-5 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-mono font-bold rounded-xl transition-all disabled:opacity-50 uppercase shadow-[0_0_15px_rgba(245,158,11,0.1)]">
              {changingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Ubah Password'}
            </button>
          </div>
        </form>
      </div>

      {/* Actions */}
      <div className="profile-item pt-2">
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-4 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-2xl transition-all text-xs font-mono font-bold uppercase tracking-wider shadow-[0_0_15px_rgba(239,68,68,0.1)] hover:shadow-[0_0_20px_rgba(239,68,68,0.2)]"
        >
          <LogOut size={16} />
          <span>{t('profile.logout')}</span>
        </button>
      </div>

      {/* Version Info */}
      <div className="text-center py-6">
        <p className="text-[10px] opacity-30 font-mono uppercase tracking-widest">
          {companyName} v1.0.0
        </p>
      </div>
    </div>
  );
}
