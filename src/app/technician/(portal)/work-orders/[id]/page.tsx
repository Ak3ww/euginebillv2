'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { 
  ArrowLeft, CheckCircle2, Loader2, MapPin, Phone, 
  Camera, CheckSquare, Wrench, Save, Send, ExternalLink
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
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setPhotos(prev => ({ ...prev, [key]: url }));
    }
  };

  const submitComplete = async () => {
    if (!confirm('Apakah Anda yakin laporan ini sudah lengkap dan pemasangan selesai? Tagihan pertama akan otomatis terkirim via WhatsApp ke Pelanggan.')) return;
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
        addToast({ type: 'success', title: 'Berhasil', description: 'SPK selesai, Invoice terkirim ke WhatsApp Pelanggan!' });
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

  return (
    <div className="p-4 md:p-6 w-full max-w-4xl mx-auto space-y-6 pb-24">
      <button 
        onClick={() => router.back()} 
        className="flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Kembali ke SPK
      </button>

      {/* Header Info Card */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-primary">Tugas #SPK-{wo.id.slice(-6).toUpperCase()}</span>
            <h1 className="text-xl font-bold text-foreground mt-0.5">{wo.customerName}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Tipe Pekerjaan: <strong className="text-foreground">{wo.issueType.replace('_', ' ')}</strong></p>
          </div>
          <span className={cn('px-3 py-1 rounded-full font-mono text-xs uppercase tracking-wider font-bold border', 
            wo.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-amber-500/10 text-amber-600 border-amber-500/20')}>
            {wo.status}
          </span>
        </div>

        <div className="space-y-2 pt-2 border-t border-border">
          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 p-3 rounded-xl">
            <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <span className="leading-relaxed text-foreground">{wo.customerAddress}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 p-3 rounded-xl">
            <Phone className="w-4 h-4 text-primary shrink-0" />
            <span className="font-mono text-foreground font-bold">{wo.customerPhone}</span>
          </div>
        </div>

        {/* Action Buttons for Field Technician */}
        <div className="flex gap-2 pt-2">
          <a
            href={`https://wa.me/${wo.customerPhone.replace(/\D/g, '')}`}
            target="_blank"
            rel="noreferrer"
            className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-opacity shadow-sm"
          >
            <Send className="w-4 h-4" /> Hubungi WhatsApp
          </a>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(wo.customerAddress)}`}
            target="_blank"
            rel="noreferrer"
            className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-opacity shadow-sm"
          >
            <MapPin className="w-4 h-4" /> Petunjuk Maps
          </a>
        </div>
      </div>

      {wo.status !== 'COMPLETED' && (
        <>
          {/* Phase 1: Checklist Persiapan Alat */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-primary" />
              1. Checklist Peralatan Lapangan
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {Object.keys(checklist).map((key) => (
                <label key={key} className="flex items-center gap-3 p-3 border border-border rounded-xl cursor-pointer hover:bg-muted/40 transition-colors">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded border-input text-primary focus:ring-primary" 
                    checked={checklist[key as keyof typeof checklist]}
                    disabled={isPrepared}
                    onChange={(e) => setChecklist({ ...checklist, [key]: e.target.checked })}
                  />
                  <span className="text-xs font-bold text-foreground capitalize">{key}</span>
                </label>
              ))}
            </div>
            {!isPrepared ? (
              <button 
                onClick={() => setIsPrepared(true)} 
                className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold text-xs hover:opacity-90 transition-opacity"
              >
                Konfirmasi Persiapan Selesai
              </button>
            ) : (
              <div className="w-full py-3 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 rounded-xl font-bold text-xs text-center flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> Peralatan Telah Siap Lengkap
              </div>
            )}
          </div>

          {/* Phase 2: Laporan Pemasangan / Perbaikan */}
          {isPrepared && (
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-5">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <Wrench className="w-5 h-5 text-primary" />
                2. Laporan Laporan Lapangan &amp; Perangkat
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1">ODP Name &amp; Port</label>
                  <input 
                    type="text" 
                    placeholder="Contoh: KMB01-C02 / Port 5" 
                    value={reportData.odpName} 
                    onChange={e => setReportData({...reportData, odpName: e.target.value})} 
                    className="w-full p-2.5 bg-background border border-input rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1">Tipe Modem ONT</label>
                  <input 
                    type="text" 
                    placeholder="Contoh: ZTE F670L" 
                    value={reportData.modemType} 
                    onChange={e => setReportData({...reportData, modemType: e.target.value})} 
                    className="w-full p-2.5 bg-background border border-input rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1">Serial Number (SN)</label>
                  <input 
                    type="text" 
                    placeholder="Contoh: ZTEGD0..." 
                    value={reportData.sn} 
                    onChange={e => setReportData({...reportData, sn: e.target.value})} 
                    className="w-full p-2.5 bg-background border border-input rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1">MAC Address</label>
                  <input 
                    type="text" 
                    placeholder="Contoh: 04:20:..." 
                    value={reportData.mac} 
                    onChange={e => setReportData({...reportData, mac: e.target.value})} 
                    className="w-full p-2.5 bg-background border border-input rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1">Sinyal Redaman Rx (dBm)</label>
                  <input 
                    type="text" 
                    placeholder="Contoh: -22.45" 
                    value={reportData.rxSignal} 
                    onChange={e => setReportData({...reportData, rxSignal: e.target.value})} 
                    className="w-full p-2.5 bg-background border border-input rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1">Panjang Kabel (DW Roll)</label>
                  <input 
                    type="text" 
                    placeholder="Contoh: 100 M" 
                    value={reportData.dwRoll} 
                    onChange={e => setReportData({...reportData, dwRoll: e.target.value})} 
                    className="w-full p-2.5 bg-background border border-input rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary" 
                  />
                </div>
              </div>

              {/* Upload Foto Dokumentasi dari Kamera HP */}
              <div className="border-t border-border pt-4">
                <h3 className="text-xs font-bold text-foreground mb-3">Foto Dokumentasi Pemasangan (Kamera HP)</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {['Foto ONT Depan', 'Foto SN ONT', 'Foto ODP', 'Foto Redaman Sinyal', 'Foto Rumah'].map((label, i) => (
                    <div 
                      key={i} 
                      className="relative aspect-[3/4] bg-background border-2 border-dashed border-border rounded-xl overflow-hidden group hover:border-primary transition-colors flex items-center justify-center"
                    >
                      {photos[label] ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={photos[label]} alt={label} className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center justify-center p-2 text-muted-foreground text-center">
                          <Camera className="w-6 h-6 mb-1 text-primary opacity-80" />
                          <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
                        </div>
                      )}
                      <input 
                        type="file" 
                        accept="image/*" 
                        capture="environment" 
                        onChange={(e) => handlePhotoUpload(label, e)} 
                        className="absolute inset-0 opacity-0 cursor-pointer" 
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-border">
                <button 
                  onClick={submitComplete} 
                  disabled={submitting} 
                  className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-md disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Selesaikan Tugas &amp; Kirim Invoice WA Otomatis
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {wo.status === 'COMPLETED' && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 p-8 rounded-2xl text-center space-y-2">
          <div className="w-16 h-16 bg-emerald-500/20 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-emerald-600">Pekerjaan Selesai!</h2>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Notifikasi WhatsApp otomatis berisi rincian invoice tagihan pertama telah dikirimkan ke pelanggan.
          </p>
        </div>
      )}
    </div>
  );
}
