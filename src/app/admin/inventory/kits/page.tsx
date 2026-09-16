'use client';

import { useState, useEffect, useMemo } from 'react';
import { showSuccess, showError, showConfirm } from '@/lib/sweetalert';
import { useTranslation } from '@/hooks/useTranslation';
import {
  Wrench,
  Package,
  Plus,
  Trash2,
  Edit,
  RefreshCcw,
  Layers,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  Zap,
  Boxes,
  FileSpreadsheet,
} from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

interface InventoryItemSummary {
  id: string;
  sku: string;
  name: string;
  unit: string;
  categoryCode?: string | null;
  subCategory?: string | null;
  currentStock: number;
  packSize?: number | null;
  isSerialized?: boolean;
}

interface KitItem {
  id: string;
  kitId: string;
  itemId: string;
  defaultQty: number;
  item: InventoryItemSummary;
}

interface Kit {
  id: string;
  issueType: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  items: KitItem[];
}

const COMMON_ISSUE_TYPES = [
  { value: 'INSTALLATION', label: 'INSTALLATION (Pasang Baru / PSB)' },
  { value: 'REPAIR', label: 'REPAIR (Perbaikan Gangguan / Los)' },
  { value: 'MAINTENANCE', label: 'MAINTENANCE (Pemeliharaan Rutin)' },
  { value: 'DISMANTLE', label: 'DISMANTLE (Bongkar / Penarikan)' },
  { value: 'SURVEY', label: 'SURVEY (Survei Lokasi)' },
];

export default function InventoryKitsPage() {
  const { t } = useTranslation();
  const [kits, setKits] = useState<Kit[]>([]);
  const [warehouseItems, setWarehouseItems] = useState<InventoryItemSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterIssueType, setFilterIssueType] = useState('ALL');

  // Kit Dialog
  const [isKitDialogOpen, setIsKitDialogOpen] = useState(false);
  const [editingKit, setEditingKit] = useState<Kit | null>(null);
  const [kitForm, setKitForm] = useState({
    issueType: 'INSTALLATION',
    customIssueType: '',
    name: '',
    isActive: true,
  });

  // Item Dialog
  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [activeKitForItem, setActiveKitForItem] = useState<Kit | null>(null);
  const [editingKitItem, setEditingKitItem] = useState<KitItem | null>(null);
  const [itemForm, setItemForm] = useState({
    itemId: '',
    defaultQty: 1,
  });

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [kitsRes, itemsRes] = await Promise.all([
        fetch('/api/inventory/kits'),
        fetch('/api/inventory/items'),
      ]);

      if (kitsRes.ok) {
        const data = await kitsRes.json();
        setKits(data.kits || []);
      }
      if (itemsRes.ok) {
        const data = await itemsRes.json();
        const rawItems = Array.isArray(data) ? data : data.items || [];
        // Filter out serialized items (ont modem), keep consumables, cables, passive
        setWarehouseItems(rawItems);
      }
    } catch (error) {
      await showError('Gagal memuat data Kit Standar');
    } finally {
      setLoading(false);
    }
  };

  // Filtered kits
  const filteredKits = useMemo(() => {
    return kits.filter((kit) => {
      const matchType = filterIssueType === 'ALL' || kit.issueType === filterIssueType;
      const matchSearch =
        !searchQuery ||
        kit.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        kit.issueType.toLowerCase().includes(searchQuery.toLowerCase()) ||
        kit.items.some(
          (ki) =>
            ki.item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            ki.item.sku.toLowerCase().includes(searchQuery.toLowerCase())
        );
      return matchType && matchSearch;
    });
  }, [kits, filterIssueType, searchQuery]);

  // Overall stats
  const stats = useMemo(() => {
    const totalKits = kits.length;
    const activeKits = kits.filter((k) => k.isActive).length;
    const totalAssignedItems = kits.reduce((acc, k) => acc + k.items.length, 0);
    return { totalKits, activeKits, totalAssignedItems };
  }, [kits]);

  // Handle create or update Kit
  const handleOpenKitDialog = (kit?: Kit) => {
    if (kit) {
      setEditingKit(kit);
      const isPredefined = COMMON_ISSUE_TYPES.some((t) => t.value === kit.issueType);
      setKitForm({
        issueType: isPredefined ? kit.issueType : 'CUSTOM',
        customIssueType: isPredefined ? '' : kit.issueType,
        name: kit.name,
        isActive: kit.isActive,
      });
    } else {
      setEditingKit(null);
      setKitForm({
        issueType: 'INSTALLATION',
        customIssueType: '',
        name: 'Kit Standar PSB (Instalasi Baru)',
        isActive: true,
      });
    }
    setIsKitDialogOpen(true);
  };

  const handleSubmitKit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalIssueType =
      kitForm.issueType === 'CUSTOM'
        ? kitForm.customIssueType.trim().toUpperCase()
        : kitForm.issueType;

    if (!finalIssueType) {
      await showError('Tipe SPK (issueType) wajib diisi');
      return;
    }
    if (!kitForm.name.trim()) {
      await showError('Nama Kit wajib diisi');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        issueType: finalIssueType,
        name: kitForm.name.trim(),
        isActive: kitForm.isActive,
      };

      const url = editingKit ? `/api/inventory/kits/${editingKit.id}` : '/api/inventory/kits';
      const method = editingKit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        await showSuccess(editingKit ? 'Kit berhasil diperbarui' : 'Kit berhasil dibuat');
        setIsKitDialogOpen(false);
        loadData();
      } else {
        await showError(data.error || 'Gagal menyimpan kit');
      }
    } catch (err) {
      await showError('Terjadi kesalahan saat menyimpan kit');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteKit = async (kit: Kit) => {
    const confirmed = await showConfirm(
      'Hapus Kit Standar',
      `Yakin ingin menghapus kit "${kit.name}"? Item material di dalamnya akan dilepas dari auto-deduct.`
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/inventory/kits/${kit.id}`, { method: 'DELETE' });
      if (res.ok) {
        await showSuccess('Kit berhasil dihapus');
        loadData();
      } else {
        const data = await res.json();
        await showError(data.error || 'Gagal menghapus kit');
      }
    } catch (err) {
      await showError('Terjadi kesalahan saat menghapus kit');
    }
  };

  // Handle Add / Edit Kit Item
  const handleOpenItemDialog = (kit: Kit, kitItem?: KitItem) => {
    setActiveKitForItem(kit);
    if (kitItem) {
      setEditingKitItem(kitItem);
      setItemForm({
        itemId: kitItem.itemId,
        defaultQty: kitItem.defaultQty,
      });
    } else {
      setEditingKitItem(null);
      setItemForm({
        itemId: '',
        defaultQty: 1,
      });
    }
    setIsItemDialogOpen(true);
  };

  const handleSubmitItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeKitForItem) return;

    if (!itemForm.itemId) {
      await showError('Pilih barang material terlebih dahulu');
      return;
    }
    if (itemForm.defaultQty <= 0) {
      await showError('Qty default per SPK harus lebih dari 0');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/inventory/kits/${activeKitForItem.id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: itemForm.itemId,
          defaultQty: itemForm.defaultQty,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        await showSuccess('Material berhasil ditambahkan ke Kit');
        setIsItemDialogOpen(false);
        loadData();
      } else {
        await showError(data.error || 'Gagal menambahkan material ke kit');
      }
    } catch (err) {
      await showError('Terjadi kesalahan saat menambahkan material');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteItem = async (kit: Kit, kitItem: KitItem) => {
    const confirmed = await showConfirm(
      'Hapus Material dari Kit',
      `Yakin ingin melepas ${kitItem.item.name} dari kit ${kit.name}? Material ini tidak akan terpotong otomatis lagi.`
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/inventory/kits/${kit.id}/items/${kitItem.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await showSuccess('Material berhasil dilepas dari kit');
        loadData();
      } else {
        const data = await res.json();
        await showError(data.error || 'Gagal melepas material');
      }
    } catch (err) {
      await showError('Terjadi kesalahan saat melepas material');
    }
  };

  return (
    <div className="space-y-6">
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
          className="px-3 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
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
          className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary font-semibold border border-primary/20 transition-colors"
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" />
            Kit Standar SPK & Auto-Deduct
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Daftar material consumable dan pasif yang otomatis terpotong saat teknisi menyelesaikan SPK
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="h-9 gap-1.5"
          >
            <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Muat Ulang
          </Button>
          <Button
            size="sm"
            onClick={() => handleOpenKitDialog()}
            className="h-9 gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Buat Kit Baru
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Total Template Kit</p>
              <p className="text-xl font-bold text-foreground mt-1">{stats.totalKits}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {stats.activeKits} aktif terhubung ke SPK
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Boxes className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Total Material Terhubung</p>
              <p className="text-xl font-bold text-foreground mt-1">{stats.totalAssignedItems}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Otomatis dikurangi saat SPK Complete
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Package className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Mode Pengurangan</p>
              <div className="flex items-center gap-1.5 mt-1">
                <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs">
                  Soft-Limit Aktif
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Penyelesaian SPK tidak pernah diblokir walau stok 0
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Zap className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search */}
      <Card className="border-border">
        <CardContent className="p-3">
          <div className="flex flex-col md:flex-row gap-2.5 items-stretch md:items-center justify-between">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="relative min-w-[220px] flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cari nama kit, tipe SPK, atau nama material..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-9 text-xs"
                />
              </div>

              <div className="w-[200px]">
                <Select value={filterIssueType} onValueChange={setFilterIssueType}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Filter Tipe SPK" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL" className="text-xs">Semua Tipe SPK</SelectItem>
                    {COMMON_ISSUE_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value} className="text-xs">
                        {t.value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {(filterIssueType !== 'ALL' || searchQuery) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFilterIssueType('ALL');
                    setSearchQuery('');
                  }}
                  className="h-9 text-xs text-muted-foreground hover:text-foreground"
                >
                  Reset Filter
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Kits List */}
      {loading ? (
        <Card className="border-border p-12 text-center text-muted-foreground text-sm">
          <RefreshCcw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
          Memuat Kit Standar SPK...
        </Card>
      ) : filteredKits.length === 0 ? (
        <Card className="border-border p-12 text-center text-muted-foreground text-sm">
          <AlertCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground/60" />
          <p className="font-medium text-foreground">Tidak ada Kit Standar yang ditemukan</p>
          <p className="text-xs text-muted-foreground mt-1">
            Klik tombol &quot;Buat Kit Baru&quot; di atas untuk mendaftarkan paket material standar SPK.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredKits.map((kit) => (
            <Card key={kit.id} className="border-border overflow-hidden">
              <CardHeader className="bg-muted/20 pb-3 border-b border-border">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-base font-semibold">{kit.name}</CardTitle>
                      <Badge variant="outline" className="font-mono text-[11px] font-semibold">
                        {kit.issueType}
                      </Badge>
                      {kit.isActive ? (
                        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-[10px]">
                          Aktif
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">
                          Nonaktif
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="text-xs mt-1">
                      Material berikut akan otomatis dipotong dari stok saat teknisi menyelesaikan SPK tipe {kit.issueType}
                    </CardDescription>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenItemDialog(kit)}
                      className="h-8 text-xs gap-1"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Tambah Material
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenKitDialog(kit)}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                      title="Edit Kit"
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteKit(kit)}
                      className="h-8 w-8 p-0 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                      title="Hapus Kit"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                {kit.items.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted-foreground">
                    Belum ada material yang didaftarkan ke kit ini. Klik &quot;Tambah Material&quot; untuk menambahkan paku klem, isolasi, kabel ties, fast connector, dll.
                  </div>
                ) : (
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead className="w-[50px] text-xs">No</TableHead>
                        <TableHead className="text-xs font-semibold">SKU / Kode Barang</TableHead>
                        <TableHead className="text-xs font-semibold">Nama Material</TableHead>
                        <TableHead className="w-[140px] text-xs font-semibold text-right">Qty per SPK</TableHead>
                        <TableHead className="w-[140px] text-xs font-semibold text-right">Stok di Gudang</TableHead>
                        <TableHead className="w-[120px] text-xs font-semibold text-center">Satuan Kemasan</TableHead>
                        <TableHead className="w-[80px] text-xs font-semibold text-center">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {kit.items.map((ki, idx) => (
                        <TableRow key={ki.id} className="hover:bg-muted/30">
                          <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell className="text-xs font-mono text-foreground font-medium">
                            {ki.item.sku}
                          </TableCell>
                          <TableCell className="text-xs font-medium text-foreground">
                            {ki.item.name}
                          </TableCell>
                          <TableCell className="text-xs text-right font-semibold text-primary">
                            {ki.defaultQty} {ki.item.unit}
                          </TableCell>
                          <TableCell className="text-xs text-right">
                            <span
                              className={`font-mono font-medium ${
                                ki.item.currentStock <= 0
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : ki.item.currentStock < 10
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-emerald-600 dark:text-emerald-400'
                              }`}
                            >
                              {ki.item.currentStock} {ki.item.unit}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-center text-muted-foreground">
                            {ki.item.packSize && ki.item.packSize > 1 ? (
                              <Badge variant="outline" className="text-[10px] font-normal">
                                Pack isi {ki.item.packSize}
                              </Badge>
                            ) : (
                              <span className="text-[11px]">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenItemDialog(kit, ki)}
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                                title="Ubah Qty"
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteItem(kit, ki)}
                                className="h-7 w-7 p-0 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                                title="Lepas Material"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Kit Modal (Create / Edit) */}
      <Dialog open={isKitDialogOpen} onOpenChange={setIsKitDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <Wrench className="h-5 w-5 text-primary" />
              {editingKit ? 'Edit Kit Standar' : 'Buat Kit Standar Baru'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmitKit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Nama Kit <span className="text-destructive">*</span>
              </Label>
              <Input
                type="text"
                value={kitForm.name}
                onChange={(e) => setKitForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Contoh: Kit Standar PSB (Instalasi Baru)"
                required
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Tipe SPK (Issue Type) <span className="text-destructive">*</span>
              </Label>
              <Select
                value={kitForm.issueType}
                onValueChange={(val) => setKitForm((prev) => ({ ...prev, issueType: val }))}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_ISSUE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value} className="text-xs">
                      {t.label}
                    </SelectItem>
                  ))}
                  <SelectItem value="CUSTOM" className="text-xs">
                    Tipe Kustom Lainnya...
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {kitForm.issueType === 'CUSTOM' && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  Kode Tipe Kustom (Huruf Kapital) <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="text"
                  value={kitForm.customIssueType}
                  onChange={(e) =>
                    setKitForm((prev) => ({ ...prev, customIssueType: e.target.value.toUpperCase() }))
                  }
                  placeholder="CONTOH_TIPE"
                  required
                  className="h-9 text-xs font-mono"
                />
              </div>
            )}

            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <Label className="text-xs font-medium">Status Auto-Deduct</Label>
                <p className="text-[11px] text-muted-foreground">
                  Aktifkan pemotongan stok otomatis saat SPK tipe ini selesai
                </p>
              </div>
              <input
                type="checkbox"
                checked={kitForm.isActive}
                onChange={(e) => setKitForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsKitDialogOpen(false)}
                disabled={submitting}
              >
                Batal
              </Button>
              <Button type="submit" size="sm" disabled={submitting}>
                {submitting ? 'Menyimpan...' : editingKit ? 'Perbarui Kit' : 'Buat Kit'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Item Modal (Add / Edit Material to Kit) */}
      <Dialog open={isItemDialogOpen} onOpenChange={setIsItemDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <Package className="h-5 w-5 text-primary" />
              {editingKitItem ? 'Ubah Qty Material Kit' : 'Tambah Material ke Kit'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmitItem} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Pilih Material dari Gudang <span className="text-destructive">*</span>
              </Label>
              <Select
                value={itemForm.itemId}
                onValueChange={(val) => setItemForm((prev) => ({ ...prev, itemId: val }))}
                disabled={!!editingKitItem}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Pilih material consumable / pasif..." />
                </SelectTrigger>
                <SelectContent className="max-h-[260px]">
                  {warehouseItems
                    .filter((item) => !item.isSerialized)
                    .map((item) => (
                      <SelectItem key={item.id} value={item.id} className="text-xs">
                        {item.name} ({item.sku}) — Stok: {item.currentStock} {item.unit}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Jumlah Default Terpotong per SPK <span className="text-destructive">*</span>
              </Label>
              <Input
                type="number"
                min={0.1}
                step="any"
                value={itemForm.defaultQty}
                onChange={(e) =>
                  setItemForm((prev) => ({ ...prev, defaultQty: parseFloat(e.target.value) || 0 }))
                }
                required
                className="h-9 text-xs font-mono"
                placeholder="Contoh: 6 untuk kabel ties, 1 untuk isolasi, 8 untuk klem"
              />
              <p className="text-[11px] text-muted-foreground">
                Setiap kali SPK {activeKitForItem?.issueType} berstatus COMPLETE, jumlah ini akan otomatis dipotong dari stok gudang.
              </p>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsItemDialogOpen(false)}
                disabled={submitting}
              >
                Batal
              </Button>
              <Button type="submit" size="sm" disabled={submitting}>
                {submitting ? 'Menyimpan...' : 'Simpan Material'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
