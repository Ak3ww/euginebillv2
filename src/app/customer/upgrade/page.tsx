'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Package, CheckCircle, AlertCircle, Loader2, Calendar, Tag, Clock, Send, Info
} from 'lucide-react';
import { useToast } from '@/components/cyberpunk/CyberToast';
import { showSuccess, showError } from '@/lib/sweetalert';

interface PPPoEProfile {
  id: string;
  name: string;
  price: number;
  downloadSpeed: number;
  uploadSpeed: number;
  description: string | null;
}

interface CustomerInfo {
  id: string;
  name: string;
  expiredAt: string | null;
  profileName: string;
  profileId: string;
  price: number;
  downloadSpeed: number;
  uploadSpeed: number;
}

interface ProrationCalc {
  isProrated: boolean;
  remainingDays: number;
  oldPackagePrice: number;
  newPackagePrice: number;
  oldUnusedValue: number;
  newProratedCost: number;
  baseAmount: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
}

export default function UpgradePackagePage() {
  const router = useRouter();
  const { addToast } = useToast();

  const [customer, setCustomer] = useState<CustomerInfo | null>(null);
  const [packages, setPackages] = useState<PPPoEProfile[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const [error, setError] = useState('');
  const [companyPhone, setCompanyPhone] = useState<string>('');

  // Proration states
  const [calculation, setCalculation] = useState<ProrationCalc | null>(null);
  const [loadingCalc, setLoadingCalc] = useState(false);
  const [pendingRequest, setPendingRequest] = useState<any | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedPackage) {
      fetchCalculation();
    } else {
      setCalculation(null);
    }
  }, [selectedPackage]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    const token = localStorage.getItem('customer_token');
    if (!token) {
      router.push('/customer/login');
      return;
    }

    try {
      // 1. Fetch current profile
      const profileRes = await fetch('/api/customer/profile', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const profileData = await profileRes.json();

      if (profileRes.ok && profileData.user) {
        setCustomer(profileData.user);
      } else {
        setError(profileData.error || 'Gagal memuat profil');
      }

      // 2. Fetch pending request
      const pkgReqRes = await fetch('/api/customer/upgrade', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const pkgReqData = await pkgReqRes.json();
      if (pkgReqRes.ok && pkgReqData.success) {
        setPendingRequest(pkgReqData.pendingRequest);
      }

      // 3. Fetch all packages
      const pkgRes = await fetch('/api/public/profiles', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const pkgData = await pkgRes.json();
      if (pkgRes.ok) {
        setPackages(pkgData.profiles || []);
      }

      // 4. Fetch company info for WhatsApp link
      const compRes = await fetch('/api/public/company');
      const compData = await compRes.json();
      if (compRes.ok && compData.company?.phone) {
        setCompanyPhone(compData.company.phone);
      }

    } catch (err) {
      console.error(err);
      setError('Gagal menghubungi server untuk memuat data');
    } finally {
      setLoading(false);
    }
  };

  const fetchCalculation = async () => {
    setLoadingCalc(true);
    const token = localStorage.getItem('customer_token');
    try {
      const res = await fetch(`/api/customer/upgrade?newProfileId=${selectedPackage}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setCalculation(data.calculation);
        if (data.pendingRequest) {
           setPendingRequest(data.pendingRequest);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingCalc(false);
    }
  };

  const handleUpgrade = async () => {
    if (!selectedPackage) {
      setError('Pilih paket yang ingin diajukan.');
      return;
    }

    setUpgrading(true);
    setError('');
    const token = localStorage.getItem('customer_token');

    try {
      const res = await fetch('/api/customer/upgrade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          newProfileId: selectedPackage
        })
      });
      const data = await res.json();

      if (data.success) {
        showSuccess(
          data.message || 'Pengajuan berhasil dikirim.',
          'Pengajuan Terkirim'
        );
        fetchData(); // Reload to show pending state
        setSelectedPackage('');
      } else {
        showError(data.error || 'Gagal memproses pengajuan', 'Error');
        setError(data.error || 'Gagal memproses permintaan');
      }
    } catch (error) {
      showError('Gagal menghubungi server', 'Error Jaringan');
      setError('Gagal menghubungi server');
    } finally {
      setUpgrading(false);
    }
  };

  const formatSpeed = (mbps: number) => {
    if (mbps >= 1000) return `${mbps / 1000} Gbps`;
    return `${mbps} Mbps`;
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-10 h-10 animate-spin text-red-600" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 w-full max-w-6xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="border-b border-neutral-200 pb-4">
        <h1 className="text-2xl font-black text-neutral-900 tracking-tight">Pengajuan Ganti Paket</h1>
        <p className="text-sm text-neutral-500 mt-1">Ubah paket internet Anda secara mandiri. Invoice akan turun setelah disetujui Admin.</p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-red-50 border-l-4 border-red-600 rounded-r-xl">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm font-medium text-red-800 leading-relaxed">{error}</p>
          </div>
          {error.includes('tagihan yang belum dibayar') && companyPhone && (
            <a
              href={`https://wa.me/${companyPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Halo Admin, saya ${customer?.name || ''} (${customer?.customerId || '-'}) ingin mengajukan Ganti Paket, tapi di portal tertulis ada tagihan yang belum dibayar. Mohon bantuannya untuk mengecek dan membatalkan tagihan bulan depan saya agar bisa Ganti Paket.`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors shadow-sm shadow-emerald-900/20"
            >
              Hubungi Admin via WA
            </a>
          )}
        </div>
      )}

      {/* Pending Request Alert */}
      {pendingRequest && (
        <div className="flex items-start gap-4 p-5 bg-amber-50 border border-amber-200 rounded-xl shadow-sm">
          <Clock className="w-6 h-6 flex-shrink-0 text-amber-600 animate-pulse mt-0.5" />
          <div>
            <p className="text-base font-bold text-amber-900">Pengajuan Sedang Diproses</p>
            <p className="text-sm text-amber-800 mt-1 leading-relaxed">
              Pengajuan pindah ke paket <strong className="text-amber-900">{pendingRequest.newProfileName}</strong> sedang menunggu persetujuan dari Admin. 
              Invoice penyesuaian akan dikirim otomatis via WhatsApp setelah pengajuan disetujui.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* -- LEFT COLUMN: Current package info (4/12) -- */}
        <div className="lg:col-span-4 space-y-6">
          {/* Current Package Card */}
          {customer && (
            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
              <div className="bg-neutral-900 px-5 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-neutral-400 font-bold tracking-widest uppercase mb-1 block">Paket Saat Ini</span>
                    <h2 className="text-lg font-black text-white">{customer.profileName}</h2>
                  </div>
                  <Package className="w-8 h-8 text-neutral-700" />
                </div>
              </div>
              
              <div className="p-5">
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b border-neutral-100 pb-3">
                    <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Kecepatan</span>
                    <span className="text-sm font-black text-neutral-900">{formatSpeed(customer.downloadSpeed)}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-neutral-100 pb-3">
                    <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Harga Bulanan</span>
                    <span className="text-sm font-black text-red-600">{formatCurrency(customer.price)}</span>
                  </div>
                  {customer.expiredAt && (
                    <div className="flex justify-between items-center pt-1">
                      <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Masa Aktif</span>
                      <span className="text-xs font-bold text-neutral-700 bg-neutral-100 px-2.5 py-1 rounded-md">
                        {new Date(customer.expiredAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Guidelines Card */}
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-5">
            <h3 className="text-xs font-black text-neutral-900 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-500" /> Informasi Ganti Paket
            </h3>
            <ul className="text-sm text-neutral-600 space-y-3">
              <li className="flex gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
                <span>Pengajuan ganti paket akan <b>direview oleh Admin</b> terlebih dahulu.</span>
              </li>
              <li className="flex gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
                <span>Setelah disetujui, sistem akan membuatkan invoice <b>Prorata (disesuaikan dengan sisa hari aktif)</b>.</span>
              </li>
              <li className="flex gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
                <span>Paket baru Anda <b>otomatis aktif</b> segera setelah invoice lunas dibayarkan.</span>
              </li>
            </ul>
          </div>
        </div>

        {/* -- RIGHT COLUMN: Package list & calculations (8/12) -- */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-neutral-100 bg-neutral-50/50 flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg text-red-600">
                <Tag className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-black text-neutral-900 uppercase tracking-wider">Pilih Paket Baru</h2>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {packages
                  .filter((pkg) => pkg.id !== customer?.profileId)
                  .map((pkg) => {
                    const isSelected = selectedPackage === pkg.id;
                    const isDisabled = !!pendingRequest;

                    return (
                      <button
                        key={pkg.id}
                        onClick={() => !isDisabled && setSelectedPackage(pkg.id)}
                        disabled={isDisabled}
                        className={`relative text-left p-5 rounded-2xl border-2 transition-all duration-200 ${
                          isSelected
                            ? 'border-red-600 bg-red-50 shadow-md shadow-red-100'
                            : isDisabled
                              ? 'border-neutral-100 bg-neutral-50 opacity-60 cursor-not-allowed'
                              : 'border-neutral-200 bg-white hover:border-red-300 hover:shadow-sm'
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute top-4 right-4 text-red-600 bg-white rounded-full">
                            <CheckCircle className="w-6 h-6" />
                          </div>
                        )}
                        <h3 className={`font-black text-base mb-1 ${isSelected ? 'text-red-900' : 'text-neutral-900'}`}>{pkg.name}</h3>
                        <p className="text-xs font-medium text-neutral-500 mb-4">
                          {pkg.description || `${formatSpeed(pkg.downloadSpeed)} Unlimited`}
                        </p>
                        <p className="text-lg font-black text-red-600">
                          {formatCurrency(pkg.price)}<span className="text-xs font-semibold text-neutral-500">/bln</span>
                        </p>
                      </button>
                    );
                  })}
              </div>
            </div>
          </div>

          {/* Calculation Breakdown Preview */}
          {selectedPackage && (
            <div className="bg-neutral-900 rounded-2xl shadow-xl overflow-hidden text-white border border-neutral-800">
              <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-widest text-neutral-400">
                  Estimasi Biaya Prorata
                </h3>
              </div>

              <div className="p-6">
                {loadingCalc ? (
                  <div className="flex flex-col items-center justify-center py-8 text-neutral-400">
                    <Loader2 className="w-8 h-8 animate-spin text-red-500 mb-3" />
                    <span className="text-sm font-medium">Menghitung rincian biaya...</span>
                  </div>
                ) : calculation ? (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-neutral-400">Sisa Masa Aktif Paket Lama</span>
                      <span className="font-bold">{calculation.remainingDays} Hari</span>
                    </div>

                    {calculation.isProrated && (
                      <>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-neutral-400">Sisa Saldo Paket Lama (Potongan)</span>
                          <span className="font-bold text-emerald-400">-{formatCurrency(calculation.oldUnusedValue)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-neutral-400">Biaya Paket Baru ({calculation.remainingDays} Hari)</span>
                          <span className="font-bold">{formatCurrency(calculation.newProratedCost)}</span>
                        </div>
                      </>
                    )}

                    <div className="flex justify-between items-center text-sm border-t border-neutral-800 pt-4">
                      <span className="text-neutral-400">Harga Dasar Penyesuaian</span>
                      <span className="font-bold">{formatCurrency(calculation.baseAmount)}</span>
                    </div>

                    {calculation.taxAmount > 0 && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-neutral-400">PPN ({calculation.taxRate}%)</span>
                        <span className="font-bold">{formatCurrency(calculation.taxAmount)}</span>
                      </div>
                    )}

                    <div className="flex justify-between items-center font-black text-xl border-t border-neutral-800 pt-4 mt-2">
                      <span>Estimasi Tagihan Baru</span>
                      <span className="text-red-500">{formatCurrency(calculation.totalAmount)}</span>
                    </div>
                    
                    <p className="text-[10px] text-neutral-500 text-center pt-2">
                      *Ini hanya estimasi. Tagihan akhir akan dibuat setelah Admin menyetujui pengajuan Anda.
                    </p>

                    <button
                      onClick={handleUpgrade}
                      disabled={upgrading || !!pendingRequest}
                      className="w-full mt-6 bg-red-600 hover:bg-red-700 disabled:bg-neutral-800 disabled:text-neutral-500 text-white font-black py-4 rounded-xl flex items-center justify-center transition-all shadow-[0_0_20px_rgba(220,38,38,0.3)] hover:shadow-[0_0_30px_rgba(220,38,38,0.5)] disabled:shadow-none"
                    >
                      {upgrading ? (
                        <><Loader2 className="w-5 h-5 animate-spin mr-2" />Memproses Pengajuan...</>
                      ) : (
                        <><Send className="w-5 h-5 mr-2" />AJUKAN GANTI PAKET</>
                      )}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
