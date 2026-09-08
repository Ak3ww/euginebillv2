'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  Receipt,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
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

const statusConfig = {
  PENDING: { label: 'Menunggu', variant: 'outline' as const, icon: Clock, class: 'text-amber-600 border-amber-300 bg-amber-50' },
  PAID: { label: 'Lunas', variant: 'outline' as const, icon: CheckCircle2, class: 'text-emerald-600 border-emerald-300 bg-emerald-50' },
  CANCELLED: { label: 'Dibatalkan', variant: 'outline' as const, icon: XCircle, class: 'text-slate-500 border-slate-300 bg-slate-50' },
};

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
  return (
    <tr className="border-b border-border/60 hover:bg-muted/10 transition-colors">
      <td className="py-3 px-3 text-center text-muted-foreground text-xs font-semibold w-10">
        {idx + 1}
      </td>
      <td className="py-3 px-2">
        <Input
          placeholder="Contoh: OLT GPON 1 PON / Kabel Dropcore 4 Core..."
          value={item.description}
          onChange={(e) => onChange(idx, 'description', e.target.value)}
          className="h-9 text-sm"
        />
      </td>
      <td className="py-3 px-2 w-28">
        <Input
          type="number"
          min={1}
          placeholder="1"
          value={item.qty || ''}
          onChange={(e) => onChange(idx, 'qty', parseInt(e.target.value) || 1)}
          className="h-9 text-sm text-right"
        />
      </td>
      <td className="py-3 px-2 w-52">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">Rp</span>
          <Input
            placeholder="0"
            value={item.unitPrice > 0 ? item.unitPrice.toLocaleString('id-ID') : ''}
            onChange={(e) => {
              const raw = e.target.value.replace(/\D/g, '');
              const num = parseInt(raw) || 0;
              onChange(idx, 'unitPrice', num);
            }}
            className="h-9 text-sm text-right pl-9 font-medium"
          />
        </div>
      </td>
      <td className="py-3 px-3 w-48 text-right font-semibold text-foreground text-sm">
        {formatRp(item.total)}
      </td>
      <td className="py-3 px-2 w-12 text-center">
        {canRemove && (
          <button
            type="button"
            onClick={() => onRemove(idx)}
            className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            title="Hapus baris ini"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </td>
    </tr>
  );
}

// ─── Main Page Component ──────────────────────────────────────────────────────

export default function ManualInvoicesPage() {
  const [invoices, setInvoices] = useState<ManualInvoice[]>([]);
  const [stats, setStats] = useState<Stats>({ pendingCount: 0, pendingAmount: 0, paidCount: 0, paidAmount: 0, cancelledCount: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Inline Form State (NO MODAL POPUP)
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<ManualInvoice | null>(null);
  const [saving, setSaving] = useState(false);

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formItems, setFormItems] = useState<InvoiceItem[]>([emptyItem()]);
  const [formDiscount, setFormDiscount] = useState<number>(0);
  const [formNotes, setFormNotes] = useState('');

  const formRef = useRef<HTMLDivElement>(null);

  // ── Fetch Invoices ─────────────────────────────────────────────────────────

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

  // ── Form Actions ───────────────────────────────────────────────────────────

  function resetForm() {
    setFormName('');
    setFormPhone('');
    setFormAddress('');
    setFormItems([emptyItem()]);
    setFormDiscount(0);
    setFormNotes('');
    setEditingInvoice(null);
  }

  function openCreate() {
    resetForm();
    setIsFormOpen(true);
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }

  function openEdit(inv: ManualInvoice) {
    setEditingInvoice(inv);
    setFormName(inv.recipientName);
    setFormPhone(inv.recipientPhone || '');
    setFormAddress(inv.recipientAddress || '');
    setFormItems(inv.items.length > 0 ? [...inv.items] : [emptyItem()]);
    setFormDiscount(inv.discountAmount || 0);
    setFormNotes(inv.notes || '');
    setIsFormOpen(true);
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }

  function closeForm() {
    setIsFormOpen(false);
    resetForm();
  }

  function updateItem(idx: number, field: keyof InvoiceItem, value: string | number) {
    setFormItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[idx], [field]: value };
      item.total = Math.max(0, (item.qty || 0) * (item.unitPrice || 0));
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

  const subtotal = formItems.reduce((s, i) => s + (i.total || 0), 0);
  const total = Math.max(0, subtotal - formDiscount);

  // ── Save Invoice ───────────────────────────────────────────────────────────

  async function handleSave() {
    if (!formName.trim()) {
      showError('Nama penerima wajib diisi');
      return;
    }

    // Lenient: filter out empty items automatically so user doesn't get error
    const validItems = formItems.filter(
      (item) => item.description && item.description.trim() !== ''
    );

    if (validItems.length === 0) {
      showError('Minimal 1 item dengan nama / deskripsi harus diisi');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        recipientName: formName.trim(),
        recipientPhone: formPhone.trim() || null,
        recipientAddress: formAddress.trim() || null,
        items: validItems.map((i) => ({
          description: i.description.trim(),
          qty: Math.max(1, Number(i.qty) || 1),
          unitPrice: Math.max(0, Number(i.unitPrice) || 0),
          total: Math.max(1, Number(i.qty) || 1) * Math.max(0, Number(i.unitPrice) || 0),
        })),
        discountAmount: formDiscount,
        notes: formNotes.trim() || null,
      };

      const url = editingInvoice ? `/api/manual-invoices/${editingInvoice.id}` : '/api/manual-invoices';
      const method = editingInvoice ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.success) {
        showSuccess(editingInvoice ? 'Invoice berhasil diperbarui' : 'Invoice berhasil dibuat & diterbitkan');
        closeForm();
        fetchInvoices();
      } else {
        showError(data.error || 'Gagal menyimpan invoice');
      }
    } catch (err: any) {
      showError(err?.message || 'Terjadi kesalahan saat menyimpan');
    } finally {
      setSaving(false);
    }
  }

  // ── Mark Paid ─────────────────────────────────────────────────────────────

  async function handleMarkPaid(inv: ManualInvoice) {
    const confirmed = await showConfirm(
      `Tandai invoice ${inv.invoiceNumber} sebagai LUNAS?\n\nPemasukan sebesar ${formatRp(inv.totalAmount)} akan otomatis dicatat ke sistem keuangan.`,
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
      showError('Terjadi kesalahan saat menandai lunas');
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async function handleDelete(inv: ManualInvoice) {
    const confirmed = await showConfirm(
      `Hapus invoice ${inv.invoiceNumber}?\nData yang sudah dihapus tidak dapat dipulihkan.`,
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
      showError('Terjadi kesalahan saat menghapus');
    }
  }

  // ─── Render Page ──────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Receipt className="h-6 w-6 text-[#002C60]" />
            Invoice Manual
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Buat invoice one-time untuk penjualan perangkat (OLT, kabel, ODP, splitter, precon) atau jasa proyek
          </p>
        </div>
        {!isFormOpen && (
          <Button onClick={openCreate} className="gap-2 bg-[#002C60] hover:bg-[#1b437c] text-white">
            <Plus className="h-4 w-4" />
            Buat Invoice Baru
          </Button>
        )}
      </div>

      {/* ─── INLINE FORM CARD (NO POPUP MODAL) ─────────────────────────────── */}
      {isFormOpen && (
        <div ref={formRef} className="scroll-mt-6">
          <Card className="border-2 border-[#002C60]/30 shadow-md bg-card">
            <CardHeader className="bg-[#002C60]/5 border-b border-border/80 px-6 py-4 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold text-[#002C60] flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {editingInvoice ? `Edit Invoice: ${editingInvoice.invoiceNumber}` : 'Form Pembuatan Invoice Manual'}
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  Isi data penerima dan daftar rincian barang. Kolom di bawah ini luas dan langsung tampil di halaman.
                </CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={closeForm} title="Tutup Form">
                <X className="h-5 w-5" />
              </Button>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              {/* Bagian 1: Data Penerima */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">
                    Nama Penerima / Perusahaan <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    placeholder="Contoh: PT. Sumber Daya Mandiri / Bapak H. Ahmad"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="h-10"
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Nomor Telepon / WhatsApp (opsional)</Label>
                  <Input
                    placeholder="Contoh: 081234567890"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="h-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold">Alamat Penerima / Lokasi Pengiriman (opsional)</Label>
                <Textarea
                  placeholder="Jl. Raya No. 123, RT 01/RW 02, Kelurahan, Kecamatan..."
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  rows={2}
                />
              </div>

              {/* Bagian 2: Daftar Item / Rincian Barang */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">
                    Daftar Item / Rincian Barang & Jasa <span className="text-destructive">*</span>
                  </Label>
                  <span className="text-xs text-muted-foreground">
                    Baris kosong otomatis diabaikan sistem saat simpan
                  </span>
                </div>

                <div className="border border-border rounded-lg overflow-hidden bg-background">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 border-b border-border text-xs font-semibold text-muted-foreground uppercase">
                      <tr>
                        <th className="py-3 px-3 text-center w-10">No</th>
                        <th className="py-3 px-2 text-left">Nama / Deskripsi Item</th>
                        <th className="py-3 px-2 text-right w-28">Qty</th>
                        <th className="py-3 px-2 text-right w-52">Harga Satuan (Rp)</th>
                        <th className="py-3 px-3 text-right w-48">Total</th>
                        <th className="py-3 px-2 text-center w-12" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
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

                <div className="flex justify-between items-center pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addItem}
                    className="gap-2 border-dashed border-primary/50 text-primary hover:bg-primary/5"
                  >
                    <Plus className="h-4 w-4" />
                    Tambah Baris Item
                  </Button>
                </div>
              </div>

              {/* Bagian 3: Kalkulasi & Diskon */}
              <div className="flex justify-end pt-2 border-t border-border">
                <div className="w-full max-w-md space-y-3 bg-muted/20 p-4 rounded-lg border border-border">
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Subtotal ({formItems.filter(i => i.description.trim()).length} item)</span>
                    <span className="font-semibold text-foreground">{formatRp(subtotal)}</span>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <Label className="text-sm text-muted-foreground shrink-0">Potongan / Diskon (Rp)</Label>
                    <div className="relative w-48">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Rp</span>
                      <Input
                        placeholder="0"
                        value={formDiscount > 0 ? formDiscount.toLocaleString('id-ID') : ''}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/\D/g, '');
                          setFormDiscount(parseInt(raw) || 0);
                        }}
                        className="h-9 text-sm text-right pl-9 font-medium"
                      />
                    </div>
                  </div>

                  <div className="flex justify-between items-baseline border-t-2 border-[#002C60] pt-3">
                    <span className="font-bold text-foreground text-base">Total Tagihan</span>
                    <span className="text-2xl font-black text-[#002C60]">{formatRp(total)}</span>
                  </div>
                </div>
              </div>

              {/* Bagian 4: Catatan Tambahan */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Catatan / Keterangan Pembayaran (opsional)</Label>
                <Textarea
                  placeholder="Contoh: Garansi perangkat 1 bulan. Pembayaran via transfer BCA/Mandiri sesuai invoice."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  rows={2}
                />
              </div>

              {/* Bagian 5: Tombol Aksi */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <Button variant="outline" onClick={closeForm} disabled={saving} className="px-5">
                  Batal / Tutup Form
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="gap-2 px-6 bg-[#002C60] hover:bg-[#1b437c] text-white"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      {editingInvoice ? 'Simpan Perubahan Invoice' : 'Terbitkan Invoice Sekarang'}
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

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

      {/* Search & Filter Bar */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari nama pelanggan, nomor invoice..."
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

      {/* Invoice Table */}
      <div className="border border-border rounded-lg overflow-hidden bg-card">
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
                  <p className="text-sm">Belum ada invoice manual yang dibuat</p>
                  <Button variant="outline" size="sm" onClick={openCreate} className="mt-3 gap-1.5">
                    <Plus className="h-3.5 w-3.5" />
                    Buat Invoice Pertama
                  </Button>
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
                      <p className="font-medium text-sm text-foreground">{inv.recipientName}</p>
                      {inv.recipientPhone && (
                        <p className="text-xs text-muted-foreground">{inv.recipientPhone}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">{formatWIB(inv.createdAt, 'date')}</p>
                      {inv.paidAt && (
                        <p className="text-xs text-emerald-600 font-medium">Lunas: {formatWIB(inv.paidAt, 'date')}</p>
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
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Lihat Invoice Publik">
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

                        {/* Edit (only if PENDING) */}
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

                        {/* Mark Paid (only if PENDING) */}
                        {inv.status === 'PENDING' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                            title="Tandai Lunas & Catat Pemasukan"
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
    </div>
  );
}

