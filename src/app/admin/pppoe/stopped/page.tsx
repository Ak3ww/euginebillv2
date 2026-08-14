'use client';

import { useState, useEffect } from 'react';
import { showSuccess, showError, showConfirm } from '@/lib/sweetalert';
import { usePermissions } from '@/hooks/usePermissions';
import { useTranslation } from '@/hooks/useTranslation';
import {
  Users, Trash2, Search, RefreshCcw, Shield, FileText, CheckCircle2,
  Wrench, Calendar, Clock, AlertTriangle, UserCheck, CheckSquare, X
} from 'lucide-react';
import { formatWIB } from '@/lib/timezone';
import { cn } from '@/lib/utils';

interface TechnicianOption {
  id: string;
  name: string;
  phoneNumber?: string;
}

interface StoppedUser {
  id: string;
  username: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  status: string;
  expiredAt: string | null;
  stoppedAt: string | null;
  createdAt: string;
  note: string | null;
  isDismantled?: boolean;
  dismantledAt?: string | null;
  dismantledNote?: string | null;
  profile: { id: string; name: string; groupName: string };
  router?: { id: string; name: string; nasname: string; ipAddress: string } | null;
  area?: { id: string; name: string } | null;
  workOrders?: {
    id: string;
    status: string;
    scheduledDate: string | null;
    technician?: { id: string; name: string; phoneNumber?: string } | null;
  }[];
}

export default function StoppedSubscriptionsPage() {
  const { hasPermission, loading: permLoading } = usePermissions();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<StoppedUser[]>([]);
  const [technicians, setTechnicians] = useState<TechnicianOption[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dismantleFilter, setDismantleFilter] = useState<'all' | 'not_dismantled' | 'spk_sent' | 'dismantled'>('all');
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Modal State for Dispatching Dismantle SPK
  const [spkModalUser, setSpkModalUser] = useState<StoppedUser | null>(null);
  const [selectedTechId, setSelectedTechId] = useState<string>('');
  const [scheduledDate, setScheduledDate] = useState<string>('');
  const [priority, setPriority] = useState<string>('MEDIUM');
  const [spkNotes, setSpkNotes] = useState<string>('');
  const [dispatching, setDispatching] = useState(false);

  useEffect(() => {
    loadData();
    loadTechnicians();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/pppoe/users?status=stop');
      const data = await res.json();
      setUsers(data.users || []);
    } catch (error) {
      console.error('Load data error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTechnicians = async () => {
    try {
      const res = await fetch('/api/admin/technicians');
      if (res.ok) {
        const data = await res.json();
        setTechnicians(data.technicians || data.data || []);
      }
    } catch { }
  };

  // Quick Direct Toggle: Mark as Dismantled without Work Order
  const handleToggleDismantle = async (user: StoppedUser) => {
    const nextStatus = !user.isDismantled;
    const confirmText = nextStatus
      ? `Tandai perangkat modem ${user.name} SUDAH DICABUT?`
      : `Batalkan status pencabutan perangkat ${user.name}?`;
    const confirmed = await showConfirm(confirmText);
    if (!confirmed) return;

    try {
      const res = await fetch('/api/admin/pppoe/dismantle', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, isDismantled: nextStatus }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await showSuccess(nextStatus ? 'Status diubah ke: Perangkat Sudah Dicabut' : 'Status pencabutan dibatalkan');
        loadData();
      } else {
        await showError(data.error || 'Gagal mengubah status');
      }
    } catch (error) {
      console.error('Toggle dismantle error:', error);
      await showError('Gagal mengubah status');
    }
  };

  // Dispatch Dismantle Work Order
  const handleCreateDismantleSPK = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!spkModalUser) return;

    setDispatching(true);
    try {
      const res = await fetch('/api/admin/pppoe/dismantle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: spkModalUser.id,
          technicianId: selectedTechId || undefined,
          scheduledDate: scheduledDate || undefined,
          priority,
          notes: spkNotes,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        await showSuccess(`SPK Cabut Perangkat berhasil ditugaskan!`);
        setSpkModalUser(null);
        setSelectedTechId('');
        setScheduledDate('');
        setSpkNotes('');
        loadData();
      } else {
        await showError(data.error || 'Gagal membuat SPK Cabut');
      }
    } catch (error) {
      console.error('Create Dismantle SPK error:', error);
      await showError('Gagal terhubung ke server');
    } finally {
      setDispatching(false);
    }
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      params.set('status', 'stop');
      params.set('format', 'excel');

      const res = await fetch(`/api/pppoe/users/export?${params.toString()}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `berhenti-langganan-${new Date().toISOString().split('T')[0]}.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
        await showSuccess(t('common.success'));
      } else {
        await showError(t('common.failed'));
      }
    } catch (error) {
      console.error('Export error:', error);
      await showError(t('common.failed'));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedUsers.size === 0) {
      await showError(t('common.selectCustomersToDelete'));
      return;
    }
    const confirmed = await showConfirm(t('common.deleteCustomersConfirm').replace('{count}', selectedUsers.size.toString()));
    if (!confirmed) return;

    try {
      const res = await fetch('/api/pppoe/users/bulk-delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: Array.from(selectedUsers) }),
      });
      const result = await res.json();
      if (res.ok) {
        await showSuccess(`${result.deleted || selectedUsers.size} ${t('pppoe.customer')} ${t('common.delete').toLowerCase()}`);
        setSelectedUsers(new Set());
        loadData();
      } else {
        await showError(result.error || t('common.failedDelete'));
      }
    } catch (error) {
      console.error('Bulk delete error:', error);
      await showError(t('common.failedDelete'));
    }
  };

  const handleReactivate = async (userId: string) => {
    const confirmed = await showConfirm(t('common.reactivateConfirm'));
    if (!confirmed) return;

    try {
      const res = await fetch('/api/pppoe/users/status', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, status: 'active' }),
      });
      const result = await res.json();
      if (res.ok) {
        await showSuccess(t('common.customerReactivated'));
        loadData();
      } else {
        await showError(result.error || t('common.failedActivate'));
      }
    } catch (error) {
      console.error('Reactivate error:', error);
      await showError(t('common.failedActivate'));
    }
  };

  const handleDelete = async (userId: string) => {
    const confirmed = await showConfirm(t('common.deleteConfirmPermanent'));
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/pppoe/users?id=${userId}`, { method: 'DELETE' });
      const result = await res.json();
      if (res.ok) {
        await showSuccess(t('common.customerDeleted'));
        loadData();
      } else {
        await showError(result.error || t('common.failedDelete'));
      }
    } catch (error) {
      console.error('Delete error:', error);
      await showError(t('common.failedDelete'));
    }
  };

  const toggleSelectUser = (userId: string) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) newSelected.delete(userId);
    else newSelected.add(userId);
    setSelectedUsers(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedUsers.size === filteredUsers.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(filteredUsers.map(u => u.id)));
    }
  };

  // Filter users
  const filteredUsers = users.filter(user => {
    const matchSearch = !searchQuery ||
      user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.phone.includes(searchQuery) ||
      user.profile.name.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchSearch) return false;

    const activeWO = user.workOrders?.[0];

    if (dismantleFilter === 'dismantled') return user.isDismantled;
    if (dismantleFilter === 'spk_sent') return !user.isDismantled && !!activeWO && activeWO.status !== 'COMPLETED';
    if (dismantleFilter === 'not_dismantled') return !user.isDismantled && (!activeWO || activeWO.status === 'CANCELLED');

    return true;
  });

  // Pagination
  const totalPages = Math.ceil(filteredUsers.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedUsers = filteredUsers.slice(startIndex, startIndex + pageSize);

  // Stats
  const totalStopped = users.length;
  const totalDismantled = users.filter(u => u.isDismantled).length;
  const totalSpkSent = users.filter(u => !u.isDismantled && u.workOrders?.[0] && u.workOrders[0].status !== 'COMPLETED').length;
  const totalPendingDismantle = totalStopped - totalDismantled - totalSpkSent;

  if (permLoading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  if (!hasPermission('customers.view')) return <div className="flex items-center justify-center h-screen text-destructive">{t('pppoe.accessDenied')}</div>;

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-rose-500/10 text-rose-500 rounded-xl border border-rose-500/20">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Berhenti Langganan &amp; Dismantle</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Kelola pelanggan stop dan status penarikan modem/ONT</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={loadData} disabled={loading} className="px-3 py-1.5 text-xs bg-card border border-border hover:bg-muted rounded-xl flex items-center gap-1.5 font-bold transition-all">
            <RefreshCcw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Segarkan
          </button>
          <button onClick={handleExport} className="px-3 py-1.5 text-xs bg-primary text-primary-foreground font-bold rounded-xl flex items-center gap-1.5 shadow-sm hover:opacity-90 transition-all">
            <FileText className="h-3.5 w-3.5" />
            Ekspor Excel
          </button>
          <button onClick={handleBulkDelete} disabled={selectedUsers.size === 0} className="px-3 py-1.5 text-xs bg-destructive text-white font-bold rounded-xl flex items-center gap-1.5 disabled:opacity-50 transition-all">
            <Trash2 className="h-3.5 w-3.5" />
            Hapus Dipilih
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-xl p-4 space-y-1">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground">Total Stop</span>
          <div className="text-2xl font-bold text-foreground">{totalStopped}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 space-y-1">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-rose-500">Belum Dicabut</span>
          <div className="text-2xl font-bold text-rose-500">{totalPendingDismantle}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 space-y-1">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-500">SPK Terkirim</span>
          <div className="text-2xl font-bold text-amber-500">{totalSpkSent}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 space-y-1">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-500">Sudah Dicabut</span>
          <div className="text-2xl font-bold text-emerald-500">{totalDismantled}</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        {[
          { id: 'all', label: 'Semua Status' },
          { id: 'not_dismantled', label: `Belum Dicabut (${totalPendingDismantle})` },
          { id: 'spk_sent', label: `SPK Terkirim (${totalSpkSent})` },
          { id: 'dismantled', label: `Sudah Dicabut (${totalDismantled})` },
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setDismantleFilter(f.id as any)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-bold transition-all border',
              dismantleFilter === f.id
                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                : 'bg-card text-muted-foreground border-border hover:bg-muted'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Main Table Card */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
        <div className="p-3 border-b border-border flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs">
            <span>Tampilkan</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
              className="px-2 py-1 border border-input rounded-lg bg-background text-xs font-bold"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>data</span>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-input rounded-xl bg-background outline-none focus:ring-2 focus:ring-primary"
              placeholder="Cari pelanggan, HP, username..."
            />
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase font-mono text-[10px]">
              <tr>
                <th className="p-3 text-center w-8">
                  <input
                    type="checkbox"
                    checked={selectedUsers.size === filteredUsers.length && filteredUsers.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-border"
                  />
                </th>
                <th className="p-3">Pelanggan / Username</th>
                <th className="p-3">Paket &amp; Area</th>
                <th className="p-3">No. HP</th>
                <th className="p-3">Tanggal Stop</th>
                <th className="p-3">Status Dismantle</th>
                <th className="p-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                    Memuat data pelanggan...
                  </td>
                </tr>
              ) : paginatedUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground font-bold">
                    Tidak ada data pelanggan yang sesuai
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((user) => {
                  const activeWO = user.workOrders?.[0];
                  return (
                    <tr key={user.id} className="hover:bg-muted/40 transition-colors">
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={selectedUsers.has(user.id)}
                          onChange={() => toggleSelectUser(user.id)}
                          className="rounded border-border"
                        />
                      </td>
                      <td className="p-3">
                        <p className="font-bold text-foreground">{user.name}</p>
                        <p className="text-[11px] font-mono text-muted-foreground">{user.username}</p>
                      </td>
                      <td className="p-3">
                        <span className="font-bold">{user.profile.name}</span>
                        <p className="text-[10px] text-muted-foreground">{user.area?.name || '-'}</p>
                      </td>
                      <td className="p-3 font-mono font-bold text-primary">{user.phone}</td>
                      <td className="p-3 font-mono text-[11px]">
                        {user.stoppedAt ? formatWIB(user.stoppedAt, 'dd/MM/yyyy') : user.expiredAt ? formatWIB(user.expiredAt, 'dd/MM/yyyy') : '-'}
                      </td>
                      <td className="p-3">
                        {user.isDismantled ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/30">
                            <CheckCircle2 className="w-3 h-3" /> Sudah Dicabut
                          </span>
                        ) : activeWO && activeWO.status !== 'COMPLETED' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 text-amber-600 border border-amber-500/30">
                            <Wrench className="w-3 h-3" /> SPK: {activeWO.technician?.name || 'Teknisi'} ({activeWO.status})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-rose-500/10 text-rose-500 border border-rose-500/30">
                            <AlertTriangle className="w-3 h-3" /> Belum Dicabut
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Quick Toggle Checkbox */}
                          <button
                            onClick={() => handleToggleDismantle(user)}
                            className={cn(
                              'px-2 py-1 rounded-lg text-[10px] font-mono font-bold border transition-all flex items-center gap-1',
                              user.isDismantled
                                ? 'bg-muted text-muted-foreground border-border hover:bg-muted/80'
                                : 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                            )}
                            title="Tandai Sudah/Belum Dicabut secara langsung"
                          >
                            <CheckSquare className="w-3 h-3" />
                            {user.isDismantled ? 'Batal Cabut' : 'Ceklis Cabut'}
                          </button>

                          {/* Kirim SPK Cabut */}
                          {!user.isDismantled && (
                            <button
                              onClick={() => {
                                setSpkModalUser(user);
                                setSelectedTechId('');
                                setScheduledDate('');
                                setSpkNotes('');
                              }}
                              className="px-2 py-1 bg-amber-500/10 text-amber-600 border border-amber-500/30 rounded-lg text-[10px] font-mono font-bold flex items-center gap-1 hover:bg-amber-500/20 transition-all"
                              title="Tugaskan SPK Penarikan Modem ke Teknisi"
                            >
                              <Wrench className="w-3 h-3" /> Kirim SPK
                            </button>
                          )}

                          {/* Reactivate */}
                          <button
                            onClick={() => handleReactivate(user.id)}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-500/10 rounded-lg border border-border"
                            title="Aktifkan Kembali Pelanggan"
                          >
                            <Shield className="w-3.5 h-3.5" />
                          </button>

                          {/* Permanent Delete */}
                          <button
                            onClick={() => handleDelete(user.id)}
                            className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg border border-border"
                            title="Hapus Permanen"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-3 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
          <span className="text-muted-foreground">
            Menampilkan {filteredUsers.length === 0 ? 0 : startIndex + 1} - {Math.min(startIndex + pageSize, filteredUsers.length)} dari {filteredUsers.length} data
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-border rounded-lg font-bold text-xs disabled:opacity-50"
            >
              Sebelumnya
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="px-3 py-1 border border-border rounded-lg font-bold text-xs disabled:opacity-50"
            >
              Selanjutnya
            </button>
          </div>
        </div>
      </div>

      {/* DISPATCH SPK MODAL */}
      {spkModalUser && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-foreground text-sm">Terbitkan SPK Cabut Perangkat</h3>
              </div>
              <button onClick={() => setSpkModalUser(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-muted/40 p-3 rounded-xl space-y-1 text-xs">
              <p className="font-bold text-foreground">{spkModalUser.name}</p>
              <p className="font-mono text-muted-foreground">{spkModalUser.username} | {spkModalUser.phone}</p>
              <p className="text-muted-foreground">{spkModalUser.address || 'Alamat tidak diisi'}</p>
            </div>

            <form onSubmit={handleCreateDismantleSPK} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-foreground mb-1">Pilih Teknisi Field</label>
                <select
                  value={selectedTechId}
                  onChange={e => setSelectedTechId(e.target.value)}
                  className="w-full p-2.5 bg-background border border-input rounded-xl focus:ring-2 focus:ring-primary outline-none font-bold"
                >
                  <option value="">-- Pilih Teknisi (Opsional / Open) --</option>
                  {technicians.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.phoneNumber || 'No HP N/A'})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-foreground mb-1">Jadwal Penarikan</label>
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={e => setScheduledDate(e.target.value)}
                    className="w-full p-2.5 bg-background border border-input rounded-xl outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-foreground mb-1">Prioritas SPK</label>
                  <select
                    value={priority}
                    onChange={e => setPriority(e.target.value)}
                    className="w-full p-2.5 bg-background border border-input rounded-xl outline-none font-bold"
                  >
                    <option value="LOW">Rendah (Low)</option>
                    <option value="MEDIUM">Sedang (Medium)</option>
                    <option value="HIGH">Tinggi (High)</option>
                    <option value="URGENT">Mendesak (Urgent)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-foreground mb-1">Catatan Khusus untuk Teknisi</label>
                <textarea
                  rows={2}
                  placeholder="Cth: Ambil ONT ZTE + Adaptor di rumah Pak RT"
                  value={spkNotes}
                  onChange={e => setSpkNotes(e.target.value)}
                  className="w-full p-2.5 bg-background border border-input rounded-xl outline-none font-mono"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSpkModalUser(null)}
                  className="flex-1 py-3 bg-muted text-foreground rounded-xl font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={dispatching}
                  className="flex-1 py-3 bg-amber-500 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-md hover:bg-amber-600"
                >
                  {dispatching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />}
                  Terbitkan SPK
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
