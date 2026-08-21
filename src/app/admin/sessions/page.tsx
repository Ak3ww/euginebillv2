'use client'

import { useEffect, useState, useMemo } from 'react'
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
  CheckSquare,
  Square,
  AlertCircle,
  Copy,
  Check,
} from 'lucide-react'
import { useToast } from '@/components/cyberpunk/CyberToast'
import { useTranslation } from '@/hooks/useTranslation'
import { formatWIB, nowWIB, todayWIBStr } from '@/lib/timezone'
import OntRemoteModal from '@/components/admin/OntRemoteModal'

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
  user: { id: string; name: string; phone: string; profile: string } | null
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

export default function SessionsPage() {
  const { t } = useTranslation()
  const { addToast, confirm } = useToast()
  const [sessions, setSessions] = useState<Session[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [allTimeStats, setAllTimeStats] = useState<AllTimeStats | null>(null)
  const [routers, setRouters] = useState<Router[]>([])
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
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [copiedIp, setCopiedIp] = useState<string | null>(null)

  // ONT Remote Modal state
  const [ontModalOpen, setOntModalOpen] = useState(false)
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

  // 1-second ticker for live duration counter
  useEffect(() => {
    const ticker = setInterval(() => setNow(nowWIB().getTime()), 1000)
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
      params.set('type', 'pppoe') // Focus on PPPoE sessions
      if (isLive) params.set('live', 'true')
      if (routerFilter) params.set('routerId', routerFilter)
      if (searchFilter) params.set('search', searchFilter)

      const res = await fetch(`/api/sessions?${params}`)
      const data = await res.json()
      setSessions(data.sessions || [])
      setStats(data.stats)
      setAllTimeStats(data.allTimeStats)
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

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return formatWIB(dateStr, 'dd/MM/yyyy HH:mm')
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
  }, [])

  useEffect(() => {
    fetchSessions(1)
    if (!autoRefresh) return
    const interval = setInterval(() => {
      fetchSessions(currentPage, true)
    }, 10000)

    const onVisible = () => {
      if (!document.hidden) fetchSessions(currentPage, true)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routerFilter, searchFilter, pageSize, currentPage, autoRefresh])

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

  const handleDisconnect = async (sessionIds: string[]) => {
    if (
      !(await confirm({
        title: 'Putuskan Sesi PPPoE?',
        message: `Yakin ingin memutuskan koneksi ${sessionIds.length} sesi pelanggan terpilih?`,
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
        body: JSON.stringify({ sessionIds }),
      })

      const data = await res.json()
      if (data.success) {
        addToast({
          type: 'success',
          title: 'Berhasil',
          description: `Berhasil memutuskan ${data.summary?.successful || sessionIds.length} sesi.`,
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
    handleDisconnect(sessionIds)
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
                  <Server className="w-4 h-4 text-muted-foreground shrink-0" />
                </div>
                <div className="text-2xl font-bold text-foreground">
                  {isSelected ? sessions.length : '-'}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {isSelected ? 'Filter aktif (klik lepas)' : 'Klik untuk filter router'}
                </p>
              </div>
            )
          })}
        </div>

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

          {/* Bulk Disconnect Action */}
          {selectedSessions.size > 0 && (
            <button
              onClick={handleBulkDisconnect}
              disabled={disconnecting}
              className="w-full md:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-destructive text-destructive-foreground text-xs font-semibold rounded-xl hover:bg-destructive/90 transition-all disabled:opacity-50"
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
                          <p className="font-semibold text-foreground">Tidak Ada Sesi PPPoE Aktif</p>
                          <p className="text-[11px]">Tidak ada koneksi yang cocok dengan filter saat ini.</p>
                        </div>
                      )}
                    </td>
                  </tr>
                ) : (
                  sessions.map((session) => {
                    const isSelected = selectedSessions.has(session.sessionId)
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
                            onChange={(e) => handleSelectSession(session.sessionId, e.target.checked)}
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
                              <div className="text-[11px] text-muted-foreground truncate max-w-[180px]">
                                {session.user?.name || '-'}
                              </div>
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
                              onClick={() => handleDisconnect([session.sessionId])}
                              disabled={disconnecting}
                              className="p-1.5 bg-destructive/10 hover:bg-destructive/20 text-destructive rounded-lg transition-colors disabled:opacity-50"
                              title="Putuskan Sesi"
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
