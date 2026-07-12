'use client';

import { useState } from 'react';
import { Search, FileText, Calendar, ChevronRight, CheckCircle2, ShieldCheck, Lock } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function CekTagihanPage() {
  const router = useRouter();
  const [customerId, setCustomerId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) return;
    
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch(`/api/cek-tagihan?customerId=${encodeURIComponent(customerId)}`);
      const data = await res.json();
      
      if (res.ok && data.success) {
        setResult(data.data);
      } else {
        setError(data.error || 'Gagal mengecek tagihan.');
      }
    } catch (e: any) {
      setError(e.message || 'Terjadi kesalahan jaringan.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case 'PENDING':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'OVERDUE':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const getStatusText = (status: string) => {
    switch (status.toUpperCase()) {
      case 'PENDING':
        return 'Belum Dibayar';
      case 'OVERDUE':
        return 'Terlambat';
      default:
        return status;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-50 via-slate-50 to-white flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="w-full max-w-lg">
        {/* Header Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 text-white shadow-xl shadow-blue-600/20 mb-6">
            <Search className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Cek Tagihan Layanan</h1>
          <p className="text-slate-500 mt-3 text-sm max-w-sm mx-auto">
            Masukkan ID Pelanggan Anda di bawah ini untuk melihat rincian tagihan secara instan.
          </p>
        </div>

        {/* Search Card */}
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden border border-white/40 p-1 mb-6 relative z-10">
          <div className="bg-white rounded-[22px] p-6 sm:p-8 border border-slate-100 shadow-sm">
            <form onSubmit={handleSearch} className="space-y-6">
              <div>
                <label htmlFor="customerId" className="block text-sm font-semibold text-slate-700 mb-2">
                  ID Pelanggan
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    id="customerId"
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    className="block w-full pl-11 pr-4 py-3.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 text-slate-900 bg-slate-50 focus:bg-white transition-all outline-none"
                    placeholder="Contoh: 75258953"
                    required
                  />
                </div>
                {error && (
                  <p className="mt-3 text-sm text-rose-600 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" /> {error}
                  </p>
                )}
              </div>
              
              <button
                type="submit"
                disabled={loading || !customerId}
                className="w-full flex justify-center items-center py-4 px-4 border border-transparent rounded-xl shadow-md shadow-blue-600/10 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-600/20 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
              >
                {loading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Memproses...
                  </span>
                ) : (
                  'Cari Tagihan'
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Secure Connection Badge */}
        {!result && (
          <div className="flex items-center justify-center gap-2 text-slate-400 text-xs font-medium">
            <Lock className="w-3.5 h-3.5" />
            <span>Koneksi aman dilindungi enkripsi SSL</span>
          </div>
        )}

        {/* Results Section */}
        {result && (
          <div className="mt-8 animate-in slide-in-from-bottom-4 duration-500 ease-out">
            {/* Customer Info Card */}
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{result.customer.name}</h3>
                <p className="text-sm text-slate-500 mt-0.5">{result.customer.profile?.name || '-'}</p>
              </div>
              <div className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold border ${
                result.customer.status === 'active' 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}>
                {result.customer.status === 'active' ? 'Layanan Aktif' : 'Nonaktif/Isolir'}
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <h4 className="text-sm font-bold text-slate-900">Tagihan Belum Dibayar</h4>
                <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                  {result.invoices.length} Item
                </span>
              </div>
              
              {result.invoices.length === 0 ? (
                <div className="bg-white rounded-2xl p-10 text-center border border-slate-100 shadow-sm">
                  <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <p className="text-lg text-slate-900 font-bold">Terima Kasih!</p>
                  <p className="text-sm text-slate-500 mt-2 leading-relaxed">Semua tagihan Anda saat ini sudah lunas. Tidak ada pembayaran yang tertunda.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {result.invoices.map((inv: any) => (
                    <div 
                      key={inv.id} 
                      className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:border-blue-300 hover:shadow-lg hover:shadow-blue-900/5 transition-all duration-300 group flex flex-col"
                    >
                      <div className="p-6 flex-grow">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-2.5 text-slate-900 font-bold">
                            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
                              <FileText className="w-4 h-4" />
                            </div>
                            {inv.invoiceNumber}
                          </div>
                          <span className={`text-[10px] uppercase font-bold px-2.5 py-1 rounded-full border ${getStatusColor(inv.status)}`}>
                            {getStatusText(inv.status)}
                          </span>
                        </div>
                        
                        <div className="flex flex-col gap-1 mb-5">
                          <span className="text-sm text-slate-500 font-medium">Total Tagihan</span>
                          <span className="text-2xl font-bold text-slate-900">
                            Rp {inv.amount.toLocaleString('id-ID')}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          <span>Jatuh Tempo: <span className="font-semibold text-slate-900">{new Date(inv.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span></span>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => {
                          if (inv.paymentToken) {
                            router.push(`/pay/${inv.paymentToken}`);
                          } else {
                            setError('Link pembayaran tidak tersedia untuk tagihan ini.');
                          }
                        }}
                        className="w-full bg-slate-50 border-t border-slate-100 text-slate-900 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 py-4 px-6 text-sm font-bold flex justify-between items-center transition-colors duration-300"
                      >
                        <span>Bayar Sekarang</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
