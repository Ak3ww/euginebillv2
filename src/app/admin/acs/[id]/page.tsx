import { prisma } from '@/server/db/client';
import { notFound } from 'next/navigation';
import { Activity, Cpu, Globe, Power, RotateCcw, Settings, Wifi } from 'lucide-react';
import AcsDeviceActions from './DeviceActions';

export default async function AcsDeviceDetailPage({ params }: { params: { id: string } }) {
  const serialNumber = decodeURIComponent(params.id);
  const device = await prisma.acsDevice.findUnique({
    where: { serialNumber },
    include: { pppoeUser: true }
  });

  if (!device) notFound();

  // Parse cached parameters if we had them (in a real implementation we'd store params in DB as well)
  // For this simple version, we'll just show the basic info.

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <RouterIcon className="w-6 h-6 text-primary" />
            {device.oui} - {device.productClass}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-mono">SN: {device.serialNumber}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${
            device.status === 'online' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'
          }`}>
            {device.status.toUpperCase()}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Basic Info */}
        <div className="bg-card border border-border p-5 rounded-lg space-y-4">
          <h3 className="font-semibold flex items-center gap-2 border-b border-border pb-2">
            <Cpu className="w-4 h-4 text-primary" />
            Informasi Perangkat
          </h3>
          <div className="space-y-3 text-sm">
            <div>
              <div className="text-muted-foreground text-xs">OUI (Vendor)</div>
              <div className="font-medium">{device.oui}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Product Class</div>
              <div className="font-medium">{device.productClass}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">IP Address (WAN)</div>
              <div className="font-mono">{device.ipAddress || '-'}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Terakhir Terhubung</div>
              <div>{device.lastInform?.toLocaleString() || '-'}</div>
            </div>
          </div>
        </div>

        {/* Mapped User */}
        <div className="bg-card border border-border p-5 rounded-lg space-y-4">
          <h3 className="font-semibold flex items-center gap-2 border-b border-border pb-2">
            <Globe className="w-4 h-4 text-primary" />
            Pelanggan Terkait (PPPoE)
          </h3>
          {device.pppoeUser ? (
            <div className="space-y-3 text-sm">
              <div>
                <div className="text-muted-foreground text-xs">Nama Pelanggan</div>
                <div className="font-medium text-primary">{device.pppoeUser.name}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Username PPPoE</div>
                <div className="font-mono">{device.pppoeUser.username}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Status Layanan</div>
                <div className="capitalize">{device.pppoeUser.status}</div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground italic h-full flex items-center justify-center py-8">
              Perangkat ini belum dihubungkan dengan data pelanggan manapun.
            </div>
          )}
        </div>

        {/* Action Center */}
        <div className="bg-card border border-border p-5 rounded-lg space-y-4">
          <h3 className="font-semibold flex items-center gap-2 border-b border-border pb-2">
            <Activity className="w-4 h-4 text-primary" />
            Aksi Langsung
          </h3>
          
          <AcsDeviceActions serialNumber={device.serialNumber} />
          
        </div>
      </div>
    </div>
  );
}

function RouterIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="20" height="8" x="2" y="14" rx="2" />
      <path d="M6 18h.01" />
      <path d="M10 18h.01" />
      <path d="M15 18h.01" />
      <path d="M18 18h.01" />
      <path d="M8 14v-4c0-2.2 1.8-4 4-4s4 1.8 4 4v4" />
      <path d="M12 2v2" />
    </svg>
  );
}
