'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '@/hooks/useTranslation';
import { useToast } from '@/components/cyberpunk/CyberToast';
import { formatWIB } from '@/lib/timezone';
import { cn } from '@/lib/utils';
import { Calendar, Filter, RefreshCcw, Search, CheckCircle2, XCircle, Activity, MessageSquare } from 'lucide-react';

interface HistoryItem {
  id: string;
  phone: string;
  message: string;
  status: 'sent' | 'failed';
  response: string;
  providerName?: string;
  providerType?: string;
  sentAt: string;
}

interface Stats {
  total: number;
  sent: number;
  failed: number;
  last24Hours: number;
  period: string;
}

const getProviderColor = (type?: string) => {
  switch (type?.toLowerCase()) {
    case 'mpwa': return 'bg-primary/20 text-primary dark:text-primary';
    case 'waha': return 'bg-success/20 text-success dark:bg-green-900/30 dark:text-success';
    case 'fonnte': return 'bg-accent/20 text-accent dark:bg-purple-900/30 dark:text-purple-400';
    case 'wablas': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
    default: return 'bg-gray-100 text-foreground dark:bg-input dark:text-muted-foreground';
  }
};

export default function WhatsAppHistoryPage() {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, sent: 0, failed: 0, last24Hours: 0, period: '24h' });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState<'24h' | '7d' | '30d' | 'all'>('24h');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewingItem, setViewingItem] = useState<HistoryItem | null>(null);

  useEffect(() => {
    fetchHistory();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter, periodFilter]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        status: statusFilter,
        period: periodFilter,
        search: searchQuery,
      });

      const res = await fetch(`/api/whatsapp/history?${params}`);
      const data = await res.json();

      if (data.success) {
        setHistory(data.data);
        setStats(data.stats);
        setTotalPages(data.pagination.totalPages);
      } else {
        addToast({ type: 'error', title: t('common.error'), description: t('whatsapp.failedLoadHistory') });
      }
    } catch (error) {
      console.error('Fetch history error:', error);
      addToast({ type: 'error', title: t('common.error'), description: t('whatsapp.failedLoadHistory') });
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    fetchHistory();
  };

  function WaDetailModal() {
    if (!viewingItem) return null;
    let responseData;
    try { responseData = JSON.parse(viewingItem.response); } catch { responseData = viewingItem.response; }
    return createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setViewingItem(null)}>
        <div className="bg-card border border-border rounded-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between p-5 border-b border-border">
            <h2 className="text-base font-bold text-foreground">{t('whatsapp.messageDetail')}</h2>
            <button onClick={() => setViewingItem(null)} className="text-muted-foreground hover:text-foreground text-xl leading-none">&times;</button>
          </div>
          <div className="p-5 overflow-y-auto flex-1 space-y-3 text-xs">
            <div className="flex gap-2"><span className="font-semibold text-muted-foreground min-w-[90px]">{t('whatsapp.numberLabel')}:</span><span className="text-foreground font-mono font-bold">{viewingItem.phone}</span></div>
            <div className="flex gap-2"><span className="font-semibold text-muted-foreground min-w-[90px]">{t('whatsapp.statusLabel')}:</span><span className={viewingItem.status === 'sent' ? 'text-emerald-500 font-bold' : 'text-rose-500 font-bold'}>{viewingItem.status === 'sent' ? `✅ ${t('whatsapp.sentStatus')}` : `❌ ${t('whatsapp.failedStatus')}`}</span></div>
            {viewingItem.providerName && <div className="flex gap-2"><span className="font-semibold text-muted-foreground min-w-[90px]">{t('whatsapp.providerLabel')}:</span><span className="text-foreground">{viewingItem.providerName} <span className="text-primary font-mono">({viewingItem.providerType?.toUpperCase()})</span></span></div>}
            <div className="flex gap-2"><span className="font-semibold text-muted-foreground min-w-[90px]">{t('whatsapp.timeLabel')}:</span><span className="text-foreground font-mono">{formatWIB(viewingItem.sentAt, 'dd/MM/yyyy HH:mm:ss')}</span></div>
            <div className="mt-4"><div className="font-semibold text-muted-foreground mb-1">{t('whatsapp.messageLabel')}:</div><div className="whitespace-pre-wrap bg-muted/50 border border-border p-3 rounded-lg text-xs max-h-36 overflow-auto text-foreground font-mono">{viewingItem.message}</div></div>
            <div className="mt-4"><div className="font-semibold text-muted-foreground mb-1">{t('whatsapp.responseLabel')}:</div><pre className="text-[11px] bg-muted/50 border border-border p-3 rounded-lg max-h-40 overflow-auto text-foreground font-mono">{JSON.stringify(responseData, null, 2)}</pre></div>
          </div>
          <div className="p-4 border-t border-border flex justify-end">
            <button onClick={() => setViewingItem(null)} className="px-5 py-2 text-xs font-bold text-primary-foreground bg-primary rounded-lg hover:opacity-90 transition-all">{t('common.close')}</button>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  const periodLabel = periodFilter === '24h' ? '24 Jam' : periodFilter === '7d' ? '7 Hari' : periodFilter === '30d' ? '30 Hari' : 'Semua Waktu';

  return (
    <>
      <WaDetailModal />
      <div className="bg-background min-h-screen p-4 md:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
              <MessageSquare className="w-6 h-6 text-primary" />
              {t('whatsapp.historyTitle')}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">{t('whatsapp.historySubtitle')}</p>
          </div>
          <button onClick={fetchHistory} disabled={loading} className="px-3 py-1.5 text-xs bg-card border border-border hover:bg-muted rounded-xl flex items-center gap-1.5 font-bold transition-all self-start sm:self-auto">
            <RefreshCcw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            {t('common.refresh')}
          </button>
        </div>

        {/* Date Filter Pills */}
        <div className="flex items-center gap-2 bg-card p-2 rounded-xl border border-border overflow-x-auto">
          <span className="text-xs font-bold text-muted-foreground flex items-center gap-1 shrink-0 px-1">
            <Calendar className="w-3.5 h-3.5 text-primary" /> Periode Log:
          </span>
          {[
            { id: '24h', label: '24 Jam Terakhir' },
            { id: '7d', label: '7 Hari Terakhir' },
            { id: '30d', label: '30 Hari Terakhir' },
            { id: 'all', label: 'Semua Waktu' },
          ].map(p => (
            <button
              key={p.id}
              onClick={() => { setPeriodFilter(p.id as any); setPage(1); }}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-bold transition-all border shrink-0',
                periodFilter === p.id
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                  : 'bg-background text-muted-foreground border-border hover:bg-muted'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Dynamic Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-card rounded-xl border border-border p-3 space-y-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground">Total Pesan ({periodLabel})</span>
            <div className="text-2xl font-bold text-foreground">{stats.total}</div>
          </div>
          <div className="bg-card rounded-xl border border-border p-3 space-y-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Terkirim ({periodLabel})</span>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.sent}</div>
          </div>
          <div className="bg-card rounded-xl border border-border p-3 space-y-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-rose-500">Gagal ({periodLabel})</span>
            <div className="text-2xl font-bold text-rose-500">{stats.failed}</div>
          </div>
          <div className="bg-card rounded-xl border border-border p-3 space-y-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-primary">Aktivitas (24j)</span>
            <div className="text-2xl font-bold text-primary">{stats.last24Hours}</div>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="bg-card rounded-xl border border-border p-3 space-y-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex gap-1.5 w-full sm:w-auto">
              {['all', 'sent', 'failed'].map((status) => (
                <button
                  key={status}
                  onClick={() => { setStatusFilter(status); setPage(1); }}
                  className={cn(
                    'px-3 py-1.5 text-xs font-bold rounded-lg transition-all border',
                    statusFilter === status
                      ? status === 'sent' ? 'bg-emerald-600 text-white border-emerald-600' : status === 'failed' ? 'bg-rose-500 text-white border-rose-500' : 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-muted-foreground border-border hover:bg-muted'
                  )}
                >
                  {status === 'all' ? t('common.all') : status === 'sent' ? `✓ Terkirim` : `✗ Gagal`}
                </button>
              ))}
            </div>

            <div className="flex gap-2 w-full sm:w-72">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder={t('whatsapp.searchPhoneMessage')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-background border border-input rounded-xl focus:ring-2 focus:ring-primary outline-none font-mono"
                />
              </div>
              <button
                onClick={handleSearch}
                className="px-3 py-1.5 bg-primary text-primary-foreground font-bold text-xs rounded-xl shadow hover:opacity-90 transition-opacity"
              >
                Cari
              </button>
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase font-mono text-[10px]">
                <tr>
                  <th className="p-3">Waktu</th>
                  <th className="p-3">No. Tujuan</th>
                  <th className="p-3">Pesan</th>
                  <th className="p-3">Provider</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground font-bold">
                      <RefreshCcw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                      Memuat riwayat pengiriman...
                    </td>
                  </tr>
                ) : history.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground font-bold">
                      Tidak ada riwayat pengiriman WhatsApp pada periode ini
                    </td>
                  </tr>
                ) : (
                  history.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/40 transition-colors">
                      <td className="p-3 font-mono text-[11px] text-muted-foreground shrink-0">
                        {formatWIB(item.sentAt, 'dd/MM/yyyy HH:mm')}
                      </td>
                      <td className="p-3 font-mono font-bold text-primary">{item.phone}</td>
                      <td className="p-3 max-w-xs font-mono text-[11px] truncate text-foreground">{item.message}</td>
                      <td className="p-3">
                        <span className={cn('px-2 py-0.5 rounded text-[10px] font-mono font-bold', getProviderColor(item.providerType))}>
                          {item.providerName || item.providerType || 'Baileys'}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span className={cn('inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold border',
                          item.status === 'sent' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' : 'bg-rose-500/10 text-rose-500 border-rose-500/30'
                        )}>
                          {item.status === 'sent' ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          {item.status === 'sent' ? 'Terkirim' : 'Gagal'}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => setViewingItem(item)}
                          className="px-2.5 py-1 bg-muted border border-border rounded-lg text-[10px] font-bold text-foreground hover:bg-muted/80 transition-colors"
                        >
                          Rincian
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="p-3 border-t border-border flex items-center justify-between gap-2 text-xs">
            <span className="text-muted-foreground">Halaman {page} dari {totalPages}</span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 border border-border rounded-lg font-bold text-xs disabled:opacity-50"
              >
                Sebelumnya
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || totalPages === 0}
                className="px-3 py-1 border border-border rounded-lg font-bold text-xs disabled:opacity-50"
              >
                Selanjutnya
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
