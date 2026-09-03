'use client';

import '@/app/customer/customer.css';
import { formatWIB } from '@/lib/timezone';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  CheckCircle, Clock, AlertCircle, CreditCard, Building2, 
  Loader2, User, Phone, Package, Calendar, MapPin, 
  FileText, Image as ImageIcon, QrCode, Download, ChevronLeft, ChevronRight,
  CheckCircle2, Copy, ArrowRight, ShieldCheck, Zap
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { BankInstructions } from './BankInstructions';
import { BankLogo, AcceptedQrisBadges } from '@/components/ui/BankLogo';

interface Invoice {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerPhone: string;
  amount: number;
  status: string;
  invoiceType?: string;
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
interface CompanySetting { name: string; address: string | null; phone: string | null; email: string | null; logo?: string | null; bankAccounts?: any; }

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
  
  // Payment methods from gateways
  const [duitkuMethods, setDuitkuMethods] = useState<{ code: string; name: string; group: string }[]>([]);
  const [loadingDuitkuMethods, setLoadingDuitkuMethods] = useState(false);
  const [qrinMethods, setQrinMethods] = useState<{ code: string; name: string; group: string; logo?: string }[]>([]);
  const [loadingQrinMethods, setLoadingQrinMethods] = useState(false);
  
  // Active Payment State
  const [activePaymentView, setActivePaymentView] = useState<'selection' | 'qris' | 'va'>('selection');
  const [qrString, setQrString] = useState<string | null>(null);
  const [vaNumber, setVaNumber] = useState<string | null>(null);
  const [vaBank, setVaBank] = useState<string | null>(null);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [copiedVa, setCopiedVa] = useState(false);

  // 24-hour countdown timer for QRIS
  const [countdownSeconds, setCountdownSeconds] = useState(24 * 60 * 60 - 118); // default ~23:58:02

  // Manual Transfer (Hidden by default, preserved for future toggle)
  const SHOW_MANUAL_TRANSFER = false;
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualForm, setManualForm] = useState({ bankName: '', accountNumber: '', accountName: '', destinationBank: '', notes: '', receiptImage: null as File | null });
  const [uploading, setUploading] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualSuccess, setManualSuccess] = useState(false);

  // Timer ticker
  useEffect(() => {
    if (activePaymentView === 'qris' && countdownSeconds > 0) {
      const timer = setInterval(() => {
        setCountdownSeconds((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [activePaymentView, countdownSeconds]);

  // Format seconds into HH : MM : SS
  const formatCountdown = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return {
      hh: String(hours).padStart(2, '0'),
      mm: String(minutes).padStart(2, '0'),
      ss: String(seconds).padStart(2, '0'),
    };
  };

  useEffect(() => { loadInvoice(); }, [token]);

  // Check URL query parameters for returning transactions
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      const orderIdParam = p.get('merchantOrderId') || p.get('orderId');
      if (orderIdParam) {
        setCurrentOrderId(orderIdParam);
        checkOrderPaidStatus(orderIdParam);
      }
    }
  }, []);

  const redirectTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto redirect on paid
  useEffect(() => {
    if (invoice?.status === 'PAID') {
      redirectTimerRef.current = setTimeout(() => {
        router.push(`/invoice/${invoice.invoiceNumber}/print`);
      }, 3000);
    }
    return () => {
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    };
  }, [invoice?.status, router, invoice?.invoiceNumber]);

  // Background Poller for Payment Status (Paused when tab hidden)
  useEffect(() => {
    if (activePaymentView === 'selection' || invoice?.status === 'PAID' || !currentOrderId) return;

    const interval = setInterval(() => {
      if (!document.hidden) {
        checkOrderPaidStatus(currentOrderId);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [activePaymentView, invoice?.status, currentOrderId]);

  const checkOrderPaidStatus = async (orderId: string) => {
    try {
      const res = await fetch(`/api/payment/check-order?orderId=${orderId}`);
      const data = await res.json();
      if (res.ok && (data.status === 'settlement' || data.status === 'PAID')) {
        window.location.reload();
      }
    } catch (e) {
      console.error('Check order status error:', e);
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
      if (res.ok && (data.status === 'settlement' || data.status === 'PAID')) {
        window.location.reload();
      } else {
        setStatusError('Pembayaran belum terdeteksi. Silakan selesaikan pembayaran di aplikasi m-Banking/e-Wallet Anda terlebih dahulu, kemudian klik tombol ini kembali.');
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
      // Empty fallback
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
      // Empty fallback
    } finally {
      setLoadingQrinMethods(false);
    }
  };

  const formatCurrency = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
  const formatDate = (dateStr: string) => formatWIB(dateStr, 'd MMMM yyyy, HH:mm');

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
      if (data.qrString) {
        setQrString(data.qrString);
        setActivePaymentView('qris');
      } else if (data.vaNumber) {
        setVaNumber(data.vaNumber);
        setVaBank(data.vaBank || paymentMethod || 'Virtual Account');
        setActivePaymentView('va');
      } else if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else {
        setError('Kanal pembayaran tidak merespon tautan transaksi');
      }
    } catch { 
      setError('Gagal terhubung ke gateway pembayaran'); 
    } finally { 
      setProcessing(false); 
    }
  };

  // High-Resolution Professional Canvas Download for QRIS
  const handleDownloadQrisCanvas = () => {
    const svg = document.getElementById('qris-svg-render');
    if (!svg || !invoice) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new window.Image();

    canvas.width = 750;
    canvas.height = 1000;

    img.onload = () => {
      if (!ctx) return;
      // White Card
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Top Navy Header Banner (#002c60)
      ctx.fillStyle = '#002c60';
      ctx.fillRect(0, 0, canvas.width, 160);

      // Header Text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(company?.name || 'PEMBAYARAN RESMI ISP', canvas.width / 2, 65);

      ctx.font = '16px sans-serif';
      ctx.fillStyle = '#93c5fd';
      ctx.fillText('QRIS STANDAR PEMBAYARAN NASIONAL', canvas.width / 2, 105);

      // Invoice info block
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(40, 190, canvas.width - 80, 110);
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 2;
      ctx.strokeRect(40, 190, canvas.width - 80, 110);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#64748b';
      ctx.font = '14px sans-serif';
      ctx.fillText('NO. INVOICE:', 70, 230);
      ctx.fillText('TOTAL TAGIHAN:', 70, 270);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 16px monospace';
      ctx.fillText(invoice.invoiceNumber, canvas.width - 70, 230);

      ctx.fillStyle = '#002c60';
      ctx.font = 'bold 24px monospace';
      ctx.fillText(`Rp ${invoice.amount.toLocaleString('id-ID')}`, canvas.width - 70, 270);

      // Draw QR Code Center
      const qrSize = 440;
      const qrX = (canvas.width - qrSize) / 2;
      const qrY = 340;
      ctx.drawImage(img, qrX, qrY, qrSize, qrSize);

      // Footer Box
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(40, 820, canvas.width - 80, 130);
      ctx.strokeRect(40, 820, canvas.width - 80, 130);

      ctx.textAlign = 'center';
      ctx.fillStyle = '#334155';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText('Menerima Pembayaran Melalui Aplikasi Apapun:', canvas.width / 2, 860);

      ctx.fillStyle = '#64748b';
      ctx.font = '14px sans-serif';
      ctx.fillText('BCA • Mandiri • BRI • BNI • BSI • GoPay • DANA • ShopeePay • OVO', canvas.width / 2, 900);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px sans-serif';
      ctx.fillText(`Berlaku 24 Jam sejak invoice dibuat`, canvas.width / 2, 928);

      // Trigger download
      const a = document.createElement('a');
      a.download = `QRIS-${invoice.invoiceNumber}.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  // Preserved Manual Submit Handler
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
    <div className="min-h-screen bg-[var(--color-paper-2)] flex flex-col items-center justify-center p-4">
      <div className="w-16 h-16 relative flex items-center justify-center">
        <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
        <div className="absolute inset-0 rounded-full border-4 border-[var(--color-accent)] border-t-transparent animate-spin"></div>
        <ShieldCheck className="w-6 h-6 text-[var(--color-accent)] absolute" />
      </div>
      <p className="mt-4 font-medium text-xs sm:text-sm text-[var(--color-muted)]">Memuat Halaman Pembayaran Aman...</p>
    </div>
  );

  if (error || !invoice) return (
    <div className="min-h-screen bg-[var(--color-paper-2)] flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 max-w-sm w-full text-center">
        <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-200">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold mb-1 text-slate-800">Tagihan Tidak Ditemukan</h2>
        <p className="text-xs text-slate-500 leading-relaxed">{error || 'Tautan pembayaran tidak valid atau telah kedaluwarsa.'}</p>
        <div className="mt-6 flex flex-col gap-2">
          <button onClick={() => window.location.reload()} className="bg-[var(--color-accent)] text-white hover:opacity-90 rounded-xl py-2.5 font-bold text-xs">Muat Ulang</button>
          <button onClick={() => router.push('/customer')} className="bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl py-2.5 font-medium text-xs">Kembali ke Portal</button>
        </div>
      </div>
    </div>
  );

  // Success Paid View
  if (invoice.status === 'PAID') return (
    <div className="min-h-screen bg-[var(--color-paper-2)] flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-md p-6 sm:p-8 max-w-sm w-full text-center animate-in zoom-in-95">
        <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-200">
          <CheckCircle2 className="w-8 h-8 text-emerald-600" />
        </div>
        <h2 className="text-xl font-bold mb-1 text-slate-800">Pembayaran Berhasil</h2>
        <p className="text-xs text-slate-500 mb-6">Terima kasih, tagihan Anda telah terkonfirmasi lunas.</p>
        
        <div className="bg-slate-50 rounded-xl p-4 text-left space-y-3 border border-slate-200 mb-6">
          <div className="flex justify-between items-center text-xs border-b border-slate-200 pb-2">
            <span className="text-slate-500">No. Tagihan</span>
            <span className="font-mono font-bold text-slate-800">{invoice.invoiceNumber}</span>
          </div>
          <div className="flex justify-between items-center text-xs border-b border-slate-200 pb-2">
            <span className="text-slate-500">Total Dibayar</span>
            <span className="font-bold text-sm text-[var(--color-accent)]">{formatCurrency(invoice.amount)}</span>
          </div>
          {invoice.paidAt && (
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500">Waktu Bayar</span>
              <span className="font-medium text-[11px] text-slate-700">{formatDate(invoice.paidAt)}</span>
            </div>
          )}
        </div>
        
        <div className="space-y-2">
          <button 
            onClick={() => router.push(`/invoice/${invoice.invoiceNumber}/print`)}
            className="w-full bg-[var(--color-accent)] text-white hover:opacity-90 rounded-xl py-3 font-bold text-xs flex items-center justify-center gap-2 shadow-sm"
          >
            <FileText className="w-4 h-4" /> Cetak Bukti Pembayaran
          </button>
          <p className="text-[11px] text-slate-400">Dialihkan otomatis dalam 3 detik...</p>
        </div>
      </div>
    </div>
  );

  const countdown = formatCountdown(countdownSeconds);

  // ════════════════════════════════════════════════════════════════════════════
  // STATE 2: ACTIVE QRIS PAYMENT (PERSIS REFERENSI SCREENSHOT ANDA)
  // ════════════════════════════════════════════════════════════════════════════
  if (activePaymentView === 'qris') {
    return (
      <div className="min-h-screen bg-[var(--color-paper-2)] text-[var(--color-ink)] font-sans pb-16">
        {/* Top Navigation Bar: < Pembayaran */}
        <div className="bg-white border-b border-slate-200 sticky top-0 z-30 px-4 py-3.5 flex items-center gap-3">
          <button
            onClick={() => setActivePaymentView('selection')}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800 hover:text-[var(--color-accent)] transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-slate-600" />
            <span className="text-sm">Pembayaran</span>
          </button>
        </div>

        <div className="max-w-md mx-auto px-4 py-4 space-y-3.5 animate-in fade-in duration-300">
          {/* Card 1: Total Pembayaran & Timer Countdown */}
          <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-xs font-medium text-slate-600">Total Pembayaran</span>
              <span className="text-base font-bold text-[var(--color-accent)] font-mono">
                Rp{invoice.amount.toLocaleString('id-ID')}
              </span>
            </div>

            <div className="flex items-start justify-between">
              <span className="text-xs font-medium text-slate-600">Bayar Dalam</span>
              <div className="text-right">
                <div className="text-sm font-bold text-slate-900 font-mono tracking-wider">
                  {countdown.hh} : {countdown.mm} : {countdown.ss}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Jatuh tempo {formatDate(invoice.dueDate)}
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Container QRIS Resmi */}
          <div className="bg-white rounded-xl border border-slate-200/90 p-6 shadow-xs text-center space-y-4">
            {/* Header: Logo QRIS + QR Code Standar Pembayaran Nasional */}
            <div className="flex items-center justify-center gap-2">
              <BankLogo name="qris" size="md" variant="plain" />
              <div className="text-left leading-none">
                <span className="text-[11px] font-bold text-slate-800 block">QR Code Standar</span>
                <span className="text-[10px] text-slate-500 font-medium">Pembayaran Nasional</span>
              </div>
            </div>

            {/* Crisp QR Code Container */}
            <div className="inline-block p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
              {qrString ? (
                <QRCodeSVG
                  id="qris-svg-render"
                  value={qrString}
                  size={240}
                  level="M"
                  includeMargin={true}
                  className="w-[220px] h-[220px] sm:w-[240px] sm:h-[240px] mx-auto"
                />
              ) : (
                <div className="w-[220px] h-[220px] flex items-center justify-center bg-slate-50 rounded-lg">
                  <Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" />
                </div>
              )}
            </div>

            {/* NMID */}
            <p className="font-mono text-xs font-semibold text-slate-600 tracking-wider">
              NMID: ID2025444802321
            </p>
          </div>

          {/* Card 3: Banner Menerima Berbagai Pembayaran QR */}
          <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-xs space-y-3">
            <h4 className="text-xs font-bold text-slate-800 text-left">
              Menerima Berbagai Pembayaran QR
            </h4>
            <div className="pt-1">
              <AcceptedQrisBadges />
            </div>
          </div>

          {/* Card 4: Petunjuk Pembayaran QRIS (Langkah 1 s/d 6 Rapi) */}
          <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-xs space-y-3.5">
            <h4 className="text-xs font-bold text-slate-800 text-left">
              Petunjuk Pembayaran QRIS
            </h4>

            <ol className="space-y-3 text-left">
              {[
                'Simpan atau screenshot Kode QR, yang berlaku selama 24 jam. Kamu bisa muat ulang untuk dapatkan kode baru.',
                'Scan Kode QR dengan m-banking, dompet elektronik, atau aplikasi pembayaran lain.',
                'Pastikan rincian pembayaran telah sesuai, lalu lanjutkan pembayaran.',
                'Transaksi akan secara otomatis terbayar dan diperbarui setelah pembayaran berhasil.',
                'Simpan bukti pembayaran untuk verifikasi lebih lanjut jika diperlukan.',
                'Pembayaran tidak dapat diproses jika menggunakan metode pembayaran yang tidak didukung.',
              ].map((step, idx) => (
                <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-600 leading-relaxed">
                  <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Sticky Bottom Actions */}
          <div className="space-y-2 pt-2">
            <button
              onClick={handleDownloadQrisCanvas}
              className="w-full py-3.5 px-4 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" /> Simpan Kode QR
            </button>

            <button
              onClick={handleCheckPaymentStatus}
              disabled={checkingStatus}
              className="w-full py-3 px-4 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {checkingStatus ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
              Saya Sudah Bayar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // STATE 3: ACTIVE VIRTUAL ACCOUNT PAYMENT
  // ════════════════════════════════════════════════════════════════════════════
  if (activePaymentView === 'va' && vaNumber) {
    return (
      <div className="min-h-screen bg-[var(--color-paper-2)] text-[var(--color-ink)] font-sans pb-16">
        <div className="bg-white border-b border-slate-200 sticky top-0 z-30 px-4 py-3.5 flex items-center gap-3">
          <button
            onClick={() => setActivePaymentView('selection')}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800 hover:text-[var(--color-accent)] transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-slate-600" />
            <span className="text-sm">Pilih Metode Lain</span>
          </button>
        </div>

        <div className="max-w-md mx-auto px-4 py-4 space-y-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <BankLogo name={vaBank || 'bank'} size="sm" />
                <span className="text-xs font-bold text-slate-800">Virtual Account ({vaBank})</span>
              </div>
              <span className="text-xs font-bold text-[var(--color-accent)] font-mono">
                {formatCurrency(invoice.amount)}
              </span>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1 text-center">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Nomor Virtual Account</p>
              <p className="text-2xl font-mono font-bold text-slate-900 tracking-wider py-1">{vaNumber}</p>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(vaNumber);
                  setCopiedVa(true);
                  setTimeout(() => setCopiedVa(false), 2000);
                }}
                className="inline-flex items-center gap-1 text-xs font-bold text-[var(--color-accent)] hover:underline pt-1"
              >
                {copiedVa ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedVa ? 'Nomor Disalin!' : 'Salin Nomor VA'}
              </button>
            </div>

            <div className="border-t border-slate-100 pt-3">
              <BankInstructions bankName={vaBank || ''} vaNumber={vaNumber} />
            </div>

            <button
              onClick={handleCheckPaymentStatus}
              disabled={checkingStatus}
              className="w-full py-3 px-4 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {checkingStatus ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Saya Sudah Bayar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // STATE 1: DEFAULT SELECTION MODE (INVOICE DETAIL & PAYMENT METHODS)
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <main className="min-h-screen bg-[var(--color-paper-2)] text-[var(--color-ink)] font-sans pb-20">
      {/* Header Brand */}
      <header className="bg-white border-b border-slate-200/90 py-4 px-4 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {company?.logo ? (
              <img src={company.logo} alt={company.name} className="h-7 max-w-[130px] object-contain" />
            ) : (
              <span className="font-bold text-sm text-[var(--color-accent)] tracking-tight">{company?.name || 'Portal Pembayaran'}</span>
            )}
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3" /> Menunggu Pembayaran
          </span>
        </div>
      </header>

      <div className="max-w-xl mx-auto px-4 py-5 space-y-4">
        {/* Invoice Summary Card */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-4">
          <div className="flex items-start justify-between border-b border-slate-100 pb-3">
            <div>
              <p className="text-[11px] text-slate-500 font-medium">Tagihan Layanan Internet</p>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 font-mono tracking-tight mt-0.5">
                {formatCurrency(invoice.amount)}
              </h1>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 font-mono uppercase block">Nomor Tagihan</span>
              <span className="text-xs font-mono font-bold text-slate-700">{invoice.invoiceNumber}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-slate-400 block text-[11px]">Nama Pelanggan</span>
              <span className="font-bold text-slate-800 truncate block">{invoice.customerName || invoice.user?.name}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Jatuh Tempo</span>
              <span className="font-bold text-slate-800 block">{formatDate(invoice.dueDate)}</span>
            </div>
            {invoice.user?.profile && (
              <div>
                <span className="text-slate-400 block text-[11px]">Paket Langganan</span>
                <span className="font-bold text-slate-800 block">{invoice.user.profile.name}</span>
              </div>
            )}
            {invoice.user?.customerId && (
              <div>
                <span className="text-slate-400 block text-[11px]">ID Pelanggan</span>
                <span className="font-bold text-slate-800 font-mono block">{invoice.user.customerId}</span>
              </div>
            )}
          </div>
        </div>

        {/* Global Payment Alert */}
        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Payment Channels Section */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-slate-600 uppercase tracking-wider px-1">
            Pilih Metode Pembayaran
          </h2>

          {/* ── 1. KARTU UTAMA: QRIS ── */}
          {paymentGateways.length > 0 && (
            <button
              onClick={() => {
                const qrinGw = paymentGateways.find((g) => g.provider === 'qrin');
                const duitkuGw = paymentGateways.find((g) => g.provider === 'duitku');
                if (qrinGw) {
                  handlePayment('qrin', 'qris');
                } else if (duitkuGw) {
                  handlePayment('duitku', 'SP'); // ShopeePay / QRIS Duitku
                } else {
                  handlePayment(paymentGateways[0].provider, 'qris');
                }
              }}
              disabled={processing}
              className="w-full text-left bg-white border-2 border-[var(--color-accent)]/40 hover:border-[var(--color-accent)] rounded-2xl p-4 shadow-xs hover:shadow-md transition-all group relative overflow-hidden"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-slate-50 border border-slate-200 rounded-xl shrink-0 group-hover:scale-105 transition-transform">
                    <BankLogo name="qris" size="md" variant="plain" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900 group-hover:text-[var(--color-accent)] transition-colors">
                        QRIS (Standar Pembayaran Nasional)
                      </h3>
                      <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 font-bold text-[10px] rounded border border-emerald-200">
                        Instan
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      BCA, Mandiri, BRI, BNI, GoPay, DANA, ShopeePay & lainnya
                    </p>
                    <div className="mt-3 pt-2 border-t border-slate-100">
                      <AcceptedQrisBadges />
                    </div>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-[var(--color-accent)] group-hover:text-white transition-all shrink-0 mt-1">
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            </button>
          )}

          {/* ── 2. KARTU VIRTUAL ACCOUNT ── */}
          {duitkuMethods.filter((m) => m.group === 'VA' || m.name.toLowerCase().includes('va')).length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs space-y-3">
              <h3 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[var(--color-accent)]" /> Virtual Account Bank
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {duitkuMethods
                  .filter((m) => m.group === 'VA' || m.name.toLowerCase().includes('va'))
                  .map((method) => (
                    <button
                      key={method.code}
                      onClick={() => handlePayment('duitku', method.code)}
                      disabled={processing}
                      className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-[var(--color-accent)] hover:bg-slate-50 transition-all text-left group disabled:opacity-50"
                    >
                      <div className="flex items-center gap-2.5">
                        <BankLogo name={method.name} size="sm" />
                        <span className="text-xs font-bold text-slate-800 group-hover:text-[var(--color-accent)]">
                          {method.name}
                        </span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  ))}
              </div>
            </div>
          )}

          {/* ── 3. QRIN METHODS JIKA ADA VIRTUAL ACCOUNT / RETAIL ── */}
          {qrinMethods.filter((m) => m.code !== 'qris').length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs space-y-3">
              <h3 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                <Zap className="w-4 h-4 text-[var(--color-accent)]" /> Kanal Pembayaran Tambahan (QRIN)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {qrinMethods
                  .filter((m) => m.code !== 'qris')
                  .map((method) => (
                    <button
                      key={method.code}
                      onClick={() => handlePayment('qrin', method.code)}
                      disabled={processing}
                      className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-[var(--color-accent)] hover:bg-slate-50 transition-all text-left group disabled:opacity-50"
                    >
                      <div className="flex items-center gap-2.5">
                        <BankLogo name={method.name} size="sm" />
                        <span className="text-xs font-bold text-slate-800 group-hover:text-[var(--color-accent)]">
                          {method.name}
                        </span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  ))}
              </div>
            </div>
          )}

          {/* ── 4. PRESERVED MANUAL TRANSFER (HIDDEN BY DEFAULT) ── */}
          {SHOW_MANUAL_TRANSFER && (
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
              <button
                onClick={() => setShowManualForm(!showManualForm)}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50 text-left"
              >
                <div className="flex items-center gap-3">
                  <Building2 className="w-5 h-5 text-slate-500" />
                  <div>
                    <p className="text-xs font-bold text-slate-800">Transfer Manual Bank</p>
                    <p className="text-[11px] text-slate-400">Konfirmasi bukti transfer</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Loading Overlay */}
      {processing && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl p-6 flex flex-col items-center shadow-xl max-w-xs w-full mx-4 text-center border border-slate-200">
            <Loader2 className="w-10 h-10 animate-spin text-[var(--color-accent)] mb-3" />
            <p className="text-sm font-bold text-slate-800">Menyiapkan Transaksi...</p>
            <p className="text-xs text-slate-500 mt-1">Menghubungkan ke gateway pembayaran</p>
          </div>
        </div>
      )}

      {/* Status Alert Modal */}
      {statusError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center shadow-xl border border-slate-200 animate-in zoom-in-95">
            <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-3 border border-amber-200">
              <Clock className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-800 mb-1.5">Belum Terdeteksi</h3>
            <p className="text-xs text-slate-500 mb-5 leading-relaxed">{statusError}</p>
            <button 
              onClick={() => setStatusError(null)}
              className="w-full bg-[var(--color-accent)] hover:opacity-90 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all shadow-sm"
            >
              Mengerti
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
