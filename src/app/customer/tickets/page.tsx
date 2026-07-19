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
      case 'OPEN': return 'Open';
      case 'IN_PROGRESS': return 'In Progress';
      case 'WAITING_CUSTOMER': return 'Waiting Customer';
      case 'RESOLVED': return 'Resolved';
      case 'CLOSED': return 'Closed';
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
    <main className="w-full pt-16 md:pt-0 p-margin-mobile md:p-margin-desktop max-w-container-max mx-auto relative min-h-screen pb-32 md:pb-8">
      {/* Header & Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-bento-gap">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-on-background">Pusat Bantuan</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">Kelola dan pantau tiket bantuan Anda.</p>
        </div>
        <button 
          onClick={() => router.push('/customer/tickets/create')}
          className="bg-primary-container text-white px-6 py-2.5 rounded flex items-center gap-2 hover:opacity-90 transition-opacity shadow-sm"
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>add</span>
          <span className="font-label-caps text-label-caps">Buat Tiket Baru</span>
        </button>
      </div>

      {/* Filters & Search Bento Module */}
      <div className="bg-surface-container-lowest rounded-xl border border-hairline-border p-6 mb-bento-gap shadow-sm">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
          {/* Status Filters */}
          <div className="flex flex-wrap gap-2 w-full">
            <button 
              onClick={() => setStatusFilter('all')}
              className={\`px-4 py-1.5 rounded-full border font-label-caps text-label-caps transition-colors \${statusFilter === 'all' ? 'border-primary bg-primary/5 text-primary' : 'border-hairline-border text-on-surface-variant hover:bg-surface-muted'}\`}
            >
              Semua
            </button>
            <button 
              onClick={() => setStatusFilter('OPEN')}
              className={\`px-4 py-1.5 rounded-full border font-label-caps text-label-caps transition-colors \${statusFilter === 'OPEN' ? 'border-primary bg-primary/5 text-primary' : 'border-hairline-border text-on-surface-variant hover:bg-surface-muted'}\`}
            >
              Open
            </button>
            <button 
              onClick={() => setStatusFilter('IN_PROGRESS')}
              className={\`px-4 py-1.5 rounded-full border font-label-caps text-label-caps transition-colors \${statusFilter === 'IN_PROGRESS' ? 'border-primary bg-primary/5 text-primary' : 'border-hairline-border text-on-surface-variant hover:bg-surface-muted'}\`}
            >
              In Progress
            </button>
            <button 
              onClick={() => setStatusFilter('RESOLVED')}
              className={\`px-4 py-1.5 rounded-full border font-label-caps text-label-caps transition-colors \${statusFilter === 'RESOLVED' ? 'border-primary bg-primary/5 text-primary' : 'border-hairline-border text-on-surface-variant hover:bg-surface-muted'}\`}
            >
              Resolved
            </button>
          </div>
        </div>
      </div>

      {/* Ticket Table Bento Module */}
      <div className="bg-surface-container-lowest rounded-xl border border-hairline-border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-muted border-b border-hairline-border">
                <th className="p-4 font-label-caps text-label-caps text-on-surface-variant font-medium border-r border-hairline-border last:border-r-0 min-w-[200px]">Subjek</th>
                <th className="p-4 font-label-caps text-label-caps text-on-surface-variant font-medium border-r border-hairline-border last:border-r-0">Kategori</th>
                <th className="p-4 font-label-caps text-label-caps text-on-surface-variant font-medium border-r border-hairline-border last:border-r-0">Tanggal</th>
                <th className="p-4 font-label-caps text-label-caps text-on-surface-variant font-medium border-r border-hairline-border last:border-r-0">Status</th>
                <th className="p-4 font-label-caps text-label-caps text-on-surface-variant font-medium border-r border-hairline-border last:border-r-0 min-w-[120px]">Update</th>
                <th className="p-4 font-label-caps text-label-caps text-on-surface-variant font-medium w-16"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
                  </td>
                </tr>
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-on-surface-variant font-body-md text-body-md">
                    Tidak ada tiket ditemukan.
                  </td>
                </tr>
              ) : (
                tickets.map(ticket => (
                  <tr 
                    key={ticket.id}
                    onClick={() => router.push(\`/customer/tickets/\${ticket.id}\`)}
                    className="border-b border-hairline-border hover:bg-surface-muted transition-colors cursor-pointer group"
                  >
                    <td className="p-4 border-r border-hairline-border last:border-r-0">
                      <div className="font-body-md text-body-md text-on-background font-medium line-clamp-1">{ticket.subject}</div>
                      <div className="font-data-mono text-data-mono text-on-surface-variant text-xs mt-1">{ticket.ticketNumber}</div>
                    </td>
                    <td className="p-4 border-r border-hairline-border last:border-r-0 font-body-md text-body-md text-on-surface-variant">
                      {ticket.category?.name || '-'}
                    </td>
                    <td className="p-4 border-r border-hairline-border last:border-r-0 font-data-mono text-data-mono text-on-surface-variant whitespace-nowrap">
                      {formatWIB(ticket.createdAt).split(' ')[0]}
                    </td>
                    <td className="p-4 border-r border-hairline-border last:border-r-0 whitespace-nowrap">
                      <span className={\`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-label-caps border \${getStatusBadgeStyle(ticket.status)}\`}>
                        {mapStatusForDisplay(ticket.status)}
                      </span>
                    </td>
                    <td className="p-4 border-r border-hairline-border last:border-r-0 font-data-mono text-data-mono text-on-surface-variant whitespace-nowrap">
                      {formatWIB(ticket.updatedAt || ticket.createdAt).split(' ')[0]}
                    </td>
                    <td className="p-4 text-center">
                      <span className="material-symbols-outlined text-outline-variant group-hover:text-primary transition-colors">chevron_right</span>
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
