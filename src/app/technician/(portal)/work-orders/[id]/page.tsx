'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { 
  ArrowLeft, CheckCircle2, Loader2, MapPin, Phone, 
  Camera, CheckSquare, Wrench, Save, Send, ExternalLink,
  Navigation, ShieldCheck, ChevronRight, ChevronLeft, RefreshCw, Smartphone,
  X, Image as ImageIcon, AlertCircle, FlipHorizontal, Timer, Award, Star, Zap, Trophy, Shield
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/cyberpunk/CyberToast';
import { calculateTechnicianScore, PerformanceRating, EUGINEBILL_HQ } from '@/lib/geo-utils';

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

  // Gamified Stopwatch Timer State
  const [startTimeMs, setStartTimeMs] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  // Performance Rating Modal State
  const [ratingResult, setRatingResult] = useState<PerformanceRating | null>(null);

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

  // Photos State & Live Camera Viewfinder Modal
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  // Live Camera Modal State
  const [cameraModalKey, setCameraModalKey] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const storageKey = `tech_spk_wizard_${params.id}`;

  useEffect(() => {
    fetchWo();
  }, [params.id]);

  // Load Saved Draft Progress & Stopwatch from LocalStorage
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
          if (parsed.startTimeMs) setStartTimeMs(parsed.startTimeMs);
        }
      } catch (e) {
        console.error('Failed to load wizard draft:', e);
      }
    }
  }, [wo]);

  // Stopwatch Interval Ticker
  useEffect(() => {
    if (!startTimeMs) return;
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTimeMs) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTimeMs]);

  // Format Timer into HH:MM:SS
  const formatTimer = (totalSecs: number) => {
    const hours = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return hours > 0 ? `${pad(hours)}:${pad(mins)}:${pad(secs)}` : `${pad(mins)}:${pad(secs)}`;
  };

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
        startTimeMs: updatedData?.startTimeMs || startTimeMs,
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

  // --- MANDATORY STEP VALIDATION FUNCTIONS ---
  const validateStep1 = (): boolean => {
    const allChecked = Object.values(checklist).every(Boolean);
    if (!allChecked) {
      addToast({
        type: 'error',
        title: '⚠️ Ceklis Belum Lengkap',
        description: 'Wajib mencentang SEMUA 5 item peralatan sebelum berangkat!',
      });
      return false;
    }
    return true;
  };

  const validateStep2 = (): boolean => {
    const missing: string[] = [];
    if (!reportData.odpName.trim()) missing.push('Nama ODP');
    if (!reportData.port.trim()) missing.push('Nomor Port ODP');
    if (!reportData.odpLat || !reportData.odpLng) missing.push('Titik GPS ODP');
    if (!photos['Foto Box ODP']) missing.push('Foto Box ODP');
    if (!photos['Foto Port ODP']) missing.push('Foto Port ODP');

    if (missing.length > 0) {
      addToast({
        type: 'error',
        title: '⚠️ Data ODP Belum Lengkap',
        description: `Wajib mengisi: ${missing.join(', ')}!`,
      });
      return false;
    }
    return true;
  };

  const validateStep3 = (): boolean => {
    const missing: string[] = [];
    if (!reportData.sn.trim()) missing.push('Serial Number (SN) ONT');
    if (!reportData.rxSignal.trim()) missing.push('Sinyal Redaman Rx (dBm)');
    if (!customerGeo.lat || !customerGeo.lng) missing.push('Titik GPS Rumah Pelanggan');
    if (!photos['Foto ONT Menyala']) missing.push('Foto ONT Menyala');
    if (!photos['Foto Rumah']) missing.push('Foto Rumah');

    if (missing.length > 0) {
      addToast({
        type: 'error',
        title: '⚠️ Laporan Final Belum Lengkap',
        description: `Wajib melengkapi: ${missing.join(', ')}!`,
      });
      return false;
    }
    return true;
  };

  // Navigation Guard & Stopwatch Start
  const handleNextStep = (targetStep: number) => {
    if (targetStep === 2) {
      if (!validateStep1()) return;
      setIsPrepared(true);

      // Start Stopwatch if not started yet!
      if (!startTimeMs) {
        const now = Date.now();
        setStartTimeMs(now);
        saveProgress(2, { startTimeMs: now });
        addToast({
          type: 'success',
          title: '⏱️ Stopwatch Lapangan Dimulai!',
          description: 'Waktu perjalanan & pemasangan mulai dihitung otomatis.',
        });
      }
    } else if (targetStep === 3) {
      if (!validateStep2()) return;
    }
    setStep(targetStep);
    saveProgress(targetStep);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

  // --- LIVE WEBRTC CAMERA CONTROLLER ---
  const startCamera = async (mode: 'environment' | 'user' = facingMode) => {
    setCameraLoading(true);
    setCameraError(null);
    stopCameraStream();

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Kamera langsung tidak didukung di browser ini. Gunakan tombol Unggah dari Galeri.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err: any) {
      console.error('Camera Stream Error:', err);
      setCameraError(err.message || 'Gagal mengakses kamera HP. Pastikan Izin Kamera Diizinkan di Pengaturan HP Anda.');
    } finally {
      setCameraLoading(false);
    }
  };

  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const openCameraModal = (key: string) => {
    setCameraModalKey(key);
    startCamera('environment');
  };

  const closeCameraModal = () => {
    stopCameraStream();
    setCameraModalKey(null);
  };

  // Capture Live Snapshot from Video Stream & Upload
  const captureSnapshot = async () => {
    if (!videoRef.current || !cameraModalKey) return;

    setUploadingKey(cameraModalKey);
    try {
      const video = videoRef.current;
      const canvas = canvasRef.current || document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D rendering failed');

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(async (blob) => {
        if (!blob) {
          addToast({ type: 'error', title: 'Gagal mengambil gambar' });
          setUploadingKey(null);
          return;
        }

        const file = new File([blob], `${cameraModalKey.replace(/\s+/g, '_')}_${Date.now()}.jpg`, {
          type: 'image/jpeg',
        });

        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/technician/upload', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();
        if (res.ok && data.url) {
          const newPhotos = { ...photos, [cameraModalKey]: data.url };
          setPhotos(newPhotos);
          saveProgress(step, { photos: newPhotos });
          addToast({ type: 'success', title: `📸 Foto ${cameraModalKey} Berhasil Diriwayat` });
          closeCameraModal();
        } else {
          addToast({ type: 'error', title: 'Gagal Mengunggah Foto', description: data.error || 'Terjadi kesalahan' });
        }
        setUploadingKey(null);
      }, 'image/jpeg', 0.85);

    } catch (e: any) {
      console.error(e);
      addToast({ type: 'error', title: 'Gagal Mengambil Foto', description: e.message || 'Terjadi kesalahan' });
      setUploadingKey(null);
    }
  };

  // Upload Photo File from Gallery Fallback
  const handlePhotoUploadFromGallery = async (key: string, e: any) => {
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
        if (cameraModalKey) closeCameraModal();
      } else {
        addToast({ type: 'error', title: 'Gagal Mengunggah Foto', description: data.error || 'Terjadi kesalahan' });
      }
    } catch {
      addToast({ type: 'error', title: 'Gagal Mengunggah Foto', description: 'Kesalahan koneksi ke server' });
    } finally {
      setUploadingKey(null);
    }
  };

  // Submit Final Report & Complete Work Order with Score Gamification
  const submitComplete = async () => {
    if (!validateStep3()) return;

    if (!confirm('Apakah Anda yakin laporan ini sudah tuntas & pekerjaan selesai? Progress akan dikirimkan ke Admin.')) return;

    setSubmitting(true);
    try {
      const endTime = Date.now();
      const start = startTimeMs || (endTime - 1200000); // Fallback 20 mins if timer wasn't started

      // Calculate Performance Score & Geodesic Distance
      const rating = calculateTechnicianScore(
        start,
        endTime,
        customerGeo.lat!,
        customerGeo.lng!,
        reportData.odpLat ? parseFloat(reportData.odpLat) : null,
        reportData.odpLng ? parseFloat(reportData.odpLng) : null
      );

      const res = await fetch(`/api/technician/work-orders/${params.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isPrepared: true,
          equipmentChecklist: checklist,
          reportData: {
            ...reportData,
            performanceRating: rating,
          },
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
        // Show Score Celebration Overlay
        setRatingResult(rating);
      } else {
        addToast({ type: 'error', title: 'Gagal Menyelesaikan SPK', description: data.error || 'Terjadi kesalahan' });
        setSubmitting(false);
      }
    } catch {
      addToast({ type: 'error', title: 'Gagal Menyelesaikan SPK', description: 'Gagal terhubung ke server' });
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
      {/* Top Bar with Dynamic Stopwatch Ticker */}
      <div className="flex justify-between items-center">
        <button 
          onClick={() => router.push('/technician/work-orders')} 
          className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali
        </button>

        {startTimeMs && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-mono text-xs font-bold shadow-sm animate-pulse">
            <Timer className="w-4 h-4 text-emerald-500" />
            <span>⏱️ {formatTimer(elapsedSeconds)}</span>
          </div>
        )}
      </div>

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
                onClick={() => {
                  if (s.id === 1 || (s.id === 2 && validateStep1()) || (s.id === 3 && validateStep1() && validateStep2())) {
                    setStep(s.id);
                  }
                }}
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
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-primary">Langkah 1 dari 3 (Wajib)</span>
            <h2 className="text-base font-bold text-foreground font-display flex items-center gap-2 mt-0.5">
              <CheckSquare className="w-5 h-5 text-primary" />
              Ceklis Persiapan Peralatan Lapangan
            </h2>
            <p className="text-xs text-muted-foreground mt-1">Pastikan seluruh 5 material &amp; alat kerja tercentang sebelum dapat meluncur ke lokasi.</p>
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
                className={cn(
                  'flex items-center gap-3 p-3.5 rounded-xl border transition-colors cursor-pointer',
                  (checklist as any)[key] ? 'bg-emerald-500/10 border-emerald-500/30 text-foreground' : 'bg-background border-border text-muted-foreground'
                )}
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
                <span className="text-xs font-bold">{label}</span>
              </label>
            ))}
          </div>

          <div className="pt-4 border-t border-border flex justify-end">
            <button
              onClick={() => handleNextStep(2)}
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
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-primary">Langkah 2 dari 3 (Wajib)</span>
            <h2 className="text-base font-bold text-foreground font-display flex items-center gap-2 mt-0.5">
              <MapPin className="w-5 h-5 text-primary" />
              Titik ODP &amp; Colok Port (Lokasi Tiang)
            </h2>
            <p className="text-xs text-muted-foreground mt-1">Dokumentasikan Box ODP &amp; Port yang digunakan saat penarikan kabel di tiang.</p>
          </div>

          {/* ODP Location GPS Capture */}
          <div className="p-4 bg-muted/40 border border-border rounded-xl space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-foreground">📍 Koordinat GPS ODP Saat Ini *</span>
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
              <p className="text-[11px] text-rose-500 font-bold italic">⚠️ Wajib mengambil lokasi GPS tiang ODP saat berada di tiang!</p>
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
            <label className="block text-xs font-bold text-foreground">📸 Foto Dokumentasi ODP *</label>
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
                      <span className="text-[11px] font-bold text-rose-500">{key} *</span>
                    </div>
                  )}

                  <div className="flex gap-2 w-full">
                    <button
                      onClick={() => openCameraModal(key)}
                      className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg font-mono text-[11px] font-bold flex items-center justify-center gap-1 shadow-sm hover:opacity-90"
                    >
                      <Camera className="w-3.5 h-3.5" /> Kamera
                    </button>
                    <label className="flex-1 py-2 bg-muted text-foreground border border-border rounded-lg font-mono text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer hover:bg-muted/80">
                      <ImageIcon className="w-3.5 h-3.5" /> Galeri
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={(e) => handlePhotoUploadFromGallery(key, e)} 
                        className="hidden" 
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-border flex justify-between gap-3">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2.5 bg-muted text-foreground font-bold text-xs rounded-xl flex items-center gap-1.5"
            >
              <ChevronLeft className="w-4 h-4" /> Kembali
            </button>
            <button
              onClick={() => handleNextStep(3)}
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
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-primary">Langkah 3 dari 3 (Wajib)</span>
            <h2 className="text-base font-bold text-foreground font-display flex items-center gap-2 mt-0.5">
              <Wrench className="w-5 h-5 text-primary" />
              Instalasi Rumah Pelanggan &amp; Finalisasi
            </h2>
            <p className="text-xs text-muted-foreground mt-1">Lengkapi foto unit ONT terpasang, update koordinat pelanggan, dan rincian material.</p>
          </div>

          {/* Customer GPS Location Update */}
          <div className="p-4 bg-muted/40 border border-border rounded-xl space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-foreground">📍 Titik GPS Rumah Pelanggan *</span>
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
              <p className="text-[11px] text-rose-500 font-bold italic">⚠️ Wajib mengambil lokasi GPS rumah pelanggan saat di lokasi!</p>
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
                      <span className="text-[11px] font-bold text-rose-500">{key} *</span>
                    </div>
                  )}

                  <div className="flex gap-2 w-full">
                    <button
                      onClick={() => openCameraModal(key)}
                      className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg font-mono text-[11px] font-bold flex items-center justify-center gap-1 shadow-sm hover:opacity-90"
                    >
                      <Camera className="w-3.5 h-3.5" /> Kamera
                    </button>
                    <label className="flex-1 py-2 bg-muted text-foreground border border-border rounded-lg font-mono text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer hover:bg-muted/80">
                      <ImageIcon className="w-3.5 h-3.5" /> Galeri
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={(e) => handlePhotoUploadFromGallery(key, e)} 
                        className="hidden" 
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-border flex justify-between gap-3">
            <button
              onClick={() => setStep(2)}
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

      {/* --- LIVE WEBRTC CAMERA VIEWFINDER MODAL --- */}
      {cameraModalKey && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-between p-4">
          {/* Header */}
          <div className="w-full flex justify-between items-center z-10 pt-2 px-2">
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-primary">Kamera Lapangan</span>
              <h3 className="text-sm font-bold text-white font-mono">{cameraModalKey}</h3>
            </div>
            <button 
              onClick={closeCameraModal}
              className="p-2 text-white/80 hover:text-white bg-white/10 rounded-full"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Video Viewfinder Container */}
          <div className="relative w-full max-w-md aspect-[3/4] bg-black rounded-2xl overflow-hidden border border-white/20 my-auto flex items-center justify-center">
            {cameraLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white/80 bg-black/60 z-10 space-y-2">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <span className="text-xs font-mono">Membuka Kamera HP...</span>
              </div>
            )}

            {cameraError ? (
              <div className="p-6 text-center text-rose-400 space-y-3">
                <AlertCircle className="w-10 h-10 mx-auto" />
                <p className="text-xs font-mono leading-relaxed">{cameraError}</p>
                <label className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground font-mono text-xs font-bold rounded-xl cursor-pointer">
                  <ImageIcon className="w-4 h-4" /> Pilih dari Galeri
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={(e) => handlePhotoUploadFromGallery(cameraModalKey, e)} 
                    className="hidden" 
                  />
                </label>
              </div>
            ) : (
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted
                className="w-full h-full object-cover"
              />
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>

          {/* Camera Controls */}
          {!cameraError && (
            <div className="w-full max-w-md flex items-center justify-around pb-4 pt-2">
              {/* Switch Facing Mode */}
              <button
                onClick={() => {
                  const newMode = facingMode === 'environment' ? 'user' : 'environment';
                  setFacingMode(newMode);
                  startCamera(newMode);
                }}
                className="p-3 text-white/80 hover:text-white bg-white/10 rounded-full font-mono text-xs flex flex-col items-center"
                title="Putar Kamera"
              >
                <FlipHorizontal className="w-5 h-5" />
              </button>

              {/* Shutter Capture Button */}
              <button
                onClick={captureSnapshot}
                disabled={uploadingKey !== null}
                className="w-16 h-16 rounded-full bg-white border-4 border-primary shadow-2xl flex items-center justify-center active:scale-95 transition-transform"
              >
                {uploadingKey ? (
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-primary" />
                )}
              </button>

              {/* Gallery Fallback Option */}
              <label className="p-3 text-white/80 hover:text-white bg-white/10 rounded-full cursor-pointer flex flex-col items-center">
                <ImageIcon className="w-5 h-5" />
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={(e) => handlePhotoUploadFromGallery(cameraModalKey, e)} 
                  className="hidden" 
                />
              </label>
            </div>
          )}
        </div>
      )}

      {/* --- GAMIFIED PERFORMANCE RATING SCORE OVERLAY MODAL --- */}
      {ratingResult && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-6 text-center animate-in zoom-in-95">
            
            {/* Header Badge & Trophy */}
            <div className="space-y-2">
              <div className="w-16 h-16 bg-amber-500/20 text-amber-500 rounded-full flex items-center justify-center mx-auto shadow-inner border border-amber-500/30">
                <Trophy className="w-8 h-8 animate-bounce" />
              </div>
              <span className="inline-block px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded-full text-xs font-mono font-bold tracking-widest uppercase">
                {ratingResult.badge}
              </span>
              <h2 className="text-2xl font-bold font-display text-foreground">{ratingResult.rankTitle}</h2>
            </div>

            {/* Stars */}
            <div className="flex justify-center gap-1.5">
              {[1, 2, 3, 4, 5].map((starIndex) => (
                <Star
                  key={starIndex}
                  className={cn(
                    'w-7 h-7',
                    starIndex <= ratingResult.stars
                      ? 'fill-amber-400 text-amber-400 drop-shadow-md'
                      : 'text-muted border-border'
                  )}
                />
              ))}
            </div>

            {/* Score Number Display */}
            <div className="bg-muted/30 border border-border rounded-2xl p-4 space-y-1">
              <span className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest">Skor Performa Efisiensi</span>
              <div className="text-4xl font-extrabold font-mono text-emerald-500">
                {ratingResult.score} <span className="text-xs text-muted-foreground font-normal">/ 100</span>
              </div>
            </div>

            {/* Geodesic & Stopwatch Statistics */}
            <div className="grid grid-cols-2 gap-3 text-left font-mono text-xs">
              <div className="bg-background border border-border rounded-xl p-3 space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
                  <Timer className="w-3 h-3 text-primary" /> Durasi Pengerjaan
                </span>
                <p className="font-bold text-foreground">{ratingResult.formattedDuration}</p>
              </div>

              <div className="bg-background border border-border rounded-xl p-3 space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-primary" /> Jarak HQ -> Rumah
                </span>
                <p className="font-bold text-foreground">{ratingResult.distOfficeToCustomerKm} KM</p>
              </div>

              <div className="bg-background border border-border rounded-xl p-3 space-y-1 col-span-2">
                <span className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
                  <Navigation className="w-3 h-3 text-primary" /> Jarak Kabel ODP -> Rumah
                </span>
                <p className="font-bold text-foreground">{ratingResult.distOdpToCustomerMeters} Meter</p>
              </div>
            </div>

            {/* Generated Score Card Graphic Preview / Download */}
            <div className="space-y-2.5 pt-2">
              <button
                onClick={async () => {
                  if (!ratingResult || !wo) return;
                  const { generateScoreCardCanvas } = await import('@/lib/score-card-canvas');
                  const imgDataUrl = await generateScoreCardCanvas({
                    spkId: wo.id,
                    customerName: wo.customerName,
                    issueType: wo.issueType || 'Pasang Baru',
                    rating: ratingResult,
                  });

                  // Trigger Automatic Image Download
                  const link = document.createElement('a');
                  link.download = `ScoreCard_SPK_${wo.id.slice(-6).toUpperCase()}.png`;
                  link.href = imgDataUrl;
                  link.click();
                  addToast({ type: 'success', title: '🖼️ Gambar Score Card Diunduh!', description: 'Siap dikirim ke WhatsApp / Galeri HP' });
                }}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2"
              >
                🖼️ Unduh Gambar Score Card (PNG)
              </button>

              <button
                onClick={() => {
                  if (!ratingResult || !wo) return;
                  const starsStr = '⭐'.repeat(ratingResult.stars);
                  const text = `🏆 *SKOR PERFORMA TEKNISI EUGINEBILL* 🏆

📋 *SPK ID:* #${wo.id.slice(-8).toUpperCase()}
👤 *Pelanggan:* ${wo.customerName} (${wo.issueType?.replace('_', ' ')})

${ratingResult.badge}
🏅 *Gelar:* ${ratingResult.rankTitle}
⭐ *Rating:* ${starsStr} (${ratingResult.score}/100 Poin)

⏱️ *Total Durasi:* ${ratingResult.formattedDuration}
🚗 *Jarak HQ -> Rumah:* ${ratingResult.distOfficeToCustomerKm} KM
🔌 *Estimasi Kabel ODP:* ${ratingResult.distOdpToCustomerMeters} Meter

🚀 *EugineBill High-Speed Fiber Network*`;
                  const encoded = encodeURIComponent(text);
                  window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
                }}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2"
              >
                💬 Bagikan Teks ke WhatsApp Group
              </button>

              <button
                onClick={() => {
                  setRatingResult(null);
                  router.push('/technician/work-orders');
                }}
                className="w-full py-3 bg-primary text-primary-foreground font-bold text-xs rounded-xl shadow-md hover:opacity-90 transition-opacity"
              >
                🎉 Selesai &amp; Kembali ke Daftar Pekerjaan
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
