'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Globe,
  ExternalLink,
  Copy,
  Check,
  RotateCw,
  Zap,
  Shield,
  Clock,
  Trash2,
  Search,
  Server,
  Activity,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Users,
} from 'lucide-react';
import { showSuccess, showError, showConfirm } from '@/lib/sweetalert';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface OntRemoteSessionItem {
  id: string;
  customerId: string | null;
  customerName: string;
  username: string;
  routerName: string;
  targetIp: string;
  targetPort: number;
  proxyPort: number;
  proxyUrl: string;
  status: 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'CLOSED' | 'FAILED';
  expiresAt: string;
  remainingSeconds: number;
  isExpired: boolean;
  createdAt: string;
}

export default function OntRemoteMonitoringPage() {
  const [sessions, setSessions] = useState<OntRemoteSessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [closingAll, setClosingAll] = useState(false);

  const fetchSessions = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const res = await fetch('/api/network/ont-remote');
      const data = await res.json();
      if (res.ok && data.sessions) {
        setSessions(data.sessions);
      }
    } catch (err) {
      console.error('Failed to fetch ONT remote sessions:', err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(() => {
      fetchSessions(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchSessions]);

  // Live countdown decrement ticker every 1 second
  useEffect(() => {
    const timer = setInterval(() => {
      setSessions((prev) =>
        prev.map((s) => {
          if (s.status !== 'ACTIVE' || s.remainingSeconds <= 0) return s;
          const nextSec = s.remainingSeconds - 1;
          return {
            ...s,
            remainingSeconds: Math.max(0, nextSec),
            status: nextSec <= 0 ? 'EXPIRED' : s.status,
            isExpired: nextSec <= 0,
          };
        })
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleCopy = (id: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    showSuccess('Link remote ONT disalin ke clipboard');
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleCloseSession = async (sessionItem: OntRemoteSessionItem) => {
    const confirmed = await showConfirm(
      'Tutup Sesi Remote ONT?',
      `Sesi remote untuk ${sessionItem.customerName} (Port ${sessionItem.proxyPort}) akan dinonaktifkan dan aturan NAT MikroTik akan dihapus.`
    );
    if (!confirmed) return;

    setClosingId(sessionItem.id);
    try {
      const res = await fetch(`/api/network/ont-remote?id=${sessionItem.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showSuccess('Sesi remote ONT berhasil ditutup & aturan NAT MikroTik dihapus');
        fetchSessions(true);
      } else {
        showError(data.error || 'Gagal menutup sesi remote ONT');
      }
    } catch (err: any) {
      showError(err?.message || 'Terjadi kesalahan sistem');
    } finally {
      setClosingId(null);
    }
  };

  const handleCloseAllSessions = async () => {
    const activeCount = sessions.filter((s) => s.status === 'ACTIVE').length;
    if (activeCount === 0) {
      showError('Tidak ada sesi remote ONT aktif yang sedang berjalan');
      return;
    }

    const confirmed = await showConfirm(
      'Tutup Semua Sesi Remote ONT Aktif?',
      `Tindakan ini akan menutup ${activeCount} sesi aktif dan membersihkan seluruh aturan NAT di MikroTik sekaligus.`
    );
    if (!confirmed) return;

    setClosingAll(true);
    try {
      const res = await fetch('/api/network/ont-remote?id=all', {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showSuccess(data.message || 'Semua sesi remote ONT berhasil ditutup');
        fetchSessions(true);
      } else {
        showError(data.error || 'Gagal menutup semua sesi');
      }
    } catch (err: any) {
      showError(err?.message || 'Terjadi kesalahan sistem');
    } finally {
      setClosingAll(false);
    }
  };

  const formatRemainingTime = (seconds: number) => {
    if (seconds <= 0) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Filtered list
  const filteredSessions = sessions.filter((s) => {
    const matchSearch =
      !search ||
      s.customerName.toLowerCase().includes(search.toLowerCase()) ||
      s.username.toLowerCase().includes(search.toLowerCase()) ||
      s.targetIp.includes(search) ||
      String(s.proxyPort).includes(search) ||
      s.routerName.toLowerCase().includes(search.toLowerCase());

    const matchStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ACTIVE' && s.status === 'ACTIVE' && s.remainingSeconds > 0) ||
      (statusFilter === 'EXPIRED' && (s.status === 'EXPIRED' || (s.status === 'ACTIVE' && s.remainingSeconds <= 0))) ||
      (statusFilter === 'CLOSED' && s.status === 'CLOSED');

    return matchSearch && matchStatus;
  });

  const activeCount = sessions.filter((s) => s.status === 'ACTIVE' && s.remainingSeconds > 0).length;
  const expiredCount = sessions.filter((s) => s.status === 'EXPIRED' || (s.status === 'ACTIVE' && s.remainingSeconds <= 0)).length;
  const closedCount = sessions.filter((s) => s.status === 'CLOSED').length;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Globe className="w-6 h-6 text-primary" />
              Monitoring Remote Web GUI ONT
            </h1>
            <Badge variant="outline" className="text-xs border-primary/40 text-primary">
              Proxy Port Forwarding
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Pantau dan kelola sesi akses remote Web GUI modem ONT pelanggan secara langsung dan terisolasi.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchSessions()}
            disabled={loading}
            className="flex items-center gap-1.5"
          >
            <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          {activeCount > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleCloseAllSessions}
              disabled={closingAll}
              className="flex items-center gap-1.5 shadow-sm"
            >
              <Trash2 className="w-4 h-4" />
              {closingAll ? 'Menutup Semua...' : `Tutup Semua Sesi (${activeCount})`}
            </Button>
          )}

          <Button asChild size="sm" className="flex items-center gap-1.5">
            <Link href="/admin/sessions/pppoe">
              <Users className="w-4 h-4" />
              Buka dari Sesi PPPoE
            </Link>
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card
          className={`cursor-pointer transition-all hover:border-primary/50 ${statusFilter === 'ACTIVE' ? 'ring-2 ring-primary/40' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'ACTIVE' ? 'ALL' : 'ACTIVE')}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Sesi Aktif Berjalan</p>
              <h3 className="text-2xl font-bold text-emerald-500 mt-1">{activeCount}</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Tunnel & NAT MikroTik sedang aktif</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
              <Activity className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all hover:border-primary/50 ${statusFilter === 'EXPIRED' ? 'ring-2 ring-primary/40' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'EXPIRED' ? 'ALL' : 'EXPIRED')}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Sesi Habis Waktu (Expired)</p>
              <h3 className="text-2xl font-bold text-amber-500 mt-1">{expiredCount}</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Melewati batas waktu 15 menit</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
              <Clock className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all hover:border-primary/50 ${statusFilter === 'CLOSED' ? 'ring-2 ring-primary/40' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'CLOSED' ? 'ALL' : 'CLOSED')}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Sesi Ditutup Admin</p>
              <h3 className="text-2xl font-bold text-muted-foreground mt-1">{closedCount}</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">NAT & proxy telah dibersihkan</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-muted border border-border flex items-center justify-center text-muted-foreground">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="border-border bg-card">
        <CardContent className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Cari pelanggan, username, IP, port..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-sm"
            />
          </div>

          <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto">
            {['ALL', 'ACTIVE', 'EXPIRED', 'CLOSED'].map((st) => (
              <Button
                key={st}
                variant={statusFilter === st ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter(st)}
                className="text-xs font-medium whitespace-nowrap"
              >
                {st === 'ALL' && 'Semua Sesi'}
                {st === 'ACTIVE' && `Aktif (${activeCount})`}
                {st === 'EXPIRED' && `Expired (${expiredCount})`}
                {st === 'CLOSED' && `Ditutup (${closedCount})`}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/40 border-b border-border">
              <tr>
                <th className="px-4 py-3 font-semibold">Pelanggan</th>
                <th className="px-4 py-3 font-semibold">Target Modem (ONT)</th>
                <th className="px-4 py-3 font-semibold">Router NAS</th>
                <th className="px-4 py-3 font-semibold">URL Akses Publik</th>
                <th className="px-4 py-3 font-semibold text-center">Sisa Waktu</th>
                <th className="px-4 py-3 font-semibold text-center">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && sessions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    <RotateCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                    Memuat data sesi remote ONT...
                  </td>
                </tr>
              ) : filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    <Globe className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                    Tidak ada sesi remote ONT yang sesuai filter.
                  </td>
                </tr>
              ) : (
                filteredSessions.map((s) => {
                  const isActive = s.status === 'ACTIVE' && s.remainingSeconds > 0;
                  const isClosing = closingId === s.id;

                  return (
                    <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-foreground">{s.customerName}</div>
                        <div className="text-xs font-mono text-muted-foreground">{s.username}</div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="font-mono text-xs font-semibold text-foreground flex items-center gap-1.5">
                          <Server className="w-3.5 h-3.5 text-primary" />
                          {s.targetIp}:{s.targetPort}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <span className="text-xs text-muted-foreground">{s.routerName}</span>
                      </td>

                      <td className="px-4 py-3">
                        {isActive ? (
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-medium text-primary underline underline-offset-2 break-all">
                              {s.proxyUrl}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0"
                              onClick={() => handleCopy(s.id, s.proxyUrl)}
                              title="Salin URL"
                            >
                              {copiedId === s.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                            </Button>
                            <Button
                              asChild
                              variant="default"
                              size="sm"
                              className="h-7 text-xs px-2.5 shrink-0 flex items-center gap-1"
                            >
                              <a href={s.proxyUrl} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="w-3.5 h-3.5" />
                                Buka
                              </a>
                            </Button>
                          </div>
                        ) : (
                          <span className="font-mono text-xs text-muted-foreground/60">
                            Port {s.proxyPort} (Nonaktif)
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-center">
                        {isActive ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-xs font-bold border border-emerald-500/20">
                            <Clock className="w-3.5 h-3.5 animate-pulse" />
                            {formatRemainingTime(s.remainingSeconds)}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-center">
                        {isActive ? (
                          <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/30 text-xs">
                            Aktif
                          </Badge>
                        ) : s.status === 'EXPIRED' || s.remainingSeconds <= 0 ? (
                          <Badge variant="outline" className="text-amber-500 border-amber-500/30 text-xs">
                            Expired
                          </Badge>
                        ) : s.status === 'FAILED' ? (
                          <Badge variant="destructive" className="text-xs">
                            Gagal
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            Ditutup
                          </Badge>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right">
                        {isActive && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleCloseSession(s)}
                            disabled={isClosing}
                            className="h-8 text-xs flex items-center gap-1.5 ml-auto"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            {isClosing ? 'Menutup...' : 'Tutup Sesi'}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

