'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Package, CheckCircle, AlertCircle, CreditCard,
  Loader2, ArrowRight, ShieldCheck, HelpCircle, Calendar, Tag
} from 'lucide-react';
import { CyberCard, CyberButton } from '@/components/cyberpunk';
import { useToast } from '@/components/cyberpunk/CyberToast';
import { showSuccess } from '@/lib/sweetalert';
import { useTranslation } from '@/hooks/useTranslation';

interface PPPoEProfile {
  id: string;
  name: string;
  price: number;
  downloadSpeed: number;
  uploadSpeed: number;
  description: string | null;
}

interface PaymentGateway {
  id: string;
  name: string;
  provider: string;
  isActive: boolean;
}

interface CustomerInfo {
  id: string;
  name: string;
  expiredAt: string | null;
  profile: PPPoEProfile | null;
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
  const { t } = useTranslation();

  const [currentPackage, setCurrentPackage] = useState<PPPoEProfile | null>(null);
  const [customer, setCustomer] = useState<CustomerInfo | null>(null);
  const [packages, setPackages] = useState<PPPoEProfile[]>([]);
  const [paymentGateways, setPaymentGateways] = useState<PaymentGateway[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<string>('');
  const [selectedGateway, setSelectedGateway] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const [error, setError] = useState('');

  // Proration states
  const [calculation, setCalculation] = useState<ProrationCalc | null>(null);
  const [loadingCalc, setLoadingCalc] = useState(false);

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
        setCurrentPackage(profileData.user.profile);
      } else {
        setError(profileData.error || 'Gagal memuat profil');
      }

      // 2. Fetch available packages
      const pkgRes = await fetch('/api/customer/packages', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const pkgData = await pkgRes.json();
      if (pkgRes.ok) {
        setPackages(pkgData.packages || []);
      }

      // 3. Fetch payment gateways
      const gwRes = await fetch('/api/customer/gateways', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const gwData = await gwRes.json();
      if (gwRes.ok) {
        setPaymentGateways(gwData.gateways || []);
        if (gwData.gateways && gwData.gateways.length > 0) {
          setSelectedGateway(gwData.gateways[0].provider);
        }
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
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingCalc(false);
    }
  };

  const handleUpgrade = async () => {
    if (!selectedPackage || !selectedGateway) {
      setError(t('customer.selectPackageAndPayment'));
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
          newProfileId: selectedPackage,
          gateway: selectedGateway
        })
      });
      const data = await res.json();

      if (data.success) {
        showSuccess(
          `${t('customer.invoiceNo')}: ${data.invoice.invoiceNumber} — ${t('customer.total')}: ${formatCurrency(data.invoice.amount)}`,
          'Pengajuan Berhasil'
        );

        if (data.paymentUrl) {
          window.location.href = data.paymentUrl;
        } else {
          router.push(`/pay/${data.invoice.paymentToken}`);
        }
      } else {
        setError(data.error || 'Gagal memproses permintaan');
      }
    } catch (error) {
      setError('Gagal menghubungi server');
    } finally {
      setUpgrading(false);
    }
  };

  const handleUpgradeManual = async () => {
    if (!selectedPackage) {
      setError(t('customer.selectPackage'));
      return;
    }

    setUpgrading(true);
    setError('');
    const token = localStorage.getItem('customer_token');

    try {
      const res = await fetch('/api/customer/upgrade-package', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ packageId: selectedPackage })
      });
      const data = await res.json();

      if (data.success) {
        showSuccess(
          `${t('customer.invoiceNo')}: ${data.invoice?.invoiceNumber} — ${t('customer.total')}: ${formatCurrency(data.invoice?.amount || 0)}. Silakan upload bukti bayar di halaman riwayat.`,
          'Invoice Berhasil Dibuat'
        );
        router.push('/customer/history');
      } else {
        setError(data.error || 'Gagal membuat invoice');
      }
    } catch (error) {
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
        <Loader2 className="w-8 h-8 animate-spin text-red-500" />
      </div>
    );
  }

  return (
    <div className="p-3 lg:p-6 space-y-5 w-full">
      {/* Page Header */}
      <div>
        <h1 className="text-lg font-bold text-white">Ganti Paket Layanan</h1>
        <p className="text-xs text-neutral-400 mt-0.5">Ubah paket internet Anda secara mandiri dengan perhitungan tarif prorata adil.</p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-950/40 border border-red-900 rounded-xl">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 items-start">
        {/* -- LEFT COLUMN: Current package info (2/5) -- */}
        <div className="lg:col-span-2 space-y-4">
          {/* Current Package Card */}
          {currentPackage && (
            <CyberCard className="bg-neutral-900/80 border-neutral-850 overflow-hidden relative">
              <div className="h-1.5 w-full bg-gradient-to-r from-red-600 to-red-800" />
              <div className="p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2.5 bg-red-950/50 rounded-xl border border-red-900 flex items-center justify-center">
                    <Package className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-400 uppercase tracking-wider block font-bold">Paket Saat Ini</span>
                    <h2 className="text-base font-bold text-white">{currentPackage.name}</h2>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 bg-neutral-950 p-4 rounded-xl border border-neutral-850">
                  <div>
                    <span className="text-[10px] text-neutral-400 uppercase tracking-wider block font-bold">Kecepatan</span>
                    <p className="text-sm font-bold text-white mt-0.5">{formatSpeed(currentPackage.downloadSpeed)}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-400 uppercase tracking-wider block font-bold">Harga Bulanan</span>
                    <p className="text-sm font-bold text-red-400 mt-0.5">{formatCurrency(currentPackage.price)}</p>
                  </div>
                </div>

                {customer?.expiredAt && (
                  <div className="mt-4 flex items-center gap-2 text-xs text-neutral-300">
                    <Calendar className="w-4 h-4 text-red-500" />
                    <span>Aktif s/d {new Date(customer.expiredAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  </div>
                )}
              </div>
            </CyberCard>
          )}

          {/* Guidelines / Help Card */}
          <CyberCard className="p-5 bg-neutral-900/80 border-neutral-850">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-red-500" /> Aturan Ganti Paket
            </h3>
            <ul className="text-xs text-neutral-400 space-y-2 list-disc pl-4">
              <li>Biaya dihitung secara <b>prorata (sisa hari aktif)</b> agar adil bagi pelanggan.</li>
              <li>Perpindahan paket baru akan langsung aktif setelah tagihan baru lunas dibayarkan.</li>
              <li>Tanggal jatuh tempo bulanan Anda berikutnya <b>tetap sama</b> seperti paket lama.</li>
              <li>Downgrade paket ke harga lebih rendah adalah gratis (Rp 0) di portal ini.</li>
            </ul>
          </CyberCard>
        </div>

        {/* -- RIGHT COLUMN: Package list & calculations (3/5) -- */}
        <div className="lg:col-span-3 space-y-4">
          <CyberCard className="bg-neutral-900/80 border-neutral-850">
            <div className="px-5 pt-5 pb-3 border-b border-neutral-850 flex items-center gap-3">
              <div className="p-2 bg-red-950/50 rounded-lg border border-red-900 flex items-center justify-center">
                <Tag className="w-4 h-4 text-red-500" />
              </div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">Pilih Paket Baru</h2>
            </div>

            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {packages
                .filter((pkg) => pkg.id !== currentPackage?.id) // Do not show current package
                .map((pkg) => {
                  const isSelected = selectedPackage === pkg.id;

                  return (
                    <button
                      key={pkg.id}
                      onClick={() => setSelectedPackage(pkg.id)}
                      className={`relative text-left p-4 rounded-xl border-2 transition-all duration-200 overflow-hidden ${
                        isSelected
                          ? 'border-red-500 bg-red-500/10 shadow-lg shadow-red-950/20'
                          : 'border-neutral-800 bg-neutral-950 hover:border-red-900 hover:bg-neutral-900'
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute top-2 right-2">
                          <CheckCircle className="w-5 h-5 text-red-500" />
                        </div>
                      )}
                      <div className="flex items-start justify-between mb-1 pr-6">
                        <h3 className="font-bold text-sm text-white leading-tight">{pkg.name}</h3>
                      </div>
                      <p className="text-xs text-neutral-400 mb-3">
                        {pkg.description || `${formatSpeed(pkg.downloadSpeed)} Unlimited`}
                      </p>
                      <p className="text-lg font-bold text-red-400">
                        {formatCurrency(pkg.price)}<span className="text-[10px] font-normal text-neutral-500">/bulan</span>
                      </p>
                    </button>
                  );
                })}
            </div>
          </CyberCard>

          {/* Calculation Breakdown Preview */}
          {selectedPackage && (
            <CyberCard className="p-5 bg-neutral-900/80 border-neutral-850 space-y-4">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider border-b border-neutral-850 pb-2">
                Simulasi Rincian Biaya Prorata
              </h3>

              {loadingCalc ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-6 h-6 animate-spin text-red-500 mr-2" />
                  <span className="text-xs text-neutral-400">Menghitung rincian biaya...</span>
                </div>
              ) : calculation ? (
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center text-xs text-neutral-400">
                    <span>Sisa Masa Aktif Paket Lama:</span>
                    <span className="font-bold text-white">{calculation.remainingDays} Hari</span>
                  </div>

                  {calculation.isProrated && (
                    <>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-neutral-400">Kredit Sisa Paket Lama (Potongan):</span>
                        <span className="font-semibold text-emerald-400">-{formatCurrency(calculation.oldUnusedValue)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-neutral-400">Nilai Prorata Paket Baru ({calculation.remainingDays} Hari):</span>
                        <span className="font-semibold text-white">{formatCurrency(calculation.newProratedCost)}</span>
                      </div>
                    </>
                  )}

                  <div className="flex justify-between items-center text-xs border-t border-neutral-850 pt-2">
                    <span className="text-neutral-400">Harga Dasar Penyesuaian:</span>
                    <span className="font-bold text-white">{formatCurrency(calculation.baseAmount)}</span>
                  </div>

                  {calculation.taxAmount > 0 && (
                    <div className="flex justify-between items-center text-xs text-neutral-400">
                      <span>PPN ({calculation.taxRate}%):</span>
                      <span className="font-semibold text-white">{formatCurrency(calculation.taxAmount)}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center font-bold text-white border-t border-red-900/30 pt-3 text-base">
                    <span>Total Tagihan Baru:</span>
                    <span className="text-red-400">{formatCurrency(calculation.totalAmount)}</span>
                  </div>
                </div>
              ) : null}
            </CyberCard>
          )}

          {/* Payment Gateways */}
          {selectedPackage && calculation && paymentGateways.length > 0 && (
            <CyberCard className="bg-neutral-900/80 border-neutral-850">
              <div className="px-5 pt-5 pb-3 border-b border-neutral-850 flex items-center gap-3">
                <div className="p-2 bg-red-950/50 rounded-lg border border-red-900 flex items-center justify-center">
                  <CreditCard className="w-4 h-4 text-red-500" />
                </div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">Pilih Metode Pembayaran</h2>
              </div>

              <div className="p-4 space-y-2">
                {paymentGateways.map((gateway) => (
                  <button
                    key={gateway.id}
                    onClick={() => setSelectedGateway(gateway.provider)}
                    className={`w-full text-left p-3.5 rounded-xl border-2 transition-all ${
                      selectedGateway === gateway.provider
                        ? 'border-red-500 bg-red-500/10'
                        : 'border-neutral-800 bg-neutral-950 hover:border-red-900'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-neutral-900 border border-neutral-850 rounded-lg flex items-center justify-center">
                          <CreditCard className="w-4 h-4 text-red-500" />
                        </div>
                        <div>
                          <p className="font-bold text-sm text-white">{gateway.name}</p>
                          <p className="text-[10px] text-neutral-400 capitalize">{gateway.provider}</p>
                        </div>
                      </div>
                      {selectedGateway === gateway.provider && (
                        <CheckCircle className="w-5 h-5 text-red-500" />
                      )}
                    </div>
                  </button>
                ))}

                {selectedGateway && (
                  <>
                    <CyberButton
                      onClick={handleUpgrade}
                      disabled={upgrading}
                      className="w-full mt-3 bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-lg shadow-red-900/20"
                      variant="cyan"
                      size="lg"
                    >
                      {upgrading ? (
                        <><Loader2 className="w-5 h-5 animate-spin mr-2" />Memproses...</>
                      ) : (
                        <><CreditCard className="w-5 h-5 mr-2" />Bayar & Ajukan Sekarang</>
                      )}
                    </CyberButton>
                    <p className="text-[10px] text-neutral-400 text-center mt-2">Anda akan dialihkan ke gerbang pembayaran aman untuk menyelesaikan transaksi.</p>
                  </>
                )}
              </div>
            </CyberCard>
          )}

          {/* Fallback no gateways */}
          {selectedPackage && paymentGateways.length === 0 && (
            <CyberCard className="p-5 bg-neutral-900/80 border-neutral-850">
              <div className="flex items-start gap-3 mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-yellow-400">Metode pembayaran online tidak tersedia. Hubungi admin atau klik tombol di bawah untuk membuat invoice tagihan manual.</p>
              </div>
              <CyberButton
                onClick={handleUpgradeManual}
                disabled={upgrading}
                className="w-full bg-red-600 hover:bg-red-700 text-white rounded-xl"
                variant="cyan"
                size="lg"
              >
                {upgrading ? (
                  <><Loader2 className="w-5 h-5 animate-spin mr-2" />Memproses...</>
                ) : (
                  <><Package className="w-5 h-5 mr-2" />Buat Invoice Manual</>
                )}
              </CyberButton>
            </CyberCard>
          )}
        </div>
      </div>
    </div>
  );
}
