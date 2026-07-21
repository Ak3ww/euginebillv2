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
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
          <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-muted)]">Memuat paket...</p>
        </div>
      </div>
    );
  }


    return (
    <main className="max-w-[1280px] mx-auto px-4 md:px-8 py-6 pb-32 md:pb-8 min-h-screen">
      <button 
        onClick={() => router.push('/customer')}
        className="flex items-center gap-1.5 text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors font-mono text-[10px] uppercase tracking-wider font-bold mb-6"
      >
        <span className="material-symbols-outlined text-[16px]">arrow_back</span>
        Kembali
      </button>
      {/* Page Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-display font-medium text-[var(--color-ink)]">Pengajuan Ganti Paket</h2>
        <p className="text-sm font-body text-[var(--color-ink-2)] mt-1">Ubah paket internet Anda secara mandiri. Invoice akan turun setelah disetujui Admin.</p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-[var(--color-error)]/10 border-l-4 border-[var(--color-error)] rounded-[var(--radius-sm)] mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-[var(--color-error)] flex-shrink-0 mt-0.5" />
            <p className="text-sm font-medium text-[var(--color-error)] leading-relaxed">{error}</p>
          </div>
          {error.includes('tagihan yang belum dibayar') && companyPhone && (
            <a
              href={`https://wa.me/${companyPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Halo Admin, saya ${customer?.name || ''} (${customer?.customerId || '-'}) ingin mengajukan Ganti Paket, tapi di portal tertulis ada tagihan yang belum dibayar. Mohon bantuannya untuk mengecek dan membatalkan tagihan bulan depan saya agar bisa Ganti Paket.`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 inline-flex items-center gap-2 bg-[var(--color-success)] text-white px-4 py-2 rounded-[var(--radius-sm)] font-mono text-[10px] uppercase font-bold tracking-wider transition-colors shadow-sm"
            >
              Hubungi Admin via WA
            </a>
          )}
        </div>
      )}

      {/* Pending Request Alert */}
      {pendingRequest && (
        <div className="flex items-start gap-4 p-5 bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/20 rounded-[var(--radius-lg)] mb-6 shadow-sm">
          <Clock className="w-6 h-6 flex-shrink-0 text-[var(--color-warning)] animate-pulse mt-0.5" />
          <div>
            <p className="text-base font-bold text-[var(--color-warning)]">Pengajuan Sedang Diproses</p>
            <p className="text-sm text-[var(--color-warning)]/80 mt-1 leading-relaxed">
              Pengajuan pindah ke paket <strong className="font-bold">{pendingRequest.newProfileName}</strong> sedang menunggu persetujuan dari Admin. 
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
            <div className="bg-[var(--color-paper)] rounded-[var(--radius-lg)] border border-[var(--color-rule)] shadow-sm overflow-hidden">
              <div className="bg-[var(--color-paper-2)] px-5 py-4 border-b border-[var(--color-rule)]">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-mono text-[10px] text-[var(--color-muted)] font-bold uppercase tracking-wider mb-1 block">Paket Saat Ini</span>
                    <h2 className="text-lg font-display font-medium text-[var(--color-ink)]">{customer.profileName}</h2>
                  </div>
                  <Package className="w-6 h-6 text-[var(--color-muted)]" />
                </div>
              </div>
              
              <div className="p-5">
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b border-[var(--color-rule)] pb-3">
                    <span className="font-mono text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-wider">Kecepatan</span>
                    <span className="text-sm font-bold text-[var(--color-ink)]">{formatSpeed(customer.downloadSpeed)}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-[var(--color-rule)] pb-3">
                    <span className="font-mono text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-wider">Harga Bulanan</span>
                    <span className="text-sm font-bold text-[var(--color-focus)]">{formatCurrency(customer.price)}</span>
                  </div>
                  {customer.expiredAt && (
                    <div className="flex justify-between items-center pt-1">
                      <span className="font-mono text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-wider">Masa Aktif</span>
                      <span className="font-mono text-[10px] font-bold text-[var(--color-ink-2)] bg-[var(--color-paper-3)] px-2.5 py-1 rounded-[var(--radius-sm)] border border-[var(--color-rule)]">
                        {new Date(customer.expiredAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Guidelines Card */}
          <div className="bg-[var(--color-paper)] rounded-[var(--radius-lg)] border border-[var(--color-rule)] shadow-sm p-5">
            <h3 className="font-mono text-[10px] font-bold text-[var(--color-ink)] uppercase tracking-wider mb-4 flex items-center gap-2">
              <Info className="w-4 h-4 text-[var(--color-focus)]" /> Informasi Ganti Paket
            </h3>
            <ul className="text-sm font-body text-[var(--color-ink-2)] space-y-3">
              <li className="flex gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-focus)] mt-1.5 flex-shrink-0" />
                <span>Pengajuan ganti paket akan <b className="text-[var(--color-ink)] font-semibold">direview oleh Admin</b> terlebih dahulu.</span>
              </li>
              <li className="flex gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-focus)] mt-1.5 flex-shrink-0" />
                <span>Setelah disetujui, sistem akan membuatkan invoice <b className="text-[var(--color-ink)] font-semibold">Prorata (disesuaikan dengan sisa hari aktif)</b>.</span>
              </li>
              <li className="flex gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-focus)] mt-1.5 flex-shrink-0" />
                <span>Paket baru Anda <b className="text-[var(--color-ink)] font-semibold">otomatis aktif</b> segera setelah invoice lunas dibayarkan.</span>
              </li>
            </ul>
          </div>
        </div>

        {/* -- RIGHT COLUMN: Package list & calculations (8/12) -- */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-[var(--color-paper)] rounded-[var(--radius-lg)] border border-[var(--color-rule)] shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-[var(--color-rule)] bg-[var(--color-paper-2)] flex items-center gap-3">
              <div className="p-2 bg-[var(--color-focus)]/10 rounded-[var(--radius-sm)] text-[var(--color-focus)]">
                <Tag className="w-4 h-4" />
              </div>
              <h2 className="font-mono text-[10px] font-bold text-[var(--color-ink)] uppercase tracking-wider">Pilih Paket Baru</h2>
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
                        className={`relative text-left p-5 rounded-[var(--radius-lg)] border-2 transition-all duration-200 ${
                          isSelected
                            ? 'border-[var(--color-focus)] bg-[var(--color-focus)]/5'
                            : isDisabled
                              ? 'border-[var(--color-rule)] bg-[var(--color-paper-2)] opacity-60 cursor-not-allowed'
                              : 'border-[var(--color-rule)] bg-[var(--color-paper)] hover:border-[var(--color-focus)]/50 hover:bg-[var(--color-paper-3)]'
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute top-4 right-4 text-[var(--color-focus)]">
                            <CheckCircle className="w-5 h-5" />
                          </div>
                        )}
                        <h3 className={`font-display text-base font-medium mb-1 ${isSelected ? 'text-[var(--color-focus)]' : 'text-[var(--color-ink)]'}`}>{pkg.name}</h3>
                        <p className="text-xs font-body text-[var(--color-ink-2)] mb-4">
                          {pkg.description || `${formatSpeed(pkg.downloadSpeed)} Unlimited`}
                        </p>
                        <p className="text-lg font-display font-medium text-[var(--color-ink)]">
                          {formatCurrency(pkg.price)}<span className="text-xs font-mono text-[var(--color-muted)] font-normal">/bln</span>
                        </p>
                      </button>
                    );
                  })}
              </div>
            </div>
          </div>

          {/* Calculation Breakdown Preview */}
          {selectedPackage && (
            <div className="bg-[var(--color-paper-2)] rounded-[var(--radius-lg)] border border-[var(--color-rule)] shadow-sm overflow-hidden text-[var(--color-ink)]">
              <div className="px-6 py-4 border-b border-[var(--color-rule)] flex items-center justify-between">
                <h3 className="font-mono text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-wider">
                  Estimasi Biaya Prorata
                </h3>
              </div>

              <div className="p-6">
                {loadingCalc ? (
                  <div className="flex flex-col items-center justify-center py-8 text-[var(--color-ink-2)]">
                    <Loader2 className="w-8 h-8 animate-spin text-[var(--color-focus)] mb-3" />
                    <span className="text-sm font-body">Menghitung rincian biaya...</span>
                  </div>
                ) : calculation ? (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center text-sm font-body">
                      <span className="text-[var(--color-ink-2)]">Sisa Masa Aktif Paket Lama</span>
                      <span className="font-medium text-[var(--color-ink)]">{calculation.remainingDays} Hari</span>
                    </div>

                    {calculation.isProrated && (
                      <>
                        <div className="flex justify-between items-center text-sm font-body">
                          <span className="text-[var(--color-ink-2)]">Sisa Saldo Paket Lama (Potongan)</span>
                          <span className="font-medium text-[var(--color-success)]">-{formatCurrency(calculation.oldUnusedValue)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm font-body">
                          <span className="text-[var(--color-ink-2)]">Biaya Paket Baru ({calculation.remainingDays} Hari)</span>
                          <span className="font-medium text-[var(--color-ink)]">{formatCurrency(calculation.newProratedCost)}</span>
                        </div>
                      </>
                    )}

                    <div className="flex justify-between items-center text-sm font-body border-t border-[var(--color-rule)] pt-4">
                      <span className="text-[var(--color-ink-2)]">Harga Dasar Penyesuaian</span>
                      <span className="font-medium text-[var(--color-ink)]">{formatCurrency(calculation.baseAmount)}</span>
                    </div>

                    {calculation.taxAmount > 0 && (
                      <div className="flex justify-between items-center text-sm font-body">
                        <span className="text-[var(--color-ink-2)]">PPN ({calculation.taxRate}%)</span>
                        <span className="font-medium text-[var(--color-ink)]">{formatCurrency(calculation.taxAmount)}</span>
                      </div>
                    )}

                    <div className="flex justify-between items-center font-display text-xl font-medium border-t border-[var(--color-rule)] pt-4 mt-2">
                      <span>Estimasi Tagihan Baru</span>
                      <span className="text-[var(--color-focus)]">{formatCurrency(calculation.totalAmount)}</span>
                    </div>
                    
                    <p className="font-mono text-[10px] text-[var(--color-muted)] text-center pt-2 mt-4">
                      *Ini hanya estimasi. Tagihan akhir akan dibuat setelah Admin menyetujui pengajuan Anda.
                    </p>

                    <button
                      onClick={handleUpgrade}
                      disabled={upgrading || !!pendingRequest}
                      className="w-full mt-6 bg-[var(--color-accent)] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-[var(--color-accent-ink)] py-4 rounded-[var(--radius-sm)] font-mono text-[10px] uppercase font-bold tracking-wider flex items-center justify-center transition-opacity"
                    >
                      {upgrading ? (
                        <><Loader2 className="w-4 h-4 animate-spin mr-2" />Memproses Pengajuan...</>
                      ) : (
                        <><Send className="w-4 h-4 mr-2" />AJUKAN GANTI PAKET</>
                      )}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
