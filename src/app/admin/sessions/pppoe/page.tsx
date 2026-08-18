'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  Power,
  RefreshCw,
  Wifi,
  Search,
  Download,
  RotateCcw,
  ArrowUpDown,
  Router as RouterIcon,
  CheckCircle2,
  User,
  Globe,
  ExternalLink,
  Clock,
  Activity,
  Server,
  XCircle,
  MessageSquare,
  Shield,
  Zap,
} from 'lucide-react'
import { useToast } from '@/components/cyberpunk/CyberToast'
import { useTranslation } from '@/hooks/useTranslation'
import { formatWIB } from '@/lib/timezone'
import { cn } from '@/lib/utils'
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
  upload?: number
  download?: number
  durationFormatted: string
  uploadFormatted: string
  downloadFormatted: string
  totalFormatted: string
  router: { id: string; name: string } | null
  user: {
    id: string
    customerId: string
    name: string
    phone: string
    profile: string
    area?: { id: string; name: string } | null
  } | null
}

interface OntSession {
  id: string
  customerId: string | null
  customerName: string | null
  username: string | null
  routerName: string | null
  targetIp: string
  targetPort: number
  proxyPort: number
  proxyUrl: string
  status: string
  expiresAt: string
  createdAt: string
  remainingSeconds: number
  isExpired: boolean
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
  totalUploadFormatted: string
  totalDownloadFormatted: string
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
  const [routers, setRouters] = useState<Router[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set())
  const [disconnecting, setDisconnecting] = useState(false)
  const [routerFilter, setRouterFilter] = useState<string>('')
  const [searchFilter, setSearchFilter] = useState<string>('')
  const [pagination, setPagination] = useState<Pagination>({ total: 0, page: 1, limit: 25, totalPages: 1 })
  const [pageSize, setPageSize] = useState<number>(25)
  const [now, setNow] = useState(() => Date.now())
  const [fetchedAt, setFetchedAt] = useState(() => Date.now())
  const [syncing, setSyncing] = useState(false)

  // ONT Remote Sessions state
  const [ontSessions, setOntSessions] = useState<OntSession[]>([])
  const [showOntRemotePanel, setShowOntRemotePanel] = useState(false)
  const [remoteModalTarget, setRemoteModalTarget] = useState<{
    isOpen: boolean
    customerName?: string
    username?: string
    targetIp?: string
    routerName?: string
  }>({ isOpen: false })

  const [routerStatuses, setRouterStatuses] = useState<any[]>([])
  const [sourceUsed, setSourceUsed] = useState<string>('database')

  // Sorting state
  const [sortField, setSortField] = useState<string>('startTime')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  // 1-second ticker for live uptime counter & ONT countdowns
  useEffect(() => {
    const ticker = setInterval(() => {
      setNow(Date.now())
      setOntSessions((prev) =>
        prev.map((s) => {
          if (s.status !== 'ACTIVE') return s
          const nextRemaining = Math.max(0, s.remainingSeconds - 1)
          return {
            ...s,
            remainingSeconds: nextRemaining,
            status: nextRemaining <= 0 ? 'EXPIRED' : s.status,
            isExpired: nextRemaining <= 0,
          }
        })
      )
    }, 1000)
    return () => clearInterval(ticker)
  }, [])

  const liveDuration = (serverDuration: number) => {
    const elapsed = Math.floor((now - fetchedAt) / 1000)
    return serverDuration + elapsed
  }

  const fetchOntSessions = async () => {
    try {
      const res = await fetch('/api/network/ont-remote')
      const data = await res.json()
      if (data.sessions) {
        setOntSessions(data.sessions)
      }
    } catch {
      /* ignore */
    }
  }

  const fetchSessions = useCallback(
    async (page: number = 1, isForceApi: boolean = false) => {
      try {
        setLoading(true)
        const params = new URLSearchParams()
        params.set('type', 'pppoe')
        params.set('page', page.toString())
        params.set('limit', pageSize.toString())
        if (isForceApi) params.set('forceApi', 'true')
        if (routerFilter) params.set('routerId', routerFilter)
        if (searchFilter) params.set('search', searchFilter)

        const res = await fetch(`/api/sessions/realtime?${params}`)
        const data = await res.json()

        if (data.success) {
          setSessions(data.sessions || [])
          setStats(data.stats || null)
          if (data.routers) setRouters(data.routers)
          if (data.routerStatuses) setRouterStatuses(data.routerStatuses)
          if (data.source) setSourceUsed(data.source)
          setPagination(
            data.pagination || {
              total: data.sessions?.length || 0,
              page,
              limit: pageSize,
              totalPages: Math.ceil((data.sessions?.length || 0) / pageSize) || 1,
            }
          )
          setFetchedAt(Date.now())
        }
      } catch (err) {
        console.error('Fetch PPPoE sessions error:', err)
        addToast({ type: 'error', title: t('common.error'), description: 'Gagal memuat sesi PPPoE' })
      } finally {
        setLoading(false)
      }
    },
    [routerFilter, searchFilter, pageSize, addToast, t]
  )

  useEffect(() => {
    fetchSessions(1)
    fetchOntSessions()
  }, [fetchSessions])

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const sortedSessions = useMemo(() => {
    return [...sessions].sort((a, b) => {
      let aVal: any = a[sortField as keyof Session]
      let bVal: any = b[sortField as keyof Session]

      if (sortField === 'name') {
        aVal = a.user?.name || a.username
        bVal = b.user?.name || b.username
      } else if (sortField === 'customerId') {
        aVal = a.user?.customerId || ''
        bVal = b.user?.customerId || ''
      } else if (sortField === 'ip') {
        aVal = a.framedIpAddress || ''
        bVal = b.framedIpAddress || ''
      } else if (sortField === 'mac') {
        aVal = a.macAddress || ''
        bVal = b.macAddress || ''
      } else if (sortField === 'router') {
        aVal = a.router?.name || ''
        bVal = b.router?.name || ''
      }

      if (aVal === bVal) return 0
      if (aVal === null || aVal === undefined) return 1
      if (bVal === null || bVal === undefined) return -1

      const cmp = aVal < bVal ? -1 : 1
      return sortDirection === 'asc' ? cmp : -cmp
    })
  }, [sessions, sortField, sortDirection])

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedSessions(new Set(sortedSessions.map((s) => s.sessionId)))
    } else {
      setSelectedSessions(new Set())
    }
  }

  const handleSelectSession = (sessionId: string, checked: boolean) => {
    setSelectedSessions((prev) => {
      const next = new Set(prev)
      if (checked) next.add(sessionId)
      else next.delete(sessionId)
      return next
    })
  }

  const handleDisconnect = async (sessionIds: string[]) => {
    if (sessionIds.length === 0) return

    if (
      !(await confirm({
        title: t('sessions.kickUser'),
        message: t('sessions.disconnectPppoeConfirm').replace('{count}', String(sessionIds.length)),
        confirmText: t('sessions.yesKick'),
        cancelText: t('common.cancel'),
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
        const count =
          data.summary?.successful ??
          data.disconnected ??
          data.results?.filter((r: any) => r.success).length ??
          sessionIds.length
        addToast({
          type: 'success',
          title: t('common.success'),
          description: t('sessions.sessionsDisconnected').replace('{count}', String(count)),
        })
        setSelectedSessions(new Set())
        fetchSessions(pagination.page)
      } else {
        addToast({
          type: 'error',
          title: t('common.error'),
          description: data.error || t('sessions.failedDisconnect'),
        })
      }
    } catch {
      addToast({
        type: 'error',
        title: t('common.error'),
        description: t('sessions.failedDisconnectSession'),
      })
    } finally {
      setDisconnecting(false)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/sessions/sync?type=pppoe', { method: 'POST' })
      const data = await res.json()
      await fetchSessions(1)

      if (data.results?.pppoe?.success === false) {
        const errorResult = data.results.pppoe.results?.find((r: any) => !r.success)
        const errMsg = errorResult ? errorResult.error : 'Connection failed'
        addToast({
          type: 'error',
          title: t('common.error'),
          description: `Gagal terhubung ke MikroTik: ${errMsg}`,
        })
      } else {
        addToast({
          type: 'success',
          title: t('common.success'),
          description: t('sessions.syncComplete'),
        })
      }
    } catch {
      addToast({ type: 'error', title: t('common.error'), description: t('sessions.syncFailed') })
    } finally {
      setSyncing(false)
    }
  }

  const handleCloseOntSession = async (id: string) => {
    try {
      const res = await fetch(`/api/network/ont-remote?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        addToast({ type: 'success', title: 'Berhasil', description: 'Sesi remote ONT ditutup' })
        fetchOntSessions()
      }
    } catch {
      /* ignore */
    }
  }

  const handleExportExcel = async () => {
    try {
      const params = new URLSearchParams()
      params.set('type', 'pppoe')
      if (routerFilter) params.set('routerId', routerFilter)
      if (searchFilter) params.set('username', searchFilter)
      const res = await fetch(`/api/sessions/export?${params}`)
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Sessions-PPPoE-${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch {
      addToast({ type: 'error', title: 'Error', description: t('sessions.exportFailed') })
    }
  }

  const formatDateTime = (dtStr: string) => {
    if (!dtStr) return '-'
    try {
      return formatWIB(new Date(dtStr), 'dd/MM/yyyy HH:mm:ss')
    } catch {
      return dtStr
    }
  }

  const formatUptime = (seconds: number) => {
    if (seconds <= 0) return '0d 00:00:00'
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    const pad = (n: number) => n.toString().padStart(2, '0')
    if (days > 0) return `${days}d ${pad(hours)}:${pad(mins)}:${pad(secs)}`
    return `${pad(hours)}:${pad(mins)}:${pad(secs)}`
  }

  const formatOntTime = (totalSec: number) => {
    if (totalSec <= 0) return '00:00'
    const mins = Math.floor(totalSec / 60)
    const secs = totalSec % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const activeOntCount = ontSessions.filter((s) => s.status === 'ACTIVE' && s.remainingSeconds > 0).length

  const SortHeader = ({ label, field }: { label: string; field: string }) => (
    <th
      onClick={() => handleSort(field)}
      className="px-3.5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground select-none group"
    >
      <div className="flex items-center gap-1.5">
        <span>{label}</span>
        <ArrowUpDown
          className={cn(
            'w-3.5 h-3.5 transition-colors',
            sortField === field ? 'text-primary opacity-100 font-bold' : 'opacity-40 group-hover:opacity-100'
          )}
        />
      </div>
    </th>
  )

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* SaaS Standard Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card border border-border rounded-2xl p-6 shadow-sm">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-primary/10 text-primary text-xs font-semibold rounded-full uppercase tracking-wider">
            <Wifi className="w-3.5 h-3.5" />
            Monitoring Sesi PPPoE
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Sesi PPPoE Online &amp; Remote Web ONT
          </h1>
          <p className="text-xs text-muted-foreground">
            Pantau sesi aktif realtime, remote Web ONT 1-klik tanpa VPN, dan kelola koneksi pelanggan.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowOntRemotePanel((prev) => !prev)}
            className={cn(
              'px-3.5 py-2 text-xs font-semibold rounded-xl flex items-center gap-1.5 border transition-all shadow-sm',
              showOntRemotePanel || activeOntCount > 0
                ? 'bg-cyan-500/10 text-cyan-500 border-cyan-500/30 font-bold'
                : 'bg-background hover:bg-muted text-muted-foreground border-border'
            )}
          >
            <Globe className="w-4 h-4" />
            <span>Sesi Remote ONT</span>
            {activeOntCount > 0 && (
              <span className="px-1.5 py-0.5 bg-cyan-500 text-black text-[10px] font-bold rounded-full">
                {activeOntCount}
              </span>
            )}
          </button>

          <button
            onClick={handleExportExcel}
            className="px-3.5 py-2 text-xs font-semibold bg-background hover:bg-muted text-foreground rounded-xl flex items-center gap-1.5 border border-border transition-colors shadow-sm"
          >
            <Download className="w-4 h-4 text-primary" />
            Export Excel
          </button>

          <button
            onClick={() => fetchSessions(1, true)}
            disabled={loading}
            className="px-3.5 py-2 text-xs font-semibold bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-xl flex items-center gap-1.5 border border-emerald-500/30 disabled:opacity-50 transition-colors shadow-sm"
            title="Tarik Data Sesi Langsung Dari RouterOS API MikroTik (Live On-Demand)"
          >
            <Zap className={`w-4 h-4 text-emerald-400 ${loading ? 'animate-spin' : ''}`} />
            Pull RouterOS API Live
          </button>

          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-3.5 py-2 text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 rounded-xl flex items-center gap-1.5 border border-primary/20 disabled:opacity-50 transition-colors shadow-sm"
          >
            <RotateCcw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Sesi Real-Time'}
          </button>
        </div>
      </div>

      {/* Router API Login Health Bar */}
      {routerStatuses.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-3 bg-card border border-border rounded-xl text-xs">
          <span className="font-semibold text-muted-foreground flex items-center gap-1">
            <Server className="w-3.5 h-3.5 text-primary" /> Status Login RouterOS API:
          </span>
          {routerStatuses.map((r: any) => (
            <span
              key={r.id}
              className={cn(
                'px-2.5 py-1 rounded-lg border text-[11px] font-mono font-medium flex items-center gap-1.5',
                r.status === 'ONLINE'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
              )}
              title={r.error || `Connected to ${r.ip}:${r.port}`}
            >
              <span
                className={cn('w-2 h-2 rounded-full', r.status === 'ONLINE' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500')}
              />
              {r.name} ({r.ip}:{r.port}) — {r.status === 'ONLINE' ? `${r.count} Sesi` : `Offline (${r.error || 'Err'})`}
            </span>
          ))}
        </div>
      )}

      {/* Summary Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-card border border-border rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total Sesi PPPoE Online
            </span>
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-emerald-500 mt-2">{stats?.pppoe || 0} Koneksi</p>
        </div>

        <div
          onClick={() => setShowOntRemotePanel((prev) => !prev)}
          className="cursor-pointer p-4 bg-card border border-border hover:border-cyan-500/40 rounded-2xl shadow-sm transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-cyan-500">
              Sesi Remote ONT (10m)
            </span>
            <Globe className="w-5 h-5 text-cyan-500" />
          </div>
          <p className="text-2xl font-bold text-cyan-500 mt-2">{activeOntCount} Aktif</p>
        </div>

        <div className="p-4 bg-card border border-border rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total Bandwidth (TX/RX)
            </span>
            <Activity className="w-5 h-5 text-primary" />
          </div>
          <p className="text-xl font-bold text-foreground mt-2 font-mono">
            {stats?.totalBandwidthFormatted || '0 B'}
          </p>
        </div>

        <div className="p-4 bg-card border border-border rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Router Site Terdaftar
            </span>
            <Server className="w-5 h-5 text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold text-foreground mt-2">{routers.length} Site</p>
        </div>
      </div>

      {/* Active ONT Remote Sessions Panel (Collapsible / Dynamic) */}
      {(showOntRemotePanel || activeOntCount > 0) && (
        <div className="bg-card border border-cyan-500/30 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-cyan-400" />
              <h2 className="text-base font-semibold text-foreground">
                Sesi Remote Web ONT Aktif (Gaya Nottik Temporary Reverse Proxy)
              </h2>
            </div>
            <button
              onClick={() => setShowOntRemotePanel(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Tutup Panel
            </button>
          </div>

          {ontSessions.filter((s) => s.status === 'ACTIVE' && s.remainingSeconds > 0).length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-2">
              Belum ada sesi remote ONT yang aktif saat ini. Klik tombol Remote ONT pada baris pelanggan di bawah untuk membuka sesi baru!
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/40 font-semibold uppercase text-muted-foreground">
                    <th className="py-2.5 px-3">Pelanggan</th>
                    <th className="py-2.5 px-3">Site</th>
                    <th className="py-2.5 px-3">IP ONT</th>
                    <th className="py-2.5 px-3">Port</th>
                    <th className="py-2.5 px-3">URL Akses Temporary</th>
                    <th className="py-2.5 px-3">Sisa Waktu</th>
                    <th className="py-2.5 px-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {ontSessions
                    .filter((s) => s.status === 'ACTIVE' && s.remainingSeconds > 0)
                    .map((s) => (
                      <tr key={s.id} className="hover:bg-muted/30">
                        <td className="py-2.5 px-3 font-semibold text-foreground">
                          {s.customerName || s.username}
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground">{s.routerName || 'Router'}</td>
                        <td className="py-2.5 px-3 font-mono">{s.targetIp}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-cyan-400">{s.targetPort}</td>
                        <td className="py-2.5 px-3 font-mono">
                          <a
                            href={s.proxyUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-cyan-400 hover:underline font-semibold"
                          >
                            {s.proxyUrl}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-emerald-400 font-bold">
                          {formatOntTime(s.remainingSeconds)}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <a
                              href={s.proxyUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded text-[11px] font-semibold inline-flex items-center gap-1"
                            >
                              <ExternalLink className="w-3 h-3" /> Buka
                            </a>
                            <button
                              onClick={() => handleCloseOntSession(s.id)}
                              className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded text-[11px] font-semibold"
                            >
                              Tutup
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Control Bar: Filters & Search */}
      <div className="bg-card border border-border rounded-2xl p-4 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Router Site Filter */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <RouterIcon className="w-4 h-4 text-primary shrink-0" />
            <select
              value={routerFilter}
              onChange={(e) => {
                setRouterFilter(e.target.value)
                fetchSessions(1)
              }}
              className="w-full sm:w-60 p-2.5 bg-background border border-input rounded-xl text-xs font-semibold text-foreground focus:ring-2 focus:ring-primary outline-none"
            >
              <option value="">-- Semua Router Site --</option>
              {routers.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Cari nama, user, IP, MAC..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-background border border-input rounded-xl text-xs font-mono focus:ring-2 focus:ring-primary outline-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground self-end md:self-center">
          <span>Tampilkan</span>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="px-2.5 py-1 bg-background border border-input rounded-lg text-xs font-bold text-foreground focus:ring-2 focus:ring-primary outline-none"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span>data per halaman</span>
        </div>
      </div>

      {/* Main PPPoE Active Sessions Data Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-muted/60 border-b border-border">
              <tr>
                <th className="px-3.5 py-3 text-left w-10">
                  <input
                    type="checkbox"
                    checked={selectedSessions.size === sortedSessions.length && sortedSessions.length > 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-border w-3.5 h-3.5"
                  />
                </th>
                <SortHeader label="ID Pelanggan" field="customerId" />
                <SortHeader label="Nama Pelanggan" field="name" />
                <SortHeader label="Waktu Terhubung" field="startTime" />
                <SortHeader label="Uptime Live" field="duration" />
                <SortHeader label="Upload (TX)" field="upload" />
                <SortHeader label="Download (RX)" field="download" />
                <SortHeader label="Router Site" field="router" />
                <SortHeader label="IP Address" field="ip" />
                <SortHeader label="MAC Address" field="mac" />
                <th className="px-3.5 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Aksi Cepat
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-border">
              {loading && sortedSessions.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-3 py-12 text-center text-muted-foreground">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-primary mb-2" />
                    Memuat data sesi PPPoE real-time...
                  </td>
                </tr>
              ) : sortedSessions.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-3 py-12 text-center text-muted-foreground">
                    <Wifi className="w-8 h-8 mx-auto opacity-40 mb-2" />
                    Tidak ada sesi PPPoE online yang sesuai filter.
                  </td>
                </tr>
              ) : (
                sortedSessions.map((session) => (
                  <tr key={session.id} className="hover:bg-muted/40 transition-colors">
                    <td className="px-3.5 py-3">
                      <input
                        type="checkbox"
                        checked={selectedSessions.has(session.sessionId)}
                        onChange={(e) => handleSelectSession(session.sessionId, e.target.checked)}
                        className="rounded border-border w-3.5 h-3.5"
                      />
                    </td>

                    <td className="px-3.5 py-3 font-mono font-bold text-primary">
                      {session.user?.customerId || '-'}
                    </td>

                    <td className="px-3.5 py-3 font-bold text-foreground">
                      <div>{session.user?.name || session.username}</div>
                      <div className="text-[10px] text-muted-foreground font-mono font-normal">
                        @{session.username}
                      </div>
                    </td>

                    <td className="px-3.5 py-3 text-muted-foreground whitespace-nowrap">
                      {formatDateTime(session.startTime)}
                    </td>

                    <td className="px-3.5 py-3 font-mono font-bold text-emerald-500 whitespace-nowrap">
                      {formatUptime(liveDuration(session.duration))}
                    </td>

                    <td className="px-3.5 py-3 font-mono text-blue-500 whitespace-nowrap">
                      &uarr; {session.uploadFormatted}
                    </td>

                    <td className="px-3.5 py-3 font-mono text-purple-500 whitespace-nowrap">
                      &darr; {session.downloadFormatted}
                    </td>

                    <td className="px-3.5 py-3 whitespace-nowrap">
                      <span className="px-2.5 py-0.5 bg-muted text-foreground border border-border rounded-md text-[10px] font-mono font-medium uppercase">
                        {session.router?.name || 'Router'}
                      </span>
                    </td>

                    <td className="px-3.5 py-3 font-mono text-foreground whitespace-nowrap">
                      {session.framedIpAddress || '-'}
                    </td>

                    <td className="px-3.5 py-3 font-mono text-[10px] text-muted-foreground whitespace-nowrap">
                      {session.macAddress || '-'}
                    </td>

                    <td className="px-3.5 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* 1-Click Remote Web ONT (Nottik Mode) */}
                        <button
                          onClick={() =>
                            setRemoteModalTarget({
                              isOpen: true,
                              customerName: session.user?.name || session.username,
                              username: session.username,
                              targetIp: session.framedIpAddress,
                              routerName: session.router?.name || 'Router',
                            })
                          }
                          title="Remote Web ONT (Mode Nottik 10-Min Proxy)"
                          className="px-2.5 py-1 text-[11px] font-bold text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded-lg transition-colors inline-flex items-center gap-1 shrink-0 shadow-sm"
                        >
                          <Globe className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Remote ONT</span>
                        </button>

                        {/* Kick PPPoE Session */}
                        <button
                          onClick={() => handleDisconnect([session.sessionId])}
                          disabled={disconnecting}
                          title="Putuskan &amp; Tendang Sesi PPPoE"
                          className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>

                        {/* WhatsApp Direct Link */}
                        {session.user?.phone && (
                          <a
                            href={`https://wa.me/${session.user.phone.replace(/[^0-9]/g, '').replace(/^0/, '62')}`}
                            target="_blank"
                            rel="noreferrer"
                            title="Chat WhatsApp Pelanggan"
                            className="p-1.5 text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-colors"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </a>
                        )}

                        {/* User Profile Link */}
                        {session.user?.id && (
                          <a
                            href={`/admin/pppoe/users/${session.user.customerId || session.user.id}`}
                            title="Buka Profil Pelanggan"
                            className="p-1.5 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                          >
                            <User className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 bg-muted/20 text-xs">
          <div className="text-muted-foreground font-mono">
            Menampilkan <span className="font-bold text-foreground">{sortedSessions.length}</span> dari{' '}
            <span className="font-bold text-foreground">{pagination.total}</span> sesi PPPoE online
          </div>

          <div className="flex items-center gap-2 font-mono">
            <button
              onClick={() => fetchSessions(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="px-3 py-1.5 border border-border rounded-xl disabled:opacity-50 hover:bg-muted font-bold text-foreground transition-colors"
            >
              Sebelumnya
            </button>
            <span className="px-3 py-1.5 bg-primary text-primary-foreground font-bold rounded-xl">
              {pagination.page} / {pagination.totalPages || 1}
            </span>
            <button
              onClick={() => fetchSessions(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="px-3 py-1.5 border border-border rounded-xl disabled:opacity-50 hover:bg-muted font-bold text-foreground transition-colors"
            >
              Selanjutnya
            </button>
          </div>
        </div>
      </div>

      {/* 1-Click ONT Remote Proxy Modal */}
      <OntRemoteModal
        isOpen={remoteModalTarget.isOpen}
        onClose={() => {
          setRemoteModalTarget({ isOpen: false })
          fetchOntSessions()
        }}
        customerName={remoteModalTarget.customerName}
        username={remoteModalTarget.username}
        targetIp={remoteModalTarget.targetIp}
        routerName={remoteModalTarget.routerName}
      />
    </div>
  )
}
