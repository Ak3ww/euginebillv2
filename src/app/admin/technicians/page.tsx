'use client';

import { useState, useEffect } from 'react';
import { showSuccess, showError, showConfirm } from '@/lib/sweetalert';
import { useTranslation } from '@/hooks/useTranslation';
import {
  Plus,
  Pencil,
  Trash2,
  Users,
  RefreshCcw,
  Phone,
  Mail,
  Clock,
  CheckCircle,
  XCircle,
  Search,
  Key,
  User,
} from 'lucide-react';
import {
  SimpleModal,
  ModalHeader,
  ModalTitle,
  ModalBody,
  ModalFooter,
  ModalInput,
  ModalLabel,
  ModalButton,
} from '@/components/cyberpunk';
import { formatWIB } from '@/lib/timezone';

interface Technician {
  id: string;
  name: string;
  username?: string;
  phoneNumber: string;
  email?: string;
  isActive: boolean;
  requireOtp: boolean;
  createdAt: string;
  lastLoginAt?: string;
  _count?: {
    workOrders: number;
  };
}

export default function TechniciansManagementPage() {
  const { t } = useTranslation();
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTechnician, setEditingTechnician] = useState<Technician | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterActive, setFilterActive] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    username: '',
    password: '',
    phoneNumber: '',
    email: '',
    isActive: true,
    requireOtp: false,
  });

  useEffect(() => {
    loadTechnicians();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, filterActive]);

  const loadTechnicians = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (filterActive) params.append('isActive', filterActive);

      const res = await fetch(`/api/admin/technicians?${params}`);
      if (res.ok) {
        setTechnicians(await res.json());
      }
    } catch (error) {
      await showError(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      username: '',
      password: '',
      phoneNumber: '',
      email: '',
      isActive: true,
      requireOtp: false,
    });
  };

  const handleEdit = (technician: Technician) => {
    setEditingTechnician(technician);
    setFormData({
      name: technician.name,
      username: technician.username || '',
      password: '',
      phoneNumber: technician.phoneNumber,
      email: technician.email || '',
      isActive: technician.isActive,
      requireOtp: technician.requireOtp || false,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.phoneNumber) {
      await showError('Nama dan Nomor WhatsApp wajib diisi');
      return;
    }

    try {
      const method = editingTechnician ? 'PUT' : 'POST';
      const payload = editingTechnician
        ? { ...formData, id: editingTechnician.id }
        : formData;

      const res = await fetch('/api/admin/technicians', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (res.ok) {
        await showSuccess(
          editingTechnician
            ? 'Data teknisi berhasil diperbarui'
            : 'Teknisi baru berhasil ditambahkan'
        );
        setIsDialogOpen(false);
        setEditingTechnician(null);
        resetForm();
        loadTechnicians();
      } else {
        await showError(result.error || t('common.error'));
      }
    } catch (error) {
      await showError(t('common.error'));
    }
  };

  const handleDelete = async (technician: Technician) => {
    const confirmed = await showConfirm(
      'Hapus Teknisi',
      `Apakah Anda yakin ingin menghapus akun teknisi ${technician.name}?`
    );

    if (!confirmed) return;

    try {
      const res = await fetch(`/api/admin/technicians?id=${technician.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        await showSuccess('Teknisi berhasil dihapus');
        loadTechnicians();
      } else {
        const result = await res.json();
        await showError(result.error || t('common.error'));
      }
    } catch (error) {
      await showError(t('common.error'));
    }
  };

  const stats = {
    total: technicians.length,
    active: technicians.filter((t) => t.isActive).length,
    inactive: technicians.filter((t) => !t.isActive).length,
  };

  if (loading && technicians.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00f7ff] relative z-10"></div>
      </div>
    );
  }

  return (
    <div className="bg-background relative p-4 md:p-6">
      <div className="relative z-10 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
              <Users className="h-6 w-6 text-primary" />
              Kelola Teknisi
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Manajemen akun login &amp; hak akses teknisi lapangan.
            </p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setEditingTechnician(null);
              setIsDialogOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium text-sm hover:opacity-90 transition-opacity"
          >
            <Plus className="h-4 w-4" />
            Tambah Teknisi Baru
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between shadow-sm">
            <div>
              <p className="text-xs text-muted-foreground">Total Teknisi</p>
              <h3 className="text-2xl font-bold text-foreground mt-1">{stats.total}</h3>
            </div>
            <Users className="h-8 w-8 text-primary opacity-60" />
          </div>
          <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between shadow-sm">
            <div>
              <p className="text-xs text-muted-foreground">Teknisi Aktif</p>
              <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{stats.active}</h3>
            </div>
            <CheckCircle className="h-8 w-8 text-emerald-500 opacity-60" />
          </div>
          <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between shadow-sm">
            <div>
              <p className="text-xs text-muted-foreground">Non-Aktif</p>
              <h3 className="text-2xl font-bold text-destructive mt-1">{stats.inactive}</h3>
            </div>
            <XCircle className="h-8 w-8 text-destructive opacity-60" />
          </div>
        </div>

        {/* Filters */}
        <div className="bg-card border border-border rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Cari nama, username, atau no HP..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <select
              value={filterActive}
              onChange={(e) => setFilterActive(e.target.value)}
              className="w-full md:w-auto px-3 py-2 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Semua Status</option>
              <option value="true">Aktif</option>
              <option value="false">Non-Aktif</option>
            </select>
            <button
              onClick={loadTechnicians}
              className="p-2 border border-input rounded-lg hover:bg-accent text-muted-foreground"
              title="Refresh"
            >
              <RefreshCcw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 border-b border-border text-xs text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Teknisi</th>
                  <th className="px-4 py-3">Username &amp; Kontak</th>
                  <th className="px-4 py-3">SPK Aktif</th>
                  <th className="px-4 py-3">Login Terakhir</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 w-20">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {technicians.map((technician) => (
                  <tr key={technician.id} className="hover:bg-accent/40 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-foreground">{technician.name}</div>
                      <div className="text-xs text-muted-foreground">{technician.email || '-'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs text-primary font-medium flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {technician.username || technician.phoneNumber}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Phone className="h-3 w-3" />
                        {technician.phoneNumber}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono font-medium">
                      {technician._count?.workOrders || 0} SPK
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {technician.lastLoginAt ? (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatWIB(technician.lastLoginAt, 'dd/MM/yyyy HH:mm')}
                        </div>
                      ) : (
                        'Belum Pernah'
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span
                        className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded-full border ${
                          technician.isActive
                            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                            : 'bg-destructive/10 text-destructive border-destructive/20'
                        }`}
                      >
                        {technician.isActive ? 'Aktif' : 'Non-Aktif'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(technician)}
                          className="p-1.5 text-primary hover:bg-primary/10 rounded-md transition-colors"
                          title="Edit Teknisi"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(technician)}
                          className="p-1.5 text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                          title="Hapus Teknisi"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {technicians.length === 0 && (
              <div className="text-center py-12 text-muted-foreground text-sm">
                Tidak ada teknisi ditemukan.
              </div>
            )}
          </div>
        </div>

        {/* Add/Edit Modal */}
        <SimpleModal isOpen={isDialogOpen} onClose={() => { setIsDialogOpen(false); setEditingTechnician(null); resetForm(); }} size="md">
          <ModalHeader>
            <ModalTitle>{editingTechnician ? 'Edit Data Teknisi' : 'Tambah Teknisi Baru'}</ModalTitle>
          </ModalHeader>
          <form onSubmit={handleSubmit}>
            <ModalBody className="space-y-4">
              <div>
                <ModalLabel required>Nama Lengkap Teknisi</ModalLabel>
                <ModalInput 
                  type="text" 
                  value={formData.name} 
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
                  placeholder="Contoh: RIZKI RAMDANI" 
                  required 
                />
              </div>

              <div>
                <ModalLabel required>Username Login</ModalLabel>
                <ModalInput 
                  type="text" 
                  value={formData.username} 
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })} 
                  placeholder="Contoh: teknisi1" 
                  required 
                />
                <p className="text-[10px] text-muted-foreground mt-1">Username digunakan teknisi untuk login di portal `/technician`</p>
              </div>

              <div>
                <ModalLabel required={!editingTechnician}>
                  Password Login {editingTechnician && <span className="font-normal text-muted-foreground">(Opsional)</span>}
                </ModalLabel>
                <ModalInput 
                  type="password" 
                  value={formData.password} 
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })} 
                  placeholder={editingTechnician ? 'Biarkan kosong jika tidak ingin diubah' : 'Masukkan password login'} 
                  required={!editingTechnician} 
                />
              </div>

              <div>
                <ModalLabel required>Nomor WhatsApp</ModalLabel>
                <ModalInput 
                  type="tel" 
                  value={formData.phoneNumber} 
                  onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })} 
                  placeholder="Contoh: 08123456789 atau 628123456789" 
                  required 
                />
                <p className="text-[10px] text-muted-foreground mt-1">Diperlukan untuk notifikasi penugasan &amp; koordinasi</p>
              </div>

              <div>
                <ModalLabel>Email (Opsional)</ModalLabel>
                <ModalInput 
                  type="email" 
                  value={formData.email} 
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })} 
                  placeholder="teknisi@euginemedia.com" 
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={formData.isActive} 
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })} 
                    className="rounded border-input text-primary w-4 h-4" 
                  />
                  <span>Akun Aktif (Dapat Login)</span>
                </label>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={formData.requireOtp} 
                    onChange={(e) => setFormData({ ...formData, requireOtp: e.target.checked })} 
                    className="rounded border-input text-primary w-4 h-4" 
                  />
                  <span>Wajib Verifikasi OTP Login</span>
                </label>
              </div>
              <p className="text-[10px] text-muted-foreground">Jika dinonaktifkan, teknisi dapat langsung login dengan Username &amp; Password tanpa OTP.</p>
            </ModalBody>
            <ModalFooter>
              <ModalButton type="button" variant="secondary" onClick={() => { setIsDialogOpen(false); setEditingTechnician(null); resetForm(); }}>Batal</ModalButton>
              <ModalButton type="submit" variant="primary">Simpan Teknisi</ModalButton>
            </ModalFooter>
          </form>
        </SimpleModal>
      </div>
    </div>
  );
}
