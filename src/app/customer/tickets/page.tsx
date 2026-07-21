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
      {/* Header & Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-display font-medium text-[var(--color-ink)]">Pusat Bantuan</h2>
          <p className="text-sm font-body text-[var(--color-ink-2)] mt-1">Kelola dan pantau tiket bantuan Anda.</p>
        </div>
        <button 
          onClick={() => router.push('/customer/tickets/create')}
          className="bg-[var(--color-accent)] text-[var(--color-accent-ink)] hover:opacity-90 px-4 py-2.5 rounded-[var(--radius-sm)] font-mono text-[10px] uppercase font-bold tracking-wider transition-opacity whitespace-nowrap flex items-center justify-center gap-2 shadow-sm"
        >
          <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>add</span>
          Buat Tiket Baru
        </button>
      </div>

      {/* Filters & Search Bento Module */}
      <div className="bg-[var(--color-paper)] rounded-[var(--radius-lg)] border border-[var(--color-rule)] p-6 mb-6 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
          {/* Status Filters */}
          <div className="flex flex-wrap gap-2 w-full">
            <button 
              onClick={() => setStatusFilter('all')}
              className={`px-4 py-1.5 rounded-full border font-mono text-[10px] uppercase font-bold tracking-wider transition-colors ${statusFilter === 'all' ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]' : 'border-[var(--color-rule)] text-[var(--color-ink-2)] hover:bg-[var(--color-paper-3)]'}`}
            >
              Semua
            </button>
            <button 
              onClick={() => setStatusFilter('OPEN')}
              className={`px-4 py-1.5 rounded-full border font-mono text-[10px] uppercase font-bold tracking-wider transition-colors ${statusFilter === 'OPEN' ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]' : 'border-[var(--color-rule)] text-[var(--color-ink-2)] hover:bg-[var(--color-paper-3)]'}`}
            >
              Terbuka
            </button>
            <button 
              onClick={() => setStatusFilter('IN_PROGRESS')}
              className={`px-4 py-1.5 rounded-full border font-mono text-[10px] uppercase font-bold tracking-wider transition-colors ${statusFilter === 'IN_PROGRESS' ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]' : 'border-[var(--color-rule)] text-[var(--color-ink-2)] hover:bg-[var(--color-paper-3)]'}`}
            >
              Diproses
            </button>
            <button 
              onClick={() => setStatusFilter('RESOLVED')}
              className={`px-4 py-1.5 rounded-full border font-mono text-[10px] uppercase font-bold tracking-wider transition-colors ${statusFilter === 'RESOLVED' ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]' : 'border-[var(--color-rule)] text-[var(--color-ink-2)] hover:bg-[var(--color-paper-3)]'}`}
            >
              Selesai
            </button>
          </div>
        </div>
      </div>

      {/* Ticket Table Bento Module */}
      <div className="bg-[var(--color-paper)] rounded-[var(--radius-lg)] border border-[var(--color-rule)] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--color-paper-2)] border-b border-[var(--color-rule)]">
                <th className="p-4 font-mono text-[10px] text-[var(--color-muted)] font-bold uppercase tracking-wider min-w-[200px]">Subjek</th>
                <th className="p-4 font-mono text-[10px] text-[var(--color-muted)] font-bold uppercase tracking-wider">Kategori</th>
                <th className="p-4 font-mono text-[10px] text-[var(--color-muted)] font-bold uppercase tracking-wider">Tanggal</th>
                <th className="p-4 font-mono text-[10px] text-[var(--color-muted)] font-bold uppercase tracking-wider">Status</th>
                <th className="p-4 font-mono text-[10px] text-[var(--color-muted)] font-bold uppercase tracking-wider min-w-[120px]">Update</th>
                <th className="p-4 font-mono text-[10px] text-[var(--color-muted)] font-bold uppercase tracking-wider w-16"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-[var(--color-focus)] mx-auto" />
                  </td>
                </tr>
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-[var(--color-ink-2)] font-body text-sm">
                    Tidak ada tiket ditemukan.
                  </td>
                </tr>
              ) : (
                tickets.map(ticket => (
                  <tr 
                    key={ticket.id}
                    onClick={() => router.push(`/customer/tickets/${ticket.id}`)}
                    className="border-b border-[var(--color-rule)] hover:bg-[var(--color-paper-3)] transition-colors cursor-pointer group"
                  >
                    <td className="p-4">
                      <div className="font-body text-sm text-[var(--color-ink)] font-medium line-clamp-1">{ticket.subject}</div>
                      <div className="font-mono text-xs text-[var(--color-muted)] mt-1">{ticket.ticketNumber}</div>
                    </td>
                    <td className="p-4 font-body text-sm text-[var(--color-ink-2)]">
                      {ticket.category?.name || '-'}
                    </td>
                    <td className="p-4 font-mono text-xs text-[var(--color-ink-2)] whitespace-nowrap">
                      {formatWIB(ticket.createdAt).split(' ')[0]}
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase font-bold tracking-wider border ${
                        ticket.status === 'OPEN' ? 'bg-emerald-100/50 text-emerald-700 border-emerald-200' :
                        (ticket.status === 'IN_PROGRESS' || ticket.status === 'WAITING_CUSTOMER') ? 'bg-amber-100/50 text-amber-700 border-amber-200' :
                        'bg-[var(--color-paper-3)] text-[var(--color-ink-2)] border-[var(--color-rule)]'
                      }`}>
                        {mapStatusForDisplay(ticket.status)}
                      </span>
                    </td>
                    <td className="p-4 font-mono text-xs text-[var(--color-ink-2)] whitespace-nowrap">
                      {formatWIB(ticket.updatedAt || ticket.createdAt).split(' ')[0]}
                    </td>
                    <td className="p-4 text-center">
                      <span className="material-symbols-outlined text-[var(--color-muted)] group-hover:text-[var(--color-focus)] transition-colors text-[18px]">chevron_right</span>
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

