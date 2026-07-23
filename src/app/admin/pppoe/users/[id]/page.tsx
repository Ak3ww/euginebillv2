'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { formatWIB } from '@/lib/timezone';
import { useToast } from '@/components/cyberpunk/CyberToast';
import {
  ArrowLeft, User, Wifi, WifiOff, Shield, ShieldOff, Ban, CheckCircle2,
  Phone, Mail, MapPin, Calendar, CreditCard, Copy, ExternalLink, RefreshCw,
  AlertTriangle, FileText, Clock, Zap, Check, Activity, Eye, EyeOff,
  Hash, MessageCircle, Download, Upload, Timer, Server,
  ChevronDown, ChevronUp, Plus, SendHorizonal, Laptop, X, Edit3, Settings, Wrench, Camera
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface WorkOrder {
  id: string;
  issueType: string;
  description: string;
  priority: string;
  status: string;
  completedAt: string | null;
  createdAt: string;
  technician?: { id: string; name: string; phoneNumber: string } | null;
  reportData?: any;
  reportPhotos?: any;
  equipmentChecklist?: any;
}

interface PppoeUserDetail {
  id: string;
  username: string;
  name: string;
  password: string;
  phone: string;
  email: string | null;
  address: string | null;
  status: string;
  ipAddress: string | null;
  macAddress: string | null;
  comment: string | null;
  expiredAt: string | null;
  customerId: string | null;
  syncedToRadius: boolean;
  subscriptionType: string;
  createdAt: string;
  updatedAt: string;
  profile: { id: string; name: string; groupName: string; price?: number };
  router?: { id: string; name: string; nasname: string } | null;
  area?: { id: string; name: string } | null;
  odpAssignment?: {
    odpId: string;
    portNumber: number;
    odp?: { name: string; locationName?: string; portCapacity?: number };
  } | null;
  workOrders?: WorkOrder[];
}

interface ActiveSession {
  radacctid: number;
  acctstarttime: string;
  framedipaddress: string;
  nasipaddress: string;
  callingstationid: string;
  acctinputoctets: number;
  acctoutputoctets: number;
  acctsessiontime: number;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  amount: number;
  status: string;
  dueDate: string;
  createdAt: string;
  paymentLink: string | null;
  paymentToken: string | null;
}

function formatBytes(bytes: number) {
  if (!bytes) return '0 B';
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${bytes} B`;
}

function formatDuration(seconds: number) {
  if (!seconds) return '0s';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}j ${m}m ${s}d`;
  if (m > 0) return `${m}m ${s}d`;
  return `${s}d`;
}

export default function PppoeUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { addToast } = useToast();

  const [user, setUser] = useState<PppoeUserDetail | null>(null);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);

  // Collapse / Expand Section States
  const [expandPersonal, setExpandPersonal] = useState(true);
  const [expandMikrotik, setExpandMikrotik] = useState(true);
  const [expandHardware, setExpandHardware] = useState(true);
  const [expandWorkOrders, setExpandWorkOrders] = useState(true);
  const [expandInvoices, setExpandInvoices] = useState(false);

  // Edit Personal / ODP Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    comment: '',
  });

  // Create SPK Modal State
  const [isSpkModalOpen, setIsSpkModalOpen] = useState(false);
  const [spkSubmitting, setSpkSubmitting] = useState(false);
  const [spkFormData, setSpkFormData] = useState({
    issueType: 'REPAIR',
    priority: 'HIGH',
    description: 'Perbaikan / Pergantian Modem ONT untuk Pelanggan',
    notes: '',
  });

  const fetchUserDetail = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/pppoe/users/${id}`);
      const data = await res.json();
      if (res.ok && data.user) {
        setUser(data.user);
        setActiveSession(data.activeSession || null);
        setEditFormData({
          name: data.user.name || '',
          phone: data.user.phone || '',
          email: data.user.email || '',
          address: data.user.address || '',
          comment: data.user.comment || '',
        });
      } else {
        addToast({ type: 'error', title: 'Gagal', description: data.error || 'Pelanggan tidak ditemukan' });
      }

      // Fetch invoices
      const invRes = await fetch(`/api/admin/invoices?userId=${id}`);
      if (invRes.ok) {
        const invData = await invRes.json();
        setInvoices(invData.invoices || []);
      }
    } catch (e) {
      console.error(e);
      addToast({ type: 'error', title: 'Gagal', description: 'Gagal mengambil data pelanggan' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserDetail();
  }, [id]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(label);
    addToast({ type: 'success', title: 'Tersalin', description: `${label} berhasil disalin ke clipboard` });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!user) return;
    setStatusLoading(true);
    try {
      const res = await fetch(`/api/pppoe/users/${user.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (res.ok) {
        addToast({ type: 'success', title: 'Berhasil', description: `Status pelanggan diperbarui ke ${newStatus}` });
        fetchUserDetail();
      } else {
        addToast({ type: 'error', title: 'Gagal', description: data.error || 'Gagal mengubah status' });
      }
    } catch {
      addToast({ type: 'error', title: 'Gagal', description: 'Gagal terhubung ke server' });
    } finally {
      setStatusLoading(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      const res = await fetch(`/api/pppoe/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editFormData),
      });
      const data = await res.json();
      if (res.ok) {
        addToast({ type: 'success', title: 'Berhasil', description: 'Data pelanggan berhasil diperbarui!' });
        setIsEditModalOpen(false);
        fetchUserDetail();
      } else {
        addToast({ type: 'error', title: 'Gagal', description: data.error || 'Gagal memperbarui data' });
      }
    } catch {
      addToast({ type: 'error', title: 'Gagal', description: 'Gagal menghubungkan ke server' });
    }
  };

  const handleCompleteInstallation = async () => {
    if (!user) return;
    setStatusLoading(true);
    try {
      const res = await fetch(`/api/pppoe/users/${user.id}/complete-installation`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        addToast({ type: 'success', title: 'Pemasangan Selesai', description: data.message });
        fetchUserDetail();
      } else if (data.hasInvoice === false) {
        addToast({ type: 'error', title: 'Tagihan Belum Ada', description: data.error });
        router.push(`/admin/invoices?new=true&userId=${user.id}`);
      } else {
        addToast({ type: 'error', title: 'Gagal', description: data.error || 'Gagal menyelesaikan pemasangan' });
      }
    } catch {
      addToast({ type: 'error', title: 'Gagal', description: 'Gagal terhubung ke server' });
    } finally {
      setStatusLoading(false);
    }
  };

  const handleCreateSpk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSpkSubmitting(true);
    try {
      const res = await fetch('/api/admin/work-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          linkedUserId: user.id,
          customerName: user.name,
          customerPhone: user.phone,
          customerAddress: user.address || '-',
          issueType: spkFormData.issueType,
          priority: spkFormData.priority,
          description: spkFormData.description,
          notes: spkFormData.notes,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        addToast({ type: 'success', title: 'Berhasil', description: 'Surat Tugas (SPK) berhasil diterbitkan!' });
        setIsSpkModalOpen(false);
        fetchUserDetail();
      } else {
        addToast({ type: 'error', title: 'Gagal', description: data.error || 'Gagal menerbitkan SPK' });
      }
    } catch {
      addToast({ type: 'error', title: 'Gagal', description: 'Gagal terhubung ke server' });
    } finally {
      setSpkSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-primary mb-3" />
        <p className="text-xs text-muted-foreground font-mono">Memuat profil pelanggan...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center space-y-4">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
        <h2 className="text-lg font-bold text-foreground">Pelanggan Tidak Ditemukan</h2>
        <p className="text-xs text-muted-foreground">ID atau Username pelanggan tidak terdaftar di sistem EugineBill.</p>
        <button onClick={() => router.push('/admin/pppoe/users')} className="px-4 py-2 bg-primary text-primary-foreground font-bold text-xs rounded-xl">
          Kembali ke Daftar Pelanggan
        </button>
      </div>
    );
  }

  // Parse ODP & Hardware data from latest Work Order if available
  const latestWo = user.workOrders && user.workOrders.length > 0 ? user.workOrders[0] : null;
  const woReportData = latestWo?.reportData || {};
  const odpName = user.odpAssignment?.odp?.name || woReportData.odpName || '-';
  const odpPort = user.odpAssignment?.portNumber || woReportData.odpPort || '-';
  const ontModel = woReportData.modemType || '-';
  const ontSn = woReportData.sn || '-';
  const ontMac = woReportData.mac || user.macAddress || '-';
  const rxSignal = woReportData.rxSignal || '-';

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">

      {/* Back Button */}
      <button
        onClick={() => router.push('/admin/pppoe/users')}
        className="flex items-center gap-1.5 text-xs font-mono font-bold text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Kembali ke Daftar Pelanggan
      </button>

      {/* Header Profile Card */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          
          <div className="flex items-start gap-4">
            <div className={cn(
              'w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold font-mono shrink-0 shadow-inner',
              user.status === 'ISOLATED' ? 'bg-destructive/10 text-destructive border border-destructive/20' : 'bg-primary/10 text-primary border border-primary/20'
            )}>
              {user.name.slice(0, 2).toUpperCase()}
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold font-display text-foreground">{user.name}</h1>
                <span className={cn(
                  'px-2.5 py-0.5 rounded-full font-mono text-[10px] uppercase font-bold tracking-wider border',
                  user.status === 'ISOLATED' ? 'bg-destructive/10 text-destructive border-destructive/20' : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                )}>
                  {user.status === 'ISOLATED' ? 'Terisolir' : 'Aktif'}
                </span>
                {activeSession ? (
                  <span className="px-2.5 py-0.5 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 rounded-full font-mono text-[10px] font-bold uppercase flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Sesi Online
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 bg-muted text-muted-foreground border border-border rounded-full font-mono text-[10px] font-bold uppercase">
                    Offline
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 text-xs font-mono text-muted-foreground mt-1.5 flex-wrap">
                <span>ID: <strong className="text-primary font-bold">{user.customerId || user.id}</strong></span>
                <span>•</span>
                <span>Username: <strong className="text-foreground">{user.username}</strong></span>
                <span>•</span>
                <span>Paket: <strong className="text-foreground">{user.profile?.name || '-'}</strong></span>
              </div>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap w-full md:w-auto border-t md:border-t-0 border-border pt-3 md:pt-0">
            {user.phone && (
              <a
                href={`https://wa.me/${user.phone.replace(/[^0-9]/g, '').replace(/^0/, '62')}`}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-2 bg-emerald-600/10 text-emerald-600 hover:bg-emerald-600/20 border border-emerald-600/20 rounded-xl font-mono text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <MessageCircle className="w-4 h-4" /> WA Pelanggan
              </a>
            )}

            {(user.status === 'PENDING_INSTALLATION' || user.status === 'pending_installation') && (
              <button
                onClick={handleCompleteInstallation}
                disabled={statusLoading}
                className="px-3.5 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl font-mono text-xs font-bold flex items-center gap-1.5 shadow-md transition-all animate-pulse"
              >
                <Wrench className="w-4 h-4" /> 🔧 Selesaikan Pemasangan
              </button>
            )}

            <button
              onClick={() => setIsSpkModalOpen(true)}
              className="px-3 py-2 bg-primary text-primary-foreground hover:opacity-90 rounded-xl font-mono text-xs font-bold flex items-center gap-1.5 shadow-md transition-opacity"
            >
              <Wrench className="w-4 h-4" /> + Terbitkan SPK / Ganti Modem
            </button>

            <button
              onClick={() => setIsEditModalOpen(true)}
              className="px-3 py-2 bg-muted hover:bg-muted/80 text-foreground border border-border rounded-xl font-mono text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <Edit3 className="w-4 h-4 text-primary" /> Edit Data
            </button>

            {user.status === 'ISOLATED' ? (
              <button
                onClick={() => handleUpdateStatus('ACTIVE')}
                disabled={statusLoading}
                className="px-3 py-2 bg-emerald-600 text-white hover:opacity-90 rounded-xl font-mono text-xs font-bold flex items-center gap-1.5 transition-opacity"
              >
                <CheckCircle2 className="w-4 h-4" /> Un-Isolir Sesi
              </button>
            ) : (
              <button
                onClick={() => handleUpdateStatus('ISOLATED')}
                disabled={statusLoading}
                className="px-3 py-2 bg-amber-600 text-white hover:opacity-90 rounded-xl font-mono text-xs font-bold flex items-center gap-1.5 transition-opacity"
              >
                <Ban className="w-4 h-4" /> Isolir Sesi
              </button>
            )}
          </div>

        </div>
      </div>

      {/* SECTION 1: Data Diri & Langganan (Collapsible) */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <button
          onClick={() => setExpandPersonal(!expandPersonal)}
          className="w-full px-6 py-4 bg-muted/40 hover:bg-muted/70 flex justify-between items-center transition-colors border-b border-border"
        >
          <div className="flex items-center gap-2.5">
            <User className="w-5 h-5 text-primary" />
            <h2 className="text-base font-bold text-foreground font-display">Data Diri &amp; Paket Langganan</h2>
          </div>
          {expandPersonal ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
        </button>

        {expandPersonal && (
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div className="p-3 bg-background border border-border rounded-xl">
              <span className="text-[10px] font-mono font-bold uppercase text-muted-foreground block">ID Pelanggan</span>
              <span className="font-mono font-bold text-primary mt-1 block">{user.customerId || user.id}</span>
            </div>
            <div className="p-3 bg-background border border-border rounded-xl">
              <span className="text-[10px] font-mono font-bold uppercase text-muted-foreground block">Nama Lengkap</span>
              <span className="font-bold text-foreground mt-1 block">{user.name}</span>
            </div>
            <div className="p-3 bg-background border border-border rounded-xl">
              <span className="text-[10px] font-mono font-bold uppercase text-muted-foreground block">Nomor Telepon / WA</span>
              <span className="font-mono font-bold text-foreground mt-1 block">{user.phone}</span>
            </div>
            <div className="p-3 bg-background border border-border rounded-xl">
              <span className="text-[10px] font-mono font-bold uppercase text-muted-foreground block">Email</span>
              <span className="font-mono text-foreground mt-1 block">{user.email || '-'}</span>
            </div>
            <div className="p-3 bg-background border border-border rounded-xl md:col-span-2">
              <span className="text-[10px] font-mono font-bold uppercase text-muted-foreground block">Alamat Lengkap</span>
              <span className="text-foreground mt-1 block leading-relaxed">{user.address || '-'}</span>
            </div>
            <div className="p-3 bg-background border border-border rounded-xl">
              <span className="text-[10px] font-mono font-bold uppercase text-muted-foreground block">Paket Langganan</span>
              <span className="font-bold text-primary mt-1 block">{user.profile?.name || '-'}</span>
            </div>
            <div className="p-3 bg-background border border-border rounded-xl">
              <span className="text-[10px] font-mono font-bold uppercase text-muted-foreground block">Tanggal Pendaftaran</span>
              <span className="font-mono text-foreground mt-1 block">{formatWIB(user.createdAt, 'dd/MM/yyyy HH:mm')}</span>
            </div>
            <div className="p-3 bg-background border border-border rounded-xl">
              <span className="text-[10px] font-mono font-bold uppercase text-muted-foreground block">Tanggal Jatuh Tempo / Expired</span>
              <span className="font-mono font-bold text-amber-600 dark:text-amber-400 mt-1 block">
                {user.expiredAt ? formatWIB(user.expiredAt, 'dd/MM/yyyy') : 'Setiap Bulan'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 2: Data MikroTik & RADIUS Live Session (Collapsible) */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <button
          onClick={() => setExpandMikrotik(!expandMikrotik)}
          className="w-full px-6 py-4 bg-muted/40 hover:bg-muted/70 flex justify-between items-center transition-colors border-b border-border"
        >
          <div className="flex items-center gap-2.5">
            <Wifi className="w-5 h-5 text-primary" />
            <h2 className="text-base font-bold text-foreground font-display">Data Sesi MikroTik &amp; RADIUS Real-Time</h2>
          </div>
          {expandMikrotik ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
        </button>

        {expandMikrotik && (
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div className="p-3 bg-background border border-border rounded-xl">
                <span className="text-[10px] font-mono font-bold uppercase text-muted-foreground block">Router Site</span>
                <span className="font-bold text-foreground mt-1 block">{user.router?.name || 'Default Router'}</span>
              </div>
              <div className="p-3 bg-background border border-border rounded-xl">
                <span className="text-[10px] font-mono font-bold uppercase text-muted-foreground block">Username PPPoE</span>
                <span className="font-mono font-bold text-primary mt-1 block">{user.username}</span>
              </div>
              <div className="p-3 bg-background border border-border rounded-xl">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-mono font-bold uppercase text-muted-foreground">Password PPPoE</span>
                  <button onClick={() => setShowPassword(!showPassword)} className="text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <span className="font-mono font-bold text-foreground mt-1 block">
                  {showPassword ? user.password : '••••••••'}
                </span>
              </div>
              <div className="p-3 bg-background border border-border rounded-xl">
                <span className="text-[10px] font-mono font-bold uppercase text-muted-foreground block">IP Address PPPoE</span>
                <span className="font-mono font-bold text-foreground mt-1 block">{activeSession?.framedipaddress || user.ipAddress || '-'}</span>
              </div>
            </div>

            {/* Sesi Live Active Detail */}
            {activeSession ? (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Sesi Terhubung (Live Active)
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground">NAS IP: {activeSession.nasipaddress}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] text-muted-foreground font-bold uppercase block">Uptime Sesi</span>
                    <span className="font-mono font-bold text-foreground mt-0.5 block">{formatDuration(activeSession.acctsessiontime)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground font-bold uppercase block">Live Upload (TX)</span>
                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400 mt-0.5 block">↑ {formatBytes(activeSession.acctinputoctets)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground font-bold uppercase block">Live Download (RX)</span>
                    <span className="font-mono font-bold text-purple-600 dark:text-purple-400 mt-0.5 block">↓ {formatBytes(activeSession.acctoutputoctets)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground font-bold uppercase block">MAC Address Sesi</span>
                    <span className="font-mono font-bold text-foreground mt-0.5 block">{activeSession.callingstationid || '-'}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-muted/40 border border-border rounded-xl text-center text-xs text-muted-foreground">
                Pelanggan saat ini tidak memiliki sesi aktif di Router MikroTik (Offline).
              </div>
            )}
          </div>
        )}
      </div>

      {/* SECTION 3: Data Perangkat & Infrastruktur Lapangan (ONT, ODP, ODC, Port) (Collapsible) */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <button
          onClick={() => setExpandHardware(!expandHardware)}
          className="w-full px-6 py-4 bg-muted/40 hover:bg-muted/70 flex justify-between items-center transition-colors border-b border-border"
        >
          <div className="flex items-center gap-2.5">
            <Server className="w-5 h-5 text-primary" />
            <h2 className="text-base font-bold text-foreground font-display">Data Perangkat &amp; Infrastruktur Lapangan (ONT / ODP)</h2>
          </div>
          {expandHardware ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
        </button>

        {expandHardware && (
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-background border border-border rounded-xl">
                <span className="text-[10px] font-mono font-bold uppercase text-muted-foreground block">Nama ODP</span>
                <span className="font-mono font-bold text-primary mt-1 block">{odpName}</span>
              </div>
              <div className="p-3 bg-background border border-border rounded-xl">
                <span className="text-[10px] font-mono font-bold uppercase text-muted-foreground block">Port ODP</span>
                <span className="font-mono font-bold text-foreground mt-1 block">{odpPort !== '-' ? `Port ${odpPort}` : '-'}</span>
              </div>
              <div className="p-3 bg-background border border-border rounded-xl">
                <span className="text-[10px] font-mono font-bold uppercase text-muted-foreground block">Tipe / Model ONT</span>
                <span className="font-mono font-bold text-foreground mt-1 block">{ontModel}</span>
              </div>
              <div className="p-3 bg-background border border-border rounded-xl">
                <span className="text-[10px] font-mono font-bold uppercase text-muted-foreground block">Serial Number (SN ONT)</span>
                <span className="font-mono font-bold text-foreground mt-1 block">{ontSn}</span>
              </div>
              <div className="p-3 bg-background border border-border rounded-xl">
                <span className="text-[10px] font-mono font-bold uppercase text-muted-foreground block">MAC Address ONT</span>
                <span className="font-mono font-bold text-foreground mt-1 block">{ontMac}</span>
              </div>
              <div className="p-3 bg-background border border-border rounded-xl">
                <span className="text-[10px] font-mono font-bold uppercase text-muted-foreground block">Sinyal Redaman Rx</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-1 block">
                  {rxSignal !== '-' ? `${rxSignal} dBm` : '-'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 4: Riwayat Pekerjaan & Pergantian Modem / SPK (Collapsible) */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <button
          onClick={() => setExpandWorkOrders(!expandWorkOrders)}
          className="w-full px-6 py-4 bg-muted/40 hover:bg-muted/70 flex justify-between items-center transition-colors border-b border-border"
        >
          <div className="flex items-center gap-2.5">
            <Wrench className="w-5 h-5 text-primary" />
            <h2 className="text-base font-bold text-foreground font-display">Riwayat SPK &amp; Pergantian Modem</h2>
          </div>
          {expandWorkOrders ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
        </button>

        {expandWorkOrders && (
          <div className="p-6 space-y-4">
            {(!user.workOrders || user.workOrders.length === 0) ? (
              <div className="p-8 text-center text-xs text-muted-foreground bg-muted/20 border border-border rounded-xl">
                <Wrench className="w-8 h-8 mx-auto opacity-40 mb-2" />
                Belum ada riwayat Surat Tugas (SPK) atau pergantian modem untuk pelanggan ini.
              </div>
            ) : (
              <div className="space-y-4">
                {user.workOrders.map((wo) => (
                  <div key={wo.id} className="p-4 bg-background border border-border rounded-xl shadow-sm space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-primary">#{wo.id.slice(-8).toUpperCase()}</span>
                          <span className="px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                            {wo.issueType.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-xs text-foreground mt-1 font-medium">{wo.description}</p>
                      </div>
                      <span className={cn('px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold uppercase border',
                        wo.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                      )}>
                        {wo.status}
                      </span>
                    </div>

                    <div className="text-[11px] text-muted-foreground flex items-center justify-between border-t border-border pt-2">
                      <span>Teknisi: <strong className="text-foreground">{wo.technician?.name || 'Belum Ditunjuk'}</strong></span>
                      <span className="font-mono">{formatWIB(wo.completedAt || wo.createdAt, 'dd/MM/yyyy HH:mm')}</span>
                    </div>

                    {/* Report Data / Photos if completed */}
                    {wo.reportData && (
                      <div className="bg-muted/40 p-3 rounded-lg grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                        <div><span className="text-muted-foreground font-bold block">SN ONT:</span> <span className="font-mono">{wo.reportData.sn || '-'}</span></div>
                        <div><span className="text-muted-foreground font-bold block">Redaman Rx:</span> <span className="font-mono text-emerald-600 font-bold">{wo.reportData.rxSignal ? `${wo.reportData.rxSignal} dBm` : '-'}</span></div>
                        <div><span className="text-muted-foreground font-bold block">ODP Name:</span> <span className="font-mono">{wo.reportData.odpName || '-'}</span></div>
                        <div><span className="text-muted-foreground font-bold block">Kabel DW:</span> <span className="font-mono">{wo.reportData.dwRoll || '-'}</span></div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* SECTION 5: Riwayat Tagihan & Transaksi (Collapsible) */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <button
          onClick={() => setExpandInvoices(!expandInvoices)}
          className="w-full px-6 py-4 bg-muted/40 hover:bg-muted/70 flex justify-between items-center transition-colors border-b border-border"
        >
          <div className="flex items-center gap-2.5">
            <CreditCard className="w-5 h-5 text-primary" />
            <h2 className="text-base font-bold text-foreground font-display">Riwayat Tagihan &amp; Pembayaran ({invoices.length})</h2>
          </div>
          {expandInvoices ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
        </button>

        {expandInvoices && (
          <div className="p-6">
            {invoices.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">Belum ada tagihan diterbitkan.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted border-b border-border">
                    <tr>
                      <th className="px-3 py-2 text-left font-mono font-bold uppercase">No. Invoice</th>
                      <th className="px-3 py-2 text-left font-mono font-bold uppercase">Jumlah</th>
                      <th className="px-3 py-2 text-left font-mono font-bold uppercase">Jatuh Tempo</th>
                      <th className="px-3 py-2 text-left font-mono font-bold uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-muted/40">
                        <td className="px-3 py-2 font-mono font-bold text-primary">{inv.invoiceNumber}</td>
                        <td className="px-3 py-2 font-mono font-bold">Rp {inv.amount.toLocaleString('id-ID')}</td>
                        <td className="px-3 py-2 font-mono">{formatWIB(inv.dueDate, 'dd/MM/yyyy')}</td>
                        <td className="px-3 py-2">
                          <span className={cn('px-2 py-0.5 rounded font-mono text-[10px] font-bold uppercase',
                            inv.status === 'PAID' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'
                          )}>
                            {inv.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Personal Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h3 className="text-base font-bold text-foreground">Edit Data Pelanggan</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-foreground mb-1">Nama Pelanggan</label>
                <input
                  type="text"
                  required
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full p-2.5 bg-background border border-input rounded-xl focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
              <div>
                <label className="block font-bold text-foreground mb-1">Nomor WhatsApp / Telepon</label>
                <input
                  type="text"
                  required
                  value={editFormData.phone}
                  onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                  className="w-full p-2.5 bg-background border border-input rounded-xl font-mono focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
              <div>
                <label className="block font-bold text-foreground mb-1">Email</label>
                <input
                  type="email"
                  value={editFormData.email}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  className="w-full p-2.5 bg-background border border-input rounded-xl font-mono focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
              <div>
                <label className="block font-bold text-foreground mb-1">Alamat Lengkap</label>
                <textarea
                  rows={2}
                  value={editFormData.address}
                  onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                  className="w-full p-2.5 bg-background border border-input rounded-xl focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 py-2 bg-muted text-foreground rounded-xl font-bold">
                  Batal
                </button>
                <button type="submit" className="flex-1 py-2 bg-primary text-primary-foreground rounded-xl font-bold">
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Terbitkan SPK / Ganti Modem Modal */}
      {isSpkModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h3 className="text-base font-bold text-foreground">Terbitkan SPK / Ganti Modem</h3>
              <button onClick={() => setIsSpkModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSpk} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-foreground mb-1">Tipe Pekerjaan</label>
                <select
                  value={spkFormData.issueType}
                  onChange={(e) => setSpkFormData({ ...spkFormData, issueType: e.target.value })}
                  className="w-full p-2.5 bg-background border border-input rounded-xl focus:ring-2 focus:ring-primary outline-none"
                >
                  <option value="REPAIR">Perbaikan Gangguan (Repair)</option>
                  <option value="DEVICE_ISSUE">Pergantian Modem ONT / Perangkat</option>
                  <option value="MAINTENANCE">Pemeliharaan Jaringan (Maintenance)</option>
                  <option value="DISMANTLE">Cabut Perangkat (Dismantle)</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-foreground mb-1">Prioritas Penugasan</label>
                <select
                  value={spkFormData.priority}
                  onChange={(e) => setSpkFormData({ ...spkFormData, priority: e.target.value })}
                  className="w-full p-2.5 bg-background border border-input rounded-xl focus:ring-2 focus:ring-primary outline-none"
                >
                  <option value="LOW">Low (Rendah)</option>
                  <option value="MEDIUM">Medium (Normal)</option>
                  <option value="HIGH">High (Tinggi)</option>
                  <option value="URGENT">Urgent (Darurat)</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-foreground mb-1">Deskripsi &amp; Instruksi Teknis</label>
                <textarea
                  rows={2}
                  value={spkFormData.description}
                  onChange={(e) => setSpkFormData({ ...spkFormData, description: e.target.value })}
                  className="w-full p-2.5 bg-background border border-input rounded-xl focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setIsSpkModalOpen(false)} className="flex-1 py-2 bg-muted text-foreground rounded-xl font-bold">
                  Batal
                </button>
                <button type="submit" disabled={spkSubmitting} className="flex-1 py-2 bg-primary text-primary-foreground rounded-xl font-bold flex items-center justify-center gap-1.5">
                  {spkSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />} Terbitkan SPK
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
