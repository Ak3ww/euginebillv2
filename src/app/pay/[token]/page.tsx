'use client';

import { formatWIB } from '@/lib/timezone';
import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  CheckCircle, Clock, AlertCircle, CreditCard, Building2, 
  Loader2, User, Phone, Package, Calendar, MapPin, 
  Mail, Hash, Zap, ChevronRight, Lock, CheckCircle2, ShieldCheck, FileText, Image as ImageIcon, X, QrCode
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { BankInstructions } from './BankInstructions';
import '@/app/customer/customer.css';

interface Invoice {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerPhone: string;
  amount: number;
  status: string;
  dueDate: string;
  createdAt: string;
  paidAt: string | null;
  user: {
    name: string;
    phone: string;
    email: string | null;
    username: string;
    address: string | null;
    customerId: string | null;
    subscriptionType: string;
    status: string;
    profile: { name: string; price: number; downloadSpeed: number; uploadSpeed: number; } | null;
    area: { name: string; } | null;
    router: { shortname: string; } | null;
  } | null;
}

interface PaymentGateway { id: string; name: string; provider: string; isActive: boolean; }
interface CompanySetting { name: string; address: string | null; phone: string | null; email: string | null; bankAccounts?: any; }

export default function PaymentPage() {
  const params = useParams();
  const token = params.token as string;
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [paymentGateways, setPaymentGateways] = useState<PaymentGateway[]>([]);
  const [company, setCompany] = useState<CompanySetting | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [duitkuMethods, setDuitkuMethods] = useState<{ code: string; name: string; group: string }[]>([]);
  const [loadingDuitkuMethods, setLoadingDuitkuMethods] = useState(false);
  const [qrinMethods, setQrinMethods] = useState<{ code: string; name: string; group: string; logo?: string }[]>([]);
  const [loadingQrinMethods, setLoadingQrinMethods] = useState(false);
  
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualForm, setManualForm] = useState({ bankName: '', accountNumber: '', accountName: '', destinationBank: '', notes: '', receiptImage: null as File | null });
  const [uploading, setUploading] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualSuccess, setManualSuccess] = useState(false);
  const [qrString, setQrString] = useState<string | null>(null);
  const [vaNumber, setVaNumber] = useState<string | null>(null);
  const [vaBank, setVaBank] = useState<string | null>(null);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  useEffect(() => { loadInvoice(); }, [token]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const orderIdParam = params.get('merchantOrderId') || params.get('orderId');
      if (orderIdParam) {
        setCurrentOrderId(orderIdParam);
        checkOrderPaidStatus(orderIdParam);
      }
    }
  }, []);

  const redirectTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (invoice?.status === 'PAID') {
      redirectTimerRef.current = setTimeout(() => {
        router.push(`/invoice/${invoice.id}/print`);
      }, 3000);
    }
    return () => {
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    };
  }, [invoice?.status, router, invoice?.id]);

  const checkOrderPaidStatus = async (orderId: string) => {
    try {
      const res = await fetch(`/api/payment/check-order?orderId=${orderId}`);
      const data = await res.json();
      if (res.ok && data.status === 'settlement') {
        window.location.reload();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCheckPaymentStatus = async () => {
    if (!currentOrderId) {
      window.location.reload();
      return;
    }
    setCheckingStatus(true);
    try {
      const res = await fetch(`/api/payment/check-order?orderId=${currentOrderId}`);
      const data = await res.json();
      if (res.ok && data.status === 'settlement') {
        window.location.reload();
      } else {
        setStatusError('Pembayaran belum terdeteksi. Harap selesaikan pembayaran di aplikasi Anda terlebih dahulu, kemudian coba kembali.');
      }
    } catch {
      window.location.reload();
    } finally {
      setCheckingStatus(false);
    }
  };

  const loadInvoice = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/invoices/by-token/${token}`);
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Gagal memuat tagihan'); return; }
      setInvoice(data.invoice);
      setPaymentGateways(data.paymentGateways || []);
      setCompany(data.company || null);
      if ((data.paymentGateways || []).some((g: PaymentGateway) => g.provider === 'duitku')) {
        fetchDuitkuMethods(data.invoice?.amount || 10000);
      }
      if ((data.paymentGateways || []).some((g: PaymentGateway) => g.provider === 'qrin')) {
        fetchQrinMethods();
      }
    } catch (err) { setError('Koneksi terputus saat memuat tagihan'); } finally { setLoading(false); }
  };

  const fetchDuitkuMethods = async (amount: number) => {
    setLoadingDuitkuMethods(true);
    try {
      const res = await fetch(`/api/payment/duitku-methods?amount=${amount}`);
      const data = await res.json();
      setDuitkuMethods(data.methods || []);
    } catch {
      // Use empty
    } finally {
      setLoadingDuitkuMethods(false);
    }
  };

  const fetchQrinMethods = async () => {
    setLoadingQrinMethods(true);
    try {
      const res = await fetch(`/api/payment/qrin-methods`);
      const data = await res.json();
      setQrinMethods(data.methods || []);
    } catch {
      // Use empty
    } finally {
      setLoadingQrinMethods(false);
    }
  };

  const formatCurrency = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
  const formatDate = (dateStr: string) => formatWIB(dateStr, 'd MMM yyyy');

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      PAID: 'badge-success',
      PENDING: 'badge-error',
      OVERDUE: 'badge-warning'
    };
    const icons: Record<string, React.ReactNode> = { PAID: <CheckCircle className="w-3.5 h-3.5" />, PENDING: <Clock className="w-3.5 h-3.5" />, OVERDUE: <AlertCircle className="w-3.5 h-3.5" /> };
    return (
      <span className={`hallmark-badge ${styles[status] || 'bg-[var(--color-paper-2)] text-[var(--color-ink-2)]'}`}>
        {icons[status]} {status === 'PAID' ? 'Lunas' : status === 'PENDING' ? 'Belum Bayar' : 'Terlambat'}
      </span>
    );
  };

  const handlePayment = async (gateway: string, paymentMethod?: string) => {
    if (!invoice) return;
    setProcessing(true);
    setError(null);
    try {
      const body: any = { invoiceId: invoice.id, gateway };
      if (paymentMethod) body.paymentMethod = paymentMethod;
      const res = await fetch('/api/payment/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Transaksi gagal diproses'); return; }
      if (data.orderId) {
        setCurrentOrderId(data.orderId);
      }
      if (data.vaNumber) {
        setVaNumber(data.vaNumber);
        setVaBank(data.vaBank || 'Virtual Account');
      } else if (data.qrString) {
        setQrString(data.qrString);
      } else if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else {
        setError('Link pembayaran tidak tersedia');
      }
    } catch { setError('Gagal terhubung ke gateway pembayaran'); } finally { setProcessing(false); }
  };

  const handleManualSubmit = async () => {
    setManualError(null);
    if (!manualForm.bankName || !manualForm.accountName || !manualForm.receiptImage) {
      setManualError('Mohon lengkapi bank pengirim, nama pengirim, dan bukti transfer.');
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('bankName', manualForm.bankName);
      formData.append('accountNumber', manualForm.accountNumber);
      formData.append('accountName', manualForm.accountName);
      formData.append('destinationBank', manualForm.destinationBank);
      formData.append('notes', manualForm.notes);
      formData.append('receiptImage', manualForm.receiptImage);

      const res = await fetch(`/api/pay/${token}/manual`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengirim bukti transfer');
      
      setManualSuccess(true);
      setTimeout(() => {
        router.push('/customer/invoices');
      }, 3000);
    } catch (err: any) {
      setManualError(err.message || 'Gagal upload bukti transfer');
    } finally {
      setUploading(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[var(--color-paper)] flex flex-col items-center justify-center">
      <div className="w-16 h-16 relative flex items-center justify-center">
        <div className="absolute inset-0 rounded-full border-4 border-[var(--color-paper-3)]"></div>
        <div className="absolute inset-0 rounded-full border-4 border-[var(--color-accent)] border-t-transparent animate-spin"></div>
        <ShieldCheck className="w-6 h-6 text-[var(--color-accent)] absolute" />
      </div>
      <p className="mt-4 font-medium text-[var(--color-muted)]">Mempersiapkan Portal Pembayaran Aman...</p>
    </div>
  );

  if (error || !invoice) return (
    <div className="min-h-screen bg-[var(--color-paper)] flex items-center justify-center p-4">
      <div className="hallmark-card-elevated max-w-sm w-full text-center">
        <div className="w-20 h-20 bg-[var(--color-error-bg)] text-[var(--color-error)] rounded-full flex items-center justify-center mx-auto mb-5 border border-[var(--color-error)]">
          <AlertCircle className="w-10 h-10" />
        </div>
        <h2 className="text-xl font-bold mb-2">Tagihan Tidak Ditemukan</h2>
        <p className="text-sm text-[var(--color-muted)] leading-relaxed">{error || 'Link pembayaran tidak valid atau sudah kadaluarsa.'}</p>
        <div className="mt-6 flex flex-col gap-3">
          <button onClick={() => window.location.reload()} className="hallmark-button w-full">Muat Ulang</button>
          <a href="/" className="hallmark-button-secondary w-full rounded-full py-2 flex items-center justify-center font-medium text-sm">Kembali ke Beranda</a>
        </div>
      </div>
    </div>
  );

  if (invoice.status === 'PAID') return (
    <div className="min-h-screen bg-[var(--color-paper)] flex items-center justify-center p-4">
      <div className="hallmark-card-elevated max-w-sm w-full text-center animate-in zoom-in-95 duration-500">
        <div className="w-20 h-20 bg-[var(--color-success-bg)] rounded-full flex items-center justify-center mx-auto mb-5 border border-[var(--color-success)]">
          <CheckCircle2 className="w-10 h-10 text-[var(--color-success)]" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Pembayaran Berhasil</h2>
        <p className="text-sm text-[var(--color-muted)] mb-8">Terima kasih, tagihan Anda telah lunas.</p>
        
        <div className="bg-[var(--color-paper-3)] rounded-[var(--radius-lg)] p-5 text-left space-y-4 border border-[var(--color-rule)] mb-8">
          <div className="flex justify-between items-center text-sm border-b border-[var(--color-rule)] pb-3">
            <span className="text-[var(--color-muted)]">No. Tagihan</span>
            <span className="font-bold flex items-center gap-1.5"><FileText className="w-3.5 h-3.5 text-[var(--color-accent)]"/>{invoice.invoiceNumber}</span>
          </div>
          <div className="flex justify-between items-center text-sm border-b border-[var(--color-rule)] pb-3">
            <span className="text-[var(--color-muted)]">Total Dibayar</span>
            <span className="font-bold text-lg">{formatCurrency(invoice.amount)}</span>
          </div>
          {invoice.paidAt && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-[var(--color-muted)]">Waktu Bayar</span>
              <span className="font-semibold text-xs">{formatDate(invoice.paidAt)}</span>
            </div>
          )}
        </div>
        
        <div className="flex flex-col gap-3">
          <button 
            onClick={() => router.push(`/invoice/${invoice.id}/print`)}
            className="hallmark-button w-full flex items-center justify-center gap-2"
          >
            <FileText className="w-4 h-4" />
            Lihat / Cetak Bukti Pembayaran
          </button>
          <p className="text-xs text-[var(--color-muted)] mt-2">Anda akan dialihkan otomatis dalam 3 detik...</p>
        </div>
      </div>
    </div>
  );

  return (
    <main className="hallmark-container py-8 flex flex-col gap-[var(--space-lg)] min-h-screen pb-24">
      
      {/* Secure Header */}
      <div className="flex flex-col items-center text-center mb-2">
        <div className="inline-flex items-center justify-center gap-2 px-4 py-1.5 rounded-full bg-[var(--color-paper-2)] text-[var(--color-muted)] text-xs font-medium border border-[var(--color-rule)] mb-4">
          <Lock className="w-3.5 h-3.5 text-[var(--color-accent)]" /> Portal Pembayaran Aman SSL
        </div>
        <h1 className="text-3xl font-display font-medium tracking-tight">Checkout</h1>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="bg-[var(--color-error-bg)] border border-[var(--color-error)] text-[var(--color-error)] p-4 rounded-[var(--radius-md)] flex items-start gap-3 animate-in fade-in shadow-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {/* Primary Invoice Card */}
      <div className="hallmark-card-elevated overflow-hidden flex flex-col p-0">
        <div className="bg-[var(--color-paper-3)] px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hairline-bottom">
          <div>
            <p className="text-[var(--color-muted)] text-xs font-medium uppercase tracking-wider mb-1">Total Tagihan</p>
            <p className="text-3xl font-bold">{formatCurrency(invoice.amount)}</p>
          </div>
          <div className="flex items-center justify-between sm:flex-col sm:items-end gap-2">
            {getStatusBadge(invoice.status)}
            <span className="text-[var(--color-muted)] text-xs font-mono">{invoice.invoiceNumber}</span>
          </div>
        </div>
        
        <div className="p-6 sm:p-8 space-y-6">
          {/* Customer Information */}
          <div>
            <h3 className="text-xs font-bold text-[var(--color-muted)] uppercase tracking-wider mb-4 border-b border-[var(--color-rule)] pb-2">Informasi Pelanggan</h3>
            <div className="grid gap-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-[var(--color-paper-3)] border border-[var(--color-rule)] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <User className="w-4 h-4 text-[var(--color-accent)]" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-[var(--color-ink)]">{invoice.user?.name || invoice.customerName}</p>
                  <div className="text-xs text-[var(--color-muted)] mt-0.5 flex flex-wrap gap-x-4 gap-y-1">
                    {invoice.user?.customerId && <span className="flex items-center gap-1"><Hash className="w-3 h-3 text-[var(--color-accent)]"/> {invoice.user.customerId}</span>}
                    <span className="flex items-center gap-1"><Phone className="w-3 h-3 text-[var(--color-accent)]"/> {invoice.user?.phone || invoice.customerPhone}</span>
                    {invoice.user?.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3 text-[var(--color-accent)]"/> {invoice.user.email}</span>}
                  </div>
                </div>
              </div>

              {invoice.user?.address && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-[var(--color-paper-3)] flex items-center justify-center flex-shrink-0 mt-0.5 border border-[var(--color-rule)]">
                    <MapPin className="w-4 h-4 text-[var(--color-muted)]" />
                  </div>
                  <p className="text-sm text-[var(--color-muted)] leading-relaxed pt-1.5">{invoice.user.address}</p>
                </div>
              )}
              
              {invoice.user?.profile && (
                <div className="flex items-start gap-3 bg-[var(--color-paper-2)] p-3 rounded-xl border border-[var(--color-rule)] mt-2 shadow-sm">
                  <div className="w-8 h-8 rounded-lg bg-[var(--color-paper-3)] flex items-center justify-center flex-shrink-0">
                    <Package className="w-4 h-4 text-[var(--color-muted)]" />
                  </div>
                  <div className="flex-1 pt-0.5">
                    <p className="text-sm font-bold text-[var(--color-ink)]">{invoice.user.profile.name}</p>
                    {(invoice.user.profile.downloadSpeed > 0) && (
                      <p className="text-xs text-[var(--color-muted)] flex items-center gap-1 mt-1"><Zap className="w-3 h-3 text-[var(--color-accent)]" /> {invoice.user.profile.downloadSpeed} Mbps</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Dates Grid */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[var(--color-rule)]">
            <div>
              <p className="text-[11px] font-bold text-[var(--color-muted)] uppercase tracking-wider mb-1 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-[var(--color-muted)]" /> Tanggal Terbit</p>
              <p className="text-sm font-bold text-[var(--color-ink)] pl-5">{formatDate(invoice.createdAt)}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold text-[var(--color-error)] uppercase tracking-wider mb-1 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-[var(--color-error)]" /> Jatuh Tempo</p>
              <p className="text-sm font-bold text-[var(--color-error)] pl-5">{formatDate(invoice.dueDate)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Methods Section */}
      <div className="hallmark-card-elevated overflow-hidden flex flex-col p-0">
        <div className="px-6 sm:px-8 py-5 hairline-bottom bg-[var(--color-paper-3)] flex items-center gap-3">
          <div className="w-8 h-8 bg-[var(--color-paper)] text-[var(--color-accent)] rounded-[var(--radius-md)] flex items-center justify-center border border-[var(--color-rule)] shadow-sm">
            <CreditCard className="w-4 h-4" />
          </div>
          <h2 className="text-lg font-bold">Pilih Metode Pembayaran</h2>
        </div>
        
        <div className="p-6 sm:p-8 space-y-4">
          
          {/* Manual Transfer Option */}
          <div className="border border-[var(--color-rule)] rounded-[var(--radius-lg)] overflow-hidden bg-[var(--color-paper-2)] shadow-sm">
            <button
              onClick={() => setShowManualForm(!showManualForm)}
              className={`w-full flex items-center justify-between p-4 hover:bg-[var(--color-paper-3)] transition-colors ${showManualForm ? 'hairline-bottom bg-[var(--color-paper-3)]' : 'bg-[var(--color-paper-2)]'}`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-[var(--radius-md)] flex items-center justify-center transition-colors ${showManualForm ? 'bg-[var(--color-accent)] text-[var(--color-accent-ink)] shadow-md' : 'bg-[var(--color-paper)] text-[var(--color-ink-2)] border border-[var(--color-rule)]'}`}>
                  <Building2 className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold text-[var(--color-ink)]">Transfer Manual Bank</p>
                  <p className="text-xs text-[var(--color-muted)] mt-0.5">Upload bukti transfer</p>
                </div>
              </div>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform duration-300 ${showManualForm ? 'bg-[var(--color-paper-3)] text-[var(--color-accent)] rotate-90 border border-[var(--color-rule)]' : 'bg-[var(--color-paper)] text-[var(--color-muted)] border border-[var(--color-rule)]'}`}>
                <ChevronRight className="w-4 h-4" />
              </div>
            </button>

            {/* Manual Form Body */}
            {showManualForm && (
              <div className="p-5 sm:p-6 bg-[var(--color-paper)] animate-in slide-in-from-top-2 duration-300">
                {manualSuccess ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-[var(--color-success-bg)] border border-[var(--color-success)] text-[var(--color-success)] rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-bold text-[var(--color-ink)] mb-2">Bukti Terkirim!</h3>
                    <p className="text-sm text-[var(--color-muted)]">Bukti transfer Anda telah berhasil diunggah dan sedang menunggu konfirmasi Admin.</p>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {/* Bank Accounts */}
                    <div>
                      <h4 className="text-xs font-bold text-[var(--color-muted)] uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-[var(--color-accent)]" /> Tujuan Transfer
                      </h4>
                      {company?.bankAccounts && Array.isArray(company.bankAccounts) && company.bankAccounts.length > 0 ? (
                        <div className="grid gap-3">
                          {company.bankAccounts.map((acc: any, i: number) => (
                            <div key={i} className="bg-[var(--color-paper-2)] p-4 rounded-xl border border-[var(--color-rule)] flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:border-[var(--color-accent)]/50 transition-colors shadow-sm">
                              <div>
                                <p className="text-xs font-bold text-[var(--color-accent)] mb-1 uppercase tracking-wider">{acc.bankName}</p>
                                <p className="text-xl font-mono font-bold text-[var(--color-ink)] tracking-tight">{acc.accountNumber}</p>
                                <p className="text-xs text-[var(--color-muted)] mt-1 font-medium">a/n {acc.accountName}</p>
                              </div>
                              <button onClick={() => {
                                navigator.clipboard.writeText(acc.accountNumber);
                              }} className="text-xs font-bold text-[var(--color-ink)] bg-[var(--color-paper-3)] px-4 py-2 rounded-lg border border-[var(--color-rule)] hover:bg-[var(--color-paper-2)]-higher hover:text-[var(--color-accent)] transition-all shadow-sm">
                                Salin Rekening
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="bg-[var(--color-error-bg)] text-[var(--color-error)] p-4 rounded-xl text-sm border border-[var(--color-error)] flex items-center gap-2">
                          <AlertCircle className="w-4 h-4" /> Belum ada rekening tujuan yang disetting admin.
                        </div>
                      )}
                    </div>

                    {/* Upload Form */}
                    <div>
                      <h4 className="text-xs font-bold text-[var(--color-muted)] uppercase tracking-wider mb-4 border-t border-[var(--color-rule)] pt-6 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-[var(--color-accent)]" /> Konfirmasi Pembayaran
                      </h4>
                      
                      {manualError && (
                        <div className="mb-4 bg-[var(--color-error-bg)] border border-[var(--color-error)] text-[var(--color-error)] p-3 rounded-xl text-sm flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> {manualError}
                        </div>
                      )}

                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="sm:col-span-2">
                            <label className="text-xs font-bold text-[var(--color-ink)] block mb-1.5">Transfer Ke Mana?</label>
                            <select className="w-full bg-[var(--color-paper-2)] border border-[var(--color-rule)] rounded-xl px-4 py-2.5 text-sm font-medium text-[var(--color-ink)] focus:bg-[var(--color-paper-3)] focus:border-[var(--color-accent)] outline-none transition-all appearance-none" value={manualForm.destinationBank} onChange={e => setManualForm({...manualForm, destinationBank: e.target.value})}>
                              <option value="" disabled>-- Pilih Rekening Tujuan --</option>
                              {company?.bankAccounts && Array.isArray(company.bankAccounts) && company.bankAccounts.map((acc: any, i: number) => (
                                <option key={i} value={acc.bankName}>{acc.bankName} - {acc.accountNumber} (a/n {acc.accountName})</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-xs font-bold text-[var(--color-ink)] block mb-1.5">Bank Pengirim</label>
                            <input type="text" className="w-full bg-[var(--color-paper-2)] border border-[var(--color-rule)] rounded-xl px-4 py-2.5 text-sm font-medium text-[var(--color-ink)] focus:bg-[var(--color-paper-3)] focus:border-[var(--color-accent)] outline-none transition-all placeholder:text-[var(--color-muted)]" placeholder="Contoh: BCA / DANA" value={manualForm.bankName} onChange={e => setManualForm({...manualForm, bankName: e.target.value})} />
                          </div>
                          <div>
                            <label className="text-xs font-bold text-[var(--color-ink)] block mb-1.5">Atas Nama Pengirim</label>
                            <input type="text" className="w-full bg-[var(--color-paper-2)] border border-[var(--color-rule)] rounded-xl px-4 py-2.5 text-sm font-medium text-[var(--color-ink)] focus:bg-[var(--color-paper-3)] focus:border-[var(--color-accent)] outline-none transition-all placeholder:text-[var(--color-muted)]" placeholder="Nama pemilik rekening" value={manualForm.accountName} onChange={e => setManualForm({...manualForm, accountName: e.target.value})} />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs font-bold text-[var(--color-ink)] block mb-1.5">No. Rekening (Opsional)</label>
                            <input type="text" className="w-full bg-[var(--color-paper-2)] border border-[var(--color-rule)] rounded-xl px-4 py-2.5 text-sm font-medium text-[var(--color-ink)] focus:bg-[var(--color-paper-3)] focus:border-[var(--color-accent)] outline-none transition-all placeholder:text-[var(--color-muted)]" placeholder="12345678" value={manualForm.accountNumber} onChange={e => setManualForm({...manualForm, accountNumber: e.target.value})} />
                          </div>
                          <div>
                            <label className="text-xs font-bold text-[var(--color-ink)] block mb-1.5">Catatan (Opsional)</label>
                            <input type="text" className="w-full bg-[var(--color-paper-2)] border border-[var(--color-rule)] rounded-xl px-4 py-2.5 text-sm font-medium text-[var(--color-ink)] focus:bg-[var(--color-paper-3)] focus:border-[var(--color-accent)] outline-none transition-all placeholder:text-[var(--color-muted)]" placeholder="Cth: Tagihan bln ini" value={manualForm.notes} onChange={e => setManualForm({...manualForm, notes: e.target.value})} />
                          </div>
                        </div>
                        
                        <div>
                          <label className="text-xs font-bold text-[var(--color-ink)] block mb-1.5">Bukti Transfer (Gambar)</label>
                          <div className="relative">
                            <input type="file" accept="image/*" className="w-full bg-[var(--color-paper-2)] border border-[var(--color-rule)] rounded-xl px-4 py-2.5 text-sm font-medium text-[var(--color-ink)] focus:bg-[var(--color-paper-3)] focus:border-[var(--color-accent)] outline-none transition-all file:mr-4 file:py-1.5 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[var(--color-paper-3)] file:text-[var(--color-accent)] hover:file:bg-[var(--color-paper-2)]-higher cursor-pointer" onChange={e => setManualForm({...manualForm, receiptImage: e.target.files?.[0] || null})} />
                          </div>
                        </div>
                        
                        <button onClick={handleManualSubmit} disabled={uploading} className="w-full bg-[var(--color-accent)] text-[var(--color-accent-ink)] hover:opacity-90 rounded-xl py-3.5 text-sm font-bold transition-opacity disabled:opacity-50 mt-4 flex justify-center items-center shadow-md">
                          {uploading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <ImageIcon className="w-5 h-5 mr-2" />}
                          {uploading ? 'Mengunggah...' : 'Kirim Bukti Transfer'}
                        </button>

                        {/* WhatsApp Alternative */}
                        {company?.phone && (
                          <div className="pt-6 mt-6 border-t border-[var(--color-rule)] text-center">
                            <p className="text-xs text-[var(--color-muted)] mb-3 font-medium">Bermasalah saat upload? Konfirmasi via WhatsApp:</p>
                            <a href={`https://wa.me/${company.phone.replace(/[^0-9]/g, '')}?text=Halo, saya ingin konfirmasi pembayaran untuk tagihan ${invoice.invoiceNumber}.`} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 w-full bg-[#25D366] hover:bg-[#20b958] text-white rounded-xl py-3.5 text-sm font-bold shadow-md transition-all">
                              <Phone className="w-4 h-4" /> Hubungi Admin
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Auto Payment Gateways */}
          {paymentGateways.length > 0 && (
            <details className="group bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-xl overflow-hidden shadow-sm" open>
              <summary className="flex items-center justify-between p-4 cursor-pointer list-none outline-none select-none hover:bg-[var(--color-paper-2)] transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[var(--color-paper-2)] text-[var(--color-accent)] rounded-xl flex items-center justify-center border border-[var(--color-rule)]">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-[var(--color-ink)]">Pembayaran Otomatis</p>
                    <p className="text-[11px] text-[var(--color-muted)]">QRIS, Virtual Account, & Gerai Ritel</p>
                  </div>
                </div>
                <span className="transition-transform duration-300 group-open:rotate-180 text-[var(--color-muted)]">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </span>
              </summary>
              
              <div className="p-4 pt-0 border-t border-[var(--color-rule)] bg-[var(--color-paper)]">
                <div className="mt-4">
                  {paymentGateways.map((gateway) => {
                    if (gateway.provider === 'duitku') {
                      if (loadingDuitkuMethods) return (
                        <div key={gateway.id} className="flex items-center justify-center py-6 bg-[var(--color-paper-2)] border border-[var(--color-rule)] rounded-xl mb-4">
                          <Loader2 className="w-5 h-5 animate-spin text-[var(--color-accent)] mr-2" />
                          <span className="text-sm font-medium text-[var(--color-muted)]">Memuat kanal pembayaran...</span>
                        </div>
                      );
                      if (duitkuMethods.length > 0) return (
                        <div key={gateway.id} className="grid grid-cols-2 gap-3 mb-4">
                          {duitkuMethods.map((method) => (
                            <button
                              key={method.code}
                              onClick={() => handlePayment(gateway.provider, method.code)}
                              disabled={processing}
                              className="w-full flex flex-col items-center text-center p-3 bg-[var(--color-paper-2)] border border-[var(--color-rule)] rounded-xl hover:border-[var(--color-accent)]/50 hover:shadow-md transition-all group disabled:opacity-50"
                            >
                              <div className="w-10 h-10 bg-[var(--color-paper-3)] rounded-lg flex items-center justify-center text-[var(--color-muted)] group-hover:bg-primary/10 group-hover:text-[var(--color-accent)] transition-colors border border-[var(--color-rule)] group-hover:border-[var(--color-accent)]/30 mb-2">
                                <CreditCard className="w-5 h-5" />
                              </div>
                              <span className="text-xs font-bold text-[var(--color-ink)] line-clamp-2 leading-tight">{method.name}</span>
                            </button>
                          ))}
                        </div>
                      );
                    }
                    
                    if (gateway.provider === 'qrin') {
                      if (loadingQrinMethods) return (
                        <div key={gateway.id} className="flex items-center justify-center py-6 bg-[var(--color-paper-2)] border border-[var(--color-rule)] rounded-xl mb-4">
                          <Loader2 className="w-5 h-5 animate-spin text-[var(--color-accent)] mr-2" />
                          <span className="text-sm font-medium text-[var(--color-muted)]">Memuat kanal pembayaran...</span>
                        </div>
                      );
                      if (qrinMethods.length > 0) {
                         return (
                          <div key={gateway.id} className="grid grid-cols-2 gap-3 mb-4">
                            {qrinMethods.map((method) => (
                              <button
                                key={method.code}
                                onClick={() => handlePayment(gateway.provider, method.code)}
                                disabled={processing}
                                className="w-full flex flex-col items-center text-center p-3 bg-[var(--color-paper-2)] border border-[var(--color-rule)] rounded-xl hover:border-[var(--color-accent)]/50 hover:shadow-md transition-all group disabled:opacity-50"
                              >
                                <div className="w-10 h-10 bg-[var(--color-paper-3)] rounded-lg flex items-center justify-center text-[var(--color-muted)] group-hover:bg-primary/10 group-hover:text-[var(--color-accent)] transition-colors border border-[var(--color-rule)] group-hover:border-[var(--color-accent)]/30 p-1.5 overflow-hidden mb-2">
                                  {method.logo ? <img src={method.logo} alt={method.name} className="max-w-full max-h-full object-contain filter invert dark:invert-0" /> : <CreditCard className="w-4 h-4" />}
                                </div>
                                <span className="text-xs font-bold text-[var(--color-ink)] line-clamp-2 leading-tight">{method.name}</span>
                              </button>
                            ))}
                          </div>
                        );
                      }
                      // Fallback
                      return (
                        <button
                          key={gateway.id}
                          onClick={() => handlePayment(gateway.provider, 'qris')}
                          disabled={processing}
                          className="w-full flex flex-col items-center text-center p-3 bg-[var(--color-paper-2)] border border-[var(--color-rule)] rounded-xl hover:border-[var(--color-accent)]/50 transition-all group disabled:opacity-50 mb-4 text-[var(--color-ink)]"
                        >
                          <div className="w-10 h-10 bg-[var(--color-paper-3)] rounded-lg flex items-center justify-center text-[var(--color-muted)] group-hover:bg-primary/10 group-hover:text-[var(--color-accent)] mb-2 border border-[var(--color-rule)] group-hover:border-[var(--color-accent)]/30">
                            <CreditCard className="w-5 h-5" />
                          </div>
                          <span className="text-xs font-bold text-[var(--color-ink)]">QRIS / VA (QRIN)</span>
                        </button>
                      );
                    }
                    
                    // Default generic gateway button
                    return (
                      <button
                        key={gateway.id}
                        onClick={() => handlePayment(gateway.provider)}
                        disabled={processing}
                        className="w-full flex flex-col items-center text-center p-3 bg-[var(--color-paper-2)] border border-[var(--color-rule)] rounded-xl hover:border-[var(--color-accent)]/50 transition-all group disabled:opacity-50 mb-4 text-[var(--color-ink)]"
                      >
                        <div className="w-10 h-10 bg-[var(--color-paper-3)] rounded-lg flex items-center justify-center text-[var(--color-muted)] group-hover:bg-primary/10 group-hover:text-[var(--color-accent)] mb-2 border border-[var(--color-rule)] group-hover:border-[var(--color-accent)]/30">
                          <CreditCard className="w-5 h-5" />
                        </div>
                        <span className="text-xs font-bold text-[var(--color-ink)]">{gateway.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </details>
          )}

          {paymentGateways.length === 0 && (
            <div className="text-center py-8 bg-[var(--color-paper-2)] rounded-xl border border-[var(--color-rule)]">
              <p className="text-sm font-medium text-[var(--color-muted)]">Silakan gunakan fitur transfer manual di atas.</p>
            </div>
          )}
        </div>
      </div>

      {/* QR Code Modal */}
      {qrString && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-2xl max-w-sm w-full p-6 text-center shadow-2xl relative animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setQrString(null)}
              className="absolute top-4 right-4 text-[var(--color-muted)] hover:text-[var(--color-ink)] bg-[var(--color-paper-2)] hover:bg-[var(--color-paper-3)] rounded-full p-2 transition-colors border border-[var(--color-rule)]"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="w-16 h-16 bg-[var(--color-paper-3)] border border-[var(--color-rule)] text-[var(--color-accent)] rounded-full flex items-center justify-center mx-auto mb-4 mt-2">
              <QrCode className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-[var(--color-ink)] mb-2">Scan QRIS</h3>
            <p className="text-sm text-[var(--color-muted)] mb-6">Silakan gunakan aplikasi M-Banking atau E-Wallet Anda untuk memindai kode QRIS ini.</p>
            <div className="bg-white p-4 rounded-xl inline-block border-2 border-[var(--color-rule)] shadow-sm mb-6 relative group">
              <QRCodeSVG id="qris-svg" value={qrString} size={200} level="H" includeMargin={false} />
            </div>
            <div className="flex gap-3 mb-6">
              <button 
                onClick={() => {
                  const svg = document.getElementById('qris-svg');
                  if (!svg) return;
                  const svgData = new XMLSerializer().serializeToString(svg);
                  const canvas = document.createElement('canvas');
                  const ctx = canvas.getContext('2d');
                  const img = new Image();
                  img.onload = () => {
                    canvas.width = img.width + 40;
                    canvas.height = img.height + 40;
                    if (ctx) {
                      ctx.fillStyle = 'white';
                      ctx.fillRect(0, 0, canvas.width, canvas.height);
                      ctx.drawImage(img, 20, 20);
                    }
                    const a = document.createElement('a');
                    a.download = `QRIS-${invoice.invoiceNumber}.png`;
                    a.href = canvas.toDataURL('image/png');
                    a.click();
                  };
                  img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
                }}
                className="flex-1 bg-[var(--color-paper-3)] hover:bg-[var(--color-paper-2)]-higher text-[var(--color-ink)] font-bold py-3 px-4 rounded-xl transition-all text-sm flex items-center justify-center gap-2 border border-[var(--color-rule)]"
              >
                <ImageIcon className="w-4 h-4" /> Simpan
              </button>
              <button 
                onClick={handleCheckPaymentStatus}
                disabled={checkingStatus}
                className="flex-[2] bg-primary hover:opacity-90 text-[var(--color-accent)]-content font-bold py-3 px-4 rounded-xl transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {checkingStatus ? <Loader2 className="w-4 h-4 animate-spin text-[var(--color-accent)]-content" /> : null}
                <span>Saya Sudah Bayar</span>
              </button>
            </div>
          </div>
        </div>
      )}
 
      {/* VA Modal */}
      {vaNumber && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-2xl max-w-sm w-full p-6 text-center shadow-2xl relative animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setVaNumber(null)}
              className="absolute top-4 right-4 text-[var(--color-muted)] hover:text-[var(--color-ink)] bg-[var(--color-paper-2)] hover:bg-[var(--color-paper-3)] rounded-full p-2 transition-colors border border-[var(--color-rule)]"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="w-16 h-16 bg-[var(--color-paper-3)] border border-[var(--color-rule)] text-[var(--color-accent)] rounded-full flex items-center justify-center mx-auto mb-4 mt-2">
              <CreditCard className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-[var(--color-ink)] mb-2">Instruksi Pembayaran</h3>
            <p className="text-sm text-[var(--color-muted)] mb-6">Silakan lakukan transfer ke nomor Virtual Account atau tunjukkan kode pembayaran berikut.</p>
            
            <div className="bg-[var(--color-paper-2)] p-5 rounded-xl border border-[var(--color-rule)] text-left space-y-4 mb-6 shadow-sm">
              <div>
                <p className="text-xs text-[var(--color-muted)] font-medium uppercase tracking-wider mb-1">Metode</p>
                <p className="text-sm font-bold text-[var(--color-ink)]">{vaBank}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--color-muted)] font-medium uppercase tracking-wider mb-1">Nomor / Kode</p>
                <div className="flex items-center justify-between bg-[var(--color-paper-3)] px-3 py-2 border border-[var(--color-rule)] rounded-lg">
                  <p className="font-mono text-lg font-bold text-[var(--color-accent)]">{vaNumber}</p>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(vaNumber);
                      alert('Disalin!');
                    }}
                    className="text-xs bg-[var(--color-paper)] border border-[var(--color-rule)] px-2 py-1 rounded text-[var(--color-ink)] hover:bg-[var(--color-paper-3)] font-semibold shadow-sm transition-colors"
                  >
                    Salin
                  </button>
                </div>
              </div>
            </div>
            
            <div className="bg-[var(--color-paper-2)] border border-[var(--color-rule)] p-4 rounded-xl mb-6 shadow-sm">
              <BankInstructions bankName={vaBank || ''} vaNumber={vaNumber} />
            </div>
 
            <div className="space-y-3">
              <button 
                onClick={handleCheckPaymentStatus}
                disabled={checkingStatus}
                className="w-full bg-primary hover:opacity-90 text-[var(--color-accent)]-content font-bold py-3.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-md"
              >
                {checkingStatus ? <Loader2 className="w-4 h-4 animate-spin text-[var(--color-accent)]-content" /> : null}
                <span>Saya Sudah Bayar</span>
              </button>
              
              <button 
                onClick={() => setVaNumber(null)}
                className="w-full bg-[var(--color-paper-3)] hover:bg-[var(--color-paper-2)]-higher text-[var(--color-ink)] font-bold py-3 px-4 rounded-xl transition-all text-sm border border-[var(--color-rule)]"
              >
                Tutup / Pilih Metode Lain
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Loading Overlay */}
      {processing && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in">
          <div className="bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-2xl p-8 flex flex-col items-center shadow-2xl max-w-sm w-full mx-4">
            <div className="w-16 h-16 relative flex items-center justify-center mb-4">
              <div className="absolute inset-0 rounded-full border-4 border-surface-container-highest"></div>
              <div className="absolute inset-0 rounded-full border-4 border-[var(--color-accent)] border-t-transparent animate-spin"></div>
            </div>
            <p className="text-lg font-bold text-[var(--color-ink)]">Memproses Transaksi...</p>
            <p className="text-sm text-[var(--color-muted)] mt-2 text-center">Mohon tunggu, jangan tutup halaman ini.</p>
          </div>
        </div>
      )}

      {/* Beautiful custom alert for unpaid status */}
      {statusError && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-2xl max-w-sm w-full p-6 text-center shadow-2xl relative animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-[var(--color-error-bg)] border border-[var(--color-error)] text-[var(--color-error)] rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-[var(--color-ink)] mb-2">Belum Terdeteksi</h3>
            <p className="text-sm text-[var(--color-muted)] mb-6">{statusError}</p>
            <button 
              onClick={() => setStatusError(null)}
              className="w-full bg-primary hover:opacity-90 text-[var(--color-accent)]-content font-bold py-3.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-md"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
export const dynamic = 'force-dynamic';
