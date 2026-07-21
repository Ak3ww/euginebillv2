'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { formatWIB } from '@/lib/timezone';
import { useToast } from '@/components/cyberpunk/CyberToast';

export const dynamic = 'force-dynamic';

type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING_CUSTOMER' | 'RESOLVED' | 'CLOSED';
type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

interface TicketItem {
  id: string;
  ticketNumber: string;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: string;
  updatedAt: string;
  category?: {
    name: string;
    color: string;
  };
  _count: {
    messages: number;
  };
}

export default function CustomerTicketsPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [customerId, setCustomerId] = useState<string | null>(null);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('customer_token') : null;
    const userData = typeof window !== 'undefined' ? localStorage.getItem('customer_user') : null;
    
    if (!token || !userData) {
      router.push('/customer/login');
      return;
    }
    
    try {
      const user = JSON.parse(userData);
      setCustomerId(user.id);
    } catch (error) {
      router.push('/customer/login');
    }
  }, [router]);

  useEffect(() => {
    if (customerId) {
      fetchTickets();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, customerId]);

  const fetchTickets = async () => {
    if (!customerId) return;
    
    try {
      setLoading(true);
      const token = localStorage.getItem('customer_token');
      const params = new URLSearchParams();
      params.append('customerId', customerId);
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      
      const res = await fetch(`/api/tickets?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTickets(data);
      }
    } catch (error) {
      console.error('Failed to fetch tickets:', error);
      addToast({ type: 'error', title: 'Error', description: 'Gagal memuat tiket' });
    } finally {
      setLoading(false);
    }
  };

  const mapStatusForDisplay = (status: TicketStatus) => {
    switch (status) {
      case 'OPEN': return 'Terbuka';
      case 'IN_PROGRESS': return 'Diproses';
      case 'WAITING_CUSTOMER': return 'Menunggu Pelanggan';
      case 'RESOLVED': return 'Selesai';
      case 'CLOSED': return 'Ditutup';
      default: return status;
    }
  };

  const getStatusBadgeStyle = (status: TicketStatus) => {
    switch (status) {
      case 'OPEN':
        return 'bg-emerald-100/50 text-emerald-700 border-emerald-200';
      case 'IN_PROGRESS':
      case 'WAITING_CUSTOMER':
        return 'bg-amber-100/50 text-amber-700 border-amber-200';
      case 'RESOLVED':
      case 'CLOSED':
        return 'bg-surface-variant text-on-surface-variant border-outline-variant';
      default:
        return 'bg-surface-variant text-on-surface-variant border-outline-variant';
    }
  };

    return (
  <main className="max-w-[1280px] mx-auto px-4 md:px-8 py-6 pb-32 md:pb-8 min-h-screen">
    {/* Header & CTA */}
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
      <div>
        <h2 className="text-2xl md:text-[32px] font-display font-semibold text-[var(--color-ink)]">Pusat Bantuan</h2>
        <p className="text-sm font-body text-[var(--color-ink-2)] mt-1">Kelola dan pantau tiket bantuan Anda.</p>
      </div>
      <button
        onClick={() => router.push('/customer/tickets/create')}
        className="btn-primary"
      >
        <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>add</span>
        Buat Tiket Baru
      </button>
    </div>

    {/* Status Filters */}
    <div className="bento-card p-4 mb-5">
      <div className="flex flex-wrap gap-2">
        {([
          ['all', 'Semua'],
          ['OPEN', 'Terbuka'],
          ['IN_PROGRESS', 'Diproses'],
          ['RESOLVED', 'Selesai'],
          ['CLOSED', 'Ditutup'],
        ] as [string, string][]).map(([val, label]) => (
          <button
            key={val}
            onClick={() => setStatusFilter(val)}
            className={`px-4 py-1.5 rounded-full border font-mono text-[10px] uppercase font-bold tracking-wider transition-colors ${
              statusFilter === val
                ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                : 'border-[var(--color-rule)] text-[var(--color-ink-2)] hover:bg-[var(--color-paper-3)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>

    {/* Ticket List */}
    <div className="bento-card p-0 overflow-hidden">
      <div className="px-6 py-4 border-b border-[var(--color-rule)] bg-[var(--color-paper-2)]">
        <h3 className="text-sm font-display font-semibold text-[var(--color-ink)]">Daftar Tiket</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="hairline-table">
          <thead>
            <tr>
              <th className="min-w-[200px]">Subjek</th>
              <th>Kategori</th>
              <th>Tanggal</th>
              <th>Status</th>
              <th>Diperbarui</th>
              <th className="w-16" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="p-8 text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)] mx-auto" />
                </td>
              </tr>
            ) : tickets.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center">
                  <span className="material-symbols-outlined text-[48px] text-[var(--color-muted)] block mb-2">support_agent</span>
                  <p className="text-sm text-[var(--color-muted)]">Tidak ada tiket ditemukan.</p>
                </td>
              </tr>
            ) : (
              tickets.map(ticket => (
                <tr
                  key={ticket.id}
                  onClick={() => router.push(`/customer/tickets/${ticket.id}`)}
                  className="cursor-pointer group"
                >
                  <td>
                    <div className="font-body text-sm text-[var(--color-ink)] font-medium line-clamp-1 group-hover:text-[var(--color-accent)] transition-colors">
                      {ticket.subject}
                    </div>
                    <div className="font-mono text-xs text-[var(--color-muted)] mt-0.5">{ticket.ticketNumber}</div>
                  </td>
                  <td className="font-body text-sm text-[var(--color-ink-2)]">
                    {ticket.category?.name || '-'}
                  </td>
                  <td className="font-mono text-xs text-[var(--color-ink-2)] whitespace-nowrap">
                    {formatWIB(ticket.createdAt).split(' ')[0]}
                  </td>
                  <td className="whitespace-nowrap">
                    <span className={`badge ${
                      ticket.status === 'OPEN' ? 'badge-open' :
                      (ticket.status === 'IN_PROGRESS' || ticket.status === 'WAITING_CUSTOMER') ? 'badge-in-progress' :
                      'badge-resolved'
                    }`}>
                      {mapStatusForDisplay(ticket.status)}
                    </span>
                  </td>
                  <td className="font-mono text-xs text-[var(--color-ink-2)] whitespace-nowrap">
                    {formatWIB(ticket.updatedAt || ticket.createdAt).split(' ')[0]}
                  </td>
                  <td className="text-center">
                    <span className="material-symbols-outlined text-[var(--color-muted)] group-hover:text-[var(--color-accent)] transition-colors text-[18px]">chevron_right</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  </main>
);
}
