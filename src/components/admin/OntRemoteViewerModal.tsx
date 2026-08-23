'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Globe,
  X,
  RotateCw,
  Clock,
  XCircle,
  ExternalLink,
  Shield,
  Copy,
  Check,
  Maximize2,
} from 'lucide-react'
import { showSuccess, showError, showConfirm } from '@/lib/sweetalert'

interface OntRemoteViewerModalProps {
  isOpen: boolean
  onClose: () => void
  session: any
  onSessionClosed?: () => void
  onSessionExtended?: () => void
}

export default function OntRemoteViewerModal({
  isOpen,
  onClose,
  session,
  onSessionClosed,
  onSessionExtended,
}: OntRemoteViewerModalProps) {
  const [iframeKey, setIframeKey] = useState(0)
  const [iframeLoading, setIframeLoading] = useState(true)
  const [extending, setExtending] = useState(false)
  const [closing, setClosing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [remainingSeconds, setRemainingSeconds] = useState(0)

  useEffect(() => {
    if (session?.remainingSeconds) {
      setRemainingSeconds(session.remainingSeconds)
    }
  }, [session])

  // Countdown timer ticker
  useEffect(() => {
    if (!isOpen || remainingSeconds <= 0) return
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
  }, [isOpen, remainingSeconds])

  if (!isOpen || !session) return null

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const handleRefresh = () => {
    setIframeLoading(true)
    setIframeKey((prev) => prev + 1)
  }

  const handleExtend = async () => {
    setExtending(true)
    try {
      const res = await fetch('/api/network/ont-remote', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id, extendMinutes: 15 }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        showSuccess('Sesi berhasil diperpanjang 15 menit!')
        if (onSessionExtended) onSessionExtended()
      } else {
        showError(data.error || 'Gagal memperpanjang sesi')
      }
    } catch (e: any) {
      showError(e?.message || 'Terjadi kesalahan sistem')
    } finally {
      setExtending(false)
    }
  }

  const handleCloseSession = async () => {
    const confirmed = await showConfirm(
      'Tutup Sesi Remote ONT?',
      `Sesi untuk ${session.customerName} akan dinonaktifkan dan aturan NAT MikroTik akan dihapus.`
    )
    if (!confirmed) return

    setClosing(true)
    try {
      const res = await fetch(`/api/network/ont-remote?id=${session.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (res.ok && data.success) {
        showSuccess('Sesi remote ONT telah ditutup')
        if (onSessionClosed) onSessionClosed()
        onClose()
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

  const proxyStreamUrl = `/api/network/ont-remote/proxy/${session.id}/`

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in">
      <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-6xl h-[92vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Top Header Bar */}
        <div className="p-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between gap-2 flex-none">
          {/* Target Meta */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 bg-sky-500/20 text-sky-400 rounded-xl border border-sky-500/30 flex-none">
              <Globe className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-100 truncate">
                  {session.customerName || session.username}
                </h3>
                <span className="px-2 py-0.5 bg-slate-800 text-slate-300 text-xs font-mono rounded-md border border-slate-700">
                  {session.targetIp}:{session.targetPort || 80}
                </span>
              </div>
            </div>
          </div>

          {/* Action buttons & Timer */}
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {/* Live Countdown */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-mono font-semibold ${
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

            {/* Refresh */}
            <button
              onClick={handleRefresh}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition border border-slate-700"
              title="Muat Ulang Iframe"
            >
              <RotateCw className={`w-3.5 h-3.5 ${iframeLoading ? 'animate-spin text-sky-400' : ''}`} />
            </button>

            {/* Open Full Tab */}
            <a
              href={`/admin/ont-viewer/${session.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-lg transition shadow-xs"
              title="Buka di Tab Halaman Penuh"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Tab Penuh</span>
            </a>

            {/* Extend */}
            <button
              onClick={handleExtend}
              disabled={extending}
              className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg transition border border-slate-700 disabled:opacity-50"
            >
              <Clock className="w-3.5 h-3.5 text-sky-400" />
              <span>+15m</span>
            </button>

            {/* Close Session */}
            <button
              onClick={handleCloseSession}
              disabled={closing}
              className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg transition border border-rose-500/30"
              title="Tutup Sesi & Hapus NAT"
            >
              <XCircle className="w-3.5 h-3.5" />
            </button>

            {/* Close Modal Window */}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition"
              title="Tutup Jendela"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Iframe View */}
        <div className="flex-1 relative bg-white overflow-hidden">
          {iframeLoading && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-900/60 backdrop-blur-xs text-white space-y-3 pointer-events-none">
              <div className="w-8 h-8 border-3 border-sky-400 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-slate-300 font-medium">Memuat antarmuka modem {session.targetIp}...</p>
            </div>
          )}

          <iframe
            key={iframeKey}
            src={proxyStreamUrl}
            onLoad={() => setIframeLoading(false)}
            className="w-full h-full border-0 bg-white"
            title={`ONT Remote Modal - ${session.customerName}`}
          />
        </div>
      </div>
    </div>
  )
}
