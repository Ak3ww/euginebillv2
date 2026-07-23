'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  Power, RefreshCw, Wifi, Search, Download, Trash2, RotateCcw, 
  ArrowUpDown, Filter, Router as RouterIcon, ShieldAlert, CheckCircle2, User, Globe, ExternalLink
} from 'lucide-react';
import { useToast } from '@/components/cyberpunk/CyberToast';
import { useTranslation } from '@/hooks/useTranslation';
import { formatWIB } from '@/lib/timezone';
import { cn } from '@/lib/utils';

interface Session {
  id: string;
  username: string;
  sessionId: string;
  type: 'pppoe' | 'hotspot';
  nasIpAddress: string;
  framedIpAddress: string;
  macAddress: string;
  startTime: string;
  lastUpdate: string | null;
  duration: number;
  upload?: number;
  download?: number;
  durationFormatted: string;
  uploadFormatted: string;
  downloadFormatted: string;
  totalFormatted: string;
  router: { id: string; name: string } | null;
  user: { 
    id: string; 
    customerId: string;
    name: string; 
    phone: string; 
    profile: string;
    area?: { id: string; name: string } | null;
  } | null;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface Stats {
  total: number;
  pppoe: number;
  hotspot: number;
  totalBandwidthFormatted: string;
  totalUploadFormatted: string;
  totalDownloadFormatted: string;
}

interface Router {
  id: string;
  name: string;
}

export default function PPPoESessionsPage() {
  const { t } = useTranslation();
  const { addToast, confirm } = useToast();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [routers, setRouters] = useState<Router[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
  const [disconnecting, setDisconnecting] = useState(false);
  const [routerFilter, setRouterFilter] = useState<string>('');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [pagination, setPagination] = useState<Pagination>({ total: 0, page: 1, limit: 25, totalPages: 1 });
  const [pageSize, setPageSize] = useState<number>(25);
  const [now, setNow] = useState(() => Date.now());
  const [fetchedAt, setFetchedAt] = useState(() => Date.now());
  const [syncing, setSyncing] = useState(false);

  // Sorting state
  const [sortField, setSortField] = useState<string>('startTime');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // 1-second ticker for live uptime counter
  useEffect(() => {
    const ticker = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(ticker);
  }, []);

  const liveDuration = (serverDuration: number) => {
    const elapsed = Math.floor((now - fetchedAt) / 1000);
    return serverDuration + elapsed;
  };

  const fetchSessions = useCallback(async (page: number = 1) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', pageSize.toString());
      params.set('type', 'pppoe');
      params.set('live', 'true');
      if (routerFilter) params.set('routerId', routerFilter);
      if (searchFilter) params.set('search', searchFilter);

      const res = await fetch(`/api/sessions?${params}`);
      const data = await res.json();
      setSessions(data.sessions || []);
      setFetchedAt(Date.now());
      setStats(data.stats);
      if (data.pagination) {
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    } finally {
      setLoading(false);
    }
  }, [pageSize, routerFilter, searchFilter]);

  const fetchRouters = async () => {
    try {
      const res = await fetch('/api/network/routers');
      const data = await res.json();
      setRouters(data.routers || []);
    } catch (error) {
      console.error('Failed to fetch routers:', error);
    }
  };

  useEffect(() => {
    fetchRouters();
  }, []);

  useEffect(() => {
    fetchSessions(1);
    const interval = setInterval(() => {
      fetchSessions(pagination.page);
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchSessions, pagination.page]);

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return formatWIB(dateStr, 'dd/MM/yyyy HH:mm');
  };

  const formatUptime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(['startTime', 'duration', 'upload', 'download'].includes(field) ? 'desc' : 'asc');
    }
  };

  const sortedSessions = useMemo(() => {
    return [...sessions].sort((a, b) => {
      let valA: any = '';
      let valB: any = '';

      switch (sortField) {
        case 'customerId':
          valA = a.user?.customerId || '';
          valB = b.user?.customerId || '';
          break;
        case 'name':
          valA = (a.user?.name || '').toLowerCase();
          valB = (b.user?.name || '').toLowerCase();
          break;
        case 'username':
          valA = (a.username || '').toLowerCase();
          valB = (b.username || '').toLowerCase();
          break;
        case 'startTime':
          valA = new Date(a.startTime).getTime();
          valB = new Date(b.startTime).getTime();
          break;
        case 'duration':
          valA = liveDuration(a.duration);
          valB = liveDuration(b.duration);
          break;
        case 'upload':
          valA = a.upload || 0;
          valB = b.upload || 0;
          break;
        case 'download':
          valA = a.download || 0;
          valB = b.download || 0;
          break;
        case 'router':
          valA = (a.router?.name || '').toLowerCase();
          valB = (b.router?.name || '').toLowerCase();
          break;
        case 'ip':
          valA = a.framedIpAddress || '';
          valB = b.framedIpAddress || '';
          break;
        case 'mac':
          valA = a.macAddress || '';
          valB = b.macAddress || '';
          break;
        default:
          valA = new Date(a.startTime).getTime();
          valB = new Date(b.startTime).getTime();
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [sessions, sortField, sortDirection, now, fetchedAt]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedSessions(new Set(sessions.map(s => s.sessionId)));
    } else {
      setSelectedSessions(new Set());
    }
  };

  const handleSelectSession = (sessionId: string, checked: boolean) => {
    const newSelected = new Set(selectedSessions);
    if (checked) {
      newSelected.add(sessionId);
    } else {
      newSelected.delete(sessionId);
    }
    setSelectedSessions(newSelected);
  };

  const handleDisconnect = async (sessionIds: string[]) => {
    if (sessionIds.length === 0) return;
    
    if (!await confirm({
      title: t('sessions.kickUser'),
      message: t('sessions.disconnectPppoeConfirm').replace('{count}', String(sessionIds.length)),
      confirmText: t('sessions.yesKick'),
      cancelText: t('common.cancel'),
      variant: 'danger',
    })) return;

    setDisconnecting(true);
    try {
      const res = await fetch('/api/sessions/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionIds })
      });
      const data = await res.json();
      if (data.success) {
        addToast({ type: 'success', title: t('common.success'), description: t('sessions.sessionsDisconnected').replace('{count}', data.disconnected) });
        setSelectedSessions(new Set());
        fetchSessions(pagination.page);
      } else {
        addToast({ type: 'error', title: t('common.error'), description: data.error || t('sessions.failedDisconnect') });
      }
    } catch {
      addToast({ type: 'error', title: t('common.error'), description: t('sessions.failedDisconnectSession') });
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/sessions/sync?type=pppoe', { method: 'POST' });
      const data = await res.json();
      await fetchSessions(1);
      
      if (data.results?.pppoe?.success === false) {
        const errorResult = data.results.pppoe.results?.find((r: any) => !r.success);
        const errMsg = errorResult ? errorResult.error : 'Connection failed';
        addToast({ type: 'error', title: t('common.error'), description: `Gagal terhubung ke MikroTik: ${errMsg}` });
      } else {
        addToast({ type: 'success', title: t('common.success'), description: t('sessions.syncComplete') });
      }
    } catch {
      addToast({ type: 'error', title: t('common.error'), description: t('sessions.syncFailed') });
    } finally {
      setSyncing(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      const params = new URLSearchParams();
      params.set('format', 'excel');
      params.set('mode', 'active');
      params.set('type', 'pppoe');
      if (routerFilter) params.set('routerId', routerFilter);
      if (searchFilter) params.set('username', searchFilter);
      const res = await fetch(`/api/sessions/export?${params}`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Sessions-PPPoE-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch {
      addToast({ type: 'error', title: 'Error', description: t('sessions.exportFailed') });
    }
  };

  const SortHeader = ({ label, field }: { label: string; field: string }) => (
    <th 
      onClick={() => handleSort(field)}
      className="px-3 py-2.5 text-left text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground select-none group"
    >
      <div className="flex items-center gap-1">
        <span>{label}</span>
        <ArrowUpDown className={cn(
          "w-3 h-3 transition-colors", 
          sortField === field ? "text-primary opacity-100 font-bold" : "opacity-40 group-hover:opacity-100"
        )} />
      </div>
    </th>
  );

  return (
    <div className="bg-background relative min-h-screen p-4 md:p-8 space-y-6">
      
      {/* Background Glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 space-y-6 max-w-7xl mx-auto">
        
        {/* Header & Main Actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card border border-border rounded-2xl p-6 shadow-sm">
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-primary">Monitoring Real-Time</span>
            <h1 className="text-2xl font-bold font-display text-foreground mt-0.5 flex items-center gap-2">
              <Wifi className="w-6 h-6 text-primary" />
              Monitoring Sesi PPPoE Online
            </h1>
            <p className="text-xs text-muted-foreground mt-1">Pantau sesi aktif, filter per MikroTik router, dan kelola koneksi pelanggan.</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleExportExcel}
              className="px-3.5 py-2 text-xs font-bold bg-muted hover:bg-muted/80 text-foreground rounded-xl flex items-center gap-2 border border-border transition-colors"
            >
              <Download className="w-4 h-4 text-primary" /> Export Excel
            </button>

            <button
              onClick={handleSync}
              disabled={syncing}
              className="px-3.5 py-2 text-xs font-bold bg-primary/10 text-primary hover:bg-primary/20 rounded-xl flex items-center gap-2 border border-primary/20 disabled:opacity-50 transition-colors"
            >
              <RotateCcw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Sinkronisasi...' : 'Sync Sesi Real-Time'}
            </button>

            {selectedSessions.size > 0 && (
              <button
                onClick={() => handleDisconnect(Array.from(selectedSessions))}
                disabled={disconnecting}
                className="px-3.5 py-2 text-xs font-bold bg-destructive text-destructive-foreground hover:opacity-90 rounded-xl flex items-center gap-2 shadow-md transition-opacity"
              >
                <Power className="w-4 h-4" /> Putuskan ({selectedSessions.size}) Sesi
              </button>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground">Total Sesi PPPoE Aktif</span>
            <p className="text-2xl font-bold font-display text-primary mt-1 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              {stats?.pppoe || 0} Koneksi
            </p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground">Total Live Upload (TX)</span>
            <p className="text-2xl font-bold font-display text-foreground mt-1">↑ {stats?.totalUploadFormatted || '0 B'}</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground">Total Live Download (RX)</span>
            <p className="text-2xl font-bold font-display text-foreground mt-1">↓ {stats?.totalDownloadFormatted || '0 B'}</p>
          </div>
        </div>

        {/* Filters & Table Control Bar */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
          
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Router MikroTik Filter Dropdown */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <RouterIcon className="w-4 h-4 text-primary shrink-0" />
              <select
                value={routerFilter}
                onChange={(e) => {
                  setRouterFilter(e.target.value);
                  fetchSessions(1);
                }}
                className="w-full sm:w-60 p-2 bg-background border border-input rounded-xl text-xs font-mono font-bold text-foreground focus:ring-2 focus:ring-primary outline-none"
              >
                <option value="">-- Semua Router MikroTik Site --</option>
                {routers.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>

            {/* Search Input (Name, Username, IP, MAC) */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Cari nama, user, IP, MAC..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-background border border-input rounded-xl text-xs font-mono focus:ring-2 focus:ring-primary outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground self-end md:self-center">
            <span>Tampilkan</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="px-2.5 py-1 bg-background border border-input rounded-lg text-xs font-bold text-foreground focus:ring-2 focus:ring-primary outline-none"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>data per halaman</span>
          </div>
        </div>

        {/* Table View */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          
          {/* Desktop Table View */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/60 border-b border-border">
                <tr>
                  <th className="px-3 py-3 text-left w-10">
                    <input
                      type="checkbox"
                      checked={selectedSessions.size === sortedSessions.length && sortedSessions.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded border-border w-3.5 h-3.5"
                    />
                  </th>
                  <SortHeader label="ID Pelanggan" field="customerId" />
                  <SortHeader label="Nama Pelanggan" field="name" />
                  <SortHeader label="Username PPPoE" field="username" />
                  <SortHeader label="Waktu Terhubung" field="startTime" />
                  <SortHeader label="Uptime Live" field="duration" />
                  <SortHeader label="Upload (TX)" field="upload" />
                  <SortHeader label="Download (RX)" field="download" />
                  <SortHeader label="Router Site" field="router" />
                  <SortHeader label="IP Address" field="ip" />
                  <SortHeader label="MAC Address" field="mac" />
                  <th className="px-3 py-3 text-center text-[10px] font-mono font-bold text-muted-foreground uppercase">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading && sortedSessions.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-3 py-12 text-center text-muted-foreground">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto text-primary mb-2" />
                      Memuat data sesi real-time...
                    </td>
                  </tr>
                ) : sortedSessions.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-3 py-12 text-center text-muted-foreground">
                      <Wifi className="w-8 h-8 mx-auto opacity-40 mb-2" />
                      Tidak ada sesi PPPoE online yang sesuai filter.
                    </td>
                  </tr>
                ) : (
                  sortedSessions.map((session) => (
                    <tr key={session.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={selectedSessions.has(session.sessionId)}
                          onChange={(e) => handleSelectSession(session.sessionId, e.target.checked)}
                          className="rounded border-border w-3.5 h-3.5"
                        />
                      </td>
                      <td className="px-3 py-3 font-mono text-[11px] font-bold text-primary">
                        {session.user?.id ? (
                          <a 
                            href={`/admin/pppoe/users/${session.user.customerId || session.user.id}`}
                            className="hover:underline text-primary font-bold"
                          >
                            {session.user.customerId || '-'}
                          </a>
                        ) : (
                          session.user?.customerId || '-'
                        )}
                      </td>
                      <td className="px-3 py-3 font-bold text-foreground">
                        {session.user?.id ? (
                          <a 
                            href={`/admin/pppoe/users/${session.user.customerId || session.user.id}`}
                            className="hover:underline text-foreground hover:text-primary transition-colors inline-flex items-center gap-1 font-bold group"
                            title="Lihat Profil Detail Pelanggan"
                          >
                            <span>{session.user.name}</span>
                            <ExternalLink className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors" />
                          </a>
                        ) : (
                          session.user?.name || '-'
                        )}
                      </td>
                      <td className="px-3 py-3 font-mono text-[11px] text-foreground">
                        {session.username}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">
                        {formatDateTime(session.startTime)}
                      </td>
                      <td className="px-3 py-3 font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        {formatUptime(liveDuration(session.duration))}
                      </td>
                      <td className="px-3 py-3 font-mono text-blue-600 dark:text-blue-400 whitespace-nowrap">
                        ↑ {session.uploadFormatted}
                      </td>
                      <td className="px-3 py-3 font-mono text-purple-600 dark:text-purple-400 whitespace-nowrap">
                        ↓ {session.downloadFormatted}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="px-2.5 py-1 bg-primary/10 text-primary border border-primary/20 rounded-full text-[10px] font-mono font-bold uppercase">
                          {session.router?.name || 'Default Router'}
                        </span>
                      </td>
                      <td className="px-3 py-3 font-mono text-foreground whitespace-nowrap">
                        {session.framedIpAddress || '-'}
                      </td>
                      <td className="px-3 py-3 font-mono text-[10px] text-muted-foreground whitespace-nowrap">
                        {session.macAddress || '-'}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <button
                          onClick={() => handleDisconnect([session.sessionId])}
                          disabled={disconnecting}
                          title="Putuskan Sesi PPPoE"
                          className="p-1.5 text-destructive hover:bg-destructive/10 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <Power className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="px-4 py-3 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 bg-muted/40 text-xs font-mono">
            <div className="text-muted-foreground">
              Menampilkan {((pagination.page - 1) * pageSize) + 1} - {Math.min(pagination.page * pageSize, pagination.total)} dari {pagination.total} sesi aktif
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => fetchSessions(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="px-3 py-1.5 border border-border rounded-xl disabled:opacity-50 hover:bg-muted font-bold text-foreground"
              >
                Sebelumnya
              </button>
              <span className="px-3 py-1.5 bg-primary text-primary-foreground font-bold rounded-xl">
                {pagination.page} / {pagination.totalPages || 1}
              </span>
              <button
                onClick={() => fetchSessions(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="px-3 py-1.5 border border-border rounded-xl disabled:opacity-50 hover:bg-muted font-bold text-foreground"
              >
                Selanjutnya
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
