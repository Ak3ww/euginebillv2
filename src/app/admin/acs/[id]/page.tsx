import { prisma } from '@/server/db/client';
import { notFound } from 'next/navigation';
import { Activity, Cpu, Globe, Settings, Wifi, Clock, Signal, Smartphone } from 'lucide-react';
import AcsDeviceActions from './DeviceActions';
import MapDeviceForm from './MapDeviceForm';
import AcsDeviceSettings from './AcsDeviceSettings';
import Link from 'next/link';

function formatUptime(seconds: number | null): string {
  if (!seconds) return '-';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}h ${h}j ${m}m`;
  if (h > 0) return `${h}j ${m}m`;
  return `${m}m`;
}

function formatRelativeTime(date: Date | null): string {
  if (!date) return 'Belum pernah';
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Baru saja';
  if (mins < 60) return `${mins} menit lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  return `${Math.floor(hours / 24)} hari lalu`;
}

export default async function AcsDeviceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const device = await prisma.acsDevice.findUnique({
    where: { id },
    include: {
      pppoeUser: true,
      tasks: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      }
    }
  });

  if (!device) notFound();

  const users = await prisma.pppoeUser.findMany({
    select: { id: true, name: true, username: true },
    orderBy: { name: 'asc' }
  });

  const parameters = (device.parameters as Record<string, string>) || {};
  const connectedDevices = device.connectedDevices as any[] | null;

  // Redaman color
  const rx = device.rxPower;
  let rxColor = 'text-muted-foreground bg-muted/20 border-border';
  let rxLabel = '-';
  if (rx !== null && rx !== undefined) {
    rxLabel = `${rx.toFixed(2)} dBm`;
    if (rx >= -20) rxColor = 'text-green-500 bg-green-500/10 border-green-500/20';
    else if (rx >= -26) rxColor = 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
    else rxColor = 'text-red-500 bg-red-500/10 border-red-500/20';
  }

  return (
    <div className="space-y-6 p-6">
      {/* Breadcrumb */}
      <Link href="/admin/acs" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
        ← Kembali ke Daftar Perangkat
      </Link>

      {/* Header */}
      <div className="flex justify-between items-start flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <RouterIcon className="w-6 h-6 text-primary" />
            {device.manufacturer || device.oui} {device.productClass}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-mono">SN: {device.serialNumber}</p>
          {device.softwareVersion && (
            <p className="text-xs text-muted-foreground mt-0.5">FW: {device.softwareVersion}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${
            device.status === 'online'
              ? 'bg-green-500/10 text-green-500 border-green-500/20'
              : 'bg-red-500/10 text-red-500 border-red-500/20'
          }`}>
            {device.status.toUpperCase()}
          </span>
          <span className="text-xs text-muted-foreground border border-border px-2 py-1 rounded-full">
            Inform ke-{device.informCount}
          </span>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="IP WAN" value={device.wanIpAddress || device.ipAddress || '-'} mono />
        <StatCard label="Terakhir Inform" value={formatRelativeTime(device.lastInform)} />
        <StatCard label="Uptime" value={formatUptime(device.deviceUptime)} />
        <StatCard
          label="Redaman (RxPower)"
          value={rxLabel}
          valueClass={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${rxColor}`}
        />
        <StatCard
          label="Perangkat WiFi"
          value={device.connectedDevicesCount != null ? `${device.connectedDevicesCount} perangkat` : '-'}
        />
      </div>

      {/* 3 Column Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Device Info */}
        <div className="bg-card border border-border p-5 rounded-lg space-y-4">
          <h3 className="font-semibold flex items-center gap-2 border-b border-border pb-2 text-sm">
            <Cpu className="w-4 h-4 text-primary" />
            Informasi Perangkat
          </h3>
          <div className="space-y-3 text-sm">
            <InfoRow label="Vendor / OUI" value={`${device.manufacturer || ''} (${device.oui || '-'})`} />
            <InfoRow label="Model" value={device.productClass || '-'} />
            <InfoRow label="Hardware Ver." value={device.hardwareVersion || '-'} />
            <InfoRow label="Firmware Ver." value={device.softwareVersion || '-'} />
            <InfoRow label="IP Address (LAN)" value={device.ipAddress || '-'} mono />
            <InfoRow label="IP WAN (PPPoE)" value={device.wanIpAddress || '-'} mono />
            <InfoRow label="Inform Interval" value={device.periodicInformInterval ? `${device.periodicInformInterval}s` : '-'} />
            <InfoRow label="Pertama Terdaftar" value={device.firstSeenAt?.toLocaleDateString('id-ID') || '-'} />
            <InfoRow label="Connection Req. URL" value={device.connectionRequestUrl ? '✅ Tersedia' : '❌ Belum ada'} />
          </div>
        </div>

        {/* Mapped User */}
        <div className="bg-card border border-border p-5 rounded-lg space-y-4">
          <h3 className="font-semibold flex items-center gap-2 border-b border-border pb-2 text-sm">
            <Globe className="w-4 h-4 text-primary" />
            Pelanggan Terkait (PPPoE)
          </h3>
          {device.pppoeUser ? (
            <div className="space-y-3 text-sm">
              <InfoRow label="Nama" value={device.pppoeUser.name} />
              <InfoRow label="Username" value={device.pppoeUser.username} mono />
              <InfoRow label="Status" value={device.pppoeUser.status} />
              {device.ssid && <InfoRow label="SSID (2.4GHz)" value={device.ssid} />}
              {device.ssid5g && <InfoRow label="SSID (5GHz)" value={device.ssid5g} />}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground italic flex-1 flex items-center justify-center py-4">
              Perangkat ini belum dihubungkan dengan data pelanggan.
            </div>
          )}
          <div className="pt-4 border-t border-border">
            <MapDeviceForm deviceId={device.id} currentUserId={device.pppoeUserId} users={users} />
          </div>
        </div>

        {/* Actions */}
        <div className="bg-card border border-border p-5 rounded-lg space-y-4">
          <h3 className="font-semibold flex items-center gap-2 border-b border-border pb-2 text-sm">
            <Activity className="w-4 h-4 text-primary" />
            Aksi Langsung
          </h3>
          <AcsDeviceActions
            serialNumber={device.serialNumber}
            hasConnectionRequestUrl={!!device.connectionRequestUrl}
          />
        </div>
      </div>

      {/* Device Settings */}
      <div className="pt-6 border-t border-border">
        <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
          <Settings className="w-5 h-5 text-primary" />
          Konfigurasi Perangkat (TR-069)
        </h2>
        <AcsDeviceSettings
          serialNumber={device.serialNumber}
          parameters={parameters}
          dedicatedSsid={device.ssid}
          dedicatedSsid5g={device.ssid5g}
          dedicatedWifiPw={device.wifiPassword}
          dedicatedWifiPw5g={device.wifiPassword5g}
          connectedDevices={connectedDevices}
          connectedDevicesCount={device.connectedDevicesCount}
        />
      </div>

      {/* Task History */}
      {device.tasks.length > 0 && (
        <div className="pt-6 border-t border-border">
          <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-primary" />
            Riwayat Task (10 Terakhir)
          </h2>
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr className="text-muted-foreground uppercase">
                  <th className="px-4 py-2 text-left font-medium">Nama Task</th>
                  <th className="px-4 py-2 text-left font-medium">Status</th>
                  <th className="px-4 py-2 text-left font-medium">Dibuat</th>
                  <th className="px-4 py-2 text-left font-medium">Diperbarui</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {device.tasks.map((task) => (
                  <tr key={task.id} className="hover:bg-muted/20">
                    <td className="px-4 py-2.5 font-medium">{task.name}</td>
                    <td className="px-4 py-2.5">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        task.status === 'success' ? 'bg-green-500/10 text-green-500' :
                        task.status === 'failed'  ? 'bg-red-500/10 text-red-500' :
                        task.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {task.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{formatRelativeTime(task.createdAt)}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{formatRelativeTime(task.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, mono, valueClass }: { label: string; value: string; mono?: boolean; valueClass?: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-3">
      <div className="text-[11px] text-muted-foreground mb-1">{label}</div>
      {valueClass ? (
        <span className={valueClass}>{value}</span>
      ) : (
        <div className={`font-semibold text-sm truncate ${mono ? 'font-mono' : ''}`}>{value}</div>
      )}
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className={`font-medium text-sm mt-0.5 ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
  );
}

function RouterIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="8" x="2" y="14" rx="2" />
      <path d="M6 18h.01" /><path d="M10 18h.01" /><path d="M15 18h.01" /><path d="M18 18h.01" />
      <path d="M8 14v-4c0-2.2 1.8-4 4-4s4 1.8 4 4v4" />
      <path d="M12 2v2" />
    </svg>
  );
}
