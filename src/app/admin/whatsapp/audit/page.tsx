'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/cyberpunk/CyberToast';
import { formatWIB } from '@/lib/timezone';
import {
  ShieldCheck, AlertTriangle, CheckCircle2, XCircle, Send, Lock,
  RefreshCw, Search, Phone, FileText, User, Filter, AlertCircle, Layers
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface VerifiedSentItem {
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  customerUsername: string;
  phone: string;
  amount: number;
  dueDate: string;
  area: string;
  status: string;
  sentCount: number;
  lastSentAt: string;
  providerName: string;
  isLocked: boolean;
}

interface UnsentItem {
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  customerUsername: string;
  phone: string;
  amount: number;
  dueDate: string;
  area: string;
  status: string;
  paymentLink: string;
  waRetryCount?: number;
}

interface DuplicateItem {
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  phone: string;
  sendCount: number;
  logs: Array<{ sentAt: string; provider: string }>;
}

export default function WhatsAppAuditPage() {
  const { addToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'sent' | 'unsent' | 'failed' | 'duplicates'>('unsent');
  const [searchQuery, setSearchQuery] = useState('');

  const [summary, setSummary] = useState({
    totalInvoices: 0,
    verifiedSent: 0,
    unsent: 0,
    failed: 0,
    duplicates: 0,
  });

  const [verifiedSentList, setVerifiedSentList] = useState<VerifiedSentItem[]>([]);
  const [unsentList, setUnsentList] = useState<UnsentItem[]>([]);
  const [failedList, setFailedList] = useState<UnsentItem[]>([]);
  const [duplicateList, setDuplicateList] = useState<DuplicateItem[]>([]);

  // Selection state for unsent list sending
  const [selectedUnsentIds, setSelectedUnsentIds] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState(false);
  const [lockLoading, setLockLoading] = useState(false);

  const fetchAuditData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/whatsapp/audit-delivery');
      const data = await res.json();

      if (res.ok && data.success) {
        setSummary(data.summary);
        setVerifiedSentList(data.verifiedSentList || []);
        setUnsentList(data.unsentList || []);
        setFailedList(data.failedList || []);
        setDuplicateList(data.duplicateList || []);
      } else {
        addToast({ type: 'error', title: 'Gagal', description: data.error || 'Gagal memuat audit data WhatsApp' });
      }
    } catch (e) {
      console.error(e);
      addToast({ type: 'error', title: 'Gagal', description: 'Gagal terhubung ke server' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditData();
  }, []);

  const handleSelectAllUnsent = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      if (activeTab === 'failed') {
        setSelectedUnsentIds(new Set(filteredFailed.map(i => i.invoiceId)));
      } else {
        setSelectedUnsentIds(new Set(filteredUnsent.map(i => i.invoiceId)));
      }
    } else {
      setSelectedUnsentIds(new Set());
    }
  };

  const handleToggleUnsent = (id: string) => {
    const next = new Set(selectedUnsentIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedUnsentIds(next);
  };

  // Action 1: Permanently Lock Sent Invoices
  const handleLockSentInvoices = async () => {
    if (!confirm('Kunci seluruh status tagihan yang SUDAH TERKIRIM secara permanen? Tagihan yang terkunci TIDAK AKAN PERNAH menerima WA ulang.')) return;

    setLockLoading(true);
    try {
      const res = await fetch('/api/admin/whatsapp/audit-delivery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'lock_sent' }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        addToast({ type: 'success', title: 'Status Terkunci', description: data.message });
        fetchAuditData();
      } else {
        addToast({ type: 'error', title: 'Gagal', description: data.error || 'Gagal mengunci tagihan' });
      }
    } catch {
      addToast({ type: 'error', title: 'Gagal', description: 'Gagal terhubung ke server' });
    } finally {
      setLockLoading(false);
    }
  };

  // Action 2: Send WA Only to Unsent Customers
  const handleSendUnsentWA = async () => {
    const idsToSend = Array.from(selectedUnsentIds);
    if (idsToSend.length === 0) {
      addToast({ type: 'error', title: 'Pilih Tagihan', description: 'Silakan pilih minimal 1 pelanggan yang belum terkirim' });
      return;
    }

    if (!confirm(`Kirim notifikasi WA tagihan HANYA ke ${idsToSend.length} pelanggan yang BELUM terkirim ini? Sistem menjamin proteksi duplikat 100%.`)) return;

    setProcessing(true);
    try {
      const res = await fetch('/api/admin/whatsapp/audit-delivery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send_unsent', invoiceIds: idsToSend }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        addToast({
          type: 'success',
          title: 'Pengiriman Selesai',
          description: `Berhasil: ${data.sentCount} pesan terkirim, Gagal: ${data.failedCount}`,
        });
        setSelectedUnsentIds(new Set());
        fetchAuditData();
      } else {
        addToast({ type: 'error', title: 'Gagal', description: data.error || 'Gagal mengirim WA' });
      }
    } catch {
      addToast({ type: 'error', title: 'Gagal', description: 'Gagal terhubung ke server' });
    } finally {
      setProcessing(false);
    }
  };

  const filteredSent = verifiedSentList.filter(item =>
    item.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.phone.includes(searchQuery) ||
    item.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredUnsent = unsentList.filter(item =>
    item.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.phone.includes(searchQuery) ||
    item.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredFailed = failedList.filter(item =>
    item.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.phone.includes(searchQuery) ||
    item.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">

      {/* Header Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card border border-border rounded-2xl p-5 shadow-sm">
        <div>
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-primary">Proteksi &amp; Auditing WhatsApp</span>
          <h1 className="text-xl md:text-2xl font-bold text-foreground mt-0.5 flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-emerald-500" />
            Audit Pengiriman WA &amp; Pencegahan Duplikat
          </h1>
          <p className="text-xs text-muted-foreground mt-1">Verifikasi real log pengiriman pesan WhatsApp untuk memisahkan pelanggan yang benar-benar terkirim vs belum terkirim.</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchAuditData}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-2 bg-card hover:bg-muted border border-border text-foreground text-xs font-bold rounded-xl shadow-sm transition-all"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            Refresh Audit
          </button>
        </div>
      </div>

      {/* Summary Cards Bento */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-mono font-bold uppercase text-muted-foreground">Total Tagihan Aktif</p>
              <h3 className="text-2xl font-bold text-foreground mt-1">{summary.totalInvoices}</h3>
            </div>
            <div className="p-3 rounded-xl bg-primary/10 text-primary">
              <FileText className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="bg-card border border-emerald-500/30 rounded-2xl p-4 shadow-sm relative overflow-hidden bg-emerald-500/5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-mono font-bold uppercase text-emerald-600 dark:text-emerald-400">Terverifikasi Terkirim</p>
              <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{summary.verifiedSent}</h3>
            </div>
            <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="bg-card border border-rose-500/30 rounded-2xl p-4 shadow-sm relative overflow-hidden bg-rose-500/5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-mono font-bold uppercase text-rose-600 dark:text-rose-400">Belum Terkirim</p>
              <h3 className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">{summary.unsent}</h3>
            </div>
            <div className="p-3 rounded-xl bg-rose-500/20 text-rose-600">
              <XCircle className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="bg-card border border-rose-500/30 rounded-2xl p-4 shadow-sm relative overflow-hidden bg-rose-500/5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-mono font-bold uppercase text-rose-600 dark:text-rose-400">Gagal Terkirim</p>
              <h3 className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">{summary.failed}</h3>
            </div>
            <div className="p-3 rounded-xl bg-rose-500/20 text-rose-600">
              <AlertCircle className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="bg-card border border-amber-500/30 rounded-2xl p-4 shadow-sm relative overflow-hidden bg-amber-500/5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-mono font-bold uppercase text-amber-600 dark:text-amber-400">Deteksi Duplikat Dulu</p>
              <h3 className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{summary.duplicates}</h3>
            </div>
            <div className="p-3 rounded-xl bg-amber-500/20 text-amber-600">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Safety Actions Banner */}
      <div className="bg-gradient-to-r from-emerald-500/10 via-card to-primary/10 border border-emerald-500/30 rounded-2xl p-5 shadow-sm space-y-3">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-6 h-6 text-emerald-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-foreground">Proteksi Mutlak &amp; Pengiriman Aman</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Anda dapat mengunci seluruh tagihan yang <strong>SUDAH TERKIRIM</strong> agar tidak akan pernah menerima pengiriman ulang. Untuk tagihan yang <strong>BELUM TERKIRIM</strong>, Anda dapat memicu pengiriman secara aman di mana sistem secara otomatis melakukan atomic lock sebelum pesan diproses.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2 flex-wrap border-t border-border">
          <button
            onClick={handleLockSentInvoices}
            disabled={lockLoading}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center gap-2 shadow-sm transition-all"
          >
            {lockLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            Kunci Permanen ({summary.verifiedSent}) Tagihan Terkirim
          </button>

          {(activeTab === 'unsent' || activeTab === 'failed') && (
            <button
              onClick={handleSendUnsentWA}
              disabled={processing || selectedUnsentIds.size === 0}
              className="px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-bold text-xs flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
            >
              {processing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Kirim Ulang WA ke ({selectedUnsentIds.size}) Pelanggan
            </button>
          )}
        </div>
      </div>

      {/* Tab Navigation & Search Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card border border-border rounded-2xl p-3 shadow-sm">
        <div className="flex items-center gap-1.5 bg-muted p-1 rounded-xl w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('unsent')}
            className={cn(
              'px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 flex-1 sm:flex-initial justify-center',
              activeTab === 'unsent' ? 'bg-slate-600 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <XCircle className="w-4 h-4" /> Belum Terkirim ({summary.unsent})
          </button>
          <button
            onClick={() => setActiveTab('failed')}
            className={cn(
              'px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 flex-1 sm:flex-initial justify-center',
              activeTab === 'failed' ? 'bg-rose-500 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <AlertCircle className="w-4 h-4" /> Gagal Terkirim ({summary.failed})
          </button>
          <button
            onClick={() => setActiveTab('sent')}
            className={cn(
              'px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 flex-1 sm:flex-initial justify-center',
              activeTab === 'sent' ? 'bg-emerald-600 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <CheckCircle2 className="w-4 h-4" /> Terverifikasi Terkirim ({summary.verifiedSent})
          </button>
          <button
            onClick={() => setActiveTab('duplicates')}
            className={cn(
              'px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 flex-1 sm:flex-initial justify-center',
              activeTab === 'duplicates' ? 'bg-amber-500 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <AlertTriangle className="w-4 h-4" /> Duplikat ({summary.duplicates})
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Cari nama, hp, invoice..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-background border border-input rounded-xl text-xs focus:ring-2 focus:ring-primary outline-none"
          />
        </div>
      </div>

      {/* Main Table Content */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-primary mb-3" />
            <p className="text-xs font-mono text-muted-foreground">Melakukan verifikasi log audit WhatsApp...</p>
          </div>
        ) : activeTab === 'unsent' ? (
          /* Tab Belum Terkirim */
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between bg-slate-500/10 border border-slate-500/20 p-3 rounded-xl">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-2">
                <XCircle className="w-4 h-4" />
                Daftar Pelanggan yang SAMA SEKALI BELUM Menerima WA Tagihan ({filteredUnsent.length})
              </span>
            </div>

            {filteredUnsent.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground font-medium flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Semua pelanggan yang memiliki tagihan aktif telah berhasil menerima notifikasi WA!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted border-b border-border">
                    <tr>
                      <th className="p-3 text-left">
                        <input
                          type="checkbox"
                          checked={selectedUnsentIds.size === unsentList.length && unsentList.length > 0}
                          onChange={handleSelectAllUnsent}
                          className="rounded border-input"
                        />
                      </th>
                      <th className="p-3 text-left font-mono font-bold uppercase">Pelanggan</th>
                      <th className="p-3 text-left font-mono font-bold uppercase">No. Invoice</th>
                      <th className="p-3 text-left font-mono font-bold uppercase">Wilayah</th>
                      <th className="p-3 text-left font-mono font-bold uppercase">Nominal</th>
                      <th className="p-3 text-left font-mono font-bold uppercase">Jatuh Tempo</th>
                      <th className="p-3 text-left font-mono font-bold uppercase">Status Log WA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredUnsent.map(item => (
                      <tr key={item.invoiceId} className="hover:bg-muted/40 transition-colors">
                        <td className="p-3">
                          <input
                            type="checkbox"
                            checked={selectedUnsentIds.has(item.invoiceId)}
                            onChange={() => handleToggleUnsent(item.invoiceId)}
                            className="rounded border-input"
                          />
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-foreground">{item.customerName}</div>
                          <div className="font-mono text-[10px] text-muted-foreground">{item.phone}</div>
                        </td>
                        <td className="p-3 font-mono font-bold text-primary">{item.invoiceNumber}</td>
                        <td className="p-3 font-mono text-muted-foreground">{item.area}</td>
                        <td className="p-3 font-mono font-bold">Rp {item.amount.toLocaleString('id-ID')}</td>
                        <td className="p-3 font-mono text-muted-foreground">{formatWIB(item.dueDate, 'dd/MM/yyyy')}</td>
                        <td className="p-3">
                          {item.waRetryCount && item.waRetryCount > 0 ? (
                            <span className="px-2.5 py-1 bg-rose-500/10 text-rose-600 border border-rose-500/20 rounded-full font-mono text-[10px] font-bold uppercase">
                              WA Gagal ({item.waRetryCount}x)
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 bg-slate-500/10 text-slate-600 border border-slate-500/20 rounded-full font-mono text-[10px] font-bold uppercase">
                              Belum Dikirim
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : activeTab === 'failed' ? (
          /* Tab Gagal Terkirim */
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl">
              <span className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Daftar Pelanggan dengan Pengiriman WA Gagal ({filteredFailed.length})
              </span>
            </div>

            {filteredFailed.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                🎉 Tidak ada pelanggan dengan status pengiriman WA gagal!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted border-b border-border">
                    <tr>
                      <th className="p-3 text-left">
                        <input
                          type="checkbox"
                          checked={selectedUnsentIds.size === failedList.length && failedList.length > 0}
                          onChange={handleSelectAllUnsent}
                          className="rounded border-input"
                        />
                      </th>
                      <th className="p-3 text-left font-mono font-bold uppercase">Pelanggan</th>
                      <th className="p-3 text-left font-mono font-bold uppercase">No. Invoice</th>
                      <th className="p-3 text-left font-mono font-bold uppercase">Wilayah</th>
                      <th className="p-3 text-left font-mono font-bold uppercase">Nominal</th>
                      <th className="p-3 text-left font-mono font-bold uppercase">Jatuh Tempo</th>
                      <th className="p-3 text-left font-mono font-bold uppercase">Status Gagal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredFailed.map(item => (
                      <tr key={item.invoiceId} className="hover:bg-muted/40 transition-colors">
                        <td className="p-3">
                          <input
                            type="checkbox"
                            checked={selectedUnsentIds.has(item.invoiceId)}
                            onChange={() => handleToggleUnsent(item.invoiceId)}
                            className="rounded border-input"
                          />
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-foreground">{item.customerName}</div>
                          <div className="font-mono text-[10px] text-muted-foreground">{item.phone}</div>
                        </td>
                        <td className="p-3 font-mono font-bold text-primary">{item.invoiceNumber}</td>
                        <td className="p-3 font-mono text-muted-foreground">{item.area}</td>
                        <td className="p-3 font-mono font-bold">Rp {item.amount.toLocaleString('id-ID')}</td>
                        <td className="p-3 font-mono text-muted-foreground">{formatWIB(item.dueDate, 'dd/MM/yyyy')}</td>
                        <td className="p-3">
                          <span className="px-2.5 py-1 bg-rose-500/10 text-rose-600 border border-rose-500/20 rounded-full font-mono text-[10px] font-bold uppercase">
                            Gagal ({item.waRetryCount}x)
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : activeTab === 'sent' ? (
          /* Tab Terverifikasi Terkirim */
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl">
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Daftar Pelanggan dengan Verifikasi Log Sukses Terkirim ({filteredSent.length})
              </span>
            </div>

            {filteredSent.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">Tidak ada data terverifikasi.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted border-b border-border">
                    <tr>
                      <th className="p-3 text-left font-mono font-bold uppercase">Pelanggan</th>
                      <th className="p-3 text-left font-mono font-bold uppercase">No. Invoice</th>
                      <th className="p-3 text-left font-mono font-bold uppercase">Nominal</th>
                      <th className="p-3 text-left font-mono font-bold uppercase">Waktu Terkirim Log</th>
                      <th className="p-3 text-left font-mono font-bold uppercase">Provider</th>
                      <th className="p-3 text-left font-mono font-bold uppercase">Status Proteksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredSent.map(item => (
                      <tr key={item.invoiceId} className="hover:bg-muted/40 transition-colors">
                        <td className="p-3">
                          <div className="font-bold text-foreground">{item.customerName}</div>
                          <div className="font-mono text-[10px] text-muted-foreground">{item.phone}</div>
                        </td>
                        <td className="p-3 font-mono font-bold text-primary">{item.invoiceNumber}</td>
                        <td className="p-3 font-mono font-bold">Rp {item.amount.toLocaleString('id-ID')}</td>
                        <td className="p-3 font-mono text-muted-foreground">
                          {item.lastSentAt ? formatWIB(item.lastSentAt, 'dd/MM/yyyy HH:mm:ss') : '-'}
                        </td>
                        <td className="p-3 font-mono font-bold text-foreground">{item.providerName}</td>
                        <td className="p-3">
                          <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 rounded-full font-mono text-[10px] font-bold uppercase flex items-center gap-1 w-max">
                            <Lock className="w-3 h-3" /> Terkunci (Aman)
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          /* Tab Duplikat Terdeteksi */
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl">
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Daftar Pelanggan yang Sempat Menerima &gt; 1 Pesan Sebelum Fix ({duplicateList.length})
              </span>
            </div>

            {duplicateList.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">🎉 Tidak ada riwayat duplikat ditemukan!</div>
            ) : (
              <div className="space-y-3 text-xs">
                {duplicateList.map(item => (
                  <div key={item.invoiceId} className="p-4 bg-background border border-amber-500/30 rounded-xl space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-bold text-foreground text-sm">{item.customerName}</span>
                        <span className="font-mono text-xs text-muted-foreground ml-2">({item.phone})</span>
                        <div className="font-mono text-xs font-bold text-primary mt-0.5">Invoice: {item.invoiceNumber}</div>
                      </div>
                      <span className="px-3 py-1 bg-amber-500/20 text-amber-600 font-mono font-bold rounded-full text-xs">
                        ⚠️ Terkirim {item.sendCount}x
                      </span>
                    </div>

                    <div className="bg-muted/40 p-2.5 rounded-lg space-y-1 text-[11px] font-mono">
                      <span className="text-muted-foreground font-bold">Rincian Waktu Terkirim Log:</span>
                      {item.logs.map((l, idx) => (
                        <div key={idx} className="text-foreground flex items-center gap-2">
                          <span>• {formatWIB(l.sentAt, 'dd/MM/yyyy HH:mm:ss')}</span>
                          <span className="text-muted-foreground">({l.provider})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
