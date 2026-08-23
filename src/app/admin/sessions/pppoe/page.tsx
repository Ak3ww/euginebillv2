'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createPortal } from 'react-dom'
import {
  Activity,
  Filter,
  Power,
  RefreshCw,
  Wifi,
  Search,
  Download,
  Globe,
  Clock,
  ArrowDown,
  ArrowUp,
  Server,
  Calendar,
  Copy,
  Check,
  AlertCircle,
  Trash2,
  ExternalLink,
} from 'lucide-react'
import { useToast } from '@/components/cyberpunk/CyberToast'
import { useTranslation } from '@/hooks/useTranslation'
import { formatWIB, nowWIB, todayWIBStr } from '@/lib/timezone'
import OntRemoteModal from '@/components/admin/OntRemoteModal'
import OntRemoteViewerModal from '@/components/admin/OntRemoteViewerModal'

interface Session {
  id: string
  username: string
  sessionId: string
  type: 'pppoe' | 'hotspot'
  nasIpAddress: string
  framedIpAddress: string
  macAddress: string
  startTime: string
  lastUpdate: string | null
  duration: number
  durationFormatted: string
  uploadFormatted: string
  downloadFormatted: string
  totalFormatted: string
  router: { id: string; name: string } | null
  user: { id: string; customerId?: string | null; name: string; phone: string; profile: string } | null
}

interface Pagination {
  total: number
  page: number
  limit: number
  totalPages: number
}

interface Stats {
  total: number
  pppoe: number
  hotspot: number
  totalBandwidthFormatted: string
}

interface AllTimeStats {
  totalSessions: number
  totalBandwidthFormatted: string
  totalDurationFormatted: string
}

interface Router {
  id: string
  name: string
}

export default function PPPoESessionsPage() {
  const { t } = useTranslation()
  const { addToast, confirm } = useToast()
  const [sessions, setSessions] = useState<Session[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [allTimeStats, setAllTimeStats] = useState<AllTimeStats | null>(null)
  const [routers, setRouters] = useState<Router[]>([])
  const [routerStatus, setRouterStatus] = useState<{ id: string; name: string; isOnline: boolean; error?: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set())
  const [disconnecting, setDisconnecting] = useState(false)
  const [routerFilter, setRouterFilter] = useState<string>('')
  const [searchFilter, setSearchFilter] = useState<string>('')
  const [pagination, setPagination] = useState<Pagination>({ total: 0, page: 1, limit: 25, totalPages: 1 })
  const [pageSize, setPageSize] = useState<number>(25)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [showDateRangeModal, setShowDateRangeModal] = useState(false)
  const [exportStartDate, setExportStartDate] = useState(formatWIB(new Date(nowWIB().getTime() - 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'))
  const [exportEndDate, setExportEndDate] = useState(todayWIBStr())
  const [now, setNow] = useState(() => nowWIB().getTime())
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [copiedIp, setCopiedIp] = useState<string | null>(null)

  // ONT Remote sessions state
  const [ontSessions, setOntSessions] = useState<any[]>([])
  const [copiedOntId, setCopiedOntId] = useState<string | null>(null)
  const [closingOntId, setClosingOntId] = useState<string | null>(null)
  const [closingAllOnt, setClosingAllOnt] = useState(false)

  const fetchOntSessions = async () => {
    try {
      const res = await fetch('/api/network/ont-remote')
      const data = await res.json()
      if (res.ok && data.sessions) {
        setOntSessions(data.sessions)
      }
    } catch (e) {
      console.error('Failed to fetch ONT sessions:', e)
    }
  }

  const handleCopyOntUrl = (id: string, url: string) => {
    navigator.clipboard.writeText(url)
    setCopiedOntId(id)
    addToast({ type: 'info', title: 'Tersalin', description: 'Link remote Web ONT disalin ke clipboard.' })
    setTimeout(() => setCopiedOntId(null), 2500)
  }

  const handleCloseOntSession = async (sess: any) => {
    const confirmed = await confirm({
      title: 'Tutup Sesi Remote ONT?',
      message: `Sesi remote untuk ${sess.customerName} (Port ${sess.proxyPort}) akan dinonaktifkan dan aturan NAT MikroTik akan dihapus.`,
      confirmText: 'Ya, Tutup Sesi',
      cancelText: 'Batal',
      variant: 'danger',
    })
    if (!confirmed) return

    setClosingOntId(sess.id)
    try {
      const res = await fetch(`/api/network/ont-remote?id=${sess.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (res.ok && data.success) {
        addToast({ type: 'success', title: 'Sukses', description: 'Sesi remote ONT berhasil ditutup & aturan NAT dihapus' })
        fetchOntSessions()
      } else {
        addToast({ type: 'error', title: 'Gagal', description: data.error || 'Gagal menutup sesi remote ONT' })
      }
    } catch (e: any) {
      addToast({ type: 'error', title: 'Gagal', description: e?.message || 'Terjadi kesalahan sistem' })
    } finally {
      setClosingOntId(null)
    }
  }

  const handleCloseAllOntSessions = async () => {
    const activeCount = ontSessions.filter((s: any) => s.status === 'ACTIVE' && s.remainingSeconds > 0).length
    if (activeCount === 0) return

    const confirmed = await confirm({
      title: 'Tutup Semua Sesi Remote ONT?',
      message: `Tindakan ini akan menutup ${activeCount} sesi aktif dan membersihkan seluruh aturan NAT di MikroTik sekaligus.`,
      confirmText: 'Ya, Tutup Semua',
      cancelText: 'Batal',
      variant: 'danger',
    })
    if (!confirmed) return

    setClosingAllOnt(true)
    try {
      const res = await fetch('/api/network/ont-remote?id=all', { method: 'DELETE' })
      const data = await res.json()
      if (res.ok && data.success) {
        addToast({ type: 'success', title: 'Sukses', description: data.message || 'Semua sesi remote ONT berhasil ditutup' })
        fetchOntSessions()
      } else {
        addToast({ type: 'error', title: 'Gagal', description: data.error || 'Gagal menutup semua sesi' })
      }
    } catch (e: any) {
      addToast({ type: 'error', title: 'Gagal', description: e?.message || 'Terjadi kesalahan sistem' })
    } finally {
      setClosingAllOnt(false)
    }
  }

  // ONT Remote Modal state
  const [ontModalOpen, setOntModalOpen] = useState(false)
  const [viewerModalSession, setViewerModalSession] = useState<any | null>(null)
  const [ontTarget, setOntTarget] = useState<{
    customerName: string
    username: string
    targetIp: string
    routerName: string
  }>({
    customerName: '',
    username: '',
    targetIp: '',
    routerName: '',
  })

  // 1-second ticker for live duration counter & ONT countdown
  useEffect(() => {
    const ticker = setInterval(() => {
      setNow(nowWIB().getTime())
      setOntSessions((prev) =>
        prev.map((s) => {
          if (s.status !== 'ACTIVE' || s.remainingSeconds <= 0) return s
          const next = s.remainingSeconds - 1
          return { ...s, remainingSeconds: Math.max(0, next), status: next <= 0 ? 'EXPIRED' : s.status }
        })
      )
    }, 1000)
    return () => clearInterval(ticker)
  }, [])

  const formatDuration = (seconds: number) => {
    if (!seconds || seconds < 0) return '0d'
    const d = Math.floor(seconds / 86400)
    const h = Math.floor((seconds % 86400) / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    if (d > 0) return `${d}h ${h}j ${m}m`
    if (h > 0) return `${h}j ${m}m ${s}d`
    if (m > 0) return `${m}m ${s}d`
    return `${s}d`
  }

  const liveDuration = (startTimeStr: string | null) => {
    if (!startTimeStr) return 0
    const startMs = new Date(startTimeStr).getTime()
    return Math.max(0, Math.floor((now - startMs) / 1000))
  }

  const fetchSessions = async (page: number = 1, silent = false, isLive = false) => {
    try {
      const pageNum = typeof page === 'number' ? page : 1
      if (!silent) setLoading(true)
      const params = new URLSearchParams()
      params.set('page', pageNum.toString())
      params.set('limit', pageSize.toString())
      params.set('type', 'pppoe')
      if (isLive) params.set('live', 'true')
      if (routerFilter) params.set('routerId', routerFilter)
      if (searchFilter) params.set('search', searchFilter)

      const res = await fetch(`/api/sessions?${params}`)
      const data = await res.json()
      setSessions(data.sessions || [])
      setStats(data.stats)
      setAllTimeStats(data.allTimeStats)
      setRouterStatus(data.routerStatus || null)
      if (data.pagination) {
        setPagination(data.pagination)
        setCurrentPage(data.pagination.page)
      }
    } catch (error) {
      console.error('Failed to fetch sessions:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchRouters = async () => {
    try {
      const res = await fetch('/api/network/routers')
      const data = await res.json()
      setRouters(data.routers || [])
    } catch (error) {
      console.error('Failed to fetch routers:', error)
    }
  }

  useEffect(() => {
    fetchRouters()
    fetchOntSessions()
  }, [])

  useEffect(() => {
    fetchSessions(1)
    fetchOntSessions()
    if (!autoRefresh) return
    const interval = setInterval(() => {
      fetchSessions(currentPage, true)
      fetchOntSessions()
    }, 10000)

    const onVisible = () => {
      if (!document.hidden) {
        fetchSessions(currentPage, true)
        fetchOntSessions()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routerFilter, searchFilter, pageSize, currentPage, autoRefresh])

  // Auto-open modal if URL query params present (e.g. from ACS redirect)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search)
      const username = sp.get('username')
      if (username) {
        setOntTarget({
          customerName: username,
          username,
          targetIp: '',
          routerName: 'Router',
        })
        setOntModalOpen(true)
      }
    }
  }, [])

  // Exports
  const handleExportExcel = async () => {
    try {
      const params = new URLSearchParams()
      params.set('format', 'excel')
      params.set('mode', 'active')
      params.set('type', 'pppoe')
      if (routerFilter) params.set('routerId', routerFilter)
      if (searchFilter) params.set('username', searchFilter)
      const res = await fetch(`/api/sessions/export?${params}`)
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Sesi-PPPoE-Aktif-${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Export error:', error)
      addToast({ type: 'error', title: 'Error', description: 'Gagal mengekspor file Excel' })
    }
  }

  const handleExportHistoryExcel = () => {
    setShowDateRangeModal(true)
  }

  const handlePerformHistoryExport = async () => {
    setShowDateRangeModal(false)
    try {
      const params = new URLSearchParams()
      params.set('format', 'excel')
      params.set('mode', 'history')
      params.set('type', 'pppoe')
      params.set('startDate', exportStartDate)
      params.set('endDate', exportEndDate)
      if (routerFilter) params.set('routerId', routerFilter)
      const res = await fetch(`/api/sessions/export?${params}`)
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Riwayat-Sesi-PPPoE-${exportStartDate}-${exportEndDate}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Export error:', error)
      addToast({ type: 'error', title: 'Error', description: 'Gagal mengekspor riwayat' })
    }
  }

  const handleExportPDF = async () => {
    try {
      const params = new URLSearchParams()
      params.set('format', 'pdf')
      params.set('mode', 'active')
      params.set('type', 'pppoe')
      if (routerFilter) params.set('routerId', routerFilter)
      const res = await fetch(`/api/sessions/export?${params}`)
      const data = await res.json()
      if (data.pdfData) {
        const jsPDF = (await import('jspdf')).default
        const autoTable = (await import('jspdf-autotable')).default
        const doc = new jsPDF({ orientation: 'landscape' })
        doc.setFontSize(14)
        doc.text(data.pdfData.title, 14, 15)
        doc.setFontSize(8)
        doc.text(`Dicetak: ${data.pdfData.generatedAt}`, 14, 21)
        autoTable(doc, {
          head: [data.pdfData.headers],
          body: data.pdfData.rows,
          startY: 26,
          styles: { fontSize: 7 },
          headStyles: { fillColor: [0, 44, 96] },
        })
        if (data.pdfData.summary) {
          const finalY = (doc as any).lastAutoTable.finalY + 8
          doc.setFontSize(9)
          doc.setFont('helvetica', 'bold')
          data.pdfData.summary.forEach((s: any, i: number) => {
            doc.text(`${s.label}: ${s.value}`, 14, finalY + i * 5)
          })
        }
        doc.save(`Sesi-PPPoE-Aktif-${new Date().toISOString().split('T')[0]}.pdf`)
      }
    } catch (error) {
      console.error('PDF error:', error)
      addToast({ type: 'error', title: 'Error', description: 'Gagal mengekspor PDF' })
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedSessions(new Set(sessions.map((s) => s.sessionId)))
    } else {
      setSelectedSessions(new Set())
    }
  }

  const handleSelectSession = (sessionId: string, checked: boolean) => {
    const newSelected = new Set(selectedSessions)
    if (checked) {
      newSelected.add(sessionId)
    } else {
      newSelected.delete(sessionId)
    }
    setSelectedSessions(newSelected)
  }

  const handleDisconnect = async (sessionIds: string[], usernames?: string[]) => {
    if (
      !(await confirm({
        title: 'Putuskan Sesi PPPoE?',
        message: `Yakin ingin memutuskan koneksi ${usernames?.length || sessionIds.length} sesi pelanggan terpilih dari MikroTik?`,
        confirmText: 'Putuskan Sesi',
        cancelText: 'Batal',
        variant: 'danger',
      }))
    )
      return

    setDisconnecting(true)
    try {
      const res = await fetch('/api/sessions/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionIds, usernames }),
      })

      const data = await res.json()
      if (data.success) {
        addToast({
          type: 'success',
          title: 'Berhasil',
          description: `Berhasil memutuskan ${data.summary?.successful || sessionIds.length} sesi dari MikroTik.`,
        })
        setSelectedSessions(new Set())
        await fetchSessions(currentPage, false, true)
      } else {
        addToast({ type: 'error', title: 'Gagal', description: data.error || 'Gagal memutuskan sesi' })
      }
    } catch (error) {
      addToast({ type: 'error', title: 'Gagal', description: 'Terjadi kesalahan sistem' })
    } finally {
      setDisconnecting(false)
    }
  }

  const handleBulkDisconnect = () => {
    const sessionIds = Array.from(selectedSessions)
    const selectedUsernames = sessions
      .filter((s) => selectedSessions.has(s.sessionId) || selectedSessions.has(s.id))
      .map((s) => s.username)
    handleDisconnect(sessionIds, selectedUsernames)
  }

  const handleCopyIp = (ip: string) => {
    navigator.clipboard.writeText(ip)
    setCopiedIp(ip)
    setTimeout(() => setCopiedIp(null), 2000)
    addToast({ type: 'info', title: 'Tersalin', description: `IP ${ip} berhasil disalin.` })
  }

  const openOntModalForSession = (session: Session) => {
    setOntTarget({
      customerName: session.user?.name || session.username,
      username: session.username,
      targetIp: session.framedIpAddress || '',
      routerName: session.router?.name || 'Router',
    })
    setOntModalOpen(true)
  }

  return (
    <>
      {/* Date Range Modal for History Export */}
      {showDateRangeModal &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in"
            onClick={() => setShowDateRangeModal(false)}
          >
            <div
              className="bg-card border border-border rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl space-y-0"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">
                    Ekspor Riwayat Sesi PPPoE
                  </h3>
                </div>
                <button
                  onClick={() => setShowDateRangeModal(false)}
                  className="text-muted-foreground hover:text-foreground text-lg leading-none"
                >
                  &times;
                </button>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Dari Tanggal
                  </label>
                  <input
                    type="date"
                    value={exportStartDate}
                    onChange={(e) => setExportStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-xl bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Sampai Tanggal
                  </label>
                  <input
                    type="date"
                    value={exportEndDate}
                    onChange={(e) => setExportEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-xl bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
              <div className="flex gap-2 p-4 border-t border-border bg-muted/20">
                <button
                  onClick={() => setShowDateRangeModal(false)}
                  className="flex-1 px-3 py-2 text-xs border border-border rounded-xl text-muted-foreground hover:bg-muted font-medium"
                >
                  Batal
                </button>
                <button
                  onClick={handlePerformHistoryExport}
                  className="flex-1 px-3 py-2 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl shadow-sm"
                >
                  Unduh Excel
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ONT Remote Modal */}
      <OntRemoteModal
        isOpen={ontModalOpen}
        onClose={() => setOntModalOpen(false)}
        customerName={ontTarget.customerName}
        username={ontTarget.username}
        targetIp={ontTarget.targetIp}
        routerName={ontTarget.routerName}
        onSuccess={fetchOntSessions}
      />

      {/* ONT Remote Embedded Viewer Modal */}
      <OntRemoteViewerModal
        isOpen={!!viewerModalSession}
        session={viewerModalSession}
        onClose={() => setViewerModalSession(null)}
        onSessionClosed={fetchOntSessions}
        onSessionExtended={fetchOntSessions}
      />

      <div className="space-y-6 pb-12">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-primary/10 rounded-xl text-primary">
                <Wifi className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
                  Monitoring Sesi PPPoE
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Pantau pelanggan online, traffic realtime, dan remote modem ONT langsung
                </p>
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border transition-all ${
                autoRefresh
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'border-border bg-card text-muted-foreground hover:bg-muted'
              }`}
              title="Toggle auto-refresh 10 detik"
            >
              <span className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground'}`}></span>
              <span>{autoRefresh ? 'Live (10s)' : 'Pause'}</span>
            </button>

            <button
              onClick={() => fetchSessions(currentPage, false, true)}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-card border border-border rounded-xl hover:bg-muted/70 text-foreground transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            <div className="h-4 w-px bg-border hidden sm:block"></div>

            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Excel</span>
            </button>

            <button
              onClick={handleExportPDF}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl shadow-sm transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>PDF</span>
            </button>

            <button
              onClick={handleExportHistoryExcel}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-card border border-border hover:bg-muted text-foreground rounded-xl transition-all"
            >
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Riwayat</span>
            </button>
          </div>
        </div>

        {/* Summary Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Card 1: Active PPPoE Sessions */}
          <div
            onClick={() => setRouterFilter('')}
            className={`p-4 bg-card border rounded-2xl cursor-pointer transition-all hover:shadow-sm ${
              routerFilter === '' ? 'border-primary/50 ring-1 ring-primary/20 bg-primary/5' : 'border-border'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
              <span className="font-semibold uppercase tracking-wider">Total Online</span>
              <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[10px] font-bold">LIVE</span>
              </div>
            </div>
            <div className="text-2xl font-bold text-foreground">
              {stats ? stats.pppoe || stats.total : 0}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Sesi PPPoE aktif saat ini</p>
          </div>

          {/* Card 2: Bandwidth Usage */}
          <div className="p-4 bg-card border border-border rounded-2xl">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
              <span className="font-semibold uppercase tracking-wider">Total Bandwidth</span>
              <Activity className="w-4 h-4 text-primary" />
            </div>
            <div className="text-2xl font-bold text-foreground">
              {stats?.totalBandwidthFormatted || '0 B'}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Akumulasi sesi berjalan</p>
          </div>

          {/* Card 3 & 4: Router Filter Badges */}
          {routers.slice(0, 2).map((router) => {
            const isSelected = routerFilter === router.id
            const isOffline = routerStatus?.id === router.id && !routerStatus.isOnline
            const routerCount = sessions.filter(s => s.router?.id === router.id).length
            return (
              <div
                key={router.id}
                onClick={() => setRouterFilter(isSelected ? '' : router.id)}
                className={`p-4 bg-card border rounded-2xl cursor-pointer transition-all hover:shadow-sm ${
                  isSelected ? 'border-primary ring-1 ring-primary bg-primary/5' : 'border-border'
                }`}
              >
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                  <span className="font-semibold truncate uppercase tracking-wider">{router.name}</span>
                  <div className="flex items-center gap-1">
                    {isOffline ? (
                      <span className="px-1.5 py-0.5 text-[9px] font-bold bg-destructive/10 text-destructive rounded">OFFLINE</span>
                    ) : (
                      <Server className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}
                  </div>
                </div>
                <div className="text-2xl font-bold text-foreground">
                  {isOffline ? '0' : (routerFilter === '' ? routerCount : (isSelected ? sessions.length : '-'))}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {isOffline ? 'Router tidak dapat diakses' : (isSelected ? 'Filter aktif (klik lepas)' : 'Klik untuk filter router')}
                </p>
              </div>
            )
          })}
        </div>

        {/* Router Offline Alert Banner */}
        {routerStatus && !routerStatus.isOnline && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-start gap-3 text-amber-600 dark:text-amber-400">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm">
                Router &quot;{routerStatus.name}&quot; Sedang Tidak Dapat Diakses / Offline
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {routerStatus.error || 'Koneksi ke port API MikroTik gagal. Pastikan Router menyala dan VPN Client terhubung.'}
              </p>
            </div>
          </div>
        )}

        {/* Active ONT Remote Sessions Widget */}
        {ontSessions.filter((s: any) => s.status === 'ACTIVE' && s.remainingSeconds > 0).length > 0 && (
          <div className="p-4 bg-primary/5 dark:bg-primary/10 border border-primary/30 rounded-2xl space-y-3 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-primary/20 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-primary/20 text-primary rounded-lg">
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    Sesi Remote Web GUI ONT Aktif
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 rounded-full border border-emerald-500/30">
                      {ontSessions.filter((s: any) => s.status === 'ACTIVE' && s.remainingSeconds > 0).length} Aktif
                    </span>
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Tunnel proxy VPS dan aturan NAT MikroTik sedang aktif untuk akses modem pelanggan di bawah ini.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCloseAllOntSessions}
                  disabled={closingAllOnt}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-destructive bg-destructive/10 hover:bg-destructive/20 border border-destructive/30 rounded-xl transition-all disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{closingAllOnt ? 'Menutup...' : 'Tutup Semua Sesi'}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {ontSessions
                .filter((s: any) => s.status === 'ACTIVE' && s.remainingSeconds > 0)
                .map((s: any) => {
                  const m = Math.floor(s.remainingSeconds / 60);
                  const sec = s.remainingSeconds % 60;
                  const timeFormatted = `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
                  const isClosingThis = closingOntId === s.id;

                  return (
                    <div
                      key={s.id}
                      className="p-3 bg-card border border-border rounded-xl flex flex-col justify-between gap-2.5 hover:border-primary/40 transition-all shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold text-xs text-foreground truncate">{s.customerName}</div>
                          <div className="text-[11px] font-mono text-muted-foreground truncate">{s.username}</div>
                        </div>
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-[11px] font-bold border border-emerald-500/20 shrink-0">
                          <Clock className="w-3 h-3 animate-pulse" />
                          {timeFormatted}
                        </div>
                      </div>

                      <div className="text-[11px] space-y-1 bg-muted/40 p-2 rounded-lg font-mono">
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span>Target ONT:</span>
                          <span className="font-semibold text-foreground">{s.targetIp}:{s.targetPort}</span>
                        </div>
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span>URL Akses:</span>
                          <span className="font-semibold text-primary underline truncate max-w-[170px]">{s.proxyUrl}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-border/50">
                        <button
                          onClick={() => handleCopyOntUrl(s.id, s.proxyUrl)}
                          className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium bg-muted hover:bg-muted/80 text-foreground rounded-lg transition-all"
                          title="Salin URL"
                        >
                          {copiedOntId === s.id ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedOntId === s.id ? 'Tersalin' : 'Salin'}</span>
                        </button>

                        <div className="flex items-center gap-1.5">
                          <a
                            href={`/admin/ont-viewer/${s.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg shadow-sm transition-all"
                            title="Buka Web GUI Modem via HTTPS Domain"
                          >
                            <Globe className="w-3.5 h-3.5" />
                            <span>Buka Web GUI</span>
                          </a>

                          <a
                            href={s.proxyUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium bg-muted hover:bg-muted/80 text-foreground rounded-lg transition-all"
                            title="Buka via Port Langsung IP:24000"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>Port 24000</span>
                          </a>

                          <button
                            onClick={() => handleCloseOntSession(s)}
                            disabled={isClosingThis}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 rounded-lg transition-all disabled:opacity-50"
                            title="Tutup Sesi & Hapus NAT"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>{isClosingThis ? '...' : 'Tutup'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Filters Toolbar */}
        <div className="p-3 bg-card border border-border rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Cari username, nama, IP, MAC..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-background border border-border rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-muted-foreground ml-1" />
              <select
                value={routerFilter}
                onChange={(e) => setRouterFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Semua Router ({routers.length})</option>
                {routers.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedSessions.size > 0 && (
            <button
              onClick={handleBulkDisconnect}
              disabled={disconnecting}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl text-xs font-semibold shadow-sm transition-all animate-in fade-in"
            >
              <Power className="w-3.5 h-3.5" />
              <span>Putuskan {selectedSessions.size} Sesi Terpilih</span>
            </button>
          )}
        </div>

        {/* Sessions Data Table */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          {/* Table Header Bar */}
          <div className="px-4 py-3 border-b border-border bg-muted/20 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span>Tampilkan</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="px-2 py-1 bg-background border border-border rounded-lg text-xs"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span>baris per halaman</span>
            </div>
            <div>
              Menampilkan {pagination.total === 0 ? 0 : (pagination.page - 1) * pageSize + 1} -{' '}
              {Math.min(pagination.page * pageSize, pagination.total)} dari {pagination.total} sesi
            </div>
          </div>

          {/* Desktop & Tablet Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  <th className="p-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={selectedSessions.size === sessions.length && sessions.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded border-border"
                    />
                  </th>
                  <th className="p-3">Pelanggan / Username</th>
                  <th className="p-3">Paket</th>
                  <th className="p-3">Router NAS</th>
                  <th className="p-3">IP Address (ONT)</th>
                  <th className="p-3">MAC Address</th>
                  <th className="p-3">Durasi Online</th>
                  <th className="p-3 text-right">Traffic (Up / Down)</th>
                  <th className="p-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sessions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-12 text-center text-muted-foreground">
                      {loading ? (
                        <div className="flex flex-col items-center gap-2">
                          <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                          <span>Memuat sesi PPPoE...</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1.5">
                          <Wifi className="w-8 h-8 text-muted-foreground/50 mb-1" />
                          <p className="font-semibold text-foreground">
                            {routerStatus && !routerStatus.isOnline
                              ? `Router "${routerStatus.name}" Offline`
                              : 'Tidak Ada Sesi PPPoE Aktif'}
                          </p>
                          <p className="text-[11px]">
                            {routerStatus && !routerStatus.isOnline
                              ? 'Tidak dapat mengambil sesi karena router sedang tidak dapat dijangkau.'
                              : 'Tidak ada koneksi yang cocok dengan filter saat ini.'}
                          </p>
                        </div>
                      )}
                    </td>
                  </tr>
                ) : (
                  sessions.map((session) => {
                    const isSelected = selectedSessions.has(session.sessionId) || selectedSessions.has(session.id)
                    const durationSec = liveDuration(session.startTime)
                    return (
                      <tr
                        key={session.id || session.sessionId}
                        className={`hover:bg-muted/40 transition-colors ${isSelected ? 'bg-primary/5' : ''}`}
                      >
                        {/* Checkbox */}
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => handleSelectSession(session.sessionId || session.id, e.target.checked)}
                            className="rounded border-border"
                          />
                        </td>

                        {/* Customer & Username */}
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                            <div>
                              <div className="font-mono font-bold text-foreground">
                                {session.username}
                              </div>
                              {session.user?.id ? (
                                <Link
                                  href={`/admin/pppoe/users/${session.user.id}`}
                                  className="text-[11px] text-primary hover:underline font-medium truncate max-w-[180px] block"
                                  title="Lihat Profil Detail Pelanggan"
                                >
                                  {session.user.name || session.username}
                                </Link>
                              ) : (
                                <div className="text-[11px] text-muted-foreground truncate max-w-[180px]">
                                  {session.user?.name || '-'}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Profile */}
                        <td className="p-3">
                          <span className="px-2 py-0.5 bg-muted border border-border rounded-lg text-[11px] font-medium text-foreground">
                            {session.user?.profile || 'PPPoE'}
                          </span>
                        </td>

                        {/* Router */}
                        <td className="p-3 text-muted-foreground">
                          {session.router?.name || '-'}
                        </td>

                        {/* Framed IP & ONT Remote Action */}
                        <td className="p-3">
                          <div className="flex items-center gap-1.5 font-mono text-[11px]">
                            <span className="font-semibold text-foreground">
                              {session.framedIpAddress || '-'}
                            </span>
                            {session.framedIpAddress && (
                              <button
                                onClick={() => handleCopyIp(session.framedIpAddress)}
                                className="p-0.5 text-muted-foreground hover:text-foreground"
                                title="Salin IP"
                              >
                                {copiedIp === session.framedIpAddress ? (
                                  <Check className="w-3 h-3 text-emerald-500" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            )}
                          </div>
                        </td>

                        {/* MAC Address */}
                        <td className="p-3 font-mono text-[11px] text-muted-foreground">
                          {session.macAddress || '-'}
                        </td>

                        {/* Duration */}
                        <td className="p-3">
                          <div className="flex items-center gap-1 text-primary font-medium">
                            <Clock className="w-3 h-3 shrink-0" />
                            <span>{formatDuration(durationSec)}</span>
                          </div>
                        </td>

                        {/* Traffic */}
                        <td className="p-3 text-right">
                          <div className="text-[11px] space-y-0.5">
                            <div className="text-emerald-600 dark:text-emerald-400 font-medium">
                              ↑ {session.uploadFormatted || '0 B'}
                            </div>
                            <div className="text-primary font-medium">
                              ↓ {session.downloadFormatted || '0 B'}
                            </div>
                          </div>
                        </td>

                        {/* Actions: ONT Remote & Disconnect */}
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => openOntModalForSession(session)}
                              className="p-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors"
                              title="Buka Web GUI Modem ONT"
                            >
                              <Globe className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleDisconnect([session.sessionId || session.id], [session.username])}
                              disabled={disconnecting}
                              className="p-1.5 bg-destructive/10 hover:bg-destructive/20 text-destructive rounded-lg transition-colors disabled:opacity-50"
                              title="Putuskan Sesi di MikroTik"
                            >
                              <Power className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {pagination.totalPages > 1 && (
            <div className="px-4 py-3 border-t border-border bg-muted/20 flex items-center justify-between text-xs">
              <div className="text-muted-foreground">
                Halaman {pagination.page} dari {pagination.totalPages}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => fetchSessions(1)}
                  disabled={pagination.page === 1}
                  className="px-2.5 py-1 border border-border rounded-lg text-foreground hover:bg-muted disabled:opacity-40"
                >
                  Awal
                </button>
                <button
                  onClick={() => fetchSessions(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="px-2.5 py-1 border border-border rounded-lg text-foreground hover:bg-muted disabled:opacity-40"
                >
                  Sebelumnya
                </button>
                <span className="px-2.5 py-1 bg-primary text-primary-foreground font-semibold rounded-lg">
                  {pagination.page}
                </span>
                <button
                  onClick={() => fetchSessions(pagination.page + 1)}
                  disabled={pagination.page === pagination.totalPages}
                  className="px-2.5 py-1 border border-border rounded-lg text-foreground hover:bg-muted disabled:opacity-40"
                >
                  Selanjutnya
                </button>
                <button
                  onClick={() => fetchSessions(pagination.totalPages)}
                  disabled={pagination.page === pagination.totalPages}
                  className="px-2.5 py-1 border border-border rounded-lg text-foreground hover:bg-muted disabled:opacity-40"
                >
                  Akhir
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
