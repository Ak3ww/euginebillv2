'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ClipboardCheck, Plus, Search, Filter, Loader2, MapPin, Phone, User, 
  Calendar, CheckCircle2, AlertTriangle, Clock, ChevronRight, X, Wrench 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/cyberpunk/CyberToast';

interface Technician {
  id: string;
  name: string;
  phoneNumber: string;
}

interface WorkOrder {
  id: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  issueType: string;
  description: string;
  priority: string;
  status: string;
  scheduledDate?: string;
  createdAt: string;
  technician?: Technician | null;
}

export default function AdminWorkOrdersPage() {
  const router = useRouter();
  const { addToast } = useToast();

  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    customerAddress: '',
    issueType: 'INSTALLATION',
    priority: 'MEDIUM',
    technicianId: '',
    description: '',
    notes: '',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [woRes, techRes] = await Promise.all([
        fetch('/api/admin/work-orders'),
        fetch('/api/admin/technicians'),
      ]);

      if (woRes.ok) {
        const data = await woRes.json();
        setWorkOrders(data.workOrders || []);
      }

      if (techRes.ok) {
        const data = await techRes.json();
        setTechnicians(data.technicians || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('new') === 'true') {
        setFormData({
          customerName: urlParams.get('name') || '',
          customerPhone: urlParams.get('phone') || '',
          customerAddress: urlParams.get('address') || '',
          issueType: 'INSTALLATION',
          priority: 'MEDIUM',
          technicianId: '',
          description: `Pemasangan baru internet untuk ${urlParams.get('name') || 'Pelanggan'}`,
          notes: '',
        });
        setIsModalOpen(true);
      }
    }
  }, []);

  const handleCreateSPK = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/work-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        addToast({ type: 'success', title: 'Berhasil', description: 'Surat Tugas (SPK) berhasil diterbitkan!' });
        setIsModalOpen(false);
        setFormData({
          customerName: '',
          customerPhone: '',
          customerAddress: '',
          issueType: 'INSTALLATION',
          priority: 'MEDIUM',
          technicianId: '',
          description: '',
          notes: '',
        });
        fetchData();
      } else {
        addToast({ type: 'error', title: 'Gagal', description: data.error || 'Terjadi kesalahan' });
      }
    } catch {
      addToast({ type: 'error', title: 'Gagal', description: 'Gagal menghubungkan ke server' });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredOrders = workOrders.filter((wo) => {
    const matchSearch =
      wo.customerName.toLowerCase().includes(search.toLowerCase()) ||
      wo.customerPhone.includes(search) ||
      wo.customerAddress.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter ? wo.status === statusFilter : true;
    return matchSearch && matchStatus;
  });

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card border border-border rounded-2xl p-6 shadow-sm">
        <div>
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-primary">Manajemen SPK Teknisi</span>
          <h1 className="text-2xl font-bold font-display text-foreground mt-0.5 flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-primary" />
            Surat Perintah Kerja (SPK)
          </h1>
          <p className="text-xs text-muted-foreground mt-1">Terbitkan dan pantau penugasan teknisi untuk pasang baru &amp; perbaikan.</p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground font-bold text-xs rounded-xl shadow-md hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" /> Terbitkan SPK Baru
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-card border border-border rounded-2xl p-4 flex flex-col sm:flex-row gap-3 justify-between items-center shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Cari nama, telepon, atau alamat..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-background border border-input rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {[
            ['', 'Semua Status'],
            ['OPEN', 'Pending'],
            ['ASSIGNED', 'Diambil'],
            ['IN_PROGRESS', 'Proses'],
            ['COMPLETED', 'Selesai'],
          ].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setStatusFilter(val)}
              className={cn(
                'px-3 py-1.5 rounded-xl font-mono text-[10px] font-bold uppercase tracking-wider transition-colors border whitespace-nowrap',
                statusFilter === val
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-border hover:bg-muted'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* List / Table Grid */}
      {loading ? (
        <div className="py-20 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center">
          <ClipboardCheck className="w-12 h-12 mx-auto text-muted-foreground opacity-40 mb-3" />
          <h3 className="text-base font-bold text-foreground">Tidak Ada Surat Tugas</h3>
          <p className="text-xs text-muted-foreground mt-1">Belum ada SPK yang diterbitkan atau hasil pencarian tidak ditemukan.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredOrders.map((wo) => (
            <div
              key={wo.id}
              onClick={() => router.push(`/admin/work-orders/${wo.id}`)}
              className="bg-card border border-border rounded-2xl p-5 hover:border-primary/40 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start mb-3">
                  <span className={cn('px-2.5 py-0.5 rounded-full font-mono text-[10px] uppercase tracking-wider font-bold border',
                    wo.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                    wo.status === 'IN_PROGRESS' ? 'bg-blue-500/10 text-blue-600 border-blue-500/20' :
                    'bg-amber-500/10 text-amber-600 border-amber-500/20'
                  )}>
                    {wo.status}
                  </span>
                  <span className="text-[10px] font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                    {wo.issueType.replace('_', ' ')}
                  </span>
                </div>

                <h3 className="font-bold text-base text-foreground line-clamp-1">{wo.customerName}</h3>
                
                <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex items-start gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    <span className="line-clamp-2 leading-relaxed">{wo.customerAddress}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="font-mono text-foreground font-semibold">{wo.customerPhone}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-border flex justify-between items-center text-xs">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Wrench className="w-3.5 h-3.5 text-primary" />
                  <span className="font-medium text-foreground">{wo.technician?.name || 'Belum Ditunjuk'}</span>
                </div>
                <span className="font-bold text-primary flex items-center gap-0.5 hover:underline">
                  Detail <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Terbitkan SPK Baru */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground">Terbitkan Surat Perintah Kerja (SPK)</h3>
                <p className="text-xs text-muted-foreground">Tugaskan teknisi untuk pasang baru atau perbaikan.</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-1 text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSPK} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-foreground mb-1">Nama Pelanggan *</label>
                <input
                  type="text"
                  required
                  placeholder="Cth: Bpk. Ahmad Subagyo"
                  value={formData.customerName}
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                  className="w-full p-2.5 bg-background border border-input rounded-xl focus:ring-2 focus:ring-primary outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-foreground mb-1">Nomor WhatsApp *</label>
                  <input
                    type="text"
                    required
                    placeholder="081234567890"
                    value={formData.customerPhone}
                    onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                    className="w-full p-2.5 bg-background border border-input rounded-xl font-mono focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-foreground mb-1">Tipe Pekerjaan</label>
                  <select
                    value={formData.issueType}
                    onChange={(e) => setFormData({ ...formData, issueType: e.target.value })}
                    className="w-full p-2.5 bg-background border border-input rounded-xl focus:ring-2 focus:ring-primary outline-none"
                  >
                    <option value="INSTALLATION">Pasang Baru (Installation)</option>
                    <option value="REPAIR">Perbaikan Gangguan (Repair)</option>
                    <option value="MAINTENANCE">Pemeliharaan (Maintenance)</option>
                    <option value="DISMANTLE">Cabut Perangkat (Dismantle)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-foreground mb-1">Alamat Lengkap Pelanggan *</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Jl. Merdeka No. 12, RT 02/05, Desa Sumber Rejeki"
                  value={formData.customerAddress}
                  onChange={(e) => setFormData({ ...formData, customerAddress: e.target.value })}
                  className="w-full p-2.5 bg-background border border-input rounded-xl focus:ring-2 focus:ring-primary outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-foreground mb-1">Prioritas</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full p-2.5 bg-background border border-input rounded-xl focus:ring-2 focus:ring-primary outline-none"
                  >
                    <option value="LOW">Low (Rendah)</option>
                    <option value="MEDIUM">Medium (Normal)</option>
                    <option value="HIGH">High (Tinggi)</option>
                    <option value="URGENT">Urgent (Darurat)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-foreground mb-1">Pilih Teknisi Penanggung Jawab</label>
                  <select
                    value={formData.technicianId}
                    onChange={(e) => setFormData({ ...formData, technicianId: e.target.value })}
                    className="w-full p-2.5 bg-background border border-input rounded-xl focus:ring-2 focus:ring-primary outline-none font-medium"
                  >
                    <option value="">-- Bebas (Diambil Teknisi) --</option>
                    {technicians.map((t) => (
                      <option key={t.id} value={t.id}>{t.name} ({t.phoneNumber})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-foreground mb-1">Catatan / Perintah Lapangan</label>
                <textarea
                  rows={2}
                  placeholder="Instruksi tambahan untuk teknisi..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full p-2.5 bg-background border border-input rounded-xl focus:ring-2 focus:ring-primary outline-none"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 bg-muted text-foreground font-bold rounded-xl hover:bg-muted/80 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-md"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
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
