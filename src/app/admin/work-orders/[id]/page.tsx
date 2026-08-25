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

  const [resendingWa, setResendingWa] = useState(false);
  const [copiedWa, setCopiedWa] = useState(false);
  const [uploadingLabel, setUploadingLabel] = useState<string | null>(null);

  const [editFormData, setEditFormData] = useState({
    customerName: '',
    customerPhone: '',
    customerAddress: '',
    technicianId: '',
    status: '',
    priority: '',
    issueType: '',
    description: '',
    notes: '',
  });

  const rawId = (params as any)?.id;
  const woId = Array.isArray(rawId) ? rawId[0] : rawId;

  useEffect(() => {
    if (woId) {
      fetchWo();
      fetchTechnicians();
    }
  }, [woId]);

  const fetchWo = async () => {
    if (!woId) return;
    try {
      const res = await fetch(`/api/admin/work-orders/${woId}`);
      if (res.ok) {
        const data = await res.json();
        setWo(data.workOrder);
        setEditFormData({
          customerName: data.workOrder.customerName || '',
          customerPhone: data.workOrder.customerPhone || '',
          customerAddress: data.workOrder.customerAddress || '',
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
      const res = await fetch(`/api/admin/work-orders/${woId}`, {
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
      const res = await fetch(`/api/admin/work-orders/${woId}`, {
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

  const parseJsonObject = (data: any) => {
    if (!data) return {};
    if (typeof data === 'object') return data;
    try {
      return typeof data === 'string' ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  };

  const reportData = parseJsonObject(wo.reportData);
  const reportPhotos = parseJsonObject(wo.reportPhotos);

  const handleCopyWaReport = async () => {
    const now = new Date();
    const HARI = ['MINGGU','SENIN','SELASA','RABU','KAMIS','JUMAT','SABTU'][now.getDay()];
    const BULAN = ['JANUARI','FEBRUARI','MARET','APRIL','MEI','JUNI','JULI','AGUSTUS','SEPTEMBER','OKTOBER','NOVEMBER','DESEMBER'][now.getMonth()];
    const tanggal = `${HARI}, ${now.getDate()} ${BULAN} ${now.getFullYear()}`;

    const portFormatted = reportData?.port
      ? String(reportData.port).replace('Port ', '').padStart(2, '0') + '/' + String(reportData?.portCount || 16).padStart(2, '0')
      : '-';

    const ledStatus = (val: any) => (val === true || val === 'true' || val === 'ON') ? '✅ ON' : '❌ OFF';

    const text = [
      `📋 *Report Daily IB*`,
      `📅 ${tanggal}`,
      ``,
      `*NAMA*    : ${wo.customerName || '-'}`,
      `*ALAMAT*  : ${wo.customerAddress || '-'}`,
      `*NO HP*   : ${wo.customerPhone || '-'}`,
      `*ODP*     : ${reportData?.odpName || '-'}`,
      `*PORT*    : ${portFormatted}`,
      `*TIKORTIS CST* : ${reportData?.customerLat || '-'}, ${reportData?.customerLng || '-'}`,
      `*TIKORTIS ODP* : ${reportData?.odpLat || '-'}, ${reportData?.odpLng || '-'}`,
      ``,
      `*DW ROLL* : ${reportData?.dwRoll || '-'} M`,
      `*PAKU KLEM* : ${reportData?.pakuKlem || 'Secukupnya'}`,
      `*SOLASI*  : ${reportData?.solasi || 'Secukupnya'}`,
      `*RX SIGNAL* : ${reportData?.rxSignal || '-'} dBm`,
      `*TX SIGNAL* : ${reportData?.txSignal || '-'} dBm`,
      ``,
      `*TYPE*    : ${reportData?.modemType || '-'}`,
      `*SN*      : ${reportData?.sn || '-'}`,
      `*MAC*     : ${reportData?.mac || '-'}`,
      ``,
      `*Indikator Power* : ${ledStatus(reportData?.powerIndicator)}`,
      `*Indikator Link*  : ${ledStatus(reportData?.linkIndicator)}`,
      `*Indikator Auth*  : ${ledStatus(reportData?.authIndicator)}`,
      `*Indikator Wifi 2.4* : ${ledStatus(reportData?.wifi24Indicator)}`,
      `*Indikator Wifi 5*   : ${ledStatus(reportData?.wifi5Indicator)}`,
      `*Indikator Internet* : ${ledStatus(reportData?.internetIndicator)}`,
      ``,
      `👷 *Teknisi* : ${wo.technician?.name || 'Teknisi'}`,
      `✅ *DONE*`,
    ].join('\n');

    try {
      await navigator.clipboard.writeText(text);
      setCopiedWa(true);
      addToast({ type: 'success', title: 'Berhasil', description: 'Teks Laporan PSB disalin ke clipboard!' });
      setTimeout(() => setCopiedWa(false), 2500);
    } catch {
      addToast({ type: 'error', title: 'Gagal', description: 'Gagal menyalin ke clipboard' });
    }
  };

  const handleResendWaReport = async () => {
    setResendingWa(true);
    try {
      const res = await fetch(`/api/admin/work-orders/${woId}/resend-wa`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        addToast({ type: 'success', title: 'Berhasil', description: data.message || 'Laporan dikirim ke Grup WA!' });
      } else {
        addToast({ type: 'error', title: 'Gagal', description: data.error || 'Gagal mengirim laporan ke WA' });
      }
    } catch {
      addToast({ type: 'error', title: 'Gagal', description: 'Terjadi kesalahan koneksi server' });
    } finally {
      setResendingWa(false);
    }
  };

  const handleAdminUploadPhoto = async (label: string, file: File) => {
    setUploadingLabel(label);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'ticket');

      const res = await fetch('/api/technician/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error || 'Gagal mengunggah foto');
      }

      const updatedPhotos = { ...reportPhotos, [label]: data.url };

      const updateRes = await fetch(`/api/admin/work-orders/${woId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportPhotos: updatedPhotos }),
      });

      if (updateRes.ok) {
        addToast({ type: 'success', title: 'Berhasil', description: `Foto "${label}" berhasil diunggah & disimpan!` });
        fetchWo();
      } else {
        addToast({ type: 'error', title: 'Gagal', description: 'Gagal memperbarui data foto SPK' });
      }
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error Upload', description: err?.message || 'Gagal mengunggah foto' });
    } finally {
      setUploadingLabel(null);
    }
  };

  const getPhotoUrl = (raw: any): string => {
    if (!raw) return '';
    let url = typeof raw === 'string' ? raw : (raw.url || raw.src || raw.path || '');
    if (!url) return '';
    if (!url.startsWith('/') && !url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('data:')) {
      url = '/' + url;
    }
    return url;
  };

  const defaultPhotoSlots = [
    'Foto Rumah',
    'Foto Box ODP',
    'Foto Port ODP',
    'Foto OPM / Redaman',
    'Foto ONT Depan',
    'Foto ONT Belakang',
    'Foto Speedtest',
  ];

  const photoLabels = Array.from(new Set([
    ...defaultPhotoSlots,
    ...Object.keys(reportPhotos),
  ]));

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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Wrench className="w-5 h-5 text-primary" />
              Rincian Laporan Teknis Lapangan
            </h2>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyWaReport}
                className="px-3 py-1.5 bg-muted hover:bg-muted/80 text-foreground border border-border rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5"
                title="Salin teks format laporan PSB ke clipboard"
              >
                <Send className="w-3.5 h-3.5 text-emerald-500" />
                {copiedWa ? 'Teks Tersalin!' : 'Salin Laporan WA'}
              </button>

              <button
                type="button"
                onClick={handleResendWaReport}
                disabled={resendingWa}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 disabled:opacity-50"
                title="Kirim ulang laporan + foto ke Grup WA"
              >
                {resendingWa ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Kirim Ke Grup WA
              </button>
            </div>
          </div>

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
              <span className="font-mono font-bold text-foreground mt-0.5 block">{reportData.dwRoll ? `${reportData.dwRoll} M` : '-'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Galeri Foto Dokumentasi Lapangan */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Camera className="w-5 h-5 text-primary" />
            Galeri Foto Dokumentasi Lapangan
          </h2>
          <span className="text-[11px] text-muted-foreground font-mono">
            Klik tombol Upload jika ingin mengganti foto dokumentasi
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {photoLabels.map((label) => {
            const rawPhoto = reportPhotos[label];
            const src = getPhotoUrl(rawPhoto);
            const isUploading = uploadingLabel === label;

            return (
              <div key={label} className="bg-background border border-border rounded-xl overflow-hidden shadow-sm flex flex-col justify-between">
                <div className="relative aspect-[3/4] bg-muted/60 flex items-center justify-center">
                  {src ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={src}
                      alt={label}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // If image fails to load, hide broken img element
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="p-4 text-center space-y-1">
                      <Camera className="w-8 h-8 text-muted-foreground/40 mx-auto" />
                      <p className="text-[10px] text-muted-foreground font-semibold">Belum Ada Foto</p>
                    </div>
                  )}

                  {isUploading && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center space-y-1 text-white">
                      <Loader2 className="w-6 h-6 animate-spin" />
                      <span className="text-[10px] font-bold">Mengunggah...</span>
                    </div>
                  )}
                </div>

                <div className="p-2.5 bg-card border-t border-border flex flex-col gap-1.5">
                  <span className="text-[11px] font-bold text-foreground truncate text-center block">{label}</span>

                  <label className="w-full py-1.5 px-2 bg-muted hover:bg-muted/80 text-foreground border border-border rounded-lg text-[10px] font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer">
                    <Camera className="w-3 h-3 text-primary" />
                    {src ? 'Ganti Foto' : 'Upload Foto'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleAdminUploadPhoto(label, file);
                      }}
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </div>

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
                <label className="block font-bold text-foreground mb-1">Nama Pelanggan *</label>
                <input
                  type="text"
                  required
                  value={editFormData.customerName}
                  onChange={(e) => setEditFormData({ ...editFormData, customerName: e.target.value })}
                  className="w-full p-2.5 bg-background border border-input rounded-xl focus:ring-2 focus:ring-primary outline-none font-mono"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-foreground mb-1">Nomor WhatsApp Pelanggan *</label>
                  <input
                    type="text"
                    required
                    value={editFormData.customerPhone}
                    onChange={(e) => setEditFormData({ ...editFormData, customerPhone: e.target.value })}
                    className="w-full p-2.5 bg-background border border-input rounded-xl focus:ring-2 focus:ring-primary outline-none font-mono"
                  />
                </div>

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
              </div>

              <div>
                <label className="block font-bold text-foreground mb-1">Alamat Pelanggan *</label>
                <textarea
                  rows={2}
                  required
                  value={editFormData.customerAddress}
                  onChange={(e) => setEditFormData({ ...editFormData, customerAddress: e.target.value })}
                  className="w-full p-2.5 bg-background border border-input rounded-xl focus:ring-2 focus:ring-primary outline-none font-mono"
                />
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
