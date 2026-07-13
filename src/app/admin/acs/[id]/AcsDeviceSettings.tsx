'use client';

import { useState } from 'react';
import { useToast } from '@/components/cyberpunk/CyberToast';
import { useRouter } from 'next/navigation';
import { Loader2, Wifi, Key, Save, RefreshCw } from 'lucide-react';

const ZteParamMap = {
  ssid: 'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID',
  wifiPassword: 'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.PreSharedKey.1.PreSharedKey',
  pppoeUsername: 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Username',
  pppoePassword: 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Password',
};

export default function AcsDeviceSettings({
  serialNumber,
  parameters,
}: {
  serialNumber: string;
  parameters: Record<string, string>;
}) {
  const { addToast } = useToast();
  const router = useRouter();
  
  // Wifi Settings State
  const [ssid, setSsid] = useState(parameters[ZteParamMap.ssid] || '');
  const [wifiPassword, setWifiPassword] = useState(parameters[ZteParamMap.wifiPassword] || '');
  const [loadingWifi, setLoadingWifi] = useState(false);

  // PPPoE Settings State
  const [pppoeUser, setPppoeUser] = useState(parameters[ZteParamMap.pppoeUsername] || '');
  const [pppoePass, setPppoePass] = useState(parameters[ZteParamMap.pppoePassword] || '');
  const [loadingPppoe, setLoadingPppoe] = useState(false);

  const [loadingRefresh, setLoadingRefresh] = useState(false);

  const executeAction = async (action: string, payload: any) => {
    const res = await fetch(`/api/acs/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serialNumber, action, ...payload }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Gagal mengirim perintah');
    }
    return data;
  };

  const handleSaveWifi = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingWifi(true);
    try {
      await executeAction('SetParameterValues', {
        parameterValues: [
          { name: ZteParamMap.ssid, value: ssid, type: 'xsd:string' },
          { name: ZteParamMap.wifiPassword, value: wifiPassword, type: 'xsd:string' }
        ]
      });
      addToast({ type: 'success', title: 'Berhasil', description: 'Perintah ubah WiFi telah diantrekan.' });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', description: err.message });
    } finally {
      setLoadingWifi(false);
    }
  };

  const handleSavePppoe = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingPppoe(true);
    try {
      await executeAction('SetParameterValues', {
        parameterValues: [
          { name: ZteParamMap.pppoeUsername, value: pppoeUser, type: 'xsd:string' },
          { name: ZteParamMap.pppoePassword, value: pppoePass, type: 'xsd:string' }
        ]
      });
      addToast({ type: 'success', title: 'Berhasil', description: 'Perintah ubah PPPoE telah diantrekan.' });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', description: err.message });
    } finally {
      setLoadingPppoe(false);
    }
  };

  const handleRefresh = async () => {
    setLoadingRefresh(true);
    try {
      await executeAction('RefreshData', {});
      addToast({ type: 'success', title: 'Berhasil', description: 'Perintah Refresh Data telah diantrekan.' });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', description: err.message });
    } finally {
      setLoadingRefresh(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          onClick={handleRefresh}
          disabled={loadingRefresh}
          className="flex items-center gap-2 bg-secondary text-secondary-foreground hover:bg-secondary/80 px-4 py-2 rounded-md text-sm font-medium transition-colors"
        >
          {loadingRefresh ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Tarik Data Terbaru
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Wifi Card */}
        <div className="bg-card border border-border p-5 rounded-lg space-y-4">
          <h3 className="font-semibold flex items-center gap-2 border-b border-border pb-2">
            <Wifi className="w-4 h-4 text-primary" />
            Pengaturan Wi-Fi
          </h3>
          <form onSubmit={handleSaveWifi} className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">SSID</label>
              <input
                type="text"
                value={ssid}
                onChange={(e) => setSsid(e.target.value)}
                className="w-full bg-background border border-border rounded p-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Password</label>
              <input
                type="text"
                value={wifiPassword}
                onChange={(e) => setWifiPassword(e.target.value)}
                className="w-full bg-background border border-border rounded p-2 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={loadingWifi}
              className="w-full flex justify-center items-center gap-2 bg-primary text-primary-foreground p-2 rounded text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {loadingWifi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Simpan Wi-Fi
            </button>
          </form>
        </div>

        {/* PPPoE Card */}
        <div className="bg-card border border-border p-5 rounded-lg space-y-4">
          <h3 className="font-semibold flex items-center gap-2 border-b border-border pb-2">
            <Key className="w-4 h-4 text-primary" />
            Pengaturan PPPoE
          </h3>
          <form onSubmit={handleSavePppoe} className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Username PPPoE</label>
              <input
                type="text"
                value={pppoeUser}
                onChange={(e) => setPppoeUser(e.target.value)}
                className="w-full bg-background border border-border rounded p-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Password PPPoE</label>
              <input
                type="text"
                value={pppoePass}
                onChange={(e) => setPppoePass(e.target.value)}
                className="w-full bg-background border border-border rounded p-2 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={loadingPppoe}
              className="w-full flex justify-center items-center gap-2 bg-primary text-primary-foreground p-2 rounded text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {loadingPppoe ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Simpan PPPoE
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
