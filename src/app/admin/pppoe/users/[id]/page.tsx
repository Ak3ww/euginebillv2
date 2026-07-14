'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { formatWIB } from '@/lib/timezone';
import {
  ArrowLeft, User, Wifi, WifiOff, Shield, ShieldOff, Ban, CheckCircle2,
  Phone, Mail, MapPin, Calendar, CreditCard, Copy, ExternalLink, RefreshCw,
  AlertTriangle, FileText, Clock, Zap, Check, Activity, Eye, EyeOff,
  Hash, MessageCircle, Download, Upload, Timer, Server,
  ChevronDown, ChevronUp, Plus, SendHorizonal, Laptop, X, Edit3, Settings
} from 'lucide-react';

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

interface SessionRecord {
  id: string;
  startTime: string;
  stopTime: string | null;
  durationFormatted: string;
  download: string;
  upload: string;
}

function formatBytes(bytes: number) {
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
  if (h > 0) return `${h}j ${m}m`;
  if (m > 0) return `${m}m ${s}d`;
  return `${s}d`;
}

export default function PppoeUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [user, setUser]                     = useState<PppoeUserDetail | null>(null);
  const [activeSession, setActiveSession]   = useState<ActiveSession | null>(null);
  const [invoices, setInvoices]             = useState<Invoice[]>([]);
  const [sessions, setSessions]             = useState<SessionRecord[]>([]);
  const [loading, setLoading]               = useState(true);
  const [copiedId, setCopiedId]             = useState<string | null>(null);
  const [changingStatus, setChangingStatus] = useState(false);
  const [showPassword, setShowPassword]     = useState(false);
  const [showSessions, setShowSessions]     = useState(false);
  const [sendingWA, setSendingWA]           = useState(false);
  const [waResult, setWaResult]             = useState<string | null>(null);

  // Redesign tabs state
  const [activeTab, setActiveTab]           = useState<'info' | 'invoices' | 'sessions' | 'acs' | 'actions'>('info');
  // Edit modal state
  const [showEditModal, setShowEditModal]   = useState(false);
  const [savingEdit, setSavingEdit]         = useState(false);
  const [editForm, setEditForm]             = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    password: '',
    comment: ''
  });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData(); }, [id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [userRes, invoicesRes, sessionsRes] = await Promise.all([
        fetch(`/api/pppoe/users/${id}`),
        fetch(`/api/invoices?userId=${id}&limit=20`),
        fetch(`/api/pppoe/users/${id}/activity?type=sessions&limit=10`),
      ]);
      const userData     = await userRes.json();
      const invoicesData = await invoicesRes.json();
      const sessionsData = await sessionsRes.json();
      if (userData.user)          setUser(userData.user);
      if (userData.activeSession) setActiveSession(userData.activeSession);
      if (invoicesData.invoices)  setInvoices(invoicesData.invoices);
      if (sessionsData.sessions)  setSessions(sessionsData.sessions);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!user) return;
    setChangingStatus(true);
    try {
      const res = await fetch('/api/pppoe/users/status', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, status: newStatus }),
      });
      if (res.ok) setUser({ ...user, status: newStatus });
    } finally {
      setChangingStatus(false);
    }
  };

  const sendWANotification = async () => {
    if (!user) return;
    setSendingWA(true);
    setWaResult(null);
    try {
      const res = await fetch('/api/pppoe/users/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: [user.id], notificationType: 'invoice', notificationMethod: 'whatsapp' }),
      });
      const data = await res.json();
      setWaResult(res.ok ? 'Notifikasi WA berhasil dikirim!' : (data.error || 'Gagal mengirim WA'));
    } catch {
      setWaResult('Gagal terhubung ke server');
    } finally {
      setSendingWA(false);
      setTimeout(() => setWaResult(null), 4000);
    }
  };

  const openEditModal = () => {
    if (!user) return;
    setEditForm({
      name: user.name || '',
      phone: user.phone || '',
      email: user.email || '',
      address: user.address || '',
      password: user.password || '',
      comment: user.comment || ''
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/pppoe/users/${user.customerId || user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        await fetchData();
        setShowEditModal(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingEdit(false);
    }
  };

  const copyLink = (link: string, key: string) => {
    navigator.clipboard.writeText(link);
    setCopiedId(key);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

  const formatDate = (d: string) => formatWIB(d, 'd MMM yyyy');

  const formatDateTime = (d: string) => formatWIB(d, 'd MMM yyyy HH:mm');

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'active':   return 'bg-success/15 text-success border-success/30';
      case 'isolated': return 'bg-pink-500/15 text-pink-500 border-pink-500/30';
      case 'blocked':  return 'bg-destructive/15 text-destructive border-destructive/30';
      case 'stop':     return 'bg-gray-500/15 text-gray-500 border-gray-500/30';
      default:         return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getInvStyle = (status: string) => {
    switch (status) {
      case 'PAID':    return 'bg-success/15 text-success';
      case 'OVERDUE': return 'bg-destructive/15 text-destructive';
      case 'PENDING': return 'bg-amber-500/15 text-amber-600 dark:text-amber-400';
      default:        return 'bg-muted text-muted-foreground';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto p-6 text-center">
        <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-destructive" />
        <p className="text-muted-foreground">User tidak ditemukan.</p>
        <button onClick={() => router.back()} className="mt-4 px-4 py-2 bg-primary/10 border border-primary/30 rounded text-sm text-primary hover:bg-primary/20">
          Kembali
        </button>
      </div>
    );
  }

  const unpaidInvoices = invoices.filter(i => ['PENDING', 'OVERDUE'].includes(i.status));
  const isExpired = user.expiredAt ? new Date(user.expiredAt) < new Date() : false;
  
  // Extract initials for avatar
  const initials = user.name ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'PP';

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12 text-foreground">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-muted/80 transition-colors text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold">Detail Pelanggan PPPoE</h1>
          <p className="text-xs text-muted-foreground font-mono">ID: {user.customerId || user.id}</p>
        </div>
        <button onClick={fetchData} className="ml-auto p-2 rounded-lg hover:bg-muted/80 transition-colors text-muted-foreground hover:text-foreground" title="Refresh">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* ── Premium Hero Card ────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-lg">
        <div className="p-6 bg-gradient-to-r from-neutral-900 via-neutral-950 to-neutral-900 border-b border-border flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/20 border border-primary/35 flex items-center justify-center font-bold text-xl text-primary shrink-0 shadow-inner">
              {initials}
            </div>
            <div>
              <div className="text-xl font-extrabold text-foreground flex items-center gap-2">
                {user.name}
                {activeSession && (
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse inline-block" title="Online" />
                )}
              </div>
              <div className="text-xs font-mono text-muted-foreground flex items-center gap-1.5 mt-0.5">
                <Hash className="w-3.5 h-3.5" /> {user.customerId || '-'}
                <span className="text-border">|</span>
                <span>Username: {user.username}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${getStatusStyle(user.status)}`}>
              {user.status === 'active'   && <Shield className="w-3.5 h-3.5" />}
              {user.status === 'isolated' && <ShieldOff className="w-3.5 h-3.5" />}
              {user.status === 'blocked'  && <Ban className="w-3.5 h-3.5" />}
              {user.status}
            </span>
            {user.syncedToRadius && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/30">
                <CheckCircle2 className="w-3.5 h-3.5" /> Tersinkron RADIUS
              </span>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 border-b border-border flex items-center gap-1 overflow-x-auto scrollbar-none bg-muted/20">
          <button
            onClick={() => setActiveTab('info')}
            className={`px-4 py-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'info' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <User className="w-4 h-4" /> Profil Pelanggan
          </button>
          <button
            onClick={() => setActiveTab('invoices')}
            className={`px-4 py-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'invoices' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileText className="w-4 h-4" /> Riwayat Tagihan
            {unpaidInvoices.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-destructive animate-ping" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('sessions')}
            className={`px-4 py-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'sessions' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Activity className="w-4 h-4" /> Sesi Aktif
          </button>
          <button
            onClick={() => setActiveTab('acs')}
            className={`px-4 py-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'acs' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Settings className="w-4 h-4" /> Modem (ACS)
          </button>
          <button
            onClick={() => setActiveTab('actions')}
            className={`px-4 py-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'actions' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Zap className="w-4 h-4" /> Aksi & Kontrol
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-6">
          
          {/* TAB: INFO PELANGGAN */}
          {activeTab === 'info' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5 text-sm">
                <div className="flex items-start gap-3">
                  <User className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <div className="text-xs text-muted-foreground">Nama Lengkap</div>
                    <div className="font-semibold">{user.name}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Phone className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <div className="text-xs text-muted-foreground">No. Telepon</div>
                    <div>
                      {user.phone ? (
                        <a href={`tel:${user.phone}`} className="text-primary hover:underline">{user.phone}</a>
                      ) : '-'}
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Mail className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <div className="text-xs text-muted-foreground">Email</div>
                    <div>
                      {user.email ? (
                        <a href={`mailto:${user.email}`} className="text-primary hover:underline truncate max-w-xs block">{user.email}</a>
                      ) : '-'}
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <div className="text-xs text-muted-foreground">Alamat</div>
                    <div className="text-foreground/90">{user.address || '-'}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Activity className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <div className="text-xs text-muted-foreground">Paket Langganan</div>
                    <div className="font-semibold">{user.profile?.name || '-'}</div>
                    {user.profile?.price !== undefined && (
                      <div className="text-xs text-primary font-bold">{formatCurrency(user.profile.price)} / bln</div>
                    )}
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Server className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <div className="text-xs text-muted-foreground">Router / NAS</div>
                    <div>{user.router?.name || '-'} <span className="text-xs text-muted-foreground">({user.router?.nasname || '-'})</span></div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <div className="text-xs text-muted-foreground">Area Layanan</div>
                    <div>{user.area?.name || '-'}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Calendar className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <div className="text-xs text-muted-foreground">Tanggal Expired / Jatuh Tempo</div>
                    <div className={isExpired ? 'text-destructive font-bold' : ''}>
                      {user.expiredAt ? formatDate(user.expiredAt) : '-'}
                      {isExpired && <span className="ml-1.5 text-xs bg-destructive/15 text-destructive px-1.5 py-0.5 rounded font-semibold">Tunggakan</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Laptop className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <div className="text-xs text-muted-foreground">IP Address Statis</div>
                    <div className="font-mono">{user.ipAddress || '-'}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Laptop className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <div className="text-xs text-muted-foreground">MAC Address</div>
                    <div className="font-mono text-xs">{user.macAddress || '-'}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Shield className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <div className="text-xs text-muted-foreground">Password PPPoE</div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-medium">{showPassword ? user.password : '••••••••'}</span>
                      <button onClick={() => setShowPassword(!showPassword)} className="text-muted-foreground hover:text-foreground">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button onClick={() => copyLink(user.password, 'pwd')} className="text-muted-foreground hover:text-foreground">
                        {copiedId === 'pwd' ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <div className="text-xs text-muted-foreground">Tanggal Pendaftaran</div>
                    <div>{formatDate(user.createdAt)}</div>
                  </div>
                </div>
                {user.comment && (
                  <div className="flex items-start gap-3 col-span-1 md:col-span-2 bg-muted/10 p-3 rounded-lg border border-border/50">
                    <MessageCircle className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div>
                      <div className="text-xs text-muted-foreground">Catatan Tambahan</div>
                      <div className="text-foreground/90">{user.comment}</div>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex justify-end pt-4 border-t border-border">
                <button
                  onClick={openEditModal}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/95 flex items-center gap-1.5 shadow-md"
                >
                  <Edit3 className="w-4 h-4" /> Edit Profil Pelanggan
                </button>
              </div>
            </div>
          )}

          {/* TAB: RIWAYAT TAGIHAN */}
          {activeTab === 'invoices' && (
            <div className="space-y-6">
              {/* Summary stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-muted/10 border border-border p-4 rounded-xl">
                  <div className="text-xs text-muted-foreground">Total Invoice</div>
                  <div className="text-lg font-bold mt-1">{invoices.length} Tagihan</div>
                </div>
                <div className="bg-destructive/5 border border-destructive/20 p-4 rounded-xl">
                  <div className="text-xs text-destructive">Belum Lunas</div>
                  <div className="text-lg font-bold text-destructive mt-1">
                    {formatCurrency(unpaidInvoices.reduce((s, i) => s + Number(i.amount), 0))}
                  </div>
                </div>
                <div className="bg-success/5 border border-success/20 p-4 rounded-xl">
                  <div className="text-xs text-success">Sudah Lunas</div>
                  <div className="text-lg font-bold text-success mt-1">
                    {formatCurrency(invoices.filter(i => i.status === 'PAID').reduce((s, i) => s + Number(i.amount), 0))}
                  </div>
                </div>
              </div>

              {/* List */}
              <div className="bg-muted/5 border border-border rounded-xl divide-y divide-border">
                {invoices.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-35" />
                    Belum ada riwayat tagihan
                  </div>
                ) : (
                  invoices.map((inv) => {
                    const payPath = inv.paymentToken ? `/pay/${inv.paymentToken}` : null;
                    const payLinkAbsolute = inv.paymentToken
                      ? `${typeof window !== 'undefined' ? window.location.origin : ''}/pay/${inv.paymentToken}`
                      : inv.paymentLink;
                    const isUnpaid = ['PENDING', 'OVERDUE'].includes(inv.status);
                    return (
                      <div key={inv.id} className="p-4 flex items-center justify-between gap-4 flex-wrap hover:bg-muted/10 transition-colors">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold">{inv.invoiceNumber}</span>
                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${getInvStyle(inv.status)}`}>{inv.status}</span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3">
                            <span>Jatuh Tempo: {formatDate(inv.dueDate)}</span>
                            <span>Dibuat: {formatDate(inv.createdAt)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 ml-auto">
                          <span className={`font-bold text-sm ${isUnpaid ? 'text-destructive' : 'text-success'}`}>
                            {formatCurrency(Number(inv.amount))}
                          </span>
                          {isUnpaid && payPath && (
                            <div className="flex items-center gap-1.5 border border-border/80 rounded-lg p-1 bg-card">
                              <button onClick={() => copyLink(payLinkAbsolute || payPath, inv.id)} title="Salin link bayar" className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                                {copiedId === inv.id ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                              <a href={payPath} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded hover:bg-primary/10 text-primary">
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          )}
                          {inv.status === 'PAID' && <CheckCircle2 className="w-4 h-4 text-success" />}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB: SESI AKTIF */}
          {activeTab === 'sessions' && (
            <div className="space-y-6">
              {activeSession ? (
                <div className="bg-emerald-500/5 border border-emerald-500/30 rounded-2xl p-6">
                  <div className="flex items-center gap-2 border-b border-emerald-500/20 pb-4 mb-4">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <Wifi className="w-5 h-5 text-emerald-500" />
                    <h3 className="font-bold text-sm">Informasi Sesi Aktif</h3>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-6 text-sm">
                    <div>
                      <div className="text-xs text-muted-foreground">IP Aktif</div>
                      <div className="font-mono mt-0.5">{activeSession.framedipaddress}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Router NAS</div>
                      <div className="font-mono mt-0.5">{activeSession.nasipaddress}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">MAC Client</div>
                      <div className="font-mono mt-0.5">{activeSession.callingstationid || '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Durasi Sesi</div>
                      <div className="mt-0.5">{formatDuration(activeSession.acctsessiontime || 0)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground text-blue-400">Download (RX)</div>
                      <div className="font-semibold text-blue-400 mt-0.5">{formatBytes(Number(activeSession.acctinputoctets || 0))}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground text-amber-400">Upload (TX)</div>
                      <div className="font-semibold text-amber-400 mt-0.5">{formatBytes(Number(activeSession.acctoutputoctets || 0))}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-muted-foreground bg-muted/5 border border-border rounded-xl">
                  <WifiOff className="w-8 h-8 mx-auto mb-2 opacity-35" />
                  Tidak ada sesi PPPoE aktif saat ini.
                </div>
              )}

              {/* Sessions List */}
              {sessions.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-bold text-sm flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-primary" /> Riwayat Sesi PPPoE
                  </h3>
                  <div className="border border-border rounded-xl overflow-hidden divide-y divide-border bg-muted/5">
                    {sessions.map((s) => (
                      <div key={s.id} className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs hover:bg-muted/10">
                        <div>
                          <span className="text-muted-foreground block">Mulai</span>
                          <span className="font-medium text-foreground/90">{s.startTime ? formatDateTime(s.startTime) : '—'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block">Selesai</span>
                          <span className={s.stopTime ? 'font-medium text-foreground/90' : 'font-bold text-emerald-500'}>
                            {s.stopTime ? formatDateTime(s.stopTime) : 'Aktif'}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block">Durasi</span>
                          <span className="font-medium">{s.durationFormatted}</span>
                        </div>
                        <div className="flex gap-4 items-center">
                          <div>
                            <span className="text-blue-400 block">Download</span>
                            <span className="font-semibold text-blue-400">↓ {s.download}</span>
                          </div>
                          <div>
                            <span className="text-amber-400 block">Upload</span>
                            <span className="font-semibold text-amber-400">↑ {s.upload}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: MODEM (ACS) */}
          {activeTab === 'acs' && (
            <div className="space-y-6">
              <div className="bg-card border border-border p-6 rounded-xl flex items-center gap-4">
                <Settings className="w-8 h-8 text-primary" />
                <div>
                  <h3 className="font-bold text-sm">Manajemen Modem Terpusat (ACS)</h3>
                  <p className="text-xs text-muted-foreground">Untuk melihat data signal, merubah SSID/WiFi password, dan reboot perangkat secara detail, silakan buka menu ACS terdedikasi.</p>
                </div>
                <a
                  href={`/admin/acs?search=${user.username}`}
                  className="ml-auto px-4 py-2 text-xs font-semibold border border-primary/30 text-primary bg-primary/5 hover:bg-primary/10 rounded-lg"
                >
                  Buka ACS Detail →
                </a>
              </div>
            </div>
          )}

          {/* TAB: AKSI KONTROL */}
          {activeTab === 'actions' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Status Switcher */}
                <div className="border border-border p-5 rounded-2xl bg-muted/5 space-y-3">
                  <h3 className="font-bold text-sm">Status Berlangganan</h3>
                  <p className="text-xs text-muted-foreground">Merubah status secara instan akan memutus atau memulihkan koneksi router pelanggan secara langsung.</p>
                  <div className="flex items-center gap-2 flex-wrap pt-2">
                    {(['active', 'isolated', 'blocked', 'stop'] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => handleStatusChange(s)}
                        disabled={changingStatus || user.status === s}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all disabled:opacity-40
                          ${user.status === s ? getStatusStyle(s) + ' cursor-default' : 'bg-card border-border text-muted-foreground hover:text-foreground'}`}
                      >
                        {s.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notifications & Tools */}
                <div className="border border-border p-5 rounded-2xl bg-muted/5 space-y-4">
                  <h3 className="font-bold text-sm">Aksi Cepat</h3>
                  <div className="flex items-center gap-2 flex-wrap">
                    {user.phone && (
                      <button
                        onClick={sendWANotification}
                        disabled={sendingWA}
                        className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-green-500/10 border border-green-500/35 rounded-lg text-green-600 dark:text-green-400 hover:bg-green-500/20 disabled:opacity-50"
                      >
                        {sendingWA ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <SendHorizonal className="w-3.5 h-3.5" />}
                        Kirim Tagihan (WhatsApp)
                      </button>
                    )}
                    {user.phone && (
                      <a
                        href={`https://wa.me/${user.phone.replace(/^0/, '62').replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-card border border-green-500/20 rounded-lg text-green-500 hover:bg-green-500/5"
                      >
                        <Phone className="w-3.5 h-3.5" /> Chat WA
                      </a>
                    )}
                    <a
                      href={`/admin/invoices/create?userId=${user.id}`}
                      className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-primary/10 border border-primary/30 rounded-lg text-primary hover:bg-primary/20"
                    >
                      <Plus className="w-3.5 h-3.5" /> Buat Invoice Baru
                    </a>
                  </div>
                  {waResult && (
                    <div className={`text-xs p-3 rounded-lg border ${waResult.includes('berhasil') ? 'text-success bg-success/5 border-success/20' : 'text-destructive bg-destructive/5 border-destructive/20'}`}>
                      {waResult}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ── Embedded Edit Modal ──────────────────────────────────────────── */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-border bg-muted/40 flex items-center justify-between">
              <h3 className="font-bold text-base flex items-center gap-2"><Edit3 className="w-5 h-5 text-primary" /> Edit Profil Pelanggan</h3>
              <button onClick={() => setShowEditModal(false)} className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-semibold">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-muted/40 border border-border rounded-lg focus:outline-none focus:border-primary"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground font-semibold">No. Telepon</label>
                  <input
                    type="text"
                    required
                    value={editForm.phone}
                    onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-muted/40 border border-border rounded-lg focus:outline-none focus:border-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground font-semibold">Email</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-muted/40 border border-border rounded-lg focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-semibold">Alamat Lengkap</label>
                <textarea
                  rows={2}
                  value={editForm.address}
                  onChange={e => setEditForm({ ...editForm, address: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-muted/40 border border-border rounded-lg focus:outline-none focus:border-primary resize-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-semibold">Password PPPoE</label>
                <input
                  type="text"
                  required
                  value={editForm.password}
                  onChange={e => setEditForm({ ...editForm, password: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-muted/40 border border-border rounded-lg focus:outline-none focus:border-primary font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-semibold">Catatan / Komentar</label>
                <textarea
                  rows={2}
                  value={editForm.comment}
                  onChange={e => setEditForm({ ...editForm, comment: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-muted/40 border border-border rounded-lg focus:outline-none focus:border-primary resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-border mt-6">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-muted text-muted-foreground hover:bg-muted/80"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/95 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {savingEdit && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
