'use client'

import { useState, useEffect, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import {
  Globe,
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Home,
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
  KeyRound,
  ZoomIn,
  ZoomOut,
  ChevronDown,
  Layers,
} from 'lucide-react'
import { showSuccess, showError, showConfirm } from '@/lib/sweetalert'

export default function BuiltInOntBrowserPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params)
  const router = useRouter()

  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [extending, setExtending] = useState(false)
  const [closing, setClosing] = useState(false)
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [currentPath, setCurrentPath] = useState('/')
  const [iframeKey, setIframeKey] = useState(0)
  const [iframeLoading, setIframeLoading] = useState(true)
  const [zoomLevel, setZoomLevel] = useState<number>(100)
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [showCredsMenu, setShowCredsMenu] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

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

  // 3. Browser Navigation Controls
  const handleReload = () => {
    setIframeLoading(true)
    if (iframeRef.current) {
      iframeRef.current.src = `/api/network/ont-remote/proxy/${sessionId}${currentPath.startsWith('/') ? currentPath : '/' + currentPath}`
    } else {
      setIframeKey((prev) => prev + 1)
    }
  }

  const handleGoHome = () => {
    setCurrentPath('/')
    setIframeLoading(true)
    if (iframeRef.current) {
      iframeRef.current.src = `/api/network/ont-remote/proxy/${sessionId}/`
    }
  }

  const handleNavigatePath = (e: React.FormEvent) => {
    e.preventDefault()
    let path = currentPath.trim()
    if (!path.startsWith('/')) path = '/' + path
    setIframeLoading(true)
    if (iframeRef.current) {
      iframeRef.current.src = `/api/network/ont-remote/proxy/${sessionId}${path}`
    }
  }

  const handleCopyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(label)
    setTimeout(() => setCopiedKey(null), 2000)
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

  const proxyStreamUrl = `/api/network/ont-remote/proxy/${sessionId}/`

  // Preset Common Modem Passwords
  const defaultCredentials = [
    { label: 'ZTE Admin', u: 'admin', p: 'admin' },
    { label: 'ZTE User', u: 'user', p: 'user' },
    { label: 'Telkom ZTE', u: 'admin', p: 'telkomdso123' },
    { label: 'Huawei Super', u: 'telecomadmin', p: 'admintelecom' },
    { label: 'Huawei Root', u: 'root', p: 'admin' },
    { label: 'FiberHome', u: 'admin', p: '%0|F?H@nl980' },
  ]

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-slate-100 space-y-4">
        <div className="w-10 h-10 border-4 border-sky-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-400 animate-pulse">Menghubungkan ke Built-in Browser Modem ONT...</p>
      </div>
    )
  }

  if (!session || remainingSeconds <= 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950 p-4 text-slate-100">
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl max-w-md text-center shadow-2xl space-y-4">
          <div className="w-14 h-14 bg-rose-500/10 text-rose-400 rounded-full flex items-center justify-center mx-auto">
            <XCircle className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-slate-100">Sesi Remote Tidak Aktif</h2>
          <p className="text-sm text-slate-400">
            Sesi remote untuk modem ini sudah kadaluarsa atau telah ditutup.
          </p>
          <button
            onClick={() => router.push('/admin/sessions/pppoe')}
            className="w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-xl transition shadow-md"
          >
            Kembali ke Sesi PPPoE
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex flex-col bg-slate-950 text-slate-100 ${isFullScreen ? 'fixed inset-0 z-[9999]' : 'h-screen'}`}>
      {/* ── BROWSER TOP CHROME & TOOLBAR ───────────────────────────────────────── */}
      <header className="flex-none bg-slate-900 border-b border-slate-800 px-3 py-2 space-y-2 select-none">
        {/* Row 1: Target Info & Global HUD Controls */}
        <div className="flex items-center justify-between gap-2">
          {/* Left: Back & Customer Badge */}
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={() => router.push('/admin/sessions/pppoe')}
              className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition border border-slate-700"
              title="Kembali ke Daftar Sesi"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Kembali</span>
            </button>

            <div className="flex items-center gap-2 min-w-0">
              <span className="px-2 py-0.5 bg-sky-500/10 text-sky-400 border border-sky-500/20 text-xs font-bold rounded-md truncate">
                {session.customerName || session.username}
              </span>
              <span className="text-xs text-slate-400 font-mono hidden md:inline">
                ({session.username})
              </span>
            </div>
          </div>

          {/* Right: Timer, Extend, Quick Creds & Session Close */}
          <div className="flex items-center gap-2">
            {/* Quick Default Passwords Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowCredsMenu(!showCredsMenu)}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg transition border border-slate-700"
                title="Bantuan Password Default Modem"
              >
                <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden md:inline">Sandi Default</span>
                <ChevronDown className="w-3 h-3 opacity-60" />
              </button>

              {showCredsMenu && (
                <div className="absolute right-0 mt-1 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 p-2 space-y-1 animate-in fade-in zoom-in-95">
                  <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                    Klik untuk Salin Password
                  </div>
                  {defaultCredentials.map((c, i) => (
                    <div
                      key={i}
                      className="p-1.5 hover:bg-slate-800 rounded-lg flex items-center justify-between text-xs transition"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-200 text-[11px]">{c.label}</div>
                        <div className="font-mono text-[10px] text-slate-400">
                          {c.u} : {c.p}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleCopyText(c.u, `${c.label}-u`)}
                          className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-[10px] rounded border border-slate-700 text-slate-300"
                          title="Salin Username"
                        >
                          {copiedKey === `${c.label}-u` ? <Check className="w-3 h-3 text-emerald-400" /> : 'User'}
                        </button>
                        <button
                          onClick={() => handleCopyText(c.p, `${c.label}-p`)}
                          className="px-1.5 py-0.5 bg-sky-500/20 hover:bg-sky-500/30 text-sky-400 text-[10px] font-bold rounded border border-sky-500/30"
                          title="Salin Password"
                        >
                          {copiedKey === `${c.label}-p` ? <Check className="w-3 h-3 text-emerald-400" /> : 'Pass'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Countdown Badge */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-mono font-bold ${
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

            {/* Full Screen Toggle */}
            <button
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition border border-slate-700 hidden sm:block"
              title={isFullScreen ? 'Keluar Layar Penuh' : 'Layar Penuh'}
            >
              {isFullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>

            {/* Close Session */}
            <button
              onClick={handleClose}
              disabled={closing}
              className="flex items-center gap-1 px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold rounded-lg transition border border-rose-500/30 disabled:opacity-50"
              title="Tutup Sesi & Hapus NAT MikroTik"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Tutup</span>
            </button>
          </div>
        </div>

        {/* Row 2: Browser Omnibox Navigation & Address Bar */}
        <div className="flex items-center gap-2">
          {/* Nav buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleGoHome}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition border border-slate-700"
              title="Beranda Modem (/)"
            >
              <Home className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={handleReload}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition border border-slate-700"
              title="Muat Ulang Halaman"
            >
              <RotateCw className={`w-3.5 h-3.5 ${iframeLoading ? 'animate-spin text-sky-400' : ''}`} />
            </button>
          </div>

          {/* Omnibox URL Form */}
          <form onSubmit={handleNavigatePath} className="flex-1 flex items-center min-w-0">
            <div className="w-full flex items-center bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1 text-xs focus-within:border-sky-500 transition">
              <div className="flex items-center gap-1.5 text-emerald-400 mr-2 flex-none" title="Koneksi Aman via Reverse Proxy WireGuard">
                <Shield className="w-3.5 h-3.5" />
                <span className="font-mono text-[11px] font-bold hidden sm:inline">http://{session.targetIp}:{session.targetPort || 80}</span>
              </div>
              <input
                type="text"
                value={currentPath}
                onChange={(e) => setCurrentPath(e.target.value)}
                placeholder="/ (jalur halaman)"
                className="flex-1 bg-transparent border-0 outline-none text-slate-200 font-mono text-xs placeholder:text-slate-600 min-w-0"
              />
              <button
                type="submit"
                className="px-2 py-0.5 bg-sky-500/20 hover:bg-sky-500/30 text-sky-400 font-semibold rounded text-[10px] ml-1 flex-none transition"
              >
                Go
              </button>
            </div>
          </form>

          {/* Display Zoom Tool */}
          <div className="flex items-center gap-1 bg-slate-800/80 border border-slate-700 rounded-lg p-0.5 text-xs">
            <button
              onClick={() => setZoomLevel((z) => Math.max(70, z - 10))}
              className="p-1 hover:bg-slate-700 text-slate-300 rounded"
              title="Perkecil Zoom"
            >
              <ZoomOut className="w-3 h-3" />
            </button>
            <span className="font-mono text-[10px] text-slate-300 px-1 font-semibold">{zoomLevel}%</span>
            <button
              onClick={() => setZoomLevel((z) => Math.min(150, z + 10))}
              className="p-1 hover:bg-slate-700 text-slate-300 rounded"
              title="Perbesar Zoom"
            >
              <ZoomIn className="w-3 h-3" />
            </button>
          </div>
        </div>
      </header>

      {/* ── BROWSER CANVAS / IFRAME ────────────────────────────────────────────── */}
      <main className="flex-1 relative bg-white overflow-auto flex items-start justify-center">
        {iframeLoading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/60 backdrop-blur-xs text-white space-y-3 pointer-events-none">
            <div className="w-8 h-8 border-3 border-sky-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-slate-200 font-medium tracking-wide">
              Memuat antarmuka modem {session.targetIp} via Fast-Stream Proxy...
            </p>
          </div>
        )}

        <div
          style={{
            transform: `scale(${zoomLevel / 100})`,
            transformOrigin: 'top left',
            width: `${100 * (100 / zoomLevel)}%`,
            height: `${100 * (100 / zoomLevel)}%`,
          }}
          className="w-full h-full"
        >
          <iframe
            key={iframeKey}
            ref={iframeRef}
            src={proxyStreamUrl}
            onLoad={() => setIframeLoading(false)}
            className="w-full h-full border-0 bg-white"
            title={`Built-in ONT Browser - ${session.customerName}`}
          />
        </div>
      </main>
    </div>
  )
}
