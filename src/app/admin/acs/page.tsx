import { prisma } from '@/server/db/client';
import { Router as RouterIcon, Wifi, RefreshCw } from 'lucide-react';
import Link from 'next/link';

export default async function AcsDashboardPage() {
  const devices = await prisma.acsDevice.findMany({
    orderBy: { lastInform: 'desc' },
    include: { pppoeUser: { select: { username: true, name: true } } }
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

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 border-b border-border text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Serial Number</th>
                <th className="px-4 py-3 font-medium">Produk</th>
                <th className="px-4 py-3 font-medium">IP Address</th>
                <th className="px-4 py-3 font-medium">Pelanggan (PPPoE)</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {devices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    Belum ada perangkat yang terhubung. Pastikan ONT Anda diarahkan ke URL ACS server ini.
                  </td>
                </tr>
              ) : (
                devices.map((device) => (
                  <tr key={device.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{device.serialNumber}</td>
                    <td className="px-4 py-3">{device.oui} - {device.productClass}</td>
                    <td className="px-4 py-3 font-mono text-xs">{device.ipAddress || '-'}</td>
                    <td className="px-4 py-3">
                      {device.pppoeUser ? (
                        <div className="flex flex-col">
                          <span className="font-medium text-primary">{device.pppoeUser.name}</span>
                          <span className="text-xs text-muted-foreground">{device.pppoeUser.username}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs italic">Belum di-mapping</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        device.status === 'online' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                      }`}>
                        {device.status.toUpperCase()}
                      </span>
                      <div className="text-[10px] text-muted-foreground mt-1">
                        Last seen: {device.lastInform?.toLocaleString() || '-'}
                      </div>
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
