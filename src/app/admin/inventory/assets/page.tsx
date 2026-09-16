'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Wifi,
  Package,
  Server,
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
} from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatMacAddress } from '@/lib/mac-format';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

// ─── Types ────────────────────────────────────────────────────────────────────

type AssetStatus = 'AVAILABLE' | 'IN_USE' | 'DEFECTIVE' | 'DEPLETED' | 'RESERVED';
type AssetType = 'MODEM' | 'CABLE_ROLL' | 'ROUTER' | 'OTHER';
type AssetCondition = 'NEW' | 'GOOD' | 'DAMAGED' | 'SCRAP';

interface InventoryAsset {
  id: string;
  assetType: AssetType;
  serialNumber: string;
  macAddress: string | null;
  vendor: string | null;
  model: string | null;
  initialLength: number | null;
  remainingLength: number | null;
  condition: AssetCondition;
  status: AssetStatus;
  location: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  item: {
    id: string;
    sku: string;
    name: string;
    unit: string;
    categoryCode: string | null;
  } | null;
  customer: {
    id: string;
    name: string;
    username: string;
    customerId: string;
    phone: string | null;
  } | null;
}

interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  unit: string;
  categoryCode: string | null;
  subCategory: string | null;
  isSerialized: boolean;
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

interface FormData {
  itemId: string;
  assetType: AssetType;
  serialNumber: string;
  macAddress: string;
  vendor: string;
  model: string;
  condition: AssetCondition;
  status: AssetStatus;
  initialLength: string;
  remainingLength: string;
  location: string;
  notes: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<AssetStatus, { label: string; className: string }> = {
  AVAILABLE: { label: 'Tersedia', className: 'bg-green-100 text-green-700 border-green-200' },
  IN_USE: { label: 'Dipakai', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  DEFECTIVE: { label: 'Defektif', className: 'bg-red-100 text-red-700 border-red-200' },
  DEPLETED: { label: 'Depleted', className: 'bg-gray-100 text-gray-600 border-gray-200' },
  RESERVED: { label: 'Reserved', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
};

const CONDITION_LABELS: Record<AssetCondition, string> = {
  NEW: 'Baru',
  GOOD: 'Baik',
  DAMAGED: 'Rusak',
  SCRAP: 'Scrap',
};

const ASSET_TYPE_CONFIG: Record<AssetType, { label: string; icon: React.ReactNode }> = {
  MODEM: { label: 'Modem/ONT', icon: <Wifi className="w-3 h-3" /> },
  CABLE_ROLL: { label: 'Kabel Roll', icon: <Package className="w-3 h-3" /> },
  ROUTER: { label: 'Router', icon: <Server className="w-3 h-3" /> },
  OTHER: { label: 'Lainnya', icon: <Package className="w-3 h-3" /> },
};

const DEFAULT_FORM: FormData = {
  itemId: '',
  assetType: 'MODEM',
  serialNumber: '',
  macAddress: '',
  vendor: '',
  model: '',
  condition: 'NEW',
  status: 'AVAILABLE',
  initialLength: '',
  remainingLength: '',
  location: '',
  notes: '',
};

// ─── Summary Card ─────────────────────────────────────────────────────────────

function SummaryCard({
  label,
  count,
  active,
  onClick,
  className,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <Card
      onClick={onClick}
      className={`cursor-pointer transition-all border ${
        active ? 'ring-2 ring-primary border-primary/40' : 'border-border hover:border-primary/30'
      }`}
    >
      <CardContent className="py-4 px-5">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <p className={`text-2xl font-bold ${className ?? 'text-foreground'}`}>{count}</p>
      </CardContent>
    </Card>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: AssetStatus }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, className: '' };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${cfg.className}`}
    >
      {cfg.label}
    </span>
  );
}

// ─── AssetType Badge ──────────────────────────────────────────────────────────

function AssetTypeBadge({ assetType }: { assetType: AssetType }) {
  const cfg = ASSET_TYPE_CONFIG[assetType] ?? { label: assetType, icon: null };
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-muted/50 border border-border text-foreground">
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────

function DetailModal({
  asset,
  onClose,
}: {
  asset: InventoryAsset;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Detail Aset</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            <div>
              <p className="text-xs text-muted-foreground">SN / Kode Roll</p>
              <p className="font-mono font-medium">{asset.serialNumber}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Tipe Aset</p>
              <AssetTypeBadge assetType={asset.assetType} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <StatusBadge status={asset.status} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Kondisi</p>
              <p>{CONDITION_LABELS[asset.condition] ?? asset.condition}</p>
            </div>
            {asset.macAddress && (
              <div>
                <p className="text-xs text-muted-foreground">MAC Address</p>
                <p className="font-mono text-xs">{asset.macAddress}</p>
              </div>
            )}
            {asset.vendor && (
              <div>
                <p className="text-xs text-muted-foreground">Vendor</p>
                <p>{asset.vendor}</p>
              </div>
            )}
            {asset.model && (
              <div>
                <p className="text-xs text-muted-foreground">Model</p>
                <p>{asset.model}</p>
              </div>
            )}
            {asset.assetType === 'CABLE_ROLL' && (
              <>
                <div>
                  <p className="text-xs text-muted-foreground">Panjang Awal</p>
                  <p>{asset.initialLength != null ? `${asset.initialLength} m` : '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Sisa Panjang</p>
                  <p>{asset.remainingLength != null ? `${asset.remainingLength} m` : '-'}</p>
                </div>
              </>
            )}
            {asset.location && (
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground">Lokasi</p>
                <p>{asset.location}</p>
              </div>
            )}
            {asset.item && (
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground">Item Master</p>
                <p>
                  <span className="font-mono text-xs mr-2 text-muted-foreground">{asset.item.sku}</span>
                  {asset.item.name}
                </p>
              </div>
            )}
            {asset.customer && (
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground">Pelanggan</p>
                <p>
                  {asset.customer.name}
                  <span className="ml-2 text-muted-foreground text-xs">({asset.customer.username})</span>
                </p>
              </div>
            )}
            {asset.notes && (
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground">Catatan</p>
                <p className="text-xs">{asset.notes}</p>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Add/Edit Asset Modal ─────────────────────────────────────────────────────

function AssetFormModal({
  initial,
  items,
  onClose,
  onSaved,
}: {
  initial: InventoryAsset | null;
  items: InventoryItem[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!initial;
  const [form, setForm] = useState<FormData>(
    initial
      ? {
          itemId: initial.item?.id ?? '',
          assetType: initial.assetType,
          serialNumber: initial.serialNumber,
          macAddress: initial.macAddress ?? '',
          vendor: initial.vendor ?? '',
          model: initial.model ?? '',
          condition: initial.condition,
          status: initial.status,
          initialLength: initial.initialLength != null ? String(initial.initialLength) : '',
          remainingLength: initial.remainingLength != null ? String(initial.remainingLength) : '',
          location: initial.location ?? '',
          notes: initial.notes ?? '',
        }
      : DEFAULT_FORM
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (key: keyof FormData, val: string) => setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = async () => {
    if (!form.serialNumber.trim()) {
      setError('Nomor seri / kode roll wajib diisi');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload: Record<string, unknown> = {
        itemId: form.itemId || undefined,
        assetType: form.assetType,
        serialNumber: form.serialNumber,
        macAddress: form.macAddress || undefined,
        vendor: form.vendor || undefined,
        model: form.model || undefined,
        condition: form.condition,
        status: form.status,
        location: form.location || undefined,
        notes: form.notes || undefined,
      };
      if (form.assetType === 'CABLE_ROLL') {
        if (form.initialLength) payload.initialLength = parseFloat(form.initialLength);
        if (form.remainingLength) payload.remainingLength = parseFloat(form.remainingLength);
      }

      const url = isEdit
        ? `/api/inventory/assets/${initial!.id}`
        : '/api/inventory/assets';
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan aset');
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Aset' : 'Tambah Aset Baru'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Tipe Aset */}
          <div className="space-y-1.5">
            <Label>Tipe Aset</Label>
            <Select value={form.assetType} onValueChange={(v) => set('assetType', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ASSET_TYPE_CONFIG) as AssetType[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {ASSET_TYPE_CONFIG[t].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Item Master */}
          <div className="space-y-1.5">
            <Label>Item Katalog (SKU)</Label>
            <Select value={form.itemId} onValueChange={(v) => set('itemId', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih item master..." />
              </SelectTrigger>
              <SelectContent>
                {items.map((it) => (
                  <SelectItem key={it.id} value={it.id}>
                    <span className="font-mono text-xs text-muted-foreground mr-2">{it.sku}</span>
                    {it.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* SN / Kode Roll */}
          <div className="space-y-1.5">
            <Label>
              SN / Kode Roll <span className="text-destructive">*</span>
            </Label>
            <Input
              value={form.serialNumber}
              onChange={(e) => set('serialNumber', e.target.value)}
              placeholder="Masukkan nomor seri atau kode roll..."
            />
          </div>

          {/* MAC Address */}
          {form.assetType !== 'CABLE_ROLL' && (
            <div className="space-y-1.5">
              <Label>MAC Address (opsional)</Label>
              <Input
                value={form.macAddress}
                onChange={(e) => set('macAddress', formatMacAddress(e.target.value, form.macAddress))}
                placeholder="AA:BB:CC:DD:EE:FF"
                maxLength={17}
                className="font-mono text-xs"
              />
            </div>
          )}

          {/* Vendor & Model */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Vendor</Label>
              <Input value={form.vendor} onChange={(e) => set('vendor', e.target.value)} placeholder="ZTE, Huawei..." />
            </div>
            <div className="space-y-1.5">
              <Label>Model</Label>
              <Input value={form.model} onChange={(e) => set('model', e.target.value)} placeholder="F609 V3..." />
            </div>
          </div>

          {/* Cable-specific fields */}
          {form.assetType === 'CABLE_ROLL' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Panjang Awal (m)</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.initialLength}
                  onChange={(e) => set('initialLength', e.target.value)}
                  placeholder="250"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Sisa Panjang (m)</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.remainingLength}
                  onChange={(e) => set('remainingLength', e.target.value)}
                  placeholder="250"
                />
              </div>
            </div>
          )}

          {/* Kondisi & Status */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Kondisi</Label>
              <Select value={form.condition} onValueChange={(v) => set('condition', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(CONDITION_LABELS) as [AssetCondition, string][]).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => set('status', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(STATUS_CONFIG) as [AssetStatus, { label: string }][]).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Lokasi */}
          <div className="space-y-1.5">
            <Label>Lokasi</Label>
            <Input value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="Gudang A, Rak 3..." />
          </div>

          {/* Catatan */}
          <div className="space-y-1.5">
            <Label>Catatan</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="Catatan tambahan..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Batal
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isEdit ? 'Simpan Perubahan' : 'Tambah Aset'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function InventoryAssetsPage() {
  const [assets, setAssets] = useState<InventoryAsset[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 1,
  });

  // Filters
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Modals
  const [detailAsset, setDetailAsset] = useState<InventoryAsset | null>(null);
  const [editAsset, setEditAsset] = useState<InventoryAsset | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [importing, setImporting] = useState(false);

  const handleImportInitialModems = async () => {
    if (!confirm('Impor 360 data ONT awal pelanggan ke sistem inventori? Data akan langsung dicocokkan dengan akun pelanggan PPPoE yang ada di sistem.')) {
      return;
    }
    setImporting(true);
    try {
      const res = await fetch('/api/admin/inventory/import-initial-modems', {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        fetchAssets(1);
      } else {
        alert(data.error || 'Gagal mengimpor data awal ONT');
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setImporting(false);
    }
  };

  // ── Fetch assets ───────────────────────────────────────────────────────────
  const fetchAssets = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(pagination.limit),
        });
        if (search) params.set('search', search);
        if (filterType !== 'ALL') params.set('assetType', filterType);
        if (filterStatus !== 'ALL') params.set('status', filterStatus);

        const res = await fetch(`/api/inventory/assets?${params.toString()}`);
        const data: ApiResponse = await res.json();
        if (data.success) {
          setAssets(data.assets);
          setStatusCounts(data.statusCounts);
          setPagination(data.pagination);
        }
      } catch (e) {
        console.error('Failed to fetch assets:', e);
      } finally {
        setLoading(false);
      }
    },
    [search, filterType, filterStatus, pagination.limit]
  );

  // ── Fetch serialized items for dropdown ────────────────────────────────────
  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch('/api/inventory/items?isSerialized=true');
      const data: InventoryItem[] = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to fetch items:', e);
    }
  }, []);

  useEffect(() => {
    fetchAssets(1);
  }, [fetchAssets]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleSaved = () => {
    setShowAddModal(false);
    setEditAsset(null);
    fetchAssets(pagination.page);
  };

  const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);

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
          className="px-3 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          Modem ONT Pelanggan
        </Link>
        <Link
          href="/admin/inventory/assets"
          className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary font-semibold border border-primary/20 transition-colors"
        >
          Unit Aset & Roll Kabel (Tracking SN/Pelanggan)
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

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Unit Aset & Roll Kabel</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Tracking individual unit ONT modem per Serial Number dan sisa meteran kabel dropcore
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleImportInitialModems}
            disabled={importing}
            className="border-primary/40 text-primary hover:bg-primary/10"
            title="Impor 360 data ONT awal pelanggan dan tautkan ke PPPoE"
          >
            {importing ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <Upload className="w-4 h-4 mr-1.5" />
            )}
            Import 360 ONT Awal
          </Button>
          <Button onClick={() => setShowAddModal(true)} size="sm">
            <Plus className="w-4 h-4 mr-1.5" />
            Tambah Aset
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <SummaryCard
          label="Total Aset"
          count={total}
          active={filterStatus === 'ALL'}
          onClick={() => setFilterStatus('ALL')}
        />
        <SummaryCard
          label="Tersedia"
          count={statusCounts['AVAILABLE'] ?? 0}
          active={filterStatus === 'AVAILABLE'}
          onClick={() => setFilterStatus('AVAILABLE')}
          className="text-green-600"
        />
        <SummaryCard
          label="Dipakai"
          count={statusCounts['IN_USE'] ?? 0}
          active={filterStatus === 'IN_USE'}
          onClick={() => setFilterStatus('IN_USE')}
          className="text-blue-600"
        />
        <SummaryCard
          label="Defektif"
          count={statusCounts['DEFECTIVE'] ?? 0}
          active={filterStatus === 'DEFECTIVE'}
          onClick={() => setFilterStatus('DEFECTIVE')}
          className="text-red-600"
        />
        <SummaryCard
          label="Depleted"
          count={statusCounts['DEPLETED'] ?? 0}
          active={filterStatus === 'DEPLETED'}
          onClick={() => setFilterStatus('DEPLETED')}
          className="text-muted-foreground"
        />
      </div>

      {/* Filter Bar */}
      <Card className="border-border bg-card">
        <CardContent className="py-3 px-4">
          <div className="flex flex-wrap gap-3 items-center">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                className="pl-8 h-8 text-sm"
                placeholder="Cari SN, MAC, vendor..."
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

            {/* Asset Type */}
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="h-8 w-[150px] text-sm">
                <SelectValue placeholder="Semua Tipe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua Tipe</SelectItem>
                {(Object.keys(ASSET_TYPE_CONFIG) as AssetType[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {ASSET_TYPE_CONFIG[t].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status pills */}
            <div className="flex gap-1.5 flex-wrap">
              {['ALL', ...Object.keys(STATUS_CONFIG)].map((s) => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-all ${
                    filterStatus === s
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-transparent border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
                  }`}
                >
                  {s === 'ALL' ? 'Semua Status' : STATUS_CONFIG[s as AssetStatus].label}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-border bg-card">
        <CardHeader className="py-3 px-4 border-b border-border">
          <CardTitle className="text-sm font-medium">
            {loading ? 'Memuat...' : `${pagination.total} unit aset`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : assets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Package className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">Tidak ada aset ditemukan</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="text-xs">SN / Kode Roll</TableHead>
                  <TableHead className="text-xs">Tipe</TableHead>
                  <TableHead className="text-xs">Vendor / Model</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Kondisi</TableHead>
                  <TableHead className="text-xs">Sisa (m)</TableHead>
                  <TableHead className="text-xs">Pelanggan</TableHead>
                  <TableHead className="text-xs">Lokasi</TableHead>
                  <TableHead className="text-xs text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assets.map((asset) => (
                  <TableRow key={asset.id} className="text-sm">
                    <TableCell className="font-mono text-xs font-medium">
                      {asset.serialNumber}
                      {asset.macAddress && (
                        <div className="text-muted-foreground text-[10px] mt-0.5">{asset.macAddress}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <AssetTypeBadge assetType={asset.assetType} />
                    </TableCell>
                    <TableCell>
                      <span className="text-foreground">{asset.vendor ?? '-'}</span>
                      {asset.model && (
                        <span className="text-muted-foreground ml-1 text-xs">{asset.model}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={asset.status} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {CONDITION_LABELS[asset.condition] ?? asset.condition}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {asset.assetType === 'CABLE_ROLL' && asset.remainingLength != null
                        ? `${asset.remainingLength} m`
                        : '-'}
                    </TableCell>
                    <TableCell className="text-xs">
                      {asset.customer ? (
                        <span>
                          {asset.customer.name}
                          <span className="text-muted-foreground ml-1">
                            ({asset.customer.customerId})
                          </span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {asset.location ?? '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-7 h-7"
                          onClick={() => setDetailAsset(asset)}
                          title="Detail"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-7 h-7"
                          onClick={() => setEditAsset(asset)}
                          title="Edit"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <p className="text-xs text-muted-foreground">
              Halaman {pagination.page} dari {pagination.totalPages} &mdash; {pagination.total} item
            </p>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="icon"
                className="w-7 h-7"
                disabled={pagination.page <= 1}
                onClick={() => fetchAssets(pagination.page - 1)}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="w-7 h-7"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchAssets(pagination.page + 1)}
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Modals */}
      {detailAsset && (
        <DetailModal asset={detailAsset} onClose={() => setDetailAsset(null)} />
      )}

      {(showAddModal || editAsset) && (
        <AssetFormModal
          initial={editAsset}
          items={items}
          onClose={() => {
            setShowAddModal(false);
            setEditAsset(null);
          }}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
