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
    <div className="text-on-surface bg-background pb-[80px] min-h-screen flex flex-col">
      <header className="w-full top-0 sticky bg-surface-bright dark:bg-surface-dim border-b border-hairline-border dark:border-outline-variant z-40 transition-colors duration-200">
        <div className="flex justify-between items-center px-margin-mobile h-16 w-full max-w-container-max mx-auto">
          <div 
            className="flex items-center gap-4 hover:bg-surface-container-low dark:hover:bg-surface-container-high transition-colors duration-200 p-2 rounded cursor-pointer"
            onClick={() => router.push('/customer')}
          >
            <div className="w-8 h-8 rounded-full bg-surface-container-high overflow-hidden flex items-center justify-center">
              {companyLogo ? (
                <img src={companyLogo} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <span className="material-symbols-outlined">home</span>
              )}
            </div>
            <h1 className="text-headline-md font-headline-md text-primary dark:text-primary-fixed-dim tracking-tight">
              {companyName || 'EugineBill'}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggleTheme} className="text-primary dark:text-primary-fixed-dim p-2 rounded-full hover:bg-surface-container-low dark:hover:bg-surface-container-high transition-colors duration-200 active:opacity-70">
              <span className="material-symbols-outlined">{isDark ? 'light_mode' : 'dark_mode'}</span>
            </button>
            <button className="text-primary dark:text-primary-fixed-dim p-2 rounded-full hover:bg-surface-container-low dark:hover:bg-surface-container-high transition-colors duration-200 active:opacity-70 relative">
              <span className="material-symbols-outlined">notifications</span>
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-status-isolated rounded-full"></span>
              )}
            </button>
          </div>
        </div>
      </header>

      {children}

      <nav className="fixed bottom-0 w-full z-50 bg-surface-container-lowest dark:bg-surface-container-highest border-t border-hairline-border dark:border-outline-variant md:hidden">
        <div className="fixed bottom-0 left-0 w-full flex justify-around items-center pt-2 pb-safe px-2 h-16">
          <button onClick={() => router.push('/customer')} className={`flex flex-col items-center justify-center ${isActive('/customer') && pathname === '/customer' ? 'text-primary dark:text-secondary-fixed-dim font-bold' : 'text-on-surface-variant dark:text-outline'} active:scale-95 transition-transform duration-150 hover:bg-surface-container-low p-2 rounded-lg flex-1`}>
            <span className="material-symbols-outlined" style={isActive('/customer') && pathname === '/customer' ? { fontVariationSettings: "'FILL' 1" } : undefined}>home</span>
            <span className="font-label-caps text-label-caps mt-1">Home</span>
          </button>
          <button onClick={() => router.push('/customer/invoices')} className={`flex flex-col items-center justify-center ${isActive('/customer/invoices') || isActive('/customer/history') ? 'text-primary dark:text-secondary-fixed-dim font-bold' : 'text-on-surface-variant dark:text-outline'} active:scale-95 transition-transform duration-150 hover:bg-surface-container-low p-2 rounded-lg flex-1`}>
            <span className="material-symbols-outlined" style={isActive('/customer/invoices') || isActive('/customer/history') ? { fontVariationSettings: "'FILL' 1" } : undefined}>receipt_long</span>
            <span className="font-label-caps text-label-caps mt-1">Invoices</span>
          </button>
          <button onClick={() => router.push('/customer/wifi')} className={`flex flex-col items-center justify-center ${isActive('/customer/wifi') ? 'text-primary dark:text-secondary-fixed-dim font-bold' : 'text-on-surface-variant dark:text-outline'} active:scale-95 transition-transform duration-150 hover:bg-surface-container-low p-2 rounded-lg flex-1`}>
            <span className="material-symbols-outlined" style={isActive('/customer/wifi') ? { fontVariationSettings: "'FILL' 1" } : undefined}>router</span>
            <span className="font-label-caps text-label-caps mt-1">WiFi</span>
          </button>
          <button onClick={() => router.push('/customer/tickets')} className={`flex flex-col items-center justify-center ${isActive('/customer/tickets') ? 'text-primary dark:text-secondary-fixed-dim font-bold' : 'text-on-surface-variant dark:text-outline'} active:scale-95 transition-transform duration-150 hover:bg-surface-container-low p-2 rounded-lg flex-1`}>
            <span className="material-symbols-outlined" style={isActive('/customer/tickets') ? { fontVariationSettings: "'FILL' 1" } : undefined}>contact_support</span>
            <span className="font-label-caps text-label-caps mt-1">Support</span>
          </button>
          <button onClick={() => router.push('/customer/profile')} className={`flex flex-col items-center justify-center ${isActive('/customer/profile') ? 'text-primary dark:text-secondary-fixed-dim font-bold' : 'text-on-surface-variant dark:text-outline'} active:scale-95 transition-transform duration-150 hover:bg-surface-container-low p-2 rounded-lg flex-1`}>
            <span className="material-symbols-outlined" style={isActive('/customer/profile') ? { fontVariationSettings: "'FILL' 1" } : undefined}>person</span>
            <span className="font-label-caps text-label-caps mt-1">Profile</span>
          </button>
        </div>
      </nav>
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

