'use client';

import { useEffect } from 'react';
import { RefreshCw, RotateCcw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isChunkError =
    error?.name === 'ChunkLoadError' ||
    error?.message?.includes('ChunkLoadError') ||
    error?.message?.includes('Failed to load chunk') ||
    error?.message?.includes('Loading chunk');

  useEffect(() => {
    if (isChunkError && typeof window !== 'undefined') {
      const storageKey = 'eugine_admin_chunk_reload';
      const lastRetry = sessionStorage.getItem(storageKey);
      if (!lastRetry) {
        sessionStorage.setItem(storageKey, Date.now().toString());
        window.location.reload();
      }
    }
  }, [isChunkError]);

  const handleHardReload = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('eugine_admin_chunk_reload');
      window.location.reload();
    } else {
      reset();
    }
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <Card className="max-w-md w-full border-border bg-card shadow-sm">
        <CardContent className="pt-6 pb-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary mx-auto flex items-center justify-center">
            {isChunkError ? <RefreshCw className="w-6 h-6 animate-spin" /> : <AlertCircle className="w-6 h-6" />}
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-foreground">
              {isChunkError ? 'Pembaruan Komponen Terdeteksi' : 'Gagal Memuat Halaman'}
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {isChunkError
                ? 'Server baru saja memperbarui bundle aplikasi. Silakan muat ulang halaman untuk menggunakan versi terbaru.'
                : error?.message || 'Terjadi kendala saat memuat data antarmuka.'}
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 pt-2">
            <Button size="sm" onClick={handleHardReload} className="gap-1.5 text-xs">
              <RotateCcw className="w-3.5 h-3.5" />
              Muat Ulang Halaman
            </Button>
            <Button size="sm" variant="outline" onClick={reset} className="text-xs">
              Coba Lagi
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
