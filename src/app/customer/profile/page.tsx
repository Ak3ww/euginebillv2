'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, Mail, Phone, CreditCard, Calendar, Package, LogOut, Shield, Edit3, Save, X, Loader2 } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { formatWIB } from '@/lib/timezone';
import { CyberCard, CyberButton } from '@/components/cyberpunk';
import { useToast } from '@/components/cyberpunk/CyberToast';

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
    // Check authentication
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
        return 'bg-green-500/10 text-green-600 border border-green-500/20';
      case 'SUSPENDED':
        return 'bg-red-500/10 text-red-600 border border-red-500/20';
      case 'EXPIRED':
        return 'bg-yellow-500/10 text-yellow-600 border border-yellow-500/20';
      default:
        return 'bg-muted/10 text-muted border border-rule';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-muted">
        <Loader2 className="w-6 h-6 animate-spin mb-4" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-3">
        <CyberCard className="p-4 text-center bg-destructive/10 border-2 border-destructive/30">
          <p className="text-destructive text-sm font-bold">
            {t('profile.loadError')}
          </p>
        </CyberCard>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto space-y-6 animate-in fade-in duration-700">
      
      {/* Profile Header */}
      <div className="p-6 bg-paper border border-rule rounded-[10px] shadow-sm relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-accent/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded bg-muted/10 border border-rule flex items-center justify-center flex-shrink-0">
            <User size={28} className="text-ink" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-display font-medium text-ink truncate">{customer.name}</h1>
            <p className="text-[11px] font-mono text-muted uppercase mt-1 tracking-widest">@{customer.username}</p>
          </div>
          <span className={`px-2 py-1 rounded text-[10px] font-mono font-bold uppercase tracking-wider ${getStatusBadge(customer.status)} flex-shrink-0`}>
            {customer.status}
          </span>
        </div>
      </div>

      {/* Contact Information */}
      <div className="bg-paper border border-rule rounded-[10px] shadow-sm p-6">
        <div className="flex items-center justify-between mb-5 border-b border-rule pb-3">
          <h2 className="text-xs font-mono font-bold text-ink flex items-center gap-2 uppercase tracking-widest">
            <Mail size={14} className="text-muted" />
            {t('profile.contactInfo')}
          </h2>
          {!editing ? (
            <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase text-muted hover:text-ink transition-colors">
              <Edit3 className="w-3.5 h-3.5" /> Edit
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-paper text-[10px] font-mono font-bold rounded-[6px] transition-colors disabled:opacity-50">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Save className="w-3.5 h-3.5" /> Save</>}
              </button>
              <button onClick={handleCancelEdit} disabled={saving} className="p-1.5 text-muted hover:text-ink transition-colors disabled:opacity-50">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
        
        <div className="space-y-4">
          <div className="grid grid-cols-[100px_1fr] gap-4 items-center">
            <p className="text-[10px] font-mono text-muted uppercase tracking-wider">FULL_NAME</p>
            <p className="text-sm font-display font-medium text-ink">{customer.name || '-'}</p>
          </div>
          
          <div className="grid grid-cols-[100px_1fr] gap-4 items-start">
            <p className="text-[10px] font-mono text-muted uppercase tracking-wider mt-2.5">EMAIL_ADDR</p>
            <div>
              {editing ? (
                <input
                  type="email"
                  value={editEmail}
                  onChange={e => setEditEmail(e.target.value)}
                  className="w-full bg-paper border border-rule focus:border-accent/50 focus:ring-1 focus:ring-accent/20 rounded-[6px] px-3 py-2 text-sm text-ink outline-none transition-all font-mono"
                  placeholder="name@domain.com"
                />
              ) : (
                <p className="text-sm font-mono text-ink mt-1.5">{customer.email || <span className="text-muted italic text-[11px]">NOT_SET</span>}</p>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-[100px_1fr] gap-4 items-start">
            <p className="text-[10px] font-mono text-muted uppercase tracking-wider mt-2.5">PHONE_NUM</p>
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
                      className="flex-1 bg-paper border border-rule focus:border-accent/50 focus:ring-1 focus:ring-accent/20 rounded-[6px] px-3 py-2 text-sm text-ink outline-none transition-all font-mono"
                      placeholder="+62..."
                    />
                    {editPhone.trim() !== (customer?.phone || '') && (
                      <button
                        type="button"
                        onClick={handleSendOtp}
                        disabled={sendingOtp}
                        className="px-3 py-2 bg-paper border border-rule hover:border-accent/50 text-ink text-[10px] font-mono font-bold rounded-[6px] transition-colors flex items-center gap-1.5 disabled:opacity-50 uppercase"
                      >
                        {sendingOtp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Kirim OTP'}
                      </button>
                    )}
                  </div>
                  {otpRequested && (
                    <div className="p-3 bg-muted/5 border border-rule rounded-[6px]">
                      <p className="text-[9px] text-muted font-mono uppercase tracking-widest mb-1.5">VERIFICATION_CODE (OTP)</p>
                      <input
                        type="text"
                        maxLength={6}
                        value={otpCode}
                        onChange={e => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                        className="w-full bg-paper border border-rule focus:border-accent/50 focus:ring-1 focus:ring-accent/20 rounded-[6px] px-3 py-2 text-sm text-ink outline-none transition-all font-mono text-center tracking-[0.5em] font-bold"
                        placeholder="000000"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm font-mono text-ink mt-1.5">{customer.phone || <span className="text-muted italic text-[11px]">NOT_SET</span>}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Package Information */}
        {customer.profile && (
          <div className="bg-paper border border-rule rounded-[10px] shadow-sm p-6">
            <h2 className="text-xs font-mono font-bold text-ink mb-4 pb-3 border-b border-rule flex items-center gap-2 uppercase tracking-widest">
              <Package size={14} className="text-muted" />
              {t('profile.packageInfo')}
            </h2>
            <div className="space-y-4">
              <div>
                <p className="text-[9px] font-mono text-muted uppercase tracking-wider mb-1">PLAN_NAME</p>
                <p className="text-sm font-display font-medium text-ink">{customer.profile.name}</p>
              </div>
              <div>
                <p className="text-[9px] font-mono text-muted uppercase tracking-wider mb-1">BANDWIDTH (DL/UL)</p>
                <p className="text-xs font-mono font-bold text-ink">
                  {customer.profile.downloadSpeed} Mbps / {customer.profile.uploadSpeed} Mbps
                </p>
              </div>
              {customer.expiryDate && (
                <div>
                  <p className="text-[9px] font-mono text-muted uppercase tracking-wider mb-1">EXPIRATION_DATE</p>
                  <p className="text-xs font-mono font-bold text-ink">
                    {formatWIB(customer.expiryDate, 'dd MMM yyyy')}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Account Information */}
        <div className="bg-paper border border-rule rounded-[10px] shadow-sm p-6">
          <h2 className="text-xs font-mono font-bold text-ink mb-4 pb-3 border-b border-rule flex items-center gap-2 uppercase tracking-widest">
            <Shield size={14} className="text-muted" />
            {t('profile.accountInfo')}
          </h2>
          <div className="space-y-4">
            {customer.customerId && (
              <div>
                <p className="text-[9px] font-mono text-muted uppercase tracking-wider mb-1">CUSTOMER_ID</p>
                <p className="text-sm font-mono font-bold text-ink bg-muted/5 px-3 py-1.5 rounded inline-block border border-rule">{customer.customerId}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Change Password Card */}
      <div className="bg-paper border border-rule rounded-[10px] shadow-sm p-6">
        <h2 className="text-xs font-mono font-bold text-ink mb-4 pb-3 border-b border-rule flex items-center gap-2 uppercase tracking-widest">
          <Shield size={14} className="text-muted" />
          PORTAL_AUTH_KEY
        </h2>
        <form onSubmit={handleUpdatePassword} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-mono text-muted uppercase tracking-wider mb-1.5">NEW_PASSWORD</p>
              <input
                type="password"
                required
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full bg-paper border border-rule focus:border-accent/50 focus:ring-1 focus:ring-accent/20 rounded-[6px] px-3 py-2 text-sm text-ink outline-none transition-all font-mono"
                placeholder="Minimal 6 karakter"
              />
            </div>
            <div>
              <p className="text-[10px] font-mono text-muted uppercase tracking-wider mb-1.5">CONFIRM_PASSWORD</p>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full bg-paper border border-rule focus:border-accent/50 focus:ring-1 focus:ring-accent/20 rounded-[6px] px-3 py-2 text-sm text-ink outline-none transition-all font-mono"
                placeholder="Ulangi password"
              />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button type="submit" disabled={changingPassword} className="flex items-center gap-2 px-4 py-2 bg-paper border border-rule hover:border-accent/50 text-ink text-[11px] font-mono font-bold rounded-[6px] transition-colors disabled:opacity-50 uppercase">
              {changingPassword ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Ubah Password'}
            </button>
          </div>
        </form>
      </div>

      {/* Actions */}
      <div className="pt-4">
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-3 bg-red-600/10 hover:bg-red-600/20 text-red-600 border border-red-600/20 rounded-[10px] transition-colors text-[11px] font-mono font-bold uppercase tracking-wider"
        >
          <LogOut size={14} />
          <span>{t('profile.logout')}</span>
        </button>
      </div>

      {/* Version Info */}
      <div className="text-center py-4">
        <p className="text-[10px] text-muted font-mono uppercase tracking-widest">
          {companyName} v1.0.0
        </p>
      </div>
    </div>
  );
}


