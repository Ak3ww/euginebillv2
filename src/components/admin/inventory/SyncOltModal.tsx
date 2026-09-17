'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Server,
  Sparkles,
  CheckCircle2,
  RefreshCw,
  X,
  Radio,
  Layers,
  UserCheck,
  AlertCircle,
  Check,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface SyncOltModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function SyncOltModal({ open, onClose, onSuccess }: SyncOltModalProps) {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any | null>(null);
  const [resultMsg, setResultMsg] = useState<string | null>(null);

  const fetchPreview = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResultMsg(null);
    try {
      const res = await fetch('/api/admin/inventory/ont/sync-olt');
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Gagal memuat pratinjau');
      setData(json.data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchPreview();
    }
  }, [open, fetchPreview]);

  const handleExecuteSync = async () => {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/inventory/ont/sync-olt', {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Gagal menyinkronkan');
      setResultMsg(json.message);
      await onSuccess();
      // Keep modal open briefly or let user close
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b border-border bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold flex items-center gap-2 text-foreground">
                Sinkronisasi Modem dari OLT ke Inventori
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Tarik otomatis seluruh unit ONT dari semua OLT aktif ke stok inventori (1 Pintu 1 Source)
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {resultMsg && (
            <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{resultMsg}</span>
            </div>
          )}

          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center text-muted-foreground gap-2">
              <RefreshCw className="w-7 h-7 animate-spin text-primary" />
              <p className="text-xs">Membaca data ONU dari seluruh OLT aktif...</p>
            </div>
          ) : data ? (
            <>
              {/* Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg border border-border bg-card">
                  <div className="text-[11px] text-muted-foreground">Total ONU di OLT</div>
                  <div className="text-xl font-bold text-foreground mt-0.5">{data.totalOnus} Unit</div>
                </div>

                <div className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
                  <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Baru Siap Impor
                  </div>
                  <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {data.newToImport} Unit
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-border bg-card">
                  <div className="text-[11px] text-muted-foreground">Sudah di Inventori</div>
                  <div className="text-xl font-bold text-foreground mt-0.5">{data.alreadyInInventory} Unit</div>
                </div>

                <div className="p-3 rounded-lg border border-blue-500/20 bg-blue-500/5">
                  <div className="text-[11px] text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1">
                    <UserCheck className="w-3 h-3" /> Tertaut Pelanggan
                  </div>
                  <div className="text-xl font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                    {data.assignedToCustomer} Unit
                  </div>
                </div>
              </div>

              {/* Vendor Breakdown Pills */}
              {data.vendorBreakdown && Object.keys(data.vendorBreakdown).length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-xs text-muted-foreground font-medium">Vendor Terdeteksi Otomatis:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(data.vendorBreakdown).map(([vendor, count]) => (
                      <Badge key={vendor} variant="secondary" className="text-xs px-2 py-0.5 font-normal">
                        <strong>{vendor}</strong>: {count as number} unit
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview Table */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Pratinjau Data Unit OLT ({data.items?.length ?? 0} unit)</span>
                  <span>Menampilkan maks 100 entri</span>
                </div>

                <div className="border border-border rounded-lg max-h-64 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/40 border-b border-border text-left text-muted-foreground sticky top-0 bg-background">
                        <th className="py-2 pl-3 pr-2">Serial Number</th>
                        <th className="py-2 pr-2">OLT / Port</th>
                        <th className="py-2 pr-2">Deteksi Vendor &amp; Model</th>
                        <th className="py-2 pr-2">Pelanggan Terhubung</th>
                        <th className="py-2 pr-3">Status Inventori</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {data.items?.slice(0, 100).map((item: any) => (
                        <tr key={item.onuId} className="hover:bg-muted/20">
                          <td className="py-2 pl-3 pr-2 font-mono font-medium text-foreground">
                            {item.serialNumber}
                          </td>
                          <td className="py-2 pr-2 text-muted-foreground">
                            {item.oltName} ({item.location})
                          </td>
                          <td className="py-2 pr-2">
                            <span className="font-semibold text-foreground">{item.detectedVendor}</span>{' '}
                            <span className="text-muted-foreground text-[11px]">{item.detectedModel}</span>
                          </td>
                          <td className="py-2 pr-2">
                            {item.currentCustomer ? (
                              <div>
                                <span className="font-medium text-foreground">{item.currentCustomer.name}</span>
                                <div className="text-[10px] text-muted-foreground font-mono">
                                  @{item.currentCustomer.username}
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground italic">Belum Tertaut</span>
                            )}
                          </td>
                          <td className="py-2 pr-3">
                            {item.alreadyInInventory ? (
                              <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
                                Sudah Terdaftar
                              </Badge>
                            ) : (
                              <Badge className="text-[10px] bg-emerald-600 hover:bg-emerald-600 text-white font-normal">
                                Siap Diimpor
                              </Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t border-border bg-muted/20">
          <Button variant="outline" onClick={onClose} disabled={syncing}>
            Tutup
          </Button>
          <Button
            onClick={handleExecuteSync}
            disabled={syncing || loading || !data || (data.totalOnus === 0)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
          >
            {syncing ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Menyinkronkan...
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Sinkronkan Sekarang ({data?.totalOnus ?? 0} Unit)
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
