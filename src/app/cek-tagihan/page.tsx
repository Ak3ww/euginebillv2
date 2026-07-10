'use client';

import { useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { Search, FileText, Calendar, CreditCard, ChevronRight } from 'lucide-react';
import { showSuccess, showError } from '@/lib/sweetalert';

export default function CekTagihanPage() {
  const { t } = useTranslation();
  const [customerId, setCustomerId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) return;
    
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/customer/check-bill?id=${encodeURIComponent(customerId)}`);
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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-primary p-6 text-center text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-white/10" style={{ backgroundImage: 'radial-gradient(circle at 50% -20%, transparent 20%, rgba(0,0,0,0.2) 100%)' }}></div>
          <h1 className="text-2xl font-bold relative z-10">Cek Tagihan</h1>
          <p className="text-primary-foreground/80 mt-2 text-sm relative z-10">Masukkan ID Pelanggan Anda untuk melihat tagihan.</p>
        </div>
        
        <div className="p-6">
          <form onSubmit={handleSearch} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ID Pelanggan (UID)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="pl-10 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-primary focus:border-primary sm:text-sm h-12"
                  placeholder="Contoh: UID12345678"
                  required
                />
              </div>
            </div>
            
            <button
              type="submit"
              disabled={loading || !customerId}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
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
            <div className="mt-8 border-t border-gray-100 pt-6">
              <div className="mb-4">
                <h3 className="text-lg font-bold text-gray-900">{result.customer.name}</h3>
                <p className="text-sm text-gray-500">Paket: {result.customer.profileName}</p>
                <div className={`mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  result.customer.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {result.customer.status === 'active' ? 'Aktif' : 'Isolir'}
                </div>
              </div>
              
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Tagihan Belum Dibayar</h4>
                
                {result.invoices.length === 0 ? (
                  <div className="bg-green-50 rounded-lg p-4 text-center border border-green-100">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2 text-green-600">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <p className="text-sm text-green-800 font-medium">Hore! Semua tagihan Anda sudah lunas.</p>
                  </div>
                ) : (
                  result.invoices.map((inv: any) => (
                    <a 
                      key={inv.id} 
                      href={inv.paymentToken ? `/pay-manual?token=${inv.paymentToken}` : '#'}
                      className="block bg-white border border-gray-200 rounded-xl p-4 hover:border-primary hover:shadow-md transition-all group"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2 text-gray-900 font-medium">
                          <FileText className="w-4 h-4 text-primary" />
                          {inv.invoiceNumber}
                        </div>
                        <span className="font-bold text-primary">Rp {inv.amount.toLocaleString('id-ID')}</span>
                      </div>
                      <div className="flex items-center justify-between mt-4">
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          <Calendar className="w-3.5 h-3.5" />
                          Jatuh Tempo: {new Date(inv.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </div>
                        <div className="flex items-center text-xs font-medium text-primary group-hover:underline">
                          Bayar <ChevronRight className="w-4 h-4 ml-0.5" />
                        </div>
                      </div>
                    </a>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
