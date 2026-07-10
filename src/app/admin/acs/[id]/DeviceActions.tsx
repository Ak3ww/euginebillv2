'use client';

import { useState } from 'react';
import { Power, RotateCcw, Wifi, Loader2 } from 'lucide-react';
import { useToast } from '@/components/cyberpunk/CyberToast';
import { useRouter } from 'next/navigation';

export default function AcsDeviceActions({ serialNumber }: { serialNumber: string }) {
  const { addToast } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState('');

  const handleAction = async (action: string) => {
    if (!confirm(`Anda yakin ingin melakukan aksi ${action} pada perangkat ini?`)) return;
    
    setLoading(action);
    try {
      const res = await fetch(`/api/acs/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serialNumber, action }),
      });
      
      const data = await res.json();
      if (res.ok && data.success) {
        addToast({ type: 'success', title: 'Berhasil', description: `Perintah ${action} telah diantrekan ke ONT. Tunggu beberapa saat agar perangkat mengeksekusinya.` });
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
      <button 
        onClick={() => handleAction('Reboot')}
        disabled={!!loading}
        className="w-full flex items-center justify-between p-3 border border-border rounded-md hover:bg-muted/50 transition-colors group disabled:opacity-50"
      >
        <div className="flex items-center gap-2">
          <Power className="w-4 h-4 text-orange-500 group-hover:text-orange-400" />
          <span className="text-sm font-medium">Reboot Perangkat</span>
        </div>
        {loading === 'Reboot' ? <Loader2 className="w-4 h-4 animate-spin" /> : <span className="text-xs text-muted-foreground border border-border px-2 py-0.5 rounded">Reboot</span>}
      </button>

      <button 
        onClick={() => handleAction('FactoryReset')}
        disabled={!!loading}
        className="w-full flex items-center justify-between p-3 border border-red-500/20 rounded-md hover:bg-red-500/10 transition-colors group disabled:opacity-50"
      >
        <div className="flex items-center gap-2">
          <RotateCcw className="w-4 h-4 text-red-500 group-hover:text-red-400" />
          <span className="text-sm font-medium text-red-500">Reset Pabrik (Factory Reset)</span>
        </div>
        {loading === 'FactoryReset' ? <Loader2 className="w-4 h-4 animate-spin text-red-500" /> : <span className="text-xs text-red-500 border border-red-500/20 px-2 py-0.5 rounded">Reset</span>}
      </button>

      <div className="pt-2 border-t border-border mt-2 space-y-3">
        <h4 className="text-sm font-medium">Pengaturan Lanjutan</h4>
        <button 
          onClick={() => {
            const wanName = prompt('Nama Koneksi WAN (contoh: InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection):');
            if (wanName) {
              handleAction('AddObject', { objectName: wanName });
            }
          }}
          disabled={!!loading}
          className="w-full flex items-center justify-between p-3 border border-border rounded-md hover:bg-muted/50 transition-colors disabled:opacity-50"
        >
          <span className="text-sm font-medium">Add WAN Connection (TR-069)</span>
        </button>

        <button 
          onClick={() => {
            const ssidNode = prompt('Parameter SSID (contoh: InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID):');
            const passNode = prompt('Parameter Password (contoh: InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.PreSharedKey.1.PreSharedKey):');
            const ssid = prompt('SSID Baru:');
            const password = prompt('Password Baru:');
            if (ssidNode && passNode && ssid && password) {
              handleAction('SetParameterValues', { 
                parameterValues: [
                  { name: ssidNode, value: ssid, type: 'xsd:string' },
                  { name: passNode, value: password, type: 'xsd:string' }
                ] 
              });
            }
          }}
          disabled={!!loading}
          className="w-full flex items-center justify-between p-3 border border-border rounded-md hover:bg-muted/50 transition-colors disabled:opacity-50"
        >
          <span className="text-sm font-medium">Ubah SSID & Password WiFi</span>
        </button>

        <button 
          onClick={() => {
            const rxPowerNode = prompt('Parameter RX Power (contoh: InternetGatewayDevice.WANDevice.1.WANDSLInterfaceConfig.OpticalSignalLevel):');
            if (rxPowerNode) {
              handleAction('GetParameterValues', { parameterNames: [rxPowerNode] });
            }
          }}
          disabled={!!loading}
          className="w-full flex items-center justify-between p-3 border border-border rounded-md hover:bg-muted/50 transition-colors disabled:opacity-50"
        >
          <span className="text-sm font-medium">Baca Redaman (Optical Power)</span>
        </button>
      </div>
        <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
          Catatan: ONT hanya akan mengeksekusi perintah ini ketika melakukan heartbeat (Inform) berikutnya atau jika fitur Connection Request berhasil diakses.
        </p>
      </div>
    </div>
  );
}
