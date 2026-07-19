'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/hooks/useTranslation';
import { Ticket, MessageSquare, Plus, Filter } from 'lucide-react';
import { formatWIB } from '@/lib/timezone';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

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

  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!loading && tickets.length > 0) {
      gsap.fromTo('.ticket-item', 
        { y: 30, opacity: 0, scale: 0.98 },
        { y: 0, opacity: 1, scale: 1, duration: 0.5, stagger: 0.05, ease: 'power2.out', clearProps: 'all' }
      );
    }
  }, { scope: containerRef, dependencies: [tickets, loading] });

  // 3D Hover Effect
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -3;
    const rotateY = ((x - centerX) / centerX) * 3;
    gsap.to(card, { rotateX, rotateY, duration: 0.4, ease: "power2.out", transformPerspective: 1000 });
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    gsap.to(e.currentTarget, { rotateX: 0, rotateY: 0, duration: 0.7, ease: "power2.out" });
  };

  useEffect(() => {
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
      OPEN: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
      IN_PROGRESS: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      WAITING_CUSTOMER: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
      RESOLVED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      CLOSED: 'bg-white/10 text-gray-400 border-white/20',
    };
    return colors[status] || colors.OPEN;
  };

  const getStatusIndicator = (status: TicketStatus) => {
    const colors = {
      OPEN: 'bg-blue-500',
      IN_PROGRESS: 'bg-amber-500',
      WAITING_CUSTOMER: 'bg-purple-500',
      RESOLVED: 'bg-emerald-500',
      CLOSED: 'bg-gray-500',
    };
    return colors[status] || colors.OPEN;
  };

  const getPriorityColor = (priority: TicketPriority) => {
    const colors = {
      LOW: 'bg-white/10 text-gray-400 border-white/20',
      MEDIUM: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
      HIGH: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      URGENT: 'bg-red-500/10 text-red-400 border-red-500/30',
    };
    return colors[priority] || colors.MEDIUM;
  };

  return (
    <div ref={containerRef} className="p-4 lg:p-8 max-w-5xl mx-auto space-y-6 pb-24">
      {/* Header */}
      <div className="flex justify-between items-center pb-4 border-b border-white/10">
        <div>
          <h1 className="text-xl lg:text-3xl font-display font-medium flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-xl border border-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.15)]">
              <Ticket className="w-6 h-6 text-purple-400" />
            </div>
            {t('ticket.myTickets')}
          </h1>
          <p className="text-[10px] font-mono opacity-50 uppercase mt-2 tracking-widest">
            {t('ticket.manageYourTickets')}
          </p>
        </div>
        <button
          onClick={() => router.push('/customer/tickets/create')}
          className="flex items-center gap-2 px-4 py-2.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 border border-purple-500/30 text-xs font-mono font-bold rounded-xl transition-all shadow-[0_0_15px_rgba(168,85,247,0.1)] hover:shadow-[0_0_20px_rgba(168,85,247,0.2)] uppercase tracking-wider"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">{t('common.create')}</span>
        </button>
      </div>

      <div>
        {/* Filters */}
        <div className="p-4 mb-6 glass-panel border border-white/10 rounded-2xl flex items-center gap-4">
          <Filter size={18} className="text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="flex-1 max-w-[200px] border border-white/20 bg-black/40 rounded-xl px-4 py-2.5 text-xs font-mono focus:border-purple-400/50 outline-none transition-all uppercase"
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
          <div className="text-center py-20 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400"></div>
          </div>
        ) : tickets.length === 0 ? (
          <div className="p-16 text-center glass-panel border border-white/10 rounded-2xl flex flex-col items-center">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 mb-4">
              <Ticket size={40} className="text-gray-400 opacity-50" />
            </div>
            <h3 className="text-sm font-display font-medium mb-2 uppercase tracking-widest">
              {t('ticket.noTickets')}
            </h3>
            <p className="text-[10px] font-mono opacity-50 uppercase mb-6 tracking-wider">
              {t('ticket.noTicketsDescription')}
            </p>
            <button
              onClick={() => router.push('/customer/tickets/create')}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-mono font-bold rounded-xl transition-colors uppercase tracking-wider"
            >
              <Plus size={14} />
              {t('ticket.createFirstTicket')}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {tickets.map((ticket) => (
              <div
                key={ticket.id}
                onClick={() => router.push(`/customer/tickets/${ticket.id}`)}
                className="ticket-item floating-element p-5 lg:p-6 cursor-pointer glass-panel border border-white/10 hover:bg-white/[0.05] rounded-2xl relative overflow-hidden group transition-colors"
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
              >
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${getStatusIndicator(ticket.status)} opacity-50`} />
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0 pl-2">
                    <div className="flex items-center gap-3 mb-3 flex-wrap">
                      <span className="text-sm font-mono font-bold tracking-wide">
                        #{ticket.ticketNumber}
                      </span>
                      <span className={`px-2.5 py-1 rounded-lg border text-[9px] font-mono font-bold uppercase tracking-wider ${getStatusColor(ticket.status)}`}>
                        {t(`ticket.status_${ticket.status}`)}
                      </span>
                      <span className={`px-2.5 py-1 rounded-lg border text-[9px] font-mono font-bold uppercase tracking-wider ${getPriorityColor(ticket.priority)}`}>
                        {t(`ticket.priority_${ticket.priority}`)}
                      </span>
                      {ticket.category && (
                        <span
                          className="px-2.5 py-1 rounded-lg text-[9px] font-mono font-bold uppercase tracking-wider bg-white/5 border border-white/10"
                          style={{ color: ticket.category.color }}
                        >
                          {ticket.category.name}
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg lg:text-xl font-display font-medium mb-4 group-hover:text-white text-gray-200 transition-colors truncate">
                      {ticket.subject}
                    </h3>
                    <div className="flex items-center gap-5 text-[10px] font-mono opacity-50 uppercase tracking-wider">
                      <div className="flex items-center gap-2">
                        <MessageSquare size={14} />
                        <span>{ticket._count.messages} {t('ticket.messages')}</span>
                      </div>
                      <div className="flex items-center gap-2">
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
