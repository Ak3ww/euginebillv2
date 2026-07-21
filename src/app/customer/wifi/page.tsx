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

  return (
    <main className="max-w-[1280px] mx-auto px-4 md:px-8 py-6 pb-32 md:pb-8">
      {/* Back */}
      <button
        onClick={() => router.push('/customer')}
        className="flex items-center gap-1.5 text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors font-mono text-[10px] uppercase tracking-wider font-bold mb-6"
      >
        <span className="material-symbols-outlined text-[16px]">arrow_back</span>
        Kembali
      </button>

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-6">
        <div>
          <h2 className="text-2xl md:text-[32px] font-display font-semibold text-[var(--color-ink)]">Pengaturan Wi-Fi</h2>
          <p className="text-sm font-body text-[var(--color-ink-2)] mt-1">Kelola konfigurasi jaringan dan perangkat yang terhubung.</p>
        </div>
        {/* Router Status */}
        {device && (
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${
            device.status === 'online'
              ? 'bg-[var(--color-success-bg)] text-[var(--color-success)] border-[var(--color-success-border)]'
              : 'bg-[var(--color-error-bg)] text-[var(--color-error)] border-[var(--color-error-border)]'
          }`}>
            <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider">
              {device.status === 'online' ? 'Router Online' : 'Router Offline'}
            </span>
          </div>
        )}
      </div>

      {/* Loading */}
      {loading ? (
        <div className="flex justify-center items-center py-24">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
            <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-muted)]">Memuat data router...</p>
          </div>
        </div>
      ) : noGenieACS ? (
        <div className="bento-card text-center py-16">
          <span className="material-symbols-outlined text-[48px] text-[var(--color-muted)] block mb-3">cloud_off</span>
          <h3 className="font-display text-lg font-semibold text-[var(--color-ink)] mb-2">GenieACS Tidak Tersedia</h3>
          <p className="text-sm font-body text-[var(--color-ink-2)]">Manajemen router tidak tersedia saat ini.</p>
        </div>
      ) : noDevice ? (
        <div className="bento-card text-center py-16">
          <span className="material-symbols-outlined text-[48px] text-[var(--color-muted)] block mb-3">router</span>
          <h3 className="font-display text-lg font-semibold text-[var(--color-ink)] mb-2">Perangkat Tidak Ditemukan</h3>
          <p className="text-sm font-body text-[var(--color-ink-2)]">Tidak ada router yang terhubung ke akun Anda.</p>
        </div>
      ) : device ? (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">

          {/* Network Config — 8 cols */}
          <section className="md:col-span-8 bento-card">
            <div className="flex items-center justify-between border-b border-[var(--color-rule)] pb-4 mb-5">
              <h3 className="text-base font-display font-semibold text-[var(--color-ink)] flex items-center gap-2">
                <Wifi className="w-5 h-5 text-[var(--color-muted)]" />
                Detail Jaringan
              </h3>
              <span className="font-mono text-xs text-[var(--color-muted)]">{device.model}</span>
            </div>

            {/* WLAN bands */}
            {device.wlanConfigs?.map((wlan) => (
              <div key={wlan.index} className="mb-5 last:mb-0">
                <div className="flex items-center justify-between mb-3">
                  <p className="section-header">{wlan.band || (wlan.index === 0 ? '2.4 GHz' : '5 GHz')} — {wlan.ssid}</p>
                  <span className={`badge ${
                    wlan.enabled ? 'badge-active' : 'badge-resolved'
                  }`}>
                    {wlan.enabled ? 'Aktif' : 'Nonaktif'}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* SSID */}
                  <div>
                    <label className="form-label">Nama Jaringan (SSID)</label>
                    {editing?.wlanIndex === wlan.index ? (
                      <input
                        type="text"
                        value={editing.ssid}
                        onChange={e => setEditing({ ...editing, ssid: e.target.value })}
                        className="form-input"
                      />
                    ) : (
                      <div className="px-4 py-3 border border-[var(--color-rule)] rounded-[var(--radius-sm)] bg-[var(--color-paper-3)] font-body text-sm text-[var(--color-ink)] flex items-center justify-between">
                        <span>{wlan.ssid}</span>
                        <span className="material-symbols-outlined text-[16px] text-[var(--color-success)]">verified</span>
                      </div>
                    )}
                  </div>
                  {/* Password */}
                  <div>
                    <label className="form-label">Password Wi-Fi</label>
                    {editing?.wlanIndex === wlan.index ? (
                      <div className="relative">
                        <input
                          type={editing.showPassword ? 'text' : 'password'}
                          value={editing.password}
                          onChange={e => setEditing({ ...editing, password: e.target.value })}
                          className="form-input pr-12"
                        />
                        <button
                          type="button"
                          onClick={() => setEditing({ ...editing, showPassword: !editing.showPassword })}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors"
                        >
                          <span className="material-symbols-outlined text-[20px]">{editing.showPassword ? 'visibility_off' : 'visibility'}</span>
                        </button>
                      </div>
                    ) : (
                      <div className="px-4 py-3 border border-[var(--color-rule)] rounded-[var(--radius-sm)] bg-[var(--color-paper-3)] font-mono text-sm text-[var(--color-ink-2)]">••••••••••</div>
                    )}
                  </div>
                </div>
                {/* Actions */}
                <div className="flex gap-2 mt-4">
                  {editing?.wlanIndex === wlan.index ? (
                    <>
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="btn-primary"
                      >
                        {saving
                          ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Menyimpan...</>
                          : <><Save className="w-4 h-4" /> Simpan</>}
                      </button>
                      <button onClick={cancelEdit} className="btn-secondary">
                        <X className="w-4 h-4" /> Batal
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => startEdit(wlan)}
                      className="btn-secondary"
                    >
                      <Pencil className="w-4 h-4" /> Ubah Nama/Password
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* Reboot */}
            <div className="border-t border-[var(--color-rule)] pt-4 mt-5">
              <button
                onClick={handleReboot}
                disabled={rebooting}
                className="btn-secondary w-full sm:w-auto text-[var(--color-error)] border-[var(--color-error-border)] hover:bg-[var(--color-error-bg)]"
              >
                {rebooting
                  ? <><div className="w-4 h-4 border-2 border-[var(--color-error)] border-t-transparent rounded-full animate-spin" /> Melakukan Reboot...</>
                  : <><RefreshCw className="w-4 h-4" /> Reboot Router</>}
              </button>
            </div>
          </section>

          {/* Right column — stats */}
          <section className="md:col-span-4 flex flex-col gap-5">
            {/* Signal */}
            <div className="bento-card">
              <p className="section-header">Sinyal Optik</p>
              <div className="flex flex-col gap-3 mt-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-body text-[var(--color-ink-2)]">RX Power</span>
                  <span className="font-mono text-sm font-medium text-[var(--color-ink)]">{device.signalStrength?.rxPower || '-'} dBm</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-body text-[var(--color-ink-2)]">TX Power</span>
                  <span className="font-mono text-sm font-medium text-[var(--color-ink)]">{device.signalStrength?.txPower || '-'} dBm</span>
                </div>
                {device.signalStrength?.temperature && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-body text-[var(--color-ink-2)]">Suhu</span>
                    <span className="font-mono text-sm font-medium text-[var(--color-ink)]">{device.signalStrength.temperature}°C</span>
                  </div>
                )}
              </div>
            </div>

            {/* Device count */}
            <div className="bento-card">
              <p className="section-header">Perangkat Terhubung</p>
              <div className="text-4xl font-display font-bold text-[var(--color-focus)] mt-1">
                {device.connectedHosts?.filter(h => h.active).length || 0}
              </div>
              <p className="text-sm font-body text-[var(--color-ink-2)] mt-1">perangkat aktif</p>
            </div>

            {/* Device info */}
            <div className="bento-card">
              <p className="section-header">Info Perangkat</p>
              <div className="flex flex-col gap-2 mt-2">
                <div className="flex justify-between">
                  <span className="text-sm text-[var(--color-muted)]">Model</span>
                  <span className="font-mono text-xs text-[var(--color-ink)]">{device.model}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-[var(--color-muted)]">Uptime</span>
                  <span className="font-mono text-xs text-[var(--color-ink)]">{device.uptime || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-[var(--color-muted)]">Versi FW</span>
                  <span className="font-mono text-xs text-[var(--color-ink)] truncate max-w-[120px]">{device.softwareVersion || '-'}</span>
                </div>
              </div>
            </div>

            {/* Refresh */}
            <button
              onClick={loadDevice}
              disabled={refreshing}
              className="btn-secondary w-full"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Memperbarui...' : 'Perbarui Data'}
            </button>
          </section>

          {/* Connected devices table */}
          {device.connectedHosts?.length > 0 && (
            <section className="md:col-span-12 bento-card p-0 overflow-hidden">
              <div className="px-6 py-4 border-b border-[var(--color-rule)] bg-[var(--color-paper-2)] flex items-center justify-between">
                <h3 className="text-sm font-display font-semibold text-[var(--color-ink)]">Perangkat Aktif</h3>
                <span className="font-mono text-[10px] text-[var(--color-muted)] uppercase tracking-wider">{device.connectedHosts.filter(h => h.active).length} online</span>
              </div>
              <div className="overflow-x-auto">
                <table className="hairline-table">
                  <thead>
                    <tr>
                      <th>Nama Perangkat</th>
                      <th>IP Address</th>
                      <th>MAC Address</th>
                      <th>Band</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {device.connectedHosts.map((host, i) => (
                      <tr key={i}>
                        <td>
                          <div className="font-body text-sm text-[var(--color-ink)] flex items-center gap-2">
                            <Monitor className="w-4 h-4 text-[var(--color-muted)] shrink-0" />
                            {host.hostname || 'Perangkat Tidak Dikenal'}
                          </div>
                        </td>
                        <td className="font-mono text-xs text-[var(--color-ink-2)]">{host.ipAddress || '-'}</td>
                        <td className="font-mono text-xs text-[var(--color-ink-2)]">{host.macAddress}</td>
                        <td>
                          <span className="badge badge-open">{host.associatedDevice?.includes('5') ? '5GHz' : '2.4GHz'}</span>
                        </td>
                        <td>
                          <span className={`badge ${host.active ? 'badge-active' : 'badge-resolved'}`}>
                            {host.active ? 'Aktif' : 'Tidak Aktif'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      ) : null}
    </main>
  );
}
