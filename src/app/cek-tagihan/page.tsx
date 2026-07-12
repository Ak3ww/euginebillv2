'use client';

import { useState } from 'react';
import { Search, FileText, Calendar, ChevronRight, CheckCircle2 } from 'lucide-react';
import { showSuccess, showError } from '@/lib/sweetalert';
import { useRouter } from 'next/navigation';

export default function CekTagihanPage() {
  const router = useRouter();
  const [customerId, setCustomerId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) return;
    
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/cek-tagihan?customerId=${encodeURIComponent(customerId)}`);
      const data = await res.json();
      
      if (res.ok && data.success) {
        setResult(data.data);
        if (data.data.invoices.length === 0) {
          showSuccess('Tidak ada tagihan yang belum dibayar.');
        }
      } else {
        showError(data.error || 'Gagal mengecek tagihan.');
      }
    } catch (e: any) {
      showError(e.message || 'Terjadi kesalahan.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case 'PENDING':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'OVERDUE':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
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
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl overflow-hidden border border-gray-100">
        
        {/* Header - Formal Red & Black */}
        <div className="bg-black p-8 text-center relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-red-600"></div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Cek Tagihan</h1>
          <p className="text-gray-400 mt-2 text-sm">Masukkan ID Pelanggan Anda untuk melihat rincian tagihan</p>
        </div>
        
        <div className="p-8">
          <form onSubmit={handleSearch} className="space-y-6">
            <div>
              <label htmlFor="customerId" className="block text-sm font-semibold text-gray-900 mb-2">
                ID Pelanggan
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  id="customerId"
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="pl-11 block w-full border border-gray-300 rounded-lg focus:ring-red-600 focus:border-red-600 sm:text-base h-12 text-gray-900 transition-colors bg-gray-50 focus:bg-white"
                  placeholder="Contoh: 75258953"
                  required
                />
              </div>
            </div>
            
            <button
              type="submit"
              disabled={loading || !customerId}
              className="w-full flex justify-center items-center py-3.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              {loading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Mengecek...
                </span>
              ) : (
                'Cek Tagihan'
              )}
            </button>
          </form>

          {result && (
            <div className="mt-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Customer Info Card */}
              <div className="bg-gray-50 rounded-lg p-5 border border-gray-200 mb-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-black">{result.customer.name}</h3>
                    <p className="text-sm text-gray-600 mt-1">Paket: {result.customer.profile?.name || '-'}</p>
                  </div>
                  <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${
                    result.customer.status === 'active' 
                      ? 'bg-green-50 text-green-700 border-green-200' 
                      : 'bg-red-50 text-red-700 border-red-200'
                  }`}>
                    {result.customer.status === 'active' ? 'Aktif' : 'Nonaktif/Isolir'}
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-black uppercase tracking-wider">Daftar Tagihan</h4>
                  <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">
                    {result.invoices.length} Tagihan
                  </span>
                </div>
                
                {result.invoices.length === 0 ? (
                  <div className="bg-white rounded-lg p-8 text-center border border-gray-200 shadow-sm">
                    <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-3 text-green-600">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <p className="text-base text-gray-900 font-bold">Terima Kasih!</p>
                    <p className="text-sm text-gray-500 mt-1">Semua tagihan Anda sudah lunas.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {result.invoices.map((inv: any) => (
                      <div 
                        key={inv.id} 
                        className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-black hover:shadow-md transition-all duration-200 group flex flex-col"
                      >
                        <div className="p-5 flex-grow">
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-2 text-black font-bold">
                              <FileText className="w-4 h-4 text-red-600" />
                              {inv.invoiceNumber}
                            </div>
                            <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-full border ${getStatusColor(inv.status)}`}>
                              {getStatusText(inv.status)}
                            </span>
                          </div>
                          
                          <div className="flex flex-col gap-1 mb-4">
                            <span className="text-xs text-gray-500 font-medium">Total Tagihan</span>
                            <span className="text-xl font-bold text-black">
                              Rp {inv.amount.toLocaleString('id-ID')}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 text-xs text-gray-600 bg-gray-50 p-2 rounded border border-gray-100">
                            <Calendar className="w-3.5 h-3.5 text-gray-400" />
                            <span>Jatuh Tempo: <span className="font-semibold text-gray-900">{new Date(inv.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span></span>
                          </div>
                        </div>
                        
                        <button
                          onClick={() => {
                            if (inv.paymentToken) {
                              router.push(`/pay/${inv.paymentToken}`);
                            } else {
                              showError('Token pembayaran tidak tersedia');
                            }
                          }}
                          className="w-full bg-black text-white py-3 px-4 text-sm font-bold flex justify-center items-center gap-2 hover:bg-gray-900 transition-colors"
                        >
                          Bayar Tagihan Ini
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
    </div>
  );
}
