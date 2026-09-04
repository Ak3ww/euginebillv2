'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Download, X, Zap, Bell, ShieldCheck, Share, PlusSquare, MoreVertical, ArrowDown } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PwaInstallPrompt() {
  const pathname = usePathname();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    // Auto-detect if running as installed PWA or previously installed
    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      window.matchMedia('(display-mode: minimal-ui)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true ||
      document.referrer.includes('android-app://') ||
      localStorage.getItem('pwa-installed') === '1'
    ) {
      setInstalled(true);
      return;
    }

    // Detect iOS
    const ua = window.navigator.userAgent.toLowerCase();
    if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) {
      setIsIos(true);
    }

    // Check session dismiss
    if (sessionStorage.getItem('pwa-install-dismissed')) {
      setDismissed(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => {
      setInstalled(true);
      localStorage.setItem('pwa-installed', '1');
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          setInstalled(true);
          localStorage.setItem('pwa-installed', '1');
        }
        setDeferredPrompt(null);
        return;
      } catch (e) {
        console.error('Install prompt error:', e);
      }
    }

    // If native prompt is not available (e.g. iOS or manual browser requirement), show inline guide
    setShowGuide(true);
  };

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem('pwa-install-dismissed', '1');
  };

  // Do not render on admin/technician/agent routes or customer payment flows
  if (
    !pathname ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/technician') ||
    pathname.startsWith('/agent') ||
    pathname.startsWith('/pay') ||
    pathname.startsWith('/payment') ||
    pathname.includes('/pay')
  ) {
    return null;
  }

  // Auto-hide if already installed or dismissed
  if (installed || dismissed) return null;

  return (
    <div className="fixed inset-0 z-[99999] bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="relative w-full max-w-sm bg-card border-2 border-primary/40 rounded-3xl p-6 shadow-2xl space-y-4 text-center animate-in zoom-in-95 duration-300">
        
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-full transition-colors"
          aria-label="Tutup"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Official Company Logo Icon */}
        <div className="mx-auto w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20 border-2 border-white/20 p-2 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/api/pwa/icon?size=192" alt="Eugine Media Logo" className="w-full h-full object-contain rounded-xl" />
        </div>

        {/* Header */}
        <div className="space-y-1">
          <h2 className="text-lg font-bold font-display text-foreground">Install Aplikasi Pelanggan</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Pasang di layar utama HP Anda untuk akses cepat 1x klik tanpa download file APK!
          </p>
        </div>

        {/* Features list */}
        {!showGuide && (
          <div className="bg-muted/40 border border-border rounded-2xl p-3.5 text-left space-y-2 text-xs">
            <div className="flex items-start gap-2.5">
              <Zap className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <span className="text-foreground font-medium">Buka portal &amp; bayar tagihan 1x klik</span>
            </div>
            <div className="flex items-start gap-2.5">
              <Bell className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span className="text-foreground font-medium">Notifikasi pengingat &amp; status jaringan</span>
            </div>
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <span className="text-foreground font-medium">Aman, ringan, &amp; tanpa download file APK</span>
            </div>
          </div>
        )}

        {/* Step-by-step PWA Guide if native prompt is not supported (e.g. iOS Safari) */}
        {showGuide && (
          <div className="bg-primary/10 border border-primary/30 rounded-2xl p-4 text-left space-y-3 text-xs animate-in fade-in">
            <div className="flex items-center gap-2 font-bold text-primary">
              <ArrowDown className="w-4 h-4" /> Cara Tambah ke Layar Utama:
            </div>
            {isIos ? (
              <ol className="list-decimal list-inside space-y-2 text-foreground font-medium">
                <li className="leading-snug">Tap tombol <strong className="inline-flex items-center gap-1 text-primary"><Share className="w-3.5 h-3.5 inline" /> Share</strong> di bagian bawah Safari</li>
                <li className="leading-snug">Geser ke bawah lalu pilih <strong className="inline-flex items-center gap-1 text-primary"><PlusSquare className="w-3.5 h-3.5 inline" /> Tambahkan ke Layar Utama</strong></li>
                <li className="leading-snug">Tap <strong className="text-primary">"Tambah"</strong> di pojok kanan atas</li>
              </ol>
            ) : (
              <ol className="list-decimal list-inside space-y-2 text-foreground font-medium">
                <li className="leading-snug">Tap ikon <strong className="inline-flex items-center gap-1 text-primary"><MoreVertical className="w-3.5 h-3.5 inline" /> Titik Tiga</strong> di pojok kanan atas browser</li>
                <li className="leading-snug">Pilih menu <strong className="text-primary font-bold">"Instal Aplikasi"</strong> atau <strong className="text-primary font-bold">"Tambahkan ke Layar Utama"</strong></li>
                <li className="leading-snug">Konfirmasi pendaftaran PWA di HP Anda</li>
              </ol>
            )}
          </div>
        )}

        {/* Buttons */}
        <div className="space-y-2 pt-1">
          <button
            onClick={handleInstall}
            className="w-full py-3 px-4 bg-primary text-primary-foreground hover:opacity-90 rounded-2xl font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-primary/30 transition-all active:scale-[0.98]"
          >
            <Download className="w-4 h-4" /> {showGuide ? 'Coba Pasang Otomatis' : 'Install / Tambah ke Utama'}
          </button>

          <button
            onClick={handleDismiss}
            className="w-full py-1.5 text-xs font-mono font-bold text-muted-foreground hover:text-foreground transition-colors"
          >
            Nanti Saja
          </button>
        </div>

      </div>
    </div>
  );
}
