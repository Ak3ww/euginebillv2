'use client'

import { useState } from 'react'
import {
  Globe,
  ExternalLink,
  Copy,
  Check,
  X,
  RotateCw,
  Zap,
  Shield,
} from 'lucide-react'
import { showSuccess, showError } from '@/lib/sweetalert'

interface OntRemoteModalProps {
  isOpen: boolean
  onClose: () => void
  customerName?: string
  username?: string
  targetIp?: string
  routerName?: string
}

export default function OntRemoteModal({
  isOpen,
  onClose,
  customerName = 'Pelanggan',
  username = '',
  targetIp = '',
  routerName = 'Router',
}: OntRemoteModalProps) {
  const [targetPort, setTargetPort] = useState<'80' | '443'>('80')
  const [loading, setLoading] = useState(false)
  const [proxyUrl, setProxyUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  if (!isOpen) return null

  const handleLaunch = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/network/ont-remote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username || undefined,
          targetIp: targetIp || undefined,
          targetPort: parseInt(targetPort),
          customerName,
          routerName,
        }),
      })

      const data = await res.json()
      if (res.ok && data.success && data.session?.proxyUrl) {
        setProxyUrl(data.session.proxyUrl)
        showSuccess('Link Remote Web ONT Berhasil Dibuat!')
      } else {
        showError(data.error || 'Gagal menyiapkan remote ONT')
      }
    } catch (err: any) {
      showError(err.message || 'Terjadi kesalahan sistem')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = () => {
    if (!proxyUrl) return
    navigator.clipboard.writeText(proxyUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    showSuccess('Link URL berhasil disalin!')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-card border border-border rounded-3xl shadow-2xl overflow-hidden space-y-0">
        {/* Header */}
        <div className="p-5 border-b border-border flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary/10 rounded-xl text-primary">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">
                Remote Web ONT (10-Min)
              </h3>
              <p className="text-xs text-muted-foreground">
                {customerName} ({username || targetIp})
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {!proxyUrl ? (
            <div className="space-y-4">
              <div className="p-3.5 bg-muted/40 border border-border rounded-2xl text-xs space-y-1">
                <p className="font-semibold text-foreground flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-500" />
                  Mode Reverse Proxy Nottik-Style
                </p>
                <p className="text-muted-foreground">
                  Sistem akan mendeteksi IP aktif terbaru dari <span className="font-mono text-foreground font-medium">{username || targetIp}</span> dan membuka Reverse Proxy sementara selama 10 menit di IP VPS.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  Pilih Port Web Target Modem
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTargetPort('80')}
                    className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition-all ${
                      targetPort === '80'
                        ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20'
                        : 'border-border bg-background text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <span>HTTP (Port 80)</span>
                    <span className="text-[10px] font-normal opacity-70">ZTE / FiberHome / TP-Link</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetPort('443')}
                    className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition-all ${
                      targetPort === '443'
                        ? 'border-purple-500 bg-purple-500/10 text-purple-400 ring-2 ring-purple-500/20'
                        : 'border-border bg-background text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <span>HTTPS (Port 443)</span>
                    <span className="text-[10px] font-normal opacity-70">Huawei HG8145V5 / EG8145</span>
                  </button>
                </div>
              </div>

              <button
                onClick={handleLaunch}
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 py-3 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-bold rounded-xl shadow-lg transition-all disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    Menyiapkan Link Remote...
                  </>
                ) : (
                  <>
                    <Globe className="w-4 h-4" />
                    Buka Web GUI ONT (10 Menit)
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-center space-y-2">
                <Shield className="w-8 h-8 text-emerald-500 mx-auto" />
                <h4 className="text-sm font-bold text-emerald-400">
                  Link Remote Web ONT Siap!
                </h4>
                <p className="text-xs text-muted-foreground">
                  Berlaku selama 10 menit. Buka dari HP atau browser mana saja tanpa VPN.
                </p>
                <div className="p-2.5 bg-background border border-border rounded-xl font-mono text-xs text-cyan-400 font-bold break-all">
                  {proxyUrl}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={proxyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 bg-cyan-500 hover:bg-cyan-600 text-black text-xs font-bold rounded-xl shadow-md transition-all"
                >
                  <ExternalLink className="w-4 h-4" />
                  Buka di Tab Baru
                </a>

                <button
                  onClick={handleCopy}
                  className="px-3.5 py-2.5 bg-muted hover:bg-muted/80 border border-border text-foreground text-xs font-medium rounded-xl transition-all"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
