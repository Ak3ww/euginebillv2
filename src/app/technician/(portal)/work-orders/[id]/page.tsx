'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { 
  ArrowLeft, CheckCircle2, Loader2, MapPin, Phone, 
  Camera, CheckSquare, Wrench, Save, Upload
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/cyberpunk/CyberToast';

export const dynamic = 'force-dynamic';

export default function WorkOrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { addToast } = useToast();
  
  const [wo, setWo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [checklist, setChecklist] = useState({
    modem: false,
    kabel: false,
    tang: false,
    konektor: false,
  });
  const [isPrepared, setIsPrepared] = useState(false);

  const [reportData, setReportData] = useState({
    odpName: '',
    port: '',
    modemType: '',
    sn: '',
    mac: '',
    dwRoll: '',
    paku: '',
    solasi: '',
    rxSignal: '',
    txSignal: '',
    notes: '',
  });

  // Simulated photo uploads (just base64 or paths in real app)
  const [photos, setPhotos] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchWo();
  }, [params.id]);

  const fetchWo = async () => {
    try {
      const res = await fetch(`/api/technician/work-orders/${params.id}`);
      if (res.ok) {
        const data = await res.json();
        setWo(data.workOrder);
        if (data.workOrder.isPrepared) setIsPrepared(true);
        if (data.workOrder.equipmentChecklist) setChecklist(data.workOrder.equipmentChecklist);
        if (data.workOrder.reportData) setReportData(data.workOrder.reportData);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = (key: string, e: any) => {
    const file = e.target.files[0];
    if (file) {
      // In a real app, upload to server and get URL. Here we simulate with object URL for preview.
      const url = URL.createObjectURL(file);
      setPhotos(prev => ({ ...prev, [key]: url }));
    }
  };

  const submitComplete = async () => {
    if (!confirm('Apakah Anda yakin laporan ini sudah lengkap dan pemasangan selesai? Tagihan akan otomatis terkirim.')) return;
    setSubmitting(true);
    try {
      const payload = {
        isPrepared,
        equipmentChecklist: checklist,
        reportData,
        reportPhotos: photos,
      };
      const res = await fetch(`/api/technician/work-orders/${params.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        addToast({ type: 'success', title: 'Berhasil', description: 'Tugas selesai, Invoice terkirim ke Pelanggan!' });
        router.push('/technician/work-orders');
      } else {
        addToast({ type: 'error', title: 'Gagal', description: data.error || 'Terjadi kesalahan' });
      }
    } catch (e) {
      addToast({ type: 'error', title: 'Gagal', description: 'Gagal menghubungi server' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-[var(--color-focus)]" /></div>;
  }
  if (!wo) return <div className="p-8 text-center text-red-500">Surat Tugas tidak ditemukan</div>;

  return (
    <div className="p-4 lg:p-8 w-full max-w-4xl mx-auto space-y-6 pb-32">
      <button onClick={() => router.back()} className="flex items-center gap-2 text-sm font-bold text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors">
        <ArrowLeft className="w-4 h-4" /> Kembali
      </button>

      {/* Header Info */}
      <div className="bg-white border border-[var(--color-rule)] rounded-[var(--radius-lg)] p-6 shadow-sm">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-xl font-bold font-display text-[var(--color-ink)]">{wo.customerName}</h1>
            <p className="text-xs font-mono text-[var(--color-muted)] mt-1">Tipe: {wo.issueType.replace('_', ' ')}</p>
          </div>
          <span className={cn('px-3 py-1 rounded-full font-mono text-xs uppercase tracking-wider font-bold border', 
            wo.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-amber-50 text-amber-600 border-amber-200')}>
            {wo.status}
          </span>
        </div>

        <div className="space-y-3 mt-6">
          <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
            <MapPin className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
            <span className="text-sm text-[var(--color-ink-2)] leading-relaxed">{wo.customerAddress}</span>
          </div>
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
            <Phone className="w-5 h-5 text-gray-400 shrink-0" />
            <span className="text-sm font-mono font-bold text-[var(--color-ink)]">{wo.customerPhone}</span>
          </div>
        </div>
      </div>

      {wo.status !== 'COMPLETED' && (
        <>
          {/* Phase 1: Persiapan */}
          <div className="bg-white border border-[var(--color-rule)] rounded-[var(--radius-lg)] p-6 shadow-sm">
            <h2 className="text-lg font-bold font-display text-[var(--color-ink)] flex items-center gap-2 mb-4">
              <CheckSquare className="w-5 h-5 text-[var(--color-focus)]" />
              1. Checklist Persiapan
            </h2>
            <div className="grid grid-cols-2 gap-4 mb-6">
              {Object.keys(checklist).map((key) => (
                <label key={key} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <input type="checkbox" className="w-5 h-5 rounded border-gray-300 text-[var(--color-focus)] focus:ring-[var(--color-focus)]" 
                    checked={checklist[key as keyof typeof checklist]}
                    disabled={isPrepared}
                    onChange={(e) => setChecklist({ ...checklist, [key]: e.target.checked })}
                  />
                  <span className="text-sm font-bold text-gray-700 capitalize">{key}</span>
                </label>
              ))}
            </div>
            {!isPrepared ? (
              <button onClick={() => setIsPrepared(true)} className="w-full py-3 bg-[var(--color-focus)] text-white rounded-lg font-bold text-sm hover:bg-[var(--color-focus)]/90 transition-colors">
                Konfirmasi Persiapan Selesai
              </button>
            ) : (
              <div className="w-full py-3 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-lg font-bold text-sm text-center flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> Persiapan Telah Dikonfirmasi
              </div>
            )}
          </div>

          {/* Phase 2: Laporan (only if prepared) */}
          {isPrepared && (
            <div className="bg-white border border-[var(--color-rule)] rounded-[var(--radius-lg)] p-6 shadow-sm space-y-6">
              <h2 className="text-lg font-bold font-display text-[var(--color-ink)] flex items-center gap-2">
                <Wrench className="w-5 h-5 text-[var(--color-focus)]" />
                2. Laporan Pemasangan (Daily IB)
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-[var(--color-muted)] mb-1">ODP Name & Port</label>
                  <input type="text" placeholder="Cth: KMB01-C02 / Port 5" value={reportData.odpName} onChange={e => setReportData({...reportData, odpName: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono focus:border-[var(--color-focus)] focus:ring-1 focus:ring-[var(--color-focus)]/20 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--color-muted)] mb-1">Modem Type</label>
                  <input type="text" placeholder="Cth: F670L" value={reportData.modemType} onChange={e => setReportData({...reportData, modemType: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono focus:border-[var(--color-focus)] focus:ring-1 focus:ring-[var(--color-focus)]/20 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--color-muted)] mb-1">Serial Number (SN)</label>
                  <input type="text" placeholder="ZTEGD0..." value={reportData.sn} onChange={e => setReportData({...reportData, sn: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono focus:border-[var(--color-focus)] focus:ring-1 focus:ring-[var(--color-focus)]/20 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--color-muted)] mb-1">MAC Address</label>
                  <input type="text" placeholder="04:20:..." value={reportData.mac} onChange={e => setReportData({...reportData, mac: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono focus:border-[var(--color-focus)] focus:ring-1 focus:ring-[var(--color-focus)]/20 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--color-muted)] mb-1">Rx Signal (dBm)</label>
                  <input type="text" placeholder="-22.45" value={reportData.rxSignal} onChange={e => setReportData({...reportData, rxSignal: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono focus:border-[var(--color-focus)] focus:ring-1 focus:ring-[var(--color-focus)]/20 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--color-muted)] mb-1">Panjang Kabel (DW Roll)</label>
                  <input type="text" placeholder="100 M" value={reportData.dwRoll} onChange={e => setReportData({...reportData, dwRoll: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono focus:border-[var(--color-focus)] focus:ring-1 focus:ring-[var(--color-focus)]/20 outline-none" />
                </div>
              </div>

              <div className="border-t border-[var(--color-rule)] pt-6">
                <h3 className="text-sm font-bold text-[var(--color-ink)] mb-4">Foto Dokumentasi Wajib</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {['Foto ONT Depan', 'Foto SN ONT', 'Foto ODP', 'Foto Speedtest', 'Foto Rumah'].map((label, i) => (
                    <div key={i} className="relative aspect-[3/4] bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl overflow-hidden group hover:border-[var(--color-focus)]/50 transition-colors">
                      {photos[label] ? (
                        <img src={photos[label]} alt={label} className="w-full h-full object-cover" />
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 group-hover:text-[var(--color-focus)]">
                          <Camera className="w-8 h-8 mb-2" />
                          <span className="text-[10px] font-bold uppercase tracking-wider text-center px-2">{label}</span>
                        </div>
                      )}
                      <input type="file" accept="image/*" capture="environment" onChange={(e) => handlePhotoUpload(label, e)} className="absolute inset-0 opacity-0 cursor-pointer" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-6">
                <button onClick={submitComplete} disabled={submitting} className="w-full py-4 bg-[var(--color-focus)] text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-[var(--color-focus)]/90 transition-all shadow-md disabled:opacity-50">
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  Selesaikan Tugas & Kirim Invoice
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {wo.status === 'COMPLETED' && (
        <div className="bg-emerald-50 border border-emerald-200 p-8 rounded-[var(--radius-lg)] text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold text-emerald-800 font-display">Instalasi Selesai!</h2>
          <p className="text-emerald-600 mt-2 text-sm">Invoice otomatis telah terkirim ke WhatsApp pelanggan.</p>
        </div>
      )}
    </div>
  );
}
