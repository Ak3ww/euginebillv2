'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft, CheckCircle2, Loader2, MapPin, Phone,
  Camera, CheckSquare, Wrench, Send, Navigation,
  ChevronRight, ChevronLeft, RefreshCw, X, Image as ImageIcon,
  AlertCircle, FlipHorizontal, Timer, Award, Star, Zap, Trophy,
  Shield, Wifi, WifiOff, Smartphone, Power, Link, Globe, Rocket, Package, Plug, Home, BarChart2, Lock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/cyberpunk/CyberToast';
import { calculateTechnicianScore, PerformanceRating, EUGINEBILL_HQ } from '@/lib/geo-utils';

export const dynamic = 'force-dynamic';

// ─── Types ───────────────────────────────────────────────────────────────────
interface OdpOption {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  portCount: number;
  status: string;
  usedPorts: { portNumber: number; customerName: string; customerId: string }[];
}

interface GpsState {
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  loading: boolean;
  watching: boolean;
}

// ─── Haversine distance (km) ─────────────────────────────────────────────────
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Canvas: draw timestamp + GPS overlay on image ───────────────────────────
async function addPhotoOverlay(
  file: File,
  gpsLat: number | null,
  gpsLng: number | null,
  spkLabel: string,
): Promise<File> {
  return new Promise((resolve) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(file); return; }

      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);

      // Overlay strip at bottom
      const stripH = Math.max(64, canvas.height * 0.085);
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(0, canvas.height - stripH, canvas.width, stripH);

      const fontSize = Math.max(16, canvas.width * 0.028);
      ctx.font = `bold ${fontSize}px monospace`;
      ctx.fillStyle = '#ffffff';
      ctx.textBaseline = 'bottom';

      // WIB timestamp
      const now = new Date();
      const wib = new Date(now.getTime() + 7 * 3600 * 1000);
      const pad = (n: number) => n.toString().padStart(2, '0');
      const tsText = `${pad(wib.getUTCDate())}/${pad(wib.getUTCMonth() + 1)}/${wib.getUTCFullYear()} ${pad(wib.getUTCHours())}:${pad(wib.getUTCMinutes())} WIB`;

      const gpsText = gpsLat && gpsLng
        ? `GPS: ${gpsLat.toFixed(6)}, ${gpsLng.toFixed(6)}`
        : 'GPS: N/A';

      const padding = fontSize * 0.5;
      ctx.fillText(tsText, padding, canvas.height - padding * 0.5);
      ctx.fillText(gpsText, padding, canvas.height - fontSize - padding * 0.5);

      ctx.font = `${fontSize * 0.8}px monospace`;
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillText(spkLabel.substring(0, 48), padding, canvas.height - fontSize * 2 - padding);

      canvas.toBlob((blob) => {
        if (!blob) { resolve(file); return; }
        resolve(new File([blob], file.name, { type: 'image/jpeg' }));
      }, 'image/jpeg', 0.88);
    };
    img.onerror = () => resolve(file);
    img.src = url;
  });
}

// ─── Permission Gate Modal ────────────────────────────────────────────────────
function PermissionModal({ type, onClose }: { type: 'camera' | 'location'; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-rose-500/10 rounded-full flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-rose-500" />
          </div>
          <div>
            <h3 className="font-bold text-foreground text-sm">
              {type === 'camera' ? 'Izin Kamera Diperlukan' : 'Izin Lokasi Diperlukan'}
            </h3>
            <p className="text-xs text-muted-foreground">Akses diblokir oleh browser</p>
          </div>
        </div>
        <div className="bg-muted/50 rounded-xl p-3 space-y-2">
          <p className="text-xs font-bold text-foreground">Cara mengaktifkan:</p>
          <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Tap ikon kunci atau informasi di address bar browser</li>
            <li>Pilih <strong className="text-foreground">{type === 'camera' ? '"Kamera"' : '"Lokasi"'}</strong></li>
            <li>Ubah dari <strong className="text-rose-500">"Blokir"</strong> ke <strong className="text-emerald-500">"Izinkan"</strong></li>
            <li>Refresh halaman ini</li>
          </ol>
        </div>
        <button
          onClick={onClose}
          className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl font-bold text-xs"
        >
          Mengerti
        </button>
      </div>
    </div>
  );
}

// ─── GPS Hook with WatchPosition ─────────────────────────────────────────────
function useAccurateGps() {
  const [gps, setGps] = useState<GpsState>({ lat: null, lng: null, accuracy: null, loading: false, watching: false });
  const [permDenied, setPermDenied] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  const stopWatch = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setGps(prev => ({ ...prev, watching: false, loading: false }));
  }, []);

  const startWatch = useCallback(() => {
    if (!navigator.geolocation) {
      setPermDenied(true);
      return;
    }
    setGps(prev => ({ ...prev, loading: true, watching: true }));

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps(prev => ({
          ...prev,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          loading: false,
        }));
      },
      () => {},
      { enableHighAccuracy: false, timeout: 3000, maximumAge: 10000 }
    );

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setGps(prev => ({
          ...prev,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          loading: false,
          watching: true,
        }));
      },
      (err) => {
        if (err.code === 1) setPermDenied(true);
        setGps(prev => ({ ...prev, loading: false }));
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  }, []);

  useEffect(() => () => stopWatch(), [stopWatch]);

  return { gps, permDenied, startWatch, stopWatch, setPermDenied };
}

// ─── GPS Accuracy Badge ───────────────────────────────────────────────────────
function GpsAccuracyBadge({ accuracy, watching }: { accuracy: number | null; watching: boolean }) {
  if (!watching && accuracy === null) return null;
  const good = accuracy !== null && accuracy < 20;
  const ok = accuracy !== null && accuracy < 50;
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border',
      good ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' :
      ok ? 'bg-amber-500/10 text-amber-600 border-amber-500/30' :
      'bg-rose-500/10 text-rose-500 border-rose-500/30 animate-pulse'
    )}>
      <span className={cn('w-2 h-2 rounded-full inline-block shrink-0', good ? 'bg-emerald-500' : ok ? 'bg-amber-500' : 'bg-rose-500')} />
      {accuracy !== null ? `±${Math.round(accuracy)}m` : 'Mencari...'}
    </span>
  );
}

// ─── Port Grid Component ──────────────────────────────────────────────────────
function PortGrid({
  portCount,
  usedPorts,
  selected,
  onSelect,
}: {
  portCount: number;
  usedPorts: { portNumber: number; customerName: string }[];
  selected: number | null;
  onSelect: (p: number) => void;
}) {
  const usedMap = new Map(usedPorts.map(u => [u.portNumber, u.customerName]));
  return (
    <div className="grid grid-cols-4 gap-2">
      {Array.from({ length: portCount }, (_, i) => i + 1).map((port) => {
        const usedBy = usedMap.get(port);
        const isUsed = !!usedBy;
        const isSelected = selected === port;
        return (
          <button
            key={port}
            type="button"
            disabled={isUsed}
            title={isUsed ? `Terpakai: ${usedBy}` : `Port ${port} - Kosong`}
            onClick={() => !isUsed && onSelect(port)}
            className={cn(
              'h-10 rounded-xl font-mono text-xs font-bold border transition-all flex flex-col items-center justify-center',
              isSelected
                ? 'bg-primary text-primary-foreground border-primary ring-2 ring-primary/40 scale-105'
                : isUsed
                ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 cursor-not-allowed opacity-70'
                : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20 hover:scale-105 active:scale-95'
            )}
          >
            <span>Port {String(port).padStart(2, '0')}</span>
            {isUsed && <span className="block text-[8px] opacity-70 truncate max-w-full px-0.5">PAKAI</span>}
          </button>
        );
      })}
    </div>
  );
}

// ─── LED Toggle ───────────────────────────────────────────────────────────────
function LedToggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={cn(
        'flex items-center justify-between w-full px-3 py-2.5 rounded-xl border text-xs font-bold transition-all',
        value
          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600'
          : 'bg-muted/40 border-border text-muted-foreground'
      )}
    >
      <span>{label}</span>
      <span className={cn(
        'px-2 py-0.5 rounded-full text-[10px] font-mono',
        value ? 'bg-emerald-600 text-white' : 'bg-muted text-muted-foreground'
      )}>
        {value ? 'ON' : 'OFF'}
      </span>
    </button>
  );
}

// ─── Photo Slot Component ─────────────────────────────────────────────────────
function PhotoSlot({
  label,
  photoKey,
  required,
  photoUrl,
  uploading,
  gpsLat,
  gpsLng,
  spkLabel,
  onUpload,
  onOpenLive,
}: {
  label: string;
  photoKey: string;
  required: boolean;
  photoUrl?: string;
  uploading: boolean;
  gpsLat: number | null;
  gpsLng: number | null;
  spkLabel: string;
  onUpload: (key: string, file: File) => void;
  onOpenLive: (key: string) => void;
}) {
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const processed = await addPhotoOverlay(file, gpsLat, gpsLng, spkLabel);
    onUpload(photoKey, processed);
    e.target.value = '';
  };

  return (
    <div className="bg-background border border-border rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-foreground">{label}</span>
        {required && !photoUrl && (
          <span className="text-[9px] font-bold text-rose-500 bg-rose-500/10 px-1.5 py-0.5 rounded-full border border-rose-500/20">WAJIB</span>
        )}
        {photoUrl && (
          <span className="text-[9px] font-bold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded-full border border-emerald-500/20"><CheckCircle2 className="w-3 h-3 inline" /> OK</span>
        )}
      </div>

      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt={label} className="w-full aspect-[4/3] object-cover rounded-lg border border-border" />
      ) : (
        <div className="w-full aspect-[4/3] bg-muted/30 border border-dashed border-border rounded-lg flex items-center justify-center">
          {uploading ? (
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          ) : (
            <Camera className="w-8 h-8 text-muted-foreground/40" />
          )}
        </div>
      )}

      <div className="grid grid-cols-3 gap-1.5">
        <label className="col-span-1 py-2 bg-primary text-primary-foreground rounded-lg font-mono text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer hover:opacity-90 transition-opacity">
          <Camera className="w-3 h-3" /> Kamera
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileChange}
          />
        </label>
        <button
          type="button"
          onClick={() => onOpenLive(photoKey)}
          className="col-span-1 py-2 bg-emerald-600 text-white rounded-lg font-mono text-[10px] font-bold flex items-center justify-center gap-1 hover:bg-emerald-700 transition-colors"
        >
          <Zap className="w-3 h-3" /> Live
        </button>
        <label className="col-span-1 py-2 bg-muted border border-border text-foreground rounded-lg font-mono text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer hover:bg-muted/80">
          <ImageIcon className="w-3 h-3" /> Galeri
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </label>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function TechnicianWorkOrderWizardPage() {
  const router = useRouter();
  const params = useParams();
  const { addToast } = useToast();

  const [wo, setWo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<number>(1);
  const [startTimeMs, setStartTimeMs] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [ratingResult, setRatingResult] = useState<PerformanceRating | null>(null);
  const [permModal, setPermModal] = useState<'camera' | 'location' | null>(null);

  // Step 1 Installation Checklist
  const [checklist, setChecklist] = useState({
    modem: false, kabel: false, tang: false, konektor: false, klem: false,
  });

  // Step 1 Dismantle Checklist
  const [dismantleChecklist, setDismantleChecklist] = useState({
    modemOnt: true,
    powerAdapter: false,
  });

  const [deviceCondition, setDeviceCondition] = useState('Bagus & Berfungsi');

  // Report data
  const [reportData, setReportData] = useState({
    odpName: '',
    portNumber: null as number | null,
    odpLat: '',
    odpLng: '',
    modemType: '',
    sn: '',
    mac: '',
    rxSignal: '',
    txSignal: '',
    dwRoll: '',
    pakuKlem: 'Secukupnya',
    solasi: 'Secukupnya',
    notes: '',
    powerIndicator: true,
    linkIndicator: true,
    authIndicator: true,
    wifi24Indicator: true,
    wifi5Indicator: true,
    internetIndicator: true,
  });

  // ODP data
  const [existingOdps, setExistingOdps] = useState<OdpOption[]>([]);
  const [selectedOdp, setSelectedOdp] = useState<OdpOption | null>(null);
  const [suggestedOdp, setSuggestedOdp] = useState<{ name: string; distMeters: number; odp: OdpOption } | null>(null);

  // GPS
  const odpGps = useAccurateGps();
  const customerGps = useAccurateGps();
  const [lockedOdpGps, setLockedOdpGps] = useState<{ lat: number; lng: number } | null>(null);
  const [lockedCustomerGps, setLockedCustomerGps] = useState<{ lat: number; lng: number } | null>(null);

  // Photos
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  // Live camera modal
  const [cameraModalKey, setCameraModalKey] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const storageKey = `tech_spk_wizard_${params.id}`;

  // ─── Timer ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!startTimeMs) return;
    const iv = setInterval(() => setElapsedSeconds(Math.floor((Date.now() - startTimeMs) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [startTimeMs]);

  const formatTimer = (s: number) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
    const p = (n: number) => n.toString().padStart(2, '0');
    return h > 0 ? `${p(h)}:${p(m)}:${p(ss)}` : `${p(m)}:${p(ss)}`;
  };

  // ─── Save draft ─────────────────────────────────────────────────────────
  const saveDraft = useCallback(async (newStep?: number, extras?: any) => {
    const draft = {
      step: newStep ?? step,
      checklist,
      dismantleChecklist,
      deviceCondition,
      reportData: extras?.reportData ?? reportData,
      photos: extras?.photos ?? photos,
      lockedOdpGps,
      lockedCustomerGps,
      startTimeMs: extras?.startTimeMs ?? startTimeMs,
    };
    try { localStorage.setItem(storageKey, JSON.stringify(draft)); } catch { }
    try {
      await fetch(`/api/technician/work-orders/${params.id}/draft`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wizardStep: draft.step, wizardDraftData: draft }),
      });
    } catch { }
  }, [step, checklist, dismantleChecklist, deviceCondition, reportData, photos, lockedOdpGps, lockedCustomerGps, startTimeMs, storageKey, params.id]);

  // ─── Load WO + draft ─────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        const res = await fetch(`/api/technician/work-orders/${params.id}`);
        if (!res.ok) { setLoading(false); return; }
        const data = await res.json();
        const woData = data.workOrder;
        setWo(woData);

        let serverDraft: any = null;
        try {
          const dr = await fetch(`/api/technician/work-orders/${params.id}/draft`);
          if (dr.ok) {
            const dd = await dr.json();
            if (dd.wizardDraftData) serverDraft = dd.wizardDraftData;
          }
        } catch { }

        let localDraft: any = null;
        try {
          const ls = localStorage.getItem(storageKey);
          if (ls) localDraft = JSON.parse(ls);
        } catch { }

        const draft = (serverDraft?.step || 0) >= (localDraft?.step || 0) ? serverDraft : localDraft;

        if (draft) {
          if (draft.step) setStep(draft.step);
          if (draft.checklist) setChecklist(draft.checklist);
          if (draft.dismantleChecklist) setDismantleChecklist(draft.dismantleChecklist);
          if (draft.deviceCondition) setDeviceCondition(draft.deviceCondition);
          if (draft.reportData) setReportData(prev => ({ ...prev, ...draft.reportData }));
          if (draft.photos) setPhotos(draft.photos);
          if (draft.lockedOdpGps) setLockedOdpGps(draft.lockedOdpGps);
          if (draft.lockedCustomerGps) setLockedCustomerGps(draft.lockedCustomerGps);
          if (draft.startTimeMs) setStartTimeMs(draft.startTimeMs);
        } else {
          if (woData.reportData) setReportData(prev => ({ ...prev, ...woData.reportData }));
          if (woData.customer?.latitude) setLockedCustomerGps({ lat: woData.customer.latitude, lng: woData.customer.longitude });
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [params.id, storageKey]);

  // ─── Fetch ODPs ───────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/technician/odps')
      .then(r => r.json())
      .then(d => { if (d.success) setExistingOdps(d.odps); })
      .catch(() => {});
  }, []);

  // ─── ODP name change ──────────────────────────────────────────────────────
  useEffect(() => {
    const found = existingOdps.find(o => o.name.toLowerCase() === reportData.odpName.toLowerCase());
    setSelectedOdp(found || null);
  }, [reportData.odpName, existingOdps]);

  // ─── ODP GPS suggestion ──────────────────────────────────────────────────
  useEffect(() => {
    if (odpGps.gps.lat && odpGps.gps.lng) {
      let nearest: typeof suggestedOdp = null;
      for (const odp of existingOdps) {
        if (!odp.latitude || !odp.longitude) continue;
        const distKm = haversineKm(odpGps.gps.lat, odpGps.gps.lng, odp.latitude, odp.longitude);
        const distMeters = Math.round(distKm * 1000);
        if (distMeters <= 150 && (!nearest || distMeters < nearest.distMeters)) {
          nearest = { name: odp.name, distMeters, odp };
        }
      }
      setSuggestedOdp(nearest);
    }
  }, [odpGps.gps.lat, odpGps.gps.lng, existingOdps]);

  const isDismantle = wo?.issueType?.toUpperCase().includes('DISMANTLE') || wo?.issueType?.toUpperCase().includes('CABUT');

  // ─── Validation ───────────────────────────────────────────────────────────
  const validateStep1 = () => {
    if (isDismantle) {
      if (!dismantleChecklist.modemOnt) {
        addToast({ type: 'error', title: 'Ceklis Wajib', description: 'Modem ONT wajib dicentang' });
        return false;
      }
      return true;
    }
    if (!Object.values(checklist).every(Boolean)) {
      addToast({ type: 'error', title: 'Ceklis Belum Lengkap', description: 'Wajib centang semua 5 item peralatan!' });
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (isDismantle) {
      const missing: string[] = [];
      if (!lockedCustomerGps) missing.push('GPS Lokasi Pencabutan');
      if (!photos['Foto Perangkat Ditarik']) missing.push('Foto Perangkat Ditarik');
      if (!photos['Foto Rumah']) missing.push('Foto Depan Rumah');
      if (missing.length > 0) {
        addToast({ type: 'error', title: 'Laporan Belum Lengkap', description: missing.join(', ') });
        return false;
      }
      return true;
    }
    const missing: string[] = [];
    if (!reportData.odpName.trim()) missing.push('Nama ODP');
    if (!reportData.portNumber) missing.push('Nomor Port ODP');
    if (!lockedOdpGps) missing.push('GPS ODP (harus dikunci)');
    if (!photos['Foto Box ODP']) missing.push('Foto Box ODP');
    if (!photos['Foto Port ODP']) missing.push('Foto Port ODP');
    if (missing.length > 0) {
      addToast({ type: 'error', title: 'Data ODP Belum Lengkap', description: missing.join(', ') });
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
    const issueType = (wo?.issueType || 'INSTALLATION').toUpperCase();
    const missing: string[] = [];
    if (issueType.includes('INSTAL')) {
      if (!reportData.sn.trim()) missing.push('Serial Number ONT');
      if (!reportData.rxSignal.trim()) missing.push('RX Signal (dBm)');
      if (!lockedCustomerGps) missing.push('GPS Rumah Pelanggan (harus dikunci)');
      if (!photos['Foto Rumah']) missing.push('Foto Depan Rumah');
      if (!photos['Foto ONT Depan']) missing.push('Foto ONT Depan');
      if (!photos['Foto ONT Belakang']) missing.push('Foto ONT Belakang');
      if (!photos['Foto Speedtest']) missing.push('Foto Speedtest');
    } else {
      if (!lockedCustomerGps) missing.push('GPS Lokasi');
      if (Object.keys(photos).length === 0) missing.push('Minimal 1 foto bukti');
    }
    if (missing.length > 0) {
      addToast({ type: 'error', title: 'Laporan Belum Lengkap', description: missing.join(', ') });
      return false;
    }
    return true;
  };

  // ─── Navigation ───────────────────────────────────────────────────────────
  const handleNextStep = async (target: number) => {
    if (target === 2 && !validateStep1()) return;
    if (target === 3 && !validateStep2()) return;

    if (target === 2 && !startTimeMs) {
      const now = Date.now();
      setStartTimeMs(now);
      await saveDraft(2, { startTimeMs: now });
      addToast({ type: 'success', title: 'Stopwatch Dimulai!' });
    } else {
      await saveDraft(target);
    }
    setStep(target);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ─── Lock GPS ─────────────────────────────────────────────────────────────
  const lockOdpGps = async () => {
    if (!odpGps.gps.lat || !odpGps.gps.lng) {
      addToast({ type: 'error', title: 'GPS belum tersedia', description: 'Tunggu sinyal GPS dulu' });
      return;
    }
    if ((odpGps.gps.accuracy || 999) > 50) {
      addToast({ type: 'warning', title: 'GPS kurang akurat', description: `Akurasi ±${Math.round(odpGps.gps.accuracy || 0)}m. Tunggu sampai ±50m atau kurang.` });
      return;
    }
    const locked = { lat: odpGps.gps.lat, lng: odpGps.gps.lng };
    setLockedOdpGps(locked);
    odpGps.stopWatch();
    const updatedRd = { ...reportData, odpLat: locked.lat.toFixed(6), odpLng: locked.lng.toFixed(6) };
    setReportData(updatedRd);
    await saveDraft(step, { reportData: updatedRd, lockedOdpGps: locked });
    addToast({ type: 'success', title: 'GPS ODP Terkunci!', description: `±${Math.round(odpGps.gps.accuracy || 0)}m` });
  };

  const lockCustomerGps = async () => {
    if (!customerGps.gps.lat || !customerGps.gps.lng) {
      addToast({ type: 'error', title: 'GPS belum tersedia' });
      return;
    }
    if ((customerGps.gps.accuracy || 999) > 50) {
      addToast({ type: 'warning', title: 'GPS kurang akurat', description: `±${Math.round(customerGps.gps.accuracy || 0)}m. Tunggu akurasi lebih baik.` });
      return;
    }
    const locked = { lat: customerGps.gps.lat, lng: customerGps.gps.lng };
    setLockedCustomerGps(locked);
    customerGps.stopWatch();
    await saveDraft(step, { lockedCustomerGps: locked });
    addToast({ type: 'success', title: 'GPS Pelanggan Terkunci!', description: `±${Math.round(customerGps.gps.accuracy || 0)}m` });
  };

  // ─── Upload photo ─────────────────────────────────────────────────────────
  const uploadPhoto = async (key: string, file: File) => {
    setUploadingKey(key);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/technician/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok && data.url) {
        const newPhotos = { ...photos, [key]: data.url };
        setPhotos(newPhotos);
        await saveDraft(step, { photos: newPhotos });
        addToast({ type: 'success', title: `${key} tersimpan` });
      } else {
        addToast({ type: 'error', title: 'Gagal upload foto', description: data.error });
      }
    } catch {
      addToast({ type: 'error', title: 'Gagal upload foto', description: 'Cek koneksi internet' });
    } finally {
      setUploadingKey(null);
    }
  };

  const spkLabel = wo ? `SPK-${wo.id.slice(-6).toUpperCase()} | ${wo.customerName}` : '';

  // ─── Camera modal ─────────────────────────────────────────────────────────
  const openCameraModal = async (key: string) => {
    const perm = await navigator.permissions.query({ name: 'camera' as PermissionName }).catch(() => null);
    if (perm?.state === 'denied') { setPermModal('camera'); return; }
    setCameraModalKey(key);
    startCamera('environment');
  };

  const startCamera = async (mode: 'environment' | 'user') => {
    setCameraLoading(true);
    setCameraError(null);
    stopCameraStream();
    try {
      if (!window.isSecureContext) throw new Error('Butuh HTTPS untuk kamera langsung');
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: mode } }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
    } catch (err: any) {
      if (err.name === 'NotAllowedError') setPermModal('camera');
      setCameraError(err.message || 'Gagal akses kamera');
    } finally {
      setCameraLoading(false);
    }
  };

  const stopCameraStream = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  };

  const closeCameraModal = () => { stopCameraStream(); setCameraModalKey(null); };

  const captureFromLive = async () => {
    if (!videoRef.current || !cameraModalKey) return;
    setUploadingKey(cameraModalKey);
    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(video, 0, 0);

      const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', 0.88));
      if (!blob) { setUploadingKey(null); return; }

      const rawFile = new File([blob], `live_${cameraModalKey}_${Date.now()}.jpg`, { type: 'image/jpeg' });
      const currentGps = step === 2 ? lockedOdpGps : lockedCustomerGps;
      const processed = await addPhotoOverlay(rawFile, currentGps?.lat ?? null, currentGps?.lng ?? null, spkLabel);
      closeCameraModal();
      await uploadPhoto(cameraModalKey, processed);
    } catch (e: any) {
      addToast({ type: 'error', title: 'Gagal ambil foto', description: e.message });
      setUploadingKey(null);
    }
  };

  // ─── Submit ───────────────────────────────────────────────────────────────
  const submitComplete = async () => {
    if (isDismantle) {
      if (!validateStep2()) return;
    } else {
      if (!validateStep3()) return;
    }
    if (!confirm('Konfirmasi: Semua data pencabutan/instalasi sudah benar dan selesai?')) return;
    setSubmitting(true);
    try {
      const endTime = Date.now();
      const start = startTimeMs || (endTime - 1200000);
      const rating = calculateTechnicianScore(
        start, endTime,
        lockedCustomerGps?.lat ?? 0, lockedCustomerGps?.lng ?? 0,
        lockedOdpGps?.lat ?? null, lockedOdpGps?.lng ?? null,
      );

      const res = await fetch(`/api/technician/work-orders/${params.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isPrepared: true,
          equipmentChecklist: isDismantle ? dismantleChecklist : checklist,
          reportData: {
            ...reportData,
            port: reportData.portNumber || (reportData as any).port,
            portNumber: reportData.portNumber || (reportData as any).port,
            dwRoll: reportData.dwRoll,
            mac: reportData.mac,
            deviceCondition,
            customerLat: lockedCustomerGps?.lat,
            customerLng: lockedCustomerGps?.lng,
            performanceRating: rating,
          },
          reportPhotos: photos,
          customerLat: lockedCustomerGps?.lat,
          customerLng: lockedCustomerGps?.lng,
          notes: reportData.notes,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        try { localStorage.removeItem(storageKey); } catch { }
        setRatingResult(rating);
      } else {
        addToast({ type: 'error', title: 'Gagal menyelesaikan SPK', description: data.error });
        setSubmitting(false);
      }
    } catch {
      addToast({ type: 'error', title: 'Gagal terhubung ke server' });
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!wo) return <div className="p-8 text-center text-rose-500 font-bold">Work Order tidak ditemukan</div>;

  // ═══════════════════════════════════════════════════════════════════════════
  // SCORE MODAL
  // ═══════════════════════════════════════════════════════════════════════════
  if (ratingResult) {
    return (
      <div className="fixed inset-0 z-50 bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="space-y-6 max-w-sm w-full">
          <div className="flex justify-center"><Trophy className="w-16 h-16 text-amber-400" /></div>
          <div>
            <span className="text-xs font-mono text-emerald-400 font-bold uppercase tracking-widest">{ratingResult.badge}</span>
            <h2 className="text-2xl font-bold text-white mt-1">{ratingResult.rankTitle}</h2>
            <p className="text-emerald-400 font-mono text-lg mt-1">Skor: {ratingResult.score}/100</p>
          </div>
          <div className="flex justify-center gap-1">
            {[1,2,3,4,5].map(s => (
              <Star key={s} className={cn('w-8 h-8', s <= ratingResult.stars ? 'text-amber-400 fill-amber-400' : 'text-white/20')} />
            ))}
          </div>
          <div className="bg-white/10 rounded-2xl p-4 text-left space-y-2 text-sm text-white/80">
            <div className="flex justify-between"><span>Durasi</span><span className="font-mono text-white">{ratingResult.formattedDuration}</span></div>
            <div className="flex justify-between"><span>Target Waktu</span><span className="font-mono text-white">{ratingResult.targetMinutes} Menit</span></div>
          </div>
          <button
            onClick={() => router.push('/technician/work-orders')}
            className="w-full py-3.5 bg-emerald-600 text-white font-bold rounded-2xl shadow-xl hover:bg-emerald-700 flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" /> Selesai &amp; Kembali ke Daftar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-5 pb-28">
      {permModal && <PermissionModal type={permModal} onClose={() => setPermModal(null)} />}

      <div className="flex justify-between items-center">
        <button onClick={() => router.push('/technician/work-orders')} className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Kembali
        </button>
        {startTimeMs && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 font-mono text-xs font-bold">
            <Timer className="w-3.5 h-3.5" /> {formatTimer(elapsedSeconds)}
          </span>
        )}
      </div>

      {/* Customer Card */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-3">
        <div className="flex justify-between items-start">
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-primary">SPK #{wo.id.slice(-8).toUpperCase()}</span>
            <h1 className="text-lg font-bold text-foreground mt-0.5">{wo.customerName}</h1>
            <p className="text-xs text-muted-foreground">{wo.issueType?.replace(/_/g, ' ')}</p>
          </div>
          <span className={cn('px-2.5 py-1 rounded-full font-mono text-[10px] font-bold border',
            wo.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
          )}>{wo.status}</span>
        </div>
        <div className="flex items-start justify-between gap-2 pt-2 border-t border-border text-xs">
          <div className="flex items-start gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
            <span className="text-foreground line-clamp-2">{wo.customerAddress}</span>
          </div>
          <a
            href={lockedCustomerGps ? `https://www.google.com/maps/dir/?api=1&destination=${lockedCustomerGps.lat},${lockedCustomerGps.lng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(wo.customerAddress)}`}
            target="_blank" rel="noopener noreferrer"
            className="px-2.5 py-1 bg-primary/10 text-primary border border-primary/30 rounded-lg text-[10px] font-mono font-bold flex items-center gap-1 shrink-0"
          >
            <Navigation className="w-3 h-3" /> Maps
          </a>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <Phone className="w-3.5 h-3.5 text-primary" />
          <a href={`tel:${wo.customerPhone}`} className="font-mono text-primary font-bold">{wo.customerPhone}</a>
        </div>
      </div>

      {/* Step Progress */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="flex justify-between items-center relative">
          <div className="absolute top-4 left-6 right-6 h-0.5 bg-border z-0" />
          {(isDismantle
            ? [{ id: 1, title: 'Ceklis Perangkat' }, { id: 2, title: 'Foto & GPS' }]
            : [{ id: 1, title: 'Persiapan' }, { id: 2, title: 'ODP' }, { id: 3, title: 'Rumah' }]
          ).map(s => {
            const isDone = step > s.id;
            const isActive = step === s.id;
            return (
              <div key={s.id} className="relative z-10 flex flex-col items-center gap-1">
                <div className={cn('w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shadow transition-all',
                  isDone ? 'bg-emerald-600 text-white' : isActive ? 'bg-primary text-primary-foreground ring-4 ring-primary/20 scale-110' : 'bg-muted text-muted-foreground border border-border'
                )}>
                  {isDone ? <CheckCircle2 className="w-5 h-5" /> : s.id}
                </div>
                <span className={cn('text-[10px] font-bold uppercase tracking-wider', isActive ? 'text-primary' : 'text-muted-foreground')}>{s.title}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══ DISMANTLE STEP 1 ═════════════════════════════════════════════════ */}
      {isDismantle && step === 1 && (
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-5">
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-amber-500">SPK Penarikan / Dismantle</span>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2 mt-0.5">
              <Wrench className="w-5 h-5 text-amber-500" /> Ceklis Perangkat Dicabut
            </h2>
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-bold text-foreground">Perangkat Ditarik</label>
            <label className="flex items-center gap-3 p-3.5 rounded-xl border bg-emerald-500/10 border-emerald-500/30 cursor-pointer">
              <input type="checkbox" checked={dismantleChecklist.modemOnt}
                onChange={e => setDismantleChecklist(p => ({ ...p, modemOnt: e.target.checked }))}
                className="w-4 h-4 rounded text-primary" />
              <span className="text-xs font-bold">Modem ONT (ZTE / Huawei / FiberHome) *WAJIB</span>
            </label>
            <label className="flex items-center gap-3 p-3.5 rounded-xl border bg-background border-border cursor-pointer">
              <input type="checkbox" checked={dismantleChecklist.powerAdapter}
                onChange={e => setDismantleChecklist(p => ({ ...p, powerAdapter: e.target.checked }))}
                className="w-4 h-4 rounded text-primary" />
              <span className="text-xs font-bold">Adaptor Power 12V (Opsional)</span>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-bold text-foreground mb-1">Serial Number (SN) ONT</label>
              <input type="text" placeholder="ZTEGDDODA7E0" value={reportData.sn}
                onChange={e => setReportData(p => ({ ...p, sn: e.target.value.toUpperCase() }))}
                className="w-full p-2.5 bg-background border border-input rounded-xl focus:ring-2 focus:ring-primary outline-none font-mono uppercase" />
            </div>
            <div>
              <label className="block font-bold text-foreground mb-1">Kondisi Perangkat</label>
              <select
                value={deviceCondition}
                onChange={e => setDeviceCondition(e.target.value)}
                className="w-full p-2.5 bg-background border border-input rounded-xl focus:ring-2 focus:ring-primary outline-none font-bold"
              >
                <option value="Bagus & Berfungsi">Bagus &amp; Berfungsi</option>
                <option value="Adaptor Rusak/Hilang">Adaptor Rusak/Hilang</option>
                <option value="Modem Rusak/Mati">Modem Rusak/Mati</option>
                <option value="Perangkat Hilang">Perangkat Hilang</option>
              </select>
            </div>
          </div>

          <div className="pt-4 border-t border-border flex justify-end">
            <button onClick={() => handleNextStep(2)}
              className="w-full px-6 py-3.5 bg-primary text-primary-foreground font-bold text-xs rounded-xl shadow-lg flex items-center justify-center gap-2">
              Lanjut ke Foto &amp; Lokasi <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ═══ DISMANTLE STEP 2 ═════════════════════════════════════════════════ */}
      {isDismantle && step === 2 && (
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-6">
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-amber-500">Langkah 2 dari 2</span>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2 mt-0.5">
              <Camera className="w-5 h-5 text-amber-500" /> Foto Bukti &amp; Lokasi Pencabutan
            </h2>
          </div>

          {/* GPS Customer */}
          <div className="p-4 bg-muted/40 border border-border rounded-xl space-y-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-bold text-foreground">GPS Lokasi Pencabutan *</span>
                <GpsAccuracyBadge accuracy={customerGps.gps.accuracy} watching={customerGps.gps.watching} />
              </div>
              {!lockedCustomerGps ? (
                !customerGps.gps.watching ? (
                  <button onClick={() => customerGps.startWatch()}
                    className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg font-mono text-[10px] font-bold flex items-center gap-1.5">
                    <Navigation className="w-3.5 h-3.5" /> Aktifkan GPS
                  </button>
                ) : (
                  <button onClick={lockCustomerGps}
                    disabled={(customerGps.gps.accuracy || 999) > 50 || !customerGps.gps.lat}
                    className={cn('px-3 py-1.5 rounded-lg font-mono text-[10px] font-bold flex items-center gap-1.5 transition-all',
                      (customerGps.gps.accuracy || 999) <= 50 && customerGps.gps.lat ? 'bg-emerald-600 text-white' : 'bg-muted text-muted-foreground cursor-not-allowed'
                    )}>
                    <Lock className="w-3.5 h-3.5" /> Kunci GPS
                  </button>
                )
              ) : (
                <button onClick={() => { setLockedCustomerGps(null); customerGps.startWatch(); }}
                  className="px-3 py-1.5 bg-muted border border-border rounded-lg font-mono text-[10px] font-bold">
                  <RefreshCw className="w-3 h-3 inline mr-1" /> Ubah
                </button>
              )}
            </div>
            {lockedCustomerGps && (
              <div className="font-mono text-xs text-emerald-600 font-bold bg-background p-2 rounded border border-emerald-500/30">
                Terkunci — Lat: {lockedCustomerGps.lat.toFixed(6)}, Lng: {lockedCustomerGps.lng.toFixed(6)}
              </div>
            )}
          </div>

          {/* Dismantle Photos */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-foreground flex items-center gap-1">
              <Camera className="w-3.5 h-3.5 text-primary" /> Foto Bukti Pencabutan *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {([
                ['Foto Perangkat Ditarik', 'Foto ONT & Adaptor Ditarik (SN terlihat)'],
                ['Foto Rumah', 'Foto Depan Rumah / Lokasi Pencabutan'],
              ] as [string, string][]).map(([key, label]) => (
                <PhotoSlot key={key} label={label} photoKey={key} required photoUrl={photos[key]}
                  uploading={uploadingKey === key} gpsLat={lockedCustomerGps?.lat ?? null} gpsLng={lockedCustomerGps?.lng ?? null}
                  spkLabel={spkLabel} onUpload={uploadPhoto} onOpenLive={openCameraModal} />
              ))}
            </div>
          </div>

          <div>
            <label className="block font-bold text-xs text-foreground mb-1">Catatan Tambahan Teknisi</label>
            <textarea rows={2} placeholder="Cth: Perangkat dalam kondisi mulus, pelanggan sudah titip ke tetangga" value={reportData.notes}
              onChange={e => setReportData(p => ({ ...p, notes: e.target.value }))}
              className="w-full p-2.5 bg-background border border-input rounded-xl outline-none font-mono text-xs" />
          </div>

          <div className="pt-4 border-t border-border flex justify-between gap-3">
            <button onClick={() => setStep(1)} className="px-3.5 py-3 bg-muted text-foreground font-bold text-xs rounded-xl flex items-center gap-1 shrink-0">
              <ChevronLeft className="w-4 h-4" /> Step 1
            </button>
            <button onClick={submitComplete} disabled={submitting}
              className="flex-1 sm:flex-initial px-5 py-3.5 bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-xl hover:bg-emerald-700 flex items-center justify-center gap-2">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Selesaikan SPK Cabut
            </button>
          </div>
        </div>
      )}

      {/* ═══ INSTALLATION STEP 1 ═════════════════════════════════════════════ */}
      {!isDismantle && step === 1 && (
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-5">
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-primary">Langkah 1 dari 3</span>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2 mt-0.5">
              <CheckSquare className="w-5 h-5 text-primary" /> Ceklis Persiapan Peralatan
            </h2>
          </div>
          <div className="space-y-2">
            {([
              ['modem', 'Modem ONT Baru (ZTE / Huawei / FiberHome)'],
              ['kabel', 'Kabel Dropwire (Roll DW 1 Core)'],
              ['konektor', 'Fast Connector & Patch Cord SC/UPC'],
              ['klem', 'Aksesoris (Klem DW, S-Hook, Paku Beton)'],
              ['tang', 'Peralatan (Tang Stripper, Cleaver, OPM, VFL)'],
            ] as [string, string][]).map(([key, label]) => (
              <label key={key} className={cn(
                'flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all',
                (checklist as any)[key] ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-background border-border'
              )}>
                <input type="checkbox" checked={(checklist as any)[key]}
                  onChange={e => setChecklist(p => ({ ...p, [key]: e.target.checked }))}
                  className="w-4 h-4 rounded text-primary" />
                <span className="text-xs font-bold">{label}</span>
              </label>
            ))}
          </div>
          <div className="pt-4 border-t border-border flex justify-end">
            <button onClick={() => handleNextStep(2)}
              className="w-full px-6 py-3.5 bg-primary text-primary-foreground font-bold text-xs rounded-xl shadow-lg flex items-center justify-center gap-2">
              <Rocket className="w-4 h-4" /> Mulai Pekerjaan &amp; Berangkat <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ═══ INSTALLATION STEP 2 ═════════════════════════════════════════════ */}
      {!isDismantle && step === 2 && (
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-6">
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-primary">Langkah 2 dari 3</span>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2 mt-0.5">
              <MapPin className="w-5 h-5 text-primary" /> Titik ODP &amp; Port
            </h2>
          </div>

          <div className="p-4 bg-muted/40 border border-border rounded-xl space-y-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-bold text-foreground">GPS Tiang ODP *</span>
                <GpsAccuracyBadge accuracy={odpGps.gps.accuracy} watching={odpGps.gps.watching} />
              </div>
              {!lockedOdpGps ? (
                !odpGps.gps.watching ? (
                  <button onClick={() => odpGps.startWatch()}
                    className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg font-mono text-[10px] font-bold flex items-center gap-1.5">
                    <Navigation className="w-3.5 h-3.5" /> Aktifkan GPS
                  </button>
                ) : (
                  <button onClick={lockOdpGps}
                    disabled={(odpGps.gps.accuracy || 999) > 50 || !odpGps.gps.lat}
                    className={cn('px-3 py-1.5 rounded-lg font-mono text-[10px] font-bold flex items-center gap-1.5 transition-all',
                      (odpGps.gps.accuracy || 999) <= 50 && odpGps.gps.lat ? 'bg-emerald-600 text-white' : 'bg-muted text-muted-foreground cursor-not-allowed'
                    )}>
                    <Lock className="w-3.5 h-3.5" /> Kunci GPS ODP
                  </button>
                )
              ) : (
                <button onClick={() => { setLockedOdpGps(null); odpGps.startWatch(); }}
                  className="px-3 py-1.5 bg-muted text-foreground border border-border rounded-lg font-mono text-[10px] font-bold">
                  <RefreshCw className="w-3 h-3 inline mr-1" /> Ubah
                </button>
              )}
            </div>
            {lockedOdpGps && (
              <div className="font-mono text-xs text-emerald-600 font-bold bg-background p-2 rounded border border-emerald-500/30">
                Terkunci — Lat: {lockedOdpGps.lat.toFixed(6)}, Lng: {lockedOdpGps.lng.toFixed(6)}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-foreground">Nama ODP *</label>
            <input type="text" list="odp-suggestions-list" placeholder="Cth: ODP-KDS-07 / KPS-06" value={reportData.odpName}
              onChange={e => setReportData(p => ({ ...p, odpName: e.target.value }))}
              className="w-full p-2.5 bg-background border border-input rounded-xl focus:ring-2 focus:ring-primary outline-none font-mono text-xs" />
            <datalist id="odp-suggestions-list">
              {existingOdps.map(o => <option key={o.id} value={o.name} />)}
            </datalist>
            {suggestedOdp && (
              <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between">
                <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-emerald-600 inline" /> Terdekat: <strong>{suggestedOdp.name}</strong> ({suggestedOdp.distMeters}m)
                </span>
                <button onClick={() => { setReportData(p => ({ ...p, odpName: suggestedOdp.name })); setSelectedOdp(suggestedOdp.odp); setSuggestedOdp(null); }}
                  className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-[10px] font-bold">Gunakan</button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground">Port ODP *</label>
              {reportData.portNumber && (
                <span className="font-mono text-xs text-primary font-bold">Port {String(reportData.portNumber).padStart(2,'0')}/{String(selectedOdp?.portCount || 16).padStart(2,'0')} dipilih</span>
              )}
            </div>
            {selectedOdp ? (
              <PortGrid portCount={selectedOdp.portCount || 16} usedPorts={selectedOdp.usedPorts} selected={reportData.portNumber}
                onSelect={port => setReportData(p => ({ ...p, portNumber: port }))} />
            ) : (
              <div className="p-3 bg-muted/40 border border-dashed border-border rounded-xl text-center">
                <p className="text-xs text-muted-foreground">Masukkan Nama ODP dulu untuk lihat port tersedia</p>
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {Array.from({length:16},(_,i)=>i+1).map(p => (
                    <button key={p} type="button" onClick={() => setReportData(prev => ({...prev, portNumber: p}))}
                      className={cn('h-10 rounded-xl font-mono text-xs font-bold border transition-all',
                        reportData.portNumber === p ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted text-foreground border-border hover:bg-muted/80'
                      )}>{String(p).padStart(2,'0')}</button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3 text-xs">
            <div>
              <label className="block font-bold text-foreground mb-1">DW Roll (m)</label>
              <input type="number" placeholder="150" value={reportData.dwRoll} onChange={e => setReportData(p => ({...p, dwRoll: e.target.value}))}
                className="w-full p-2.5 bg-background border border-input rounded-xl focus:ring-2 focus:ring-primary outline-none font-mono" />
            </div>
            <div>
              <label className="block font-bold text-foreground mb-1">Paku Klem</label>
              <input type="text" placeholder="Secukupnya" value={reportData.pakuKlem} onChange={e => setReportData(p => ({...p, pakuKlem: e.target.value}))}
                className="w-full p-2.5 bg-background border border-input rounded-xl focus:ring-2 focus:ring-primary outline-none font-mono" />
            </div>
            <div>
              <label className="block font-bold text-foreground mb-1">Solasi</label>
              <input type="text" placeholder="Secukupnya" value={reportData.solasi} onChange={e => setReportData(p => ({...p, solasi: e.target.value}))}
                className="w-full p-2.5 bg-background border border-input rounded-xl focus:ring-2 focus:ring-primary outline-none font-mono" />
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-bold text-foreground flex items-center gap-1">
              <Camera className="w-3.5 h-3.5 text-primary" /> Foto ODP *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(['Foto Box ODP', 'Foto Port ODP'] as const).map(key => (
                <PhotoSlot key={key} label={key} photoKey={key} required photoUrl={photos[key]}
                  uploading={uploadingKey === key} gpsLat={lockedOdpGps?.lat ?? null} gpsLng={lockedOdpGps?.lng ?? null}
                  spkLabel={spkLabel} onUpload={uploadPhoto} onOpenLive={openCameraModal} />
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-border flex justify-between gap-3">
            <button onClick={() => setStep(1)} className="px-4 py-3 bg-muted text-foreground font-bold text-xs rounded-xl flex items-center gap-1.5">
              <ChevronLeft className="w-4 h-4" /> Kembali
            </button>
            <button onClick={() => handleNextStep(3)}
              className="px-6 py-3.5 bg-primary text-primary-foreground font-bold text-xs rounded-xl shadow-lg flex items-center gap-1.5">
              Lanjut ke Rumah Pelanggan <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ═══ INSTALLATION STEP 3 ═════════════════════════════════════════════ */}
      {!isDismantle && step === 3 && (
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-6">
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-primary">Langkah 3 dari 3</span>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2 mt-0.5">
              <Wrench className="w-5 h-5 text-primary" /> Instalasi Rumah &amp; Finalisasi
            </h2>
          </div>

          <div className="p-4 bg-muted/40 border border-border rounded-xl space-y-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-bold text-foreground">GPS Rumah Pelanggan *</span>
                <GpsAccuracyBadge accuracy={customerGps.gps.accuracy} watching={customerGps.gps.watching} />
              </div>
              {!lockedCustomerGps ? (
                !customerGps.gps.watching ? (
                  <button onClick={() => customerGps.startWatch()}
                    className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg font-mono text-[10px] font-bold flex items-center gap-1.5">
                    <Navigation className="w-3.5 h-3.5" /> Aktifkan GPS
                  </button>
                ) : (
                  <button onClick={lockCustomerGps}
                    disabled={(customerGps.gps.accuracy || 999) > 50 || !customerGps.gps.lat}
                    className={cn('px-3 py-1.5 rounded-lg font-mono text-[10px] font-bold flex items-center gap-1.5 transition-all',
                      (customerGps.gps.accuracy || 999) <= 50 && customerGps.gps.lat ? 'bg-emerald-600 text-white' : 'bg-muted text-muted-foreground cursor-not-allowed'
                    )}>
                    <Lock className="w-3.5 h-3.5" /> Kunci GPS
                  </button>
                )
              ) : (
                <button onClick={() => { setLockedCustomerGps(null); customerGps.startWatch(); }}
                  className="px-3 py-1.5 bg-muted border border-border rounded-lg font-mono text-[10px] font-bold">
                  <RefreshCw className="w-3 h-3 inline mr-1" /> Ubah
                </button>
              )}
            </div>
            {lockedCustomerGps && (
              <div className="font-mono text-xs text-emerald-600 font-bold bg-background p-2 rounded border border-emerald-500/30">
                Terkunci — Lat: {lockedCustomerGps.lat.toFixed(6)}, Lng: {lockedCustomerGps.lng.toFixed(6)}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-bold text-foreground mb-1">Type ONT *</label>
              <input type="text" placeholder="ZTE F679D / Huawei HG8145" value={reportData.modemType} onChange={e => setReportData(p => ({...p, modemType: e.target.value}))}
                className="w-full p-2.5 bg-background border border-input rounded-xl focus:ring-2 focus:ring-primary outline-none font-mono" />
            </div>
            <div>
              <label className="block font-bold text-foreground mb-1">Serial Number (SN) *</label>
              <input type="text" placeholder="ZTEGDDODA7E0" value={reportData.sn} onChange={e => setReportData(p => ({...p, sn: e.target.value.toUpperCase()}))}
                className="w-full p-2.5 bg-background border border-input rounded-xl focus:ring-2 focus:ring-primary outline-none font-mono uppercase" />
            </div>
            <div>
              <label className="block font-bold text-foreground mb-1">MAC Address</label>
              <input type="text" placeholder="68-2A-DD-29-85-A5" value={reportData.mac} onChange={e => setReportData(p => ({...p, mac: e.target.value}))}
                className="w-full p-2.5 bg-background border border-input rounded-xl focus:ring-2 focus:ring-primary outline-none font-mono" />
            </div>
            <div>
              <label className="block font-bold text-foreground mb-1">RX Signal (dBm) *</label>
              <input type="text" placeholder="-22.33" value={reportData.rxSignal} onChange={e => setReportData(p => ({...p, rxSignal: e.target.value}))}
                className="w-full p-2.5 bg-background border border-input rounded-xl focus:ring-2 focus:ring-primary outline-none font-mono" />
            </div>
            <div>
              <label className="block font-bold text-foreground mb-1">TX Signal (dBm)</label>
              <input type="text" placeholder="-22.33" value={reportData.txSignal} onChange={e => setReportData(p => ({...p, txSignal: e.target.value}))}
                className="w-full p-2.5 bg-background border border-input rounded-xl focus:ring-2 focus:ring-primary outline-none font-mono" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-foreground flex items-center gap-1">
              <Wifi className="w-3.5 h-3.5 text-primary" /> Indikator ONT
            </label>
            <div className="grid grid-cols-2 gap-2">
              <LedToggle label="Power" value={reportData.powerIndicator} onChange={v => setReportData(p => ({...p, powerIndicator: v}))} />
              <LedToggle label="Link" value={reportData.linkIndicator} onChange={v => setReportData(p => ({...p, linkIndicator: v}))} />
              <LedToggle label="Auth" value={reportData.authIndicator} onChange={v => setReportData(p => ({...p, authIndicator: v}))} />
              <LedToggle label="WiFi 2.4G" value={reportData.wifi24Indicator} onChange={v => setReportData(p => ({...p, wifi24Indicator: v}))} />
              <LedToggle label="WiFi 5G" value={reportData.wifi5Indicator} onChange={v => setReportData(p => ({...p, wifi5Indicator: v}))} />
              <LedToggle label="Internet" value={reportData.internetIndicator} onChange={v => setReportData(p => ({...p, internetIndicator: v}))} />
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-bold text-foreground flex items-center gap-1">
              <Camera className="w-3.5 h-3.5 text-primary" /> Foto Instalasi *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {([
                ['Foto Rumah', 'Foto Depan Rumah'],
                ['Foto OPM / Redaman', 'Foto OPM / Redaman (RX Signal)'],
                ['Foto ONT Depan', 'Foto ONT Depan (SN terlihat)'],
                ['Foto ONT Belakang', 'Foto ONT Belakang'],
                ['Foto Speedtest', 'Foto Speedtest'],
              ] as [string, string][]).map(([key, label]) => (
                <PhotoSlot key={key} label={label} photoKey={key} required photoUrl={photos[key]}
                  uploading={uploadingKey === key} gpsLat={lockedCustomerGps?.lat ?? null} gpsLng={lockedCustomerGps?.lng ?? null}
                  spkLabel={spkLabel} onUpload={uploadPhoto} onOpenLive={openCameraModal} />
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-border flex justify-between gap-3">
            <button onClick={() => setStep(2)} className="px-3.5 py-3 bg-muted text-foreground font-bold text-xs rounded-xl flex items-center gap-1 shrink-0">
              <ChevronLeft className="w-4 h-4" /> Step 2
            </button>
            <button onClick={submitComplete} disabled={submitting}
              className="flex-1 sm:flex-initial px-5 py-3.5 bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-xl hover:bg-emerald-700 flex items-center justify-center gap-2">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Selesaikan Pekerjaan SPK
            </button>
          </div>
        </div>
      )}

      {/* Live Camera Modal */}
      {cameraModalKey && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-between p-4">
          <div className="w-full flex justify-between items-center z-10 pt-2 px-2">
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-primary">Kamera Live</span>
              <h3 className="text-sm font-bold text-white font-mono">{cameraModalKey}</h3>
            </div>
            <button onClick={closeCameraModal} className="p-2 text-white/80 hover:text-white bg-white/10 rounded-full">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="relative w-full max-w-md aspect-[3/4] bg-black rounded-2xl overflow-hidden border border-white/20 my-auto flex items-center justify-center">
            {cameraLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white/80 bg-black/60 z-10 gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <span className="text-xs font-mono">Membuka Kamera...</span>
              </div>
            )}
            {cameraError ? (
              <div className="p-4 text-center space-y-3">
                <p className="text-xs font-bold text-rose-400">{cameraError}</p>
                <button onClick={() => startCamera(facingMode)}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-xl font-bold text-xs">
                  <RefreshCw className="w-3.5 h-3.5 inline mr-1" /> Coba Lagi
                </button>
              </div>
            ) : (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            )}
          </div>

          <div className="w-full max-w-md space-y-3">
            <div className="flex gap-3">
              <button onClick={() => { const m = facingMode === 'environment' ? 'user' : 'environment'; setFacingMode(m); startCamera(m); }}
                className="p-3.5 bg-white/10 text-white rounded-2xl flex items-center justify-center">
                <FlipHorizontal className="w-5 h-5" />
              </button>
              <button onClick={captureFromLive} disabled={!!cameraError || cameraLoading || !!uploadingKey}
                className="flex-1 py-4 bg-white rounded-2xl font-bold text-slate-900 text-sm flex items-center justify-center gap-2">
                {uploadingKey ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
                {uploadingKey ? 'Mengupload...' : 'Ambil Foto'}
              </button>
              <label className="p-3.5 bg-white/10 text-white rounded-2xl flex items-center justify-center cursor-pointer">
                <ImageIcon className="w-5 h-5" />
                <input type="file" accept="image/*" className="hidden"
                  onChange={async e => {
                    const file = e.target.files?.[0]; if (!file) return;
                    const currentGps = step === 2 ? lockedOdpGps : lockedCustomerGps;
                    const processed = await addPhotoOverlay(file, currentGps?.lat ?? null, currentGps?.lng ?? null, spkLabel);
                    closeCameraModal();
                    if (cameraModalKey) await uploadPhoto(cameraModalKey, processed);
                    e.target.value = '';
                  }} />
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
