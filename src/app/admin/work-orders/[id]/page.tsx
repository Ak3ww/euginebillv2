'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { 
  ArrowLeft, CheckCircle2, Loader2, MapPin, Phone, 
  Wrench, Camera, CheckSquare, Calendar, User, Send, Download
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AdminWorkOrderDetailPage() {
  const router = useRouter();
  const params = useParams();

  const [wo, setWo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWo();
  }, [params.id]);

  const fetchWo = async () => {
    try {
      const res = await fetch(`/api/admin/work-orders/${params.id}`);
      if (res.ok) {
        const data = await res.json();
        setWo(data.workOrder);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
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
  const checklist = wo.equipmentChecklist || {};

  return (
    <div className="p-4 md:p-8 w-full max-w-5xl mx-auto space-y-6">
      <button 
        onClick={() => router.back()} 
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
            <p className="text-xs text-muted-foreground mt-0.5">Tipe Pekerjaan: <strong className="text-foreground">{wo.issueType.replace('_', ' ')}</strong></p>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn('px-3 py-1 rounded-full font-mono text-xs uppercase tracking-wider font-bold border', 
              wo.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-amber-500/10 text-amber-600 border-amber-500/20')}>
              {wo.status}
            </span>
            <span className="px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded-full font-mono text-xs font-bold uppercase">
              Prioritas: {wo.priority}
            </span>
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

    </div>
  );
}
