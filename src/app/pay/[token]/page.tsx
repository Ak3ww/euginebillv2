'use client';
import { showError } from '@/lib/sweetalert';
import { formatWIB } from '@/lib/timezone';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Wifi, CheckCircle, Clock, AlertCircle, CreditCard, Building2, Loader2, User, Phone, Package, Calendar, MapPin, Router, Network, Mail, Hash, Zap } from 'lucide-react';

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
  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [paymentGateways, setPaymentGateways] = useState<PaymentGateway[]>([]);
  const [company, setCompany] = useState<CompanySetting | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [duitkuMethods, setDuitkuMethods] = useState<{ code: string; name: string; group: string }[]>([]);
  const [loadingDuitkuMethods, setLoadingDuitkuMethods] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualForm, setManualForm] = useState({ bankName: '', accountNumber: '', accountName: '', notes: '', receiptImage: null as File | null });
  const [uploading, setUploading] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadInvoice(); }, [token]);

  const loadInvoice = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/invoices/by-token/${token}`);
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to load invoice'); return; }
      setInvoice(data.invoice);
      setPaymentGateways(data.paymentGateways || []);
      setCompany(data.company || null);
      // If Duitku is in the list, fetch its payment methods
      if ((data.paymentGateways || []).some((g: PaymentGateway) => g.provider === 'duitku')) {
        fetchDuitkuMethods(data.invoice?.amount || 10000);
      }
    } catch (err) { setError('Failed to load invoice'); } finally { setLoading(false); }
  };

  const fetchDuitkuMethods = async (amount: number) => {
    setLoadingDuitkuMethods(true);
    try {
      const res = await fetch(`/api/payment/duitku-methods?amount=${amount}`);
      const data = await res.json();
      setDuitkuMethods(data.methods || []);
    } catch {
      // Use empty = will show nothing for Duitku methods
    } finally {
      setLoadingDuitkuMethods(false);
    }
  };

  const formatCurrency = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
  const formatDate = (dateStr: string) => formatWIB(dateStr, 'd MMM yyyy');

  const getStatusBadge = (status: string) => {
    const stylesInHeader: Record<string, string> = {
      PAID: 'bg-white text-green-700',
      PENDING: 'bg-white text-yellow-600',
      OVERDUE: 'bg-white text-red-600'
    };
    const icons: Record<string, React.ReactNode> = { PAID: <CheckCircle className="w-3 h-3" />, PENDING: <Clock className="w-3 h-3" />, OVERDUE: <AlertCircle className="w-3 h-3" /> };
    return <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-md ${stylesInHeader[status] || 'bg-white text-gray-700'} shadow-sm`}>{icons[status]} {status}</span>;
  };

  const handlePayment = async (gateway: string, paymentMethod?: string) => {
    if (!invoice) return;
    setProcessing(true);
    try {
      const body: any = { invoiceId: invoice.id, gateway };
      if (paymentMethod) body.paymentMethod = paymentMethod;
      const res = await fetch('/api/payment/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { await showError(data.error || 'Failed'); return; }
      if (data.paymentUrl) window.location.href = data.paymentUrl; else await showError('Payment URL not available');
    } catch { await showError('Failed to process payment'); } finally { setProcessing(false); }
  };

  const handleManualSubmit = async () => {
    if (!manualForm.bankName || !manualForm.accountName || !manualForm.receiptImage) {
      await showError('Mohon lengkapi bank pengirim, nama pengirim, dan bukti transfer.');
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('bankName', manualForm.bankName);
      formData.append('accountNumber', manualForm.accountNumber);
      formData.append('accountName', manualForm.accountName);
      formData.append('notes', manualForm.notes);
      formData.append('receiptImage', manualForm.receiptImage);

      const res = await fetch(`/api/pay/${token}/manual`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal upload');
      
      await showError('Bukti transfer berhasil dikirim, menunggu konfirmasi admin.', 'success');
      window.location.reload();
    } catch (err: any) {
      await showError(err.message || 'Gagal upload bukti transfer');
    } finally {
      setUploading(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-10 h-10 animate-spin mx-auto text-red-600 mb-3" />
        <p className="text-sm text-gray-500">Memuat data tagihan...</p>
      </div>
    </div>
  );

  if (error || !invoice) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border border-red-200 p-6 max-w-sm w-full text-center shadow-sm">
        <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-gray-900 mb-1">Tagihan Tidak Ditemukan</h2>
        <p className="text-sm text-gray-600">{error || 'Link pembayaran tidak valid atau sudah kadaluarsa.'}</p>
      </div>
    </div>
  );

  if (invoice.status === 'PAID') return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-sm w-full text-center shadow-sm">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Pembayaran Berhasil</h2>
        <p className="text-sm text-gray-600 mb-6">Terima kasih, tagihan Anda telah lunas.</p>
        <div className="bg-gray-50 rounded-lg p-4 text-left space-y-3 border border-gray-100">
          <div className="flex justify-between text-sm"><span className="text-gray-500">No. Tagihan</span><span className="font-semibold text-gray-900">{invoice.invoiceNumber}</span></div>
          <div className="flex justify-between text-sm"><span className="text-gray-500">Jumlah</span><span className="font-bold text-gray-900">{formatCurrency(invoice.amount)}</span></div>
          {invoice.paidAt && <div className="flex justify-between text-sm"><span className="text-gray-500">Waktu Bayar</span><span className="text-gray-900">{formatDate(invoice.paidAt)}</span></div>}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 font-sans">
      <div className="max-w-lg mx-auto space-y-6">
        
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Portal Pembayaran</h1>
          <p className="text-sm text-gray-500 mt-1">Silakan periksa detail tagihan Anda di bawah ini</p>
        </div>

        {/* Invoice Card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-red-600 px-6 py-4 flex items-center justify-between">
            <span className="text-sm font-semibold text-white uppercase tracking-wider">Detail Tagihan</span>
            {getStatusBadge(invoice.status)}
          </div>
          
          <div className="p-6 space-y-6">
            {/* Amount */}
            <div className="text-center">
              <p className="text-sm text-gray-500 mb-1">Total Tagihan</p>
              <p className="text-4xl font-bold text-gray-900">{formatCurrency(invoice.amount)}</p>
            </div>

            <div className="flex justify-between items-center py-4 border-y border-gray-100">
              <span className="text-sm text-gray-500">No. Tagihan</span>
              <span className="font-mono font-semibold text-gray-900">{invoice.invoiceNumber}</span>
            </div>

            {/* Customer Info */}
            <div>
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-4 border-b border-gray-200 pb-2">Informasi Pelanggan</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 flex items-center gap-2"><User className="w-4 h-4" /> Nama</span>
                  <span className="font-medium text-gray-900 text-right">{invoice.user?.name || invoice.customerName}</span>
                </div>
                {invoice.user?.customerId && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 flex items-center gap-2"><Hash className="w-4 h-4" /> ID Pelanggan</span>
                    <span className="font-mono text-gray-900 text-right">{invoice.user.customerId}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 flex items-center gap-2"><Phone className="w-4 h-4" /> Telepon</span>
                  <span className="font-medium text-gray-900 text-right">{invoice.user?.phone || invoice.customerPhone}</span>
                </div>
                {invoice.user?.email && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 flex items-center gap-2"><Mail className="w-4 h-4" /> Email</span>
                    <span className="font-medium text-gray-900 text-right break-all">{invoice.user.email}</span>
                  </div>
                )}
                {invoice.user?.address && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 flex items-center gap-2"><MapPin className="w-4 h-4" /> Alamat</span>
                    <span className="font-medium text-gray-900 text-right max-w-[60%]">{invoice.user.address}</span>
                  </div>
                )}

                {invoice.user?.profile && (
                  <div className="flex justify-between text-sm pt-3 border-t border-gray-100 mt-3">
                    <span className="text-gray-500 flex items-center gap-2"><Package className="w-4 h-4" /> Paket</span>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">{invoice.user.profile.name}</p>
                      {(invoice.user.profile.downloadSpeed > 0) && (
                        <p className="text-xs text-gray-500 flex items-center justify-end gap-1 mt-1"><Zap className="w-3 h-3" /> {invoice.user.profile.downloadSpeed}M / {invoice.user.profile.uploadSpeed}M</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Calendar className="w-3 h-3" /> Tanggal Terbit</p>
                <p className="text-sm font-medium text-gray-900">{formatDate(invoice.createdAt)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Calendar className="w-3 h-3" /> Jatuh Tempo</p>
                <p className="text-sm font-medium text-gray-900">{formatDate(invoice.dueDate)}</p>
              </div>
            </div>

            {invoice.status === 'OVERDUE' && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-red-700">Pembayaran Terlambat</p>
                  <p className="text-xs text-red-600 mt-0.5">Segera lakukan pembayaran untuk menghindari pemutusan layanan.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Payment Methods */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-gray-500" />
              Metode Pembayaran
            </h2>
          </div>
          <div className="p-6">
            {paymentGateways.length === 0 ? (
              <div className="text-center py-6">
                <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">Tidak ada metode otomatis tersedia.</p>
              </div>
            ) : null}
            
            <div className="space-y-3">
              {/* Manual Transfer */}
              <button
                onClick={() => setShowManualForm(!showManualForm)}
                className="w-full flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:border-red-600 hover:shadow-sm transition-all mb-3 group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center group-hover:bg-red-50 transition-colors">
                    <Building2 className="w-5 h-5 text-gray-600 group-hover:text-red-600" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-gray-900">Transfer Manual</p>
                    <p className="text-xs text-gray-500">Upload bukti transfer</p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-red-600">{showManualForm ? 'Tutup' : 'Pilih'}</span>
              </button>

              {showManualForm && (
                <div className="p-5 bg-gray-50 rounded-lg border border-gray-200 space-y-5 mb-5">
                  {/* Bank Accounts */}
                  <div>
                    <p className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3">Rekening Tujuan</p>
                    {company?.bankAccounts && Array.isArray(company.bankAccounts) && company.bankAccounts.length > 0 ? (
                      <div className="grid gap-3">
                        {company.bankAccounts.map((acc: any, i: number) => (
                          <div key={i} className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                              <p className="text-xs font-bold text-gray-500 mb-1">{acc.bankName}</p>
                              <p className="text-lg font-mono font-semibold text-gray-900 tracking-wider">{acc.accountNumber}</p>
                              <p className="text-xs text-gray-600 mt-1">a/n {acc.accountName}</p>
                            </div>
                            <button onClick={() => navigator.clipboard.writeText(acc.accountNumber)} className="text-xs font-semibold text-red-600 hover:text-red-700 bg-red-50 px-3 py-1.5 rounded-md border border-red-100 transition-colors">
                              Salin No. Rek
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-red-500 bg-red-50 p-3 rounded-lg border border-red-100">Belum ada rekening tujuan yang disetting.</p>
                    )}
                  </div>

                  {/* Form Upload */}
                  <div className="border-t border-gray-200 pt-5 space-y-4">
                    <p className="text-xs font-bold text-gray-900 uppercase tracking-wider">Konfirmasi Pembayaran</p>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-medium text-gray-700 block mb-1">Bank Pengirim</label>
                        <input type="text" className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all" placeholder="Contoh: BCA, DANA" value={manualForm.bankName} onChange={e => setManualForm({...manualForm, bankName: e.target.value})} />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-700 block mb-1">Atas Nama Pengirim</label>
                        <input type="text" className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all" placeholder="Nama pemilik rekening/akun" value={manualForm.accountName} onChange={e => setManualForm({...manualForm, accountName: e.target.value})} />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-700 block mb-1">No. Rekening Pengirim (Opsional)</label>
                        <input type="text" className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all" placeholder="12345678" value={manualForm.accountNumber} onChange={e => setManualForm({...manualForm, accountNumber: e.target.value})} />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-700 block mb-1">Catatan (Opsional)</label>
                        <input type="text" className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all" placeholder="Cth: Bayar bulan ini" value={manualForm.notes} onChange={e => setManualForm({...manualForm, notes: e.target.value})} />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-700 block mb-1">Bukti Transfer (Gambar)</label>
                        <input type="file" accept="image/*" className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 cursor-pointer" onChange={e => setManualForm({...manualForm, receiptImage: e.target.files?.[0] || null})} />
                      </div>
                      
                      <button onClick={handleManualSubmit} disabled={uploading} className="w-full bg-red-600 text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 mt-2 flex justify-center items-center">
                        {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        {uploading ? 'Mengirim...' : 'Kirim Bukti Pembayaran'}
                      </button>

                      {/* WhatsApp Alternative */}
                      {company?.phone && (
                        <div className="pt-4 mt-2 text-center border-t border-gray-200">
                          <p className="text-xs text-gray-500 mb-2">Atau konfirmasi manual via WhatsApp</p>
                          <a href={`https://wa.me/${company.phone.replace(/[^0-9]/g, '')}?text=Halo, saya ingin konfirmasi pembayaran untuk tagihan ${invoice.invoiceNumber}.`} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 w-full bg-[#25D366] hover:bg-[#20b958] text-white rounded-lg py-2.5 text-sm font-semibold transition-colors">
                            <Phone className="w-4 h-4" /> Konfirmasi via WhatsApp
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {paymentGateways.length > 0 && (
                <>
                  <div className="flex items-center gap-4 py-2">
                    <div className="h-px flex-1 bg-gray-200"></div>
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Payment Otomatis</span>
                    <div className="h-px flex-1 bg-gray-200"></div>
                  </div>

                  {paymentGateways.map((gateway) => {
                    if (gateway.provider === 'duitku') {
                      if (loadingDuitkuMethods) {
                        return (
                          <div key={gateway.id} className="flex items-center justify-center py-4 bg-white border border-gray-200 rounded-lg">
                            <Loader2 className="w-5 h-5 animate-spin text-red-600 mr-2" />
                            <span className="text-sm text-gray-500">Memuat metode Duitku...</span>
                          </div>
                        );
                      }
                      if (duitkuMethods.length > 0) {
                        return (
                          <div key={gateway.id} className="space-y-3">
                            <p className="text-xs font-bold text-gray-900 uppercase tracking-wider px-1">{gateway.name}</p>
                            {duitkuMethods.map((method) => (
                              <button
                                key={method.code}
                                onClick={() => handlePayment('duitku', method.code)}
                                disabled={processing}
                                className="w-full flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:border-red-600 hover:shadow-sm transition-all group disabled:opacity-50"
                              >
                                <div className="flex items-center gap-4">
                                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center group-hover:bg-red-50 transition-colors">
                                    <CreditCard className="w-5 h-5 text-gray-600 group-hover:text-red-600" />
                                  </div>
                                  <div className="text-left">
                                    <p className="text-sm font-bold text-gray-900">{method.name}</p>
                                    <p className="text-xs text-gray-500 uppercase">{method.code}</p>
                                  </div>
                                </div>
                                {processing ? (
                                  <Loader2 className="w-5 h-5 animate-spin text-red-600" />
                                ) : (
                                  <span className="text-xs font-semibold text-red-600">Bayar</span>
                                )}
                              </button>
                            ))}
                          </div>
                        );
                      }
                    }

                    return (
                      <button
                        key={gateway.id}
                        onClick={() => handlePayment(gateway.provider)}
                        disabled={processing}
                        className="w-full flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:border-red-600 hover:shadow-sm transition-all group disabled:opacity-50"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center group-hover:bg-red-50 transition-colors">
                            <CreditCard className="w-5 h-5 text-gray-600 group-hover:text-red-600" />
                          </div>
                          <div className="text-left">
                            <p className="text-sm font-bold text-gray-900">{gateway.name}</p>
                            <p className="text-xs text-gray-500 capitalize">{gateway.provider}</p>
                          </div>
                        </div>
                        {processing ? (
                          <Loader2 className="w-5 h-5 animate-spin text-red-600" />
                        ) : (
                          <span className="text-xs font-semibold text-red-600">Bayar Sekarang</span>
                        )}
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Company Info */}
        {company && (
          <div className="text-center pt-4 pb-2">
            <h3 className="text-sm font-bold text-gray-900">{company.name}</h3>
            {company.address && <p className="text-xs text-gray-500 mt-1">{company.address}</p>}
            <div className="flex flex-wrap justify-center gap-4 text-xs text-gray-500 mt-2">
              {company.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {company.phone}</span>}
              {company.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {company.email}</span>}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center space-y-1 pb-6">
          <p className="text-xs text-gray-400">Pembayaran aman didukung oleh</p>
          <p className="text-sm font-bold text-gray-900">{company?.name || 'ISP Billing'}</p>
        </div>
      </div>
    </div>
  );
}
