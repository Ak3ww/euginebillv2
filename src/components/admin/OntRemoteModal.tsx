'use client'

import { useState, useEffect, useRef } from 'react'
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

  // Reset modal state when opening for a new customer
  useEffect(() => {
    if (isOpen) {
      setProxyUrl(null)
      setSessionId(null)
      setExpiresAt(null)
      setRemainingSeconds(0)
      setTargetPort('80')
      setCustomPort('')
    }
  }, [isOpen, username, targetIp])

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
    if (targetPort === 'custom') {
      const p = parseInt(customPort)
      return p > 0 && p <= 65535 ? p : 80
    }
    return parseInt(targetPort)
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
    navigator.clipboard.writeText(proxyUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    showSuccess('Link URL berhasil disalin!')
  }

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden space-y-0 text-card-foreground">
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
        <div className="p-5 sm:p-6 space-y-4">
          {!proxyUrl ? (
            <div className="space-y-4">
              <div className="p-3.5 bg-muted/40 border border-border rounded-xl text-xs space-y-1.5">
                <div className="font-semibold text-foreground flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-primary" />
                  <span>Reverse Proxy Otomatis MikroTik + VPS</span>
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  Sistem mendeteksi IP PPPoE aktif dari <span className="font-mono text-foreground font-medium">{username || targetIp}</span> dan membuka tunnel proxy sementara (15 menit) di IP publik VPS.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-2">
                  Pilih Port Web GUI Modem (ONT)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setTargetPort('80')}
                    className={`p-2.5 rounded-xl border text-xs font-medium flex flex-col items-center gap-1 transition-all ${
                      targetPort === '80'
                        ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary'
                        : 'border-border bg-background text-muted-foreground hover:bg-muted/60'
                    }`}
                  >
                    <span className="font-semibold">HTTP (80)</span>
                    <span className="text-[10px] opacity-75">ZTE / FiberHome</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetPort('443')}
                    className={`p-2.5 rounded-xl border text-xs font-medium flex flex-col items-center gap-1 transition-all ${
                      targetPort === '443'
                        ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary'
                        : 'border-border bg-background text-muted-foreground hover:bg-muted/60'
                    }`}
                  >
                    <span className="font-semibold">HTTPS (443)</span>
                    <span className="text-[10px] opacity-75">Huawei</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetPort('custom')}
                    className={`p-2.5 rounded-xl border text-xs font-medium flex flex-col items-center gap-1 transition-all ${
                      targetPort === 'custom'
                        ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary'
                        : 'border-border bg-background text-muted-foreground hover:bg-muted/60'
                    }`}
                  >
                    <span className="font-semibold">Custom Port</span>
                    <span className="text-[10px] opacity-75">8080, dll</span>
                  </button>
                </div>

                {targetPort === 'custom' && (
                  <div className="mt-2">
                    <input
                      type="number"
                      placeholder="Masukkan nomor port (misal: 8080)"
                      value={customPort}
                      onChange={(e) => setCustomPort(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                )}
              </div>

              <button
                onClick={handleLaunch}
                disabled={loading}
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
                    <span className="truncate">{proxyUrl}</span>
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
                  href={`/admin/ont-viewer/${sessionId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-2 py-3 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-xl shadow-md transition-all"
                >
                  <Globe className="w-4 h-4" />
                  <span>Buka Web GUI Modem (HTTPS Domain)</span>
                </a>

                <a
                  href={proxyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-3 bg-muted hover:bg-muted/80 border border-border text-foreground text-xs font-semibold rounded-xl transition-all"
                  title="Buka via Direct IP:Port (Port 24000)"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Port 24000</span>
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
