import { prisma } from '@/server/db/client';
import { Router as RouterIcon, Wifi, Search, ExternalLink, Activity, AlertCircle, CheckCircle, XCircle, Globe } from 'lucide-react';
import Link from 'next/link';

function formatRelativeTime(date: Date | null): string {
  if (!date) return 'Belum pernah';
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Baru saja';
  if (mins < 60) return `${mins}m lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}j lalu`;
  return `${Math.floor(hours / 24)}h lalu`;
}

export default async function AcsDashboardPage({ searchParams }: { searchParams: any }) {
  const sp = await searchParams;
  const q = sp?.q || '';
  const statusFilter = sp?.status || '';
  const redamanFilter = sp?.redaman || '';

  const allDevices = await prisma.acsDevice.findMany({
    orderBy: { lastInform: 'desc' },
    include: { pppoeUser: { select: { username: true, name: true } } }
  });

  // Stats
  const totalOnline  = allDevices.filter(d => d.status === 'online').length;
  const totalOffline = allDevices.filter(d => d.status === 'offline').length;
  const totalUnmapped = allDevices.filter(d => !d.pppoeUserId).length;

  const devices = allDevices.filter(device => {
    if (q) {
      const lower = q.toLowerCase();
      const matchSn   = device.serialNumber.toLowerCase().includes(lower);
      const matchUser = device.pppoeUser?.name?.toLowerCase().includes(lower) ||
                        device.pppoeUser?.username?.toLowerCase().includes(lower);
      const matchSsid = device.ssid?.toLowerCase().includes(lower) ||
                        device.ssid5g?.toLowerCase().includes(lower);
      const matchIp   = device.ipAddress?.includes(lower) || device.wanIpAddress?.includes(lower);
      if (!matchSn && !matchUser && !matchSsid && !matchIp) return false;
    }

    if (statusFilter && device.status !== statusFilter) return false;

    if (redamanFilter) {
      const rx = device.rxPower;
      if (rx === null || rx === undefined) return false;
      if (redamanFilter === 'good' && rx < -20)  return false;
      if (redamanFilter === 'mid'  && (rx >= -20 || rx < -26)) return false;
      if (redamanFilter === 'bad'  && rx >= -26) return false;
    }

    return true;
  });

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wifi className="w-6 h-6 text-primary" />
            Built-in TR-069 ACS
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Daftar ONT/Router yang terhubung ke Auto Configuration Server.
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-lg p-4 flex items-center gap-3">
          <Activity className="w-8 h-8 text-primary opacity-80" />
          <div>
            <div className="text-2xl font-bold">{allDevices.length}</div>
            <div className="text-xs text-muted-foreground">Total Perangkat</div>
          </div>
        </div>
        <div className="bg-card border border-green-500/20 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle className="w-8 h-8 text-green-500 opacity-80" />
          <div>
            <div className="text-2xl font-bold text-green-500">{totalOnline}</div>
            <div className="text-xs text-muted-foreground">Online</div>
          </div>
        </div>
        <div className="bg-card border border-red-500/20 rounded-lg p-4 flex items-center gap-3">
          <XCircle className="w-8 h-8 text-red-500 opacity-80" />
          <div>
            <div className="text-2xl font-bold text-red-500">{totalOffline}</div>
            <div className="text-xs text-muted-foreground">Offline</div>
          </div>
        </div>
        <div className="bg-card border border-yellow-500/20 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-8 h-8 text-yellow-500 opacity-80" />
          <div>
            <div className="text-2xl font-bold text-yellow-500">{totalUnmapped}</div>
            <div className="text-xs text-muted-foreground">Belum Mapping</div>
          </div>
        </div>
      </div>

      {/* Filter */}
      <form method="GET" className="bg-card border border-border rounded-lg p-4 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-muted-foreground mb-1">Cari Perangkat / Pelanggan / SSID / IP</label>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              name="q"
              defaultValue={q}
              placeholder="Serial Number / Nama / SSID / IP..."
              className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </div>
        <div className="w-36">
          <label className="block text-xs font-medium text-muted-foreground mb-1">Status</label>
          <select name="status" defaultValue={statusFilter} className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
            <option value="">Semua</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
          </select>
        </div>
        <div className="w-40">
          <label className="block text-xs font-medium text-muted-foreground mb-1">Redaman (dBm)</label>
          <select name="redaman" defaultValue={redamanFilter} className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
            <option value="">Semua</option>
            <option value="good">Bagus (≥ -20)</option>
            <option value="mid">Sedang (-21 sd -25)</option>
            <option value="bad">Buruk (≤ -26)</option>
          </select>
        </div>
        <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground font-medium rounded-md text-sm hover:bg-primary/90 transition-colors">
          Filter
        </button>
        {(q || statusFilter || redamanFilter) && (
          <Link href="/admin/acs" className="px-4 py-2 bg-muted text-muted-foreground font-medium rounded-md text-sm hover:bg-muted/80 transition-colors">
            Reset
          </Link>
        )}
      </form>

      {/* Device Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 border-b border-border text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Perangkat</th>
                <th className="px-4 py-3 font-medium">Pelanggan</th>
                <th className="px-4 py-3 font-medium">IP &amp; Status</th>
                <th className="px-4 py-3 font-medium">WiFi (SSID)</th>
                <th className="px-4 py-3 font-medium">Redaman</th>
                <th className="px-4 py-3 font-medium">Inform</th>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {devices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    Tidak ada perangkat yang ditemukan.
                  </td>
                </tr>
              ) : (
                devices.map((device) => {
                  const rx = device.rxPower;
                  let rxColor = 'text-muted-foreground bg-muted/20 border-border';
                  if (rx !== null && rx !== undefined) {
                    if (rx >= -20) rxColor = 'text-green-500 bg-green-500/10 border-green-500/20';
                    else if (rx >= -26) rxColor = 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
                    else rxColor = 'text-red-500 bg-red-500/10 border-red-500/20';
                  }

                  return (
                    <tr key={device.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground text-xs font-mono">{device.serialNumber}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {device.manufacturer} {device.productClass}
                        </div>
                        {device.softwareVersion && (
                          <div className="text-[10px] text-muted-foreground/60">FW: {device.softwareVersion}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {device.pppoeUser ? (
                          <div>
                            <Link href={`/admin/pppoe/users/${device.pppoeUserId}`} className="font-medium text-primary hover:underline flex items-center gap-1 text-sm">
                              {device.pppoeUser.name}
                              <ExternalLink className="w-3 h-3 flex-shrink-0" />
                            </Link>
                            <div className="text-[11px] text-muted-foreground font-mono">{device.pppoeUser.username}</div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs italic">Belum di-mapping</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-mono text-[11px] mb-1">{device.wanIpAddress || device.ipAddress || '-'}</div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          device.status === 'online' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                        }`}>
                          {device.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {device.ssid ? (
                          <div>
                            <div className="text-sm font-medium">{device.ssid}</div>
                            {device.ssid5g && (
                              <div className="text-[11px] text-muted-foreground mt-0.5">
                                5G: {device.ssid5g}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs italic">Unknown</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {rx !== null && rx !== undefined ? (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${rxColor}`}>
                            {rx.toFixed(1)} dBm
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs text-muted-foreground">{formatRelativeTime(device.lastInform)}</div>
                        {device.periodicInformInterval && (
                          <div className="text-[10px] text-muted-foreground/60">Interval: {device.periodicInformInterval}s</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {device.connectedDevicesCount != null ? (
                          <span className="inline-flex items-center gap-1 text-xs">
                            <Wifi className="w-3 h-3 text-muted-foreground" />
                            {device.connectedDevicesCount}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            href={`/admin/monitoring/ont-remote?username=${encodeURIComponent(device.pppoeUser?.username || device.serialNumber)}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 rounded-md transition-colors text-xs font-medium"
                            title="Remote Web ONT (Mode Temporary)"
                          >
                            <Globe className="w-3.5 h-3.5" />
                            Remote ONT
                          </Link>
                          <Link
                            href={`/admin/acs/${device.id}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-md transition-colors text-xs font-medium"
                          >
                            <RouterIcon className="w-3.5 h-3.5" />
                            Kelola
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
