'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslation } from '@/hooks/useTranslation';
import { useToast } from '@/components/cyberpunk/CyberToast';
import { ArrowLeft, Send, User, Clock } from 'lucide-react';
import { formatWIB } from '@/lib/timezone';

type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING_CUSTOMER' | 'RESOLVED' | 'CLOSED';
type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
type SenderType = 'CUSTOMER' | 'ADMIN' | 'TECHNICIAN' | 'SYSTEM';

interface Message {
  id: string;
  senderType: SenderType;
  senderName: string;
  message: string;
  createdAt: string;
  isInternal: boolean;
}

interface TicketDetail {
  id: string;
  ticketNumber: string;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: string;
  category?: {
    name: string;
    color: string;
  };
}

export default function TicketDetailPage() {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const toast = (type: 'success' | 'error' | 'info', msg: string) =>
    addToast({ type, title: type === 'success' ? 'Berhasil' : 'Gagal', description: msg, duration: type === 'error' ? 8000 : 5000 });
  const params = useParams();
  const router = useRouter();
  const ticketId = params.id as string;

  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    // Check auth
    const token = localStorage.getItem('customer_token');
    if (!token) {
      router.push('/customer/login');
      return;
    }
    
    if (ticketId) {
      fetchTicket();
      fetchMessages();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId, router]);

  const fetchTicket = async () => {
    try {
      const token = localStorage.getItem('customer_token');
      const res = await fetch(`/api/tickets?id=${ticketId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.length > 0) {
          setTicket(data[0]);
        }
      }
    } catch (error) {
      console.error('Failed to fetch ticket:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async () => {
    try {
      const res = await fetch(`/api/tickets/messages?ticketId=${ticketId}&includeInternal=false`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!replyText.trim()) return;

    // Get customer name from session
    let senderName = 'Customer';
    const userData = localStorage.getItem('customer_user');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        senderName = user.name || user.username;
      } catch (error) {
        console.error('Failed to parse user data:', error);
      }
    }

    setSending(true);
    try {
      const res = await fetch('/api/tickets/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId,
          senderType: 'CUSTOMER',
          senderName,
          message: replyText,
          isInternal: false,
        }),
      });

      if (res.ok) {
        setReplyText('');
        fetchMessages();
        toast('success', t('ticket.replySent') || 'Balasan terkirim');
      } else {
        toast('error', t('ticket.replyFailed'));
      }
    } catch (error) {
      console.error('Failed to send reply:', error);
      toast('error', t('ticket.replyFailed'));
    } finally {
      setSending(false);
    }
  };

  const getStatusColor = (status: TicketStatus) => {
    const colors = {
      OPEN: 'bg-accent/10 text-accent border border-accent/20',
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
      MEDIUM: 'bg-accent/10 text-accent border border-accent/20',
      HIGH: 'bg-yellow-500/10 text-yellow-600 border border-yellow-500/20',
      URGENT: 'bg-red-500/10 text-red-600 border border-red-500/20',
    };
    return colors[priority] || colors.MEDIUM;
  };

  const getSenderBadgeColor = (senderType: SenderType) => {
    const colors = {
      CUSTOMER: 'bg-accent/10 text-accent border border-accent/20',
      ADMIN: 'bg-green-500/10 text-green-600 border border-green-500/20',
      TECHNICIAN: 'bg-purple-500/10 text-purple-600 border border-purple-500/20',
      SYSTEM: 'bg-muted/10 text-muted border border-rule',
    };
    return colors[senderType] || colors.SYSTEM;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center bg-paper border border-rule p-8 rounded-[10px] shadow-sm">
          <h2 className="text-lg font-display font-medium text-ink mb-2 uppercase tracking-widest">
            {t('ticket.ticketNotFound')}
          </h2>
          <Link
            href="/customer/tickets"
            className="text-[10px] font-mono font-bold text-accent hover:text-accent-hover uppercase tracking-wider"
          >
            {t('ticket.backToTickets')}
          </Link>
        </div>
      </div>
    );
  }

  const isClosed = ticket.status === 'CLOSED';

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto space-y-6 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex items-center gap-4 pb-4 border-b border-rule">
        <Link
          href="/customer/tickets"
          className="text-muted hover:text-ink transition-colors flex-shrink-0"
        >
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="text-[11px] font-mono font-bold text-ink tracking-wide">
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
          <h2 className="text-xl lg:text-2xl font-display font-medium text-ink truncate mb-1">
            {ticket.subject}
          </h2>
          <p className="text-[10px] font-mono text-muted uppercase tracking-wider">
            {t('ticket.created')}: {formatWIB(ticket.createdAt, 'dd MMM yyyy HH:mm')}
          </p>
        </div>
      </div>

      {/* Initial Description */}
      <div className="bg-paper border border-rule rounded-[10px] shadow-sm overflow-hidden">
        <div className="p-4 border-b border-rule bg-muted/5">
          <h3 className="text-[10px] font-mono font-bold text-ink uppercase tracking-widest">
            {t('ticket.description')}
          </h3>
        </div>
        <div className="p-5">
          <p className="text-sm font-mono text-ink whitespace-pre-wrap leading-relaxed">
            {ticket.description}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`bg-paper border border-rule rounded-[10px] shadow-sm overflow-hidden transition-all ${
              msg.senderType === 'SYSTEM' ? 'opacity-80' : ''
            }`}
          >
            <div className={`p-4 ${msg.senderType === 'SYSTEM' ? 'bg-muted/5' : ''}`}>
              <div className="flex items-start gap-4">
                <div className={`flex-shrink-0 w-8 h-8 rounded border flex items-center justify-center ${
                  msg.senderType === 'CUSTOMER' ? 'bg-accent/10 border-accent/20 text-accent' : 
                  msg.senderType === 'ADMIN' ? 'bg-green-500/10 border-green-500/20 text-green-600' :
                  msg.senderType === 'TECHNICIAN' ? 'bg-purple-500/10 border-purple-500/20 text-purple-600' :
                  'bg-muted/10 border-rule text-muted'
                }`}>
                  <User size={14} />
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-xs font-display font-medium text-ink">
                      {msg.senderName}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider ${getSenderBadgeColor(msg.senderType)}`}>
                      {t(`ticket.senderType_${msg.senderType}`)}
                    </span>
                    <div className="flex items-center gap-1.5 text-[9px] font-mono text-muted uppercase tracking-wider">
                      <Clock size={10} />
                      {formatWIB(msg.createdAt, 'dd MMM HH:mm')}
                    </div>
                  </div>
                  <p className="text-sm font-mono text-ink whitespace-pre-wrap leading-relaxed mt-3">
                    {msg.message}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Reply Form */}
      {!isClosed && (
        <div className="bg-paper border border-rule rounded-[10px] shadow-sm overflow-hidden">
          <div className="p-4 border-b border-rule bg-muted/5">
            <h3 className="text-[10px] font-mono font-bold text-ink uppercase tracking-widest">
              {t('ticket.addReply')}
            </h3>
          </div>
          <form onSubmit={handleReply} className="p-5">
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              rows={4}
              className="w-full bg-paper border border-rule rounded-[6px] px-4 py-3 text-sm font-mono text-ink focus:border-accent/50 focus:ring-1 focus:ring-accent/20 outline-none transition-all resize-y mb-4"
              placeholder={t('ticket.replyPlaceholder')}
              disabled={sending}
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={sending || !replyText.trim()}
                className="flex items-center gap-2 px-6 py-2 bg-accent hover:bg-accent-hover text-paper text-[11px] font-mono font-bold rounded-[6px] transition-colors disabled:opacity-50 uppercase tracking-wider"
              >
                {sending ? (
                  <>
                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></div>
                    {t('ticket.sending')}...
                  </>
                ) : (
                  <>
                    <Send size={14} />
                    {t('ticket.sendReply')}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {isClosed && (
        <div className="bg-muted/5 border border-rule rounded-[10px] p-6 text-center">
          <p className="text-[10px] font-mono font-bold text-muted uppercase tracking-widest">
            {t('ticket.ticketClosed')}
          </p>
        </div>
      )}
    </div>
  );
}

