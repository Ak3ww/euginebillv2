'use client';

import { useState } from 'react';
import { useToast } from '@/components/cyberpunk/CyberToast';
import { useRouter } from 'next/navigation';
import {
  Loader2, Wifi, Key, Save, RefreshCw, Smartphone, Zap, Monitor, AlertTriangle, CheckCircle2, ShieldAlert
} from 'lucide-react';

const ZteParamMap = {
  ssid:           'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID',
  wifiPassword:   'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.PreSharedKey.1.PreSharedKey',
  ssid5g:         'InternetGatewayDevice.LANDevice.1.WLANConfiguration.5.SSID',
  wifiPassword5g: 'InternetGatewayDevice.LANDevice.1.WLANConfiguration.5.PreSharedKey.1.PreSharedKey',
  pppoeUsername:  'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Username',
  pppoePassword:  'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Password',
};

interface ConnectedDevice {
  mac: string;
  ip: string;
  hostname: string;
  interface: string;
  active: boolean;
}

export default function AcsDeviceSettings({
  serialNumber,
  parameters,
  dedicatedSsid,
  dedicatedSsid5g,
  dedicatedWifiPw,
  dedicatedWifiPw5g,
  connectedDevices,
  connectedDevicesCount,
}: {
  serialNumber: string;
  parameters: Record<string, string>;
  dedicatedSsid?: string | null;
  dedicatedSsid5g?: string | null;
  dedicatedWifiPw?: string | null;
  dedicatedWifiPw5g?: string | null;
  connectedDevices?: ConnectedDevice[] | null;
  connectedDevicesCount?: number | null;
}) {
  const { addToast } = useToast();
  const router = useRouter();

  // WiFi 2.4GHz State
  const [ssid, setSsid] = useState(dedicatedSsid || parameters[ZteParamMap.ssid] || '');
  const [wifiPw, setWifiPw] = useState(dedicatedWifiPw || parameters[ZteParamMap.wifiPassword] || '');
  const [loadingWifi, setLoadingWifi] = useState(false);

  // WiFi 5GHz Detection & State
  const is5gEnableParam =
    parameters['InternetGatewayDevice.LANDevice.1.WLANConfiguration.5.Enable'] ||
    parameters['InternetGatewayDevice.LANDevice.1.WLANConfiguration.2.Enable'];

  const is5gDisabledOrMissing =
    is5gEnableParam === 'false' ||
    is5gEnableParam === '0';

  const has5gData = Boolean(
    (dedicatedSsid5g && dedicatedSsid5g.trim() !== '') ||
    (dedicatedWifiPw5g && dedicatedWifiPw5g.trim() !== '') ||
    parameters[ZteParamMap.ssid5g] ||
    parameters['InternetGatewayDevice.LANDevice.1.WLANConfiguration.2.SSID'] ||
    (is5gEnableParam === 'true' || is5gEnableParam === '1')
  );

  const is5gAvailable = has5gData && !is5gDisabledOrMissing;

  const [ssid5g, setSsid5g] = useState(dedicatedSsid5g || parameters[ZteParamMap.ssid5g] || parameters['InternetGatewayDevice.LANDevice.1.WLANConfiguration.2.SSID'] || '');
  const [wifiPw5g, setWifiPw5g] = useState(dedicatedWifiPw5g || parameters[ZteParamMap.wifiPassword5g] || parameters['InternetGatewayDevice.LANDevice.1.WLANConfiguration.2.PreSharedKey.1.PreSharedKey'] || '');
  const [loadingWifi5g, setLoadingWifi5g] = useState(false);

  // PPPoE State
  const [pppoeUser, setPppoeUser] = useState(parameters[ZteParamMap.pppoeUsername] || '');
  const [pppoePass, setPppoePass] = useState(parameters[ZteParamMap.pppoePassword] || '');
  const [loadingPppoe, setLoadingPppoe] = useState(false);

  const [loadingRefresh, setLoadingRefresh] = useState(false);
  const [loadingConnDevices, setLoadingConnDevices] = useState(false);
  const [localConnDevices, setLocalConnDevices] = useState<ConnectedDevice[]>(connectedDevices || []);

  const executeAction = async (action: string, payload: any) => {
    const res = await fetch(`/api/acs/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serialNumber, action, ...payload }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Gagal mengirim perintah');
    return data;
  };

  // ── Save WiFi 2.4GHz ──────────────────────────────────────────────────────
  const handleSaveWifi = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingWifi(true);
    try {
      await executeAction('SetParameterValues', {
        parameterValues: [
          { name: ZteParamMap.ssid, value: ssid, type: 'xsd:string' },
          { name: ZteParamMap.wifiPassword, value: wifiPw, type: 'xsd:string' },
        ]
      });
      addToast({ type: 'success', title: 'Berhasil', description: 'Perintah ubah WiFi 2.4GHz diantrekan. Perangkat akan menerapkan perubahan saat Inform berikutnya.' });
      router.refresh();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', description: err.message });
    } finally {
      setLoadingWifi(false);
    }
  };

  // ── Save WiFi 5GHz ────────────────────────────────────────────────────────
  const handleSaveWifi5g = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!is5gAvailable) {
      addToast({ type: 'error', title: 'Tidak Tersedia', description: 'Wi-Fi 5GHz tidak aktif atau tidak didukung pada modem ini.' });
      return;
    }
    setLoadingWifi5g(true);
    try {
      await executeAction('SetParameterValues', {
        parameterValues: [
          { name: ZteParamMap.ssid5g, value: ssid5g, type: 'xsd:string' },
          { name: ZteParamMap.wifiPassword5g, value: wifiPw5g, type: 'xsd:string' },
        ]
      });
      addToast({ type: 'success', title: 'Berhasil', description: 'Perintah ubah WiFi 5GHz diantrekan.' });
      router.refresh();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', description: err.message });
    } finally {
      setLoadingWifi5g(false);
    }
  };

  // ── Save PPPoE ────────────────────────────────────────────────────────────
  const handleSavePppoe = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingPppoe(true);
    try {
      await executeAction('SetParameterValues', {
        parameterValues: [
          { name: ZteParamMap.pppoeUsername, value: pppoeUser, type: 'xsd:string' },
          { name: ZteParamMap.pppoePassword, value: pppoePass, type: 'xsd:string' },
        ]
      });
      addToast({ type: 'success', title: 'Berhasil', description: 'Perintah ubah PPPoE diantrekan.' });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', description: err.message });
    } finally {
      setLoadingPppoe(false);
    }
  };

  // ── Refresh semua data ────────────────────────────────────────────────────
  const handleRefresh = async () => {
    setLoadingRefresh(true);
    try {
      await executeAction('RefreshData', {});
      addToast({ type: 'success', title: 'Berhasil', description: 'Perintah ambil data terbaru diantrekan. Data akan diperbarui saat Inform berikutnya.' });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', description: err.message });
    } finally {
      setLoadingRefresh(false);
    }
  };

  // ── Refresh connected devices ─────────────────────────────────────────────
  const handleRefreshConnDevices = async () => {
    setLoadingConnDevices(true);
    try {
      await executeAction('RefreshConnectedDevices', {});
      addToast({ type: 'success', title: 'Berhasil', description: 'Perintah ambil daftar perangkat WiFi diantrekan.' });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', description: err.message });
    } finally {
      setLoadingConnDevices(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex justify-end gap-2">
        <button
          onClick={handleRefresh}
          disabled={loadingRefresh}
          className="flex items-center gap-2 bg-secondary text-secondary-foreground hover:bg-secondary/80 px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 cursor-pointer"
        >
          {loadingRefresh ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Tarik Semua Data
        </button>
      </div>

      {/* ── Connected Devices Panel ──────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-semibold flex items-center gap-2 text-sm">
            <Smartphone className="w-4 h-4 text-primary" />
            Perangkat Terhubung ke ONT / Modem
            {connectedDevicesCount != null && (
              <span className="ml-1 px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs font-medium">
                {connectedDevicesCount}
              </span>
            )}
          </h3>
          <button
            onClick={handleRefreshConnDevices}
            disabled={loadingConnDevices}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 cursor-pointer"
          >
            {loadingConnDevices ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            Refresh List
          </button>
        </div>

        {localConnDevices.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            <Monitor className="w-6 h-6 mx-auto mb-2 opacity-30" />
            <p>Belum ada data perangkat terhubung.</p>
            <p className="text-xs mt-1">Klik "Refresh List" atau "Tarik Semua Data" untuk memperbarui.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr className="text-muted-foreground uppercase">
                  <th className="px-4 py-2 text-left font-medium">Nama Perangkat (Hostname)</th>
                  <th className="px-4 py-2 text-left font-medium">MAC Address</th>
                  <th className="px-4 py-2 text-left font-medium">IP Address LAN</th>
                  <th className="px-4 py-2 text-left font-medium">Interface / Tipe</th>
                  <th className="px-4 py-2 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {localConnDevices.map((host, i) => (
                  <tr key={i} className="hover:bg-muted/20">
                    <td className="px-4 py-2.5 font-medium flex items-center gap-2">
                      {host.interface?.toLowerCase().includes('wifi') || host.interface?.toLowerCase().includes('wlan') ? (
                        <Smartphone className="w-3.5 h-3.5 text-blue-400" />
                      ) : (
                        <Monitor className="w-3.5 h-3.5 text-gray-400" />
                      )}
                      {host.hostname || <span className="text-muted-foreground italic">Unknown Device</span>}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-muted-foreground">{host.mac || '-'}</td>
                    <td className="px-4 py-2.5 font-mono">{host.ip || '-'}</td>
                    <td className="px-4 py-2.5">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        host.interface?.toLowerCase().includes('wifi') || host.interface?.toLowerCase().includes('wlan')
                          ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                          : 'bg-gray-500/10 text-gray-500 border border-gray-500/20'
                      }`}>
                        {host.interface || 'Ethernet'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        host.active ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                      }`}>
                        {host.active ? 'Aktif' : 'Terdaftar'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── WiFi & PPPoE Settings ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* WiFi 2.4GHz */}
        <div className="bg-card border border-border p-5 rounded-lg space-y-4">
          <h3 className="font-semibold flex items-center justify-between border-b border-border pb-2 text-sm">
            <span className="flex items-center gap-2">
              <Wifi className="w-4 h-4 text-primary" />
              WiFi 2.4GHz
            </span>
            <span className="text-[10px] bg-green-500/10 text-green-500 border border-green-500/20 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-1">
              <CheckCircle2 className="w-2.5 h-2.5" /> Active
            </span>
          </h3>
          <form onSubmit={handleSaveWifi} className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">SSID 2.4GHz</label>
              <input
                type="text"
                value={ssid}
                onChange={(e) => setSsid(e.target.value)}
                placeholder="Nama WiFi 2.4GHz..."
                className="w-full bg-background border border-border rounded p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Password 2.4GHz</label>
              <input
                type="text"
                value={wifiPw}
                onChange={(e) => setWifiPw(e.target.value)}
                placeholder="Password WiFi 2.4GHz..."
                className="w-full bg-background border border-border rounded p-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <button
              type="submit"
              disabled={loadingWifi}
              className="w-full flex justify-center items-center gap-2 bg-primary text-primary-foreground p-2 rounded text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {loadingWifi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Simpan WiFi 2.4GHz
            </button>
          </form>
        </div>

        {/* WiFi 5GHz */}
        <div className="bg-card border border-border p-5 rounded-lg space-y-4">
          <h3 className="font-semibold flex items-center justify-between border-b border-border pb-2 text-sm">
            <span className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-500" />
              WiFi 5GHz
            </span>
            {is5gAvailable ? (
              <span className="text-[10px] bg-blue-500/10 text-blue-500 border border-blue-500/20 px-1.5 py-0.5 rounded-full font-medium">Dual-Band</span>
            ) : (
              <span className="text-[10px] bg-red-500/10 text-red-500 border border-red-500/20 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-1">
                <ShieldAlert className="w-2.5 h-2.5" /> Tidak Tersedia
              </span>
            )}
          </h3>

          {!is5gAvailable ? (
            <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-md text-xs text-red-400 space-y-2">
              <div className="flex items-center gap-1.5 font-semibold text-red-400">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                Wi-Fi 5GHz Tidak Didukung / Nonaktif
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Perangkat ONT ini tidak memiliki modul Wi-Fi 5GHz (Single Band) atau fitur 5GHz saat ini dinonaktifkan di perangkat. Pengaturan password 5GHz tidak dapat diubah.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSaveWifi5g} className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">SSID 5GHz</label>
                <input
                  type="text"
                  value={ssid5g}
                  onChange={(e) => setSsid5g(e.target.value)}
                  placeholder="Nama WiFi 5GHz..."
                  className="w-full bg-background border border-border rounded p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Password 5GHz</label>
                <input
                  type="text"
                  value={wifiPw5g}
                  onChange={(e) => setWifiPw5g(e.target.value)}
                  placeholder="Password WiFi 5GHz..."
                  className="w-full bg-background border border-border rounded p-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <button
                type="submit"
                disabled={loadingWifi5g}
                className="w-full flex justify-center items-center gap-2 bg-blue-600 text-white p-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {loadingWifi5g ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Simpan WiFi 5GHz
              </button>
            </form>
          )}
        </div>

        {/* PPPoE */}
        <div className="bg-card border border-border p-5 rounded-lg space-y-4">
          <h3 className="font-semibold flex items-center gap-2 border-b border-border pb-2 text-sm">
            <Key className="w-4 h-4 text-orange-500" />
            Pengaturan PPPoE
          </h3>
          <form onSubmit={handleSavePppoe} className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Username PPPoE</label>
              <input
                type="text"
                value={pppoeUser}
                onChange={(e) => setPppoeUser(e.target.value)}
                placeholder="username@domain"
                className="w-full bg-background border border-border rounded p-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Password PPPoE</label>
              <input
                type="text"
                value={pppoePass}
                onChange={(e) => setPppoePass(e.target.value)}
                placeholder="Password..."
                className="w-full bg-background border border-border rounded p-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <button
              type="submit"
              disabled={loadingPppoe}
              className="w-full flex justify-center items-center gap-2 bg-orange-600 text-white p-2 rounded text-sm font-medium hover:bg-orange-700 disabled:opacity-50 transition-colors cursor-pointer"
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
