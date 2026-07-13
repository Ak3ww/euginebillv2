'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Wifi,
  WifiOff,
  User,
  MapPin,
  Calendar,
  CreditCard,
  ShieldCheck,
  ChevronRight,
  RefreshCw,
  FileText,
  Phone
} from 'lucide-react';
import { formatWIB } from '@/lib/timezone';

interface CompanyInfo {
  name: string;
  phone: string;
  email: string;
  logo: string;
  isolationMessage: string;
}

interface UserInfo {
  username: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  customerId: string | null;
  area: string | null;
  expiredAt: string;
  profileName: string | undefined;
  profilePrice: number | null;
  unpaidInvoices: Array<{
    id: string;
    invoiceNumber: string;
    amount: number;
    dueDate: string;
    paymentToken: string | null;
  }>;
}

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);

const formatDate = (s: string) => formatWIB(s, 'd MMMM yyyy');

function IsolatedContent() {
  const searchParams = useSearchParams();
  const username = searchParams.get('username');
  const ip = searchParams.get('ip');

  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [alreadyActive, setAlreadyActive] = useState(false);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const companyRes = await fetch('/api/company/info');
      const companyData = await companyRes.json();
      if (companyData.success) setCompany(companyData.data);

      if (username || ip) {
        const params = new URLSearchParams();
        if (username) params.set('username', username);
        if (ip) params.set('ip', ip);
        const userRes = await fetch(`/api/pppoe/users/check-isolation?${params.toString()}`);
        const userData = await userRes.json();
        
        if (userData.success) {
          if (userData.isolated === false) {
            setAlreadyActive(true);
            setTimeout(() => { window.location.href = '/'; }, 3000);
            return;
          }
          if (userData.data) setUserInfo(userData.data);
        }
      }
    } catch (err) {
      console.error('Failed to fetch isolation data:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [username, ip]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Poll every 30 seconds to check if isolation has been lifted (e.g., they paid on another device)
  useEffect(() => {
    if (alreadyActive) return;
    const interval = setInterval(async () => {
      if (!username && !ip) return;
      try {
        const params = new URLSearchParams();
        if (username) params.set('username', username);
        if (ip) params.set('ip', ip);
        const res = await fetch(`/api/pppoe/users/check-isolation?${params.toString()}`);
        const data = await res.json();
        if (data.success && data.isolated === false) {
          setAlreadyActive(true);
          setTimeout(() => { window.location.href = '/'; }, 3000);
          clearInterval(interval);
          return;
        }
        if (data.success && data.data) setUserInfo(data.data);
      } catch (_) { /* silent */ }
    }, 30000);
    return () => clearInterval(interval);
  }, [username, ip, alreadyActive]);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center">
        <div className="w-16 h-16 relative flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-4 border-neutral-200"></div>
          <div className="absolute inset-0 rounded-full border-4 border-red-600 border-t-transparent animate-spin"></div>
          <ShieldCheck className="w-6 h-6 text-red-600 absolute" />
        </div>
        <p className="mt-4 font-medium text-neutral-500">Mempersiapkan Portal Tagihan...</p>
      </div>
    );
  }

  if (alreadyActive) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl border border-neutral-100 p-8 max-w-sm w-full shadow-xl shadow-green-900/5 text-center">
          <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-neutral-900 mb-2">Layanan Aktif!</h2>
          <p className="text-sm text-neutral-500 mb-8">Isolir telah dicabut. Anda dapat menggunakan layanan internet kembali.</p>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-lg text-sm font-medium border border-green-100">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Mengalihkan ke beranda...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-red-50/50 via-neutral-50 to-white py-8 px-4 font-sans pb-24">
      <div className="max-w-xl mx-auto space-y-6">
        
        {/* Secure Header */}
        <div className="flex flex-col items-center text-center mb-2">
          <div className="inline-flex items-center justify-center gap-2 px-4 py-1.5 rounded-full bg-red-50 text-red-700 text-xs font-bold border border-red-100 mb-4">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="tracking-wide">LAYANAN TERISOLIR</span>
          </div>
          
          {company?.logo ? (
            <div className="bg-white p-3 rounded-2xl shadow-sm border border-neutral-100 mb-4 flex items-center justify-center">
              <Image 
                unoptimized 
                src={company.logo} 
                alt={company.name || 'Logo'} 
                width={120} 
                height={60} 
                className="h-10 w-auto object-contain" 
              />
            </div>
          ) : (
            <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-neutral-100 flex items-center justify-center mb-4 text-red-600">
              <WifiOff className="w-8 h-8" />
            </div>
          )}
          
          <h1 className="text-2xl font-black text-neutral-900 mb-2">Akses Internet Ditangguhkan</h1>
          <p className="text-sm text-neutral-500 max-w-sm leading-relaxed">
            {company?.isolationMessage || 'Layanan Anda sedang dialihkan. Harap selesaikan pembayaran tagihan untuk mengaktifkan kembali layanan internet.'}
          </p>
        </div>

        {!userInfo ? (
          <div className="bg-white rounded-3xl border border-neutral-200 p-8 text-center shadow-sm">
            <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-neutral-900 mb-2">Data Tidak Ditemukan</h2>
            <p className="text-sm text-neutral-500">Tidak dapat memuat rincian tagihan untuk perangkat/akun ini.</p>
            <div className="mt-6 flex justify-center">
              <button 
                onClick={() => fetchData()}
                className="flex items-center gap-2 px-6 py-2.5 bg-neutral-100 text-neutral-700 rounded-xl text-sm font-bold hover:bg-neutral-200 transition-colors"
              >
                <RefreshCw className="w-4 h-4" /> Coba Lagi
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* User Info Card */}
            <div className="bg-white rounded-3xl border border-neutral-200 overflow-hidden shadow-sm">
              <div className="p-6">
                <div className="flex items-center gap-4 mb-6 pb-6 border-b border-neutral-100">
                  <div className="w-12 h-12 bg-neutral-100 rounded-full flex items-center justify-center text-neutral-600 shrink-0">
                    <User className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-bold text-neutral-900 truncate">{userInfo.name}</h2>
                    <p className="text-sm text-neutral-500 font-mono">{userInfo.username}</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  {userInfo.customerId && (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-neutral-50 flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-neutral-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-neutral-400 uppercase font-semibold tracking-wider">ID Pelanggan</p>
                        <p className="text-sm font-medium text-neutral-800 font-mono">{userInfo.customerId}</p>
                      </div>
                    </div>
                  )}
                  {userInfo.profileName && (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-neutral-50 flex items-center justify-center shrink-0">
                        <Wifi className="w-4 h-4 text-neutral-400" />
                      </div>
                      <div className="flex-1 min-w-0 flex items-center justify-between">
                        <div>
                          <p className="text-[11px] text-neutral-400 uppercase font-semibold tracking-wider">Paket Layanan</p>
                          <p className="text-sm font-medium text-neutral-800">{userInfo.profileName}</p>
                        </div>
                        {userInfo.profilePrice && (
                          <div className="text-right">
                            <p className="text-[11px] text-neutral-400 uppercase font-semibold tracking-wider">Tarif</p>
                            <p className="text-sm font-bold text-neutral-900">{formatCurrency(userInfo.profilePrice)}<span className="text-[10px] text-neutral-400 font-normal">/bln</span></p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {userInfo.phone && (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-neutral-50 flex items-center justify-center shrink-0">
                        <Phone className="w-4 h-4 text-neutral-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-neutral-400 uppercase font-semibold tracking-wider">Telepon</p>
                        <p className="text-sm font-medium text-neutral-800">{userInfo.phone}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="bg-red-50/50 p-4 border-t border-red-100 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                <p className="text-xs text-red-700 font-medium leading-relaxed">
                  Layanan terisolir sejak {formatDate(userInfo.expiredAt)}. Akses akan otomatis terbuka setelah tagihan lunas.
                </p>
              </div>
            </div>

            {/* Unpaid Invoices */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-red-600" />
                Tagihan Tertunda
                <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded-full text-xs ml-auto">
                  {userInfo.unpaidInvoices?.length || 0} Tagihan
                </span>
              </h3>
              
              {(!userInfo.unpaidInvoices || userInfo.unpaidInvoices.length === 0) ? (
                <div className="bg-white rounded-2xl border border-neutral-200 p-6 text-center">
                  <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-3" />
                  <p className="text-sm text-neutral-600 font-medium">Tidak ada tagihan tertunda ditemukan.</p>
                  <p className="text-xs text-neutral-400 mt-1">Sistem sedang memverifikasi status Anda...</p>
                </div>
              ) : (
                userInfo.unpaidInvoices.map((inv) => (
                  <div key={inv.id} className="bg-white rounded-3xl border-2 border-red-100 p-1 relative overflow-hidden group hover:border-red-200 transition-colors">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-red-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                    <div className="p-5 relative z-10">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <p className="text-xs text-neutral-500 font-medium mb-1 flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5" /> Jatuh Tempo
                          </p>
                          <p className="text-sm font-bold text-red-600">{formatDate(inv.dueDate)}</p>
                        </div>
                        <div className="bg-red-50 text-red-700 px-2.5 py-1 rounded text-[10px] font-bold tracking-wider uppercase">
                          Belum Bayar
                        </div>
                      </div>
                      
                      <div className="bg-neutral-50 rounded-2xl p-4 mb-4 border border-neutral-100">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs text-neutral-500">No. Tagihan</span>
                          <span className="text-xs font-mono font-medium text-neutral-700">{inv.invoiceNumber}</span>
                        </div>
                        <div className="flex justify-between items-end mt-3 pt-3 border-t border-neutral-200/60">
                          <span className="text-sm font-medium text-neutral-900">Total Pembayaran</span>
                          <span className="text-xl font-black text-neutral-900">{formatCurrency(inv.amount)}</span>
                        </div>
                      </div>

                      <a 
                        href={`/pay/${inv.paymentToken}`}
                        className="flex w-full items-center justify-center gap-2 bg-red-600 text-white rounded-xl py-3.5 text-sm font-bold hover:bg-red-700 transition-all active:scale-[0.98] shadow-lg shadow-red-600/20"
                      >
                        <CreditCard className="w-4 h-4" />
                        Bayar Sekarang
                        <ChevronRight className="w-4 h-4 opacity-50" />
                      </a>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            {/* Support info */}
            <div className="bg-neutral-200/50 rounded-2xl p-4 text-center">
              <p className="text-xs text-neutral-500 mb-2">Butuh bantuan atau sudah melakukan pembayaran?</p>
              <div className="flex justify-center gap-4 text-sm font-medium text-neutral-700">
                {company?.phone && (
                  <a href={`https://wa.me/${company.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-green-600">
                    <Phone className="w-3.5 h-3.5" /> WhatsApp
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function IsolatedPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center">
        <div className="w-16 h-16 relative flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-4 border-neutral-200"></div>
          <div className="absolute inset-0 rounded-full border-4 border-red-600 border-t-transparent animate-spin"></div>
        </div>
      </div>
    }>
      <IsolatedContent />
    </Suspense>
  );
}
