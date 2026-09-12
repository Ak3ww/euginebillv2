'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Globe,
  ExternalLink,
  Copy,
  Check,
  X,
  RotateCw,
  Zap,
  Shield,
  Clock,
  PlusCircle,
  XCircle,
  Server,
  Terminal,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'
import { showSuccess, showError } from '@/lib/sweetalert'

interface OntRemoteModalProps {
  isOpen: boolean
  onClose: () => void
  customerName?: string
  username?: string
  targetIp?: string
  routerName?: string
  onSuccess?: () => void
}

interface ReadinessState {
  ready: boolean
  apiConnected: boolean
  apiError?: string | null
  ontIp?: string | null
  username?: string
  customerName?: string
  routerName?: string
  routerVpnIp?: string | null
  vpsStatus?: string
  winboxScript?: string
}

export default function OntRemoteModal({
  isOpen,
  onClose,
  customerName = 'Pelanggan',
  username = '',
  targetIp = '',
  routerName = 'Router',
  onSuccess,
}: OntRemoteModalProps) {
  const [targetPort, setTargetPort] = useState<'80' | '443' | 'custom'>('80')
  const [customPort, setCustomPort] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [extending, setExtending] = useState(false)
  const [closing, setClosing] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [proxyUrl, setProxyUrl] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<Date | null>(null)
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0)
  const [copied, setCopied] = useState(false)

  // Readiness detection state
  const [probing, setProbing] = useState(false)
  const [readiness, setReadiness] = useState<ReadinessState | null>(null)
  const [showScriptGuide, setShowScriptGuide] = useState(false)
  const [scriptCopied, setScriptCopied] = useState(false)

  const checkReadiness = useCallback(async () => {
    setProbing(true)
    try {
      const q = new URLSearchParams({
        action: 'check-readiness',
        ...(username ? { username } : {}),
        ...(targetIp ? { targetIp } : {}),
      })
      const res = await fetch(`/api/network/ont-remote?${q.toString()}`)
      const data = await res.json()
      if (res.ok && data.success) {
        setReadiness(data)
        if (!data.ready || !data.apiConnected) {
          setShowScriptGuide(true)
        }
      }
    } catch {
      // ignore
    } finally {
      setProbing(false)
    }
  }, [username, targetIp])

  // Reset modal state & trigger auto-detection when opened
  useEffect(() => {
    if (isOpen) {
      setProxyUrl(null)
      setSessionId(null)
      setExpiresAt(null)
      setRemainingSeconds(0)
      setTargetPort('80')
      setCustomPort('')
      setShowScriptGuide(false)
      setReadiness(null)
      checkReadiness()
    }
  }, [isOpen, checkReadiness])

  // Countdown timer ticker
  useEffect(() => {
    if (!expiresAt) return
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000))
      setRemainingSeconds(remaining)
      if (remaining <= 0) {
        setProxyUrl(null)
        setSessionId(null)
        setExpiresAt(null)
        if (onSuccess) onSuccess()
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [expiresAt, onSuccess])

  if (!isOpen) return null

  const getEffectivePort = (): number => {
    const p = parseInt(customPort)
    return p > 0 && p <= 65535 ? p : 80
  }

  const handleLaunch = async () => {
    setLoading(true)
    try {
      const port = getEffectivePort()
      const res = await fetch('/api/network/ont-remote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username || undefined,
          targetIp: targetIp || undefined,
          targetPort: port,
          customerName,
          routerName,
        }),
      })

      const data = await res.json()
      if (res.ok && data.success && data.session?.proxyUrl) {
        setProxyUrl(data.session.proxyUrl)
        setSessionId(data.session.id)
        const exp = new Date(data.session.expiresAt)
        setExpiresAt(exp)
        setRemainingSeconds(Math.max(0, Math.floor((exp.getTime() - Date.now()) / 1000)))
        showSuccess('Akses Remote Web ONT Berhasil Dibuat!')
        if (onSuccess) onSuccess()
      } else {
        showError(data.error || 'Gagal menyiapkan remote ONT')
      }
    } catch (err: any) {
      showError(err.message || 'Terjadi kesalahan sistem')
    } finally {
      setLoading(false)
    }
  }

  const handleExtend = async () => {
    if (!sessionId) return
    setExtending(true)
    try {
      const res = await fetch('/api/network/ont-remote', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, extendMinutes: 15 }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        const exp = new Date(data.session.expiresAt)
        setExpiresAt(exp)
        setRemainingSeconds(Math.max(0, Math.floor((exp.getTime() - Date.now()) / 1000)))
        showSuccess('Sesi berhasil diperpanjang 15 menit!')
        if (onSuccess) onSuccess()
      } else {
        showError(data.error || 'Gagal memperpanjang sesi')
      }
    } catch (err: any) {
      showError(err.message || 'Terjadi kesalahan sistem')
    } finally {
      setExtending(false)
    }
  }

  const handleCloseSession = async () => {
    if (!sessionId) {
      onClose()
      return
    }
    setClosing(true)
    try {
      await fetch(`/api/network/ont-remote?id=${sessionId}`, { method: 'DELETE' })
      setProxyUrl(null)
      setSessionId(null)
      setExpiresAt(null)
      setRemainingSeconds(0)
      showSuccess('Sesi remote ONT telah ditutup')
      if (onSuccess) onSuccess()
      onClose()
    } catch (err: any) {
      onClose()
    } finally {
      setClosing(false)
    }
  }

  const handleCopy = () => {
    if (!proxyUrl) return
    const fullUrl = proxyUrl.startsWith('/') ? `${window.location.origin}${proxyUrl}` : proxyUrl
    navigator.clipboard.writeText(fullUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    showSuccess('Link URL berhasil disalin!')
  }

  const handleCopyScript = () => {
    const script =
      readiness?.winboxScript ||
      `/ip service set api disabled=no port=8728\r\n/ip firewall filter add chain=input action=accept protocol=tcp dst-port=8728 comment="ALLOW-EUGINEBILL-API" place-before=0\r\n/ip firewall filter add chain=input action=accept protocol=tcp dst-port=24000-24999 comment="ALLOW-EUGINEBILL-ONT-PROXY" place-before=0\r\n/ip firewall filter add chain=forward action=accept protocol=tcp dst-port=80,443,8080 comment="ALLOW-ONT-WEB-MANAGEMENT" place-before=0`
    navigator.clipboard.writeText(script)
    setScriptCopied(true)
    setTimeout(() => setScriptCopied(false), 2000)
    showSuccess('Script Winbox berhasil disalin!')
  }

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const defaultScript =
    readiness?.winboxScript ||
    `/ip service set api disabled=no port=8728\r\n/ip firewall filter add chain=input action=accept protocol=tcp dst-port=8728 comment="ALLOW-EUGINEBILL-API" place-before=0\r\n/ip firewall filter add chain=input action=accept protocol=tcp dst-port=24000-24999 comment="ALLOW-EUGINEBILL-ONT-PROXY" place-before=0\r\n/ip firewall filter add chain=forward action=accept protocol=tcp dst-port=80,443,8080 comment="ALLOW-ONT-WEB-MANAGEMENT" place-before=0`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden space-y-0 text-card-foreground">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl text-primary">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">
                Remote Web GUI ONT
              </h3>
              <p className="text-xs text-muted-foreground">
                {customerName} ({username || targetIp || routerName})
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-4 max-h-[85vh] overflow-y-auto">
          {!proxyUrl ? (
            <div className="space-y-4">
              {/* 1. Status Deteksi Otomatis MikroTik & VPS */}
              {probing ? (
                <div className="p-3 bg-muted/40 border border-border rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <RotateCw className="w-3.5 h-3.5 animate-spin text-primary" />
                    <span>Mengecek kesiapan MikroTik & VPS proxy...</span>
                  </div>
                </div>
              ) : readiness?.ready ? (
                <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>MikroTik & VPS Siap Terhubung</span>
                    </div>
                    <span className="text-[10.5px] font-mono text-emerald-700 dark:text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded-md">
                      API Aktif
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground text-[11px] pt-0.5 border-t border-emerald-500/15">
                    <span>
                      IP ONT Terdeteksi:{' '}
                      <strong className="font-mono text-foreground font-semibold">
                        {readiness.ontIp || targetIp || 'Sesi Aktif'}
                      </strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowScriptGuide(!showScriptGuide)}
                      className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                    >
                      <Terminal className="w-3 h-3" />
                      <span>{showScriptGuide ? 'Tutup Script' : 'Lihat Script Winbox'}</span>
                    </button>
                  </div>
                </div>
              ) : readiness && !readiness.ready ? (
                <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-semibold">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>
                        {!readiness.apiConnected
                          ? 'MikroTik API Belum Terhubung'
                          : !readiness.ontIp
                          ? 'Pelanggan Belum Terkoneksi (PPPoE Offline)'
                          : 'Remote ONT Memerlukan Script Winbox'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={checkReadiness}
                      disabled={probing}
                      className="p-1 hover:bg-amber-500/20 rounded text-amber-600 dark:text-amber-400 transition-colors"
                      title="Cek Ulang Kesiapan"
                    >
                      <RotateCw className={`w-3.5 h-3.5 ${probing ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                  <p className="text-muted-foreground leading-relaxed text-[11px]">
                    {!readiness.apiConnected
                      ? 'EugineBill belum dapat mengakses API port 8728 di router. Salin dan jalankan script aktivasi Winbox di bawah ini.'
                      : 'Pelanggan saat ini belum terhubung (offline) atau IP PPPoE belum terdaftar di MikroTik.'}
                  </p>
                </div>
              ) : null}

              {/* 2. Script Aktivasi Winbox (Tampil jika belum siap atau saat diklik) */}
              {(showScriptGuide || (readiness && !readiness.apiConnected)) && (
                <div className="p-3.5 bg-muted/40 border border-border rounded-xl space-y-2.5 text-xs animate-in fade-in duration-150">
                  <div className="flex items-center justify-between border-b border-border/60 pb-2">
                    <div className="flex items-center gap-2 font-semibold text-foreground">
                      <Terminal className="w-4 h-4 text-primary" />
                      <span>Script Aktivasi MikroTik (Winbox Terminal)</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyScript}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg text-[11px] font-medium transition-colors"
                    >
                      {scriptCopied ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{scriptCopied ? 'Tersalin' : 'Salin Script'}</span>
                    </button>
                  </div>

                  <pre className="p-2.5 bg-background border border-border rounded-lg font-mono text-[10.5px] text-foreground overflow-x-auto whitespace-pre leading-relaxed select-all">
                    {defaultScript}
                  </pre>

                  <div className="p-2.5 bg-background/70 border border-border/70 rounded-lg text-[11px] text-muted-foreground space-y-1">
                    <p className="font-semibold text-foreground">Panduan Singkat Aktivasi:</p>
                    <p>1. Buka <strong>Winbox &rarr; New Terminal</strong>, lalu paste script di atas.</p>
                    <p>2. Pada modem pelanggan, pastikan opsi <strong>Web WAN / Remote Management</strong> aktif di koneksi PPPoE.</p>
                  </div>
                </div>
              )}

              {/* 3. Form Konfigurasi Port & Eksekusi */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  Custom Port Modem (Opsional, Default Port 80)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: 8080 (untuk modem FiberHome / SK tertentu)"
                  value={customPort}
                  onChange={(e) => setCustomPort(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <button
                onClick={handleLaunch}
                disabled={loading || (readiness && !readiness.apiConnected)}
                className="w-full inline-flex items-center justify-center gap-2 py-3 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold rounded-xl shadow-sm transition-all disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    <span>Menghubungkan Tunnel Proxy...</span>
                  </>
                ) : (
                  <>
                    <Globe className="w-4 h-4" />
                    <span>Buka Akses Web GUI ONT</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                    <Shield className="w-5 h-5" />
                    <span className="text-xs font-semibold uppercase tracking-wider">
                      Tunnel Proxy Aktif
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-foreground bg-background/80 px-2.5 py-1 rounded-lg border border-border">
                    <Clock className="w-3.5 h-3.5 text-primary" />
                    <span>{formatCountdown(remainingSeconds)}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-[11px] text-muted-foreground">
                    URL Akses Langsung (Buka dari browser/jaringan apa saja tanpa VPN):
                  </p>
                  <div className="p-2.5 bg-background border border-border rounded-lg font-mono text-xs text-primary font-bold break-all flex items-center justify-between gap-2">
                    <span className="truncate">
                      {typeof window !== 'undefined' && proxyUrl.startsWith('/')
                        ? `${window.location.origin}${proxyUrl}`
                        : proxyUrl}
                    </span>
                    <button
                      onClick={handleCopy}
                      className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground shrink-0 transition-colors"
                      title="Salin URL"
                    >
                      {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <a
                  href={proxyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-2 py-3 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold rounded-xl shadow-md transition-all"
                >
                  <Globe className="w-4 h-4" />
                  <span>Buka Web ONT</span>
                </a>

                <button
                  onClick={handleExtend}
                  disabled={extending}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 bg-muted hover:bg-muted/80 border border-border text-foreground text-xs font-medium rounded-xl transition-all disabled:opacity-50"
                  title="Perpanjang sesi 15 menit lagi"
                >
                  {extending ? (
                    <RotateCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <PlusCircle className="w-3.5 h-3.5 text-primary" />
                  )}
                  <span>+15 Menit</span>
                </button>

                <button
                  onClick={handleCloseSession}
                  disabled={closing}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 bg-destructive/10 hover:bg-destructive/20 border border-destructive/30 text-destructive text-xs font-medium rounded-xl transition-all disabled:opacity-50"
                  title="Tutup sesi dan bersihkan NAT"
                >
                  {closing ? (
                    <RotateCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5" />
                  )}
                  <span>Tutup</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
