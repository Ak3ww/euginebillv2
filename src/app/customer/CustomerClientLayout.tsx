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
import './customer.css';

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
  const [customerName, setCustomerName] = useState('Pelanggan');
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

  const clearedAtRef = useRef<string>('');
  const deletedIdsRef = useRef<Set<string>>(new Set());

  // ── Persist notifications to localStorage ──────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem('customer_notifications');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.history)) setNotifHistory(parsed.history);
        if (typeof parsed.unread === 'number') setUnreadCount(parsed.unread);
        if (parsed.lastChecked) lastCheckedRef.current = parsed.lastChecked;
        if (parsed.clearedAt) clearedAtRef.current = parsed.clearedAt;
        if (Array.isArray(parsed.deletedIds)) deletedIdsRef.current = new Set(parsed.deletedIds);
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
        clearedAt: clearedAtRef.current,
        deletedIds: Array.from(deletedIdsRef.current),
      }));
    } catch { /* ignore */ }
  }, [notifHistory, unreadCount]);

  const handleClearAllNotifications = () => {
    const nowStr = new Date().toISOString();
    clearedAtRef.current = nowStr;
    lastCheckedRef.current = nowStr;
    setNotifHistory([]);
    setUnreadCount(0);
    try {
      localStorage.setItem('customer_notifications', JSON.stringify({
        history: [],
        unread: 0,
        lastChecked: nowStr,
        clearedAt: nowStr,
        deletedIds: Array.from(deletedIdsRef.current),
      }));
    } catch { /* ignore */ }
  };

  const handleDeleteNotification = (id: string) => {
    deletedIdsRef.current.add(id);
    setNotifHistory(prev => prev.filter(n => n.id !== id));
  };

  const isInitialPollRef = useRef(true);
  
  const poll = useCallback(async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('customer_token') : null;
    if (!token) return;
    try {
      const sinceParam = lastCheckedRef.current || clearedAtRef.current;
      const url = sinceParam
        ? `/api/customer/notifications?since=${encodeURIComponent(sinceParam)}`
        : `/api/customer/notifications`;
      
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return;
      const data = await res.json();
      
      const isInitial = isInitialPollRef.current;
      isInitialPollRef.current = false;
      
      if (!data.success || !Array.isArray(data.events) || data.events.length === 0) return;

      lastCheckedRef.current = new Date().toISOString();
      localStorage.setItem('customer_notif_last_checked', lastCheckedRef.current);
      const events: any[] = data.events;

      // Filter out deleted and pre-cleared events
      const validEvents = events.filter(e => {
        if (deletedIdsRef.current.has(e.id)) return false;
        if (clearedAtRef.current && e.timestamp && new Date(e.timestamp) <= new Date(clearedAtRef.current)) return false;
        return true;
      });

      // Dedup
      const newEvents = validEvents.filter(e => !shownEventIdsRef.current.has(e.id));
      if (newEvents.length === 0) return;

      setUnreadCount(prev => prev + newEvents.length);
      setNotifHistory(prev => {
        const existingIds = new Set(prev.map(p => p.id));
        const fresh = newEvents.filter(e => !existingIds.has(e.id));
        return [...fresh, ...prev].slice(0, 20);
      });

      window.dispatchEvent(new CustomEvent('customer-data-refresh'));

      // Do NOT fire toasts on the initial load (prevent spam on reload)
      if (!isInitial) {
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
      } else {
         // Mark all as shown on initial load so they don't toast later
         for (const event of newEvents) {
            shownEventIdsRef.current.add(event.id);
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
    try {
      const u = JSON.parse(localStorage.getItem('customer_user') || '{}');
      if (u.name) setCustomerName(u.name);
    } catch { /* ignore */ }
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

    const resolvedLogo = companyLogo || '/logo.png';

    return (
    <div className="min-h-screen flex flex-col md:flex-row font-sans bg-slate-50 text-slate-900 selection:bg-[#002c60] selection:text-white">
      
      {/* ── Desktop Sidebar (Hidden on Mobile) ── */}
      <aside className="hidden md:flex flex-col w-64 h-screen sticky top-0 bg-white border-r border-slate-200/80 z-40 transition-colors duration-200 shrink-0 shadow-2xs">
        {/* Brand Header */}
        <div className="p-4 border-b border-slate-100 flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-center p-1 shadow-2xs overflow-hidden shrink-0">
            <img 
              src={resolvedLogo} 
              alt={companyName || 'Portal Pelanggan'} 
              className="h-full w-full object-contain"
              onError={(e) => { 
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-bold text-slate-900 truncate leading-tight tracking-tight">
              {companyName || 'Portal Pelanggan'}
            </h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-mono text-slate-500 font-medium uppercase tracking-wider">Portal Pelanggan</span>
            </div>
          </div>
        </div>
        
        {/* Navigation Menu */}
        <div className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <button 
            onClick={() => router.push('/customer')} 
            className={cn(
              "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-150 text-xs font-semibold", 
              isActive('/customer') && pathname === '/customer' 
                ? "bg-[#002c60] text-white shadow-sm shadow-[#002c60]/20" 
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
            )}
          >
            <Home className="w-4 h-4 shrink-0" />
            <span>Beranda</span>
          </button>

          <button 
            onClick={() => router.push('/customer/invoices')} 
            className={cn(
              "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-150 text-xs font-semibold", 
              isActive('/customer/invoices') 
                ? "bg-[#002c60] text-white shadow-sm shadow-[#002c60]/20" 
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
            )}
          >
            <FileText className="w-4 h-4 shrink-0" />
            <span>Tagihan</span>
          </button>

          <button 
            onClick={() => router.push('/customer/history')} 
            className={cn(
              "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-150 text-xs font-semibold", 
              isActive('/customer/history') 
                ? "bg-[#002c60] text-white shadow-sm shadow-[#002c60]/20" 
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
            )}
          >
            <Receipt className="w-4 h-4 shrink-0" />
            <span>Riwayat Bayar</span>
          </button>

          <button 
            onClick={() => router.push('/customer/wifi')} 
            className={cn(
              "w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all duration-150 text-xs font-semibold", 
              isActive('/customer/wifi') 
                ? "bg-[#002c60] text-white shadow-sm shadow-[#002c60]/20" 
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
            )}
          >
            <div className="flex items-center gap-3">
              <Wifi className="w-4 h-4 shrink-0" />
              <span>Pengaturan Wi-Fi</span>
            </div>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 uppercase font-mono">Segera</span>
          </button>

          <button 
            onClick={() => router.push('/customer/upgrade')} 
            className={cn(
              "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-150 text-xs font-semibold", 
              isActive('/customer/upgrade') 
                ? "bg-[#002c60] text-white shadow-sm shadow-[#002c60]/20" 
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
            )}
          >
            <Package className="w-4 h-4 shrink-0" />
            <span>Ubah Paket</span>
          </button>

          <button 
            onClick={() => router.push('/customer/tickets')} 
            className={cn(
              "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-150 text-xs font-semibold", 
              isActive('/customer/tickets') 
                ? "bg-[#002c60] text-white shadow-sm shadow-[#002c60]/20" 
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
            )}
          >
            <MessageSquare className="w-4 h-4 shrink-0" />
            <span>Pusat Bantuan</span>
          </button>
        </div>

        {/* Sidebar Footer Account & Logout */}
        <div className="p-4 border-t border-slate-100 space-y-2">
           <button 
             onClick={() => router.push('/customer/profile')} 
             className={cn(
               "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-150 text-xs font-semibold", 
               isActive('/customer/profile') 
                 ? "bg-slate-100 text-[#002c60]" 
                 : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
             )}
           >
             <div className="w-7 h-7 rounded-lg bg-[#002c60] text-white flex items-center justify-center font-bold text-xs shrink-0">
               {authenticated ? customerName.charAt(0).toUpperCase() : 'U'}
             </div>
             <div className="text-left min-w-0 flex-1">
               <p className="text-xs font-bold text-slate-800 truncate">{authenticated ? customerName : 'Pelanggan'}</p>
               <p className="text-[10px] text-slate-400 font-mono">Kelola Profil</p>
             </div>
           </button>
           <button 
             onClick={handleLogout} 
             className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-150 text-xs font-semibold text-red-600 hover:bg-red-50 cursor-pointer"
           >
             <LogOut className="w-4 h-4 shrink-0 text-red-500" />
             <span>Keluar dari Akun</span>
           </button>
        </div>
      </aside>

      {/* ── Main Content Area ── */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* ── Desktop Top Header ── */}
        <header className="hidden md:flex w-full sticky top-0 bg-white/95 backdrop-blur-md border-b border-slate-200/80 justify-between items-center px-8 h-16 z-50 shadow-2xs">
          <div>
            <span className="text-xs text-slate-500">Selamat datang,</span>{' '}
            <strong className="text-sm font-bold text-slate-900">{authenticated ? customerName : ''}</strong>
            {now && (
              <span className="text-[11px] font-mono text-slate-400 ml-3 pl-3 border-l border-slate-200">
                {formatInTimeZone(now, 'Asia/Jakarta', 'EEEE, dd MMM yyyy • HH:mm', { locale: localeId })} WIB
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Notification Bell */}
            <div className="relative">
              <button 
                onClick={() => { setBellOpen(!bellOpen); setUnreadCount(0); }} 
                className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors relative cursor-pointer"
                aria-label="Notifikasi"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white animate-pulse" />
                )}
              </button>

              {bellOpen && (
                <div className="absolute top-12 right-0 w-84 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2">
                  <div className="p-3.5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <span className="font-bold text-xs text-slate-800 uppercase tracking-wider font-mono">Notifikasi</span>
                    {notifHistory.length > 0 && (
                      <button 
                        onClick={handleClearAllNotifications} 
                        className="text-[11px] text-[#002c60] hover:underline font-semibold cursor-pointer"
                      >
                        Bersihkan Semua
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {notifHistory.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                        <Bell className="w-8 h-8 opacity-20 text-slate-500" />
                        <span>Belum ada notifikasi baru</span>
                      </div>
                    ) : (
                      notifHistory.map(n => (
                        <div key={n.id} className="p-3.5 hover:bg-slate-50/80 transition-colors relative group">
                          <div className="text-xs font-bold text-slate-800 mb-0.5">{n.title}</div>
                          <div className="text-[11px] text-slate-600 leading-relaxed">{n.message}</div>
                          <div className="text-[10px] text-slate-400 mt-1.5 font-mono">{new Date(n.timestamp).toLocaleString('id-ID')}</div>
                          <button 
                            onClick={() => handleDeleteNotification(n.id)} 
                            className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-600 p-1 rounded transition-all cursor-pointer"
                            aria-label="Hapus notifikasi"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Avatar Pill */}
            <div 
              onClick={() => router.push('/customer/profile')}
              className="flex items-center gap-2 pl-3 border-l border-slate-200 cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-xl bg-[#002c60] group-hover:bg-[#1b437c] transition-colors flex items-center justify-center text-white font-bold text-xs shadow-2xs">
                {authenticated ? customerName.charAt(0).toUpperCase() : 'U'}
              </div>
              <span className="text-xs font-semibold text-slate-700 group-hover:text-slate-900 hidden lg:inline">
                {authenticated ? customerName.split(' ')[0] : 'Akun'}
              </span>
            </div>
          </div>
        </header>

        {/* ── Mobile Top App Bar ── */}
        <header className="md:hidden w-full sticky top-0 bg-white/95 backdrop-blur-md border-b border-slate-200/80 flex justify-between items-center px-4 h-16 z-50 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center p-1 overflow-hidden shrink-0">
              <img 
                src={resolvedLogo} 
                alt={companyName || 'Eugine Media'} 
                className="h-full w-full object-contain"
                onError={(e) => { 
                  const target = e.target as HTMLImageElement;
                  if (target.src.endsWith('/logo.png')) {
                    target.style.display = 'none';
                  } else {
                    target.src = '/logo.png';
                  }
                }}
              />
            </div>
            <div>
              <h1 className="text-xs font-bold text-slate-900 tracking-tight leading-none">
                {companyName || 'Eugine Media'}
              </h1>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">Portal Pelanggan</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 relative">
            <button 
              onClick={() => { setBellOpen(!bellOpen); setUnreadCount(0); }} 
              className="text-slate-600 active:text-slate-900 p-2 rounded-xl hover:bg-slate-100 relative cursor-pointer"
              aria-label="Notifikasi"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-white animate-pulse" />
              )}
            </button>

            {bellOpen && (
              <div className="absolute top-12 right-0 w-76 max-w-[calc(100vw-2rem)] bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2">
                <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                  <span className="font-bold text-xs text-slate-800 uppercase tracking-wider font-mono">Notifikasi</span>
                  {notifHistory.length > 0 && (
                    <button 
                      onClick={handleClearAllNotifications} 
                      className="text-[11px] text-[#002c60] hover:underline font-semibold"
                    >
                      Bersihkan
                    </button>
                  )}
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                  {notifHistory.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                      <Bell className="w-8 h-8 opacity-20 text-slate-500" />
                      <span>Belum ada notifikasi</span>
                    </div>
                  ) : (
                    notifHistory.map(n => (
                      <div key={n.id} className="p-3 hover:bg-slate-50 relative">
                        <div className="text-xs font-bold text-slate-800 mb-0.5">{n.title}</div>
                        <div className="text-[11px] text-slate-600 leading-relaxed">{n.message}</div>
                        <div className="text-[10px] text-slate-400 mt-1 font-mono">{new Date(n.timestamp).toLocaleString('id-ID')}</div>
                        <button 
                          onClick={() => handleDeleteNotification(n.id)} 
                          className="absolute top-2 right-2 text-slate-400 hover:text-red-600 p-1"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </header>

        {/* ── Page Content ── */}
        <div className="flex-1 pb-24 md:pb-8">
          {children}
        </div>
        
        {/* ── Bottom Navigation Dock (Mobile) ── */}
        <nav className="fixed bottom-0 inset-x-0 z-50 md:hidden mobile-nav-dock">
          <div className="flex justify-around items-center h-16 px-2">
            <button 
              onClick={() => router.push('/customer')} 
              className={cn(
                "flex flex-col items-center justify-center font-bold active:scale-95 transition-all duration-150 py-1 px-2 rounded-xl flex-1", 
                isActive('/customer') && pathname === '/customer' 
                  ? "text-[#002c60]" 
                  : "text-slate-500 hover:text-slate-800"
              )}
            >
              <Home className="w-5 h-5 mb-1" />
              <span className="font-mono text-[9px] uppercase tracking-wider font-semibold">Beranda</span>
              {isActive('/customer') && pathname === '/customer' && (
                <span className="w-1 h-1 rounded-full bg-[#002c60] mt-0.5" />
              )}
            </button>

            <button 
              onClick={() => router.push('/customer/invoices')} 
              className={cn(
                "flex flex-col items-center justify-center font-bold active:scale-95 transition-all duration-150 py-1 px-2 rounded-xl flex-1", 
                isActive('/customer/invoices') 
                  ? "text-[#002c60]" 
                  : "text-slate-500 hover:text-slate-800"
              )}
            >
              <FileText className="w-5 h-5 mb-1" />
              <span className="font-mono text-[9px] uppercase tracking-wider font-semibold">Tagihan</span>
              {isActive('/customer/invoices') && (
                <span className="w-1 h-1 rounded-full bg-[#002c60] mt-0.5" />
              )}
            </button>

            <button 
              onClick={() => router.push('/customer/wifi')} 
              className={cn(
                "flex flex-col items-center justify-center font-bold active:scale-95 transition-all duration-150 py-1 px-2 rounded-xl flex-1 relative", 
                isActive('/customer/wifi') 
                  ? "text-[#002c60]" 
                  : "text-slate-500 hover:text-slate-800"
              )}
            >
              <div className="relative">
                <Wifi className="w-5 h-5 mb-1" />
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white" />
              </div>
              <span className="font-mono text-[9px] uppercase tracking-wider font-semibold">WiFi</span>
              {isActive('/customer/wifi') && (
                <span className="w-1 h-1 rounded-full bg-[#002c60] mt-0.5" />
              )}
            </button>

            <button 
              onClick={() => router.push('/customer/tickets')} 
              className={cn(
                "flex flex-col items-center justify-center font-bold active:scale-95 transition-all duration-150 py-1 px-2 rounded-xl flex-1", 
                isActive('/customer/tickets') 
                  ? "text-[#002c60]" 
                  : "text-slate-500 hover:text-slate-800"
              )}
            >
              <MessageSquare className="w-5 h-5 mb-1" />
              <span className="font-mono text-[9px] uppercase tracking-wider font-semibold">Bantuan</span>
              {isActive('/customer/tickets') && (
                <span className="w-1 h-1 rounded-full bg-[#002c60] mt-0.5" />
              )}
            </button>

            <button 
              onClick={() => router.push('/customer/profile')} 
              className={cn(
                "flex flex-col items-center justify-center font-bold active:scale-95 transition-all duration-150 py-1 px-2 rounded-xl flex-1", 
                isActive('/customer/profile') 
                  ? "text-[#002c60]" 
                  : "text-slate-500 hover:text-slate-800"
              )}
            >
              <User className="w-5 h-5 mb-1" />
              <span className="font-mono text-[9px] uppercase tracking-wider font-semibold">Profil</span>
              {isActive('/customer/profile') && (
                <span className="w-1 h-1 rounded-full bg-[#002c60] mt-0.5" />
              )}
            </button>
          </div>
        </nav>
      </div>
    </div>
  );
}
// ─── Bridge for global
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

