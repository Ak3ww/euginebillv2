'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Smartphone, CheckCircle2, ArrowLeft, Globe, Share, PlusSquare, ShieldCheck, Zap } from 'lucide-react';

export default function DownloadAppPage() {
  const router = useRouter();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    // Check if iOS
    const ua = window.navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    setIsIos(ios);

    // Check if already PWA
    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      (navigator as any).standalone === true
    ) {
      setIsStandalone(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsStandalone(true);
      }
      setDeferredPrompt(null);
    } else if (isIos) {
      alert('Untuk pengguna iPhone/iPad:\n1. Tekan tombol Share di bagian bawah Safari.\n2. Pilih "Tambah ke Layar Utama" ("Add to Home Screen").');
    } else {
      alert('Untuk menginstall aplikasi:\n1. Buka menu titik tiga (⋮) di browser Chrome/Edge.\n2. Pilih "Install Aplikasi" atau "Tambah ke Layar Utama".');
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8 flex flex-col justify-between">
      
      <div className="max-w-md mx-auto w-full space-y-6">
        
        {/* Header Navigation */}
        <button
          onClick={() => router.push('/customer')}
          className="flex items-center gap-1.5 text-xs font-mono font-bold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali ke Portal Customer
        </button>

        {/* Main Card */}
        <div className="bg-card border-2 border-primary/30 rounded-3xl p-6 shadow-2xl text-center space-y-6">
          
          <div className="mx-auto w-24 h-24 bg-gradient-to-tr from-primary to-accent rounded-3xl flex items-center justify-center shadow-xl shadow-primary/20 border-2 border-white/20">
            <Smartphone className="w-12 h-12 text-white" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold font-display text-foreground">Aplikasi Customer Portal</h1>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Dapatkan pengalaman akses internet terhebat! Pasang aplikasi resmi di layar utama smartphone Anda.
            </p>
          </div>

          {isStandalone ? (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-600 dark:text-emerald-400 text-xs font-bold font-mono flex items-center justify-center gap-2">
              <CheckCircle2 className="w-5 h-5" /> Aplikasi Sudah Terpasang!
            </div>
          ) : (
            <div className="space-y-3">
              <button
                onClick={handleInstall}
                className="w-full py-4 px-6 bg-primary text-primary-foreground hover:opacity-90 rounded-2xl font-mono text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-primary/30 transition-all active:scale-[0.98]"
              >
                <Smartphone className="w-5 h-5" /> Install Instan (PWA)
              </button>

              <a
                href="/api/public/download-apk"
                target="_blank"
                rel="noreferrer"
                className="w-full py-3.5 px-6 bg-muted hover:bg-muted/80 border border-border text-foreground rounded-2xl font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all"
              >
                <Download className="w-4 h-4 text-emerald-500" /> Download File APK Direct (.apk)
              </a>
            </div>
          )}

          {/* Features Highlights */}
          <div className="bg-muted/40 border border-border rounded-2xl p-4 text-left space-y-3 text-xs">
            <h3 className="font-mono font-bold text-[10px] uppercase text-muted-foreground tracking-wider">Keunggulan Aplikasi:</h3>
            <div className="flex items-start gap-2.5">
              <Zap className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <span className="text-foreground font-medium">Buka portal &amp; bayar tagihan tanpa perlu buka browser</span>
            </div>
            <div className="flex items-start gap-2.5">
              <Globe className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span className="text-foreground font-medium">Akses langsung status koneksi internet &amp; tiket bantuan</span>
            </div>
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <span className="text-foreground font-medium">100% Aman, Bebas Virus, &amp; Hemat Penyimpanan HP</span>
            </div>
          </div>

          {/* OS Install Guides */}
          <div className="text-left space-y-3 text-xs border-t border-border pt-4">
            <h3 className="font-mono font-bold text-[10px] uppercase text-muted-foreground tracking-wider">Panduan Manual:</h3>
            
            {isIos ? (
              <div className="p-3 bg-background border border-border rounded-xl space-y-1.5">
                <span className="font-bold text-foreground flex items-center gap-1">🍎 iPhone / iPad (Safari)</span>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Tekan ikon <strong>Share <Share className="w-3 h-3 inline" /></strong> di bagian bawah browser, lalu pilih <strong>&quot;Tambah ke Layar Utama&quot; <PlusSquare className="w-3 h-3 inline" /></strong>.
                </p>
              </div>
            ) : (
              <div className="p-3 bg-background border border-border rounded-xl space-y-1.5">
                <span className="font-bold text-foreground flex items-center gap-1">🤖 Android (Chrome / Edge)</span>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Tekan menu titik tiga <strong>(⋮)</strong> di sudut kanan atas browser, lalu pilih <strong>&quot;Install Aplikasi&quot;</strong> atau <strong>&quot;Tambah ke Layar Utama&quot;</strong>.
                </p>
              </div>
            )}
          </div>

        </div>

      </div>

      <div className="text-center py-4 text-[10px] font-mono text-muted-foreground">
        &copy; {new Date().getFullYear()} EugineBill Customer Portal. All rights reserved.
      </div>

    </div>
  );
}
