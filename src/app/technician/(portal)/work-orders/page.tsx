'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardCheck, Search, Loader2, MapPin, Phone, User, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';

export const dynamic = 'force-dynamic';

export default function WorkOrdersPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchWorkOrders = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/technician/work-orders');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setWorkOrders(data.workOrders);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkOrders();
  }, []);

  const filteredOrders = workOrders.filter(
    (wo) =>
      wo.customerName.toLowerCase().includes(search.toLowerCase()) ||
      wo.issueType.toLowerCase().includes(search.toLowerCase()) ||
      wo.customerAddress.toLowerCase().includes(search.toLowerCase())
  );

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT': return 'bg-red-500/10 text-red-600 border-red-500/20';
      case 'HIGH': return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
      case 'MEDIUM': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'LOW': return 'bg-slate-500/10 text-slate-600 border-slate-500/20';
      default: return 'bg-slate-500/10 text-slate-600 border-slate-500/20';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
      case 'ASSIGNED':
        return <span className="px-2 py-1 bg-amber-500/10 text-amber-600 border border-amber-500/20 rounded-full font-mono text-[10px] uppercase tracking-wider font-bold">Pending</span>;
      case 'IN_PROGRESS':
        return <span className="px-2 py-1 bg-blue-500/10 text-blue-600 border border-blue-500/20 rounded-full font-mono text-[10px] uppercase tracking-wider font-bold">Proses</span>;
      case 'COMPLETED':
        return <span className="px-2 py-1 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 rounded-full font-mono text-[10px] uppercase tracking-wider font-bold">Selesai</span>;
      default:
        return <span className="px-2 py-1 bg-slate-500/10 text-slate-600 border border-slate-500/20 rounded-full font-mono text-[10px] uppercase tracking-wider font-bold">{status}</span>;
    }
  };

  return (
    <div className="p-4 lg:p-8 w-full max-w-7xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-[var(--radius-lg)] border border-[var(--color-rule)] shadow-sm">
        <div>
          <h1 className="text-2xl font-display font-bold text-[var(--color-focus)] flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6" />
            Surat Tugas
          </h1>
          <p className="text-sm text-[var(--color-muted)] mt-1">Daftar tugas instalasi dan pemeliharaan</p>
        </div>
        
        <div className="w-full md:w-auto flex flex-col sm:flex-row gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Cari pelanggan..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[var(--color-focus)] focus:ring-1 focus:ring-[var(--color-focus)]/20 transition-all font-mono"
            />
          </div>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--color-focus)]" />
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white p-12 rounded-[var(--radius-lg)] border border-[var(--color-rule)] text-center flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-4 border border-gray-100">
            <CheckCircle2 className="w-8 h-8 text-gray-300" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 font-display">Tidak ada Surat Tugas</h3>
          <p className="text-sm text-gray-500 mt-1 max-w-sm">Anda belum memiliki jadwal pekerjaan hari ini, atau pencarian Anda tidak ditemukan.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredOrders.map((wo) => (
            <div
              key={wo.id}
              onClick={() => router.push(`/technician/work-orders/${wo.id}`)}
              className="bg-white border border-[var(--color-rule)] rounded-[var(--radius-lg)] p-5 hover:border-[var(--color-focus)]/40 hover:shadow-lg transition-all cursor-pointer group flex flex-col"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex gap-2 items-center">
                  {getStatusBadge(wo.status)}
                  <span className={cn('px-2 py-1 rounded-full font-mono text-[10px] uppercase tracking-wider font-bold border', getPriorityColor(wo.priority))}>
                    {wo.priority}
                  </span>
                </div>
                <div className="text-[10px] font-mono text-[var(--color-muted)] bg-gray-50 px-2 py-1 rounded border border-gray-100">
                  {wo.issueType.replace('_', ' ')}
                </div>
              </div>

              <div className="mb-4 flex-1">
                <h3 className="text-lg font-bold font-display text-[var(--color-ink)] group-hover:text-[var(--color-focus)] transition-colors line-clamp-1">
                  {wo.customerName}
                </h3>
                <div className="mt-3 space-y-2 text-sm text-[var(--color-ink-2)]">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                    <span className="line-clamp-2 leading-relaxed">{wo.customerAddress}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-gray-400 shrink-0" />
                    <span className="font-mono">{wo.customerPhone}</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-[var(--color-rule)] flex justify-between items-center mt-auto">
                <div className="text-xs text-[var(--color-muted)] flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  {wo.technician?.name || 'Belum Diambil'}
                </div>
                <button className="text-[10px] font-mono font-bold text-[var(--color-focus)] bg-[var(--color-focus)]/5 hover:bg-[var(--color-focus)]/10 px-3 py-1.5 rounded uppercase tracking-wider transition-colors">
                  Detail →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
