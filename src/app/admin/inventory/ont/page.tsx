'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Wifi,
  Search,
  Plus,
  Edit,
  Eye,
  Loader2,
  ChevronLeft,
  ChevronRight,
  X,
  AlertCircle,
  Upload,
  UserCheck,
  PackageCheck,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Copy,
  ExternalLink,
  Server,
} from 'lucide-react';
import { SyncOltModal } from '@/components/admin/inventory/SyncOltModal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatMacAddress } from '@/lib/mac-format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  unit: string;
  categoryCode?: string;
}

interface Customer {
  id: string;
  name: string;
  username: string;
  customerId?: string;
  phone?: string;
  address?: string;
}

interface InventoryAsset {
  id: string;
  itemId?: string | null;
  assetType: 'MODEM';
  serialNumber?: string | null;
  macAddress?: string | null;
  vendor?: string | null;
  model?: string | null;
  condition: 'NEW' | 'USED_GOOD' | 'DEFECTIVE';
  status: 'AVAILABLE' | 'IN_USE' | 'DEFECTIVE' | 'DEPLETED';
  location?: string | null;
  currentCustomerId?: string | null;
  installedAt?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  item?: InventoryItem | null;
  customer?: Customer | null;
}

interface ApiResponse {
  success: boolean;
  assets: InventoryAsset[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  statusCounts: Record<string, number>;
}

const VENDOR_COLORS: Record<string, string> = {
  ZTE: 'bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800',
  Skyworth: 'bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800',
  Realtek: 'bg-purple-500/10 text-purple-600 border-purple-200 dark:border-purple-800',
  FiberHome: 'bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800',
  Huawei: 'bg-rose-500/10 text-rose-600 border-rose-200 dark:border-rose-800',
  VSOL: 'bg-teal-500/10 text-teal-600 border-teal-200 dark:border-teal-800',
  Gigalink: 'bg-indigo-500/10 text-indigo-600 border-indigo-200 dark:border-indigo-800',
  EFiber: 'bg-cyan-500/10 text-cyan-600 border-cyan-200 dark:border-cyan-800',
};

const STATUS_CONFIG: Record<string, { label: string; badgeClass: string }> = {
  IN_USE: {
    label: 'Terpasang',
    badgeClass: 'bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800',
  },
  AVAILABLE: {
    label: 'Ready di Gudang',
    badgeClass: 'bg-green-500/10 text-green-600 border-green-200 dark:border-green-800',
  },
  DEFECTIVE: {
    label: 'Rusak',
    badgeClass: 'bg-red-500/10 text-red-600 border-red-200 dark:border-red-800',
  },
  DEPLETED: {
    label: 'Afkir / Nonaktif',
    badgeClass: 'bg-zinc-500/10 text-zinc-600 border-zinc-200 dark:border-zinc-800',
  },
};

const CONDITION_CONFIG: Record<string, { label: string; color: string }> = {
  NEW: { label: 'Baru', color: 'text-green-600' },
  USED_GOOD: { label: 'Bekas Bagus', color: 'text-amber-600' },
  DEFECTIVE: { label: 'Rusak', color: 'text-red-600' },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? {
    label: status,
    badgeClass: 'bg-muted text-muted-foreground',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${cfg.badgeClass}`}>
      {cfg.label}
    </span>
  );
}

// ─── Modal Detail ONT ─────────────────────────────────────────────────────────

function OntDetailModal({
  asset,
  onClose,
}: {
  asset: InventoryAsset | null;
  onClose: () => void;
}) {
  if (!asset) return null;

  return (
    <Dialog open={!!asset} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wifi className="w-5 h-5 text-primary" />
            Detail Unit ONT Modem
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm mt-2">
          <div className="grid grid-cols-2 gap-3 p-3.5 bg-muted/40 rounded-xl border border-border">
            <div>
              <p className="text-xs text-muted-foreground">Serial Number (SN)</p>
              <p className="font-mono font-semibold text-foreground flex items-center gap-1.5">
                {asset.serialNumber || '-'}
                {asset.serialNumber && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(asset.serialNumber!);
                      alert('Serial Number disalin!');
                    }}
                    className="text-muted-foreground hover:text-foreground"
                    title="Salin SN"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                )}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Status Unit</p>
              <div className="mt-0.5">
                <StatusBadge status={asset.status} />
              </div>
            </div>
            {asset.macAddress && (
              <div>
                <p className="text-xs text-muted-foreground">MAC Address</p>
                <p className="font-mono text-xs">{asset.macAddress}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground">Kondisi Fisik</p>
              <p className={`font-medium ${CONDITION_CONFIG[asset.condition]?.color || ''}`}>
                {CONDITION_CONFIG[asset.condition]?.label || asset.condition}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Vendor</p>
              <p className="font-medium">{asset.vendor || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Tipe / Model</p>
              <p>{asset.model || '-'}</p>
            </div>
            {asset.location && (
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground">Lokasi Rak / Penyimpanan</p>
                <p>{asset.location}</p>
              </div>
            )}
          </div>

          {/* Relasi Pelanggan */}
          <div className="p-3.5 bg-card rounded-xl border border-border space-y-2">
            <p className="text-xs font-semibold text-foreground uppercase tracking-wider">
              Pelanggan PPPoE Terhubung
            </p>
            {asset.customer ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-base text-foreground">
                    {asset.customer.name}
                  </p>
                  <Link
                    href={`/admin/pppoe/users/${asset.customer.id}`}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                    target="_blank"
                  >
                    Buka Profil Pelanggan
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p>Username: <span className="font-mono font-medium text-foreground">{asset.customer.username}</span></p>
                  {asset.customer.phone && <p>WhatsApp: {asset.customer.phone}</p>}
                  {asset.customer.address && <p>Alamat: {asset.customer.address}</p>}
                  {asset.installedAt && (
                    <p className="pt-1 text-[11px] text-muted-foreground">
                      Terpasang Sejak: {new Date(asset.installedAt).toLocaleDateString('id-ID', { dateStyle: 'long' })}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-2 text-center text-muted-foreground text-xs">
                Modem ini saat ini belum terpasang ke pelanggan (berada di stok gudang).
              </div>
            )}
          </div>

          {asset.notes && (
            <div className="p-3 bg-muted/20 rounded-lg border border-border">
              <p className="text-xs text-muted-foreground">Catatan Tambahan</p>
              <p className="text-xs mt-0.5">{asset.notes}</p>
            </div>
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Modal Add/Edit ONT ───────────────────────────────────────────────────────

function OntFormModal({
  open,
  asset,
  onClose,
  onSaved,
}: {
  open: boolean;
  asset: InventoryAsset | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!asset;
  const [tab, setTab] = useState<'single' | 'bulk'>('single');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    serialNumber: '',
    macAddress: '',
    vendor: 'ZTE',
    model: 'F609 V3',
    condition: 'NEW' as 'NEW' | 'USED_GOOD' | 'DEFECTIVE',
    status: 'AVAILABLE' as 'AVAILABLE' | 'IN_USE' | 'DEFECTIVE' | 'DEPLETED',
    location: 'Warehouse / Gudang Utama',
    notes: '',
  });

  const [bulkSn, setBulkSn] = useState('');

  useEffect(() => {
    if (asset) {
      setForm({
        serialNumber: asset.serialNumber || '',
        macAddress: asset.macAddress || '',
        vendor: asset.vendor || 'ZTE',
        model: asset.model || '',
        condition: asset.condition,
        status: asset.status,
        location: asset.location || 'Warehouse / Gudang Utama',
        notes: asset.notes || '',
      });
      setTab('single');
    } else {
      setForm({
        serialNumber: '',
        macAddress: '',
        vendor: 'ZTE',
        model: 'F609 V3',
        condition: 'NEW',
        status: 'AVAILABLE',
        location: 'Warehouse / Gudang Utama',
        notes: '',
      });
      setBulkSn('');
    }
    setError(null);
  }, [asset, open]);

  const handleSubmit = async () => {
    setError(null);
    setSaving(true);

    try {
      if (tab === 'bulk' && !isEdit) {
        const rawLines = bulkSn.split('\n').map((l) => l.trim()).filter(Boolean);
        if (rawLines.length === 0) {
          setError('Masukkan minimal satu Serial Number');
          setSaving(false);
          return;
        }

        const res = await fetch('/api/inventory/assets/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assetType: 'MODEM',
            vendor: form.vendor,
            model: form.model,
            condition: form.condition,
            status: form.status,
            location: form.location,
            notes: form.notes,
            serialNumbers: rawLines,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal menyimpan bulk assets');
        onSaved();
      } else {
        if (!form.serialNumber.trim()) {
          setError('Serial Number (SN) wajib diisi');
          setSaving(false);
          return;
        }

        const url = isEdit ? `/api/inventory/assets/${asset!.id}` : '/api/inventory/assets';
        const method = isEdit ? 'PUT' : 'POST';

        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assetType: 'MODEM',
            ...form,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal menyimpan unit ONT');
        onSaved();
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wifi className="w-5 h-5 text-primary" />
            {isEdit ? 'Edit Data Modem ONT' : 'Tambah Unit Modem ONT'}
          </DialogTitle>
        </DialogHeader>

        {!isEdit && (
          <div className="flex rounded-lg border border-border p-1 gap-1 text-xs mb-2">
            <button
              type="button"
              onClick={() => setTab('single')}
              className={`flex-1 py-1.5 rounded-md font-medium transition-colors ${
                tab === 'single' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Input Satuan
            </button>
            <button
              type="button"
              onClick={() => setTab('bulk')}
              className={`flex-1 py-1.5 rounded-md font-medium transition-colors ${
                tab === 'bulk' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Bulk Input (Banyak SN)
            </button>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-200 text-red-600 rounded-lg text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="space-y-3 text-xs">
          {tab === 'single' ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs">Serial Number (SN) *</Label>
                <Input
                  className="font-mono uppercase text-xs h-9 mt-1"
                  placeholder="ZTEGC1234567"
                  value={form.serialNumber}
                  onChange={(e) => setForm({ ...form, serialNumber: e.target.value.toUpperCase() })}
                  required
                />
              </div>

              <div>
                <Label className="text-xs">MAC Address</Label>
                <Input
                  className="font-mono text-xs h-9 mt-1"
                  placeholder="AA:BB:CC:DD:EE:FF"
                  maxLength={17}
                  value={form.macAddress}
                  onChange={(e) => setForm({ ...form, macAddress: formatMacAddress(e.target.value, form.macAddress) })}
                />
              </div>

              <div>
                <Label className="text-xs">Vendor</Label>
                <Select value={form.vendor} onValueChange={(v) => setForm({ ...form, vendor: v })}>
                  <SelectTrigger className="h-9 mt-1 text-xs">
                    <SelectValue placeholder="Pilih Vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ZTE">ZTE</SelectItem>
                    <SelectItem value="Skyworth">Skyworth</SelectItem>
                    <SelectItem value="Realtek">Realtek</SelectItem>
                    <SelectItem value="FiberHome">FiberHome</SelectItem>
                    <SelectItem value="Huawei">Huawei</SelectItem>
                    <SelectItem value="VSOL">VSOL</SelectItem>
                    <SelectItem value="Gigalink">Gigalink</SelectItem>
                    <SelectItem value="EFiber">EFiber</SelectItem>
                    <SelectItem value="Other">Lainnya</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Model / Tipe</Label>
                <Input
                  className="text-xs h-9 mt-1"
                  placeholder="F609 V3 / GN542VF"
                  value={form.model}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                />
              </div>

              <div>
                <Label className="text-xs">Kondisi Fisik</Label>
                <Select value={form.condition} onValueChange={(v: any) => setForm({ ...form, condition: v })}>
                  <SelectTrigger className="h-9 mt-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NEW">Baru</SelectItem>
                    <SelectItem value="USED_GOOD">Bekas Bagus</SelectItem>
                    <SelectItem value="DEFECTIVE">Rusak</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Status Unit</Label>
                <Select value={form.status} onValueChange={(v: any) => setForm({ ...form, status: v })}>
                  <SelectTrigger className="h-9 mt-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AVAILABLE">Ready di Gudang</SelectItem>
                    <SelectItem value="IN_USE">Terpasang di Pelanggan</SelectItem>
                    <SelectItem value="DEFECTIVE">Rusak</SelectItem>
                    <SelectItem value="DEPLETED">Nonaktif / Afkir</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2">
                <Label className="text-xs">Lokasi Rak / Penyimpanan</Label>
                <Input
                  className="text-xs h-9 mt-1"
                  placeholder="Rak A-1, Lemari 2, dsb."
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Daftar Serial Number (Satu SN per baris) *</Label>
                <Textarea
                  className="font-mono text-xs mt-1"
                  rows={6}
                  placeholder={`ZTEGD1234567\nSKYW8899AABB\nHWTC55443322`}
                  value={bulkSn}
                  onChange={(e) => setBulkSn(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Vendor Default</Label>
                  <Select value={form.vendor} onValueChange={(v) => setForm({ ...form, vendor: v })}>
                    <SelectTrigger className="h-9 mt-1 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ZTE">ZTE</SelectItem>
                      <SelectItem value="Skyworth">Skyworth</SelectItem>
                      <SelectItem value="Realtek">Realtek</SelectItem>
                      <SelectItem value="FiberHome">FiberHome</SelectItem>
                      <SelectItem value="Huawei">Huawei</SelectItem>
                      <SelectItem value="VSOL">VSOL</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Model Default</Label>
                  <Input
                    className="text-xs h-9 mt-1"
                    placeholder="e.g. F609 V3"
                    value={form.model}
                    onChange={(e) => setForm({ ...form, model: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}

          <div>
            <Label className="text-xs">Catatan Tambahan</Label>
            <Textarea
              className="text-xs mt-1"
              rows={2}
              placeholder="Catatan kondisi atau informasi logistik..."
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Batal
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isEdit ? 'Simpan Perubahan' : 'Tambah Unit ONT'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page: Dedicated ONT Inventory ───────────────────────────────────────

export default function OntInventoryPage() {
  const [assets, setAssets] = useState<InventoryAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 25,
    totalPages: 1,
  });

  // Filters
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterVendor, setFilterVendor] = useState<string>('ALL');

  // Modals & Action states
  const [detailAsset, setDetailAsset] = useState<InventoryAsset | null>(null);
  const [editAsset, setEditAsset] = useState<InventoryAsset | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSyncOltModal, setShowSyncOltModal] = useState(false);

  // ── Fetch ONT assets ───────────────────────────────────────────────────────
  const fetchOntAssets = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          assetType: 'MODEM', // Khusus unit modem ONT
          page: String(page),
          limit: String(pagination.limit),
        });
        if (search) params.set('search', search);
        if (filterStatus !== 'ALL') params.set('status', filterStatus);
        if (filterVendor !== 'ALL') params.set('vendor', filterVendor);

        const res = await fetch(`/api/inventory/assets?${params.toString()}`);
        const data: ApiResponse = await res.json();
        if (data.success) {
          setAssets(data.assets);
          setStatusCounts(data.statusCounts);
          setPagination(data.pagination);
        }
      } catch (e) {
        console.error('Failed to fetch ONT assets:', e);
      } finally {
        setLoading(false);
      }
    },
    [search, filterStatus, filterVendor, pagination.limit]
  );

  useEffect(() => {
    fetchOntAssets(1);
  }, [fetchOntAssets]);

  const handleSaved = () => {
    setShowAddModal(false);
    setEditAsset(null);
    fetchOntAssets(pagination.page);
  };

  const totalOnt = pagination.total || Object.values(statusCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="p-6 space-y-6">
      {/* Top Module Navigation */}
      <div className="flex items-center gap-2 border-b border-border pb-3 overflow-x-auto text-xs font-medium">
        <Link
          href="/admin/inventory/items"
          className="px-3 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          Katalog Master Barang
        </Link>
        <Link
          href="/admin/inventory/ont"
          className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary font-semibold border border-primary/20 transition-colors flex items-center gap-1.5"
        >
          <Wifi className="w-3.5 h-3.5" />
          Modem ONT Pelanggan
        </Link>
        <Link
          href="/admin/inventory/assets"
          className="px-3 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          Aset Roll Kabel & Lainnya
        </Link>
        <Link
          href="/admin/inventory/movements"
          className="px-3 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          Riwayat Masuk/Keluar
        </Link>
        <Link
          href="/admin/inventory/kits"
          className="px-3 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          Kit Standar SPK
        </Link>
        <Link
          href="/admin/inventory/categories"
          className="px-3 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          Kategori
        </Link>
        <Link
          href="/admin/inventory/suppliers"
          className="px-3 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          Supplier
        </Link>
      </div>

      {/* Page Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <Wifi className="w-5 h-5 text-primary" />
            Inventori Modem ONT Pelanggan
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Daftar lengkap unit modem ONT, status di lapangan, dan relasi langsung ke akun PPPoE pelanggan
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSyncOltModal(true)}
            className="border-primary/40 text-primary hover:bg-primary/10 font-medium"
          >
            <Server className="w-4 h-4 mr-1.5" />
            Tarik Data OLT
          </Button>
          <Button onClick={() => setShowAddModal(true)} size="sm">
            <Plus className="w-4 h-4 mr-1.5" />
            Tambah Modem
          </Button>
        </div>
      </div>

      {/* Summary Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card
          className={`border-border cursor-pointer transition-colors ${
            filterStatus === 'ALL' ? 'border-primary bg-primary/5' : 'hover:bg-muted/30'
          }`}
          onClick={() => setFilterStatus('ALL')}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Total Unit ONT</p>
              <p className="text-2xl font-bold text-foreground mt-0.5">{totalOnt}</p>
            </div>
            <Wifi className="w-7 h-7 text-primary/40" />
          </CardContent>
        </Card>

        <Card
          className={`border-border cursor-pointer transition-colors ${
            filterStatus === 'IN_USE' ? 'border-blue-500 bg-blue-500/5' : 'hover:bg-muted/30'
          }`}
          onClick={() => setFilterStatus('IN_USE')}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Terpasang di Pelanggan</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                {statusCounts['IN_USE'] ?? 0}
              </p>
            </div>
            <UserCheck className="w-7 h-7 text-blue-500/40" />
          </CardContent>
        </Card>

        <Card
          className={`border-border cursor-pointer transition-colors ${
            filterStatus === 'AVAILABLE' ? 'border-green-500 bg-green-500/5' : 'hover:bg-muted/30'
          }`}
          onClick={() => setFilterStatus('AVAILABLE')}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-green-600 dark:text-green-400 font-medium">Ready di Gudang</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-0.5">
                {statusCounts['AVAILABLE'] ?? 0}
              </p>
            </div>
            <PackageCheck className="w-7 h-7 text-green-500/40" />
          </CardContent>
        </Card>

        <Card
          className={`border-border cursor-pointer transition-colors ${
            filterStatus === 'DEFECTIVE' ? 'border-red-500 bg-red-500/5' : 'hover:bg-muted/30'
          }`}
          onClick={() => setFilterStatus('DEFECTIVE')}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-red-600 dark:text-red-400 font-medium">Rusak / Defektif</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-0.5">
                {statusCounts['DEFECTIVE'] ?? 0}
              </p>
            </div>
            <AlertTriangle className="w-7 h-7 text-red-500/40" />
          </CardContent>
        </Card>
      </div>

      {/* Filter & Search Bar */}
      <Card className="border-border bg-card">
        <CardContent className="py-3 px-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                className="pl-8 h-8 text-xs"
                placeholder="Cari Serial Number (SN), MAC, Nama Pelanggan, atau Username..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Vendor Filter */}
            <Select value={filterVendor} onValueChange={setFilterVendor}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue placeholder="Semua Vendor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua Vendor</SelectItem>
                <SelectItem value="ZTE">ZTE</SelectItem>
                <SelectItem value="Skyworth">Skyworth</SelectItem>
                <SelectItem value="Realtek">Realtek</SelectItem>
                <SelectItem value="FiberHome">FiberHome</SelectItem>
                <SelectItem value="Huawei">Huawei</SelectItem>
                <SelectItem value="VSOL">VSOL</SelectItem>
                <SelectItem value="Gigalink">Gigalink</SelectItem>
                <SelectItem value="EFiber">EFiber</SelectItem>
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px] h-8 text-xs">
                <SelectValue placeholder="Semua Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua Status</SelectItem>
                <SelectItem value="IN_USE">Terpasang (In-Use)</SelectItem>
                <SelectItem value="AVAILABLE">Ready di Gudang</SelectItem>
                <SelectItem value="DEFECTIVE">Rusak (Defective)</SelectItem>
                <SelectItem value="DEPLETED">Nonaktif / Afkir</SelectItem>
              </SelectContent>
            </Select>

            {(search || filterStatus !== 'ALL' || filterVendor !== 'ALL') && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground"
                onClick={() => {
                  setSearch('');
                  setFilterStatus('ALL');
                  setFilterVendor('ALL');
                }}
              >
                Reset Filter
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Main Table */}
      <Card className="border-border bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead className="w-12 text-xs">No</TableHead>
                <TableHead className="text-xs">Serial Number (SN)</TableHead>
                <TableHead className="text-xs">Vendor & Model</TableHead>
                <TableHead className="text-xs">Status Unit</TableHead>
                <TableHead className="text-xs">Kondisi</TableHead>
                <TableHead className="text-xs">Pelanggan PPPoE Terhubung</TableHead>
                <TableHead className="text-xs">Lokasi / Catatan</TableHead>
                <TableHead className="w-20 text-xs text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                    Memuat data modem ONT...
                  </TableCell>
                </TableRow>
              ) : assets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-14 text-muted-foreground">
                    <Wifi className="w-10 h-10 mx-auto mb-2 text-muted-foreground/40" />
                    <p className="font-medium text-sm">Tidak ada modem ONT yang sesuai filter</p>
                    <p className="text-xs mt-1 text-muted-foreground">
                      Jika database baru, klik tombol &quot;Import 360 ONT Awal&quot; di kanan atas untuk memuat data awal.
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                assets.map((asset, idx) => {
                  const vendorColor = VENDOR_COLORS[asset.vendor || ''] || 'bg-muted text-muted-foreground';
                  const rowNum = (pagination.page - 1) * pagination.limit + idx + 1;

                  return (
                    <TableRow key={asset.id} className="border-border hover:bg-muted/20">
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {rowNum}
                      </TableCell>

                      <TableCell>
                        <div className="font-mono text-xs font-semibold text-foreground flex items-center gap-1.5">
                          {asset.serialNumber || '-'}
                          {asset.serialNumber && (
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(asset.serialNumber!);
                                alert(`SN ${asset.serialNumber} disalin!`);
                              }}
                              className="text-muted-foreground/60 hover:text-foreground"
                              title="Salin SN"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        {asset.macAddress && (
                          <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                            MAC: {asset.macAddress}
                          </p>
                        )}
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {asset.vendor && (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${vendorColor}`}>
                              {asset.vendor}
                            </span>
                          )}
                          <span className="text-xs font-medium text-foreground">
                            {asset.model || '-'}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell>
                        <StatusBadge status={asset.status} />
                      </TableCell>

                      <TableCell>
                        <span className={`text-xs font-medium ${CONDITION_CONFIG[asset.condition]?.color || ''}`}>
                          {CONDITION_CONFIG[asset.condition]?.label || asset.condition}
                        </span>
                      </TableCell>

                      <TableCell>
                        {asset.customer ? (
                          <div className="space-y-0.5">
                            <Link
                              href={`/admin/pppoe/users/${asset.customer.id}`}
                              className="font-semibold text-xs text-foreground hover:text-primary hover:underline flex items-center gap-1"
                              target="_blank"
                            >
                              {asset.customer.name}
                              <ExternalLink className="w-3 h-3 text-muted-foreground" />
                            </Link>
                            <p className="text-[11px] font-mono text-muted-foreground">
                              @{asset.customer.username}
                              {asset.customer.phone && ` • ${asset.customer.phone}`}
                            </p>
                          </div>
                        ) : (
                          <span className="text-[11px] text-muted-foreground italic">
                            Belum terpasang (Gudang)
                          </span>
                        )}
                      </TableCell>

                      <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate">
                        {asset.location || asset.notes || '-'}
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                            onClick={() => setDetailAsset(asset)}
                            title="Lihat Detail"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                            onClick={() => setEditAsset(asset)}
                            title="Edit Data Modem"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border text-xs text-muted-foreground">
            <div>
              Menampilkan {assets.length} dari {pagination.total} modem ONT
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => fetchOntAssets(pagination.page - 1)}
                className="h-7 px-2"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <span>
                Halaman {pagination.page} dari {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchOntAssets(pagination.page + 1)}
                className="h-7 px-2"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Modals */}
      <OntDetailModal asset={detailAsset} onClose={() => setDetailAsset(null)} />
      <OntFormModal
        open={showAddModal || !!editAsset}
        asset={editAsset}
        onClose={() => {
          setShowAddModal(false);
          setEditAsset(null);
        }}
        onSaved={handleSaved}
      />
      <SyncOltModal
        open={showSyncOltModal}
        onClose={() => setShowSyncOltModal(false)}
        onSuccess={() => fetchOntAssets(pagination.page)}
      />
    </div>
  );
}
