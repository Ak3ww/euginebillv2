'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/hooks/useTranslation';
import { useToast } from '@/components/cyberpunk/CyberToast';
import {
  ClipboardList, CheckCircle2, Clock, AlertTriangle, Filter, RefreshCw,
  Loader2, MessageSquare, User, Phone, MapPin, Plus, Shield, Cpu, ChevronRight,
  Send, ExternalLink
} from 'lucide-react';

interface Ticket {
  id: string;
  ticketNumber: string;
  customerName: string;
  customerPhone: string;
  subject: string;
  priority: string;
  status: string;
  assignedToId?: string | null;
  assignedToType?: string | null;
  createdAt: string;
  resolvedAt?: string | null;
  category?: { id: string; name: string; color?: string } | null;
  _count?: { messages: number };
}

interface WorkOrder {
  id: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  issueType: string;
  priority: string;
  status: string;
  scheduledDate?: string;
  createdAt: string;
}

export default function TechnicianDashboardPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { addToast } = useToast();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ticketsRes, woRes] = await Promise.all([
        fetch('/api/technician/tickets?mine=true'),
        fetch('/api/technician/work-orders'),
      ]);

      if (ticketsRes.ok) {
        const data = await ticketsRes.json();
        setTickets(data.tickets || []);
      }

      if (woRes.ok) {
        const data = await woRes.json();
        if (data.success) {
          setWorkOrders(data.workOrders || []);
        }
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleTicketAction = async (ticketId: string, action: string, status?: string) => {
    setActionLoading(ticketId);
    try {
      const res = await fetch('/api/technician/tickets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId, action, status }),
      });
      if (res.ok) {
        addToast({ type: 'success', title: 'Status tiket diperbarui' });
        loadData();
      } else {
        const data = await res.json();
        addToast({ type: 'error', title: data.error || 'Gagal memperbarui tiket' });
      }
    } catch {
      addToast({ type: 'error', title: 'Terjadi kesalahan sistem' });
    } finally {
      setActionLoading(null);
    }
  };

  const pendingWOs = workOrders.filter(wo => wo.status === 'OPEN' || wo.status === 'ASSIGNED' || wo.status === 'IN_PROGRESS');
  const completedWOs = workOrders.filter(wo => wo.status === 'COMPLETED');

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card border border-border rounded-2xl p-5 shadow-sm">
        <div>
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-primary">Portal Lapangan</span>
          <h1 className="text-xl md:text-2xl font-bold text-foreground mt-0.5">Ringkasan Tugas Hari Ini</h1>
          <p className="text-xs text-muted-foreground mt-1">Pantau Surat Perintah Kerja (SPK) &amp; Tiket Gangguan Pelanggan.</p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-2 bg-accent hover:bg-accent/80 text-foreground border border-border text-xs font-medium rounded-xl transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Quick Stats Bento Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">SPK Aktif / Pending</p>
              <h3 className="text-2xl font-bold text-foreground mt-1">{pendingWOs.length}</h3>
            </div>
            <div className="p-3 rounded-xl bg-amber-500/10 text-amber-600">
              <Clock className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">SPK Selesai</p>
              <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{completedWOs.length}</h3>
            </div>
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Tiket Gangguan Open</p>
              <h3 className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                {tickets.filter(t => t.status === 'OPEN' || t.status === 'IN_PROGRESS').length}
              </h3>
            </div>
            <div className="p-3 rounded-xl bg-blue-500/10 text-blue-600">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Total Pengerjaan</p>
              <h3 className="text-2xl font-bold text-foreground mt-1">{workOrders.length + tickets.length}</h3>
            </div>
            <div className="p-3 rounded-xl bg-purple-500/10 text-purple-600">
              <ClipboardList className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Action Bar for Field Technicians */}
      <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
        <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground mb-3">Aksi Cepat Lapangan</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            onClick={() => router.push('/technician/work-orders')}
            className="flex items-center gap-3 p-3 bg-primary/5 hover:bg-primary/10 border border-primary/20 rounded-xl transition-all text-left group"
          >
            <div className="w-9 h-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shrink-0">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-foreground group-hover:text-primary">Surat Tugas (SPK)</div>
              <div className="text-[10px] text-muted-foreground">{pendingWOs.length} Tugas Pending</div>
            </div>
          </button>

          <button
            onClick={() => router.push('/technician/register')}
            className="flex items-center gap-3 p-3 bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/20 rounded-xl transition-all text-left group"
          >
            <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-foreground group-hover:text-emerald-600">Pasang Baru</div>
              <div className="text-[10px] text-muted-foreground">Input dari lokasi</div>
            </div>
          </button>

          <button
            onClick={() => router.push('/technician/isolated')}
            className="flex items-center gap-3 p-3 bg-red-500/5 hover:bg-red-500/10 border border-red-500/20 rounded-xl transition-all text-left group"
          >
            <div className="w-9 h-9 rounded-lg bg-red-600 text-white flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-foreground group-hover:text-red-600">Cek Terisolir</div>
              <div className="text-[10px] text-muted-foreground">Bantu buka isolir</div>
            </div>
          </button>

          <button
            onClick={() => router.push('/technician/genieacs')}
            className="flex items-center gap-3 p-3 bg-purple-500/5 hover:bg-purple-500/10 border border-purple-500/20 rounded-xl transition-all text-left group"
          >
            <div className="w-9 h-9 rounded-lg bg-purple-600 text-white flex items-center justify-center shrink-0">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-foreground group-hover:text-purple-600">Sinyal ONT</div>
              <div className="text-[10px] text-muted-foreground">Cek Redaman Fiber</div>
            </div>
          </button>
        </div>
      </div>

      {/* Active Work Orders Section */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-primary" />
              Surat Perintah Kerja (SPK) Aktif
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">Tugas instalasi dan pemeliharaan yang perlu ditangani.</p>
          </div>
          <button
            onClick={() => router.push('/technician/work-orders')}
            className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
          >
            Lihat Semua <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {loading ? (
          <div className="py-10 text-center">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
          </div>
        ) : pendingWOs.length === 0 ? (
          <div className="py-8 text-center border border-dashed border-border rounded-xl">
            <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 opacity-60 mb-2" />
            <p className="text-xs text-muted-foreground">Tidak ada SPK aktif saat ini. Semua pekerjaan selesai!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingWOs.slice(0, 4).map((wo) => (
              <div
                key={wo.id}
                className="bg-background border border-border rounded-xl p-4 flex flex-col justify-between hover:border-primary/40 transition-all shadow-sm"
              >
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <span className="px-2 py-0.5 bg-amber-500/10 text-amber-600 border border-amber-500/20 rounded-md text-[10px] font-bold font-mono uppercase">
                      {wo.status}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                      {wo.issueType.replace('_', ' ')}
                    </span>
                  </div>

                  <h4 className="font-bold text-sm text-foreground line-clamp-1">{wo.customerName}</h4>
                  
                  <div className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                    <div className="flex items-start gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{wo.customerAddress}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="font-mono">{wo.customerPhone}</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 mt-4 pt-3 border-t border-border">
                  <a
                    href={`https://wa.me/${wo.customerPhone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 inline-flex items-center justify-center gap-1 py-2 px-3 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:opacity-90 transition-opacity"
                  >
                    <Send className="w-3.5 h-3.5" /> WhatsApp
                  </a>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(wo.customerAddress)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 inline-flex items-center justify-center gap-1 py-2 px-3 bg-blue-600 text-white rounded-lg text-xs font-medium hover:opacity-90 transition-opacity"
                  >
                    <MapPin className="w-3.5 h-3.5" /> Maps
                  </a>
                  <button
                    onClick={() => router.push(`/technician/work-orders/${wo.id}`)}
                    className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90 transition-opacity"
                  >
                    Detail
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
