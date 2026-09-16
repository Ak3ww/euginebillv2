'use client';

import { useState, useEffect, useMemo } from 'react';
import { showSuccess, showError } from '@/lib/sweetalert';
import { useTranslation } from '@/hooks/useTranslation';
import {
  TrendingUp,
  TrendingDown,
  RefreshCcw,
  Package,
  Calendar,
  User,
  Plus,
  SlidersHorizontal,
  FileText,
  Boxes,
  Layers,
  ArrowUpDown,
  Search,
} from 'lucide-react';
import Link from 'next/link';
import { formatWIB } from '@/lib/timezone';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

interface Item {
  id: string;
  sku: string;
  name: string;
  unit: string;
  currentStock?: number;
  packSize?: number | null;
}

interface Movement {
  id: string;
  itemId: string;
  movementType: 'IN' | 'OUT' | 'ADJUSTMENT' | string;
  quantity: number;
  previousStock: number;
  newStock: number;
  referenceNo?: string | null;
  notes?: string | null;
  userId?: string | null;
  userName?: string | null;
  periodLabel?: string | null;
  createdAt: string;
  item: Item;
}

export default function StockMovementsPage() {
  const { t } = useTranslation();
  const [movements, setMovements] = useState<Movement[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Filters
  const [filterItem, setFilterItem] = useState('ALL');
  const [filterType, setFilterType] = useState('ALL');
  const [filterPeriod, setFilterPeriod] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    itemId: '',
    movementType: 'IN',
    quantity: 1,
    packCount: 1,
    unitMode: 'PCS' as 'PCS' | 'PACK',
    periodLabel: new Date().toISOString().slice(0, 7), // YYYY-MM
    referenceNo: '',
    notes: '',
  });

  const selectedItem = useMemo(() => {
    return items.find((i) => i.id === formData.itemId);
  }, [items, formData.itemId]);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [movementsRes, itemsRes] = await Promise.all([
        fetch('/api/inventory/movements'),
        fetch('/api/inventory/items'),
      ]);

      if (movementsRes.ok) {
        const data = await movementsRes.json();
        setMovements(Array.isArray(data) ? data : data.movements || []);
      }
      if (itemsRes.ok) {
        const data = await itemsRes.json();
        setItems(Array.isArray(data) ? data : data.items || []);
      }
    } catch (error) {
      await showError(t('inventory.failedLoadData'));
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      itemId: '',
      movementType: 'IN',
      quantity: 1,
      packCount: 1,
      unitMode: 'PCS',
      periodLabel: new Date().toISOString().slice(0, 7),
      referenceNo: '',
      notes: '',
    });
  };

  const handleItemChange = (itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    const hasPack = item?.packSize && item.packSize > 1;
    setFormData((prev) => ({
      ...prev,
      itemId,
      unitMode: hasPack ? 'PACK' : 'PCS',
      quantity: hasPack ? (item.packSize || 1) : 1,
      packCount: 1,
    }));
  };

  const handlePackCountChange = (count: number) => {
    const validCount = isNaN(count) ? 0 : Math.max(0, count);
    const packMultiplier = selectedItem?.packSize || 1;
    setFormData((prev) => ({
      ...prev,
      packCount: validCount,
      quantity: validCount * packMultiplier,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.itemId) {
      await showError('Pilih barang terlebih dahulu');
      return;
    }

    if (formData.movementType !== 'ADJUSTMENT' && formData.quantity <= 0) {
      await showError('Jumlah barang harus lebih besar dari 0');
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        itemId: formData.itemId,
        movementType: formData.movementType,
        quantity: formData.quantity,
        referenceNo: formData.referenceNo.trim() || undefined,
        notes: formData.notes.trim() || undefined,
      };

      if (formData.movementType === 'ADJUSTMENT') {
        payload.periodLabel = formData.periodLabel.trim() || undefined;
      }

      const res = await fetch('/api/inventory/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (res.ok) {
        await showSuccess(t('inventory.movementCreated'));
        setIsDialogOpen(false);
        resetForm();
        loadData();
      } else {
        await showError(result.error || t('common.failed'));
      }
    } catch (error) {
      await showError(t('inventory.failedRecordMovement'));
    } finally {
      setSubmitting(false);
    }
  };

  const filteredMovements = useMemo(() => {
    return movements.filter((mov) => {
      const matchItem = filterItem === 'ALL' || mov.itemId === filterItem;
      const matchType = filterType === 'ALL' || mov.movementType === filterType;
      const matchPeriod =
        !filterPeriod || (mov.periodLabel && mov.periodLabel.includes(filterPeriod));
      const matchSearch =
        !searchQuery ||
        mov.item?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        mov.item?.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        mov.referenceNo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        mov.notes?.toLowerCase().includes(searchQuery.toLowerCase());

      return matchItem && matchType && matchPeriod && matchSearch;
    });
  }, [movements, filterItem, filterType, filterPeriod, searchQuery]);

  const stats = useMemo(() => {
    const totalIn = movements
      .filter((m) => m.movementType === 'IN')
      .reduce((sum, m) => sum + Number(m.quantity || 0), 0);
    const totalOut = movements
      .filter((m) => m.movementType === 'OUT')
      .reduce((sum, m) => sum + Number(m.quantity || 0), 0);
    const totalAdjustments = movements.filter((m) => m.movementType === 'ADJUSTMENT').length;

    return {
      totalMovements: movements.length,
      totalIn,
      totalOut,
      totalAdjustments,
    };
  }, [movements]);

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
          className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary font-semibold border border-primary/20 transition-colors"
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <RefreshCcw className="h-5 w-5 text-primary" />
            Riwayat Mutasi Stok
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Log pergerakan barang masuk, keluar, auto-deduct SPK, dan penyesuaian stock opname
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
            onClick={() => {
              resetForm();
              setIsDialogOpen(true);
            }}
            className="h-9 gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Catat Mutasi Manual
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card
          className={`cursor-pointer transition-all hover:border-primary/50 ${
            filterType === 'ALL' ? 'border-primary shadow-sm bg-primary/5' : 'border-border'
          }`}
          onClick={() => setFilterType('ALL')}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Total Transaksi</p>
              <p className="text-xl font-bold text-foreground mt-1">{stats.totalMovements}</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
              <Boxes className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all hover:border-emerald-500/50 ${
            filterType === 'IN' ? 'border-emerald-500 shadow-sm bg-emerald-500/5' : 'border-border'
          }`}
          onClick={() => setFilterType(filterType === 'IN' ? 'ALL' : 'IN')}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Barang Masuk (IN)</p>
              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                +{stats.totalIn.toLocaleString('id-ID')}
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all hover:border-rose-500/50 ${
            filterType === 'OUT' ? 'border-rose-500 shadow-sm bg-rose-500/5' : 'border-border'
          }`}
          onClick={() => setFilterType(filterType === 'OUT' ? 'ALL' : 'OUT')}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Barang Keluar (OUT)</p>
              <p className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-1">
                -{stats.totalOut.toLocaleString('id-ID')}
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <TrendingDown className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all hover:border-amber-500/50 ${
            filterType === 'ADJUSTMENT' ? 'border-amber-500 shadow-sm bg-amber-500/5' : 'border-border'
          }`}
          onClick={() => setFilterType(filterType === 'ADJUSTMENT' ? 'ALL' : 'ADJUSTMENT')}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Stock Opname</p>
              <p className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                {stats.totalAdjustments} kali
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <ArrowUpDown className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="border-border">
        <CardContent className="p-3">
          <div className="flex flex-col md:flex-row gap-2.5 items-stretch md:items-center justify-between">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="relative min-w-[200px] flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cari SKU, nama barang, no ref..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-9 text-xs"
                />
              </div>

              <div className="min-w-[180px]">
                <Select value={filterItem} onValueChange={setFilterItem}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Semua Barang" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    <SelectItem value="ALL">Semua Barang</SelectItem>
                    {items.map((item) => (
                      <SelectItem key={item.id} value={item.id} className="text-xs">
                        {item.name} ({item.sku})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="w-[140px]">
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Tipe Mutasi" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Semua Tipe</SelectItem>
                    <SelectItem value="IN">Masuk (IN)</SelectItem>
                    <SelectItem value="OUT">Keluar (OUT)</SelectItem>
                    <SelectItem value="ADJUSTMENT">Opname (ADJ)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="w-[140px]">
                <Input
                  type="text"
                  placeholder="Periode (YYYY-MM)"
                  value={filterPeriod}
                  onChange={(e) => setFilterPeriod(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              {(filterItem !== 'ALL' || filterType !== 'ALL' || filterPeriod || searchQuery) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFilterItem('ALL');
                    setFilterType('ALL');
                    setFilterPeriod('');
                    setSearchQuery('');
                  }}
                  className="h-9 text-xs text-muted-foreground hover:text-foreground"
                >
                  Reset Filter
                </Button>
              )}
            </div>

            <div className="text-xs text-muted-foreground text-right shrink-0">
              Menampilkan {filteredMovements.length} dari {movements.length} mutasi
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Movements Table */}
      <Card className="border-border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="w-[150px] text-xs font-semibold">Tanggal & Jam</TableHead>
                <TableHead className="text-xs font-semibold">Nama Barang & SKU</TableHead>
                <TableHead className="w-[110px] text-xs font-semibold text-center">Tipe</TableHead>
                <TableHead className="w-[130px] text-xs font-semibold text-right">Jumlah</TableHead>
                <TableHead className="w-[140px] text-xs font-semibold text-center">Stok (Lama → Baru)</TableHead>
                <TableHead className="text-xs font-semibold">No. Ref / Dokumen</TableHead>
                <TableHead className="w-[120px] text-xs font-semibold">Operator</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground text-sm">
                    <RefreshCcw className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
                    Memuat riwayat mutasi...
                  </TableCell>
                </TableRow>
              ) : filteredMovements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground text-sm">
                    Tidak ada riwayat mutasi yang cocok dengan filter
                  </TableCell>
                </TableRow>
              ) : (
                filteredMovements.map((movement) => (
                  <TableRow key={movement.id} className="hover:bg-muted/30">
                    <TableCell className="text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5 font-mono">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        {formatWIB(movement.createdAt, 'dd/MM/yyyy HH:mm')}
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="font-medium text-xs text-foreground">
                        {movement.item?.name || '-'}
                      </div>
                      <div className="text-[11px] text-muted-foreground font-mono">
                        {movement.item?.sku || '-'}
                      </div>
                    </TableCell>

                    <TableCell className="text-center">
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-semibold uppercase tracking-wider ${
                          movement.movementType === 'IN'
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : movement.movementType === 'OUT'
                            ? 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400'
                            : 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {movement.movementType === 'IN'
                          ? 'MASUK'
                          : movement.movementType === 'OUT'
                          ? 'KELUAR'
                          : 'OPNAME'}
                      </Badge>
                      {movement.periodLabel && (
                        <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                          {movement.periodLabel}
                        </div>
                      )}
                    </TableCell>

                    <TableCell className="text-right">
                      <span
                        className={`font-semibold text-xs ${
                          movement.movementType === 'IN'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : movement.movementType === 'OUT'
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {movement.movementType === 'IN' && '+'}
                        {movement.movementType === 'OUT' && '-'}
                        {Number(movement.quantity).toLocaleString('id-ID')}{' '}
                        <span className="text-[11px] font-normal text-muted-foreground">
                          {movement.item?.unit || 'pcs'}
                        </span>
                      </span>
                    </TableCell>

                    <TableCell className="text-center">
                      <div className="text-xs font-mono text-muted-foreground">
                        <span>{Number(movement.previousStock).toLocaleString('id-ID')}</span>
                        <span className="mx-1 text-muted-foreground/60">→</span>
                        <span className="font-semibold text-foreground">
                          {Number(movement.newStock).toLocaleString('id-ID')}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="text-xs font-mono text-foreground">
                        {movement.referenceNo || '-'}
                      </div>
                      {movement.notes && (
                        <div className="text-[11px] text-muted-foreground mt-0.5 max-w-xs truncate" title={movement.notes}>
                          {movement.notes}
                        </div>
                      )}
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <User className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate max-w-[100px]">{movement.userName || 'Sistem'}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Record Movement Modal */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsDialogOpen(open); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <RefreshCcw className="h-5 w-5 text-primary" />
              Catat Mutasi Stok Barang
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            {/* Item Selection */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Pilih Barang <span className="text-destructive">*</span>
              </Label>
              <Select value={formData.itemId} onValueChange={handleItemChange} required>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Pilih barang dari gudang..." />
                </SelectTrigger>
                <SelectContent className="max-h-[250px]">
                  {items.map((item) => (
                    <SelectItem key={item.id} value={item.id} className="text-xs">
                      {item.name} ({item.sku}) — Stok: {item.currentStock || 0} {item.unit}
                      {item.packSize && item.packSize > 1 ? ` (Pack ${item.packSize} ${item.unit})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Movement Type */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Tipe Mutasi <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.movementType}
                onValueChange={(val) => setFormData((prev) => ({ ...prev, movementType: val }))}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IN" className="text-xs">
                    Barang Masuk (Pembelian / Restock / Retur)
                  </SelectItem>
                  <SelectItem value="OUT" className="text-xs">
                    Barang Keluar (Pemakaian / Penjualan)
                  </SelectItem>
                  <SelectItem value="ADJUSTMENT" className="text-xs">
                    Stock Opname / Penyesuaian Fisik
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Pack / Pcs Converter if item has packSize > 1 */}
            {selectedItem && selectedItem.packSize && selectedItem.packSize > 1 && formData.movementType !== 'ADJUSTMENT' && (
              <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                    <Layers className="h-4 w-4 text-primary" />
                    Satuan Input
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant={formData.unitMode === 'PACK' ? 'default' : 'outline'}
                      className="h-7 text-xs px-2.5"
                      onClick={() => {
                        setFormData((prev) => ({
                          ...prev,
                          unitMode: 'PACK',
                          quantity: prev.packCount * (selectedItem.packSize || 1),
                        }));
                      }}
                    >
                      Pack (Isi {selectedItem.packSize} {selectedItem.unit})
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={formData.unitMode === 'PCS' ? 'default' : 'outline'}
                      className="h-7 text-xs px-2.5"
                      onClick={() => {
                        setFormData((prev) => ({
                          ...prev,
                          unitMode: 'PCS',
                        }));
                      }}
                    >
                      {selectedItem.unit} (Eceran)
                    </Button>
                  </div>
                </div>

                {formData.unitMode === 'PACK' ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <Label className="text-xs font-medium">Jumlah Pack</Label>
                      <span className="text-muted-foreground">
                        1 Pack = {selectedItem.packSize} {selectedItem.unit}
                      </span>
                    </div>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      value={formData.packCount}
                      onChange={(e) => handlePackCountChange(parseInt(e.target.value) || 0)}
                      className="h-9 text-xs"
                      placeholder="Masukkan jumlah pack..."
                    />
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                      Total konversi otomatis: {formData.quantity} {selectedItem.unit}
                    </p>
                  </div>
                ) : null}
              </div>
            )}

            {/* Quantity Input (Direct if PCS or ADJUSTMENT) */}
            {(formData.movementType === 'ADJUSTMENT' || !selectedItem?.packSize || selectedItem.packSize <= 1 || formData.unitMode === 'PCS') && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">
                    {formData.movementType === 'ADJUSTMENT'
                      ? 'Stok Fisik Baru (Hasil Hitung Opname)'
                      : `Jumlah (${selectedItem?.unit || 'Unit / Pcs'})`}{' '}
                    <span className="text-destructive">*</span>
                  </Label>
                  {selectedItem && (
                    <span className="text-[11px] text-muted-foreground">
                      Stok saat ini: {selectedItem.currentStock || 0} {selectedItem.unit}
                    </span>
                  )}
                </div>
                <Input
                  type="number"
                  min={formData.movementType === 'ADJUSTMENT' ? 0 : 0.01}
                  step="any"
                  value={formData.quantity}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      quantity: parseFloat(e.target.value) || 0,
                    }))
                  }
                  required
                  className="h-9 text-xs font-mono"
                />
                {formData.movementType === 'ADJUSTMENT' && selectedItem && (
                  <p className="text-[11px] text-muted-foreground">
                    Selisih penyesuaian: {(formData.quantity - (selectedItem.currentStock || 0)).toFixed(2)}{' '}
                    {selectedItem.unit}
                  </p>
                )}
              </div>
            )}

            {/* Period label for Stock Opname */}
            {formData.movementType === 'ADJUSTMENT' && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  Periode Opname (YYYY-MM)
                </Label>
                <Input
                  type="text"
                  placeholder="2026-09"
                  value={formData.periodLabel}
                  onChange={(e) => setFormData((prev) => ({ ...prev, periodLabel: e.target.value }))}
                  className="h-9 text-xs font-mono"
                />
                <p className="text-[11px] text-muted-foreground">
                  Label periode audit bulanan untuk mempermudah pelacakan laporan opname
                </p>
              </div>
            )}

            {/* Reference Number */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Nomor Referensi (Opsional)</Label>
              <Input
                type="text"
                value={formData.referenceNo}
                onChange={(e) => setFormData((prev) => ({ ...prev, referenceNo: e.target.value }))}
                placeholder="PO-001, SJ-2026-001, SPK-PSB-12, dll"
                className="h-9 text-xs"
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Catatan / Keterangan</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                rows={2}
                placeholder="Keterangan tambahan mutasi barang..."
                className="text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsDialogOpen(false);
                  resetForm();
                }}
                disabled={submitting}
              >
                Batal
              </Button>
              <Button type="submit" size="sm" disabled={submitting}>
                {submitting ? 'Menyimpan...' : 'Simpan Mutasi'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
