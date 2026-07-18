'use client';

import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import { Home, MessageSquare, User, Receipt, Shield, Menu, X, Package, Clock, LogOut, Bell, CheckCircle2, XCircle, RefreshCw, Trash2, Wifi, FileText, PauseCircle, Gift, Sun, Moon, RefreshCcw, MoreHorizontal } from 'lucide-react';
import { useEffect, useState, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { CyberToastProvider, useToast } from '@/components/cyberpunk/CyberToast';
import { registerGlobalToast, registerGlobalConfirm } from '@/lib/sweetalert';
import { formatWIB } from '@/lib/timezone';
import { formatInTimeZone } from 'date-fns-tz';
import { id as localeId } from 'date-fns/locale';
import { useTheme } from '@/hooks/useTheme';
import { PushNotificationToggle } from '@/components/push-notification-toggle';

interface MenuItem {
  name: string;
  href: string;
  icon: React.ElementType;
}

const menuItems: MenuItem[] = [
  { name: 'Beranda',             href: '/customer',           icon: Home },
  { name: 'Riwayat Bayar',      href: '/customer/history',   icon: Receipt },
  { name: 'Tagihan',            href: '/customer/invoices',  icon: FileText },
  { name: 'Perpanjang Paket',   href: '/customer/renewal',   icon: RefreshCcw },
  { name: 'Ubah Paket',         href: '/customer/upgrade',   icon: Package },
  { name: 'WiFi',               href: '/customer/wifi',      icon: Wifi },
  { name: 'Bantuan',            href: '/customer/tickets',   icon: MessageSquare },
  { name: 'Referral',           href: '/customer/referral',  icon: Gift },
  { name: 'Berhenti Langganan', href: '/customer/suspend',   icon: PauseCircle },
  { name: 'Akun',        href: '/customer/profile',   icon: User },
];

interface NotifEvent {
  id: string;
  type: string;
  title: string;
  message: string;
  timestamp: string;
}

// â”€â”€â”€ Inner layout â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function CustomerLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [companyName, setCompanyName] = useState('');
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [referralEnabled, setReferralEnabled] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const { isDark, toggleTheme } = useTheme();
  const [unreadCount, setUnreadCount] = useState(0);
  // null = not yet checked (SSR), true/false after client mounts
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [notifHistory, setNotifHistory] = useState<NotifEvent[]>([]);
  const [now, setNow] = useState<Date | null>(null);
  // Default: look back 24h so events that happened before page load are caught
  const lastCheckedRef = useRef<string>(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const { addToast } = useToast();
  // Stable ref to addToast — prevents poll() recreation when context re-renders
  const addToastRef = useRef(addToast);
  useEffect(() => { addToastRef.current = addToast; }, [addToast]);
  // Dedup: track event IDs that already triggered a toast to prevent doubles
  const shownEventIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setNow(new Date());
    const tick = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(tick);
  }, []);

  // â”€â”€ Persist notifications to localStorage â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem('customer_notifications');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.history)) setNotifHistory(parsed.history);
        if (typeof parsed.unread === 'number') setUnreadCount(parsed.unread);
        if (parsed.lastChecked) lastCheckedRef.current = parsed.lastChecked;
      }
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save whenever history / unread changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('customer_notifications', JSON.stringify({
        history: notifHistory,
        unread: unreadCount,
        lastChecked: lastCheckedRef.current,
      }));
    } catch { /* ignore */ }
  }, [notifHistory, unreadCount]);

  const handleClearAllNotifications = () => {
    setNotifHistory([]);
    setUnreadCount(0);
  };

  const handleDeleteNotification = (id: string) => {
    setNotifHistory(prev => prev.filter(n => n.id !== id));
  };

  const poll = useCallback(async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('customer_token') : null;
    if (!token) return;
    try {
      const res = await fetch(
        `/api/customer/notifications?since=${encodeURIComponent(lastCheckedRef.current)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) return;
      const data = await res.json();
      if (!data.success || !Array.isArray(data.events) || data.events.length === 0) return;

      lastCheckedRef.current = new Date().toISOString();
      localStorage.setItem('customer_notif_last_checked', lastCheckedRef.current);
      const events: NotifEvent[] = data.events;

      // Dedup: filter out events whose IDs already triggered a toast in this session
      const newEvents = events.filter(e => !shownEventIdsRef.current.has(e.id));
      if (newEvents.length === 0) return;

      setUnreadCount(prev => prev + newEvents.length);
      setNotifHistory(prev => {
        // Also dedup history by id
        const existingIds = new Set(prev.map(p => p.id));
        const fresh = newEvents.filter(e => !existingIds.has(e.id));
        return [...fresh, ...prev].slice(0, 20);
      });

      // Trigger auto-refresh on all customer pages that are listening
      window.dispatchEvent(new CustomEvent('customer-data-refresh'));

      for (const event of newEvents) {
        shownEventIdsRef.current.add(event.id);
        const fire = addToastRef.current;
        if (event.type === 'payment_success') {
          fire({ type: 'success', title: event.title, description: event.message, duration: 8000 });
        } else if (event.type === 'payment_rejected') {
          fire({ type: 'error', title: event.title, description: event.message, duration: 12000 });
        } else if (event.type === 'package_changed') {
          fire({ type: 'success', title: event.title, description: event.message, duration: 10000 });
        } else if (event.type === 'ticket_reply') {
          fire({ type: 'info', title: event.title, description: event.message, duration: 10000 });
        } else if (event.type === 'ticket_resolved') {
          fire({ type: 'success', title: event.title, description: event.message, duration: 10000 });
        } else {
          fire({ type: 'info', title: event.title, description: event.message, duration: 7000 });
        }
      }
    } catch {
      // silently ignore
    }
  }, []);

  useEffect(() => {
    // Load from cache immediately to prevent logo flash / layout shift
    try {
      const cachedLogo = localStorage.getItem('_co_logo');
      const cachedName = localStorage.getItem('_co_name');
      if (cachedLogo) setCompanyLogo(cachedLogo);
      if (cachedName) setCompanyName(cachedName);
    } catch { /* ignore */ }
    loadCompanyInfo();
    const token = localStorage.getItem('customer_token');
    const handleResize = () => { if (localStorage.getItem('customer_token')) setSidebarOpen(window.innerWidth >= 1024); };
    if (token) handleResize();
    window.addEventListener('resize', handleResize);
    // Poll immediately on mount so notifications show without waiting 30s
    poll();
    intervalRef.current = setInterval(poll, 30_000);
    const onVisible = () => { if (!document.hidden) poll(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [poll]);

  const loadCompanyInfo = async () => {
    try {
      const res = await fetch('/api/public/company');
      const data = await res.json();
      if (data.company?.name) {
        setCompanyName(data.company.name);
        try { localStorage.setItem('_co_name', data.company.name); } catch { /* ignore */ }
      }
      if (data.company?.logo) {
        setCompanyLogo(data.company.logo);
        try { localStorage.setItem('_co_logo', data.company.logo); } catch { /* ignore */ }
      } else {
        try { localStorage.removeItem('_co_logo'); } catch { /* ignore */ }
      }
      if (data.company?.referralEnabled !== undefined) {
        setReferralEnabled(data.company.referralEnabled);
      }
    } catch {
      // ignore
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('customer_token');
    localStorage.removeItem('customer_user');
    router.push('/customer/login');
  };

  // Re-check auth token whenever pathname changes (e.g. after login/logout)
  useEffect(() => {
    setAuthenticated(!!localStorage.getItem('customer_token'));
  }, [pathname]);

  const isActive = (href: string) => {
    if (href === '/customer') return pathname === '/customer';
    return pathname.startsWith(href);
  };

  // Skip portal UI on login page — render children directly
  if (pathname === '/customer/login') {
    return <>{children}</>;
  }

  // Not yet authenticated (or not checked yet) — render children only so the
  // page component can run its own useEffect redirect to /customer/login
  if (!authenticated) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-paper text-ink font-body relative flex">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── N3 SIDE-RAIL DESKTOP ── */}
      <aside
        className={cn(
          'fixed top-0 left-0 h-full z-50 transition-transform duration-300 ease-out',
          'w-64 bg-paper border-r border-rule',
          'flex flex-col',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          'lg:translate-x-0'
        )}
      >
        {/* Sidebar Header */}
        <div className="p-5 border-b border-rule">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {companyLogo ? (
                <div className="w-8 h-8 rounded bg-paper border border-rule p-1 flex flex-shrink-0 items-center justify-center overflow-hidden">
                  <Image unoptimized src={companyLogo} alt={companyName} width={32} height={32} className="w-full h-full object-contain" decoding="async" />
                </div>
              ) : (
                <div className="w-8 h-8 rounded bg-paper border border-rule p-1 flex items-center justify-center flex-shrink-0">
                  <Shield className="w-4 h-4 text-ink" />
                </div>
              )}
              <div className="min-w-0">
                <h1 className="text-sm font-display font-semibold text-ink truncate">
                  {companyName || 'EugineBill'}
                </h1>
                <p className="text-[10px] font-mono text-muted tracking-widest uppercase truncate">Customer Portal</p>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1 hover:bg-muted/10 rounded lg:hidden"
            >
              <X className="w-4 h-4 text-ink" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-3 space-y-0.5 flex-1 min-h-0 overflow-y-auto">
          {menuItems.filter(item => {
            if (item.href === '/customer/referral') return referralEnabled;
            return true;
          }).map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <button
                key={item.href}
                onClick={() => {
                  router.push(item.href);
                  if (typeof window !== 'undefined' && window.innerWidth < 1024) setSidebarOpen(false);
                }}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded transition-colors group',
                  active
                      ? 'text-cobalt bg-cobalt/5 border border-cobalt/20'
                      : 'text-ink hover:bg-muted/10 border border-transparent'
                )}
              >
                <Icon className={cn("w-4 h-4", active ? "text-cobalt" : "text-muted group-hover:text-ink")} />
                <span className="tracking-wide">{item.name}</span>
              </button>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-rule">
          <PushNotificationToggle compact />
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 border border-transparent rounded transition-colors mt-2"
          >
            <LogOut className="w-4 h-4" />
            <span>Keluar</span>
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <div className="lg:ml-64 flex-1 flex flex-col min-h-screen">
        {/* Desktop Header */}
        <header className="hidden lg:flex sticky top-0 z-20 bg-paper border-b border-rule items-center justify-between px-6 py-4">
          <div>
            <h2 className="text-sm font-display font-medium text-ink">Customer Portal</h2>
            <p className="text-[10px] font-mono text-muted tracking-widest uppercase">{companyName}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-muted">
              <Clock className="w-3.5 h-3.5" />
              <span className="text-[11px] font-mono">
                {now ? formatInTimeZone(now, 'Asia/Jakarta', 'EEEE, d MMM yyyy  HH:mm:ss', { locale: localeId }) : ''}
              </span>
            </div>
            {/* Bell */}
            <div className="relative">
              <button
                onClick={() => { setBellOpen(v => !v); setUnreadCount(0); }}
                className="relative p-1.5 flex items-center justify-center rounded hover:bg-muted/10 transition-colors"
              >
                <Bell className="w-4 h-4 text-ink" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-1 bg-cobalt text-paper text-[8px] font-mono font-bold rounded-full flex items-center justify-center">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
              {bellOpen && (
                <>
                  <div className="fixed inset-0 z-40 touch-none" onClick={() => setBellOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 w-80 bg-paper border border-rule rounded shadow-sm z-50 overflow-hidden">
                    <div className="px-4 py-2 border-b border-rule flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold text-ink uppercase tracking-wider">Notifikasi</span>
                      <div className="flex items-center gap-1">
                        {notifHistory.length > 0 && (
                          <button onClick={handleClearAllNotifications} title="Hapus semua" className="p-1 hover:bg-muted/10 rounded transition-colors">
                            <Trash2 className="w-3.5 h-3.5 text-muted hover:text-red-500" />
                          </button>
                        )}
                        <button onClick={() => setBellOpen(false)} className="p-1 hover:bg-muted/10 rounded"><X className="w-3.5 h-3.5 text-ink" /></button>
                      </div>
                    </div>
                    <div className="max-h-72 overflow-y-auto divide-y divide-rule">
                      {notifHistory.length === 0 ? (
                        <p className="text-xs font-mono text-muted text-center py-6">EMPTY</p>
                      ) : notifHistory.map(n => (
                        <div key={n.id} className="px-4 py-3 hover:bg-muted/5 transition-colors group">
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5">
                                {n.type === 'payment_success' ? <CheckCircle2 className="w-4 h-4 text-green-500" /> :
                                 n.type === 'payment_rejected' ? <XCircle className="w-4 h-4 text-red-500" /> :
                                 n.type === 'package_changed' ? <Package className="w-4 h-4 text-cobalt" /> :
                                 <Bell className="w-4 h-4 text-ink" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-ink mb-0.5">{n.title}</p>
                                <p className="text-[11px] text-muted leading-tight">{n.message}</p>
                                <p className="text-[9px] font-mono text-muted/60 mt-1.5">{formatWIB(n.timestamp, 'dd MMM yyyy HH:mm')}</p>
                              </div>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteNotification(n.id); }}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-muted/10 rounded transition-all flex-shrink-0"
                              >
                                <X className="w-3 h-3 text-muted" />
                              </button>
                            </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
            {/* Theme Toggle â€” Desktop */}
            <button
              onClick={toggleTheme}
              className="p-1.5 flex items-center justify-center rounded hover:bg-muted/10 transition-colors"
              title={isDark ? 'Mode Terang' : 'Mode Gelap'}
            >
              {isDark
                ? <Sun className="w-4 h-4 text-muted hover:text-ink" />
                : <Moon className="w-4 h-4 text-muted hover:text-ink" />
              }
            </button>

          </div>
        </header>

        {/* Mobile Header */}
        <header className="lg:hidden sticky top-0 z-20 bg-paper border-b border-rule">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Menu button (left side) */}
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-1 flex items-center justify-center hover:bg-muted/10 rounded transition-colors"
              >
                <Menu className="w-5 h-5 text-ink" />
              </button>
              {companyLogo ? (
                <div className="w-7 h-7 rounded border border-rule flex items-center justify-center overflow-hidden">
                  <Image unoptimized src={companyLogo} alt={companyName} width={28} height={28} className="w-full h-full object-contain" decoding="async" />
                </div>
              ) : (
                <div className="w-7 h-7 rounded border border-rule flex items-center justify-center">
                  <Shield className="w-4 h-4 text-ink" />
                </div>
              )}
              <div>
                <h1 className="text-sm font-display font-medium text-ink">
                  {companyName}
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Bell (mobile) */}
              <div className="relative">
                <button
                  onClick={() => { setBellOpen(v => !v); setUnreadCount(0); }}
                  className="relative p-1.5 flex items-center justify-center hover:bg-muted/10 rounded transition-colors"
                >
                  <Bell className="w-4 h-4 text-ink" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-1 bg-cobalt text-paper text-[8px] font-mono font-bold rounded-full flex items-center justify-center">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>
                {bellOpen && (
                  <>
                    <div className="fixed inset-0 z-40 touch-none" onClick={() => setBellOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 w-72 bg-paper border border-rule rounded shadow-sm z-50 overflow-hidden">
                      <div className="px-4 py-2 border-b border-rule flex items-center justify-between">
                        <span className="text-[10px] font-mono font-bold text-ink uppercase tracking-wider">Notifikasi</span>
                        <div className="flex items-center gap-1">
                          {notifHistory.length > 0 && (
                            <button onClick={handleClearAllNotifications} title="Hapus semua" className="p-1 hover:bg-muted/10 rounded transition-colors">
                              <Trash2 className="w-3.5 h-3.5 text-muted hover:text-red-500" />
                            </button>
                          )}
                          <button onClick={() => setBellOpen(false)} className="p-1 hover:bg-muted/10 rounded"><X className="w-3.5 h-3.5 text-ink" /></button>
                        </div>
                      </div>
                      <div className="max-h-60 overflow-y-auto divide-y divide-rule">
                        {notifHistory.length === 0 ? (
                          <p className="text-xs font-mono text-muted text-center py-6">EMPTY</p>
                        ) : notifHistory.map(n => (
                          <div key={n.id} className="px-4 py-3 hover:bg-muted/5 transition-colors group">
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5">
                                {n.type === 'payment_success' ? <CheckCircle2 className="w-4 h-4 text-green-500" /> :
                                 n.type === 'payment_rejected' ? <XCircle className="w-4 h-4 text-red-500" /> :
                                 n.type === 'package_changed' ? <Package className="w-4 h-4 text-cobalt" /> :
                                 <Bell className="w-4 h-4 text-ink" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-ink mb-0.5">{n.title}</p>
                                <p className="text-[11px] text-muted leading-tight">{n.message}</p>
                                <p className="text-[9px] font-mono text-muted/60 mt-1.5">{formatWIB(n.timestamp, 'dd MMM yyyy HH:mm')}</p>
                              </div>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteNotification(n.id); }}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-muted/10 rounded transition-all flex-shrink-0"
                              >
                                <X className="w-3 h-3 text-muted" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
              {/* Theme Toggle â€” Mobile */}
              <button
                onClick={toggleTheme}
                className="p-1.5 flex items-center justify-center hover:bg-muted/10 rounded transition-colors"
                title={isDark ? 'Mode Terang' : 'Mode Gelap'}
              >
                {isDark
                  ? <Sun className="w-4 h-4 text-muted hover:text-ink" />
                  : <Moon className="w-4 h-4 text-muted hover:text-ink" />
                }
              </button>

            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 pb-20 lg:pb-0 bg-paper">
          {children}
        </main>

        {/* ── MOBILE BOTTOM NAV ── */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-paper border-t border-rule">
          <div className="flex items-center justify-around px-1 py-1 safe-area-pb">
            {[
              { href: '/customer',          icon: Home,        label: 'Beranda' },
              { href: '/customer/invoices', icon: FileText,    label: 'Tagihan' },
              { href: '/customer/renewal',  icon: RefreshCcw,  label: 'Perpanjang' },
              { href: '/customer/tickets',  icon: MessageSquare, label: 'Bantuan' },
              { href: '/customer/profile',  icon: User,        label: 'Akun' },
            ].map(({ href, icon: Icon, label }) => {
              const active = isActive(href);
              return (
                <button
                  key={href}
                  onClick={() => router.push(href)}
                  className={cn(
                    'flex flex-col items-center justify-center gap-1 py-1.5 px-2 min-w-[56px] min-h-[52px] rounded transition-colors',
                    active ? 'text-cobalt' : 'text-muted hover:text-ink'
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-[9px] font-mono tracking-wide leading-none text-center">{label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>


    </div>
  );
}

// â”€â”€â”€ Bridge for global showSuccess/showError helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function CustomerToastBridge() {
  const { addToast, confirm } = useToast();
  useEffect(() => {
    registerGlobalToast(addToast);
    registerGlobalConfirm(confirm);
  }, [addToast, confirm]);
  return null;
}

// â”€â”€â”€ Root export: wrap with CyberToastProvider â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return (
    <CyberToastProvider>
      <CustomerToastBridge />
      <CustomerLayoutInner>{children}</CustomerLayoutInner>
    </CyberToastProvider>
  );
}

