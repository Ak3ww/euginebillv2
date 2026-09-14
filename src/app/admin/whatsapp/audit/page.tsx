'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useToast } from '@/components/cyberpunk/CyberToast';
import { formatWIB } from '@/lib/timezone';
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Send,
  Lock,
  RefreshCw,
  Search,
  FileText,
  AlertCircle,
  Clock,
  Check,
  Info,
  FastForward,
  PauseCircle,
  SlidersHorizontal,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';

interface VerifiedSentItem {
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  customerUsername: string;
  phone: string;
  normPhone: string;
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
  normPhone: string;
  amount: number;
  dueDate: string;
  area: string;
  status: string;
  paymentLink?: string;
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

interface BatchSettings {
  batchSize: number;
  batchDelay: number;
}

type StatusFilter = 'all' | 'unsent' | 'failed' | 'sent' | 'duplicates';

interface ResultItem {
  invoiceNumber: string;
  phone: string;
  customerName: string;
  success: boolean;
  error?: string;
}

export default function WhatsAppAuditPage() {
  const { addToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('unsent');
  const [searchQuery, setSearchQuery] = useState('');

  const [summary, setSummary] = useState({
    totalInvoices: 0,
    verifiedSent: 0,
    unsent: 0,
    failed: 0,
    duplicates: 0,
  });

  const [batchSettings, setBatchSettings] = useState<BatchSettings>({
    batchSize: 10,
    batchDelay: 120,
  });

  const [verifiedSentList, setVerifiedSentList] = useState<VerifiedSentItem[]>([]);
  const [unsentList, setUnsentList] = useState<UnsentItem[]>([]);
  const [failedList, setFailedList] = useState<UnsentItem[]>([]);
  const [duplicateList, setDuplicateList] = useState<DuplicateItem[]>([]);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Dialog & Batch Progress states
  const [confirmSendOpen, setConfirmSendOpen] = useState(false);
  const [confirmLockOpen, setConfirmLockOpen] = useState(false);
  const [lockLoading, setLockLoading] = useState(false);

  // Batch sending progress
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressState, setProgressState] = useState({
    totalBatches: 0,
    currentBatch: 0,
    totalTarget: 0,
    processedCount: 0,
    successCount: 0,
    failedCount: 0,
    countdown: 0,
    isWaitingDelay: false,
    statusText: '',
  });

  const [resultsDialogOpen, setResultsDialogOpen] = useState(false);
  const [lastResults, setLastResults] = useState<ResultItem[]>([]);

  // Ref to cancel/skip delay
  const skipDelayRef = useRef<(() => void) | null>(null);
  const abortSendingRef = useRef(false);

  const fetchAuditData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/whatsapp/audit-delivery');
      const data = await res.json();

      if (res.ok && data.success) {
        setSummary(data.summary);
        if (data.batchSettings) {
          setBatchSettings({
            batchSize: data.batchSettings.batchSize || 10,
            batchDelay: data.batchSettings.batchDelay || 120,
          });
        }
        setVerifiedSentList(data.verifiedSentList || []);
        setUnsentList(data.unsentList || []);
        setFailedList(data.failedList || []);
        setDuplicateList(data.duplicateList || []);
      } else {
        addToast({ type: 'error', title: 'Gagal', description: data.error || 'Gagal memuat audit pengiriman WhatsApp' });
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

  // Combined list for "Semua" filter
  const allInvoices = useMemo(() => {
    const list: Array<{
      invoiceId: string;
      invoiceNumber: string;
      customerName: string;
      customerUsername: string;
      phone: string;
      amount: number;
      dueDate: string;
      area: string;
      status: string;
      auditStatus: 'sent' | 'unsent' | 'failed';
      isLocked: boolean;
      lastSentAt?: string;
      providerName?: string;
      waRetryCount?: number;
    }> = [];

    for (const item of verifiedSentList) {
      list.push({
        invoiceId: item.invoiceId,
        invoiceNumber: item.invoiceNumber,
        customerName: item.customerName,
        customerUsername: item.customerUsername,
        phone: item.phone,
        amount: item.amount,
        dueDate: item.dueDate,
        area: item.area,
        status: item.status,
        auditStatus: 'sent',
        isLocked: item.isLocked,
        lastSentAt: item.lastSentAt,
        providerName: item.providerName,
      });
    }

    for (const item of unsentList) {
      list.push({
        invoiceId: item.invoiceId,
        invoiceNumber: item.invoiceNumber,
        customerName: item.customerName,
        customerUsername: item.customerUsername,
        phone: item.phone,
        amount: item.amount,
        dueDate: item.dueDate,
        area: item.area,
        status: item.status,
        auditStatus: 'unsent',
        isLocked: false,
        waRetryCount: 0,
      });
    }

    for (const item of failedList) {
      list.push({
        invoiceId: item.invoiceId,
        invoiceNumber: item.invoiceNumber,
        customerName: item.customerName,
        customerUsername: item.customerUsername,
        phone: item.phone,
        amount: item.amount,
        dueDate: item.dueDate,
        area: item.area,
        status: item.status,
        auditStatus: 'failed',
        isLocked: false,
        waRetryCount: item.waRetryCount || 1,
      });
    }

    return list;
  }, [verifiedSentList, unsentList, failedList]);

  // Filtered lists based on search
  const filteredAll = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return allInvoices;
    return allInvoices.filter(
      i =>
        i.customerName.toLowerCase().includes(q) ||
        i.customerUsername.toLowerCase().includes(q) ||
        i.phone.includes(q) ||
        i.invoiceNumber.toLowerCase().includes(q) ||
        i.area.toLowerCase().includes(q)
    );
  }, [allInvoices, searchQuery]);

  const filteredUnsent = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return unsentList;
    return unsentList.filter(
      i =>
        i.customerName.toLowerCase().includes(q) ||
        i.customerUsername.toLowerCase().includes(q) ||
        i.phone.includes(q) ||
        i.invoiceNumber.toLowerCase().includes(q) ||
        i.area.toLowerCase().includes(q)
    );
  }, [unsentList, searchQuery]);

  const filteredFailed = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return failedList;
    return failedList.filter(
      i =>
        i.customerName.toLowerCase().includes(q) ||
        i.customerUsername.toLowerCase().includes(q) ||
        i.phone.includes(q) ||
        i.invoiceNumber.toLowerCase().includes(q) ||
        i.area.toLowerCase().includes(q)
    );
  }, [failedList, searchQuery]);

  const filteredSent = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return verifiedSentList;
    return verifiedSentList.filter(
      i =>
        i.customerName.toLowerCase().includes(q) ||
        i.customerUsername.toLowerCase().includes(q) ||
        i.phone.includes(q) ||
        i.invoiceNumber.toLowerCase().includes(q) ||
        i.area.toLowerCase().includes(q)
    );
  }, [verifiedSentList, searchQuery]);

  const filteredDuplicates = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return duplicateList;
    return duplicateList.filter(
      i =>
        i.customerName.toLowerCase().includes(q) ||
        i.phone.includes(q) ||
        i.invoiceNumber.toLowerCase().includes(q)
    );
  }, [duplicateList, searchQuery]);

  // Active selectable items depending on current tab
  const currentSelectableIds = useMemo(() => {
    if (filterStatus === 'unsent') return filteredUnsent.map(i => i.invoiceId);
    if (filterStatus === 'failed') return filteredFailed.map(i => i.invoiceId);
    if (filterStatus === 'all') {
      return filteredAll
        .filter(i => i.auditStatus === 'unsent' || i.auditStatus === 'failed')
        .map(i => i.invoiceId);
    }
    return [];
  }, [filterStatus, filteredUnsent, filteredFailed, filteredAll]);

  // Selection handlers
  const handleToggleSelectAll = () => {
    if (currentSelectableIds.length === 0) return;
    const allSelected = currentSelectableIds.every(id => selectedIds.has(id));
    const next = new Set(selectedIds);
    if (allSelected) {
      for (const id of currentSelectableIds) {
        next.delete(id);
      }
    } else {
      for (const id of currentSelectableIds) {
        next.add(id);
      }
    }
    setSelectedIds(next);
  };

  const handleToggleItem = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  // Determine target IDs for sending
  const getTargetSendIds = (): string[] => {
    if (selectedIds.size > 0) {
      return Array.from(selectedIds);
    }
    if (filterStatus === 'failed') {
      return filteredFailed.map(i => i.invoiceId);
    }
    if (filterStatus === 'unsent') {
      return filteredUnsent.map(i => i.invoiceId);
    }
    // Default across unsent + failed
    return [...unsentList, ...failedList].map(i => i.invoiceId);
  };

  // Handle Permanent Lock Action
  const handleLockSentInvoices = async () => {
    setLockLoading(true);
    try {
      const res = await fetch('/api/admin/whatsapp/audit-delivery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'lock_sent' }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        addToast({
          type: 'success',
          title: 'Status Terkunci',
          description: data.message || 'Berhasil mengunci tagihan terkirim secara permanen',
        });
        setConfirmLockOpen(false);
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

  // Handle Batch Sending with Delay
  const executeBatchSending = async () => {
    const targetIds = getTargetSendIds();
    if (targetIds.length === 0) {
      addToast({ type: 'error', title: 'Pilih Tagihan', description: 'Tidak ada tagihan yang dipilih untuk dikirim' });
      return;
    }

    setConfirmSendOpen(false);
    setIsProcessing(true);
    abortSendingRef.current = false;

    const bSize = batchSettings.batchSize || 10;
    const bDelay = batchSettings.batchDelay || 120;

    // Split target IDs into chunks
    const chunks: string[][] = [];
    for (let i = 0; i < targetIds.length; i += bSize) {
      chunks.push(targetIds.slice(i, i + bSize));
    }

    const allResults: ResultItem[] = [];
    let totalSent = 0;
    let totalFailed = 0;
    let processedSoFar = 0;

    setProgressState({
      totalBatches: chunks.length,
      currentBatch: 1,
      totalTarget: targetIds.length,
      processedCount: 0,
      successCount: 0,
      failedCount: 0,
      countdown: 0,
      isWaitingDelay: false,
      statusText: `Mempersiapkan pengiriman batch 1 dari ${chunks.length}...`,
    });

    for (let cIdx = 0; cIdx < chunks.length; cIdx++) {
      if (abortSendingRef.current) {
        break;
      }

      const chunk = chunks[cIdx];
      const batchNum = cIdx + 1;

      setProgressState(prev => ({
        ...prev,
        currentBatch: batchNum,
        isWaitingDelay: false,
        statusText: `Mengirim batch ${batchNum} dari ${chunks.length} (${chunk.length} pesan)...`,
      }));

      try {
        const res = await fetch('/api/admin/whatsapp/audit-delivery', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'send_unsent',
            invoiceIds: chunk,
          }),
        });

        const data = await res.json();
        if (res.ok && data.success) {
          totalSent += data.sentCount || 0;
          totalFailed += data.failedCount || 0;
          if (Array.isArray(data.results)) {
            allResults.push(...data.results);
          }
        } else {
          totalFailed += chunk.length;
          for (const cid of chunk) {
            allResults.push({
              invoiceNumber: cid,
              phone: '-',
              customerName: 'Pelanggan',
              success: false,
              error: data.error || 'Server menolak request',
            });
          }
        }
      } catch (err: any) {
        totalFailed += chunk.length;
        for (const cid of chunk) {
          allResults.push({
            invoiceNumber: cid,
            phone: '-',
            customerName: 'Pelanggan',
            success: false,
            error: err.message || 'Koneksi terputus',
          });
        }
      }

      processedSoFar += chunk.length;
      setProgressState(prev => ({
        ...prev,
        processedCount: processedSoFar,
        successCount: totalSent,
        failedCount: totalFailed,
      }));

      // Delay between batches if not last batch
      if (cIdx < chunks.length - 1 && !abortSendingRef.current) {
        let remaining = bDelay;
        setProgressState(prev => ({
          ...prev,
          isWaitingDelay: true,
          countdown: remaining,
          statusText: `Menunggu jeda keamanan gateway WhatsApp (${remaining} detik)...`,
        }));

        let delayCancelled = false;
        await new Promise<void>(resolve => {
          skipDelayRef.current = () => {
            delayCancelled = true;
            resolve();
          };

          const interval = setInterval(() => {
            if (abortSendingRef.current || delayCancelled) {
              clearInterval(interval);
              resolve();
              return;
            }
            remaining -= 1;
            setProgressState(prev => ({
              ...prev,
              countdown: remaining,
              statusText: `Menunggu jeda keamanan gateway WhatsApp (${remaining} detik)...`,
            }));

            if (remaining <= 0) {
              clearInterval(interval);
              resolve();
            }
          }, 1000);
        });

        skipDelayRef.current = null;
      }
    }

    setIsProcessing(false);
    setSelectedIds(new Set());
    setLastResults(allResults);
    setResultsDialogOpen(true);
    fetchAuditData();
  };

  const handleSkipDelay = () => {
    if (skipDelayRef.current) {
      skipDelayRef.current();
    }
  };

  const handleAbortSending = () => {
    abortSendingRef.current = true;
    if (skipDelayRef.current) {
      skipDelayRef.current();
    }
  };

  // Calculations for confirmation dialog
  const targetSendIds = getTargetSendIds();
  const calculatedBatches = Math.ceil(targetSendIds.length / (batchSettings.batchSize || 10));
  const calculatedMinutes = Math.ceil(
    (calculatedBatches > 1 ? (calculatedBatches - 1) * (batchSettings.batchDelay || 120) : 0) / 60
  );

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">

      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card border border-border rounded-2xl p-5 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] font-mono uppercase tracking-wider">
              Proteksi &amp; Auditing WhatsApp
            </Badge>
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground mt-1 flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-emerald-500" />
            Audit Pengiriman WhatsApp &amp; Pencegahan Duplikat
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Verifikasi real log pengiriman pesan WhatsApp untuk memisahkan pelanggan yang benar-benar terkirim vs belum terkirim berdasarkan pencocokan nomor invoice.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAuditData}
            disabled={loading || isProcessing}
            className="border-border text-foreground hover:bg-muted text-xs font-bold rounded-xl"
          >
            <RefreshCw className={cn('w-4 h-4 mr-1.5', loading && 'animate-spin')} />
            Refresh Data
          </Button>
        </div>
      </div>

      {/* Summary Cards Bento (Clickable to Filter) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">

        {/* Card 1: Total */}
        <Card
          onClick={() => setFilterStatus('all')}
          className={cn(
            'border cursor-pointer transition-all duration-200 rounded-2xl shadow-sm bg-card hover:border-primary/50',
            filterStatus === 'all' ? 'border-primary ring-2 ring-primary/20' : 'border-border'
          )}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-mono font-bold uppercase text-muted-foreground">Total Tagihan Aktif</p>
              <h3 className="text-2xl font-bold text-foreground mt-1">{summary.totalInvoices}</h3>
            </div>
            <div className="p-3 rounded-xl bg-primary/10 text-primary">
              <FileText className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Terverifikasi Terkirim */}
        <Card
          onClick={() => setFilterStatus('sent')}
          className={cn(
            'border cursor-pointer transition-all duration-200 rounded-2xl shadow-sm bg-card hover:border-emerald-500/50',
            filterStatus === 'sent' ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-border'
          )}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-mono font-bold uppercase text-emerald-600 dark:text-emerald-400">Terverifikasi Terkirim</p>
              <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{summary.verifiedSent}</h3>
            </div>
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Belum Terkirim */}
        <Card
          onClick={() => setFilterStatus('unsent')}
          className={cn(
            'border cursor-pointer transition-all duration-200 rounded-2xl shadow-sm bg-card hover:border-slate-500/50',
            filterStatus === 'unsent' ? 'border-slate-600 dark:border-slate-400 ring-2 ring-slate-500/20' : 'border-border'
          )}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-mono font-bold uppercase text-slate-600 dark:text-slate-400">Belum Terkirim</p>
              <h3 className="text-2xl font-bold text-slate-600 dark:text-slate-400 mt-1">{summary.unsent}</h3>
            </div>
            <div className="p-3 rounded-xl bg-slate-500/10 text-slate-600 dark:text-slate-400">
              <Clock className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Gagal Terkirim */}
        <Card
          onClick={() => setFilterStatus('failed')}
          className={cn(
            'border cursor-pointer transition-all duration-200 rounded-2xl shadow-sm bg-card hover:border-rose-500/50',
            filterStatus === 'failed' ? 'border-rose-500 ring-2 ring-rose-500/20' : 'border-border'
          )}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-mono font-bold uppercase text-rose-600 dark:text-rose-400">Gagal Terkirim</p>
              <h3 className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">{summary.failed}</h3>
            </div>
            <div className="p-3 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <AlertCircle className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 5: Deteksi Duplikat */}
        <Card
          onClick={() => setFilterStatus('duplicates')}
          className={cn(
            'border cursor-pointer transition-all duration-200 rounded-2xl shadow-sm bg-card hover:border-amber-500/50',
            filterStatus === 'duplicates' ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-border'
          )}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-mono font-bold uppercase text-amber-600 dark:text-amber-400">Deteksi Duplikat</p>
              <h3 className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{summary.duplicates}</h3>
            </div>
            <div className="p-3 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Action Banner */}
      <Card className="border border-border bg-card shadow-sm rounded-2xl overflow-hidden">
        <CardContent className="p-5 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />
                <h3 className="text-sm font-bold text-foreground">Pusat Aksi Pengiriman &amp; Proteksi Anti-Spam</h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Pengiriman batch menggunakan antrean dengan jeda aman <strong>{batchSettings.batchDelay} detik</strong> per <strong>{batchSettings.batchSize} pesan</strong> untuk menjaga reputasi nomor WhatsApp.
              </p>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmLockOpen(true)}
                disabled={lockLoading || isProcessing || summary.verifiedSent === 0}
                className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 font-bold text-xs rounded-xl"
              >
                {lockLoading ? <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" /> : <Lock className="w-4 h-4 mr-1.5" />}
                Kunci Permanen ({summary.verifiedSent}) Terkirim
              </Button>

              <Button
                variant="default"
                size="sm"
                onClick={() => setConfirmSendOpen(true)}
                disabled={isProcessing || targetSendIds.length === 0}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl shadow-sm"
              >
                <Send className="w-4 h-4 mr-1.5" />
                {selectedIds.size > 0
                  ? `Kirim Ulang (${selectedIds.size}) Terpilih`
                  : `Kirim Ulang yang Belum Terkirim (${targetSendIds.length})`}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filter Tabs and Search Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card border border-border rounded-2xl p-3 shadow-sm">
        <div className="flex items-center gap-1.5 bg-muted/50 p-1 rounded-xl w-full sm:w-auto overflow-x-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFilterStatus('all')}
            className={cn(
              'rounded-lg text-xs font-bold transition-all px-3 py-1.5',
              filterStatus === 'all' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <FileText className="w-3.5 h-3.5 mr-1.5" />
            Semua ({summary.totalInvoices})
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFilterStatus('unsent')}
            className={cn(
              'rounded-lg text-xs font-bold transition-all px-3 py-1.5',
              filterStatus === 'unsent' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Clock className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
            Belum Terkirim ({summary.unsent})
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFilterStatus('failed')}
            className={cn(
              'rounded-lg text-xs font-bold transition-all px-3 py-1.5',
              filterStatus === 'failed' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <AlertCircle className="w-3.5 h-3.5 mr-1.5 text-rose-500" />
            Gagal ({summary.failed})
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFilterStatus('sent')}
            className={cn(
              'rounded-lg text-xs font-bold transition-all px-3 py-1.5',
              filterStatus === 'sent' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-500" />
            Terkirim ({summary.verifiedSent})
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFilterStatus('duplicates')}
            className={cn(
              'rounded-lg text-xs font-bold transition-all px-3 py-1.5',
              filterStatus === 'duplicates' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <AlertTriangle className="w-3.5 h-3.5 mr-1.5 text-amber-500" />
            Duplikat ({summary.duplicates})
          </Button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Cari pelanggan, invoice, nomor HP..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-background border-border text-xs rounded-xl h-9"
          />
        </div>
      </div>

      {/* Main Table Card */}
      <Card className="border border-border bg-card rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-primary mb-3" />
            <p className="text-xs font-mono text-muted-foreground">Melakukan verifikasi log audit WhatsApp...</p>
          </div>
        ) : filterStatus === 'duplicates' ? (
          /* Tab Duplikat */
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl">
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Daftar Pelanggan yang Terdeteksi Menerima Lebih dari 1 Notifikasi ({filteredDuplicates.length})
              </span>
            </div>

            {filteredDuplicates.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Tidak ada riwayat pengiriman duplikat terdeteksi.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredDuplicates.map(item => (
                  <div key={item.invoiceId} className="p-4 bg-muted/20 border border-amber-500/20 rounded-xl space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-bold text-foreground text-sm">{item.customerName}</span>
                        <span className="font-mono text-xs text-muted-foreground ml-2">({item.phone})</span>
                        <div className="font-mono text-xs font-bold text-primary mt-0.5">No. Invoice: {item.invoiceNumber}</div>
                      </div>
                      <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 font-mono text-[10px]">
                        Terkirim {item.sendCount}x
                      </Badge>
                    </div>

                    <div className="bg-muted/50 p-2.5 rounded-lg space-y-1 text-[11px] font-mono">
                      <span className="text-muted-foreground font-bold">Rincian Waktu Terkirim Log:</span>
                      {item.logs.map((l, idx) => (
                        <div key={idx} className="text-foreground flex items-center gap-2">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          <span>{formatWIB(l.sentAt, 'dd/MM/yyyy HH:mm:ss')}</span>
                          <span className="text-muted-foreground">({l.provider})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Table for All, Unsent, Failed, Sent */
          <div className="p-0 overflow-x-auto">
            {/* Table Header Action Bar if items selectable */}
            {currentSelectableIds.length > 0 && (
              <div className="p-3 bg-muted/30 border-b border-border flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={currentSelectableIds.length > 0 && currentSelectableIds.every(id => selectedIds.has(id))}
                    onCheckedChange={handleToggleSelectAll}
                  />
                  <span className="text-muted-foreground font-medium">
                    {selectedIds.size > 0
                      ? `${selectedIds.size} dari ${currentSelectableIds.length} tagihan terpilih`
                      : `Pilih Semua (${currentSelectableIds.length} tagihan)`}
                  </span>
                </div>

                {selectedIds.size > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedIds(new Set())}
                    className="h-7 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Batalkan Pilihan
                  </Button>
                )}
              </div>
            )}

            <Table className="w-full text-xs">
              <TableHeader className="bg-muted/40 border-b border-border">
                <TableRow>
                  {currentSelectableIds.length > 0 && (
                    <TableHead className="w-10 p-3">
                      <Checkbox
                        checked={currentSelectableIds.length > 0 && currentSelectableIds.every(id => selectedIds.has(id))}
                        onCheckedChange={handleToggleSelectAll}
                      />
                    </TableHead>
                  )}
                  <TableHead className="p-3 text-left font-mono font-bold uppercase">Pelanggan</TableHead>
                  <TableHead className="p-3 text-left font-mono font-bold uppercase">No. Invoice</TableHead>
                  <TableHead className="p-3 text-left font-mono font-bold uppercase">Wilayah</TableHead>
                  <TableHead className="p-3 text-left font-mono font-bold uppercase">Nominal</TableHead>
                  <TableHead className="p-3 text-left font-mono font-bold uppercase">Jatuh Tempo</TableHead>
                  <TableHead className="p-3 text-left font-mono font-bold uppercase">Status Log WA</TableHead>
                  {filterStatus === 'sent' && (
                    <>
                      <TableHead className="p-3 text-left font-mono font-bold uppercase">Waktu Terkirim</TableHead>
                      <TableHead className="p-3 text-left font-mono font-bold uppercase">Provider</TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>

              <TableBody className="divide-y divide-border">
                {/* 1. Filter ALL */}
                {filterStatus === 'all' && (
                  filteredAll.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={currentSelectableIds.length > 0 ? 7 : 6} className="p-8 text-center text-muted-foreground">
                        Tidak ada data tagihan ditemukan.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAll.map(item => {
                      const isSelectable = item.auditStatus === 'unsent' || item.auditStatus === 'failed';
                      return (
                        <TableRow key={item.invoiceId} className="hover:bg-muted/30 transition-colors">
                          {currentSelectableIds.length > 0 && (
                            <TableCell className="p-3">
                              {isSelectable ? (
                                <Checkbox
                                  checked={selectedIds.has(item.invoiceId)}
                                  onCheckedChange={() => handleToggleItem(item.invoiceId)}
                                />
                              ) : (
                                <div className="w-4 h-4" />
                              )}
                            </TableCell>
                          )}
                          <TableCell className="p-3">
                            <div className="font-bold text-foreground">{item.customerName}</div>
                            <div className="font-mono text-[10px] text-muted-foreground">{item.phone}</div>
                          </TableCell>
                          <TableCell className="p-3 font-mono font-bold text-primary">{item.invoiceNumber}</TableCell>
                          <TableCell className="p-3 font-mono text-muted-foreground">{item.area}</TableCell>
                          <TableCell className="p-3 font-mono font-bold">Rp {item.amount.toLocaleString('id-ID')}</TableCell>
                          <TableCell className="p-3 font-mono text-muted-foreground">{formatWIB(item.dueDate, 'dd/MM/yyyy')}</TableCell>
                          <TableCell className="p-3">
                            {item.auditStatus === 'sent' ? (
                              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-mono text-[10px]">
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Terverifikasi Terkirim
                              </Badge>
                            ) : item.auditStatus === 'failed' ? (
                              <Badge variant="outline" className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 font-mono text-[10px]">
                                <AlertCircle className="w-3 h-3 mr-1" />
                                Gagal ({item.waRetryCount}x)
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20 font-mono text-[10px]">
                                <Clock className="w-3 h-3 mr-1" />
                                Belum Dikirim
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )
                )}

                {/* 2. Filter UNSENT */}
                {filterStatus === 'unsent' && (
                  filteredUnsent.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="p-8 text-center text-muted-foreground">
                        <div className="flex items-center justify-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          Semua pelanggan tagihan aktif telah menerima notifikasi WA!
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUnsent.map(item => (
                      <TableRow key={item.invoiceId} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="p-3">
                          <Checkbox
                            checked={selectedIds.has(item.invoiceId)}
                            onCheckedChange={() => handleToggleItem(item.invoiceId)}
                          />
                        </TableCell>
                        <TableCell className="p-3">
                          <div className="font-bold text-foreground">{item.customerName}</div>
                          <div className="font-mono text-[10px] text-muted-foreground">{item.phone}</div>
                        </TableCell>
                        <TableCell className="p-3 font-mono font-bold text-primary">{item.invoiceNumber}</TableCell>
                        <TableCell className="p-3 font-mono text-muted-foreground">{item.area}</TableCell>
                        <TableCell className="p-3 font-mono font-bold">Rp {item.amount.toLocaleString('id-ID')}</TableCell>
                        <TableCell className="p-3 font-mono text-muted-foreground">{formatWIB(item.dueDate, 'dd/MM/yyyy')}</TableCell>
                        <TableCell className="p-3">
                          <Badge variant="outline" className="bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20 font-mono text-[10px]">
                            <Clock className="w-3 h-3 mr-1" />
                            Belum Dikirim
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )
                )}

                {/* 3. Filter FAILED */}
                {filterStatus === 'failed' && (
                  filteredFailed.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="p-8 text-center text-muted-foreground">
                        <div className="flex items-center justify-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          Tidak ada pelanggan dengan status pengiriman WA gagal!
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredFailed.map(item => (
                      <TableRow key={item.invoiceId} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="p-3">
                          <Checkbox
                            checked={selectedIds.has(item.invoiceId)}
                            onCheckedChange={() => handleToggleItem(item.invoiceId)}
                          />
                        </TableCell>
                        <TableCell className="p-3">
                          <div className="font-bold text-foreground">{item.customerName}</div>
                          <div className="font-mono text-[10px] text-muted-foreground">{item.phone}</div>
                        </TableCell>
                        <TableCell className="p-3 font-mono font-bold text-primary">{item.invoiceNumber}</TableCell>
                        <TableCell className="p-3 font-mono text-muted-foreground">{item.area}</TableCell>
                        <TableCell className="p-3 font-mono font-bold">Rp {item.amount.toLocaleString('id-ID')}</TableCell>
                        <TableCell className="p-3 font-mono text-muted-foreground">{formatWIB(item.dueDate, 'dd/MM/yyyy')}</TableCell>
                        <TableCell className="p-3">
                          <Badge variant="outline" className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 font-mono text-[10px]">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Gagal ({item.waRetryCount}x)
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )
                )}

                {/* 4. Filter SENT */}
                {filterStatus === 'sent' && (
                  filteredSent.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="p-8 text-center text-muted-foreground">
                        Tidak ada data terverifikasi terkirim.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSent.map(item => (
                      <TableRow key={item.invoiceId} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="p-3">
                          <div className="font-bold text-foreground">{item.customerName}</div>
                          <div className="font-mono text-[10px] text-muted-foreground">{item.phone}</div>
                        </TableCell>
                        <TableCell className="p-3 font-mono font-bold text-primary">{item.invoiceNumber}</TableCell>
                        <TableCell className="p-3 font-mono text-muted-foreground">{item.area}</TableCell>
                        <TableCell className="p-3 font-mono font-bold">Rp {item.amount.toLocaleString('id-ID')}</TableCell>
                        <TableCell className="p-3 font-mono text-muted-foreground">{formatWIB(item.dueDate, 'dd/MM/yyyy')}</TableCell>
                        <TableCell className="p-3">
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-mono text-[10px]">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Terverifikasi Terkirim
                          </Badge>
                        </TableCell>
                        <TableCell className="p-3 font-mono text-muted-foreground">
                          {item.lastSentAt ? formatWIB(item.lastSentAt, 'dd/MM/yyyy HH:mm:ss') : '-'}
                        </TableCell>
                        <TableCell className="p-3 font-mono text-foreground font-medium">
                          {item.providerName}
                        </TableCell>
                      </TableRow>
                    ))
                  )
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* DIALOG 1: Confirmation for Batch Resend */}
      <Dialog open={confirmSendOpen} onOpenChange={setConfirmSendOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground font-bold">
              <Send className="w-5 h-5 text-primary" />
              Konfirmasi Pengiriman Ulang WhatsApp
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Pastikan konfigurasi batch dan antrean pengiriman sesuai dengan parameter berikut.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="bg-muted/40 p-3.5 rounded-xl border border-border space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Jumlah Tagihan Sasaran:</span>
                <span className="font-bold font-mono text-foreground">{targetSendIds.length} invoice</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Ukuran Batch:</span>
                <span className="font-bold font-mono text-foreground">{batchSettings.batchSize} pesan per batch</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Jeda Antar Batch:</span>
                <span className="font-bold font-mono text-foreground">{batchSettings.batchDelay} detik</span>
              </div>
              <div className="flex justify-between items-center border-t border-border pt-2">
                <span className="text-muted-foreground">Total Batch &amp; Waktu:</span>
                <span className="font-bold font-mono text-primary">
                  {calculatedBatches} batch (~{calculatedMinutes} menit)
                </span>
              </div>
            </div>

            <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 leading-relaxed">
                Proteksi duplikat aktif: Sistem mengunci status tagihan secara otomatis sebelum pengiriman dimulai. Pesan yang gagal terkirim akan dibuka kembali agar dapat dicoba ulang.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmSendOpen(false)}
              className="text-xs font-bold rounded-xl"
            >
              Batal
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={executeBatchSending}
              className="text-xs font-bold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              Mulai Pengiriman Batch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG 2: Progress Indicator Modal */}
      <Dialog open={isProcessing} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md bg-card border-border [&>button]:hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground font-bold">
              <RefreshCw className="w-5 h-5 text-primary animate-spin" />
              Proses Pengiriman Batch WhatsApp
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Harap jangan menutup halaman ini selama proses pengiriman batch berlangsung.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Progress status bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-muted-foreground">Progress:</span>
                <span className="font-bold text-foreground">
                  {progressState.processedCount} / {progressState.totalTarget} ({Math.round((progressState.processedCount / (progressState.totalTarget || 1)) * 100)}%)
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden border border-border">
                <div
                  className="bg-primary h-2 transition-all duration-300 rounded-full"
                  style={{
                    width: `${Math.round((progressState.processedCount / (progressState.totalTarget || 1)) * 100)}%`,
                  }}
                />
              </div>
            </div>

            {/* Metrics Counter */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
              <div className="bg-muted/40 p-2 rounded-xl border border-border">
                <div className="text-[10px] text-muted-foreground uppercase">Batch</div>
                <div className="font-bold text-foreground mt-0.5">
                  {progressState.currentBatch} / {progressState.totalBatches}
                </div>
              </div>
              <div className="bg-emerald-500/10 p-2 rounded-xl border border-emerald-500/20">
                <div className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase">Berhasil</div>
                <div className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {progressState.successCount}
                </div>
              </div>
              <div className="bg-rose-500/10 p-2 rounded-xl border border-rose-500/20">
                <div className="text-[10px] text-rose-600 dark:text-rose-400 uppercase">Gagal</div>
                <div className="font-bold text-rose-600 dark:text-rose-400 mt-0.5">
                  {progressState.failedCount}
                </div>
              </div>
            </div>

            {/* Delay Countdown Alert Box */}
            {progressState.isWaitingDelay ? (
              <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    Jeda Antar Batch:
                  </span>
                  <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                    {progressState.countdown} detik tersisa
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Jeda keamanan untuk mencegah pemblokiran gateway WhatsApp sebelum batch berikutnya dimulai.
                </p>
                <div className="pt-1 flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSkipDelay}
                    className="h-7 text-xs font-bold border-amber-500/30 text-amber-600 hover:bg-amber-500/10 rounded-lg"
                  >
                    <FastForward className="w-3.5 h-3.5 mr-1" />
                    Lewati Jeda
                  </Button>
                </div>
              </div>
            ) : (
              <div className="bg-muted/40 p-3 rounded-xl border border-border text-xs text-muted-foreground font-mono flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />
                <span>{progressState.statusText}</span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAbortSending}
              className="w-full text-xs font-bold rounded-xl border-rose-500/30 text-rose-600 hover:bg-rose-500/10"
            >
              <PauseCircle className="w-4 h-4 mr-1.5" />
              Hentikan Pengiriman
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG 3: Final Results Summary */}
      <Dialog open={resultsDialogOpen} onOpenChange={setResultsDialogOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground font-bold">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              Pengiriman Batch Selesai
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Laporan ringkas hasil proses pengiriman batch pesan WhatsApp.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20">
                <p className="text-[10px] font-mono uppercase text-emerald-600 dark:text-emerald-400 font-bold">Berhasil Terkirim</p>
                <h4 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                  {lastResults.filter(r => r.success).length}
                </h4>
              </div>
              <div className="bg-rose-500/10 p-3 rounded-xl border border-rose-500/20">
                <p className="text-[10px] font-mono uppercase text-rose-600 dark:text-rose-400 font-bold">Gagal</p>
                <h4 className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">
                  {lastResults.filter(r => !r.success).length}
                </h4>
              </div>
            </div>

            {lastResults.some(r => !r.success) && (
              <div className="space-y-1.5">
                <span className="font-bold text-foreground text-xs">Daftar Tagihan Gagal:</span>
                <div className="max-h-40 overflow-y-auto divide-y divide-border bg-muted/30 border border-border rounded-xl p-2 font-mono text-[11px]">
                  {lastResults
                    .filter(r => !r.success)
                    .map((item, idx) => (
                      <div key={idx} className="py-1.5 flex justify-between items-center gap-2">
                        <span className="font-bold text-foreground truncate">{item.customerName} ({item.invoiceNumber})</span>
                        <span className="text-rose-500 shrink-0 text-[10px]">{item.error || 'Gagal'}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="default"
              size="sm"
              onClick={() => setResultsDialogOpen(false)}
              className="w-full text-xs font-bold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              Tutup &amp; Muat Ulang Halaman
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG 4: Confirm Lock Sent Invoices */}
      <Dialog open={confirmLockOpen} onOpenChange={setConfirmLockOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground font-bold">
              <Lock className="w-5 h-5 text-emerald-500" />
              Kunci Permanen Tagihan Terkirim
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Tindakan ini akan mengunci seluruh tagihan yang telah terverifikasi terkirim agar tidak pernah menerima pengiriman ulang.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 text-xs space-y-2">
            <p className="text-muted-foreground leading-relaxed">
              Sebanyak <strong>{summary.verifiedSent} tagihan</strong> dengan riwayat pengiriman WhatsApp sukses akan ditandai terkunci secara permanen di database.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmLockOpen(false)}
              disabled={lockLoading}
              className="text-xs font-bold rounded-xl"
            >
              Batal
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleLockSentInvoices}
              disabled={lockLoading}
              className="text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {lockLoading ? <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" /> : <Lock className="w-4 h-4 mr-1.5" />}
              Ya, Kunci Permanen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
