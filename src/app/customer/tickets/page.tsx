'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslation } from '@/hooks/useTranslation';
import { Ticket, MessageSquare, Plus, Filter } from 'lucide-react';
import { CyberCard, CyberButton } from '@/components/cyberpunk';
import { formatWIB } from '@/lib/timezone';

type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING_CUSTOMER' | 'RESOLVED' | 'CLOSED';
type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

interface TicketItem {
  id: string;
  ticketNumber: string;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: string;
  category?: {
    name: string;
    color: string;
  };
  _count: {
    messages: number;
  };
}

export default function CustomerTicketsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [customerId, setCustomerId] = useState<string | null>(null);

  useEffect(() => {
    // Check auth and get customer ID
    const token = localStorage.getItem('customer_token');
    const userData = localStorage.getItem('customer_user');
    
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
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: TicketStatus) => {
    const colors = {
      OPEN: 'bg-cobalt/10 text-cobalt border border-cobalt/20',
      IN_PROGRESS: 'bg-yellow-500/10 text-yellow-600 border border-yellow-500/20',
      WAITING_CUSTOMER: 'bg-purple-500/10 text-purple-600 border border-purple-500/20',
      RESOLVED: 'bg-green-500/10 text-green-600 border border-green-500/20',
      CLOSED: 'bg-muted/10 text-muted border border-rule',
    };
    return colors[status] || colors.OPEN;
  };

  const getPriorityColor = (priority: TicketPriority) => {
    const colors = {
      LOW: 'bg-muted/10 text-muted border border-rule',
      MEDIUM: 'bg-cobalt/10 text-cobalt border border-cobalt/20',
      HIGH: 'bg-yellow-500/10 text-yellow-600 border border-yellow-500/20',
      URGENT: 'bg-red-500/10 text-red-600 border border-red-500/20',
    };
    return colors[priority] || colors.MEDIUM;
  };

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-6 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex justify-between items-center pb-4 border-b border-rule">
        <div>
          <h1 className="text-xl lg:text-2xl font-display font-medium text-ink">
            {t('ticket.myTickets')}
          </h1>
          <p className="text-[10px] font-mono text-muted uppercase mt-1">
            {t('ticket.manageYourTickets')}
          </p>
        </div>
        <button
          onClick={() => router.push('/customer/tickets/create')}
          className="flex items-center gap-1.5 px-3 py-2 bg-cobalt hover:bg-cobalt-hover text-paper text-[10px] font-mono font-bold rounded-[6px] transition-colors uppercase tracking-wider"
        >
          <Plus size={14} />
          <span className="hidden sm:inline">{t('common.create')}</span>
        </button>
      </div>

      <div>
        {/* Filters */}
        <div className="p-4 mb-6 bg-paper border border-rule rounded-[10px] shadow-sm flex items-center gap-4">
          <Filter size={16} className="text-muted" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="flex-1 max-w-[200px] border border-rule bg-paper rounded-[6px] px-3 py-1.5 text-xs font-mono text-ink focus:border-cobalt/50 focus:ring-1 focus:ring-cobalt/20 outline-none transition-all uppercase"
          >
            <option value="all">{t('ticket.allStatus')}</option>
            <option value="OPEN">{t('ticket.status_OPEN')}</option>
            <option value="IN_PROGRESS">{t('ticket.status_IN_PROGRESS')}</option>
            <option value="WAITING_CUSTOMER">{t('ticket.status_WAITING_CUSTOMER')}</option>
            <option value="RESOLVED">{t('ticket.status_RESOLVED')}</option>
            <option value="CLOSED">{t('ticket.status_CLOSED')}</option>
          </select>
        </div>

        {/* Tickets List */}
        {loading ? (
          <div className="text-center py-12 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cobalt"></div>
          </div>
        ) : tickets.length === 0 ? (
          <div className="p-12 text-center bg-paper border border-rule rounded-[10px] shadow-sm">
            <Ticket size={32} className="text-muted/40 mx-auto mb-4" />
            <h3 className="text-sm font-display font-medium text-ink mb-1 uppercase tracking-widest">
              {t('ticket.noTickets')}
            </h3>
            <p className="text-[10px] font-mono text-muted uppercase mb-6 tracking-wider">
              {t('ticket.noTicketsDescription')}
            </p>
            <button
              onClick={() => router.push('/customer/tickets/create')}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-paper border border-rule hover:border-cobalt/50 text-ink text-[10px] font-mono font-bold rounded-[6px] transition-colors uppercase tracking-wider"
            >
              <Plus size={14} />
              {t('ticket.createFirstTicket')}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {tickets.map((ticket) => (
              <div
                key={ticket.id}
                onClick={() => router.push(`/customer/tickets/${ticket.id}`)}
                className="p-5 cursor-pointer bg-paper border border-rule hover:bg-muted/5 rounded-[10px] shadow-sm transition-colors group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <span className="text-[11px] font-mono text-ink font-bold tracking-wide">
                        #{ticket.ticketNumber}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider ${getStatusColor(ticket.status)}`}>
                        {t(`ticket.status_${ticket.status}`)}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider ${getPriorityColor(ticket.priority)}`}>
                        {t(`ticket.priority_${ticket.priority}`)}
                      </span>
                      {ticket.category && (
                        <span
                          className="px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider bg-muted/10 border"
                          style={{ color: ticket.category.color, borderColor: ticket.category.color + '40' }}
                        >
                          {ticket.category.name}
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-display font-medium text-ink mb-3 group-hover:text-cobalt transition-colors truncate">
                      {ticket.subject}
                    </h3>
                    <div className="flex items-center gap-4 text-[10px] font-mono text-muted uppercase tracking-wider">
                      <div className="flex items-center gap-1.5">
                        <MessageSquare size={12} />
                        <span>{ticket._count.messages} {t('ticket.messages')}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span>{formatWIB(ticket.createdAt, 'dd MMM yyyy HH:mm')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


