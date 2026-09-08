'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  FileText,
  Clock,
  CheckCircle2,
  Plus,
  Trash2,
  Edit,
  Eye,
  DollarSign,
  Search,
  RefreshCw,
  XCircle,
  X,
  ExternalLink,
  Download,
} from 'lucide-react';
import { showSuccess, showError, showConfirm } from '@/lib/sweetalert';
import { formatWIB } from '@/lib/timezone';

// ─── Types ───────────────────────────────────────────────────────────────────

interface InvoiceItem {
  description: string;
  qty: number;
  unitPrice: number;
  total: number;
}

interface ManualInvoice {
  id: string;
  invoiceNumber: string;
  recipientName: string;
  recipientPhone: string | null;
  recipientAddress: string | null;
  items: InvoiceItem[];
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  status: 'PENDING' | 'PAID' | 'CANCELLED';
  notes: string | null;
  paidAt: string | null;
  createdAt: string;
  transactionId: string | null;
}

interface Stats {
  pendingCount: number;
  pendingAmount: number;
  paidCount: number;
  paidAmount: number;
  cancelledCount: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatRp(amount: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
}

function formatRpInput(value: string) {
  const num = parseInt(value.replace(/\D/g, '')) || 0;
  return num === 0 ? '' : num.toLocaleString('id-ID');
}

function parseRpInput(value: string) {
  return parseInt(value.replace(/\D/g, '')) || 0;
}

const statusConfig = {
  PENDING: { label: 'Menunggu', variant: 'outline' as const, icon: Clock, class: 'text-amber-600 border-amber-300 bg-amber-50' },
  PAID: { label: 'Lunas', variant: 'outline' as const, icon: CheckCircle2, class: 'text-emerald-600 border-emerald-300 bg-emerald-50' },
  CANCELLED: { label: 'Dibatalkan', variant: 'outline' as const, icon: XCircle, class: 'text-slate-500 border-slate-300 bg-slate-50' },
};

// ─── Empty Item ───────────────────────────────────────────────────────────────

function emptyItem(): InvoiceItem {
  return { description: '', qty: 1, unitPrice: 0, total: 0 };
}

// ─── Item Row Component ───────────────────────────────────────────────────────

function ItemRow({
  item,
  idx,
  onChange,
  onRemove,
  canRemove,
}: {
  item: InvoiceItem;
  idx: number;
  onChange: (idx: number, field: keyof InvoiceItem, value: string | number) => void;
  onRemove: (idx: number) => void;
  canRemove: boolean;
}) {
  const [unitPriceDisplay, setUnitPriceDisplay] = useState(
    item.unitPrice > 0 ? item.unitPrice.toLocaleString('id-ID') : ''
  );

  return (
    <tr className="border-b border-border">
      <td className="py-2 pr-2 w-8 text-center text-muted-foreground text-sm">{idx + 1}</td>
      <td className="py-2 pr-2">
        <Input
          placeholder="Nama / deskripsi item"
          value={item.description}
          onChange={(e) => onChange(idx, 'description', e.target.value)}
          className="h-8 text-sm"
        />
      </td>
      <td className="py-2 pr-2 w-20">
        <Input
          type="number"
          min={1}
          placeholder="1"
          value={item.qty}
          onChange={(e) => onChange(idx, 'qty', parseInt(e.target.value) || 1)}
          className="h-8 text-sm text-right"
        />
      </td>
      <td className="py-2 pr-2 w-40">
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Rp</span>
          <Input
            placeholder="0"
            value={unitPriceDisplay}
            onChange={(e) => {
              const raw = e.target.value.replace(/\D/g, '');
              const num = parseInt(raw) || 0;
              setUnitPriceDisplay(num > 0 ? num.toLocaleString('id-ID') : '');
              onChange(idx, 'unitPrice', num);
            }}
            className="h-8 text-sm text-right pl-8"
          />
        </div>
      </td>
      <td className="py-2 pr-2 w-36 text-right text-sm font-medium text-foreground">
        {formatRp(item.total)}
      </td>
      <td className="py-2 w-8 text-center">
        {canRemove && (
          <button
            type="button"
            onClick={() => onRemove(idx)}
            className="text-muted-foreground hover:text-destructive transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </td>
    </tr>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ManualInvoicesPage() {
  const [invoices, setInvoices] = useState<ManualInvoice[]>([]);
  const [stats, setStats] = useState<Stats>({ pendingCount: 0, pendingAmount: 0, paidCount: 0, paidAmount: 0, cancelledCount: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Dialog state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<ManualInvoice | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formItems, setFormItems] = useState<InvoiceItem[]>([emptyItem()]);
  const [formDiscount, setFormDiscount] = useState('');
  const [formDiscountDisplay, setFormDiscountDisplay] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '200' });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (search.trim()) params.set('search', search.trim());

      const res = await fetch(`/api/manual-invoices?${params}`);
      const data = await res.json();
      if (data.success) {
        setInvoices(data.data.invoices || []);
        setStats(data.data.stats || {});
      }
    } catch {
      showError('Gagal memuat data invoice manual');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  // ── Form Helpers ───────────────────────────────────────────────────────────

  function resetForm() {
    setFormName('');
    setFormPhone('');
    setFormAddress('');
    setFormItems([emptyItem()]);
    setFormDiscount('');
    setFormDiscountDisplay('');
    setFormNotes('');
    setEditingInvoice(null);
  }

  function openCreate() {
    resetForm();
    setIsFormOpen(true);
  }

  function openEdit(inv: ManualInvoice) {
    setEditingInvoice(inv);
    setFormName(inv.recipientName);
    setFormPhone(inv.recipientPhone || '');
    setFormAddress(inv.recipientAddress || '');
    setFormItems(inv.items.length > 0 ? [...inv.items] : [emptyItem()]);
    const disc = inv.discountAmount > 0 ? inv.discountAmount : 0;
    setFormDiscount(disc.toString());
    setFormDiscountDisplay(disc > 0 ? disc.toLocaleString('id-ID') : '');
    setFormNotes(inv.notes || '');
    setIsFormOpen(true);
  }

  function updateItem(idx: number, field: keyof InvoiceItem, value: string | number) {
    setFormItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[idx], [field]: value };
      item.total = item.qty * item.unitPrice;
      updated[idx] = item;
      return updated;
    });
  }

  function addItem() {
    setFormItems((prev) => [...prev, emptyItem()]);
  }

  function removeItem(idx: number) {
    setFormItems((prev) => prev.filter((_, i) => i !== idx));
  }

  const subtotal = formItems.reduce((s, i) => s + i.total, 0);
  const discountVal = parseInt(formDiscount.replace(/\D/g, '')) || 0;
  const total = Math.max(0, subtotal - discountVal);

  // ── Save ───────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!formName.trim()) { showError('Nama penerima wajib diisi'); return; }
    const invalidItem = formItems.find(i => !i.description.trim());
    if (invalidItem) { showError('Semua item harus memiliki deskripsi'); return; }

    setSaving(true);
    try {
      const payload = {
        recipientName: formName.trim(),
        recipientPhone: formPhone.trim() || null,
        recipientAddress: formAddress.trim() || null,
        items: formItems.map(i => ({ ...i, total: i.qty * i.unitPrice })),
        discountAmount: discountVal,
        notes: formNotes.trim() || null,
      };

      const url = editingInvoice ? `/api/manual-invoices/${editingInvoice.id}` : '/api/manual-invoices';
      const method = editingInvoice ? 'PUT' : 'POST';

      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();

      if (data.success) {
        showSuccess(editingInvoice ? 'Invoice berhasil diperbarui' : 'Invoice berhasil dibuat');
        setIsFormOpen(false);
        resetForm();
        fetchInvoices();
      } else {
        showError(data.error || 'Gagal menyimpan invoice');
      }
    } catch {
      showError('Terjadi kesalahan saat menyimpan');
    } finally {
      setSaving(false);
    }
  }

  // ── Mark Paid ─────────────────────────────────────────────────────────────

  async function handleMarkPaid(inv: ManualInvoice) {
    const confirmed = await showConfirm(
      `Tandai invoice ${inv.invoiceNumber} sebagai LUNAS?\n\nPermasukan sebesar ${formatRp(inv.totalAmount)} akan dicatat ke sistem keuangan.`,
      'Tandai Lunas'
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/manual-invoices/${inv.id}/mark-paid`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showSuccess(data.data?.message || 'Invoice berhasil ditandai LUNAS');
        fetchInvoices();
      } else {
        showError(data.error || 'Gagal menandai lunas');
      }
    } catch {
      showError('Terjadi kesalahan');
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async function handleDelete(inv: ManualInvoice) {
    const confirmed = await showConfirm(
      `Hapus invoice ${inv.invoiceNumber}?\nData yang sudah dihapus tidak bisa dipulihkan.`,
      'Hapus'
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/manual-invoices/${inv.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showSuccess('Invoice berhasil dihapus');
        fetchInvoices();
      } else {
        showError(data.error || 'Gagal menghapus invoice');
      }
    } catch {
      showError('Terjadi kesalahan');
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Invoice Manual</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Buat invoice one-time untuk penjualan perangkat, jasa, atau proyek
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Buat Invoice
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card
          className="cursor-pointer hover:border-slate-400 transition-colors"
          onClick={() => setStatusFilter('all')}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Invoice</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">
              {stats.pendingCount + stats.paidCount + stats.cancelledCount}
            </p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:border-amber-300 transition-colors"
          onClick={() => setStatusFilter('PENDING')}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">Menunggu Pembayaran</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold text-amber-600">{stats.pendingCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{formatRp(stats.pendingAmount)}</p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:border-emerald-300 transition-colors"
          onClick={() => setStatusFilter('PAID')}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">Lunas</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold text-emerald-600">{stats.paidCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{formatRp(stats.paidAmount)}</p>
          </CardContent>
        </Card>

        <Card className="bg-[#002C60]/5 border-[#002C60]/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Nilai</CardTitle>
            <DollarSign className="h-4 w-4 text-[#002C60]" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-xl font-bold text-[#002C60]">
              {formatRp(stats.pendingAmount + stats.paidAmount)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari nama, nomor invoice..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44 h-9">
            <SelectValue placeholder="Semua Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Status</SelectItem>
            <SelectItem value="PENDING">Menunggu</SelectItem>
            <SelectItem value="PAID">Lunas</SelectItem>
            <SelectItem value="CANCELLED">Dibatalkan</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={fetchInvoices} className="h-9 gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      {/* Table */}
      <div className="border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="text-xs font-semibold">No. Invoice</TableHead>
              <TableHead className="text-xs font-semibold">Kepada</TableHead>
              <TableHead className="text-xs font-semibold">Tanggal</TableHead>
              <TableHead className="text-xs font-semibold text-right">Total</TableHead>
              <TableHead className="text-xs font-semibold">Status</TableHead>
              <TableHead className="text-xs font-semibold text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : invoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Belum ada invoice manual</p>
                </TableCell>
              </TableRow>
            ) : (
              invoices.map((inv) => {
                const sc = statusConfig[inv.status] || statusConfig.PENDING;
                const StatusIcon = sc.icon;
                return (
                  <TableRow key={inv.id} className="hover:bg-muted/20 transition-colors">
                    <TableCell>
                      <a
                        href={`/invoice/manual/${inv.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-sm font-semibold text-[#002C60] hover:underline flex items-center gap-1"
                      >
                        {inv.invoiceNumber}
                        <ExternalLink className="h-3 w-3 opacity-60" />
                      </a>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-sm">{inv.recipientName}</p>
                      {inv.recipientPhone && (
                        <p className="text-xs text-muted-foreground">{inv.recipientPhone}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">{formatWIB(inv.createdAt, 'date')}</p>
                      {inv.paidAt && (
                        <p className="text-xs text-emerald-600">Lunas: {formatWIB(inv.paidAt, 'date')}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <p className="font-semibold text-sm">{formatRp(inv.totalAmount)}</p>
                      {inv.discountAmount > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Diskon: {formatRp(inv.discountAmount)}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={`gap-1 text-xs ${sc.class}`} variant="outline">
                        <StatusIcon className="h-3 w-3" />
                        {sc.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {/* View */}
                        <a
                          href={`/invoice/manual/${inv.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Lihat Invoice">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </a>

                        {/* Download PDF */}
                        <a
                          href={`/api/manual-invoices/${inv.id}/pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Download PDF">
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                        </a>

                        {/* Edit */}
                        {inv.status === 'PENDING' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Edit Invoice"
                            onClick={() => openEdit(inv)}
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                        )}

                        {/* Mark Paid */}
                        {inv.status === 'PENDING' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                            title="Tandai Lunas"
                            onClick={() => handleMarkPaid(inv)}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </Button>
                        )}

                        {/* Delete */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                          title="Hapus Invoice"
                          onClick={() => handleDelete(inv)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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

      {/* Create/Edit Dialog */}
      <Dialog open={isFormOpen} onOpenChange={(open) => { if (!open) { setIsFormOpen(false); resetForm(); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingInvoice ? 'Edit Invoice Manual' : 'Buat Invoice Manual'}</DialogTitle>
            <DialogDescription>
              {editingInvoice
                ? `Ubah detail invoice ${editingInvoice.invoiceNumber}`
                : 'Buat invoice one-time untuk transaksi di luar sistem billing PPPoE'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Recipient */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>
                  Nama Penerima <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder="Contoh: PT. XYZ / Bapak Ahmad"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Nomor Telepon</Label>
                <Input
                  placeholder="08xxxxxxxxxx"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Alamat Penerima</Label>
              <Textarea
                placeholder="Jl. Contoh No. 123, Kota..."
                value={formAddress}
                onChange={(e) => setFormAddress(e.target.value)}
                rows={2}
              />
            </div>

            {/* Items */}
            <div className="space-y-2">
              <Label>
                Item / Deskripsi Pekerjaan <span className="text-destructive">*</span>
              </Label>
              <div className="border border-border rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground w-8">No</th>
                      <th className="py-2 px-2 text-left text-xs font-medium text-muted-foreground">Deskripsi</th>
                      <th className="py-2 px-2 text-left text-xs font-medium text-muted-foreground w-20">Qty</th>
                      <th className="py-2 px-2 text-left text-xs font-medium text-muted-foreground w-44">Harga Satuan</th>
                      <th className="py-2 px-2 text-right text-xs font-medium text-muted-foreground w-36">Total</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody className="px-3 divide-y divide-border">
                    {formItems.map((item, idx) => (
                      <ItemRow
                        key={idx}
                        item={item}
                        idx={idx}
                        onChange={updateItem}
                        onRemove={removeItem}
                        canRemove={formItems.length > 1}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addItem}
                className="gap-1.5 h-8 text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                Tambah Item
              </Button>
            </div>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-72 space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{formatRp(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <Label className="text-sm text-muted-foreground shrink-0">Diskon</Label>
                  <div className="relative w-40">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Rp</span>
                    <Input
                      placeholder="0"
                      value={formDiscountDisplay}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, '');
                        const num = parseInt(raw) || 0;
                        setFormDiscountDisplay(num > 0 ? num.toLocaleString('id-ID') : '');
                        setFormDiscount(num.toString());
                      }}
                      className="h-8 text-sm text-right pl-8"
                    />
                  </div>
                </div>
                <div className="flex justify-between border-t border-border pt-2 font-semibold">
                  <span>Total</span>
                  <span className="text-[#002C60] text-base">{formatRp(total)}</span>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label>Catatan (opsional)</Label>
              <Textarea
                placeholder="Catatan tambahan untuk penerima invoice..."
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsFormOpen(false); resetForm(); }}>
              Batal
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingInvoice ? 'Simpan Perubahan' : 'Buat Invoice'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
