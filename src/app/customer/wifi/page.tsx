'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Wifi, WifiOff, Router, RefreshCw, Pencil, Save, X,
  Eye, EyeOff, Monitor, ServerCrash, Info, Radio, Power
} from 'lucide-react';
import { showConfirm, showSuccess, showError } from '@/lib/sweetalert';

interface WLANConfig {
  index: number;
  ssid: string;
  enabled: boolean;
  channel: string;
  standard: string;
  security: string;
  password: string;
  band: string;
  totalAssociations: number;
  bssid: string;
}

interface ConnectedHost {
  macAddress: string;
  ipAddress: string;
  hostname: string;
  associatedDevice: string;
  active: boolean;
  signalStrength: string;
}

interface DeviceInfo {
  _id: string;
  pppUsername: string;
  serialNumber: string;
  model: string;
  manufacturer: string;
  softwareVersion: string;
  ipAddress: string;
  uptime: string;
  status: string;
  wlanConfigs: WLANConfig[];
  connectedHosts: ConnectedHost[];
  signalStrength: {
    rxPower: string;
    txPower: string;
    temperature: string;
  };
}

interface EditState {
  wlanIndex: number;
  ssid: string;
  password: string;
  showPassword: boolean;
}

export default function CustomerWiFiPage() {
  const router = useRouter();

  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [noGenieACS, setNoGenieACS] = useState(false);
  const [noDevice, setNoDevice] = useState(false);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [rebooting, setRebooting] = useState(false);
  const [loadSpeedtest, setLoadSpeedtest] = useState(false);

  const toast = (type: 'success' | 'error' | 'info', title: string, desc?: string) => {
    if (type === 'error') {
      showError(title, desc);
    } else {
      showSuccess(title, desc);
    }
  };

  const loadDevice = useCallback(async () => {
    const token = localStorage.getItem('customer_token');
    if (!token) {
      router.push('/customer/login');
      return;
    }

    try {
      const res = await fetch('/api/customer/wifi', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setNoDevice(true);
        setDevice(null);
        return;
      }
      const data = await res.json();

      if (!data.success) {
        if (data.reason === 'not_configured') {
          setNoGenieACS(true);
        } else {
          setNoDevice(true);
        }
        setDevice(null);
      } else {
        setDevice(data.device);
        setNoGenieACS(false);
        setNoDevice(false);
      }
    } catch {
      setNoDevice(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    const token = localStorage.getItem('customer_token');
    if (!token) {
      router.push('/customer/login');
      return;
    }
    loadDevice();
  }, [loadDevice, router]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadDevice();
  };

  const handleReboot = async () => {
    const confirmed = await showConfirm(
      'Reboot modem/ONT?',
      'Koneksi internet akan terputus sementara selama proses reboot berlangsung.',
      'Ya, Reboot',
      'Batal'
    );
    if (!confirmed) return;
    setRebooting(true);
    const token = localStorage.getItem('customer_token');
    try {
      const res = await fetch('/api/customer/ont/reboot', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        toast('success', 'Reboot dikirim', data.message || 'Perangkat akan restart dalam beberapa detik.');
      } else {
        toast('error', 'Gagal', data.error || 'Gagal mengirim perintah reboot.');
      }
    } catch {
      toast('error', 'Error', 'Terjadi kesalahan. Silakan coba lagi.');
    } finally {
      setRebooting(false);
    }
  };

  const startEdit = (wlan: WLANConfig) => {
    setEditing({
      wlanIndex: wlan.index,
      ssid: wlan.ssid,
      password: '',
      showPassword: false,
    });
  };

  const cancelEdit = () => setEditing(null);

  const handleSave = async () => {
    if (!editing || !device) return;

    const ssid = editing.ssid.trim();
    const password = editing.password.trim();

    if (!ssid || ssid.length < 1 || ssid.length > 32) {
      toast('error', 'Validasi', 'Nama WiFi (SSID) harus 1–32 karakter.');
      return;
    }
    if (password.length > 0 && (password.length < 8 || password.length > 63)) {
      toast('error', 'Validasi', 'Password WiFi harus 8–63 karakter. Kosongkan jika tidak ingin mengubah.');
      return;
    }

    const confirmed = await showConfirm(
      'Konfirmasi Perubahan WiFi',
      `Nama WiFi (SSID): ${ssid}\nPassword: ${password ? '*'.repeat(password.length) : '(tidak diubah)'}\n\nKonfigurasi baru akan dikirimkan ke modem Anda.`,
      'Ya, Simpan',
      'Batal'
    );
    if (!confirmed) return;

    setSaving(true);
    const token = localStorage.getItem('customer_token');

    try {
      const res = await fetch('/api/customer/wifi', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          deviceId: device._id,
          wlanIndex: editing.wlanIndex,
          ssid,
          password: password || undefined,
        }),
      });

      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();

      if (data.success) {
        toast('success', 'Berhasil', 'Konfigurasi WiFi dikirim ke perangkat. Tunggu 30–60 detik lalu sambungkan ulang.');
        setEditing(null);
        setTimeout(() => loadDevice(), 3000);
      } else {
        toast('error', 'Gagal', data.error || 'Gagal mengubah konfigurasi WiFi.');
      }
    } catch {
      toast('error', 'Error', 'Terjadi kesalahan. Silakan coba lagi.');
    } finally {
      setSaving(false);
    }
  };

  // --- Loading state -----------------------------------------------------------
  if (loading) {
    return (
      <div className="p-4 lg:p-6 flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-2 border-[var(--color-focus)] border-t-transparent rounded-full mx-auto" />
          <p className="mt-3 text-[var(--color-muted)] text-sm font-mono">Memuat info perangkat…</p>
        </div>
      </div>
    );
  }

  // --- GenieACS not configured -------------------------------------------------
  if (noGenieACS) {
    return (
      <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-6 pb-32 md:pb-8 space-y-4">
        <div className="bg-[var(--color-paper)] rounded-[var(--radius-lg)] border border-[var(--color-rule)] shadow-sm p-6 text-center py-12">
          <ServerCrash className="w-16 h-16 mx-auto text-[var(--color-muted)] mb-4" />
          <h3 className="text-lg font-display text-[var(--color-ink)] mb-2">GenieACS belum dikonfigurasi</h3>
          <p className="text-sm text-[var(--color-muted)] font-body max-w-sm mx-auto">
            Fitur pengaturan WiFi memerlukan GenieACS TR-069. Hubungi admin untuk mengaktifkan fitur ini.
          </p>
        </div>
      </div>
    );
  }

  // --- Device not found ---------------------------------------------------------
  if (noDevice || !device) {
    return (
      <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-6 pb-32 md:pb-8 space-y-4">
        <div className="bg-[var(--color-paper)] rounded-[var(--radius-lg)] border border-[var(--color-rule)] shadow-sm p-6 text-center py-12">
          <WifiOff className="w-16 h-16 mx-auto text-[var(--color-muted)] mb-4" />
          <h3 className="text-lg font-display text-[var(--color-ink)] mb-2">Perangkat tidak ditemukan</h3>
          <p className="text-sm font-body text-[var(--color-muted)] max-w-sm mx-auto mb-6">
            Pastikan ONT/router sudah terdaftar dan terhubung ke GenieACS.
          </p>
          <button onClick={handleRefresh} disabled={refreshing} className="bg-[var(--color-paper-2)] text-[var(--color-ink)] border border-[var(--color-rule)] hover:bg-[var(--color-paper-3)] transition-colors py-2 px-4 rounded-[var(--radius-sm)] font-mono text-[10px] uppercase font-bold tracking-wider inline-flex items-center justify-center">
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  // --- Main view ---------------------------------------------------------------
  return (
    <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-6 pb-32 md:pb-8 space-y-4 sm:space-y-5 w-full">
      <button onClick={() => router.push('/customer')} className="flex items-center gap-1.5 text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors font-mono text-[10px] uppercase tracking-wider font-bold mb-6">
        <span className="material-symbols-outlined text-[16px]">arrow_back</span>Kembali
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-display text-[var(--color-ink)] flex items-center gap-2">
            <Wifi className="w-5 h-5 text-[var(--color-focus)]" />
            Pengaturan WiFi
          </h1>
          <p className="text-xs font-body text-[var(--color-muted)] mt-0.5">Kelola SSID dan password WiFi perangkat Anda</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReboot}
            disabled={rebooting}
            title="Reboot Modem/ONT"
            className="p-2 rounded-[var(--radius-sm)] border border-[var(--color-rule)] text-[var(--color-muted)] hover:text-[var(--color-error)] hover:border-[var(--color-error)] transition-colors disabled:opacity-40"
          >
            <Power className={`w-4 h-4 ${rebooting ? 'animate-pulse text-[var(--color-error)]' : ''}`} />
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            title="Perbarui Data"
            className="p-2 rounded-[var(--radius-sm)] border border-[var(--color-rule)] text-[var(--color-muted)] hover:text-[var(--color-focus)] hover:border-[var(--color-focus)] transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Device Info Card */}
      <div className="bg-[var(--color-paper)] rounded-[var(--radius-lg)] border border-[var(--color-rule)] shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-[var(--color-paper-2)] flex items-center justify-center border border-[var(--color-rule)]">
            <Router className="w-5 h-5 text-[var(--color-focus)]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-display font-medium text-[var(--color-ink)] truncate">{device.model || 'Perangkat ONT'}</p>
            <p className="text-xs font-body text-[var(--color-muted)]">{device.manufacturer || 'Router'}</p>
          </div>
          <span className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-1 rounded-[var(--radius-sm)] ${
            device.status?.toLowerCase() === 'online'
              ? 'bg-[var(--color-success)]/10 text-[var(--color-success)] border border-[var(--color-success)]/20'
              : 'bg-[var(--color-error)]/10 text-[var(--color-error)] border border-[var(--color-error)]/20'
          }`}>
            {device.status?.toUpperCase() === 'ONLINE' ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm font-body">
          {device.serialNumber && device.serialNumber !== '-' && (
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--color-muted)]">Serial</span>
              <p className="text-[var(--color-ink)] font-mono truncate">{device.serialNumber}</p>
            </div>
          )}
          {device.softwareVersion && device.softwareVersion !== '-' && (
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--color-muted)]">Firmware</span>
              <p className="text-[var(--color-ink)] truncate">{device.softwareVersion}</p>
            </div>
          )}
          {device.uptime && device.uptime !== '-' && (
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--color-muted)]">Uptime</span>
              <p className="text-[var(--color-ink)]">{device.uptime}</p>
            </div>
          )}
          {device.signalStrength?.rxPower && device.signalStrength.rxPower !== '-' && (
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--color-muted)]">RX Power</span>
              <p className="text-[var(--color-ink)]">{device.signalStrength.rxPower}</p>
            </div>
          )}
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--color-muted)]">Jaringan WiFi</span>
            <p className="text-[var(--color-ink)]">{device.wlanConfigs.length} WLAN</p>
          </div>
          {device.connectedHosts.length > 0 && (
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--color-muted)]">Perangkat terhubung</span>
              <p className="text-[var(--color-ink)]">{device.connectedHosts.length}</p>
            </div>
          )}
        </div>
      </div>

      {/* WLAN Cards */}
      {device.wlanConfigs.map((wlan) => {
        const isEditing = editing?.wlanIndex === wlan.index;
        const bandLabel = wlan.band === '5GHz' ? '5 GHz' : '2.4 GHz';

        return (
          <div key={wlan.index} className="bg-[var(--color-paper)] rounded-[var(--radius-lg)] border border-[var(--color-rule)] shadow-sm p-6">
            {/* WLAN Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-full bg-[var(--color-paper-2)] border border-[var(--color-rule)] flex items-center justify-center">
                <Radio className={`w-5 h-5 ${wlan.enabled ? 'text-[var(--color-success)]' : 'text-[var(--color-muted)]'}`} />
              </div>
              <div className="flex-1">
                <p className="font-display font-medium text-[var(--color-ink)] text-sm">WiFi {bandLabel}</p>
                <p className="text-xs font-body text-[var(--color-muted)] truncate">{wlan.ssid || '(SSID belum dikonfigurasi)'}</p>
              </div>
              <span className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-1 rounded-[var(--radius-sm)] border ${
                wlan.enabled
                  ? 'bg-[var(--color-success)]/10 text-[var(--color-success)] border-[var(--color-success)]/20'
                  : 'bg-[var(--color-error)]/10 text-[var(--color-error)] border-[var(--color-error)]/20'
              }`}>
                {wlan.enabled ? 'Aktif' : 'Mati'}
              </span>
            </div>

            <div className="border-t border-[var(--color-rule)] pt-4">
              {!isEditing ? (
                // -- View mode ---------------------------------------------
                <div className="space-y-3 font-body">
                  <div className="flex items-center gap-2 text-sm">
                    <Wifi className="w-4 h-4 text-[var(--color-muted)] shrink-0" />
                    <span className="text-[var(--color-ink)]">{wlan.ssid || '—'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--color-muted)] w-16">Keamanan</span>
                    <span className="text-[var(--color-ink)] text-xs">{wlan.security !== '-' ? wlan.security : 'WPA2-PSK'}</span>
                  </div>
                  {wlan.totalAssociations > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <Monitor className="w-4 h-4 text-[var(--color-muted)] shrink-0" />
                      <span className="text-[var(--color-muted)] text-xs">{wlan.totalAssociations} perangkat terhubung</span>
                    </div>
                  )}
                  <div className="mt-5 pt-1">
                    <button
                      onClick={() => startEdit(wlan)}
                      disabled={!!editing && !isEditing}
                      className="w-full bg-[var(--color-paper-2)] text-[var(--color-ink)] border border-[var(--color-rule)] hover:bg-[var(--color-paper-3)] transition-colors py-2 px-4 rounded-[var(--radius-sm)] font-mono text-[10px] uppercase font-bold tracking-wider inline-flex justify-center items-center"
                    >
                      <Pencil className="w-4 h-4 mr-2" />
                      Edit WiFi Ini
                    </button>
                  </div>
                  {/* Connected devices for this WLAN */}
                  {(() => {
                    const wlanDevices = device.connectedHosts.filter(h => h.associatedDevice === String(wlan.index));
                    if (wlanDevices.length === 0) return null;
                    return (
                      <div className="mt-4 pt-4 border-t border-[var(--color-rule)]">
                        <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--color-muted)] mb-3">Perangkat terhubung ke SSID ini:</p>
                        <div className="space-y-2">
                          {wlanDevices.map((host, i) => (
                            <div key={i} className="flex items-center gap-3 p-2 rounded-[var(--radius-sm)] bg-[var(--color-paper-2)] border border-[var(--color-rule)]">
                              <div className="w-8 h-8 rounded-full bg-[var(--color-success)]/10 flex items-center justify-center shrink-0 border border-[var(--color-success)]/20">
                                <Monitor className="w-4 h-4 text-[var(--color-success)]" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-[var(--color-ink)] truncate font-display">
                                  {host.hostname && host.hostname !== '-' ? host.hostname : host.macAddress}
                                </p>
                                <p className="text-xs font-mono text-[var(--color-muted)]">
                                  {host.ipAddress !== '-' ? host.ipAddress : host.macAddress}
                                  {host.signalStrength && host.signalStrength !== '-' ? ` · ${host.signalStrength}` : ''}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                // -- Edit mode ---------------------------------------------
                <div className="space-y-4">
                  {/* SSID */}
                  <div>
                    <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--color-muted)] mb-1.5">
                      Nama WiFi (SSID)
                    </label>
                    <input
                      type="text"
                      value={editing.ssid}
                      onChange={(e) => setEditing({ ...editing, ssid: e.target.value })}
                      maxLength={32}
                      autoComplete="off"
                      placeholder="Nama WiFi baru"
                      className="w-full bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-[var(--radius-sm)] px-4 py-2.5 text-sm font-mono text-[var(--color-ink)] outline-none focus:border-[var(--color-focus)] transition-colors"
                    />
                    <p className="text-[10px] font-mono text-[var(--color-muted)] mt-1.5">{editing.ssid.length}/32 karakter</p>
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--color-muted)] mb-1.5">
                      Password WiFi
                    </label>
                    <div className="relative">
                      <input
                        type={editing.showPassword ? 'text' : 'password'}
                        value={editing.password}
                        onChange={(e) => setEditing({ ...editing, password: e.target.value })}
                        maxLength={63}
                        autoComplete="new-password"
                        placeholder="Kosongkan jika tidak ingin mengubah"
                        className="w-full bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-[var(--radius-sm)] px-4 py-2.5 pr-10 text-sm font-mono text-[var(--color-ink)] outline-none focus:border-[var(--color-focus)] transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setEditing({ ...editing, showPassword: !editing.showPassword })}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors"
                      >
                        {editing.showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-[10px] font-mono text-[var(--color-muted)] mt-1.5">8–63 karakter. Kosongkan jika tidak ingin mengubah password.</p>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={cancelEdit}
                      disabled={saving}
                      className="flex-1 bg-[var(--color-paper-2)] text-[var(--color-ink)] border border-[var(--color-rule)] hover:bg-[var(--color-paper-3)] transition-colors py-3 px-4 rounded-[var(--radius-sm)] font-mono text-[10px] uppercase font-bold tracking-wider disabled:opacity-40"
                    >
                      Batal
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex-1 bg-[var(--color-accent)] text-[var(--color-accent-ink)] hover:opacity-90 transition-opacity py-3 px-4 rounded-[var(--radius-sm)] font-mono text-[10px] uppercase font-bold tracking-wider inline-flex items-center justify-center disabled:opacity-40"
                    >
                      {saving ? (
                        <div className="flex items-center gap-2">
                          <div className="animate-spin w-4 h-4 border-2 border-[var(--color-accent-ink)]/30 border-t-[var(--color-accent-ink)] rounded-full" />
                          Menyimpan…
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Save className="w-4 h-4" />
                          Simpan
                        </div>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Info Box */}
      <div className="bg-[var(--color-paper-2)] rounded-[var(--radius-lg)] border border-[var(--color-rule)] shadow-sm p-6">
        <div className="flex items-start gap-3">
          <Info className="w-4 h-4 text-[var(--color-focus)] shrink-0 mt-0.5" />
          <p className="text-xs font-body text-[var(--color-muted)]">
            Perubahan dikirim langsung ke perangkat via TR-069. Setelah disimpan, tunggu <strong className="text-[var(--color-ink)]">30–60 detik</strong> lalu sambungkan kembali ke WiFi dengan nama/password baru.
          </p>
        </div>
      </div>

      {/* nPerf Speedtest Widget */}
      <div className="bg-[var(--color-paper)] rounded-[var(--radius-lg)] border border-[var(--color-rule)] shadow-sm p-6">
        <h2 className="text-[10px] font-mono font-bold text-[var(--color-focus)] uppercase tracking-wider mb-4 flex items-center gap-2">
          <Radio className="w-5 h-5 text-[var(--color-focus)]" />
          Uji Kecepatan Internet (nPerf)
        </h2>
        {!loadSpeedtest ? (
          <div className="flex flex-col items-center justify-center p-8 border border-dashed border-[var(--color-rule)] rounded-[var(--radius-sm)] bg-[var(--color-paper-2)]">
            <Radio className="w-12 h-12 text-[var(--color-muted)] animate-pulse mb-3" />
            <p className="text-sm text-[var(--color-ink)] font-display font-medium mb-2">Uji Kecepatan Koneksi Anda</p>
            <p className="text-xs font-body text-[var(--color-muted)] text-center max-w-sm mb-6">Mulai pengujian kecepatan internet nPerf secara langsung. Ini akan memakan kuota/bandwidth internet Anda selama proses pengetesan.</p>
            <button
              onClick={() => setLoadSpeedtest(true)}
              className="bg-[var(--color-accent)] text-[var(--color-accent-ink)] hover:opacity-90 transition-opacity py-3 px-6 rounded-[var(--radius-sm)] font-mono text-[10px] uppercase font-bold tracking-wider"
            >
              Mulai Tes Kecepatan
            </button>
          </div>
        ) : (
          <div className="w-full overflow-hidden rounded-[var(--radius-sm)] border border-[var(--color-rule)]">
            <iframe
              src="https://speedtest.nperf.com/iframe?lang=id"
              width="100%"
              height="550px"
              frameBorder="0"
              scrolling="no"
              style={{ border: 'none' }}
              allow="geolocation"
              loading="eager"
            />
          </div>
        )}
      </div>

    </div>
  );
}
