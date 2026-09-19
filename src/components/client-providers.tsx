'use client';

import { useEffect, useState } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { PwaInstallPrompt } from '@/components/pwa-install-prompt';
import { setupClipboardPolyfill } from '@/lib/clipboard';

export function ClientProviders() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setupClipboardPolyfill();
    setMounted(true);
  }, []);
  if (!mounted) return null;
  return (
    <>
      <Toaster />
      <PwaInstallPrompt />
    </>
  );
}
