'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { 
  ArrowLeft, CheckCircle2, Loader2, MapPin, Phone, 
  Wrench, Camera, CheckSquare, Calendar, User, Send, Download,
  Edit3, Trash2, X, Save
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/cyberpunk/CyberToast';

export default function AdminWorkOrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { addToast } = useToast();

  const [wo, setWo] = useState<any>(null);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [editFormData, setEditFormData] = useState({
    technicianId: '',
    status: '',
    priority: '',
    issueType: '',
    description: '',
    notes: '',
  });

  useEffect(() => {
    fetchWo();
    fetchTechnicians();
  }, [params.id]);

  const fetchWo = async () => {
    try {
      const res = await fetch(`/api/admin/work-orders/${params.id}`);
      if (res.ok) {
        const data = await res.json();
        setWo(data.workOrder);
        setEditFormData({
          technicianId: data.workOrder.technicianId || '',
          status: data.workOrder.status || 'OPEN',
          priority: data.workOrder.priority || 'MEDIUM',
          issueType: data.workOrder.issueType || 'INSTALLATION',
          description: data.workOrder.description || '',
          notes: data.workOrder.notes || '',
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchTechnicians = async () => {
    try {
      const res = await fetch('/api/admin/technicians');
      if (res.ok) {
        const data = await res.json();
        setTechnicians(data.technicians || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/work-orders/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editFormData),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        addToast({ type: 'success', title: 'Berhasil', description: 'Detail SPK berhasil diperbarui!' });
        setIsEditModalOpen(false);
        fetchWo();
      } else {
        addToast({ type: 'error', title: 'Gagal', description: data.error || 'Gagal memperbarui SPK' });
      }
    } catch {
      addToast({ type: 'error', title: 'Gagal', description: 'Terjadi kesalahan koneksi server' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSpk = async () => {
    if (!confirm(`Apakah Anda yakin ingin menghapus / membatalkan Surat Tugas (SPK) ini? Pilihan ini tidak dapat dibatalkan.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/work-orders/${params.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        addToast({ type: 'success', title: 'Berhasil', description: 'Surat Tugas (SPK) telah dihapus.' });
        router.push('/admin/work-orders');
      } else {
        addToast({ type: 'error', title: 'Gagal', description: data.error || 'Gagal menghapus SPK' });
      }
    } catch {
      addToast({ type: 'error', title: 'Gagal', description: 'Terjadi kesalahan server' });
    }
  };

  if (loading) {
    return (
      <div className="p-12 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!wo) {
    return (
      <div className="p-8 text-center text-destructive">
        Surat Tugas tidak ditemukan
      </div>
    );
  }

  const reportData = wo.reportData || {};
  const reportPhotos = wo.reportPhotos || {};

  return (
    <div className="p-4 md:p-8 w-full max-w-5xl mx-auto space-y-6">
      <button 
        onClick={() => router.push('/admin/work-orders')} 
        className="flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Kembali ke Daftar SPK
      </button>

      {/* Header Info Card */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-primary">ID SPK: #{wo.id.slice(-8).toUpperCase()}</span>
            <h1 className="text-xl font-bold font-display text-foreground mt-0.5">{wo.customerName}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Tipe Pekerjaan: <strong className="text-foreground">{wo.issueType?.replace('_', ' ')}</strong></p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('px-3 py-1 rounded-full font-mono text-xs uppercase tracking-wider font-bold border', 
              wo.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-amber-500/10 text-amber-600 border-amber-500/20')}>
              {wo.status}
            </span>
            <span className="px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded-full font-mono text-xs font-bold uppercase">
              Prioritas: {wo.priority}
            </span>

            {/* Admin Action Buttons: Edit & Delete */}
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="px-3 py-1 bg-muted hover:bg-muted/80 text-foreground border border-border rounded-full font-mono text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5 text-primary" /> Edit SPK
            </button>
            <button
              onClick={handleDeleteSpk}
              className="px-3 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 border border-rose-500/20 rounded-full font-mono text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> Hapus
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-border">
          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 p-3 rounded-xl">
            <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <span className="leading-relaxed text-foreground">{wo.customerAddress}</span>
          </div>
          <div className="flex flex-col justify-between gap-2 bg-muted/40 p-3 rounded-xl text-xs">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="w-4 h-4 text-primary shrink-0" />
              <span className="font-mono text-foreground font-bold">{wo.customerPhone}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground pt-1 border-t border-border/50">
              <Wrench className="w-4 h-4 text-primary shrink-0" />
              <span>Teknisi Penanggung Jawab: <strong className="text-foreground">{wo.technician?.name || 'Belum Ditunjuk'}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Laporan Teknis Hasil Pengerjaan (Jika Completed / Ada Report Data) */}
      {wo.reportData && (
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Wrench className="w-5 h-5 text-primary" />
            Rincian Laporan Teknis Lapangan
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-background border border-border rounded-xl">
              <span className="text-[10px] text-muted-foreground font-bold uppercase block">ODP &amp; Port</span>
              <span className="font-mono font-bold text-foreground mt-0.5 block">{reportData.odpName || '-'}</span>
            </div>
            <div className="p-3 bg-background border border-border rounded-xl">
              <span className="text-[10px] text-muted-foreground font-bold uppercase block">Tipe Modem ONT</span>
              <span className="font-mono font-bold text-foreground mt-0.5 block">{reportData.modemType || '-'}</span>
            </div>
            <div className="p-3 bg-background border border-border rounded-xl">
              <span className="text-[10px] text-muted-foreground font-bold uppercase block">Serial Number (SN)</span>
              <span className="font-mono font-bold text-foreground mt-0.5 block">{reportData.sn || '-'}</span>
            </div>
            <div className="p-3 bg-background border border-border rounded-xl">
              <span className="text-[10px] text-muted-foreground font-bold uppercase block">MAC Address</span>
              <span className="font-mono font-bold text-foreground mt-0.5 block">{reportData.mac || '-'}</span>
            </div>
            <div className="p-3 bg-background border border-border rounded-xl">
              <span className="text-[10px] text-muted-foreground font-bold uppercase block">Sinyal Redaman Rx</span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 block">{reportData.rxSignal ? `${reportData.rxSignal} dBm` : '-'}</span>
            </div>
            <div className="p-3 bg-background border border-border rounded-xl">
              <span className="text-[10px] text-muted-foreground font-bold uppercase block">Panjang Kabel DW</span>
              <span className="font-mono font-bold text-foreground mt-0.5 block">{reportData.dwRoll || '-'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Galeri Foto Dokumentasi Lapangan */}
      {wo.reportPhotos && Object.keys(reportPhotos).length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Camera className="w-5 h-5 text-primary" />
            Galeri Foto Dokumentasi Lapangan
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {Object.entries(reportPhotos).map(([label, photoUrl]) => (
              <div key={label} className="bg-background border border-border rounded-xl overflow-hidden shadow-sm flex flex-col">
                <div className="relative aspect-[3/4] bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photoUrl as string} alt={label} className="w-full h-full object-cover" />
                </div>
                <div className="p-2.5 text-center bg-card">
                  <span className="text-[11px] font-bold text-foreground">{label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Edit Detail SPK */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground">Edit Detail Surat Perintah Kerja (SPK)</h3>
                <p className="text-xs text-muted-foreground">Ubah penunjukan teknisi, status, atau prioritas pekerjaan.</p>
              </div>
              <button onClick={() => setIsEditModalOpen(false)} className="p-1 text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-foreground mb-1">Teknisi Penanggung Jawab</label>
                <select
                  value={editFormData.technicianId}
                  onChange={(e) => setEditFormData({ ...editFormData, technicianId: e.target.value })}
                  className="w-full p-2.5 bg-background border border-input rounded-xl focus:ring-2 focus:ring-primary outline-none font-mono"
                >
                  <option value="">-- Belum Ditunjuk --</option>
                  {technicians.map((tech) => (
                    <option key={tech.id} value={tech.id}>
                      {tech.name} ({tech.phoneNumber})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-foreground mb-1">Status Pekerjaan</label>
                  <select
                    value={editFormData.status}
                    onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                    className="w-full p-2.5 bg-background border border-input rounded-xl focus:ring-2 focus:ring-primary outline-none font-mono"
                  >
                    <option value="OPEN">OPEN (Menunggu)</option>
                    <option value="ASSIGNED">ASSIGNED (Ditunjuk)</option>
                    <option value="IN_PROGRESS">IN_PROGRESS (Diproses)</option>
                    <option value="COMPLETED">COMPLETED (Selesai)</option>
                    <option value="CANCELLED">CANCELLED (Dibatalkan)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-foreground mb-1">Prioritas</label>
                  <select
                    value={editFormData.priority}
                    onChange={(e) => setEditFormData({ ...editFormData, priority: e.target.value })}
                    className="w-full p-2.5 bg-background border border-input rounded-xl focus:ring-2 focus:ring-primary outline-none font-mono"
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="URGENT">URGENT</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-foreground mb-1">Tipe Pekerjaan</label>
                <select
                  value={editFormData.issueType}
                  onChange={(e) => setEditFormData({ ...editFormData, issueType: e.target.value })}
                  className="w-full p-2.5 bg-background border border-input rounded-xl focus:ring-2 focus:ring-primary outline-none font-mono"
                >
                  <option value="INSTALLATION">Pasang Baru (INSTALLATION)</option>
                  <option value="REPAIR">Perbaikan / Repair (REPAIR)</option>
                  <option value="MODEM_REPLACEMENT">Ganti Modem ONT (MODEM_REPLACEMENT)</option>
                  <option value="RELOCATION">Pindah Alamat (RELOCATION)</option>
                  <option value="OTHER">Lainnya (OTHER)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-foreground mb-1">Deskripsi Pekerjaan</label>
                <textarea
                  rows={3}
                  value={editFormData.description}
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                  className="w-full p-2.5 bg-background border border-input rounded-xl focus:ring-2 focus:ring-primary outline-none font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-foreground mb-1">Catatan Tambahan (Internal)</label>
                <textarea
                  rows={2}
                  value={editFormData.notes}
                  onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                  className="w-full p-2.5 bg-background border border-input rounded-xl focus:ring-2 focus:ring-primary outline-none font-mono"
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 py-2.5 bg-muted hover:bg-muted/80 text-foreground font-bold rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl shadow-md hover:opacity-90 flex items-center justify-center gap-1.5"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
