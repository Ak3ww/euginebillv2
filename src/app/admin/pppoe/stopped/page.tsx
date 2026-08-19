'use client';
import { showSuccess, showError, showConfirm } from '@/lib/sweetalert';
import { usePermissions } from '@/hooks/usePermissions';
import { useTranslation } from '@/hooks/useTranslation';
import { useState, useEffect } from 'react';
import {
  Users, Trash2, Download, Search, RefreshCcw, Plus, Shield, FileText, CheckCircle, Wrench, CheckCircle2, XCircle
} from 'lucide-react';
import { formatWIB } from '@/lib/timezone';

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
  baseUsername?: string;
  isUsernameReused?: boolean;
  profile: { id: string; name: string; groupName: string };
  router?: { id: string; name: string; nasname: string; ipAddress: string } | null;
  area?: { id: string; name: string } | null;
  workOrders?: {
    id: string;
    status: string;
    scheduledDate: string | null;
    technician: { id: string; name: string; phoneNumber: string } | null;
  }[];
}

export default function StoppedSubscriptionsPage() {
  const { hasPermission, loading: permLoading } = usePermissions();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<StoppedUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Dismantle Filter
  const [dismantleFilter, setDismantleFilter] = useState<'ALL' | 'BELUM' | 'SPK' | 'SUDAH'>('ALL');
  
  // Modal State
  const [techs, setTechs] = useState<any[]>([]);
  const [spkModalOpen, setSpkModalOpen] = useState(false);
  const [selectedUserForSpk, setSelectedUserForSpk] = useState<StoppedUser | null>(null);
  
  const [spkForm, setSpkForm] = useState({
    technicianId: '',
    scheduledDate: '',
    priority: 'MEDIUM',
    notes: ''
  });

  useEffect(() => { loadData(); loadTechs(); }, []);

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

  const loadTechs = async () => {
    try {
      const res = await fetch('/api/admin/technicians');
      if (res.ok) {
        const data = await res.json();
        setTechs(data.technicians || []);
      }
    } catch (e) {
      console.error('Load techs error:', e);
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

  const handleToggleDismantle = async (userId: string, currentStatus: boolean) => {
    const confirmed = await showConfirm(currentStatus ? 'Batalkan status sudah dicabut?' : 'Tandai perangkat sudah dicabut?');
    if (!confirmed) return;

    try {
      const res = await fetch('/api/admin/pppoe/dismantle', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, isDismantled: !currentStatus }),
      });
      if (res.ok) {
        await showSuccess('Status dismantle berhasil diupdate');
        loadData();
      } else {
        await showError('Gagal update status dismantle');
      }
    } catch (error) {
      await showError('Gagal menghubungi server');
    }
  };

  const handleSubmitSpk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForSpk || !spkForm.technicianId || !spkForm.scheduledDate) {
      await showError('Harap isi semua field wajib');
      return;
    }
    
    try {
      const res = await fetch('/api/admin/pppoe/dismantle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUserForSpk.id,
          ...spkForm
        }),
      });
      if (res.ok) {
        await showSuccess('SPK Cabut berhasil dikirim');
        setSpkModalOpen(false);
        loadData();
      } else {
        await showError('Gagal membuat SPK');
      }
    } catch (error) {
      await showError('Gagal menghubungi server');
    }
  };

  const toggleSelectUser = (userId: string) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) newSelected.delete(userId);
    else newSelected.add(userId);
    setSelectedUsers(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedUsers.size === filteredUsers.length) setSelectedUsers(new Set());
    else setSelectedUsers(new Set(filteredUsers.map(u => u.id)));
  };

  // Status computation for filtering
  const getDismantleStatus = (user: StoppedUser) => {
    if (user.isDismantled) return 'SUDAH';
    const activeWo = user.workOrders?.find(wo => wo.status !== 'COMPLETED' && wo.status !== 'CANCELLED');
    if (activeWo) return 'SPK';
    return 'BELUM';
  };

  // Filter users
  const filteredUsers = users.filter(user => {
    const matchSearch = !searchQuery ||
      user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.phone.includes(searchQuery) ||
      user.profile.name.toLowerCase().includes(searchQuery.toLowerCase());
      
    if (!matchSearch) return false;
    
    if (dismantleFilter !== 'ALL') {
      const status = getDismantleStatus(user);
      if (status !== dismantleFilter) return false;
    }
    
    return true;
  });

  // Pagination
  const totalPages = Math.ceil(filteredUsers.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedUsers = filteredUsers.slice(startIndex, startIndex + pageSize);

  // Stats
  // const totalStopped = users.length;

  if (permLoading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  if (!hasPermission('customers.view')) return <div className="flex items-center justify-center h-screen text-destructive">{t('pppoe.accessDenied')}</div>;

  return (
    <div className="bg-background min-h-screen p-4 sm:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('pppoe.stoppedSubscriptions')}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t('pppoe.stoppedSubscriptionsDesc')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadData} disabled={loading} className="px-4 py-2 text-sm bg-muted hover:bg-muted/80 rounded-md flex items-center gap-2 border border-border">
            <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {t('common.refresh')}
          </button>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card p-4 rounded-xl border border-border shadow-sm">
        <div className="flex flex-wrap gap-2">
          {/* Dismantle Filter Pills */}
          <button onClick={() => { setDismantleFilter('ALL'); setCurrentPage(1); }} className={`px-4 py-2 text-xs font-medium rounded-full border transition-colors ${dismantleFilter === 'ALL' ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted text-muted-foreground hover:bg-muted/80 border-transparent'}`}>Semua</button>
          <button onClick={() => { setDismantleFilter('BELUM'); setCurrentPage(1); }} className={`px-4 py-2 text-xs font-medium rounded-full border transition-colors ${dismantleFilter === 'BELUM' ? 'bg-destructive/10 text-destructive border-destructive/20' : 'bg-muted text-muted-foreground hover:bg-muted/80 border-transparent'}`}>Belum Dicabut</button>
          <button onClick={() => { setDismantleFilter('SPK'); setCurrentPage(1); }} className={`px-4 py-2 text-xs font-medium rounded-full border transition-colors ${dismantleFilter === 'SPK' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' : 'bg-muted text-muted-foreground hover:bg-muted/80 border-transparent'}`}>SPK Terkirim</button>
          <button onClick={() => { setDismantleFilter('SUDAH'); setCurrentPage(1); }} className={`px-4 py-2 text-xs font-medium rounded-full border transition-colors ${dismantleFilter === 'SUDAH' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-muted text-muted-foreground hover:bg-muted/80 border-transparent'}`}>Sudah Dicabut</button>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={handleExport} 
            className="px-4 py-2 text-sm bg-background hover:bg-muted text-foreground border border-border rounded-md flex items-center gap-2"
          >
            <FileText className="h-4 w-4" />
            {t('pppoe.export')}
          </button>
          <button 
            onClick={handleBulkDelete} 
            disabled={selectedUsers.size === 0} 
            className="px-4 py-2 text-sm bg-destructive hover:bg-destructive/90 text-white rounded-md flex items-center gap-2 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            {t('pppoe.delete')}
          </button>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row items-center justify-between gap-4 bg-muted/30">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">{t('pppoe.show')}</span>
            <select 
              value={pageSize} 
              onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
              className="px-3 py-1.5 border border-border rounded-md bg-background focus:ring-2 focus:ring-primary outline-none"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
          <div className="relative max-w-sm w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-md bg-background focus:ring-2 focus:ring-primary outline-none transition-shadow"
              placeholder={t('common.search')}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-muted-foreground">
                <th className="px-4 py-3 text-left font-medium w-10">
                  <input type="checkbox" checked={selectedUsers.size === filteredUsers.length && filteredUsers.length > 0} onChange={toggleSelectAll} className="rounded border-border" />
                </th>
                <th className="px-4 py-3 text-left font-medium">{t('pppoe.customer')}</th>
                <th className="px-4 py-3 text-left font-medium">{t('pppoe.profile')}</th>
                <th className="px-4 py-3 text-left font-medium">Status Cabut</th>
                <th className="px-4 py-3 text-left font-medium hidden md:table-cell">{t('pppoe.stopDate')}</th>
                <th className="px-4 py-3 text-right font-medium">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    <RefreshCcw className="h-5 w-5 animate-spin mx-auto mb-2" /> Memuat data...
                  </td>
                </tr>
              ) : paginatedUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    Tidak ada data yang ditemukan.
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((user) => {
                  const status = getDismantleStatus(user);
                  const activeWo = user.workOrders?.find(wo => wo.status !== 'COMPLETED' && wo.status !== 'CANCELLED');
                  return (
                    <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={selectedUsers.has(user.id)} onChange={() => toggleSelectUser(user.id)} className="rounded border-border" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{user.name}</div>
                        <div className="text-xs text-muted-foreground font-mono mt-0.5">{user.username}</div>
                        {user.baseUsername && (
                          <div className="mt-1">
                            {user.isUsernameReused ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20" title={`Akun PPPoE ${user.baseUsername} sudah dipakai oleh pelanggan aktif lain`}>
                                <XCircle className="w-3 h-3 text-rose-500" /> Username Terpakai ({user.baseUsername})
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" title={`Akun PPPoE ${user.baseUsername} belum terpakai / kosong, siap dipakai kembali`}>
                                <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Username Kosong ({user.baseUsername})
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{user.profile.name}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{user.area?.name || '-'}</div>
                      </td>
                      <td className="px-4 py-3">
                        {status === 'SUDAH' && (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Sudah Dicabut {user.dismantledAt ? `(${formatWIB(user.dismantledAt, 'dd/MM/yyyy')})` : ''}
                          </div>
                        )}
                        {status === 'SPK' && (
                          <div className="inline-flex flex-col gap-1">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 border border-amber-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> SPK Terkirim
                            </div>
                            <span className="text-[10px] text-muted-foreground">Tech: {activeWo?.technician?.name || '-'}</span>
                          </div>
                        )}
                        {status === 'BELUM' && (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-destructive/10 text-destructive border border-destructive/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-destructive" /> Belum Dicabut
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                        {user.stoppedAt ? formatWIB(user.stoppedAt, 'dd/MM/yyyy') : user.expiredAt ? formatWIB(user.expiredAt, 'dd/MM/yyyy') : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => handleToggleDismantle(user.id, !!user.isDismantled)}
                            className={`p-2 rounded-md border transition-colors ${user.isDismantled ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 hover:bg-emerald-500/20' : 'bg-background border-border text-muted-foreground hover:bg-muted'}`}
                            title={user.isDismantled ? 'Batalkan status cabut' : 'Ceklis Cabut Manual'}
                          >
                            <CheckCircle className="h-4 w-4" />
                          </button>
                          
                          {status !== 'SUDAH' && (
                            <button
                              onClick={() => { setSelectedUserForSpk(user); setSpkModalOpen(true); }}
                              className="p-2 rounded-md border border-border bg-background hover:bg-muted text-muted-foreground transition-colors"
                              title="Kirim SPK Cabut"
                            >
                              <Wrench className="h-4 w-4" />
                            </button>
                          )}

                          <button 
                            onClick={() => handleReactivate(user.id)} 
                            className="p-2 rounded-md border border-border bg-background hover:bg-muted text-muted-foreground transition-colors"
                            title={t('pppoe.reactivate')}
                          >
                            <Shield className="h-4 w-4" />
                          </button>
                          <button 
                            onClick={() => handleDelete(user.id)} 
                            className="p-2 rounded-md border border-destructive/20 bg-destructive/5 hover:bg-destructive/10 text-destructive transition-colors"
                            title={t('pppoe.permanentDelete')}
                          >
                            <Trash2 className="h-4 w-4" />
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
        <div className="p-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 bg-muted/30">
          <div className="text-sm text-muted-foreground">
            {t('pppoe.showing')} {filteredUsers.length === 0 ? 0 : startIndex + 1} {t('common.to')} {Math.min(startIndex + pageSize, filteredUsers.length)} {t('pppoe.of')} {filteredUsers.length} {t('pppoe.entries')}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1 text-sm border border-border rounded-md bg-background hover:bg-muted disabled:opacity-50 transition-colors">Previous</button>
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0} className="px-3 py-1 text-sm border border-border rounded-md bg-background hover:bg-muted disabled:opacity-50 transition-colors">Next</button>
          </div>
        </div>
      </div>

      {/* SPK Modal */}
      {spkModalOpen && selectedUserForSpk && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-card w-full max-w-lg rounded-2xl border border-border shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-border bg-muted/30">
              <h2 className="text-xl font-bold text-foreground">Kirim SPK Cabut (Dismantle)</h2>
              <p className="text-sm text-muted-foreground mt-1">Pelanggan: <span className="font-semibold text-foreground">{selectedUserForSpk.name}</span></p>
            </div>
            
            <form onSubmit={handleSubmitSpk} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Teknisi *</label>
                <select required value={spkForm.technicianId} onChange={e => setSpkForm(p => ({...p, technicianId: e.target.value}))} className="w-full p-2.5 border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary outline-none">
                  <option value="" disabled>Pilih Teknisi...</option>
                  {techs.map(t => <option key={t.id} value={t.id}>{t.name} ({t.activeWorkOrders} WO aktif)</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Tanggal Jadwal *</label>
                <input required type="date" value={spkForm.scheduledDate} onChange={e => setSpkForm(p => ({...p, scheduledDate: e.target.value}))} className="w-full p-2.5 border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary outline-none" />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Prioritas</label>
                <select value={spkForm.priority} onChange={e => setSpkForm(p => ({...p, priority: e.target.value}))} className="w-full p-2.5 border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary outline-none">
                  <option value="LOW">Rendah (LOW)</option>
                  <option value="MEDIUM">Sedang (MEDIUM)</option>
                  <option value="HIGH">Tinggi (HIGH)</option>
                  <option value="URGENT">Mendesak (URGENT)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Catatan Tambahan</label>
                <textarea rows={3} value={spkForm.notes} onChange={e => setSpkForm(p => ({...p, notes: e.target.value}))} placeholder="Opsional..." className="w-full p-2.5 border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary outline-none resize-none" />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-border mt-6">
                <button type="button" onClick={() => setSpkModalOpen(false)} className="px-5 py-2.5 text-sm font-medium text-muted-foreground bg-background border border-border rounded-lg hover:bg-muted transition-colors">Batal</button>
                <button type="submit" className="px-5 py-2.5 text-sm font-medium text-primary-foreground bg-primary rounded-lg shadow hover:bg-primary/90 transition-colors">Kirim SPK Sekarang</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
