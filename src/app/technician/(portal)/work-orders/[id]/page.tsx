'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { 
  ArrowLeft, CheckCircle2, Loader2, MapPin, Phone, 
  Camera, CheckSquare, Wrench, Save, Send, ExternalLink,
  Navigation, ShieldCheck, ChevronRight, ChevronLeft, RefreshCw, Smartphone
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/cyberpunk/CyberToast';

export const dynamic = 'force-dynamic';

export default function TechnicianWorkOrderWizardPage() {
  const router = useRouter();
  const params = useParams();
  const { addToast } = useToast();
  
  const [wo, setWo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Wizard Step State (1, 2, or 3)
  const [step, setStep] = useState<number>(1);

  // Step 1: Equipment Checklist
  const [checklist, setChecklist] = useState({
    modem: false,
    kabel: false,
    tang: false,
    konektor: false,
    klem: false,
  });
  const [isPrepared, setIsPrepared] = useState(false);

  // Step 2 & 3: Technical Report & GPS Data
  const [reportData, setReportData] = useState({
    odpName: '',
    port: '',
    odpLat: '',
    odpLng: '',
    modemType: 'ZTE / Huawei / FiberHome',
    sn: '',
    mac: '',
    rxSignal: '',
    dwRoll: '',
    klemCount: '',
    shookCount: '',
    notes: '',
  });

  // GPS Coordinates for Customer House
  const [customerGeo, setCustomerGeo] = useState<{ lat: number | null; lng: number | null }>({
    lat: null,
    lng: null,
  });
  const [geoLoading, setGeoLoading] = useState(false);
  const [odpGeoLoading, setOdpGeoLoading] = useState(false);

  // Photos State
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  const storageKey = `tech_spk_wizard_${params.id}`;

  useEffect(() => {
    fetchWo();
  }, [params.id]);

  // Load Saved Draft Progress from LocalStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && wo) {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.step) setStep(parsed.step);
          if (parsed.checklist) setChecklist(parsed.checklist);
          if (parsed.isPrepared) setIsPrepared(parsed.isPrepared);
          if (parsed.reportData) setReportData(prev => ({ ...prev, ...parsed.reportData }));
          if (parsed.photos) setPhotos(prev => ({ ...prev, ...parsed.photos }));
          if (parsed.customerGeo) setCustomerGeo(parsed.customerGeo);
        }
      } catch (e) {
        console.error('Failed to load wizard draft:', e);
      }
    }
  }, [wo]);

  // Save Progress to LocalStorage on Change
  const saveProgress = (updatedStep?: number, updatedData?: any) => {
    if (typeof window === 'undefined' || !params.id) return;
    try {
      const draft = {
        step: updatedStep || step,
        checklist,
        isPrepared,
        reportData: updatedData?.reportData || reportData,
        photos: updatedData?.photos || photos,
        customerGeo,
      };
      localStorage.setItem(storageKey, JSON.stringify(draft));
    } catch (e) {
      console.error('Failed to save draft:', e);
    }
  };

  const fetchWo = async () => {
    try {
      const res = await fetch(`/api/technician/work-orders/${params.id}`);
      if (res.ok) {
        const data = await res.json();
        setWo(data.workOrder);
        if (data.workOrder.isPrepared) setIsPrepared(true);
        if (data.workOrder.equipmentChecklist) setChecklist(data.workOrder.equipmentChecklist);
        if (data.workOrder.reportData) setReportData(prev => ({ ...prev, ...data.workOrder.reportData }));

        // Initial customer coordinates if exists
        if (data.workOrder.customer?.latitude && data.workOrder.customer?.longitude) {
          setCustomerGeo({
            lat: data.workOrder.customer.latitude,
            lng: data.workOrder.customer.longitude,
          });
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Get Current Location via Geolocation API
  const captureCustomerGps = () => {
    if (!navigator.geolocation) {
      addToast({ type: 'error', title: 'GPS Tidak Didukung', description: 'Browser HP Anda tidak mendukung Geolocation.' });
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCustomerGeo({ lat, lng });
        setGeoLoading(false);
        addToast({
          type: 'success',
          title: '📍 Tikor GPS Pelanggan Terekam',
          description: `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`,
        });
        saveProgress(step);
      },
      (err) => {
        setGeoLoading(false);
        addToast({ type: 'error', title: 'Gagal Mengambil GPS', description: err.message || 'Pastikan Izin Akses Lokasi (GPS) Aktif!' });
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const captureOdpGps = () => {
    if (!navigator.geolocation) {
      addToast({ type: 'error', title: 'GPS Tidak Didukung', description: 'Browser HP Anda tidak mendukung Geolocation.' });
      return;
    }
    setOdpGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(6);
        const lng = pos.coords.longitude.toFixed(6);
        setReportData(prev => {
          const updated = { ...prev, odpLat: lat, odpLng: lng };
          saveProgress(step, { reportData: updated });
          return updated;
        });
        setOdpGeoLoading(false);
        addToast({
          type: 'success',
          title: '📍 Tikor GPS ODP Terekam',
          description: `Lat: ${lat}, Lng: ${lng}`,
        });
      },
      (err) => {
        setOdpGeoLoading(false);
        addToast({ type: 'error', title: 'Gagal Mengambil GPS ODP', description: err.message || 'Pastikan Izin Akses Lokasi (GPS) Aktif!' });
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  // Upload Photo File
  const handlePhotoUpload = async (key: string, e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingKey(key);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/technician/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.url) {
        const newPhotos = { ...photos, [key]: data.url };
        setPhotos(newPhotos);
        saveProgress(step, { photos: newPhotos });
        addToast({ type: 'success', title: `Foto ${key} Berhasil Diunggah` });
      } else {
        addToast({ type: 'error', title: 'Gagal Mengunggah Foto', description: data.error || 'Terjadi kesalahan' });
      }
    } catch {
      addToast({ type: 'error', title: 'Gagal Mengunggah Foto', description: 'Kesalahan koneksi ke server' });
    } finally {
      setUploadingKey(null);
    }
  };

  const goToStep = (nextStep: number) => {
    setStep(nextStep);
    saveProgress(nextStep);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Submit Final Report & Complete Work Order
  const submitComplete = async () => {
    if (!photos['Foto ONT Menyala'] || !photos['Foto Rumah']) {
      addToast({
        type: 'error',
        title: 'Foto Belum Lengkap',
        description: 'Wajib mengunggah Foto ONT Menyala dan Foto Tampak Depan Rumah!',
      });
      return;
    }

    if (!confirm('Apakah Anda yakin laporan ini sudah tuntas & pekerjaan selesai? Progress akan dikirimkan ke Admin.')) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/technician/work-orders/${params.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isPrepared: true,
          equipmentChecklist: checklist,
          reportData,
          reportPhotos: photos,
          customerLat: customerGeo.lat,
          customerLng: customerGeo.lng,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem(storageKey);
        }
        addToast({ type: 'success', title: 'Pekerjaan Selesai!', description: 'Laporan SPK berhasil dikirim ke Admin.' });
        router.push('/technician/work-orders');
      } else {
        addToast({ type: 'error', title: 'Gagal Menyelesaikan SPK', description: data.error || 'Terjadi kesalahan' });
      }
    } catch {
      addToast({ type: 'error', title: 'Gagal Menyelesaikan SPK', description: 'Gagal terhubung ke server' });
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
      <div className="p-8 text-center text-rose-500 font-bold">
        Surat Tugas tidak ditemukan
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6 pb-24">
      {/* Top Bar */}
      <button 
        onClick={() => router.push('/technician/work-orders')} 
        className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Kembali ke Daftar Pekerjaan
      </button>

      {/* Customer Brief Card */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-3">
        <div className="flex justify-between items-start">
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-primary">ID SPK: #{wo.id.slice(-8).toUpperCase()}</span>
            <h1 className="text-lg font-bold font-display text-foreground mt-0.5">{wo.customerName}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Tipe Pekerjaan: <strong className="text-foreground font-mono">{wo.issueType?.replace('_', ' ')}</strong></p>
          </div>
          <span className={cn('px-2.5 py-1 rounded-full font-mono text-[10px] uppercase font-bold border', 
            wo.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-amber-500/10 text-amber-600 border-amber-500/20')}>
            {wo.status}
          </span>
        </div>

        <div className="space-y-1.5 text-xs pt-2 border-t border-border">
          <div className="flex items-start gap-1.5 text-muted-foreground">
            <MapPin className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
            <span className="line-clamp-2 leading-relaxed text-foreground">{wo.customerAddress}</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Phone className="w-3.5 h-3.5 text-primary shrink-0" />
            <a href={`tel:${wo.customerPhone}`} className="font-mono text-primary font-bold hover:underline">{wo.customerPhone}</a>
          </div>
        </div>
      </div>

      {/* 3-STEP WIZARD PROGRESS BAR */}
      <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
        <div className="flex justify-between items-center relative">
          <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-border -translate-y-1/2 z-0" />

          {[
            { id: 1, title: 'Persiapan', icon: '1' },
            { id: 2, title: 'Titik ODP', icon: '2' },
            { id: 3, title: 'Rumah & Final', icon: '3' },
          ].map((s) => {
            const isActive = step === s.id;
            const isDone = step > s.id;
            return (
              <div 
                key={s.id}
                onClick={() => isDone && goToStep(s.id)}
                className="relative z-10 flex flex-col items-center gap-1 cursor-pointer"
              >
                <div className={cn(
                  'w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-all shadow-md',
                  isDone ? 'bg-emerald-600 text-white' :
                  isActive ? 'bg-primary text-primary-foreground ring-4 ring-primary/20 scale-110' :
                  'bg-muted text-muted-foreground border border-border'
                )}>
                  {isDone ? <CheckCircle2 className="w-5 h-5" /> : s.icon}
                </div>
                <span className={cn('text-[10px] font-bold uppercase tracking-wider', isActive ? 'text-primary' : 'text-muted-foreground')}>
                  {s.title}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* WIZARD STEP 1: PERSIAPAN & KEBERANGKATAN */}
      {step === 1 && (
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-5">
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-primary">Langkah 1 dari 3</span>
            <h2 className="text-base font-bold text-foreground font-display flex items-center gap-2 mt-0.5">
              <CheckSquare className="w-5 h-5 text-primary" />
              Ceklis Persiapan Peralatan Lapangan
            </h2>
            <p className="text-xs text-muted-foreground mt-1">Pastikan seluruh material &amp; alat kerja lengkap sebelum berangkat ke rumah pelanggan.</p>
          </div>

          <div className="space-y-2.5 pt-2">
            {[
              ['modem', 'Modem ONT Baru (ZTE / Huawei / FiberHome)'],
              ['kabel', 'Kabel Dropwire (Roll DW 1 Core)'],
              ['konektor', 'Fast Connector & Patch Cord SC/UPC'],
              ['klem', 'Aksesoris (Klem Kabel DW, S-Hook, Paku Beton)'],
              ['tang', 'Peralatan Lapangan (Tang Stripper, Cleaver, OPM, VFL)'],
            ].map(([key, label]) => (
              <label 
                key={key} 
                className="flex items-center gap-3 p-3 bg-background border border-border rounded-xl hover:bg-muted/40 transition-colors cursor-pointer"
              >
                <input 
                  type="checkbox"
                  checked={(checklist as any)[key]}
                  onChange={(e) => {
                    const updated = { ...checklist, [key]: e.target.checked };
                    setChecklist(updated);
                    saveProgress(1, { checklist: updated });
                  }}
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                />
                <span className="text-xs font-bold text-foreground">{label}</span>
              </label>
            ))}
          </div>

          <div className="pt-4 border-t border-border flex justify-end">
            <button
              onClick={() => {
                setIsPrepared(true);
                goToStep(2);
              }}
              className="w-full sm:w-auto px-6 py-3 bg-primary text-primary-foreground font-bold text-xs rounded-xl shadow-md hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              🚀 Mulai Pekerjaan &amp; Berangkat <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* WIZARD STEP 2: PEKERJAAN LAPANGAN & FOTO ODP */}
      {step === 2 && (
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-6">
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-primary">Langkah 2 dari 3</span>
            <h2 className="text-base font-bold text-foreground font-display flex items-center gap-2 mt-0.5">
              <MapPin className="w-5 h-5 text-primary" />
              Titik ODP &amp; Colok Port (Lokasi Tiang)
            </h2>
            <p className="text-xs text-muted-foreground mt-1">Dokumentasikan Box ODP &amp; Port yang digunakan saat penarikan kabel di tiang.</p>
          </div>

          {/* ODP Location GPS Capture */}
          <div className="p-4 bg-muted/40 border border-border rounded-xl space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-foreground">📍 Koordinat GPS ODP Saat Ini</span>
              <button
                onClick={captureOdpGps}
                disabled={odpGeoLoading}
                className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg font-mono text-[10px] font-bold flex items-center gap-1.5 shadow-sm"
              >
                {odpGeoLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5" />}
                {reportData.odpLat ? 'Update GPS ODP' : 'Ambil GPS ODP'}
              </button>
            </div>
            {reportData.odpLat ? (
              <div className="font-mono text-xs text-emerald-600 dark:text-emerald-400 font-bold bg-background p-2 rounded border border-border">
                Lat: {reportData.odpLat}, Lng: {reportData.odpLng}
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground italic">Belum mengambil lokasi GPS tiang ODP.</p>
            )}
          </div>

          {/* Inputs for ODP Name & Port */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-foreground mb-1">Nama ODP *</label>
              <input
                type="text"
                placeholder="Cth: ODP KPS06-A01"
                value={reportData.odpName}
                onChange={(e) => {
                  const updated = { ...reportData, odpName: e.target.value };
                  setReportData(updated);
                  saveProgress(2, { reportData: updated });
                }}
                className="w-full p-2.5 bg-background border border-input rounded-xl focus:ring-2 focus:ring-primary outline-none font-mono"
              />
            </div>
            <div>
              <label className="block font-bold text-foreground mb-1">Nomor Port ODP *</label>
              <input
                type="text"
                placeholder="Cth: Port 3"
                value={reportData.port}
                onChange={(e) => {
                  const updated = { ...reportData, port: e.target.value };
                  setReportData(updated);
                  saveProgress(2, { reportData: updated });
                }}
                className="w-full p-2.5 bg-background border border-input rounded-xl focus:ring-2 focus:ring-primary outline-none font-mono"
              />
            </div>
          </div>

          {/* Photo Upload: Box ODP & Port ODP */}
          <div className="space-y-4 pt-2">
            <label className="block text-xs font-bold text-foreground">📸 Foto Dokumentasi ODP</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {['Foto Box ODP', 'Foto Port ODP'].map((key) => (
                <div key={key} className="bg-background border border-border rounded-xl p-3 flex flex-col items-center justify-center space-y-2">
                  {photos[key] ? (
                    <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden border border-border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photos[key]} alt={key} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-full aspect-[4/3] bg-muted/30 border border-dashed border-border rounded-lg flex flex-col items-center justify-center text-muted-foreground p-4">
                      <Camera className="w-8 h-8 opacity-40 mb-1" />
                      <span className="text-[11px] font-bold">{key}</span>
                    </div>
                  )}

                  <label className="w-full py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-center font-mono text-xs font-bold cursor-pointer transition-colors flex items-center justify-center gap-1.5">
                    {uploadingKey === key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                    {photos[key] ? 'Ganti Foto' : `Ambil ${key}`}
                    <input 
                      type="file" 
                      accept="image/*" 
                      capture="environment"
                      onChange={(e) => handlePhotoUpload(key, e)} 
                      className="hidden" 
                    />
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-border flex justify-between gap-3">
            <button
              onClick={() => goToStep(1)}
              className="px-4 py-2.5 bg-muted text-foreground font-bold text-xs rounded-xl flex items-center gap-1.5"
            >
              <ChevronLeft className="w-4 h-4" /> Kembali
            </button>
            <button
              onClick={() => goToStep(3)}
              className="px-6 py-2.5 bg-primary text-primary-foreground font-bold text-xs rounded-xl shadow-md hover:opacity-90 transition-opacity flex items-center gap-1.5"
            >
              ➡️ Lanjut ke Penarikan Kabel &amp; Rumah Pelanggan <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* WIZARD STEP 3: RUMAH PELANGGAN & FINALISASI */}
      {step === 3 && (
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-6">
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-primary">Langkah 3 dari 3</span>
            <h2 className="text-base font-bold text-foreground font-display flex items-center gap-2 mt-0.5">
              <Wrench className="w-5 h-5 text-primary" />
              Instalasi Rumah Pelanggan &amp; Finalisasi
            </h2>
            <p className="text-xs text-muted-foreground mt-1">Lengkapi foto unit ONT terpasang, update koordinat pelanggan, dan rincian material.</p>
          </div>

          {/* Customer GPS Location Update */}
          <div className="p-4 bg-muted/40 border border-border rounded-xl space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-foreground">📍 Titik GPS Rumah Pelanggan</span>
              <button
                onClick={captureCustomerGps}
                disabled={geoLoading}
                className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg font-mono text-[10px] font-bold flex items-center gap-1.5 shadow-sm hover:bg-emerald-700"
              >
                {geoLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5" />}
                {customerGeo.lat ? 'Update GPS Pelanggan' : 'Ambil GPS Pelanggan'}
              </button>
            </div>
            {customerGeo.lat ? (
              <div className="font-mono text-xs text-emerald-600 dark:text-emerald-400 font-bold bg-background p-2 rounded border border-border">
                Lat: {customerGeo.lat.toFixed(6)}, Lng: {customerGeo.lng?.toFixed(6)}
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground italic">Belum ada titik lokasi GPS rumah pelanggan.</p>
            )}
          </div>

          {/* Hardware & Signal Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-foreground mb-1">Serial Number (SN) ONT *</label>
              <input
                type="text"
                placeholder="Cth: ZTEG12345678"
                value={reportData.sn}
                onChange={(e) => {
                  const updated = { ...reportData, sn: e.target.value };
                  setReportData(updated);
                  saveProgress(3, { reportData: updated });
                }}
                className="w-full p-2.5 bg-background border border-input rounded-xl focus:ring-2 focus:ring-primary outline-none font-mono"
              />
            </div>
            <div>
              <label className="block font-bold text-foreground mb-1">Sinyal Redaman Rx (dBm) *</label>
              <input
                type="text"
                placeholder="Cth: -19.5"
                value={reportData.rxSignal}
                onChange={(e) => {
                  const updated = { ...reportData, rxSignal: e.target.value };
                  setReportData(updated);
                  saveProgress(3, { reportData: updated });
                }}
                className="w-full p-2.5 bg-background border border-input rounded-xl focus:ring-2 focus:ring-primary outline-none font-mono"
              />
            </div>
            <div>
              <label className="block font-bold text-foreground mb-1">Panjang Kabel DW (Meter)</label>
              <input
                type="text"
                placeholder="Cth: 150"
                value={reportData.dwRoll}
                onChange={(e) => {
                  const updated = { ...reportData, dwRoll: e.target.value };
                  setReportData(updated);
                  saveProgress(3, { reportData: updated });
                }}
                className="w-full p-2.5 bg-background border border-input rounded-xl focus:ring-2 focus:ring-primary outline-none font-mono"
              />
            </div>
            <div>
              <label className="block font-bold text-foreground mb-1">MAC Address (Opsional)</label>
              <input
                type="text"
                placeholder="Cth: AA:BB:CC:DD:EE:FF"
                value={reportData.mac}
                onChange={(e) => {
                  const updated = { ...reportData, mac: e.target.value };
                  setReportData(updated);
                  saveProgress(3, { reportData: updated });
                }}
                className="w-full p-2.5 bg-background border border-input rounded-xl focus:ring-2 focus:ring-primary outline-none font-mono"
              />
            </div>
          </div>

          {/* Photo Upload: Foto ONT Menyala & Foto Rumah */}
          <div className="space-y-4 pt-2">
            <label className="block text-xs font-bold text-foreground">📸 Foto Instalasi Pelanggan *</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {['Foto ONT Menyala', 'Foto Rumah'].map((key) => (
                <div key={key} className="bg-background border border-border rounded-xl p-3 flex flex-col items-center justify-center space-y-2">
                  {photos[key] ? (
                    <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden border border-border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photos[key]} alt={key} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-full aspect-[4/3] bg-muted/30 border border-dashed border-border rounded-lg flex flex-col items-center justify-center text-muted-foreground p-4">
                      <Camera className="w-8 h-8 opacity-40 mb-1" />
                      <span className="text-[11px] font-bold">{key}</span>
                    </div>
                  )}

                  <label className="w-full py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-center font-mono text-xs font-bold cursor-pointer transition-colors flex items-center justify-center gap-1.5">
                    {uploadingKey === key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                    {photos[key] ? 'Ganti Foto' : `Ambil ${key}`}
                    <input 
                      type="file" 
                      accept="image/*" 
                      capture="environment"
                      onChange={(e) => handlePhotoUpload(key, e)} 
                      className="hidden" 
                    />
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-border flex justify-between gap-3">
            <button
              onClick={() => goToStep(2)}
              className="px-4 py-2.5 bg-muted text-foreground font-bold text-xs rounded-xl flex items-center gap-1.5"
            >
              <ChevronLeft className="w-4 h-4" /> Kembali ke Step 2
            </button>
            <button
              onClick={submitComplete}
              disabled={submitting}
              className="px-6 py-3 bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-lg hover:bg-emerald-700 transition-all flex items-center gap-2"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              ✅ Selesaikan Pekerjaan SPK
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
