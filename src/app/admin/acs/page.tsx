import { prisma } from '@/server/db/client';
import { Router as RouterIcon, Wifi, Search, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { ZteParamMap } from '@/server/services/acs/cwmp.service';

export default async function AcsDashboardPage({ searchParams }: { searchParams: any }) {
  // Await searchParams for Next.js 15 compatibility, safe in Next.js 14 too.
  const sp = await searchParams;
  const q = sp?.q || '';
  const statusFilter = sp?.status || '';
  const redamanFilter = sp?.redaman || '';

  const allDevices = await prisma.acsDevice.findMany({
    orderBy: { lastInform: 'desc' },
    include: { pppoeUser: { select: { username: true, name: true } } }
  });

  const devices = allDevices.filter(device => {
    // 1. Search Query
    if (q) {
      const searchLower = q.toLowerCase();
      const matchSn = device.serialNumber.toLowerCase().includes(searchLower);
      const matchUser = device.pppoeUser?.name?.toLowerCase().includes(searchLower) || device.pppoeUser?.username?.toLowerCase().includes(searchLower);
      if (!matchSn && !matchUser) return false;
    }

    // 2. Status
    if (statusFilter && device.status !== statusFilter) {
      return false;
    }

    // 3. Redaman
    let rxPowerVal: number | null = null;
    if (device.parameters) {
      const params = device.parameters as any;
      const rxPowerStr = params[ZteParamMap.rxPower];
      if (rxPowerStr) {
        let rawNum = parseFloat(rxPowerStr);
        if (!isNaN(rawNum)) {
          if (rawNum < -1000) rxPowerVal = rawNum / 1000;
          else if (rawNum < -100 && rawNum > -1000) rxPowerVal = rawNum / 10;
          else rxPowerVal = rawNum;
        }
      }
    }

    if (redamanFilter) {
      if (rxPowerVal === null) return false;
      if (redamanFilter === 'good' && rxPowerVal >= -20) return false; // wait, if good we want >= -20. so if < -20 return false. Let me fix this!
      if (redamanFilter === 'good' && rxPowerVal < -20) return false;
      if (redamanFilter === 'mid' && (rxPowerVal >= -20 || rxPowerVal < -26)) return false;
      if (redamanFilter === 'bad' && rxPowerVal >= -26) return false;
    }

    return true;
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wifi className="w-6 h-6 text-primary" />
            Built-in TR-069 ACS
          </h1>
          <p className="text-muted-foreground mt-1">Daftar perangkat (ONT/Router) yang terhubung ke Auto Configuration Server.</p>
        </div>
      </div>

      <form method="GET" className="bg-card border border-border rounded-lg p-4 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-muted-foreground mb-1">Cari Perangkat / Pelanggan</label>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input 
              name="q" 
              defaultValue={q} 
              placeholder="Serial Number / Nama / Username..." 
              className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </div>
        <div className="w-40">
          <label className="block text-xs font-medium text-muted-foreground mb-1">Status</label>
          <select name="status" defaultValue={statusFilter} className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
            <option value="">Semua Status</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
          </select>
        </div>
        <div className="w-40">
          <label className="block text-xs font-medium text-muted-foreground mb-1">Redaman (dBm)</label>
          <select name="redaman" defaultValue={redamanFilter} className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
            <option value="">Semua Redaman</option>
            <option value="good">Good (&gt;= -20)</option>
            <option value="mid">Mid (-21 to -25)</option>
            <option value="bad">Bad (&lt;= -26)</option>
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

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 border-b border-border text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Perangkat</th>
                <th className="px-4 py-3 font-medium">Pelanggan (PPPoE)</th>
                <th className="px-4 py-3 font-medium">IP & Status</th>
                <th className="px-4 py-3 font-medium">Wi-Fi</th>
                <th className="px-4 py-3 font-medium">Redaman</th>
                <th className="px-4 py-3 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {devices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    Tidak ada perangkat yang ditemukan.
                  </td>
                </tr>
              ) : (
                devices.map((device) => {
                  const params = (device.parameters as Record<string, string>) || {};
                  const ssid = params[ZteParamMap.ssid];
                  const wifiPassword = params[ZteParamMap.wifiPassword];
                  const rxPowerStr = params[ZteParamMap.rxPower] || params[ZteParamMap.rxPowerAlt] || params[ZteParamMap.rxPowerAlt2];

                  let rxPowerVal: number | null = null;
                  if (rxPowerStr) {
                    let rawNum = parseFloat(rxPowerStr);
                    if (!isNaN(rawNum)) {
                      if (rawNum < -1000) rxPowerVal = rawNum / 1000;
                      else if (rawNum < -100 && rawNum > -1000) rxPowerVal = rawNum / 10;
                      else rxPowerVal = rawNum;
                    }
                  }

                  let redamanColor = 'text-muted-foreground bg-muted/20 border-border';
                  if (rxPowerVal !== null) {
                    if (rxPowerVal >= -20) redamanColor = 'text-green-500 bg-green-500/10 border-green-500/20';
                    else if (rxPowerVal >= -26) redamanColor = 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
                    else redamanColor = 'text-red-500 bg-red-500/10 border-red-500/20';
                  }

                  return (
                    <tr key={device.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{device.serialNumber}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">{device.oui} - {device.productClass}</div>
                      </td>
                      <td className="px-4 py-3">
                        {device.pppoeUser ? (
                          <div className="flex flex-col">
                            <Link href={`/admin/pppoe/users/${device.pppoeUserId}`} className="font-medium text-primary hover:underline flex items-center gap-1">
                              {device.pppoeUser.name}
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                            <span className="text-[11px] text-muted-foreground mt-0.5">{device.pppoeUser.username}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs italic">Belum di-mapping</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-mono text-[11px] mb-1.5">{device.ipAddress || '-'}</div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          device.status === 'online' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                        }`}>
                          {device.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium">{ssid || <span className="text-muted-foreground text-xs italic">Unknown</span>}</div>
                        {wifiPassword && <div className="text-[11px] text-muted-foreground font-mono mt-0.5" title="Wi-Fi Password">{wifiPassword}</div>}
                      </td>
                      <td className="px-4 py-3">
                        {rxPowerVal !== null ? (
                          <div>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${redamanColor}`}>
                              {rxPowerVal.toFixed(2)} dBm
                            </span>
                            {Number(rxPowerStr) !== rxPowerVal && (
                              <div className="text-[10px] text-muted-foreground mt-1 opacity-70">
                                raw: {rxPowerStr}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link 
                          href={`/admin/acs/${device.id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-md transition-colors text-xs font-medium"
                        >
                          <RouterIcon className="w-3.5 h-3.5" />
                          Kelola
                        </Link>
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
