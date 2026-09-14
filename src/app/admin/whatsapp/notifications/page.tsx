'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { showSuccess, showError } from '@/lib/sweetalert';
import { Switch } from '@/components/ui/switch';
import {
  Bell,
  Clock,
  Sliders,
  Shuffle,
  Info,
  Plus,
  X,
  Save,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  KeyRound,
  Loader2,
} from 'lucide-react';

interface ReminderSettings {
  id: string;
  enabled: boolean;
  reminderDays: number[];
  reminderTime: string;
  otpEnabled: boolean;
  otpExpiry: number;
  batchSize: number;
  batchDelay: number;
  randomize: boolean;
  isolationDelayDays?: number;
  maxInvoiceReminders?: number;
  maxTotalMessagesPerCycle?: number;
  strictQuotaEnabled?: boolean;
  updatedAt: string;
}

export default function NotificationSettingsPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<ReminderSettings | null>(null);

  const [enabled, setEnabled] = useState(true);
  const [strictQuotaEnabled, setStrictQuotaEnabled] = useState(true);
  const [reminderDays, setReminderDays] = useState<number[]>([-6, -1]);
  const [reminderTime, setReminderTime] = useState('09:00');
  const [otpEnabled, setOtpEnabled] = useState(true);
  const [otpExpiry, setOtpExpiry] = useState(5);
  const [batchSize, setBatchSize] = useState(10);
  const [batchDelay, setBatchDelay] = useState(120);
  const [randomize, setRandomize] = useState(true);
  const [isolationDelayDays, setIsolationDelayDays] = useState(7);
  const [maxInvoiceReminders, setMaxInvoiceReminders] = useState(2);
  const [maxTotalMessages, setMaxTotalMessages] = useState(3);
  const [newDay, setNewDay] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const res = await fetch('/api/whatsapp/reminder-settings');
      const data = await res.json();

      if (data.success && data.settings) {
        setSettings(data.settings);
        setEnabled(data.settings.enabled);
        setReminderDays(data.settings.reminderDays ?? [-6, -1]);
        setReminderTime(data.settings.reminderTime || '09:00');
        setOtpEnabled(data.settings.otpEnabled ?? true);
        setOtpExpiry(data.settings.otpExpiry ?? 5);
        setBatchSize(data.settings.batchSize ?? 10);
        setBatchDelay(data.settings.batchDelay ?? 120);
        setRandomize(data.settings.randomize ?? true);
        setIsolationDelayDays(data.settings.isolationDelayDays ?? 7);

        const isStrict = typeof data.settings.strictQuotaEnabled === 'boolean'
          ? data.settings.strictQuotaEnabled
          : !(
              (data.settings.maxTotalMessagesPerCycle ?? 3) >= 99 ||
              (data.settings.maxInvoiceReminders ?? 2) >= 99
            );

        setStrictQuotaEnabled(isStrict);
        setMaxInvoiceReminders(isStrict ? 2 : (data.settings.maxInvoiceReminders ?? 99));
        setMaxTotalMessages(isStrict ? 3 : (data.settings.maxTotalMessagesPerCycle ?? 99));
      }
    } catch (error) {
      console.error('Load settings error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStrictQuota = (checked: boolean) => {
    setStrictQuotaEnabled(checked);
    if (checked) {
      setMaxInvoiceReminders(2);
      setMaxTotalMessages(3);
      // Clean up reminderDays for strict mode: only <= 0 and max 2 entries
      setReminderDays((prev) => {
        const sanitized = prev.filter((d) => d <= 0).slice(0, 2);
        return sanitized.length > 0 ? sanitized : [-6, -1];
      });
    } else {
      setMaxInvoiceReminders(99);
      setMaxTotalMessages(99);
    }
  };

  const addReminderDay = () => {
    const day = parseInt(newDay, 10);
    if (isNaN(day)) {
      showError(t('whatsapp.enterValidNumber') || 'Masukkan angka yang valid');
      return;
    }
    if (strictQuotaEnabled && day > 0) {
      showError('Dalam mode aturan ketat, jadwal pengingat hanya boleh sebelum jatuh tempo (angka <= 0, cth: -6, -1).');
      return;
    }
    if (reminderDays.includes(day)) {
      showError(t('whatsapp.dayAlreadyInList') || 'Jadwal hari sudah ada di daftar');
      return;
    }

    const maxAllowed = strictQuotaEnabled ? 2 : 99;
    if (reminderDays.length >= maxAllowed) {
      showError(`Maksimal ${maxAllowed} jadwal pengingat invoice.`);
      return;
    }

    const newDays = [...reminderDays, day].sort((a, b) => a - b);
    setReminderDays(newDays);
    setNewDay('');
  };

  const removeReminderDay = (day: number) => {
    setReminderDays(reminderDays.filter((d) => d !== day));
  };

  const handleSave = async () => {
    if (reminderDays.length === 0) {
      await showError(t('whatsapp.minOneReminderDay') || 'Minimal satu jadwal pengingat');
      return;
    }

    const maxAllowed = strictQuotaEnabled ? 2 : 99;
    if (reminderDays.length > maxAllowed) {
      await showError(`Maksimal ${maxAllowed} jadwal pengingat invoice.`);
      return;
    }

    if (strictQuotaEnabled && reminderDays.some((d) => d > 0)) {
      await showError('Mode aturan ketat hanya memperbolehkan pengingat sebelum jatuh tempo (<= 0).');
      return;
    }

    if (otpExpiry < 1 || otpExpiry > 60) {
      await showError(t('whatsapp.otpExpiryRange') || 'Masa berlaku OTP harus antara 1-60 menit');
      return;
    }

    if (isolationDelayDays < 0) {
      await showError('Jeda hari isolir tidak boleh negatif.');
      return;
    }

    if (batchSize < 1 || batchSize > 100) {
      await showError('Ukuran batch harus antara 1-100 pesan.');
      return;
    }

    if (batchDelay < 5 || batchDelay > 600) {
      await showError('Jeda antar batch harus antara 5-600 detik.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/whatsapp/reminder-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled,
          reminderDays,
          reminderTime,
          otpEnabled,
          otpExpiry,
          batchSize,
          batchDelay,
          randomize,
          isolationDelayDays,
          maxInvoiceReminders: strictQuotaEnabled ? 2 : 99,
          maxTotalMessagesPerCycle: strictQuotaEnabled ? 3 : 99,
          strictQuotaEnabled,
        }),
      });

      const data = await res.json();

      if (data.success) {
        await showSuccess(t('whatsapp.settingsSavedSuccess') || 'Pengaturan berhasil disimpan');
        loadSettings();
      } else {
        await showError((t('whatsapp.failedSaveSettings') || 'Gagal menyimpan pengaturan') + ': ' + data.error);
      }
    } catch (error) {
      console.error('Save error:', error);
      await showError(t('whatsapp.failedSaveSettings') || 'Gagal menyimpan pengaturan');
    } finally {
      setSaving(false);
    }
  };

  const formatDayLabel = (day: number) => {
    if (day === 0) return 'H0 (Hari Jatuh Tempo)';
    if (day < 0) return `H${day} (${Math.abs(day)} hari sebelum)`;
    return `H+${day} (${day} hari sesudah)`;
  };

  // Estimated batch sending calculation
  const sampleMessages = 100;
  const currentBatchSize = Math.max(1, batchSize || 10);
  const currentBatchDelay = Math.max(0, batchDelay || 120);
  const totalBatches = Math.ceil(sampleMessages / currentBatchSize);
  const totalSeconds = ((totalBatches - 1) * currentBatchDelay) + Math.ceil(sampleMessages * 0.5);
  const estMinutes = Math.floor(totalSeconds / 60);
  const estSecs = totalSeconds % 60;
  const estTimeStr = estMinutes > 0
    ? `${estMinutes} menit${estSecs > 0 ? ` ${estSecs} detik` : ''}`
    : `${estSecs} detik`;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="max-w-3xl mx-auto space-y-4">
        {/* Page Header */}
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            {t('whatsapp.notificationsTitle')}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            {t('whatsapp.notificationsSubtitle')}
          </p>
        </div>

        {/* Strict Quota Switch & Anti-Spam Explanation Card */}
        <div className="bg-card rounded-lg border border-border p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
            <div className="flex items-center gap-2.5">
              {strictQuotaEnabled ? (
                <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
              )}
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Aturan Ketat Pengiriman (Maksimal 3 Pesan / Siklus)
                </h3>
                <p className="text-xs text-muted-foreground">
                  {strictQuotaEnabled ? 'Mode Aman (Anti-Spam) Aktif' : 'Mode Fleksibel / Bebas Kuota Aktif'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <span className="text-xs font-medium text-muted-foreground">
                {strictQuotaEnabled ? 'Aktif' : 'Nonaktif'}
              </span>
              <Switch
                checked={strictQuotaEnabled}
                onCheckedChange={handleToggleStrictQuota}
              />
            </div>
          </div>

          {/* Friendly Description Based on Toggle */}
          {strictQuotaEnabled ? (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-md space-y-2">
              <div className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs text-emerald-900 dark:text-emerald-200 leading-relaxed space-y-1.5">
                  <p className="font-medium">
                    Mode Aman (Anti-Spam). Pesan dibatasi maksimal 2x pengingat sebelum jatuh tempo (H-6 dan H-1) + 1x notifikasi isolasi (H+{isolationDelayDays}) untuk menjaga skor reputasi nomor WhatsApp Anda.
                  </p>
                  <ul className="list-disc list-inside text-[11px] text-emerald-800 dark:text-emerald-300 space-y-0.5">
                    <li>
                      <strong>Pesan 1 & 2:</strong> Pengingat tagihan invoice sebelum jatuh tempo (default: H-6 dan H-1).
                    </li>
                    <li>
                      <strong>Pesan 3:</strong> Notifikasi isolasi dikirim tepat pada <strong>H+{isolationDelayDays} setelah isolasi</strong>.
                    </li>
                    <li>
                      <strong>Proteksi:</strong> Pesan gagal tidak memotong kuota dan otomatis dicoba ulang oleh cron hingga berhasil.
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-md space-y-2">
              <div className="flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed space-y-1">
                  <p className="font-medium">
                    Mode Fleksibel / Bebas Kuota. Anda dapat mengatur jadwal pengingat tanpa batasan 3 pesan, termasuk pengingat sebelum dan sesudah jatuh tempo.
                  </p>
                  <p className="text-[11px] text-amber-800 dark:text-amber-300">
                    Perhatian: Pengiriman pesan berulang tanpa batasan berpotensi meningkatkan risiko nomor WhatsApp dilaporkan sebagai spam oleh penerima.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Invoice Reminder Card */}
        <div className="bg-card rounded-lg border border-border">
          <div className="px-4 py-3 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-primary" />
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {t('whatsapp.invoiceReminder')} {strictQuotaEnabled ? '(Pesan 1 & 2)' : '(Mode Fleksibel)'}
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    {strictQuotaEnabled
                      ? 'Maksimal 2 pengingat sebelum jatuh tempo (cth: H-6 dan H-1)'
                      : 'Bebas mengatur jadwal pengingat sebelum dan sesudah jatuh tempo'}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="p-4 space-y-4">
            {/* Enable Toggle */}
            <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg">
              <div>
                <p className="text-xs font-medium text-foreground">{t('whatsapp.enableAutoReminder')}</p>
                <p className="text-[11px] text-muted-foreground">{t('whatsapp.enableAutoReminderDesc')}</p>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>

            {/* Reminder Time */}
            <div>
              <label className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                {t('whatsapp.sendTime')} (WIB)
              </label>
              <input
                type="time"
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value)}
                className="w-40 h-8 px-2.5 text-xs bg-card border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
              />
              <p className="text-[10px] text-muted-foreground mt-1">{t('whatsapp.sendTimeNote')}</p>
            </div>

            {/* Reminder Days */}
            <div>
              <label className="block text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                {t('whatsapp.reminderSchedule')} {strictQuotaEnabled ? `(Maksimal ${maxInvoiceReminders} Jadwal)` : '(Bebas Kuota)'}
              </label>
              <p className="text-[11px] text-muted-foreground mb-2.5">
                {strictQuotaEnabled
                  ? `Pilih maksimal 2 jadwal pengingat sebelum jatuh tempo (angka negatif). Sistem tidak mengirim pengingat spam setelah jatuh tempo.`
                  : `Tentukan jadwal pengingat invoice. Angka negatif (misal: -6) untuk sebelum jatuh tempo, dan angka positif (misal: 1) untuk sesudah jatuh tempo.`}
              </p>

              <div className="flex flex-wrap gap-1.5 mb-2.5">
                {reminderDays.length === 0 ? (
                  <span className="text-[11px] text-muted-foreground italic">{t('whatsapp.noSchedule')}</span>
                ) : (
                  reminderDays.map((day) => (
                    <span
                      key={day}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-muted text-foreground border border-border rounded-md"
                    >
                      {formatDayLabel(day)}
                      <button
                        type="button"
                        onClick={() => removeReminderDay(day)}
                        className="text-muted-foreground hover:text-destructive transition-colors ml-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))
                )}
              </div>

              {reminderDays.length < (strictQuotaEnabled ? 2 : 99) ? (
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    placeholder={strictQuotaEnabled ? '-6' : '-1 atau 2'}
                    value={newDay}
                    onChange={(e) => setNewDay(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addReminderDay()}
                    className="w-28 h-8 px-2.5 text-xs bg-card border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                  />
                  <button
                    type="button"
                    onClick={addReminderDay}
                    className="h-8 px-3 text-xs font-medium text-foreground bg-muted hover:bg-muted/80 border border-border rounded-md transition-colors flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {t('whatsapp.addSchedule')}
                  </button>
                </div>
              ) : (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Sudah mencapai batas maksimal {maxInvoiceReminders} jadwal pengingat invoice. Hapus salah satu jadwal jika ingin mengganti.
                </p>
              )}
              <p className="text-[10px] text-muted-foreground mt-1.5">
                Contoh: <strong>-6</strong> (H-6 sebelum tempo) dan <strong>-1</strong> (H-1 sehari sebelum tempo).
              </p>
            </div>
          </div>
        </div>

        {/* Isolation Notification Card */}
        <div className="bg-card rounded-lg border border-border">
          <div className="px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Pemberitahuan Isolir WhatsApp {strictQuotaEnabled ? '(Pesan Ke-3)' : ''}
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Pengaturan jadwal pengiriman pesan isolasi ke pelanggan
                </p>
              </div>
            </div>
          </div>
          <div className="p-4 space-y-3">
            <div>
              <label className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                Jeda Hari Kirim Notifikasi Isolir (H+X Setelah Isolasi)
              </label>
              <div className="flex items-center gap-2.5">
                <input
                  type="number"
                  min="0"
                  max="30"
                  value={isolationDelayDays}
                  onChange={(e) => setIsolationDelayDays(parseInt(e.target.value, 10) || 0)}
                  className="w-24 h-8 px-2.5 text-xs bg-card border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                />
                <span className="text-xs text-muted-foreground">
                  Hari setelah pelanggan diisolir (Default: 7 = H+7)
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5">
                Pelanggan diisolir teknis otomatis pada hari jatuh tempo, namun notifikasi WhatsApp isolir akan dikirimkan tepat pada <strong>H+{isolationDelayDays}</strong> (1x saja).
              </p>
            </div>
          </div>
        </div>

        {/* OTP Settings Card */}
        <div className="bg-card rounded-lg border border-border">
          <div className="px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-primary" />
              <div>
                <h3 className="text-sm font-semibold text-foreground">{t('whatsapp.otpLogin')}</h3>
                <p className="text-[11px] text-muted-foreground">{t('whatsapp.otpLoginDesc')}</p>
              </div>
            </div>
          </div>
          <div className="p-4 space-y-4">
            {/* OTP Enable Toggle */}
            <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg">
              <div>
                <p className="text-xs font-medium text-foreground">{t('whatsapp.enableOtp')}</p>
                <p className="text-[11px] text-muted-foreground">{t('whatsapp.enableOtpDesc')}</p>
              </div>
              <Switch checked={otpEnabled} onCheckedChange={setOtpEnabled} />
            </div>

            {/* OTP Expiry */}
            <div>
              <label className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                {t('whatsapp.otpExpiry')}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={otpExpiry}
                  onChange={(e) => setOtpExpiry(parseInt(e.target.value, 10) || 5)}
                  className="w-24 h-8 px-2.5 text-xs bg-card border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                />
                <span className="text-xs text-muted-foreground">{t('whatsapp.minutes')}</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                {t('whatsapp.otpExpiryNote')} {otpExpiry} {t('whatsapp.minutes')}
              </p>
            </div>

            {/* OTP Warning */}
            {!otpEnabled && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-md">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-amber-800 dark:text-amber-200 mb-0.5">
                      OTP Login Dinonaktifkan
                    </p>
                    <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed">
                      Customer dapat login langsung tanpa verifikasi kode OTP. Fitur ini berguna saat gateway WhatsApp mengalami kendala sementara.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Batch Anti-Banned Settings Card */}
        <div className="bg-card rounded-lg border border-border">
          <div className="px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-primary" />
              <div>
                <h3 className="text-sm font-semibold text-foreground">Pengaturan Pengiriman Batch Anti-Banned</h3>
                <p className="text-[11px] text-muted-foreground">
                  Konfigurasi ukuran kelompok pesan dan jeda antar batch agar aman dari deteksi pemblokiran WhatsApp
                </p>
              </div>
            </div>
          </div>
          <div className="p-4 space-y-4">
            {/* Batch Size */}
            <div>
              <label className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                <Sliders className="w-3.5 h-3.5 text-muted-foreground" />
                Ukuran Batch (Jumlah Pesan)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={batchSize}
                  onChange={(e) => setBatchSize(parseInt(e.target.value, 10) || 10)}
                  className="w-24 h-8 px-2.5 text-xs bg-card border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                />
                <span className="text-xs text-muted-foreground">pesan per batch (Default: 10)</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                Kirim {batchSize} pesan sekaligus, lalu tunggu jeda sebelum memproses batch selanjutnya.
              </p>
            </div>

            {/* Batch Delay */}
            <div>
              <label className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                Jeda Antar Batch (Detik)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="5"
                  max="600"
                  value={batchDelay}
                  onChange={(e) => setBatchDelay(parseInt(e.target.value, 10) || 120)}
                  className="w-24 h-8 px-2.5 text-xs bg-card border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                />
                <span className="text-xs text-muted-foreground">detik jeda istirahat (Default: 120)</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                Waktu jeda selama {batchDelay} detik setelah setiap batch terkirim.
              </p>
            </div>

            {/* Randomize Toggle */}
            <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg">
              <div>
                <p className="text-xs font-medium text-foreground">{t('whatsapp.randomOrder')}</p>
                <p className="text-[11px] text-muted-foreground">{t('whatsapp.randomOrderDesc')}</p>
              </div>
              <Switch checked={randomize} onCheckedChange={setRandomize} />
            </div>

            {/* Tips Anti-Banned */}
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-md flex items-start gap-2.5">
              <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-900 dark:text-blue-200 leading-relaxed">
                <strong>Tips Anti-Banned:</strong> Untuk menghindari pemblokiran nomor oleh WhatsApp, gunakan ukuran batch 10-20 pesan dengan jeda 60-120 detik. Aktifkan pengacakan urutan untuk memecah pola pengiriman otomatis.
              </p>
            </div>

            {/* Automatic Estimated Calculation */}
            {batchSize > 0 && batchDelay > 0 && (
              <div className="p-3 bg-muted/40 border border-border rounded-md flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <p className="text-xs text-foreground leading-relaxed">
                  <strong>Estimasi Pengiriman:</strong> Untuk 100 reminder, antrean akan dibagi ke dalam {totalBatches} batch dengan perkiraan durasi selesai ~{estTimeStr}.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="h-9 px-4 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium rounded-md transition-colors flex items-center gap-2 disabled:opacity-50 shadow-sm"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{t('whatsapp.saving')}</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>{t('whatsapp.saveSettings')}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
