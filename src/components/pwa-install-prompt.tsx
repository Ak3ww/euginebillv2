'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Download, X, Smartphone, CheckCircle2, Zap, Bell, ShieldCheck } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PwaInstallPrompt() {
  const pathname = usePathname();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Already running as installed PWA (standalone/fullscreen/minimal-ui)
    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    ) {
      setInstalled(true);
      return;
    }

    // Dismissed in this session
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
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      // Fallback for iOS or unsupported browsers: redirect to download guide
      window.location.href = '/download-app';
      return;
    }
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstalled(true);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem('pwa-install-dismissed', '1');
  };

  // DO NOT show on Admin, Technician, or Agent portals
  if (
    !pathname ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/technician') ||
    pathname.startsWith('/agent')
  ) {
    return null;
  }

  // Hide if already installed or dismissed
  if (installed || dismissed) return null;

  return (
    <div className="fixed inset-0 z-[99999] bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
      
      {/* Modal Popup Container */}
      <div className="relative w-full max-w-sm bg-card border-2 border-primary/30 rounded-3xl p-6 shadow-2xl space-y-5 text-center animate-in zoom-in-95 duration-300">
        
        {/* Close Button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-full transition-colors"
          aria-label="Tutup"
        >
          <X className="w-5 h-5" />
        </button>

        {/* App Icon Header */}
        <div className="mx-auto w-20 h-20 bg-gradient-to-tr from-primary to-accent rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20 border-2 border-white/20">
          <Smartphone className="w-10 h-10 text-white" />
        </div>

        {/* Title & Description */}
        <div className="space-y-1.5">
          <h2 className="text-xl font-bold font-display text-foreground">Install Aplikasi Pelanggan</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Pasang aplikasi di layar utama HP Anda untuk akses internet cepat tanpa repot buka browser!
          </p>
        </div>

        {/* Key Features Benefits List */}
        <div className="bg-muted/40 border border-border rounded-2xl p-4 text-left space-y-2.5 text-xs">
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
            <span className="text-foreground font-medium">Aman, ringan, &amp; tanpa download file APK berat</span>
          </div>
        </div>

        {/* Primary Action Button */}
        <div className="space-y-2 pt-1">
          <button
            onClick={handleInstall}
            className="w-full py-3.5 px-4 bg-primary text-primary-foreground hover:opacity-90 rounded-2xl font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-primary/30 transition-all active:scale-[0.98]"
          >
            <Download className="w-4 h-4" /> Install / Tambah ke Utama
          </button>

          <button
            onClick={handleDismiss}
            className="w-full py-2 text-xs font-mono font-bold text-muted-foreground hover:text-foreground transition-colors"
          >
            Nanti Saja
          </button>
        </div>

      </div>
    </div>
  );
}
