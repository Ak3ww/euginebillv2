'use client'

import { useState, useEffect, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import {
  Globe,
  ArrowLeft,
  RotateCw,
  Clock,
  XCircle,
  ExternalLink,
  Shield,
  Server,
  Zap,
  Check,
  Copy,
  Maximize2,
  Minimize2,
} from 'lucide-react'
import { showSuccess, showError, showConfirm } from '@/lib/sweetalert'

export default function OntViewerPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params)
  const router = useRouter()

  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [extending, setExtending] = useState(false)
  const [closing, setClosing] = useState(false)
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [iframeKey, setIframeKey] = useState(0)
  const [iframeLoading, setIframeLoading] = useState(true)
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [copied, setCopied] = useState(false)

  const iframeRef = useRef<HTMLIFrameElement>(null)

  // 1. Fetch Session Info
  const fetchSessionInfo = async () => {
    try {
      const res = await fetch('/api/network/ont-remote')
      const data = await res.json()
      if (res.ok && data.sessions) {
        const found = data.sessions.find((s: any) => s.id === sessionId)
        if (found) {
          setSession(found)
          setRemainingSeconds(found.remainingSeconds || 0)
        } else {
          setSession(null)
        }
      }
    } catch (e) {
      console.error('Failed to load ONT session:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSessionInfo()
  }, [sessionId])

  // 2. Countdown Timer
  useEffect(() => {
    if (remainingSeconds <= 0) return
    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [remainingSeconds])

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  // 3. Handlers
  const handleRefreshIframe = () => {
    setIframeLoading(true)
    setIframeKey((prev) => prev + 1)
  }

  const handleExtend = async () => {
    setExtending(true)
    try {
      const res = await fetch('/api/network/ont-remote', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, extendMinutes: 15 }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        showSuccess('Sesi berhasil diperpanjang 15 menit!')
        fetchSessionInfo()
      } else {
        showError(data.error || 'Gagal memperpanjang sesi')
      }
    } catch (e: any) {
      showError(e?.message || 'Terjadi kesalahan sistem')
    } finally {
      setExtending(false)
    }
  }

  const handleClose = async () => {
    const confirmed = await showConfirm(
      'Tutup Sesi Remote ONT?',
      'Koneksi proxy dan aturan NAT MikroTik akan dihapus sekarang.'
    )
    if (!confirmed) return

    setClosing(true)
    try {
      const res = await fetch(`/api/network/ont-remote?id=${sessionId}`, { method: 'DELETE' })
      const data = await res.json()
      if (res.ok && data.success) {
        showSuccess('Sesi remote ONT telah ditutup')
        router.push('/admin/sessions/pppoe')
      } else {
        showError(data.error || 'Gagal menutup sesi')
      }
    } catch (e: any) {
      showError(e?.message || 'Terjadi kesalahan sistem')
    } finally {
      setClosing(false)
    }
  }

  const handleCopyDirectUrl = () => {
    if (!session?.proxyUrl) return
    navigator.clipboard.writeText(session.proxyUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const proxyStreamUrl = `/api/network/ont-remote/proxy/${sessionId}/`

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground space-y-4">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground animate-pulse">Menghubungkan ke Web GUI Modem ONT...</p>
      </div>
    )
  }

  if (!session || remainingSeconds <= 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-4">
        <div className="bg-card border border-border p-8 rounded-2xl max-w-md text-center shadow-2xl space-y-4">
          <div className="w-14 h-14 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mx-auto">
            <XCircle className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-foreground">Sesi Remote Tidak Aktif</h2>
          <p className="text-sm text-muted-foreground">
            Sesi remote untuk modem ini sudah kadaluarsa atau telah ditutup.
          </p>
          <button
            onClick={() => router.push('/admin/sessions/pppoe')}
            className="w-full py-2.5 px-4 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition shadow-md"
          >
            Kembali ke Sesi PPPoE
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex flex-col bg-slate-950 text-slate-100 ${isFullScreen ? 'fixed inset-0 z-[9999]' : 'h-screen'}`}>
      {/* Top Glassmorphism HUD Bar */}
      <header className="flex-none bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-2.5 flex items-center justify-between gap-3 select-none">
        {/* Left: Back & Target Meta */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => router.push('/admin/sessions/pppoe')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition border border-slate-700"
            title="Kembali ke Daftar Sesi"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Kembali</span>
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 bg-sky-500/20 text-sky-400 rounded-lg border border-sky-500/30">
              <Globe className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-100 truncate">
                  {session.customerName || session.username}
                </span>
                <span className="px-2 py-0.5 bg-slate-800 text-slate-300 text-[11px] font-mono rounded-md border border-slate-700">
                  {session.targetIp}:{session.targetPort || 80}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Controls & Timer */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Live Timer Pill */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-mono font-semibold transition ${
              remainingSeconds > 300
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : remainingSeconds > 60
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400 animate-pulse'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{formatTimer(remainingSeconds)}</span>
          </div>

          {/* Extend +15m */}
          <button
            onClick={handleExtend}
            disabled={extending}
            className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg transition border border-slate-700 disabled:opacity-50"
            title="Perpanjang Sesi 15 Menit"
          >
            <Clock className="w-3.5 h-3.5 text-sky-400" />
            <span>+15m</span>
          </button>

          {/* Refresh Iframe */}
          <button
            onClick={handleRefreshIframe}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition border border-slate-700"
            title="Muat Ulang Halaman Modem"
          >
            <RotateCw className={`w-3.5 h-3.5 ${iframeLoading ? 'animate-spin text-sky-400' : ''}`} />
          </button>

          {/* Copy Direct Port URL */}
          <button
            onClick={handleCopyDirectUrl}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition border border-slate-700"
            title="Salin Link Direct Port (Port 24000)"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {/* Full Screen Toggle */}
          <button
            onClick={() => setIsFullScreen(!isFullScreen)}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition border border-slate-700 hidden md:block"
            title={isFullScreen ? 'Keluar Fullscreen' : 'Layar Penuh'}
          >
            {isFullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          {/* Close Session */}
          <button
            onClick={handleClose}
            disabled={closing}
            className="flex items-center gap-1 px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold rounded-lg transition border border-rose-500/30 disabled:opacity-50"
            title="Tutup Sesi & Bersihkan NAT MikroTik"
          >
            <XCircle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Tutup</span>
          </button>
        </div>
      </header>

      {/* Main Iframe Canvas */}
      <main className="flex-1 relative bg-white overflow-hidden">
        {iframeLoading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-900/60 backdrop-blur-xs text-white space-y-3 pointer-events-none">
            <div className="w-8 h-8 border-3 border-sky-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-slate-300 font-medium">Memuat antarmuka modem {session.targetIp}...</p>
          </div>
        )}

        <iframe
          key={iframeKey}
          ref={iframeRef}
          src={proxyStreamUrl}
          onLoad={() => setIframeLoading(false)}
          className="w-full h-full border-0 bg-white"
          title={`ONT Remote - ${session.customerName}`}
        />
      </main>
    </div>
  )
}
