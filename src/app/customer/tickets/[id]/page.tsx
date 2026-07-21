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
 console.log('success', t('ticket.replySent') || 'Balasan terkirim');
 } else {
 console.log('error', t('ticket.replyFailed'));
 }
 } catch (error) {
 console.error('Failed to send reply:', error);
 console.log('error', t('ticket.replyFailed'));
 } finally {
 setSending(false);
 }
 };

 const getStatusColor = (status: TicketStatus) => {
 const colors = {
 OPEN: 'bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-focus)]/20',
 IN_PROGRESS: 'bg-yellow-500/10 text-yellow-600 border border-yellow-500/20',
 WAITING_CUSTOMER: 'bg-purple-500/10 text-purple-600 border border-purple-500/20',
 RESOLVED: 'bg-green-500/10 text-green-600 border border-green-500/20',
 CLOSED: 'bg-muted/10 text-[var(--color-muted)] border border-[var(--color-rule)]',
 };
 return colors[status] || colors.OPEN;
 };

 const getPriorityColor = (priority: TicketPriority) => {
 const colors = {
 LOW: 'bg-muted/10 text-[var(--color-muted)] border border-[var(--color-rule)]',
 MEDIUM: 'bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-focus)]/20',
 HIGH: 'bg-yellow-500/10 text-yellow-600 border border-yellow-500/20',
 URGENT: 'bg-red-500/10 text-red-600 border border-red-500/20',
 };
 return colors[priority] || colors.MEDIUM;
 };

 const getSenderBadgeColor = (senderType: SenderType) => {
 const colors = {
 CUSTOMER: 'bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-focus)]/20',
 ADMIN: 'bg-green-500/10 text-green-600 border border-green-500/20',
 TECHNICIAN: 'bg-purple-500/10 text-purple-600 border border-purple-500/20',
 SYSTEM: 'bg-muted/10 text-[var(--color-muted)] border border-[var(--color-rule)]',
 };
 return colors[senderType] || colors.SYSTEM;
 };

  return (
    <main className="max-w-[1280px] mx-auto px-4 md:px-8 py-6 pb-32 md:pb-8">
      <button
        onClick={() => router.push('/customer/tickets')}
        className="flex items-center gap-1.5 text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors font-mono text-[10px] uppercase tracking-wider font-bold mb-6"
      >
        <span className="material-symbols-outlined text-[16px]">arrow_back</span>
        Kembali ke Tiket
      </button>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !ticket ? (
        <div className="bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-[var(--radius-lg)] p-6 shadow-sm text-center py-12">
          <p className="text-sm font-body text-[var(--color-muted)]">Tiket tidak ditemukan.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
          {/* Ticket info sidebar */}
          <div className="md:col-span-4 flex flex-col gap-5">
            <div className="bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-[var(--radius-lg)] p-6 shadow-sm">
              <p className="font-mono text-[10px] text-[var(--color-muted)] uppercase tracking-wider font-bold mb-2">Detail Tiket</p>
              <h2 className="text-base font-display font-semibold text-[var(--color-ink)] mt-2 mb-4">{ticket.subject}</h2>
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-body text-[var(--color-muted)]">Nomor</span>
                  <span className="font-mono text-xs text-[var(--color-ink)]">{ticket.ticketNumber}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-body text-[var(--color-muted)]">Status</span>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider ${
                    ticket.status === 'OPEN' ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-focus)]/20' :
                    (ticket.status === 'IN_PROGRESS' || ticket.status === 'WAITING_CUSTOMER') ? 'bg-yellow-500/10 text-yellow-600 border border-yellow-500/20' :
                    'bg-green-500/10 text-green-600 border border-green-500/20'
                  }`}>
                    {ticket.status === 'OPEN' ? 'Terbuka' :
                     ticket.status === 'IN_PROGRESS' ? 'Diproses' :
                     ticket.status === 'WAITING_CUSTOMER' ? 'Menunggu Jawaban' :
                     ticket.status === 'RESOLVED' ? 'Selesai' : 'Ditutup'}
                  </span>
                </div>
                {ticket.category && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-body text-[var(--color-muted)]">Kategori</span>
                    <span className="font-mono text-xs text-[var(--color-ink)]">{ticket.category.name}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-sm font-body text-[var(--color-muted)]">Dibuat</span>
                  <span className="font-mono text-xs text-[var(--color-ink-2)]">{formatWIB(ticket.createdAt, 'dd MMM yyyy HH:mm')}</span>
                </div>
              </div>
              <div className="border-t border-[var(--color-rule)] mt-4 pt-4">
                <p className="font-mono text-[10px] text-[var(--color-muted)] uppercase tracking-wider font-bold mb-2">Deskripsi</p>
                <p className="text-sm font-body text-[var(--color-ink-2)] leading-relaxed">{ticket.description}</p>
              </div>
            </div>
          </div>

          {/* Chat */}
          <div className="md:col-span-8">
            <div className="bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-[var(--radius-lg)] p-0 shadow-sm overflow-hidden flex flex-col">
              <div className="px-6 py-4 border-b border-[var(--color-rule)] bg-[var(--color-paper-2)]">
                <h3 className="text-sm font-display font-semibold text-[var(--color-ink)]">Percakapan</h3>
              </div>
              <div className="flex flex-col gap-4 p-6 min-h-[300px]">
                {messages.length === 0 ? (
                  <p className="text-sm text-center text-[var(--color-muted)] py-8">Belum ada pesan.</p>
                ) : (
                  messages.filter(m => !m.isInternal).map(msg => (
                    <div
                      key={msg.id}
                      className={`flex flex-col max-w-[80%] ${
                        msg.senderType === 'CUSTOMER' ? 'self-end items-end' :
                        msg.senderType === 'SYSTEM' ? 'self-center items-center max-w-full' :
                        'self-start items-start'
                      }`}
                    >
                      <div className={`px-4 py-3 rounded-[var(--radius-md)] text-sm font-body leading-relaxed ${
                        msg.senderType === 'CUSTOMER'
                          ? 'bg-[var(--color-accent)] text-white rounded-br-none'
                          : msg.senderType === 'SYSTEM'
                          ? 'bg-[var(--color-paper-3)] text-[var(--color-ink-2)] text-center text-xs font-mono rounded-[var(--radius-sm)] border border-[var(--color-rule)]'
                          : 'bg-[var(--color-paper-3)] text-[var(--color-ink)] rounded-bl-none border border-[var(--color-rule)]'
                      }`}>
                        {msg.message}
                      </div>
                      <span className="font-mono text-[10px] text-[var(--color-muted)] mt-1 px-1">
                        {msg.senderName} · {formatWIB(msg.createdAt, 'dd MMM HH:mm')}
                      </span>
                    </div>
                  ))
                )}
              </div>
              {/* Reply box */}
              {(ticket.status === 'OPEN' || ticket.status === 'IN_PROGRESS' || ticket.status === 'WAITING_CUSTOMER') && (
                <div className="border-t border-[var(--color-rule)] p-4 bg-[var(--color-paper-2)]">
                  <form onSubmit={handleReply} className="flex gap-3">
                    <textarea
                      value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      placeholder="Tulis balasan..."
                      rows={2}
                      className="w-full bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-[var(--radius-sm)] px-4 py-2.5 text-sm font-mono text-[var(--color-ink)] focus:border-[var(--color-focus)] focus:ring-1 focus:ring-[var(--color-focus)]/20 outline-none transition-all resize-none flex-1"
                      onKeyDown={e => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault();
                          handleReply(e as unknown as React.FormEvent);
                        }
                      }}
                    />
                    <button
                      type="submit"
                      disabled={sending || !replyText.trim()}
                      className="bg-[var(--color-accent)] text-[var(--color-accent-ink)] hover:opacity-90 px-4 py-3 rounded-[var(--radius-sm)] font-mono text-[10px] uppercase font-bold tracking-wider h-fit flex items-center justify-center min-w-[50px]"
                    >
                      {sending
                        ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        : <Send className="w-4 h-4" />}
                    </button>
                  </form>
                  <p className="font-mono text-[10px] text-[var(--color-muted)] mt-2">Ctrl+Enter untuk kirim</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
