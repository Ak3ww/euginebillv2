'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { showSuccess, showError, showConfirm, showToast } from '@/lib/sweetalert';
import { formatWIB } from '@/lib/timezone';
import { useTranslation } from '@/hooks/useTranslation';
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
import { Loader2, DollarSign, FileText, CheckCircle, CheckCircle2, Clock, Eye, AlertCircle, Copy, Check, ExternalLink, MessageCircle, Trash2, Search, Download, Printer, Upload, ChevronLeft, ChevronRight, PlusSquare, Users, User as UserIcon } from 'lucide-react';
import Link from 'next/link';

interface Invoice {
  id: string;
  invoiceNumber: string;
  userId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  customerUsername: string | null;
  amount: number;
  status: string;
  dueDate: string;
  paidAt: string | null;
  paymentToken: string | null;
  paymentLink: string | null;
  createdAt: string;
  waNotifiedAt: string | null;
  baseAmount?: number;
  notes?: string | null;
  additionalFees?: { name: string; amount: number }[] | null;
  user: {
    customerId: string | null;  // ID Pelanggan
    name: string;
    phone: string;
    email: string | null;
    username: string;
    profile: {
      name: string;
    } | null;
    area: {  // Area
      id: string;
      name: string;
    } | null;
  } | null;
}

interface Stats {
  total: number;
  unpaid: number;
  paid: number;
  pending: number;
  overdue: number;
  totalUnpaidAmount: number;
  totalPaidAmount: number;
}

export default function InvoicesPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    unpaid: 0,
    paid: 0,
    pending: 0,
    overdue: 0,
    totalUnpaidAmount: 0,
    totalPaidAmount: 0,
  });
  const [activeTab, setActiveTab] = useState('unpaid');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'TRANSFER' | 'OTHER'>('CASH');
  const [sendReceipt, setSendReceipt] = useState(true);
  const [processing, setProcessing] = useState(false);
  
  // Edit form state
  const [editNotes, setEditNotes] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editAdditionalFees, setEditAdditionalFees] = useState<{name: string, amount: number}[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sendingWA, setSendingWA] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [printDialogInvoice, setPrintDialogInvoice] = useState<Invoice | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());
  const [broadcasting, setBroadcasting] = useState(false);
  const [exportDateFrom, setExportDateFrom] = useState('');
  const [exportDateTo, setExportDateTo] = useState('');
  const [invoiceMonth, setInvoiceMonth] = useState<string>(''); // '' = all-time, 'YYYY-MM' = filtered

  // Generate Invoice dialog
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genMonth, setGenMonth] = useState<string>(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [genScope, setGenScope] = useState<'all' | 'single'>('all');
  const [genUserId, setGenUserId] = useState('');
  const [genUserSearch, setGenUserSearch] = useState('');
  const [genUsers, setGenUsers] = useState<{ id: string; name: string; username: string; phone: string; profile: { name: string } | null }[]>([]);
  const [genLoadingUsers, setGenLoadingUsers] = useState(false);
  const [genSkipExisting, setGenSkipExisting] = useState(true);
  const [genSendWa, setGenSendWa] = useState(false);
  const [genAdditionalFees, setGenAdditionalFees] = useState<{name: string, amount: number}[]>([]);
  const [genResult, setGenResult] = useState<{ generated: number; skipped: number; errors: { username: string; error: string }[]; message: string } | null>(null);

  const MONTH_NAMES_ID = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const getMonthLabel = (ym: string) => {
    if (!ym) return 'Semua';
    const [y, m] = ym.split('-').map(Number);
    return `${MONTH_NAMES_ID[m - 1]} ${y}`;
  };
  const shiftInvoiceMonth = (delta: number) => {
    const base = invoiceMonth || (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; })();
    const [y, m] = base.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setInvoiceMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
  };

  useEffect(() => {
    loadInvoices();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, invoiceMonth]);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      const status = activeTab === 'unpaid' ? 'PENDING' : activeTab === 'paid' ? 'PAID' : 'all';
      const params = new URLSearchParams({ status });
      if (invoiceMonth) params.set('month', invoiceMonth);
      const res = await fetch(`/api/invoices?${params}`);
      const data = await res.json();
      setInvoices(data.invoices || []);
      setStats(data.stats || stats);
    } catch (error) {
      console.error('Load invoices error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredInvoices = () => {
    if (!searchQuery) return invoices;
    const query = searchQuery.toLowerCase();
    return invoices.filter(inv =>
      inv.invoiceNumber.toLowerCase().includes(query) ||
      inv.customerName?.toLowerCase().includes(query) ||
      inv.customerUsername?.toLowerCase().includes(query) ||
      inv.customerPhone?.includes(query)
    );
  };

  const handleMarkAsPaid = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setPaymentMethod('CASH');
    setSendReceipt(true);
    setIsPaymentDialogOpen(true);
  };

  const confirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;

    setProcessing(true);
    try {
      const res = await fetch('/api/invoices', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: selectedInvoice.id, 
          status: 'PAID',
          paymentMethod,
          sendReceipt
        }),
      });

      if (res.ok) {
        setIsPaymentDialogOpen(false);
        loadInvoices();
        showToast(t('invoices.markedAsPaid'), 'success');
      } else {
        const data = await res.json();
        await showError(data.error || t('invoices.failedToMarkPaid'));
      }
    } catch (error) {
      await showError(t('invoices.failedToMarkPaid'));
    } finally {
      setProcessing(false);
    }
  };
  const handleCancelPayment = async (invoice: Invoice) => {
    const confirmed = await showConfirm(
      'Batalkan Pelunasan?',
      `Masa aktif pengguna akan dikurangi dan dapat berakibat pemutusan akses internet jika masa aktif baru telah lewat. Apakah Anda yakin?`
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/invoices/${invoice.id}/cancel-payment`, {
        method: 'POST',
      });
      if (res.ok) {
        showToast('Pelunasan berhasil dibatalkan', 'success');
        loadInvoices();
      } else {
        const data = await res.json();
        await showError(data.error || 'Gagal membatalkan pelunasan');
      }
    } catch (error) {
      await showError('Gagal membatalkan pelunasan');
    }
  };

  const handleResendReceipt = async (invoice: Invoice) => {
    if (!invoice.customerPhone) {
      await showError('Nomor WhatsApp pelanggan tidak tersedia');
      return;
    }
    
    setSendingWA(invoice.id);
    try {
      const res = await fetch('/api/whatsapp/resend-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: invoice.id }),
      });
      if (res.ok) {
        showToast('Struk lunas berhasil dikirim ulang', 'success');
      } else {
        const data = await res.json();
        await showError(data.error || 'Gagal mengirim ulang struk');
      }
    } catch (error) {
      await showError('Gagal mengirim ulang struk');
    } finally {
      setSendingWA(null);
    }
  };


  const handleViewDetail = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setIsDetailDialogOpen(true);
  };

  const handleEditInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setEditNotes(invoice.notes || '');
    setEditDueDate(invoice.dueDate ? new Date(invoice.dueDate).toISOString().split('T')[0] : '');
    setEditAdditionalFees(invoice.additionalFees || []);
    setIsEditDialogOpen(true);
  };

  const submitEditInvoice = async () => {
    if (!selectedInvoice) return;
    setProcessing(true);
    try {
      const res = await fetch(`/api/invoices/${selectedInvoice.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dueDate: editDueDate,
          notes: editNotes,
          additionalFees: editAdditionalFees
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Tagihan berhasil diperbarui', 'success');
        setIsEditDialogOpen(false);
        loadInvoices();
      } else {
        await showError(data.error || 'Gagal memperbarui tagihan');
      }
    } catch (error) {
      await showError('Gagal memperbarui tagihan');
    } finally {
      setProcessing(false);
    }
  };

  const handleCopyPaymentLink = async (invoice: Invoice) => {
    if (!invoice.paymentLink) return;
    try {
      await navigator.clipboard.writeText(invoice.paymentLink);
      setCopiedId(invoice.id);
      setTimeout(() => setCopiedId(null), 2000);
      showToast(t('invoices.paymentLinkCopied'), 'success');
    } catch (error) {
      showToast(t('common.failedToCopy'), 'error');
    }
  };

  const handleSendWhatsApp = async (invoice: Invoice) => {
    if (!invoice.customerPhone) {
      await showError(t('invoices.customerPhoneNotFound'));
      return;
    }

    const confirmed = await showConfirm(t('invoices.sendReminderTo', { name: invoice.customerName || invoice.customerUsername || '' }), t('invoices.sendWhatsApp'));
    if (!confirmed) return;

    setSendingWA(invoice.id);
    try {
      const res = await fetch('/api/invoices/send-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: invoice.id }),
      });
      const data = await res.json();
      if (data.success) {
        await showSuccess(t('invoices.whatsappReminderSent'));
        // Update waNotifiedAt in local state without reloading all invoices
        setInvoices(invoices.map(inv => inv.id === invoice.id ? { ...inv, waNotifiedAt: new Date().toISOString() } : inv));
      } else {
        await showError(data.error || t('invoices.failedToSend'));
      }
    } catch (error) {
      await showError(t('invoices.failedToSendWhatsApp'));
    } finally {
      setSendingWA(null);
    }
  };

  const toggleInvoiceSelection = (invoiceId: string) => {
    const newSelection = new Set(selectedInvoices);
    if (newSelection.has(invoiceId)) {
      newSelection.delete(invoiceId);
    } else {
      newSelection.add(invoiceId);
    }
    setSelectedInvoices(newSelection);
  };

  const toggleSelectAll = () => {
    const filteredInvoices = getFilteredInvoices();
    if (selectedInvoices.size === filteredInvoices.length) {
      setSelectedInvoices(new Set());
    } else {
      setSelectedInvoices(new Set(filteredInvoices.map(inv => inv.id)));
    }
  };

  const handleBroadcastInvoices = async () => {
    if (selectedInvoices.size === 0) {
      await showError(t('invoices.selectMinOneInvoice'));
      return;
    }

    const confirmed = await showConfirm(
      t('invoices.broadcastConfirm', { count: selectedInvoices.size }),
      t('invoices.broadcastBilling')
    );
    if (!confirmed) return;

    setBroadcasting(true);
    try {
      const res = await fetch('/api/whatsapp/broadcast-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceIds: Array.from(selectedInvoices),
        }),
      });

      const data = await res.json();

      if (data.success) {
        await showSuccess(`Broadcast ${t('common.success').toLowerCase()}!\n✅ ${t('whatsapp.sent')}: ${data.successCount}\n❌ ${t('whatsapp.failed')}: ${data.failCount}`);
        setSelectedInvoices(new Set());
      } else {
        await showError(data.error || t('whatsapp.broadcastFailed'));
      }
    } catch (error) {
      console.error('Broadcast error:', error);
      await showError(t('common.failedSendBroadcast'));
    } finally {
      setBroadcasting(false);
    }
  };

  const handleDeleteInvoice = async (invoice: Invoice) => {
    const confirmed = await showConfirm(
      `${t('invoices.deleteConfirm', { number: invoice.invoiceNumber })}\n\n${invoice.customerName || invoice.customerUsername || 'Unknown'}\n${formatCurrency(Number(invoice.amount))}`,
      t('invoices.deleteInvoice')
    );
    if (!confirmed) return;

    setDeleting(invoice.id);
    try {
      const res = await fetch(`/api/invoices?id=${invoice.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        loadInvoices();
        showToast(t('invoices.invoiceDeleted'), 'success');
      } else {
        await showError(data.error || t('common.failedDelete'));
      }
    } catch (error) {
      await showError(t('invoices.failedDeleteInvoice'));
    } finally {
      setDeleting(null);
    }
  };

  const handleMassDeleteInvoices = async () => {
    if (selectedInvoices.size === 0) return;

    const confirmed = await showConfirm(
      `Apakah Anda yakin ingin menghapus ${selectedInvoices.size} tagihan yang dipilih? Data yang dihapus tidak dapat dikembalikan.`,
      `Hapus ${selectedInvoices.size} Tagihan`
    );
    if (!confirmed) return;

    setBroadcasting(true); // Using broadcasting state temporarily for mass delete loading
    try {
      const ids = Array.from(selectedInvoices).join(',');
      const res = await fetch(`/api/invoices?ids=${ids}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`${data.deletedCount} tagihan berhasil dihapus`, 'success');
        setSelectedInvoices(new Set());
        loadInvoices();
      } else {
        await showError(data.error || 'Gagal menghapus tagihan secara massal');
      }
    } catch (error) {
      await showError('Gagal menghubungi server untuk hapus massal');
    } finally {
      setBroadcasting(false);
    }
  };

  // Export functions
  const handleExportExcel = async () => {
    try {
      const status = activeTab === 'unpaid' ? 'PENDING' : activeTab === 'paid' ? 'PAID' : 'all';
      let url = `/api/invoices/export?format=excel&status=${status}`;
      if (exportDateFrom) url += `&startDate=${exportDateFrom}`;
      if (exportDateTo) url += `&endDate=${exportDateTo}`;
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement('a'); a.href = window.URL.createObjectURL(blob);
      const dateSuffix = exportDateFrom && exportDateTo ? `${exportDateFrom}_to_${exportDateTo}` : new Date().toISOString().split('T')[0];
      a.download = `Invoices-${dateSuffix}.xlsx`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); window.URL.revokeObjectURL(a.href);
    } catch (error) { console.error('Export error:', error); await showError(t('invoices.exportFailed')); }
  };

  const handleExportPDF = async () => {
    try {
      const status = activeTab === 'unpaid' ? 'PENDING' : activeTab === 'paid' ? 'PAID' : 'all';
      let url = `/api/invoices/export?format=pdf&status=${status}`;
      if (exportDateFrom) url += `&startDate=${exportDateFrom}`;
      if (exportDateTo) url += `&endDate=${exportDateTo}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.pdfData) {
        const jsPDF = (await import('jspdf')).default;
        const autoTable = (await import('jspdf-autotable')).default;
        const doc = new jsPDF({ orientation: 'landscape' });
        doc.setFontSize(14); doc.text(data.pdfData.title, 14, 15);
        doc.setFontSize(8); doc.text(`Generated: ${data.pdfData.generatedAt}`, 14, 21);
        autoTable(doc, { head: [data.pdfData.headers], body: data.pdfData.rows, startY: 26, styles: { fontSize: 7 }, headStyles: { fillColor: [13, 148, 136] } });
        if (data.pdfData.summary) {
          const finalY = (doc as any).lastAutoTable.finalY + 8;
          doc.setFontSize(9); doc.setFont('helvetica', 'bold');
          data.pdfData.summary.forEach((s: any, i: number) => { doc.text(`${s.label}: ${s.value}`, 14, finalY + (i * 5)); });
        }
        const dateSuffix = exportDateFrom && exportDateTo ? `${exportDateFrom}_to_${exportDateTo}` : new Date().toISOString().split('T')[0];
        doc.save(`Invoices-${dateSuffix}.pdf`);
      }
    } catch (error) { console.error('PDF error:', error); await showError(t('invoices.pdfExportFailed')); }
  };

  const handlePrintInvoice = async (invoice: Invoice) => {
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/pdf`);
      const data = await res.json();
      if (!data.success || !data.data) { await showError(t('invoices.failedGetInvoiceData')); return; }
      const inv = data.data;

      const jsPDF = (await import('jspdf')).default;
      const doc = new jsPDF();

      // Header
      doc.setFontSize(18); doc.setFont('helvetica', 'bold');
      doc.text(inv.company.name, 105, 20, { align: 'center' });
      doc.setFontSize(9); doc.setFont('helvetica', 'normal');
      if (inv.company.address) doc.text(inv.company.address, 105, 26, { align: 'center' });
      if (inv.company.phone) doc.text(`Tel: ${inv.company.phone}`, 105, 31, { align: 'center' });

      // Invoice title
      doc.setFontSize(16); doc.setFont('helvetica', 'bold');
      doc.text(t('invoices.pdfInvoice'), 105, 45, { align: 'center' });

      // Invoice details
      doc.setFontSize(10); doc.setFont('helvetica', 'normal');
      doc.text(`${t('invoices.pdfNo')} ${inv.invoice.number}`, 14, 55);
      doc.text(`${t('invoices.pdfDate')} ${inv.invoice.date}`, 14, 61);
      doc.text(`${t('invoices.pdfDue')} ${inv.invoice.dueDate}`, 14, 67);
      doc.text(`${t('invoices.pdfStatus')} ${inv.invoice.status}`, 14, 73);

      // Customer
      doc.setFont('helvetica', 'bold'); doc.text(`${t('invoices.pdfBillTo')}`, 130, 55);
      doc.setFont('helvetica', 'normal');
      doc.text(inv.customer.name, 130, 61);
      if (inv.customer.phone) doc.text(inv.customer.phone, 130, 67);

      // Items table
      const autoTable = (await import('jspdf-autotable')).default;
      autoTable(doc, {
        head: [[t('invoices.pdfHeaderDesc'), t('invoices.pdfHeaderQty'), t('invoices.pdfHeaderPrice'), t('invoices.pdfHeaderTotal')]],
        body: inv.items.map((item: any) => [item.description, item.quantity, formatCurrency(item.price), formatCurrency(item.total)]),
        startY: 85,
        headStyles: { fillColor: [13, 148, 136] },
        styles: { fontSize: 10 }
      });

      const finalY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFontSize(12); doc.setFont('helvetica', 'bold');
      doc.text(`Total: ${inv.amountFormatted}`, 196, finalY, { align: 'right' });

      if (inv.invoice.paidAt) {
        doc.setFontSize(14); doc.setTextColor(0, 128, 0);
        doc.text(t('invoices.pdfPaid'), 105, finalY + 15, { align: 'center' });
        doc.setFontSize(9); doc.text(`${t('invoices.pdfPaidOn')} ${inv.invoice.paidAt}`, 105, finalY + 21, { align: 'center' });
      }

      doc.save(`Invoice-${inv.invoice.number}.pdf`);
    } catch (error) { console.error('Print error:', error); await showError(t('invoices.failedPrintInvoice')); }
  };

  const handlePrintStandard = async (invoice: Invoice) => {
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/pdf`);
      const data = await res.json();
      if (!data.success || !data.data) { await showError(t('invoices.failedGetInvoiceData')); return; }
      const inv = data.data;
      const fmtCurr = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
      const win = window.open('', '_blank', 'width=850,height=1100');
      if (!win) return;
      win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Invoice ${inv.invoice.number}</title>
      <style>
        @media print {
          @page { size: A4; margin: 10mm; }
          html, body { width: 100% !important; max-width: 100% !important; margin: 0 !important; padding: 0 !important; }
          body { background: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          .topbar { display: none !important; }
          .sheet { border: none !important; border-radius: 0 !important; box-shadow: none !important; overflow: visible !important; max-width: 100% !important; width: 100% !important; margin: 0 !important; }
          .content { padding: 6mm 8mm !important; }
          .header-right { padding-top: 0 !important; overflow: visible !important; }
          .inv-title { overflow: visible !important; padding-top: 0 !important; line-height: 1.3 !important; }
          .inv-number { overflow: visible !important; line-height: 1.4 !important; }
          .meta-card, .payment-card, .paid-stamp { break-inside: avoid; page-break-inside: avoid; }
          table { table-layout: fixed; }
          th, td { word-break: break-word; }
        }
        * { box-sizing: border-box; }
        body { font-family: "Inter", "Segoe UI", Arial, sans-serif; font-size: 12px; color: #1e293b; margin: 0; padding: 24px 24px 80px; background: #f8fafc; }
        .sheet { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.04); max-width: 900px; margin: 0 auto; }
        .topbar { height: 6px; background: linear-gradient(90deg, #3b82f6, #60a5fa, #93c5fd); }
        .content { padding: 40px 48px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; gap: 24px; }
        .brand-wrap { display: flex; align-items: center; gap: 16px; flex: 1; min-width: 0; }
        .header-right { text-align: right; flex-shrink: 0; }
        .logo-box { flex-shrink: 0; width: 72px; height: 72px; border-radius: 12px; background: #fff; border: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: center; padding: 8px; overflow: hidden; }
        .company-name { font-size: 20px; font-weight: 700; color: #0f172a; margin-bottom: 4px; }
        .company-sub { color: #64748b; font-size: 12px; line-height: 1.5; }
        .inv-title { font-size: 28px; font-weight: 800; color: #0f172a; letter-spacing: 1.5px; line-height: 1.2; margin-bottom: 8px; }
        .inv-number { font-size: 14px; font-weight: 600; color: #3b82f6; margin-bottom: 12px; }
        .status-badge { display: inline-block; padding: 6px 14px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
        .paid-badge { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
        .pending-badge { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
        .divider { border: none; border-top: 1px solid #e2e8f0; margin: 24px 0; }
        .thin-divider { border: none; border-top: 1px dashed #e2e8f0; margin: 16px 0; }
        .section-title { font-weight: 700; font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; }
        .bill-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 32px; }
        .meta-card { background: #f8fafc; border: 1px solid #f1f5f9; border-radius: 12px; padding: 20px; }
        .info-row { margin-bottom: 6px; }
        .info-label { color: #64748b; font-weight: 500; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 32px; }
        th { background: #f8fafc; color: #475569; padding: 12px 16px; text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e2e8f0; }
        td { padding: 14px 16px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #334155; }
        .td-right { text-align: right; }
        .total-row td { font-weight: 700; font-size: 15px; color: #0f172a; background: #f8fafc; border-top: 2px solid #cbd5e1; }
        .actions-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin: 32px 0 16px; }
        .payment-card { padding: 24px; border-radius: 16px; border: 1px solid #e2e8f0; background: #fff; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03); }
        .payment-card-title { font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
        .payment-link { display: block; margin-top: 16px; padding: 14px 20px; border-radius: 8px; background: #f8fafc; border: 1px solid #e2e8f0; color: #334155; text-decoration: none; font-size: 13px; font-family: monospace; word-break: break-all; transition: all 0.2s; }
        .payment-link:hover { border-color: #cbd5e1; background: #f1f5f9; }
        .payment-cta { display: inline-flex; align-items: center; justify-content: center; width: 100%; margin-top: 16px; padding: 14px 24px; border-radius: 8px; background: #0f172a; color: #fff; text-decoration: none; font-size: 14px; font-weight: 600; transition: background 0.2s; }
        .payment-cta:hover { background: #1e293b; }
        .paid-stamp { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px 32px; border: 3px solid #22c55e; border-radius: 16px; text-align: center; width: fit-content; margin: 0 auto; background: #f0fdf4; }
        .paid-stamp-text { font-size: 24px; font-weight: 800; color: #16a34a; letter-spacing: 4px; }
        .paid-stamp-sub { font-size: 12px; color: #15803d; font-weight: 500; margin-top: 6px; }
        .footer { margin-top: 48px; text-align: center; color: #94a3b8; font-size: 12px; border-top: 1px solid #f1f5f9; padding-top: 24px; }
        .action-bar { position: fixed; bottom: 0; left: 0; right: 0; display: flex; gap: 16px; padding: 20px 32px; background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(12px); border-top: 1px solid #e2e8f0; box-shadow: 0 -4px 30px rgba(0,0,0,0.06); z-index: 100; justify-content: center; }
        .action-bar-inner { display: flex; gap: 16px; width: 100%; max-width: 900px; }
        .btn-print { flex: 1; padding: 14px; background: #fff; color: #0f172a; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
        .btn-print:hover { background: #f8fafc; border-color: #94a3b8; }
        .btn-pay { flex: 1; padding: 14px; background: #3b82f6; color: #fff; border: none; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; text-decoration: none; text-align: center; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3); }
        .btn-pay:hover { background: #2563eb; transform: translateY(-1px); box-shadow: 0 6px 16px rgba(59, 130, 246, 0.4); }
        @media (max-width: 640px) {
          body { padding: 12px 12px 100px !important; }
          .sheet { border-radius: 12px !important; }
          .content { padding: 24px !important; }
          .header { flex-direction: column; gap: 16px; }
          .header-right { text-align: left; }
          .inv-title { font-size: 24px; }
          .bill-grid { grid-template-columns: 1fr; gap: 16px; }
          .actions-grid { grid-template-columns: 1fr; gap: 16px; }
          .action-bar { padding: 16px; max-width: 100%; }
        }
      </style></head><body>
      <div class="sheet">
      <div class="topbar"></div>
      <div class="content">
      <div class="header">
        <div class="brand-wrap">
          ${inv.company.logo ? `<div class="logo-box"><img src="${inv.company.logo}" style="max-height:58px;max-width:58px;width:auto;object-fit:contain" alt="Logo"></div>` : ''}
          <div>
            <div class="company-name">${inv.company.name}</div>
            <div class="company-sub">
              ${inv.company.address ? `${inv.company.address}<br>` : ''}
              ${inv.company.phone ? `Telp: ${inv.company.phone}<br>` : ''}
              ${inv.company.email ? `${inv.company.email}` : ''}
            </div>
          </div>
        </div>
        <div class="header-right">
          <div class="inv-title">INVOICE</div>
          <div class="inv-number">${inv.invoice.number}</div>
          <div>${inv.invoice.status === 'PAID' ? '<span class="status-badge paid-badge">&#10003; SUDAH BAYAR</span>' : '<span class="status-badge pending-badge">BELUM BAYAR</span>'}</div>
        </div>
      </div>
      <hr class="divider">
      <div class="bill-grid">
        <div class="meta-card">
          <div class="section-title">Dari</div>
          <div class="info-row"><strong>${inv.company.name}</strong></div>
          ${inv.company.address ? `<div class="info-row">${inv.company.address}</div>` : ''}
          ${inv.company.phone ? `<div class="info-row">Telp: ${inv.company.phone}</div>` : ''}
        </div>
          <div class="meta-card">
          <div class="section-title">Kepada</div>
          <div class="info-row"><strong>${inv.customer.name}</strong></div>
          ${inv.customer.customerId ? `<div class="info-row"><span class="info-label">ID Pelanggan: </span>${inv.customer.customerId}</div>` : ''}
          ${inv.customer.phone ? `<div class="info-row"><span class="info-label">Telp: </span>${inv.customer.phone}</div>` : ''}
          ${inv.customer.address ? `<div class="info-row"><span class="info-label">Alamat: </span>${inv.customer.address}</div>` : ''}
        </div>
      </div>
      <div class="bill-grid">
        <div class="meta-card">
          <div class="section-title">Detail Invoice</div>
          <div class="info-row"><span class="info-label">No Invoice: </span><strong>${inv.invoice.number}</strong></div>
          <div class="info-row"><span class="info-label">Tanggal: </span>${inv.invoice.date}</div>
          <div class="info-row"><span class="info-label">Jatuh Tempo: </span>${inv.invoice.dueDate}</div>
          ${inv.invoice.paidAt ? `<div class="info-row"><span class="info-label">Tgl Bayar: </span>${inv.invoice.paidAt}</div>` : ''}
        </div>
        <div class="meta-card">
          <div class="section-title">Status Pembayaran</div>
          <div class="info-row"><span class="info-label">Status: </span><strong>${inv.invoice.status === 'PAID' ? '&#10003; LUNAS' : inv.invoice.status === 'OVERDUE' ? '&#9888; TERLAMBAT' : '&#9203; BELUM BAYAR'}</strong></div>
          ${inv.invoice.paidAt ? `<div class="info-row"><span class="info-label">Dibayar pada: </span>${inv.invoice.paidAt}</div><div class="info-row"><span class="info-label">Via: </span>${inv.paidVia === 'gateway' ? 'Payment Gateway' : inv.paidVia === 'transfer' ? 'Transfer Manual' : 'Dikonfirmasi Admin'}</div>` : ''}
        </div>
      </div>
      <div class="section-title">Rincian Layanan</div>
      <table>
        <thead><tr><th>Deskripsi</th><th style="width:60px;text-align:center">Qty</th><th style="width:130px;text-align:right">Harga</th><th style="width:130px;text-align:right">Total</th></tr></thead>
        <tbody>
          ${inv.items.map((item: { description: string; quantity: number; price: number; total: number }) => `
            <tr><td>${item.description}</td><td style="text-align:center">${item.quantity}</td><td class="td-right">${fmtCurr(item.price)}</td><td class="td-right">${fmtCurr(item.total)}</td></tr>
          `).join('')}
          ${(inv.additionalFees || []).map((fee: { name: string; amount: number }) => `
            <tr><td>${fee.name}</td><td style="text-align:center">1</td><td class="td-right">${fmtCurr(fee.amount)}</td><td class="td-right">${fmtCurr(fee.amount)}</td></tr>
          `).join('')}
          ${inv.tax && inv.tax.hasTax ? `
            <tr style="background:#f9fafb"><td colspan="3" style="text-align:right;font-size:11px;color:#555;padding:5px 10px">Subtotal</td><td class="td-right" style="color:#555;font-size:11px;padding:5px 10px">${fmtCurr(inv.tax.baseAmount)}</td></tr>
            <tr style="background:#fffbeb"><td colspan="3" style="text-align:right;font-size:11px;color:#d97706;padding:5px 10px">PPN ${inv.tax.taxRate}%</td><td class="td-right" style="color:#d97706;font-size:11px;padding:5px 10px">${fmtCurr(inv.tax.taxAmount)}</td></tr>
          ` : ''}
          <tr class="total-row"><td colspan="3" class="td-right">TOTAL</td><td class="td-right">${inv.amountFormatted}</td></tr>
        </tbody>
      </table>
      ${!inv.invoice.paidAt && inv.paymentLink ? `
        <div class="actions-grid">
          <div class="payment-card">
            <div class="payment-card-title">Link Pembayaran Online</div>
            <p class="payment-note">Pelanggan dapat membuka link berikut untuk melakukan pembayaran langsung. Link ini bisa dibuka dari ponsel atau browser.</p>
            <a class="payment-cta" href="${inv.paymentLink}" target="_blank" rel="noopener noreferrer">Buka Halaman Bayar</a>
            <a class="payment-link" href="${inv.paymentLink}" target="_blank" rel="noopener noreferrer">${inv.paymentLink}</a>
          </div>
          <div class="payment-card">
            <div class="payment-card-title">Petunjuk Pembayaran</div>
            <p class="payment-note">Jika pelanggan belum membayar, arahkan pelanggan untuk menggunakan link pembayaran online di samping atau transfer manual ke rekening perusahaan di bawah.</p>
          </div>
        </div>
      ` : ''}
      ${inv.invoice.paidAt ? `<div class="paid-stamp"><div class="paid-stamp-text">LUNAS</div><div class="paid-stamp-sub">Dibayar pada ${inv.invoice.paidAt}</div></div>` :
        (inv.company.bankAccounts && inv.company.bankAccounts.length > 0 ? `
        <div style="margin:18px 0;padding:16px;border:1px solid #6ee7b7;border-radius:8px;background:#f0fdfa">
          <div class="section-title" style="margin-bottom:10px">Pembayaran Manual</div>
          <p style="margin:0 0 12px;font-size:11px;color:#555">Transfer ke salah satu rekening berikut sebelum jatuh tempo:</p>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px">
            ${inv.company.bankAccounts.map((ba: { bankName: string; accountNumber: string; accountName: string }) => `
              <div style="border:1px solid #0d948840;border-radius:8px;padding:10px 14px;background:#fff">
                <div style="font-weight:bold;font-size:12px;color:#0d9488;margin-bottom:4px">${ba.bankName}</div>
                <div style="font-size:14px;font-weight:bold;letter-spacing:1px">${ba.accountNumber}</div>
                <div style="font-size:11px;color:#555;margin-top:2px">a/n ${ba.accountName}</div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : '')}
      <div class="footer">Terima kasih atas kepercayaan Anda &mdash; ${inv.company.name}${inv.company.poweredBy ? `<br><span style="font-size:9px">Support by ${inv.company.poweredBy}</span>` : ''}</div>
      </div>
      </div>
      <div class="action-bar no-print">
        <button class="btn-print" onclick="window.print()">&#128438; Cetak</button>
        <button class="btn-close" onclick="window.close()">&#10005; Tutup</button>
      </div>
      </body></html>`);
      win.document.close();
    } catch (error) { console.error('Print standard error:', error); await showError(t('invoices.failedPrintInvoice')); }
  };

  const handlePrintThermal = async (invoice: Invoice) => {
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/pdf`);
      const data = await res.json();
      if (!data.success || !data.data) { await showError(t('invoices.failedGetInvoiceData')); return; }
      const inv = data.data;
      const fmtCurr = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
      const win = window.open('', '_blank', 'width=400,height=650');
      if (!win) return;
      win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Struk ${inv.invoice.number}</title>
      <style>
        @media print { @page { margin: 0; width: 80mm; } body { padding: 0 !important; } .no-print { display: none !important; } }
        * { box-sizing: border-box; }
        body { font-family: 'Courier New', Courier, monospace; font-size: 11px; width: 80mm; max-width: 100%; padding: 0 0 70px; margin: 0 auto; color: #000; background: #fff; }
        .receipt { border-top: 4px solid #0d9488; padding: 5mm 4mm; }
        .logo { display:block; max-width: 34mm; max-height: 14mm; margin: 0 auto 3px; object-fit: contain; }
        .center { text-align: center; }
        .bold { font-weight: bold; }
        .big { font-size: 14px; }
        .dashed { border-top: 1px dashed #000; margin: 5px 0; }
        .row { display: flex; justify-content: space-between; margin-bottom: 2px; }
        .row span:first-child { color: #444; flex-shrink: 0; margin-right: 8px; }
        .row span:last-child { text-align: right; }
        .total-row { font-weight: bold; font-size: 13px; }
        .lunas-stamp { display: block; text-align: center; font-size: 17px; font-weight: bold; border: 3px double #000; padding: 4px 14px; margin: 8px auto; width: fit-content; letter-spacing: 3px; }
        .sm { font-size: 10px; color: #555; }
        .bank-box { border: 1px dashed #000; padding: 5px; margin: 4px 0; }
        .pay-box { border: 1px solid #0d9488; background: #f0fdfa; padding: 6px; margin: 6px 0; }
        .pay-link { display:block; color:#0f172a; text-decoration:none; word-break:break-all; margin-top:4px; }
        .action-bar { position: fixed; bottom: 0; left: 0; right: 0; display: flex; gap: 8px; padding: 10px 12px; background: #fff; border-top: 1px solid #e5e7eb; box-shadow: 0 -4px 12px rgba(0,0,0,0.08); z-index: 100; }
        .btn-print { flex: 1; padding: 10px; background: #0d9488; color: #fff; border: none; border-radius: 6px; font-size: 13px; font-weight: bold; cursor: pointer; }
        .btn-close { flex: 1; padding: 10px; background: #6b7280; color: #fff; border: none; border-radius: 6px; font-size: 13px; font-weight: bold; cursor: pointer; }
      </style></head><body>
      <div class="receipt">
      ${inv.company.logo ? `<img class="logo" src="${inv.company.logo}" alt="Logo">` : ''}
      <div class="center bold big">${inv.company.name}</div>
      ${inv.company.address ? `<div class="center sm">${inv.company.address}</div>` : ''}
      ${inv.company.phone ? `<div class="center sm">Telp: ${inv.company.phone}</div>` : ''}
      <div class="dashed"></div>
      <div class="row"><span>No</span><span>${inv.invoice.number}</span></div>
      <div class="row"><span>Tgl</span><span>${inv.invoice.date}</span></div>
      <div class="row"><span>Kasir</span><span>Administrator</span></div>
      <div class="dashed"></div>
      <div class="row"><span>Pelanggan</span><span>${inv.customer.name}</span></div>
      ${inv.customer.customerId ? `<div class="row"><span>ID</span><span>${inv.customer.customerId}</span></div>` : ''}
      ${inv.customer.phone ? `<div class="row"><span>Telp</span><span>${inv.customer.phone}</span></div>` : ''}
      ${inv.customer.area ? `<div class="row"><span>Area</span><span>${inv.customer.area}</span></div>` : ''}
      <div class="dashed"></div>
      ${inv.items.map((item: { description: string; quantity: number; price: number }) => `
        <div style="margin-bottom:3px">${item.description}</div>
        <div class="row"><span>&nbsp;&nbsp;${item.quantity} x</span><span>${fmtCurr(item.price)}</span></div>
      `).join('')}
      ${(inv.additionalFees || []).map((fee: { name: string; amount: number }) => `
        <div style="margin-bottom:3px">${fee.name}</div>
        <div class="row"><span>&nbsp;&nbsp;1 x</span><span>${fmtCurr(fee.amount)}</span></div>
      `).join('')}
      <div class="dashed"></div>
      ${inv.tax && inv.tax.hasTax ? `<div class="row"><span>Subtotal</span><span>${fmtCurr(inv.tax.baseAmount)}</span></div><div class="row"><span>PPN ${inv.tax.taxRate}%</span><span>${fmtCurr(inv.tax.taxAmount)}</span></div><div class="dashed"></div>` : ''}
      <div class="row total-row"><span>TOTAL</span><span>${inv.amountFormatted}</span></div>
      <div class="dashed"></div>
      <div class="row"><span>Jatuh Tempo</span><span>${inv.invoice.dueDate}</span></div>
      ${inv.invoice.paidAt ? `
        <div class="dashed"></div>
        <div class="row"><span>Tgl Bayar</span><span>${inv.invoice.paidAt}</span></div>
        <div class="row"><span>Metode</span><span>${inv.paidVia === 'gateway' ? 'Gateway' : inv.paidVia === 'transfer' ? 'Transfer' : 'Admin'}</span></div>
        <div class="lunas-stamp">** LUNAS **</div>
      ` : `${inv.paymentLink ? `<div class="pay-box"><div class="center bold">Link Pembayaran</div><a class="pay-link" href="${inv.paymentLink}" target="_blank" rel="noopener noreferrer">${inv.paymentLink}</a></div>` : ''}${inv.company.bankAccounts && inv.company.bankAccounts.length > 0 ? `<div style="margin:6px 0"><div class="center bold">Transfer Manual</div>${inv.company.bankAccounts.map((ba: { bankName: string; accountNumber: string; accountName: string }) => `<div class="bank-box"><div class="bold">${ba.bankName}</div><div>${ba.accountNumber}</div><div class="sm">a/n ${ba.accountName}</div></div>`).join('')}</div>` : `<div class="center sm" style="margin:6px 0">Harap bayar sebelum jatuh tempo</div>`}`}
      <div class="dashed"></div>
      <div class="center sm" style="margin-top:4px">Terima kasih</div>
      ${inv.company.poweredBy ? `<div class="center sm" style="margin-top:2px">Support by ${inv.company.poweredBy}</div>` : ''}
      </div>
      <div class="action-bar no-print">
        <button class="btn-print" onclick="window.print()">&#128438; Cetak</button>
        <button class="btn-close" onclick="window.close()">&#10005; Tutup</button>
      </div>
      </body></html>`);
      win.document.close();
    } catch (error) { console.error('Print thermal error:', error); await showError(t('invoices.failedPrintInvoice')); }
  };

  // Search users for generate single scope
  const searchUsersForGenerate = async (q: string) => {
    if (!q || q.length < 2) { setGenUsers([]); return; }
    setGenLoadingUsers(true);
    try {
      const res = await fetch(`/api/pppoe/users?status=active`);
      const data = await res.json();
      const all = (data.users || []) as { id: string; name: string; username: string; phone: string; profile: { name: string } | null }[];
      const filtered = all.filter(u =>
        u.name?.toLowerCase().includes(q.toLowerCase()) ||
        u.username?.toLowerCase().includes(q.toLowerCase()) ||
        u.phone?.includes(q)
      ).slice(0, 20);
      setGenUsers(filtered);
    } catch { setGenUsers([]); }
    finally { setGenLoadingUsers(false); }
  };

  const handleGenerate = async () => {
    if (genScope === 'single' && !genUserId) { await showError('Pilih pelanggan terlebih dahulu'); return; }
    setGenerating(true);
    setGenResult(null);
    try {
      const res = await fetch('/api/invoices/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetMonth: genMonth,
          scope: genScope,
          userId: genScope === 'single' ? genUserId : undefined,
          skipExisting: genSkipExisting,
          sendWa: genSendWa,
          additionalFees: genScope === 'single' ? genAdditionalFees : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setGenResult(data);
        loadInvoices();
      } else {
        await showError(data.error || 'Gagal generate tagihan');
      }
    } catch { await showError('Gagal generate tagihan'); }
    finally { setGenerating(false); }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
  };

  const formatDate = (dateStr: string) => formatWIB(new Date(dateStr), 'd MMM yyyy');

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID':
        return <Badge className="bg-success/10 text-success text-[10px] px-1.5 py-0.5">{t('invoices.paid')}</Badge>;
      case 'PENDING':
        return <Badge className="bg-warning/10 text-warning text-[10px] px-1.5 py-0.5">{t('invoices.pending')}</Badge>;
      case 'OVERDUE':
        return <Badge className="bg-destructive/10 text-destructive text-[10px] px-1.5 py-0.5">{t('invoices.overdue')}</Badge>;
      case 'CANCELLED':
        return <Badge className="bg-muted text-muted-foreground text-[10px] px-1.5 py-0.5">{t('invoices.cancelled')}</Badge>;
      default:
        return <Badge className="text-[10px] px-1.5 py-0.5">{status}</Badge>;
    }
  };

  const filteredInvoices = invoices.filter((inv) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      inv.invoiceNumber.toLowerCase().includes(q) ||
      inv.user?.name?.toLowerCase().includes(q) ||
      inv.customerName?.toLowerCase().includes(q) ||
      inv.user?.phone?.includes(q) ||
      inv.customerPhone?.includes(q)
    );
  });

  if (loading && invoices.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#bc13fe]/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#00f7ff]/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>
        <Loader2 className="w-12 h-12 animate-spin text-brand-500 dark:text-[#00f7ff] dark:drop-shadow-[0_0_20px_rgba(0,247,255,0.6)] relative z-10" />
      </div>
    );
  }

  return (
    <div className="bg-background relative">
      {/* Neon Cyberpunk Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#bc13fe]/20 rounded-full blur-3xl"></div>
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-[#00f7ff]/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-[#ff44cc]/20 rounded-full blur-3xl"></div>
        <div className="hidden dark:block absolute inset-0 bg-[linear-gradient(rgba(188,19,254,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(188,19,254,0.03)_1px,transparent_1px)] bg-[size:50px_50px]"></div>
      </div>

      <div className="relative z-10 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground dark:text-transparent dark:bg-clip-text dark:bg-gradient-to-r dark:from-[#00f7ff] dark:via-white dark:to-[#ff44cc] dark:drop-shadow-[0_0_30px_rgba(0,247,255,0.5)]">{t('invoices.title')}</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">{t('invoices.monthlyBilling')}</p>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {selectedInvoices.size > 0 && (
              <>
                <button
                  onClick={handleBroadcastInvoices}
                  disabled={broadcasting}
                  className="inline-flex items-center px-2 py-1.5 text-xs bg-accent text-accent-foreground rounded hover:bg-accent/90 disabled:opacity-50"
                >
                  {broadcasting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <MessageCircle className="h-3 w-3 mr-1" />}
                  {t('invoices.broadcast')} ({selectedInvoices.size})
                </button>
                <button
                  onClick={handleMassDeleteInvoices}
                  disabled={broadcasting}
                  className="inline-flex items-center px-2 py-1.5 text-xs bg-destructive text-destructive-foreground rounded hover:bg-destructive/90 disabled:opacity-50"
                >
                  {broadcasting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Trash2 className="h-3 w-3 mr-1" />}
                  Hapus Massal ({selectedInvoices.size})
                </button>
              </>
            )}
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[10px] text-muted-foreground whitespace-nowrap">Periode:</span>
              <input type="date" value={exportDateFrom} onChange={e => setExportDateFrom(e.target.value)}
                className="text-[10px] px-1.5 py-1 bg-[#1a1135]/80 border border-[#bc13fe]/30 rounded text-foreground focus:outline-none focus:border-[#bc13fe]/60" />
              <span className="text-[10px] text-[#e0d0ff]/40">–</span>
              <input type="date" value={exportDateTo} onChange={e => setExportDateTo(e.target.value)}
                className="text-[10px] px-1.5 py-1 bg-[#1a1135]/80 border border-[#bc13fe]/30 rounded text-foreground focus:outline-none focus:border-[#bc13fe]/60" />
            </div>
            <button onClick={handleExportExcel} className="inline-flex items-center px-2 py-1.5 text-xs border border-success text-success rounded hover:bg-success/10"><Download className="h-3 w-3 mr-1" />Excel</button>
            <button onClick={handleExportPDF} className="inline-flex items-center px-2 py-1.5 text-xs border border-destructive text-destructive rounded hover:bg-destructive/10"><Download className="h-3 w-3 mr-1" />PDF</button>
            <Link href="/admin/invoices/import">
              <button className="inline-flex items-center px-2 py-1.5 text-xs border border-[#bc13fe]/60 text-foreground rounded hover:bg-[#bc13fe]/10">
                <Upload className="h-3 w-3 mr-1" />Import CSV
              </button>
            </Link>
            <button
              onClick={() => { setShowGenerateDialog(true); setGenResult(null); }}
              className="inline-flex items-center px-2 py-1.5 text-xs border border-blue-500 text-blue-400 rounded hover:bg-blue-500/10"
            >
              <PlusSquare className="h-3 w-3 mr-1" />Generate Tagihan
            </button>

          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
          <div className="bg-card/80 backdrop-blur-xl rounded-xl border-2 border-[#bc13fe]/30 p-3 sm:p-4 shadow-[0_0_20px_rgba(188,19,254,0.2)] hover:border-[#bc13fe]/50 transition-all">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-[#00f7ff] uppercase tracking-wide truncate">{t('common.total')}</p>
                <p className="text-lg sm:text-2xl font-bold text-foreground mt-1">{stats.total}</p>
              </div>
              <div className="p-1.5 sm:p-2 rounded-lg shadow-lg bg-[#bc13fe]/20 flex-shrink-0 flex items-center justify-center">
                <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
            </div>
          </div>
          <div className="bg-card/80 backdrop-blur-xl rounded-xl border-2 border-[#bc13fe]/30 p-3 sm:p-4 shadow-[0_0_20px_rgba(188,19,254,0.2)] hover:border-[#bc13fe]/50 transition-all">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-[#00f7ff] uppercase tracking-wide truncate">{t('invoices.pending')}</p>
                <p className="text-lg sm:text-2xl font-bold text-foreground mt-1">{stats.unpaid}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 truncate">{formatCurrency(Number(stats.totalUnpaidAmount))}</p>
              </div>
              <div className="p-1.5 sm:p-2 rounded-lg shadow-lg bg-red-400/20 flex-shrink-0 flex items-center justify-center">
                <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-400" />
              </div>
            </div>
          </div>
          <div className="bg-card/80 backdrop-blur-xl rounded-xl border-2 border-[#bc13fe]/30 p-3 sm:p-4 shadow-[0_0_20px_rgba(188,19,254,0.2)] hover:border-[#bc13fe]/50 transition-all">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-[#00f7ff] uppercase tracking-wide truncate">{t('invoices.paid')}</p>
                <p className="text-lg sm:text-2xl font-bold text-foreground mt-1">{stats.paid}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 truncate">{formatCurrency(Number(stats.totalPaidAmount))}</p>
              </div>
              <div className="p-1.5 sm:p-2 rounded-lg shadow-lg bg-green-400/20 flex-shrink-0 flex items-center justify-center">
                <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-400" />
              </div>
            </div>
          </div>
          <div className="bg-card/80 backdrop-blur-xl rounded-xl border-2 border-[#bc13fe]/30 p-3 sm:p-4 shadow-[0_0_20px_rgba(188,19,254,0.2)] hover:border-[#bc13fe]/50 transition-all">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-[#00f7ff] uppercase tracking-wide truncate">{t('invoices.overdue')}</p>
                <p className="text-lg sm:text-2xl font-bold text-foreground mt-1">{stats.overdue}</p>
              </div>
              <div className="p-1.5 sm:p-2 rounded-lg shadow-lg bg-amber-400/20 flex-shrink-0 flex items-center justify-center">
                <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Invoice List */}
        <div className="bg-card rounded-lg border border-border">
          {/* Tabs & Search */}
          <div className="p-3 border-b border-border flex flex-col sm:flex-row gap-2 sm:items-center justify-between">
            <div className="flex gap-1">
              {[
                { key: 'unpaid', label: `${t('invoices.pending')} (${stats.unpaid})` },
                { key: 'paid', label: `${t('invoices.paid')} (${stats.paid})` },
                { key: 'all', label: `${t('common.all')} (${stats.total})` },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${activeTab === tab.key
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {/* Month Filter */}
            <div className="flex items-center gap-1 border border-border rounded-lg bg-muted/30 px-1 py-1">
              <button
                onClick={() => shiftInvoiceMonth(-1)}
                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setInvoiceMonth('')}
                className="text-xs font-medium text-foreground min-w-[90px] text-center hover:text-primary transition-colors"
                title="Klik untuk reset ke semua"
              >
                {getMonthLabel(invoiceMonth)}
              </button>
              <button
                onClick={() => shiftInvoiceMonth(1)}
                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder={t('common.search')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-48 pl-8 pr-3 py-1.5 text-xs bg-muted border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto hidden md:block">
            <Table>
              <TableHeader>
                <TableRow className="text-[10px]">
                  <TableHead className="text-[10px] py-2 w-8">
                    <input
                      type="checkbox"
                      checked={selectedInvoices.size === getFilteredInvoices().length && getFilteredInvoices().length > 0}
                      onChange={toggleSelectAll}
                      className="w-3.5 h-3.5 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                  </TableHead>
                  <TableHead className="text-[10px] py-2">{t('invoices.invoiceNumber')}</TableHead>
                  <TableHead className="text-[10px] py-2 hidden xl:table-cell">{t('invoices.customerId')}</TableHead>
                  <TableHead className="text-[10px] py-2">{t('invoices.customer')}</TableHead>
                  <TableHead className="text-[10px] py-2 hidden lg:table-cell">{t('common.email')}</TableHead>
                  <TableHead className="text-[10px] py-2 hidden lg:table-cell">{t('nav.profile')}</TableHead>
                  <TableHead className="text-[10px] py-2 hidden xl:table-cell">{t('common.area')}</TableHead>
                  <TableHead className="text-[10px] py-2 text-right">{t('invoices.amount')}</TableHead>
                  <TableHead className="text-[10px] py-2">{t('invoices.status')}</TableHead>
                  <TableHead className="text-[10px] py-2 hidden sm:table-cell">{t('invoices.dueDate')}</TableHead>
                  <TableHead className="text-[10px] py-2 text-right">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                      <AlertCircle className="h-5 w-5 mx-auto mb-1 opacity-50" />
                      <p className="text-xs">{t('common.noData')}</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInvoices.map((invoice) => (
                    <TableRow key={invoice.id} className="text-xs">
                      <TableCell className="py-2">
                        <input
                          type="checkbox"
                          checked={selectedInvoices.has(invoice.id)}
                          onChange={() => toggleInvoiceSelection(invoice.id)}
                          className="w-3.5 h-3.5 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                      </TableCell>
                      <TableCell className="py-2 font-mono font-medium text-[10px]">{invoice.invoiceNumber}</TableCell>
                      <TableCell className="py-2 hidden xl:table-cell text-[10px] text-muted-foreground">
                        {invoice.user?.customerId || '-'}
                      </TableCell>
                      <TableCell className="py-2 text-[10px]">
                        <div>
                          <div className="font-medium truncate max-w-[120px]">{invoice.user?.name || invoice.customerName || t('invoices.deleted')}</div>
                          <div className="text-muted-foreground text-[9px] truncate max-w-[120px]">{invoice.user?.phone || invoice.customerPhone || '-'}</div>
                        </div>
                      </TableCell>
                      <TableCell className="py-2 hidden lg:table-cell text-[10px] text-muted-foreground truncate max-w-[150px]">{invoice.user?.email || invoice.customerEmail || '-'}</TableCell>
                      <TableCell className="py-2 hidden lg:table-cell text-[10px] text-muted-foreground">{invoice.user?.profile?.name || '-'}</TableCell>
                      <TableCell className="py-2 hidden xl:table-cell text-[10px] text-muted-foreground">
                        {invoice.user?.area?.name || '-'}
                      </TableCell>
                      <TableCell className="py-2 text-right font-medium text-xs">{formatCurrency(Number(invoice.amount))}</TableCell>
                      <TableCell className="py-2">{getStatusBadge(invoice.status)}</TableCell>
                      <TableCell className="py-2 hidden sm:table-cell text-[10px] text-muted-foreground">{formatDate(invoice.dueDate)}</TableCell>
                      <TableCell className="py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {invoice.waNotifiedAt ? (
                            <div className="flex items-center mr-1 px-1.5 py-0.5 rounded bg-success/10 text-success text-[9px] font-medium" title={`Terakhir WA dikirim: ${formatWIB(invoice.waNotifiedAt)}`}>
                              <CheckCircle2 className="w-2.5 h-2.5 mr-1" />
                              WA Terkirim
                            </div>
                          ) : (
                            <div className="flex items-center mr-1 px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[9px] font-medium">
                              Belum WA
                            </div>
                          )}
                          {invoice.paymentLink && (
                            <button onClick={() => handleCopyPaymentLink(invoice)} className="p-1 hover:bg-muted rounded" title="Salin Link Pembayaran">
                              {copiedId === invoice.id ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
                            </button>
                          )}
                          <button 
                            onClick={() => {
                              const origin = typeof window !== 'undefined' ? window.location.origin : '';
                              navigator.clipboard.writeText(`${origin}/invoice/${invoice.invoiceNumber}`);
                              showToast('Link Invoice disalin', 'success');
                            }} 
                            className="p-1 hover:bg-muted rounded" 
                            title="Salin Link Invoice"
                          >
                            <Copy className="h-3 w-3 text-emerald-600" />
                          </button>
                          <Link href={`/invoice/${invoice.invoiceNumber}`} target="_blank" className="p-1 hover:bg-muted rounded text-blue-500" title="Buka Web Invoice">
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                          <button onClick={() => setPrintDialogInvoice(invoice)} className="p-1 hover:bg-muted rounded" title="Cetak Invoice">
                            <Printer className="h-3 w-3 text-muted-foreground" />
                          </button>
                          <button onClick={() => handleViewDetail(invoice)} className="p-1 hover:bg-muted rounded" title="Lihat Detail">
                            <Eye className="h-3 w-3 text-muted-foreground" />
                          </button>
                          {(invoice.status === 'PENDING' || invoice.status === 'OVERDUE') && (
                            <button onClick={() => handleEditInvoice(invoice)} className="p-1 hover:bg-muted rounded" title="Edit Tagihan">
                              <svg className="h-3 w-3 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          )}
                          {(invoice.status === 'PENDING' || invoice.status === 'OVERDUE') && invoice.customerPhone && (
                            <button onClick={() => handleSendWhatsApp(invoice)} disabled={sendingWA === invoice.id} className="p-1 hover:bg-muted rounded" title="WhatsApp">
                              {sendingWA === invoice.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <MessageCircle className="h-3 w-3 text-muted-foreground" />}
                            </button>
                          )}
                          {(invoice.status === 'PENDING' || invoice.status === 'OVERDUE') && (
                            <button onClick={() => handleMarkAsPaid(invoice)} className="px-1.5 py-0.5 text-[10px] font-medium bg-success text-success-foreground rounded hover:bg-success/90">
                              {t('invoices.markAsPaid')}
                            </button>
                          )}
                          {invoice.status === 'PAID' && (
                            <>
                              <button onClick={() => handleResendReceipt(invoice)} disabled={sendingWA === invoice.id} className="p-1 hover:bg-muted rounded text-green-600" title="Kirim Ulang Struk (WhatsApp)">
                                {sendingWA === invoice.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <MessageCircle className="h-3 w-3" />}
                              </button>
                              <button onClick={() => handleCancelPayment(invoice)} className="px-1.5 py-0.5 text-[10px] font-medium bg-destructive/10 text-destructive rounded hover:bg-destructive/20" title="Batalkan Pelunasan">
                                Cancel
                              </button>
                            </>
                          )}
                          <button onClick={() => handleDeleteInvoice(invoice)} disabled={deleting === invoice.id} className="p-1 hover:bg-destructive/10 rounded text-destructive" title="Hapus">
                            {deleting === invoice.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card View */}
          <div className="block md:hidden divide-y divide-border">
            {filteredInvoices.length === 0 ? (
              <div className="px-3 py-8 text-center text-muted-foreground">
                <AlertCircle className="h-5 w-5 mx-auto mb-1 opacity-50" />
                <p className="text-xs">{t('common.noData')}</p>
              </div>
            ) : (
              filteredInvoices.map((invoice) => (
                <div key={invoice.id} className="p-3 hover:bg-muted/50 transition-colors">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <input
                        type="checkbox"
                        checked={selectedInvoices.has(invoice.id)}
                        onChange={() => toggleInvoiceSelection(invoice.id)}
                        className="w-3.5 h-3.5 rounded border-gray-300 text-primary focus:ring-primary flex-shrink-0"
                      />
                      <div className="min-w-0">
                        <span className="font-mono text-[11px] font-medium text-foreground">{invoice.invoiceNumber}</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {getStatusBadge(invoice.status)}
                        </div>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-foreground whitespace-nowrap">{formatCurrency(Number(invoice.amount))}</span>
                  </div>
                  <div className="space-y-1 text-[11px] ml-6">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('invoices.customer')}:</span>
                      <span className="font-medium text-foreground truncate ml-2">{invoice.user?.name || invoice.customerName || t('invoices.deleted')}</span>
                    </div>
                    {(invoice.user?.customerId) && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">ID Pelanggan:</span>
                        <span className="font-mono text-[#00f7ff]">{invoice.user.customerId}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Phone:</span>
                      <span className="text-muted-foreground">{invoice.user?.phone || invoice.customerPhone || '-'}</span>
                    </div>
                    {invoice.user?.profile?.name && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t('nav.profile')}:</span>
                        <span className="text-muted-foreground">{invoice.user.profile.name}</span>
                      </div>
                    )}
                    {invoice.user?.area?.name && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t('common.area')}:</span>
                        <span className="text-muted-foreground">{invoice.user.area.name}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('invoices.dueDate')}:</span>
                      <span className="text-muted-foreground">{formatDate(invoice.dueDate)}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-1 mt-2 ml-6">
                    {invoice.paymentLink && (
                      <button onClick={() => handleCopyPaymentLink(invoice)} className="p-1.5 hover:bg-muted rounded" title="Salin Link Pembayaran">
                        {copiedId === invoice.id ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                      </button>
                    )}
                    <button 
                      onClick={() => {
                        const origin = typeof window !== 'undefined' ? window.location.origin : '';
                        navigator.clipboard.writeText(`${origin}/invoice/${invoice.invoiceNumber}`);
                        showToast('Link Invoice disalin', 'success');
                      }} 
                      className="p-1.5 hover:bg-muted rounded" 
                      title="Salin Link Invoice"
                    >
                      <Copy className="h-3.5 w-3.5 text-emerald-600" />
                    </button>
                    <Link href={`/invoice/${invoice.invoiceNumber}`} target="_blank" className="p-1.5 hover:bg-muted rounded text-blue-500" title="Buka Web Invoice">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                    <button onClick={() => setPrintDialogInvoice(invoice)} className="p-1.5 hover:bg-muted rounded" title="Cetak Invoice">
                      <Printer className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                    <button onClick={() => handleViewDetail(invoice)} className="p-1.5 hover:bg-muted rounded" title="Lihat Detail">
                      <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                    {(invoice.status === 'PENDING' || invoice.status === 'OVERDUE') && invoice.customerPhone && (
                      <button onClick={() => handleSendWhatsApp(invoice)} disabled={sendingWA === invoice.id} className="p-1.5 hover:bg-muted rounded" title="WhatsApp">
                        {sendingWA === invoice.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />}
                      </button>
                    )}
                    {(invoice.status === 'PENDING' || invoice.status === 'OVERDUE') && (
                      <button onClick={() => handleMarkAsPaid(invoice)} className="px-2 py-1 text-[10px] font-medium bg-success text-success-foreground rounded hover:bg-success/90">
                        {t('invoices.markAsPaid')}
                      </button>
                    )}
                    <button onClick={() => handleDeleteInvoice(invoice)} disabled={deleting === invoice.id} className="p-1.5 hover:bg-destructive/10 rounded text-destructive" title="Hapus">
                      {deleting === invoice.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Result count */}
          <div className="px-3 py-2 border-t border-border bg-muted">
            <p className="text-[10px] sm:text-xs text-muted-foreground">
              {t('table.showing')} {filteredInvoices.length} {t('table.of')} {invoices.length}
            </p>
          </div>
        </div>

        {/* Detail Dialog */}
        <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-sm">{t('common.details')}</DialogTitle>
              <DialogDescription className="text-xs">{selectedInvoice?.invoiceNumber}</DialogDescription>
            </DialogHeader>
            {selectedInvoice && (
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] text-muted-foreground">{t('invoices.invoiceNumber')}</p>
                    <p className="font-mono font-medium">{selectedInvoice.invoiceNumber}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">{t('invoices.status')}</p>
                    <div className="mt-0.5">{getStatusBadge(selectedInvoice.status)}</div>
                  </div>
                </div>
                <div className="border-t pt-3 border-border">
                  <p className="text-[10px] text-muted-foreground">{t('invoices.customer')}</p>
                  <p className="font-medium">{selectedInvoice.user?.name || selectedInvoice.customerName || t('invoices.deleted')}</p>
                  <p className="text-muted-foreground">{selectedInvoice.user?.phone || selectedInvoice.customerPhone || '-'}</p>
                  {(selectedInvoice.user?.email || selectedInvoice.customerEmail) && (
                    <p className="text-muted-foreground text-[10px]">📧 {selectedInvoice.user?.email || selectedInvoice.customerEmail}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] text-muted-foreground">{t('nav.profile')}</p>
                    <p>{selectedInvoice.user?.profile?.name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">{t('invoices.amount')}</p>
                    <p className="text-base font-bold text-success">{formatCurrency(Number(selectedInvoice.amount))}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] text-muted-foreground">{t('invoices.createdAt')}</p>
                    <p>{formatDate(selectedInvoice.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">{t('invoices.dueDate')}</p>
                    <p>{formatDate(selectedInvoice.dueDate)}</p>
                  </div>
                </div>
                {selectedInvoice.paymentLink && (
                  <div className="border-t pt-3 border-border">
                    <p className="text-[10px] text-muted-foreground mb-1.5">{t('invoices.paymentLink')}</p>
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={selectedInvoice.paymentLink}
                        readOnly
                        className="flex-1 px-2 py-1.5 text-[10px] bg-muted border border-border rounded font-mono truncate"
                      />
                      <button onClick={() => handleCopyPaymentLink(selectedInvoice)} className="p-1.5 hover:bg-muted rounded">
                        {copiedId === selectedInvoice.id ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                      <button onClick={() => window.open(selectedInvoice.paymentLink!, '_blank')} className="p-1.5 hover:bg-muted rounded">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => setIsDetailDialogOpen(false)} size="sm" className="h-8 text-xs">{t('common.close')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Print Dialog */}
        <Dialog open={printDialogInvoice !== null} onOpenChange={(open) => { if (!open) setPrintDialogInvoice(null); }}>
          <DialogContent className="max-w-xs p-0 overflow-hidden gap-0">
            <div className="h-1 w-full bg-gradient-to-r from-primary to-blue-400" />
            <div className="p-5">
              <DialogHeader className="mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-full bg-primary/15 border border-primary/30">
                    <Printer className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <DialogTitle className="text-sm font-bold">Pilih Jenis Printer</DialogTitle>
                    <DialogDescription className="text-[11px] font-mono mt-0.5">
                      {printDialogInvoice?.invoiceNumber}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => { if (printDialogInvoice) { setPrintDialogInvoice(null); window.open('/invoice/' + printDialogInvoice.invoiceNumber + '/print', '_blank'); } }}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                >
                  <FileText className="w-5 h-5 flex-shrink-0" />
                  <div className="text-left">
                    <div className="text-sm font-bold">Standar Printer</div>
                    <div className="text-[11px] opacity-80">A4 / Letter &mdash; invoice lengkap</div>
                  </div>
                </button>
                <button
                  onClick={() => { if (printDialogInvoice) { setPrintDialogInvoice(null); window.open('/invoice/' + printDialogInvoice.invoiceNumber + '/print', '_blank'); } }}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                >
                  <Printer className="w-5 h-5 flex-shrink-0" />
                  <div className="text-left">
                    <div className="text-sm font-bold">Thermal Printer</div>
                    <div className="text-[11px] opacity-80">58mm / 80mm &mdash; struk kasir</div>
                  </div>
                </button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPrintDialogInvoice(null)}
                  size="sm"
                  className="h-8 text-xs"
                >
                  {t('common.cancel')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Invoice Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-md p-0 overflow-hidden gap-0">
            <div className="h-1 w-full bg-gradient-to-r from-amber-500 to-yellow-400" />
            <div className="p-5">
              <DialogHeader className="mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-full bg-amber-500/15 border border-amber-500/30">
                    <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </div>
                  <div>
                    <DialogTitle className="text-sm font-bold">Edit Tagihan</DialogTitle>
                    <DialogDescription className="text-[11px] font-mono mt-0.5">
                      {selectedInvoice?.invoiceNumber}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Jatuh Tempo</label>
                  <input
                    type="date"
                    value={editDueDate}
                    onChange={e => setEditDueDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-muted border border-border rounded-xl focus:outline-none focus:border-amber-500/60"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Catatan Internal</label>
                  <textarea
                    value={editNotes}
                    onChange={e => setEditNotes(e.target.value)}
                    rows={2}
                    placeholder="Catatan..."
                    className="w-full px-3 py-2 text-xs bg-muted border border-border rounded-xl focus:outline-none focus:border-amber-500/60"
                  />
                </div>
                
                {/* Additional Fees / Discount */}
                <div className="pt-2 border-t border-border">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[11px] font-bold">Biaya Tambahan & Diskon</label>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setEditAdditionalFees([...editAdditionalFees, {name: '', amount: 0}])} className="text-[10px] text-blue-500 hover:text-blue-600 font-medium">+ Item Tambahan</button>
                    </div>
                  </div>
                  {editAdditionalFees.length === 0 ? (
                    <p className="text-[10px] text-muted-foreground italic">Tidak ada biaya tambahan atau diskon.</p>
                  ) : (
                    <div className="space-y-2">
                      {editAdditionalFees.map((fee, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <input type="text" placeholder="Nama Biaya/Diskon" value={fee.name} onChange={e => { const newFees = [...editAdditionalFees]; newFees[idx].name = e.target.value; setEditAdditionalFees(newFees); }} className="flex-1 px-2 py-1.5 text-xs bg-muted border rounded focus:outline-none" />
                          <input type="number" placeholder="Nominal (Gunakan - untuk diskon)" value={fee.amount === 0 ? '' : fee.amount} onChange={e => { const newFees = [...editAdditionalFees]; newFees[idx].amount = Number(e.target.value); setEditAdditionalFees(newFees); }} className="w-28 px-2 py-1.5 text-xs bg-muted border rounded focus:outline-none text-right" />
                          <button type="button" onClick={() => setEditAdditionalFees(editAdditionalFees.filter((_, i) => i !== idx))} className="p-1.5 text-destructive hover:bg-destructive/10 rounded"><Trash2 className="w-3 h-3" /></button>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-[9px] text-muted-foreground mt-1.5">*Gunakan nilai negatif (contoh: -20000) untuk diskon.</p>
                </div>
              </div>
              <div className="mt-5 flex gap-2">
                <Button type="button" variant="outline" size="sm" className="flex-1 h-9 text-xs" onClick={() => setIsEditDialogOpen(false)} disabled={processing}>Batal</Button>
                <Button type="button" size="sm" className="flex-1 h-9 text-xs bg-amber-500 hover:bg-amber-600 text-white" onClick={submitEditInvoice} disabled={processing}>
                  {processing ? <Loader2 className="w-3 h-3 animate-spin mr-1.5" /> : null} Simpan Perubahan
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Payment Dialog */}
        <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
          <DialogContent className="max-w-xs p-0 overflow-hidden gap-0">
            {/* Coloured header strip */}
            <div className="h-1 w-full bg-gradient-to-r from-success to-emerald-400" />
            <div className="p-5">
              <DialogHeader className="mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-full bg-success/15 border border-success/30">
                    <CheckCircle2 className="w-4 h-4 text-success" />
                  </div>
                  <div>
                    <DialogTitle className="text-sm font-bold">{t('invoices.markAsPaid')}</DialogTitle>
                    <DialogDescription className="text-[11px] font-mono mt-0.5">
                      {selectedInvoice?.invoiceNumber}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <form onSubmit={confirmPayment} className="space-y-3">
                <div className="rounded-xl border border-border/60 bg-muted/30 divide-y divide-border/40">
                  <div className="flex items-center justify-between px-3.5 py-2.5">
                    <span className="text-[11px] text-muted-foreground">{t('invoices.customer')}</span>
                    <span className="text-xs font-semibold">{selectedInvoice?.user?.name || selectedInvoice?.customerName || t('invoices.deleted')}</span>
                  </div>
                  <div className="flex items-center justify-between px-3.5 py-2.5">
                    <span className="text-[11px] text-muted-foreground">{t('invoices.amount')}</span>
                    <span className="text-sm font-bold text-success">{formatCurrency(Number(selectedInvoice?.amount || 0))}</span>
                  </div>
                </div>

                <div className="space-y-3 mt-3">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-foreground">Metode Pembayaran</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as any)}
                      className="w-full text-xs rounded-md border border-border bg-background px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    >
                      <option value="CASH">Cash (Tunai)</option>
                      <option value="TRANSFER">Bank Transfer</option>
                      <option value="OTHER">Lainnya</option>
                    </select>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="sendReceipt"
                      checked={sendReceipt}
                      onChange={(e) => setSendReceipt(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary/50"
                    />
                    <label htmlFor="sendReceipt" className="text-[11px] text-foreground cursor-pointer">
                      Kirim Notifikasi Pelunasan via WhatsApp
                    </label>
                  </div>
                </div>

                <div className="flex items-start gap-2 bg-info/10 border border-info/20 rounded-xl px-3 py-2.5">
                  <CheckCircle className="w-3.5 h-3.5 text-info flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-info leading-snug">{t('invoices.expiryExtendedNote')}</p>
                </div>

                <div className="flex gap-2 pt-1">
                  <Button type="button" variant="outline" onClick={() => setIsPaymentDialogOpen(false)} disabled={processing} size="sm" className="flex-1 h-9 text-xs">
                    {t('common.cancel')}
                  </Button>
                  <Button type="submit" disabled={processing} size="sm" className="flex-1 h-9 text-xs bg-success hover:bg-success/90 text-white">
                    {processing ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />}
                    {t('common.confirm')}
                  </Button>
                </div>
              </form>
            </div>
          </DialogContent>
        </Dialog>

        {/* Generate Invoice Dialog */}
        <Dialog open={showGenerateDialog} onOpenChange={(open) => { if (!open) { setShowGenerateDialog(false); setGenResult(null); } }}>
          <DialogContent className="max-w-sm p-0 overflow-hidden gap-0">
            <div className="h-1 w-full bg-gradient-to-r from-blue-500 to-cyan-400" />
            <div className="p-5">
              <DialogHeader className="mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-full bg-blue-500/15 border border-blue-500/30">
                    <PlusSquare className="w-4 h-4 text-blue-400" />
                  </div>
                  <div>
                    <DialogTitle className="text-sm font-bold">Generate Tagihan Manual</DialogTitle>
                    <DialogDescription className="text-[11px] mt-0.5">
                      Buat tagihan untuk pelanggan POSTPAID dan PREPAID
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              {genResult ? (
                /* Result view */
                <div className="space-y-3">
                  <div className={`rounded-xl border p-3 ${genResult.errors.length === 0 ? 'border-success/30 bg-success/10' : 'border-warning/30 bg-warning/10'}`}>
                    <p className="text-xs font-semibold mb-2">{genResult.message}</p>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-center">
                        <p className="text-lg font-bold text-success">{genResult.generated}</p>
                        <p className="text-[10px] text-muted-foreground">Dibuat</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-muted-foreground">{genResult.skipped}</p>
                        <p className="text-[10px] text-muted-foreground">Dilewati</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-destructive">{genResult.errors.length}</p>
                        <p className="text-[10px] text-muted-foreground">Gagal</p>
                      </div>
                    </div>
                  </div>
                  {genResult.errors.length > 0 && (
                    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 max-h-32 overflow-y-auto">
                      <p className="text-[10px] font-semibold text-destructive mb-1.5">Error detail:</p>
                      {genResult.errors.map((e, i) => (
                        <p key={i} className="text-[10px] text-muted-foreground"><span className="font-mono text-foreground">{e.username}</span>: {e.error}</p>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2 pt-1">
                    <Button type="button" variant="outline" size="sm" className="flex-1 h-9 text-xs" onClick={() => setGenResult(null)}>
                      Generate Lagi
                    </Button>
                    <Button type="button" size="sm" className="flex-1 h-9 text-xs" onClick={() => setShowGenerateDialog(false)}>
                      Selesai
                    </Button>
                  </div>
                </div>
              ) : (
                /* Form view */
                <div className="space-y-3">
                  {/* Scope toggle */}
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">Target</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => { setGenScope('all'); setGenUserId(''); setGenUserSearch(''); setGenUsers([]); }}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs transition-all ${genScope === 'all' ? 'border-blue-500 bg-blue-500/10 text-blue-400 font-medium' : 'border-border text-muted-foreground hover:border-border/80'}`}
                      >
                        <Users className="w-3.5 h-3.5 flex-shrink-0" />Semua Pelanggan
                      </button>
                      <button
                        type="button"
                        onClick={() => setGenScope('single')}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs transition-all ${genScope === 'single' ? 'border-blue-500 bg-blue-500/10 text-blue-400 font-medium' : 'border-border text-muted-foreground hover:border-border/80'}`}
                      >
                        <UserIcon className="w-3.5 h-3.5 flex-shrink-0" />Satu Pelanggan
                      </button>
                    </div>
                  </div>

                  {/* User search (single mode) */}
                  {genScope === 'single' && (
                    <div>
                      <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Cari Pelanggan</label>
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <input
                          type="text"
                          placeholder="Nama / username / no. HP..."
                          value={genUserSearch}
                          onChange={e => { setGenUserSearch(e.target.value); setGenUserId(''); searchUsersForGenerate(e.target.value); }}
                          className="w-full pl-8 pr-3 py-2 text-xs bg-muted/50 border border-border rounded-xl focus:outline-none focus:border-blue-500/60"
                        />
                      </div>
                      {genLoadingUsers && <p className="text-[10px] text-muted-foreground mt-1">Mencari...</p>}
                      {genUsers.length > 0 && !genUserId && (
                        <div className="mt-1 rounded-xl border border-border bg-card/80 shadow-lg max-h-36 overflow-y-auto">
                          {genUsers.map(u => (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => { setGenUserId(u.id); setGenUserSearch(`${u.name} (${u.username})`); setGenUsers([]); }}
                              className="w-full flex items-start gap-2 px-3 py-2 hover:bg-muted/50 text-left border-b border-border/40 last:border-0"
                            >
                              <div className="min-w-0">
                                <p className="text-xs font-medium truncate">{u.name}</p>
                                <p className="text-[10px] text-muted-foreground font-mono">{u.username} · {u.profile?.name || '-'}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      {genUserId && (
                        <p className="text-[10px] text-success mt-1">✓ Pelanggan dipilih</p>
                      )}
                    </div>
                  )}

                  {/* Month picker */}
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Bulan Tagihan</label>
                    <input
                      type="month"
                      value={genMonth}
                      onChange={e => setGenMonth(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-muted/50 border border-border rounded-xl focus:outline-none focus:border-blue-500/60"
                    />
                  </div>

                  {/* Additional Fees / Discount (Single Scope Only) */}
                  {genScope === 'single' && (
                    <div className="pt-2 border-t border-border">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-[11px] font-medium text-muted-foreground">Biaya Tambahan & Diskon</label>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => setGenAdditionalFees([...genAdditionalFees, {name: '', amount: 0}])} className="text-[10px] text-blue-500 hover:text-blue-600 font-medium">+ Item Tambahan</button>
                        </div>
                      </div>
                      {genAdditionalFees.length === 0 ? (
                        <p className="text-[10px] text-muted-foreground italic">Tidak ada biaya tambahan atau diskon.</p>
                      ) : (
                        <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                          {genAdditionalFees.map((fee, idx) => (
                            <div key={idx} className="flex gap-2 items-center">
                              <input type="text" placeholder="Nama Biaya/Diskon" value={fee.name} onChange={e => { const newFees = [...genAdditionalFees]; newFees[idx].name = e.target.value; setGenAdditionalFees(newFees); }} className="flex-1 px-2 py-1.5 text-xs bg-muted border rounded focus:outline-none" />
                              <input type="number" placeholder="Nominal (- diskon)" value={fee.amount === 0 ? '' : fee.amount} onChange={e => { const newFees = [...genAdditionalFees]; newFees[idx].amount = Number(e.target.value); setGenAdditionalFees(newFees); }} className="w-24 px-2 py-1.5 text-xs bg-muted border rounded focus:outline-none text-right" />
                              <button type="button" onClick={() => setGenAdditionalFees(genAdditionalFees.filter((_, i) => i !== idx))} className="p-1.5 text-destructive hover:bg-destructive/10 rounded"><Trash2 className="w-3 h-3" /></button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}


                  {/* Options */}
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={genSkipExisting}
                        onChange={e => setGenSkipExisting(e.target.checked)}
                        className="rounded border-border"
                      />
                      <span className="text-xs">Lewati jika tagihan bulan ini sudah ada</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={genSendWa}
                        onChange={e => setGenSendWa(e.target.checked)}
                        className="rounded border-border"
                      />
                      <span className="text-xs">Kirim notifikasi WhatsApp setelah generate</span>
                    </label>
                  </div>

                  {genScope === 'all' && (
                    <div className="flex items-start gap-2 bg-blue-500/10 border border-blue-500/20 rounded-xl px-3 py-2.5">
                      <AlertCircle className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
                      <p className="text-[11px] text-blue-300 leading-snug">
                        Generate untuk <strong>semua pelanggan aktif (POSTPAID &amp; PREPAID)</strong>. Pelanggan yang sudah punya tagihan bulan tersebut akan dilewati secara otomatis.
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <Button type="button" variant="outline" size="sm" className="flex-1 h-9 text-xs" onClick={() => setShowGenerateDialog(false)} disabled={generating}>
                      Batal
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="flex-1 h-9 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={handleGenerate}
                      disabled={generating || (genScope === 'single' && !genUserId)}
                    >
                      {generating ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Generating...</> : <><PlusSquare className="h-3.5 w-3.5 mr-1.5" />Generate Tagihan</>}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
