'use client';

import { useState } from 'react';
import { Power, RotateCcw, Loader2, RefreshCw, Radio } from 'lucide-react';
import { useToast } from '@/components/cyberpunk/CyberToast';
import { useRouter } from 'next/navigation';

export default function AcsDeviceActions({
  serialNumber,
  hasConnectionRequestUrl,
}: {
  serialNumber: string;
  hasConnectionRequestUrl: boolean;
}) {
  const { addToast } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState('');

  const handleAction = async (action: string, label?: string) => {
    const actionLabel = label || action;
    if (action === 'Reboot' || action === 'FactoryReset') {
      if (!confirm(`Anda yakin ingin melakukan ${actionLabel} pada perangkat ini?`)) return;
    }

    setLoading(action);
    try {
      const res = await fetch(`/api/acs/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serialNumber, action }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        addToast({
          type: 'success',
          title: 'Berhasil',
          description: data.message || `Perintah ${actionLabel} telah diantrekan.`,
        });
        router.refresh();
      } else {
        throw new Error(data.error || 'Gagal mengirim perintah');
      }
    } catch (e: any) {
      addToast({ type: 'error', title: 'Error', description: e.message });
    } finally {
      setLoading('');
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Connection Request — push Inform sekarang */}
      <button
        onClick={() => handleAction('ConnectionRequest', 'Push Inform Sekarang')}
        disabled={!!loading || !hasConnectionRequestUrl}
        title={!hasConnectionRequestUrl ? 'Connection Request URL belum tersedia (device belum Inform)' : ''}
        className="w-full flex items-center justify-between p-3 border border-border rounded-md hover:bg-muted/50 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-primary group-hover:text-primary/80" />
          <div className="text-left">
            <div className="text-sm font-medium">Push Inform Sekarang</div>
            <div className="text-[10px] text-muted-foreground">
              {hasConnectionRequestUrl ? 'Minta device segera Inform ke ACS' : 'URL belum tersedia'}
            </div>
          </div>
        </div>
        {loading === 'ConnectionRequest'
          ? <Loader2 className="w-4 h-4 animate-spin" />
          : <span className="text-xs text-muted-foreground border border-border px-2 py-0.5 rounded">Push</span>
        }
      </button>

      {/* Refresh Data */}
      <button
        onClick={() => handleAction('RefreshData', 'Ambil Data Terbaru')}
        disabled={!!loading}
        className="w-full flex items-center justify-between p-3 border border-border rounded-md hover:bg-muted/50 transition-colors group disabled:opacity-50"
      >
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-green-500 group-hover:text-green-400" />
          <div className="text-left">
            <div className="text-sm font-medium">Ambil Data Terbaru</div>
            <div className="text-[10px] text-muted-foreground">SSID, RxPower, Uptime, dll</div>
          </div>
        </div>
        {loading === 'RefreshData'
          ? <Loader2 className="w-4 h-4 animate-spin" />
          : <span className="text-xs text-muted-foreground border border-border px-2 py-0.5 rounded">Sync</span>
        }
      </button>

      {/* Reboot */}
      <button
        onClick={() => handleAction('Reboot', 'Reboot Perangkat')}
        disabled={!!loading}
        className="w-full flex items-center justify-between p-3 border border-border rounded-md hover:bg-muted/50 transition-colors group disabled:opacity-50"
      >
        <div className="flex items-center gap-2">
          <Power className="w-4 h-4 text-orange-500 group-hover:text-orange-400" />
          <span className="text-sm font-medium">Reboot Perangkat</span>
        </div>
        {loading === 'Reboot'
          ? <Loader2 className="w-4 h-4 animate-spin" />
          : <span className="text-xs text-muted-foreground border border-border px-2 py-0.5 rounded">Reboot</span>
        }
      </button>

      {/* Factory Reset */}
      <button
        onClick={() => handleAction('FactoryReset', 'Factory Reset')}
        disabled={!!loading}
        className="w-full flex items-center justify-between p-3 border border-red-500/20 rounded-md hover:bg-red-500/10 transition-colors group disabled:opacity-50"
      >
        <div className="flex items-center gap-2">
          <RotateCcw className="w-4 h-4 text-red-500 group-hover:text-red-400" />
          <span className="text-sm font-medium text-red-500">Reset Pabrik</span>
        </div>
        {loading === 'FactoryReset'
          ? <Loader2 className="w-4 h-4 animate-spin text-red-500" />
          : <span className="text-xs text-red-500 border border-red-500/20 px-2 py-0.5 rounded">Reset</span>
        }
      </button>

      <p className="text-xs text-muted-foreground leading-relaxed pt-1">
        Perintah dieksekusi saat Inform berikutnya. Gunakan "Push Inform" agar lebih cepat.
      </p>
    </div>
  );
}
