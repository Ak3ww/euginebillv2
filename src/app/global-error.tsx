'use client';

import { useEffect } from 'react';

/**
 * Global error boundary — replaces Next.js auto-generated /_global-error.
 * Handles unrecoverable errors including post-deploy ChunkLoadErrors.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // If chunk failed to load (common right after VPS redeploy/rebuild), auto reload once
    const isChunkError =
      error?.name === 'ChunkLoadError' ||
      error?.message?.includes('ChunkLoadError') ||
      error?.message?.includes('Failed to load chunk') ||
      error?.message?.includes('Loading chunk');

    if (isChunkError && typeof window !== 'undefined') {
      const storageKey = 'eugine_chunk_reload_retry';
      const lastRetry = sessionStorage.getItem(storageKey);
      if (!lastRetry) {
        sessionStorage.setItem(storageKey, Date.now().toString());
        window.location.reload();
      }
    }
  }, [error]);

  const handleReload = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('eugine_chunk_reload_retry');
      window.location.reload();
    } else {
      reset();
    }
  };

  return (
    <html lang="id">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif', background: '#090d16', color: '#f1f5f9' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '24px', textAlign: 'center' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(56, 189, 248, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
            </svg>
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '8px', color: '#f8fafc' }}>
            Pembaruan Sistem Terdeteksi
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '14px', maxWidth: '420px', lineHeight: 1.6, marginBottom: '24px' }}>
            Aplikasi baru saja diperbarui di server. Silakan muat ulang halaman untuk memuat script dan komponen antarmuka versi terbaru.
          </p>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={handleReload}
              style={{
                padding: '10px 22px',
                background: '#0284c7',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 500,
                boxShadow: '0 2px 8px rgba(2, 132, 199, 0.3)',
              }}
            >
              Muat Ulang Halaman
            </button>
            <button
              onClick={reset}
              style={{
                padding: '10px 18px',
                background: 'rgba(255, 255, 255, 0.05)',
                color: '#cbd5e1',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              Coba Lagi
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
