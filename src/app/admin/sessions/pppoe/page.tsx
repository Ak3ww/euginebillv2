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
  Zap,
  Filter,
  Layers,
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

interface RouterOption {
  id: string
  name: string
}

export default function PPPoESessionsPage() {
  const { t } = useTranslation()
  const { addToast, confirm } = useToast()

  const [sessions, setSessions] = useState<Session[]>([])
  const [stats, setStats] = useState<any>(null)
  const [routers, setRouters] = useState<RouterOption[]>([])
  const [loading, setLoading] = useState(true)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [routerFilter, setRouterFilter] = useState<string>('')
  const [searchFilter, setSearchFilter] = useState<string>('')
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards')
  const [now, setNow] = useState(() => Date.now())
  const [fetchedAt, setFetchedAt] = useState(() => Date.now())

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

  // 1-second ticker for live uptime & ONT countdowns
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

  const fetchRouters = async () => {
    try {
      const res = await fetch('/api/network/routers')
      const data = await res.json()
      const list = data.routers || data.data || []
      if (Array.isArray(list) && list.length > 0) {
        setRouters(list.map((r: any) => ({ id: r.id, name: r.name })))
      }
    } catch {
      /* ignore */
    }
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
    async (isForceApi: boolean = false) => {
      try {
        setLoading(true)
        const params = new URLSearchParams()
        params.set('type', 'pppoe')
        params.set('limit', '500')
        if (isForceApi) params.set('forceApi', 'true')
        if (routerFilter) params.set('routerId', routerFilter)
        if (searchFilter) params.set('search', searchFilter)

        const res = await fetch(`/api/sessions/realtime?${params}`)
        const data = await res.json()

        if (data.success) {
          setSessions(data.sessions || [])
          setStats(data.stats || null)
          if (data.routers && data.routers.length > 0) setRouters(data.routers)
          setFetchedAt(Date.now())
        }
      } catch (err) {
        console.error('Fetch PPPoE sessions error:', err)
        addToast({ type: 'error', title: t('common.error'), description: 'Gagal memuat sesi PPPoE' })
      } finally {
        setLoading(false)
      }
    },
    [routerFilter, searchFilter, addToast, t]
  )

  useEffect(() => {
    fetchSessions(false)
    fetchOntSessions()
    fetchRouters()

    // Auto-open modal if URL query params present (e.g. from ACS redirect)
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search)
      const username = sp.get('username')
      if (username) {
        setRemoteModalTarget({
          isOpen: true,
          username,
          customerName: username,
        })
      }
    }
  }, [fetchSessions])

  const handleDisconnect = async (sessionId: string, username: string) => {
    if (
      !(await confirm({
        title: 'Putuskan Sesi PPPoE',
        message: `Apakah Anda yakin ingin memutuskan dan menendang sesi PPPoE untuk user "${username}"?`,
        confirmText: 'Ya, Tendang Sesi',
        cancelText: 'Batal',
        variant: 'danger',
      }))
    )
      return

    setDisconnecting(sessionId)
    try {
      const res = await fetch('/api/sessions/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionIds: [sessionId] }),
      })
      const data = await res.json()
      if (data.success) {
        addToast({
          type: 'success',
          title: t('common.success'),
          description: `Sesi PPPoE ${username} berhasil diputuskan`,
        })
        fetchSessions(false)
      } else {
        addToast({
          type: 'error',
          title: t('common.error'),
          description: data.error || 'Gagal memutuskan sesi',
        })
      }
    } catch {
      addToast({
        type: 'error',
        title: t('common.error'),
        description: 'Gagal menghubungi server',
      })
    } finally {
      setDisconnecting(null)
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

  const formatUptime = (seconds: number) => {
    if (seconds <= 0) return '00:00:00'
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

  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      if (routerFilter && s.router?.id !== routerFilter) return false
      if (searchFilter) {
        const q = searchFilter.toLowerCase()
        const matchName = s.user?.name?.toLowerCase().includes(q)
        const matchUser = s.username.toLowerCase().includes(q)
        const matchIp = s.framedIpAddress?.toLowerCase().includes(q)
        const matchCustId = s.user?.customerId?.toLowerCase().includes(q)
        if (!matchName && !matchUser && !matchIp && !matchCustId) return false
      }
      return true
    })
  }, [sessions, routerFilter, searchFilter])

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* SaaS Standard Top Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card border border-border rounded-2xl p-6 shadow-sm">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-primary/10 text-primary text-xs font-semibold rounded-full uppercase tracking-wider">
            <Wifi className="w-3.5 h-3.5" />
            Pusat Sesi PPPoE &amp; Remote Web ONT
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Sesi PPPoE Online &amp; Remote ONT 1-Klik
          </h1>
          <p className="text-xs text-muted-foreground">
            Kelola sesi aktif pelanggan, pantau uptime live, dan buka Web Interface ONT modem 1-klik tanpa alur berbelit.
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
            <Globe className="w-4 h-4 text-cyan-400" />
            <span>Sesi Remote Active</span>
            {activeOntCount > 0 && (
              <span className="px-2 py-0.5 bg-cyan-500 text-black text-[10px] font-bold rounded-full">
                {activeOntCount}
              </span>
            )}
          </button>

          <button
            onClick={() => fetchSessions(true)}
            disabled={loading}
            className="px-3.5 py-2 text-xs font-semibold bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-xl flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50"
            title="Tarik Data Sesi Langsung Dari RouterOS API MikroTik"
          >
            <Zap className={`w-4 h-4 text-emerald-400 ${loading ? 'animate-spin' : ''}`} />
            Pull Live API
          </button>

          <button
            onClick={handleExportExcel}
            className="px-3.5 py-2 text-xs font-semibold bg-background hover:bg-muted text-foreground rounded-xl flex items-center gap-1.5 border border-border transition-colors shadow-sm"
          >
            <Download className="w-4 h-4 text-primary" />
            Export Excel
          </button>
        </div>
      </div>

      {/* Summary Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-card border border-border rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total Sesi PPPoE Online
            </span>
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-emerald-500 mt-2">{stats?.pppoe || filteredSessions.length} Koneksi</p>
        </div>

        <div
          onClick={() => setShowOntRemotePanel((prev) => !prev)}
          className="cursor-pointer p-4 bg-card border border-border hover:border-cyan-500/40 rounded-2xl shadow-sm transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-cyan-500">
              Sesi Remote ONT Aktif
            </span>
            <Globe className="w-5 h-5 text-cyan-500" />
          </div>
          <p className="text-2xl font-bold text-cyan-500 mt-2">{activeOntCount} Sesi Terbuka</p>
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

      {/* Active Remote ONT Proxies Panel */}
      {(showOntRemotePanel || activeOntCount > 0) && (
        <div className="bg-card border border-cyan-500/30 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-cyan-400" />
              <h2 className="text-base font-semibold text-foreground">
                Sesi Remote Web ONT Aktif (10-Menit Reverse Proxy)
              </h2>
            </div>
            <button
              onClick={() => setShowOntRemotePanel(false)}
              className="text-xs text-muted-foreground hover:text-foreground font-semibold"
            >
              Tutup Panel
            </button>
          </div>

          {ontSessions.filter((s) => s.status === 'ACTIVE' && s.remainingSeconds > 0).length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-2">
              Belum ada sesi remote ONT yang aktif saat ini. Klik tombol Remote Web ONT pada card pelanggan di bawah untuk membuka sesi baru!
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {ontSessions
                .filter((s) => s.status === 'ACTIVE' && s.remainingSeconds > 0)
                .map((s) => (
                  <div key={s.id} className="p-3.5 bg-background border border-cyan-500/30 rounded-xl space-y-2.5">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-sm text-foreground">{s.customerName || s.username}</div>
                        <div className="text-[11px] text-muted-foreground font-mono">Site: {s.routerName || 'Router'}</div>
                      </div>
                      <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded text-[11px] font-mono font-bold">
                        {formatOntTime(s.remainingSeconds)}
                      </span>
                    </div>

                    <div className="text-xs font-mono text-cyan-400 break-all bg-muted/40 p-2 rounded-lg border border-border">
                      <a href={s.proxyUrl} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center justify-between">
                        <span>{s.proxyUrl}</span>
                        <ExternalLink className="w-3.5 h-3.5 shrink-0 ml-1" />
                      </a>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <a
                        href={s.proxyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> Buka Web ONT
                      </a>
                      <button
                        onClick={() => handleCloseOntSession(s.id)}
                        className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg text-xs font-bold transition-colors"
                      >
                        Tutup
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Control Bar: Filters & Search */}
      <div className="bg-card border border-border rounded-2xl p-4 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Router Filter */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <RouterIcon className="w-4 h-4 text-primary shrink-0" />
            <select
              value={routerFilter}
              onChange={(e) => setRouterFilter(e.target.value)}
              className="w-full sm:w-56 p-2.5 bg-background border border-input rounded-xl text-xs font-semibold text-foreground focus:ring-2 focus:ring-primary outline-none"
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
              placeholder="Cari nama, username, IP..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-background border border-input rounded-xl text-xs font-mono focus:ring-2 focus:ring-primary outline-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <span>Menampilkan <strong className="text-foreground">{filteredSessions.length}</strong> pelanggan online</span>
        </div>
      </div>

      {/* Grid of Clean SaaS Session Cards */}
      {loading && filteredSessions.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center text-muted-foreground">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-primary mb-3" />
          <p className="text-sm font-semibold">Memuat sesi PPPoE aktif...</p>
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center text-muted-foreground space-y-2">
          <Wifi className="w-10 h-10 mx-auto opacity-40 mb-2" />
          <p className="text-sm font-semibold">Tidak ada sesi PPPoE yang sesuai pencarian atau filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSessions.map((session) => (
            <div
              key={session.id}
              className="bg-card border border-border hover:border-primary/40 rounded-2xl p-5 shadow-sm space-y-4 transition-all flex flex-col justify-between"
            >
              {/* Card Header: Customer Name & ID */}
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono font-bold text-primary">
                    {session.user?.customerId || session.id.slice(0, 8)}
                  </span>
                  <span className="px-2.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full text-[10px] font-mono font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    ONLINE
                  </span>
                </div>
                <h3 className="text-base font-bold text-foreground tracking-tight">
                  {session.user?.name || session.username}
                </h3>
                <div className="text-xs text-muted-foreground font-mono flex items-center gap-2">
                  <span>{session.username}</span>
                  {session.user?.profile && <span>• Paket: {session.user.profile}</span>}
                </div>
              </div>

              {/* Session Network Metrics Box */}
              <div className="p-3 bg-muted/40 border border-border rounded-xl space-y-2 text-xs font-mono">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">IP Address:</span>
                  <span className="font-bold text-foreground">{session.framedIpAddress || '-'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Router Site:</span>
                  <span className="font-bold text-foreground">{session.router?.name || 'Router'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Live Uptime:</span>
                  <span className="font-bold text-emerald-400">{formatUptime(liveDuration(session.duration))}</span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-border/60 text-[11px]">
                  <span className="text-blue-400">&uarr; {session.uploadFormatted}</span>
                  <span className="text-purple-400">&darr; {session.downloadFormatted}</span>
                </div>
              </div>

              {/* Action Buttons Row */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
                {/* 1-Click Remote Web ONT Button */}
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
                  className="px-3 py-2 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 border border-cyan-500/30 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                  title="Buka Remote Web ONT Proxy (Mode Nottik 10-Min)"
                >
                  <Globe className="w-3.5 h-3.5 text-cyan-400" />
                  Remote Web ONT
                </button>

                {/* Tendang Sesi Button */}
                <button
                  onClick={() => handleDisconnect(session.sessionId, session.username)}
                  disabled={disconnecting === session.sessionId}
                  className="px-3 py-2 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm disabled:opacity-50"
                  title="Putuskan dan tendang sesi PPPoE pelanggan"
                >
                  <Power className="w-3.5 h-3.5 text-rose-500" />
                  {disconnecting === session.sessionId ? 'Tendang...' : 'Tendang Sesi'}
                </button>

                {/* WhatsApp Chat Button */}
                {session.user?.phone ? (
                  <a
                    href={`https://wa.me/${session.user.phone.replace(/[^0-9]/g, '').replace(/^0/, '62')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                    WA Pelanggan
                  </a>
                ) : (
                  <div />
                )}

                {/* View Profile Link */}
                {session.user?.id ? (
                  <a
                    href={`/admin/pppoe/users/${session.user.customerId || session.user.id}`}
                    className="px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                  >
                    <User className="w-3.5 h-3.5 text-primary" />
                    Profil
                  </a>
                ) : (
                  <div />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

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
