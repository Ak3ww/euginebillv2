'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { Download, Router as RouterIcon, Settings, Loader2 } from 'lucide-react';
import { useToast } from '@/components/cyberpunk/CyberToast';

export default function ImportPPPoEPage() {
  const { t } = useTranslation();
  const { addToast } = useToast();
  
  const [routers, setRouters] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [selectedRouter, setSelectedRouter] = useState('');
  const [selectedProfile, setSelectedProfile] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [rRes, pRes] = await Promise.all([
        fetch('/api/network/routers'),
        fetch('/api/pppoe/profiles')
      ]);
      if (rRes.ok) {
        const data = await rRes.json();
        setRouters(Array.isArray(data) ? data : data.routers || []);
      }
      if (pRes.ok) {
        const data = await pRes.json();
        setProfiles(Array.isArray(data) ? data : data.profiles || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setFetching(false);
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRouter || !selectedProfile) {
      addToast({ type: 'warning', title: 'Peringatan', description: 'Silakan pilih Router dan Profil Default.' });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/mikrotik/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routerId: selectedRouter, defaultProfileId: selectedProfile }),
      });
      const data = await res.json();
      
      if (res.ok && data.success) {
        addToast({ 
          type: 'success', 
          title: 'Import Berhasil', 
          description: `${data.imported} diimpor, ${data.skipped} dilewati, ${data.errors} error. Total: ${data.total}`,
          duration: 8000
        });
      } else {
        throw new Error(data.error || 'Gagal mengimpor');
      }
    } catch (e: any) {
      addToast({ type: 'error', title: 'Import Gagal', description: e.message });
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return <div className="p-8 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Download className="w-6 h-6 text-primary" />
          Import Secret MikroTik
        </h1>
        <p className="text-muted-foreground mt-1">Impor /ppp secret dari MikroTik ke sistem Billing.</p>
      </div>

      <form onSubmit={handleImport} className="bg-card border border-border p-6 rounded-lg max-w-2xl space-y-4 shadow-sm">
        <div>
          <label className="flex items-center gap-2 text-sm font-medium mb-2">
            <RouterIcon className="w-4 h-4" />
            Pilih Router MikroTik
          </label>
          <select 
            value={selectedRouter}
            onChange={e => setSelectedRouter(e.target.value)}
            className="w-full p-2.5 rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary outline-none"
            required
          >
            <option value="">-- Pilih Router --</option>
            {routers.map(r => (
              <option key={r.id} value={r.id}>{r.name} ({r.ipAddress})</option>
            ))}
          </select>
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-medium mb-2">
            <Settings className="w-4 h-4" />
            Profil PPPoE Default
          </label>
          <p className="text-xs text-muted-foreground mb-2">
            Profil ini akan digunakan jika tidak ada profil yang cocok dengan yang ada di MikroTik.
          </p>
          <select 
            value={selectedProfile}
            onChange={e => setSelectedProfile(e.target.value)}
            className="w-full p-2.5 rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary outline-none"
            required
          >
            <option value="">-- Pilih Profil Default --</option>
            {profiles.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground py-2.5 rounded-lg font-medium transition-colors mt-4 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
          {loading ? 'Mengimpor...' : 'Mulai Import'}
        </button>
      </form>
    </div>
  );
}
