'use client'

import { useState, useEffect } from 'react'
import {
  Globe,
  Search,
  ExternalLink,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Play,
  RotateCw,
  Router as RouterIcon,
  User,
  Shield,
  SquareCode,
  Zap,
} from 'lucide-react'
import { showSuccess, showError, showConfirm } from '@/lib/sweetalert'

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
  status: string // ACTIVE, EXPIRED, CLOSED
  expiresAt: string
  createdAt: string
  remainingSeconds: number
  isExpired: boolean
}

export default function OntRemotePage() {
  const [sessions, setSessions] = useState<OntSession[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')

  // Quick remote form state
  const [quickForm, setQuickForm] = useState({
    usernameOrIp: '',
    targetPort: '80',
    routerName: 'Cibinong',
  })
  const [launching, setLaunching] = useState(false)

  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/network/ont-remote')
      const data = await res.json()
      if (data.sessions) {
        setSessions(data.sessions)
      }
    } catch (err) {
      console.error('Failed to load ONT sessions:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSessions()

    // Interval to refresh sessions & countdown
    const interval = setInterval(() => {
      setSessions((prev) =>
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

    return () => clearInterval(interval)
  }, [])

  const handleLaunchQuickRemote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!quickForm.usernameOrIp.trim()) {
      showError('Masukkan Username PPPoE atau IP ONT target')
      return
    }

    setLaunching(true)
    try {
      const isIp = quickForm.usernameOrIp.match(/^\d+\.\d+\.\d+\.\d+$/)
      const payload = {
        ...(isIp ? { targetIp: quickForm.usernameOrIp.trim() } : { username: quickForm.usernameOrIp.trim() }),
        targetPort: parseInt(quickForm.targetPort) || 80,
        routerName: quickForm.routerName,
      }

      const res = await fetch('/api/network/ont-remote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        showSuccess('Sesi Remote Web ONT Berhasil Dibuat!')
        setQuickForm((prev) => ({ ...prev, usernameOrIp: '' }))
        fetchSessions()
        // Automatically open new tab
        if (data.session?.proxyUrl) {
          window.open(data.session.proxyUrl, '_blank')
        }
      } else {
        showError(data.error || 'Gagal membuka remote ONT')
      }
    } catch (err: any) {
      showError(err.message || 'Terjadi kesalahan sistem')
    } finally {
      setLaunching(false)
    }
  }

  const handleCloseSession = async (id: string, name: string) => {
    const confirmed = await showConfirm(
      `Tutup sesi remote untuk "${name}" sekarang? Port proxy akan langsung dimatikan.`,
      'Tutup Sesi Remote?'
    )

    if (!confirmed) return

    try {
      const res = await fetch(`/api/network/ont-remote?id=${id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        showSuccess('Sesi remote berhasil ditutup')
        fetchSessions()
      } else {
        const data = await res.json()
        showError(data.error || 'Gagal menutup sesi')
      }
    } catch (err: any) {
      showError(err.message || 'Terjadi kesalahan')
    }
  }

  // Format seconds to MM:SS
  const formatTime = (totalSec: number) => {
    if (totalSec <= 0) return '00:00'
    const mins = Math.floor(totalSec / 60)
    const secs = totalSec % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Filtered sessions
  const filteredSessions = sessions.filter((s) => {
    const matchesSearch =
      (s.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.username || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.targetIp || '').includes(searchTerm) ||
      (s.routerName || '').toLowerCase().includes(searchTerm.toLowerCase())

    if (statusFilter === 'ACTIVE') return matchesSearch && s.status === 'ACTIVE' && s.remainingSeconds > 0
    if (statusFilter === 'EXPIRED') return matchesSearch && (s.status === 'EXPIRED' || s.remainingSeconds <= 0)
    if (statusFilter === 'CLOSED') return matchesSearch && s.status === 'CLOSED'
    return matchesSearch
  })

  const activeCount = sessions.filter((s) => s.status === 'ACTIVE' && s.remainingSeconds > 0).length
  const expiredCount = sessions.filter((s) => s.status === 'EXPIRED' || (s.status === 'ACTIVE' && s.remainingSeconds <= 0)).length
  const closedCount = sessions.filter((s) => s.status === 'CLOSED').length

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2.5 bg-cyan-500/10 rounded-xl border border-cyan-500/20 text-cyan-400">
              <Globe className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">
                Remote Web ONT (Sesi Aktif)
              </h1>
              <p className="text-sm text-muted-foreground">
                1-Click Reverse Proxy Remote ONT Modem tanpa VPN di laptop (Mode Temporary Auto-Clean)
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={fetchSessions}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-card hover:bg-muted border border-border text-foreground text-sm font-medium rounded-xl transition-all shadow-sm"
        >
          <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Sesi
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => setStatusFilter('ALL')}
          className={`cursor-pointer p-4 bg-card border rounded-2xl transition-all ${
            statusFilter === 'ALL' ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-muted-foreground/30'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total Sesi Dibuat
            </span>
            <SquareCode className="w-5 h-5 text-primary" />
          </div>
          <p className="text-2xl font-bold text-foreground mt-2">{sessions.length}</p>
        </div>

        <div
          onClick={() => setStatusFilter('ACTIVE')}
          className={`cursor-pointer p-4 bg-card border rounded-2xl transition-all ${
            statusFilter === 'ACTIVE' ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-border hover:border-emerald-500/30'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-500">
              Sesi Terbuka (Aktif)
            </span>
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-emerald-500 mt-2">{activeCount}</p>
        </div>

        <div
          onClick={() => setStatusFilter('EXPIRED')}
          className={`cursor-pointer p-4 bg-card border rounded-2xl transition-all ${
            statusFilter === 'EXPIRED' ? 'border-rose-500 ring-2 ring-rose-500/20' : 'border-border hover:border-rose-500/30'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-rose-500">
              Sesi Expired (10m)
            </span>
            <Clock className="w-5 h-5 text-rose-500" />
          </div>
          <p className="text-2xl font-bold text-rose-500 mt-2">{expiredCount}</p>
        </div>

        <div
          onClick={() => setStatusFilter('CLOSED')}
          className={`cursor-pointer p-4 bg-card border rounded-2xl transition-all ${
            statusFilter === 'CLOSED' ? 'border-slate-500 ring-2 ring-slate-500/20' : 'border-border hover:border-slate-500/30'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Ditutup Manual
            </span>
            <XCircle className="w-5 h-5 text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold text-muted-foreground mt-2">{closedCount}</p>
        </div>
      </div>

      {/* Quick Remote Form Card */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-500" />
          <h2 className="text-base font-semibold text-foreground">
            Quick Remote Web ONT (Mode Nottik Style)
          </h2>
        </div>

        <form onSubmit={handleLaunchQuickRemote} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Username PPPoE atau IP ONT
            </label>
            <input
              type="text"
              placeholder="cth: EMG258 atau 172.16.10.45"
              value={quickForm.usernameOrIp}
              onChange={(e) => setQuickForm({ ...quickForm, usernameOrIp: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-background border border-input rounded-xl text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Router / Site
            </label>
            <select
              value={quickForm.routerName}
              onChange={(e) => setQuickForm({ ...quickForm, routerName: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-background border border-input rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="Cibinong">Cibinong</option>
              <option value="Citeureup">Citeureup</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Port Web Target
            </label>
            <select
              value={quickForm.targetPort}
              onChange={(e) => setQuickForm({ ...quickForm, targetPort: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-background border border-input rounded-xl text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="80">Port 80 (HTTP Standard)</option>
              <option value="443">Port 443 (HTTPS Huawei/ZTE)</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={launching}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold rounded-xl shadow-md transition-all disabled:opacity-50"
            >
              {launching ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin" />
                  Menyiapkan...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  Buka Web ONT (10-Min)
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Sessions Filter & Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        {/* Table Filter Bar */}
        <div className="p-4 border-b border-border flex flex-col sm:flex-row items-center justify-between gap-3 bg-muted/20">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
            <input
              type="text"
              placeholder="Cari pelanggan, username, IP..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 bg-background border border-input rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            {['ALL', 'ACTIVE', 'EXPIRED', 'CLOSED'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  statusFilter === st
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background hover:bg-muted text-muted-foreground border border-border'
                }`}
              >
                {st === 'ALL' && 'Semua'}
                {st === 'ACTIVE' && 'Terbuka'}
                {st === 'EXPIRED' && 'Expired'}
                {st === 'CLOSED' && 'Ditutup'}
              </button>
            ))}
          </div>
        </div>

        {/* Sessions Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="py-3.5 px-4">Pelanggan / Username</th>
                <th className="py-3.5 px-4">Site / Router</th>
                <th className="py-3.5 px-4">IP ONT (Realtime)</th>
                <th className="py-3.5 px-4">Target Port</th>
                <th className="py-3.5 px-4">URL Akses Temporary</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Sisa Waktu</th>
                <th className="py-3.5 px-4 text-right">Aksi</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-border">
              {filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    Belum ada sesi remote Web ONT yang aktif.
                  </td>
                </tr>
              ) : (
                filteredSessions.map((session) => {
                  const isActive = session.status === 'ACTIVE' && session.remainingSeconds > 0

                  return (
                    <tr key={session.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-foreground">
                          {session.customerName || 'Pelanggan'}
                        </div>
                        <div className="font-mono text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <User className="w-3 h-3" />
                          {session.username || 'N/A'}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-medium text-foreground">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-muted rounded-lg text-xs font-medium">
                          <RouterIcon className="w-3.5 h-3.5 text-primary" />
                          {session.routerName || 'Router'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-xs text-foreground">
                        {session.targetIp}
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-xs font-mono font-semibold ${
                            session.targetPort === 443
                              ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                              : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          }`}
                        >
                          {session.targetPort === 443 ? '443 (HTTPS)' : '80 (HTTP)'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-xs">
                        {isActive ? (
                          <a
                            href={session.proxyUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-cyan-400 hover:underline font-semibold"
                          >
                            {session.proxyUrl}
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground opacity-50">-</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        {isActive && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            Terbuka
                          </span>
                        )}
                        {session.status === 'EXPIRED' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/20">
                            Expired
                          </span>
                        )}
                        {session.status === 'CLOSED' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border">
                            Ditutup
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 font-mono text-xs font-semibold">
                        {isActive ? (
                          <span className="text-emerald-400 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {formatTime(session.remainingSeconds)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">00:00</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        {isActive ? (
                          <div className="flex items-center justify-end gap-2">
                            <a
                              href={session.proxyUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-xs font-semibold rounded-lg transition-all"
                            >
                              Buka ↗
                            </a>
                            <button
                              onClick={() => handleCloseSession(session.id, session.customerName || session.username || 'Sesi')}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold rounded-lg transition-all"
                            >
                              Tutup
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground opacity-40">Selesai</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
