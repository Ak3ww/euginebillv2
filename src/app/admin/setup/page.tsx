'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function AdminSetupRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/setup');
  }, [router]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Mengarahkan ke Setup Wizard Terpadu (/setup)...</p>
    </div>
  );
}
