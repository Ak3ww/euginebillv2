'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import {
  Server,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Shield,
  Package,
  Users,
  Smartphone,
  CreditCard,
  Terminal,
  Copy,
  Check,
  AlertTriangle,
  RefreshCw,
  Building2,
  Globe,
  Radio,
  Cable,
  CheckCircle,
  XCircle,
  ExternalLink,
  Layers,
  Lock,
  KeyRound,
  Info,
  Sliders,
  ChevronRight,
  Send,
  HelpCircle,
  UserCheck,
  ShieldCheck,
  Loader2,
  LogIn,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { copyToClipboard } from '@/lib/clipboard';

interface CompanyData {
  name: string;
  phone: string;
  adminPhone: string;
  baseUrl: string;
  address: string;
  email: string;
}

interface TestConnectionResult {
  success: boolean;
  message: string;
  diagnosis?: string;
  usedPort?: number;
  fixScript?: string;
}


interface CreatedProfile {
  id: string;
  name: string;
  groupName: string;
  price: number;
  downloadSpeed: number;
  uploadSpeed: number;
}

interface CreatedUser {
  id?: string;
  username: string;
  name: string;
  phone: string;
  invoiceNumber?: string;
}

const WIZARD_STEPS = [
  { id: 1, title: 'Profil ISP', icon: Building2, desc: 'Identitas & Kontak' },
  { id: 2, title: 'Koneksi MikroTik', icon: Server, desc: 'API & Firewall' },
  { id: 3, title: 'Paket PPPoE', icon: Package, desc: 'Kecepatan & Tarif' },
  { id: 4, title: 'Pelanggan Trial', icon: Users, desc: 'Akun & Secret' },
  { id: 5, title: 'Bot WhatsApp', icon: Smartphone, desc: 'Notifikasi Otomatis' },
  { id: 6, title: 'Payment Gateway', icon: CreditCard, desc: 'Pembayaran Online' },
];

export default function UnifiedSetupWizardPage() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();

  // Initialization check state
  const [checkingInit, setCheckingInit] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  // Uninitialized First-Run State (Step 0)
  const [initStep, setInitStep] = useState(1);
  const [initSubmitting, setInitSubmitting] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [initFormData, setInitFormData] = useState({
    companyName: '',
    companyAddress: '',
    companyPhone: '',
    companyEmail: '',
    baseUrl: typeof window !== 'undefined' ? window.location.origin : '',
    timezone: 'Asia/Jakarta',
    adminUsername: 'admin',
    adminName: '',
    adminEmail: '',
    adminPassword: '',
    adminPasswordConfirm: '',
    customerIdPrefix: 'EB-',
    fixedBillingDate: '20',
  });

  // Post-Initialization Wizard State (Steps 1 - 7)
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);
  const [hasExistingData, setHasExistingData] = useState<boolean>(false);
  const [existingStats, setExistingStats] = useState<{ routerCount: number; userCount: number }>({
    routerCount: 0,
    userCount: 0,
  });

  // Step 1: Company Profile State
  const [companyForm, setCompanyForm] = useState<CompanyData>({
    name: 'PT Eugine Solusi Internet',
    phone: '081234567890',
    adminPhone: '081234567890',
    baseUrl: typeof window !== 'undefined' ? window.location.origin : 'https://billing.isp.net',
    address: 'Jl. Protokol Telekomunikasi No. 88, Jakarta',
    email: 'admin@isp.net',
  });
  const [isSavingCompany, setIsSavingCompany] = useState(false);
  const [companySaved, setCompanySaved] = useState(false);

  // Step 2: Router MikroTik State
  const [connectionMethod, setConnectionMethod] = useState<'wireguard' | 'l2tp' | 'direct'>('wireguard');
  const [routerForm, setRouterForm] = useState({
    name: 'MikroTik-Utama',
    ipAddress: '10.254.1.2',
    port: '8728',
    winboxPort: '8291',
    username: 'euginebill_api',
    password: 'EB@ApiSecret2026',
    secret: 'secret123',
  });
  const [generatedScript, setGeneratedScript] = useState<string>('');
  const [copiedScript, setCopiedScript] = useState(false);
  const [isTestingRouter, setIsTestingRouter] = useState(false);
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(null);
  const [isSavingRouter, setIsSavingRouter] = useState(false);
  const [routerSaved, setRouterSaved] = useState(false);
  const [savedRouterId, setSavedRouterId] = useState<string | null>(null);

  // Step 3: PPPoE Profile State
  const [profileForm, setProfileForm] = useState({
    name: 'Home 20 Mbps',
    downloadSpeed: '20',
    uploadSpeed: '20',
    price: '200000',
    groupName: 'default',
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [createdProfile, setCreatedProfile] = useState<CreatedProfile | null>(null);

  // Step 4: Trial Customer State
  const [customerForm, setCustomerForm] = useState({
    name: 'Pelanggan Percobaan',
    phone: '081298765432',
    username: 'trial01',
    password: 'secret@user123',
  });
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);
  const [createdCustomer, setCreatedCustomer] = useState<CreatedUser | null>(null);

  // Step 5: WhatsApp Bot State
  const [waLoading, setWaLoading] = useState(false);
  const [waProviders, setWaProviders] = useState<any[]>([]);
  const [waConnected, setWaConnected] = useState(false);

  // Check system initialization
  useEffect(() => {
    async function checkSetup() {
      try {
        const res = await fetch('/api/setup');
        const data = await res.json();
        setIsInitialized(Boolean(data.isInitialized));
      } catch (err) {
        console.error('Failed checking setup status:', err);
      } finally {
        setCheckingInit(false);
      }
    }
    checkSetup();
  }, []);

  // Fetch company, router, user, and wa data when authenticated
  useEffect(() => {
    if (!isInitialized || sessionStatus !== 'authenticated') return;

    async function loadData() {
      setIsLoadingData(true);
      try {
        const [companyRes, routersRes, usersRes, waRes] = await Promise.allSettled([
          fetch('/api/company'),
          fetch('/api/network/routers'),
          fetch('/api/pppoe/users'),
          fetch('/api/whatsapp/providers'),
        ]);

        let rCount = 0;
        let uCount = 0;

        if (companyRes.status === 'fulfilled' && companyRes.value.ok) {
          const cData = await companyRes.value.json();
          if (cData && cData.name) {
            setCompanyForm((prev) => ({
              ...prev,
              name: cData.name || prev.name,
              phone: cData.phone || prev.phone,
              adminPhone: cData.adminPhone || cData.phone || prev.adminPhone,
              baseUrl: cData.baseUrl || (typeof window !== 'undefined' ? window.location.origin : prev.baseUrl),
              address: cData.address || prev.address,
              email: cData.email || prev.email,
            }));
            setCompanySaved(true);
          }
        }

        if (routersRes.status === 'fulfilled' && routersRes.value.ok) {
          const rData = await routersRes.value.json();
          const routers = rData.routers || (Array.isArray(rData) ? rData : []);
          rCount = routers.length;
          if (routers.length > 0) {
            setSavedRouterId(routers[0].id);
            setRouterForm((prev) => ({
              ...prev,
              name: routers[0].name || prev.name,
              ipAddress: routers[0].ipAddress || routers[0].nasname || prev.ipAddress,
              username: routers[0].username || prev.username,
              port: String(routers[0].port || routers[0].apiPort || 8728),
            }));
            setRouterSaved(true);
          }
        }

        if (usersRes.status === 'fulfilled' && usersRes.value.ok) {
          const uData = await usersRes.value.json();
          const users = uData.users || (Array.isArray(uData) ? uData : []);
          uCount = users.length;
        }

        if (waRes.status === 'fulfilled' && waRes.value.ok) {
          const wData = await waRes.value.json();
          if (Array.isArray(wData) && wData.length > 0) {
            setWaProviders(wData);
            const active = wData.some((p: any) => p.isActive);
            setWaConnected(active);
          }
        }

        setExistingStats({ routerCount: rCount, userCount: uCount });
        if (rCount > 0 || uCount > 0) {
          setHasExistingData(true);
        }
      } catch (err) {
        console.error('Failed loading wizard data:', err);
      } finally {
        setIsLoadingData(false);
      }
    }

    loadData();
  }, [isInitialized, sessionStatus]);

  // Generate RouterOS script
  useEffect(() => {
    const port = routerForm.port || '8728';
    const winbox = routerForm.winboxPort || '8291';
    const u = routerForm.username;
    const p = routerForm.password;
    const ip = routerForm.ipAddress;

    let script = `# ========================================================\n`;
    script += `# SKRIP SETUP MIKROTIK UNTUK EUGINEBILL\n`;
    script += `# Metode Koneksi: ${connectionMethod.toUpperCase()}\n`;
    script += `# Router: ${routerForm.name} (IP: ${ip})\n`;
    script += `# Port API: ${port} | Winbox: ${winbox}\n`;
    script += `# ========================================================\n\n`;

    if (connectionMethod === 'wireguard') {
      script += `# --- 1. Konfigurasi WireGuard Client (Tunnel Aman VPS) ---\n`;
      script += `/interface wireguard add listen-port=13231 name=wg0-euginebill comment="EugineBill WireGuard"\n`;
      script += `/ip address add address=${ip}/24 interface=wg0-euginebill comment="EugineBill VPN IP"\n`;
      script += `# Catatan: Hubungkan peer server WireGuard sesuai IP publik VPS EugineBill\n\n`;
    } else if (connectionMethod === 'l2tp') {
      script += `# --- 1. Konfigurasi L2TP Client (UltraVPN Standard) ---\n`;
      script += `:if ([:len [/ppp profile find name="ebvpn-remote"]] = 0) do={\n`;
      script += `    /ppp profile add name=ebvpn-remote use-encryption=no change-tcp-mss=yes only-one=no\n`;
      script += `}\n`;
      script += `/interface l2tp-client add name=l2tp-euginebill connect-to="<VPS_IP_ADDRESS>" user="${u}" password="${p}" profile=ebvpn-remote disabled=no comment="EugineBill L2TP"\n\n`;
    }

    script += `# --- 2. Buat Group Akses Khusus API & Winbox ---\n`;
    script += `:do { /user group add name=api-users policy=read,write,policy,test,sensitive,api,winbox,password,local,web,ssh comment="API Access EugineBill" } on-error={}\n`;
    script += `:do { /user group set [find name="api-users"] policy=read,write,policy,test,sensitive,api,winbox,password,local,web,ssh } on-error={}\n\n`;

    script += `# --- 3. Buat User API MikroTik ---\n`;
    script += `:do { /user remove [find name="${u}"] } on-error={}\n`;
    script += `/user add name="${u}" group=api-users password="${p}" comment="API User EugineBill"\n\n`;

    script += `# --- 4. Aktifkan Service Port API & Winbox ---\n`;
    script += `:do { /ip service set api port=${port} address="" disabled=no } on-error={}\n`;
    script += `:do { /ip service set winbox port=${winbox} address="" disabled=no } on-error={}\n\n`;

    script += `# --- 5. Buka Akses Firewall Filter di Posisi Teratas ---\n`;
    script += `:do { /ip firewall filter add chain=input action=accept protocol=tcp dst-port=${port},8728 comment="Allow EugineBill VPS API" place-before=0 } on-error={}\n`;
    if (connectionMethod === 'wireguard') {
      script += `:do { /ip firewall filter add chain=input action=accept in-interface=wg0-euginebill place-before=0 comment="Allow EugineBill WG VPN" } on-error={}\n`;
    } else if (connectionMethod === 'l2tp') {
      script += `:do { /ip firewall filter add chain=input action=accept in-interface=l2tp-euginebill place-before=0 comment="Allow EugineBill L2TP VPN" } on-error={}\n`;
    }

    script += `\n# ========================================================\n`;
    script += `# SELESAI! Tempel skrip ini di Terminal Winbox Anda.\n`;
    script += `# ========================================================`;

    setGeneratedScript(script);
  }, [connectionMethod, routerForm]);

  // Stepper handlers
  const markStepCompleted = (stepNumber: number) => {
    if (!completedSteps.includes(stepNumber)) {
      setCompletedSteps((prev) => [...prev, stepNumber]);
    }
  };

  const handleNext = () => {
    markStepCompleted(currentStep);
    setCurrentStep((prev) => Math.min(prev + 1, 7));
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  // First-Run Initial System Setup Handler (Step 0)
  const handleInitialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInitSubmitting(true);
    setInitError(null);

    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(initFormData),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal melakukan inisialisasi.');
      }

      // Successfully initialized! Redirect to login with setup callback
      router.push('/admin/login?setup=success&callbackUrl=/setup');
    } catch (err: any) {
      setInitError(err.message || 'Terjadi kesalahan sistem.');
      setInitSubmitting(false);
    }
  };

  // Step 1: Save Company Profile
  const handleSaveCompany = async () => {
    setIsSavingCompany(true);
    try {
      const res = await fetch('/api/company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(companyForm),
      });

      if (!res.ok) {
        throw new Error('Gagal menyimpan profil perusahaan');
      }

      setCompanySaved(true);
      markStepCompleted(1);
      setCurrentStep(2);
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan profil');
    } finally {
      setIsSavingCompany(false);
    }
  };

  // Step 2: Test & Save Router
  const handleTestRouter = async () => {
    setIsTestingRouter(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/network/routers/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ipAddress: routerForm.ipAddress,
          username: routerForm.username,
          password: routerForm.password,
          port: parseInt(routerForm.port) || 8728,
        }),
      });

      const data: TestConnectionResult = await res.json();
      setTestResult(data);

      if (data.success) {
        if (data.usedPort && data.usedPort !== parseInt(routerForm.port)) {
          setRouterForm((prev) => ({ ...prev, port: String(data.usedPort) }));
        }
        await handleSaveRouter();
      }

    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Koneksi ke MikroTik gagal / timeout',
        diagnosis: 'network_error',
      });
    } finally {
      setIsTestingRouter(false);
    }
  };

  const handleSaveRouter = async () => {
    setIsSavingRouter(true);
    try {
      const res = await fetch('/api/network/routers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: routerForm.name,
          ipAddress: routerForm.ipAddress,
          nasname: routerForm.ipAddress,
          username: routerForm.username,
          password: routerForm.password,
          port: parseInt(routerForm.port) || 8728,
          winboxPort: parseInt(routerForm.winboxPort) || 8291,
          secret: routerForm.secret || 'secret123',
        }),
      });

      const data = await res.json();
      if (res.ok && data.router) {
        setSavedRouterId(data.router.id);
        setRouterSaved(true);
        markStepCompleted(2);
      } else if (res.status === 409) {
        setRouterSaved(true);
        markStepCompleted(2);
      }
    } catch (err) {
      console.error('Failed to save router:', err);
    } finally {
      setIsSavingRouter(false);
    }
  };

  // Step 3: Save PPPoE Profile
  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    try {
      const res = await fetch('/api/pppoe/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profileForm.name,
          groupName: profileForm.groupName || 'default',
          price: parseInt(profileForm.price) || 200000,
          downloadSpeed: parseInt(profileForm.downloadSpeed) || 20,
          uploadSpeed: parseInt(profileForm.uploadSpeed) || 20,
          validityValue: 1,
          validityUnit: 'MONTHS',
          sharedUser: true,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Gagal menyimpan profil paket PPPoE');
      }

      const created = await res.json();
      setCreatedProfile(created);
      markStepCompleted(3);
      setCurrentStep(4);
    } catch (err: any) {
      alert(err.message || 'Terjadi kesalahan saat membuat paket');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Step 4: Save Trial Customer
  const handleSaveCustomer = async () => {
    if (!createdProfile?.id) {
      alert('Silakan simpan paket layanan di Step 3 terlebih dahulu.');
      return;
    }

    setIsSavingCustomer(true);
    try {
      const res = await fetch('/api/pppoe/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: customerForm.name,
          phone: customerForm.phone,
          username: customerForm.username,
          password: customerForm.password,
          profileId: createdProfile.id,
          routerId: savedRouterId || undefined,
          firstInvoice: 'prorate',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal mendaftarkan pelanggan percobaan');
      }

      setCreatedCustomer({
        id: data.user?.id || data.id,
        username: customerForm.username,
        name: customerForm.name,
        phone: customerForm.phone,
        invoiceNumber: data.invoice?.invoiceNumber || data.invoiceNumber || 'INV-PRORATE-001',
      });

      markStepCompleted(4);
      setCurrentStep(5);
    } catch (err: any) {
      alert(err.message || 'Gagal membuat pelanggan');
    } finally {
      setIsSavingCustomer(false);
    }
  };

  // Step 5: Refresh WhatsApp Status
  const handleRefreshWhatsApp = async () => {
    setWaLoading(true);
    try {
      const res = await fetch('/api/whatsapp/providers');
      if (res.ok) {
        const data = await res.json();
        setWaProviders(data);
        const active = data.some((p: any) => p.isActive);
        setWaConnected(active);
      }
    } catch (err) {
      console.error('Failed refreshing WhatsApp status:', err);
    } finally {
      setWaLoading(false);
    }
  };

  // Finish Wizard
  const handleFinishWizard = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('euginebill_wizard_completed', 'true');
    }
    router.push('/admin');
  };

  const handleCopyScript = async () => {
    const ok = await copyToClipboard(generatedScript);
    if (ok) {
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 2500);
    }
  };

  // 1. Loading initialization check
  if (checkingInit) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-9 h-9 animate-spin text-sky-600" />
        <p className="text-sm font-medium text-slate-600">Memeriksa status sistem EugineBill...</p>
      </div>
    );
  }

  // 2. CASE: SYSTEM NOT INITIALIZED (First-run Superadmin & ISP setup)
  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-xl relative z-10 px-4">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-sky-600 text-white shadow-md mb-4">
              <Server className="w-7 h-7" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Inisialisasi Sistem EugineBill
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
              Selamat datang! Lengkapi form awal berikut untuk membuat akun Superadmin dan profil usaha ISP Anda.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-6 bg-white p-2 rounded-xl border border-slate-200 shadow-xs">
            <button
              type="button"
              onClick={() => setInitStep(1)}
              className={`flex items-center justify-center gap-2 p-2 rounded-lg text-xs font-semibold transition-all ${
                initStep === 1 ? 'bg-sky-50 text-sky-700 border border-sky-200' : 'text-slate-500'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" /> Profil ISP
            </button>
            <button
              type="button"
              onClick={() => setInitStep(2)}
              className={`flex items-center justify-center gap-2 p-2 rounded-lg text-xs font-semibold transition-all ${
                initStep === 2 ? 'bg-sky-50 text-sky-700 border border-sky-200' : 'text-slate-500'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" /> Akun Admin
            </button>
            <button
              type="button"
              onClick={() => setInitStep(3)}
              className={`flex items-center justify-center gap-2 p-2 rounded-lg text-xs font-semibold transition-all ${
                initStep === 3 ? 'bg-sky-50 text-sky-700 border border-sky-200' : 'text-slate-500'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" /> Billing Default
            </button>
          </div>

          <Card className="border-border shadow-sm bg-white">
            <CardContent className="pt-6">
              {initError && (
                <div className="mb-5 p-3 rounded-lg border border-rose-200 bg-rose-50 text-rose-800 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{initError}</span>
                </div>
              )}

              <form onSubmit={handleInitialSubmit}>
                {/* STEP 1: Company Details */}
                {initStep === 1 && (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Nama ISP / Brand Usaha *</Label>
                      <Input
                        required
                        value={initFormData.companyName}
                        onChange={(e) => setInitFormData({ ...initFormData, companyName: e.target.value })}
                        placeholder="Contoh: PT Solusi Cepat Net"
                        className="h-9 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">No. WhatsApp Admin / CS *</Label>
                      <Input
                        required
                        value={initFormData.companyPhone}
                        onChange={(e) => setInitFormData({ ...initFormData, companyPhone: e.target.value })}
                        placeholder="0812xxxxxxxx"
                        className="h-9 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Base URL / Domain Billing</Label>
                      <Input
                        value={initFormData.baseUrl}
                        onChange={(e) => setInitFormData({ ...initFormData, baseUrl: e.target.value })}
                        placeholder="https://billing.isp.net"
                        className="h-9 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Alamat Kantor</Label>
                      <Input
                        value={initFormData.companyAddress}
                        onChange={(e) => setInitFormData({ ...initFormData, companyAddress: e.target.value })}
                        placeholder="Jl. Telekomunikasi No. 88"
                        className="h-9 text-sm"
                      />
                    </div>
                    <div className="pt-2 flex justify-end">
                      <Button
                        type="button"
                        onClick={() => {
                          if (!initFormData.companyName.trim()) {
                            setInitError('Nama ISP wajib diisi');
                            return;
                          }
                          setInitError(null);
                          setInitStep(2);
                        }}
                        className="h-9 text-xs px-5 gap-1.5 bg-sky-600 hover:bg-sky-700 text-white"
                      >
                        Lanjut ke Akun Admin <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* STEP 2: Superadmin Account */}
                {initStep === 2 && (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Nama Lengkap Superadmin *</Label>
                      <Input
                        required
                        value={initFormData.adminName}
                        onChange={(e) => setInitFormData({ ...initFormData, adminName: e.target.value })}
                        placeholder="Nama Administrator"
                        className="h-9 text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Username Login *</Label>
                        <Input
                          required
                          value={initFormData.adminUsername}
                          onChange={(e) => setInitFormData({ ...initFormData, adminUsername: e.target.value })}
                          placeholder="admin"
                          className="h-9 text-sm font-mono"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Email *</Label>
                        <Input
                          required
                          type="email"
                          value={initFormData.adminEmail}
                          onChange={(e) => setInitFormData({ ...initFormData, adminEmail: e.target.value })}
                          placeholder="admin@isp.net"
                          className="h-9 text-sm"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Password Baru *</Label>
                        <Input
                          required
                          type="password"
                          value={initFormData.adminPassword}
                          onChange={(e) => setInitFormData({ ...initFormData, adminPassword: e.target.value })}
                          placeholder="Minimal 6 karakter"
                          className="h-9 text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Konfirmasi Password *</Label>
                        <Input
                          required
                          type="password"
                          value={initFormData.adminPasswordConfirm}
                          onChange={(e) => setInitFormData({ ...initFormData, adminPasswordConfirm: e.target.value })}
                          placeholder="Ulangi password"
                          className="h-9 text-sm"
                        />
                      </div>
                    </div>
                    <div className="pt-2 flex justify-between">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setInitStep(1)}
                        className="h-9 text-xs"
                      >
                        Kembali
                      </Button>
                      <Button
                        type="button"
                        onClick={() => {
                          if (!initFormData.adminName || !initFormData.adminUsername || !initFormData.adminPassword) {
                            setInitError('Seluruh form akun admin wajib diisi.');
                            return;
                          }
                          if (initFormData.adminPassword !== initFormData.adminPasswordConfirm) {
                            setInitError('Konfirmasi password tidak cocok.');
                            return;
                          }
                          setInitError(null);
                          setInitStep(3);
                        }}
                        className="h-9 text-xs px-5 gap-1.5 bg-sky-600 hover:bg-sky-700 text-white"
                      >
                        Lanjut ke Billing Default <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* STEP 3: Billing Defaults */}
                {initStep === 3 && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Prefix ID Pelanggan</Label>
                        <Input
                          value={initFormData.customerIdPrefix}
                          onChange={(e) => setInitFormData({ ...initFormData, customerIdPrefix: e.target.value })}
                          placeholder="EB-"
                          className="h-9 text-sm font-mono"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Tanggal Tagihan Bulanan (1-28)</Label>
                        <Input
                          type="number"
                          value={initFormData.fixedBillingDate}
                          onChange={(e) => setInitFormData({ ...initFormData, fixedBillingDate: e.target.value })}
                          placeholder="20"
                          className="h-9 text-sm"
                        />
                      </div>
                    </div>
                    <div className="p-3 rounded-lg border border-sky-200 bg-sky-50 text-sky-900 text-xs flex items-center gap-2">
                      <Info className="w-4 h-4 text-sky-600 shrink-0" />
                      <span>Data ini akan menginisialisasi database dan mengunci akses publik ke form awal.</span>
                    </div>
                    <div className="pt-2 flex justify-between">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setInitStep(2)}
                        className="h-9 text-xs"
                      >
                        Kembali
                      </Button>
                      <Button
                        type="submit"
                        disabled={initSubmitting}
                        className="h-9 text-xs px-6 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                      >
                        {initSubmitting ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                        Simpan & Inisialisasi Sistem
                      </Button>
                    </div>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // 3. CASE: SYSTEM INITIALIZED BUT USER NOT LOGGED IN
  if (sessionStatus === 'loading') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-9 h-9 animate-spin text-sky-600" />
        <p className="text-sm font-medium text-slate-600">Memeriksa autentikasi admin...</p>
      </div>
    );
  }

  if (sessionStatus === 'unauthenticated') {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center px-4">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-sky-100 text-sky-700 mb-4">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Sistem Telah Terinisialisasi
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-slate-600">
            Silakan login dengan akun Administrator Anda untuk mengakses Wizard Setup Jaringan & Layanan.
          </p>
          <div className="mt-6">
            <Button
              onClick={() => router.push('/admin/login?callbackUrl=/setup')}
              className="h-10 text-xs sm:text-sm px-6 gap-2 bg-sky-600 hover:bg-sky-700 text-white font-medium"
            >
              <LogIn className="w-4 h-4" /> Masuk ke Akun Admin
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // 4. CASE: AUTHENTICATED ADMIN ACCESSING ONBOARDING WIZARD
  return (
    <div className="min-h-screen bg-slate-50/60 pb-16 pt-6">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-6">
        {/* Soft Notification Banner for Existing Operational Systems */}
        {hasExistingData && (
          <div className="p-4 rounded-xl border border-sky-200 bg-sky-50/80 text-sky-950 flex items-start gap-3 shadow-xs">
            <Info className="w-5 h-5 text-sky-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <h4 className="font-semibold text-sm text-sky-900">Sistem Operasional Telah Aktif</h4>
              <p className="text-xs text-sky-700 mt-0.5 leading-relaxed">
                Sistem Anda telah memiliki data operasional aktif ({existingStats.routerCount} Router,{' '}
                {existingStats.userCount} Pelanggan PPPoE). Anda tetap dapat menggunakan wizard ini untuk mengecek
                konektivitas, menambah router baru, atau merapikan skrip RouterOS.
              </p>
            </div>
            <Link href="/admin">
              <Button variant="outline" size="sm" className="text-xs h-8 border-sky-300 bg-white hover:bg-sky-100/50">
                Ke Dashboard Admin
              </Button>
            </Link>
          </div>
        )}

        {/* Header Title Card */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-border shadow-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-sky-300 bg-sky-50 text-sky-700 font-semibold px-2.5 py-0.5 text-[11px]">
                SETUP WIZARD
              </Badge>
              <span className="text-xs text-muted-foreground">EugineBill Engine v2.4</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Panduan Konfigurasi Awal ISP</h1>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl">
              Siapkan koneksi MikroTik, tarif paket, secret trial, dan bot WhatsApp Anda hanya dalam 6 langkah terpadu.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (confirm('Lewati wizard dan langsung ke dashboard admin?')) {
                  if (typeof window !== 'undefined') {
                    localStorage.setItem('euginebill_wizard_completed', 'true');
                  }
                  router.push('/admin');
                }
              }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Lewati Wizard
            </Button>
          </div>
        </div>

        {/* Interactive Stepper Navigation Header */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-border shadow-xs overflow-x-auto">
          <div className="flex items-center justify-between min-w-[620px]">
            {WIZARD_STEPS.map((step, index) => {
              const IconComponent = step.icon;
              const isCurrent = currentStep === step.id;
              const isCompleted = completedSteps.includes(step.id);

              return (
                <React.Fragment key={step.id}>
                  <button
                    onClick={() => setCurrentStep(step.id)}
                    className={`flex items-center gap-3 text-left p-2 rounded-xl transition-all ${
                      isCurrent
                        ? 'bg-sky-50/80 text-sky-900 ring-1 ring-sky-300'
                        : isCompleted
                        ? 'hover:bg-slate-100 text-foreground'
                        : 'opacity-60 hover:opacity-90'
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center font-semibold text-xs shrink-0 transition-colors ${
                        isCompleted
                          ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                          : isCurrent
                          ? 'bg-sky-600 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-500 border border-slate-200'
                      }`}
                    >
                      {isCompleted ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <IconComponent className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="text-xs font-semibold leading-none">{step.title}</div>
                      <div className="text-[10px] text-muted-foreground mt-1">{step.desc}</div>
                    </div>
                  </button>

                  {index < WIZARD_STEPS.length - 1 && (
                    <div className="h-[2px] flex-1 bg-slate-200 mx-2 relative min-w-[20px]">
                      <div
                        className="h-full bg-emerald-500 transition-all duration-300"
                        style={{ width: isCompleted ? '100%' : '0%' }}
                      />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* STEP CONTENT BODY */}

        {/* STEP 1: PROFIL ISP */}
        {currentStep === 1 && (
          <Card className="border-border shadow-xs bg-white">
            <CardHeader className="border-b border-border/50 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold">Langkah 1: Identitas & Profil ISP</CardTitle>
                    <CardDescription className="text-xs">
                      Atur nama usaha, kontak resmi CS, dan alamat yang akan tercetak pada tagihan invoice pelanggan.
                    </CardDescription>
                  </div>
                </div>
                {companySaved && (
                  <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700 text-xs gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Tersimpan
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="companyName" className="text-xs font-medium">
                    Nama ISP / Perusahaan *
                  </Label>
                  <Input
                    id="companyName"
                    value={companyForm.name}
                    onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                    placeholder="Contoh: Eugine Solusi Net"
                    className="h-9 text-sm"
                  />
                  <p className="text-[11px] text-muted-foreground">Ditampilkan di header invoice & portal pelanggan.</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="adminPhone" className="text-xs font-medium">
                    No. WhatsApp CS / Billing *
                  </Label>
                  <Input
                    id="adminPhone"
                    value={companyForm.adminPhone}
                    onChange={(e) => setCompanyForm({ ...companyForm, adminPhone: e.target.value, phone: e.target.value })}
                    placeholder="0812xxxxxxxx"
                    className="h-9 text-sm"
                  />
                  <p className="text-[11px] text-muted-foreground">Nomor pusat bantuan ketika pelanggan konfirmasi transfer.</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="baseUrl" className="text-xs font-medium">
                    Base URL / Domain Billing *
                  </Label>
                  <Input
                    id="baseUrl"
                    value={companyForm.baseUrl}
                    onChange={(e) => setCompanyForm({ ...companyForm, baseUrl: e.target.value })}
                    placeholder="https://billing.isp.net"
                    className="h-9 text-sm"
                  />
                  <p className="text-[11px] text-muted-foreground">Digunakan untuk link tagihan pada notifikasi WhatsApp.</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-medium">
                    Email Kontak Resmi
                  </Label>
                  <Input
                    id="email"
                    value={companyForm.email}
                    onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })}
                    placeholder="admin@isp.net"
                    className="h-9 text-sm"
                  />
                  <p className="text-[11px] text-muted-foreground">Email operasional untuk pengiriman notifikasi sistem.</p>
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="address" className="text-xs font-medium">
                    Alamat Lengkap Kantor
                  </Label>
                  <Input
                    id="address"
                    value={companyForm.address}
                    onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
                    placeholder="Jl. Telekomunikasi No. 123, Kota..."
                    className="h-9 text-sm"
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="border-t border-border/50 pt-4 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Pastikan data di atas sudah benar sebelum melangkah.</span>
              <Button onClick={handleSaveCompany} disabled={isSavingCompany} className="h-9 text-xs px-5 gap-2 bg-sky-600 hover:bg-sky-700 text-white">
                {isSavingCompany ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ArrowRight className="w-3.5 h-3.5" />
                )}
                Simpan & Lanjut ke MikroTik
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* STEP 2: KONEKSI MIKROTIK */}
        {currentStep === 2 && (
          <Card className="border-border shadow-xs bg-white">
            <CardHeader className="border-b border-border/50 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center">
                    <Server className="w-4 h-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold">Langkah 2: Hubungkan MikroTik ke Billing</CardTitle>
                    <CardDescription className="text-xs">
                      Pilih metode koneksi VPN atau Direct IP, salin skrip firewall RouterOS, lalu uji live connection.
                    </CardDescription>
                  </div>
                </div>
                {routerSaved && (
                  <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700 text-xs gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Terhubung & Tersimpan
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              {/* Method Selection Tabs */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Metode Jalur Terowongan / Koneksi:
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div
                    onClick={() => setConnectionMethod('wireguard')}
                    className={`cursor-pointer border rounded-xl p-3.5 transition-all flex flex-col justify-between ${
                      connectionMethod === 'wireguard'
                        ? 'border-sky-500 bg-sky-50/60 ring-2 ring-sky-500/20 shadow-xs'
                        : 'border-border hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                          <Radio className="w-3.5 h-3.5 text-sky-600" /> WireGuard VPN
                        </span>
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[9px] px-1 py-0">
                          Rekomendasi
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Terowongan aman modern, latency rendah, stabil untuk RouterOS v7+.
                      </p>
                    </div>
                  </div>

                  <div
                    onClick={() => setConnectionMethod('l2tp')}
                    className={`cursor-pointer border rounded-xl p-3.5 transition-all flex flex-col justify-between ${
                      connectionMethod === 'l2tp'
                        ? 'border-sky-500 bg-sky-50/60 ring-2 ring-sky-500/20 shadow-xs'
                        : 'border-border hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                          <Shield className="w-3.5 h-3.5 text-sky-600" /> L2TP VPN
                        </span>
                        <Badge variant="outline" className="text-[9px] px-1 py-0">
                          Standar
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Kompatibel untuk semua versi MikroTik (RouterOS v6 & v7).
                      </p>
                    </div>
                  </div>

                  <div
                    onClick={() => setConnectionMethod('direct')}
                    className={`cursor-pointer border rounded-xl p-3.5 transition-all flex flex-col justify-between ${
                      connectionMethod === 'direct'
                        ? 'border-sky-500 bg-sky-50/60 ring-2 ring-sky-500/20 shadow-xs'
                        : 'border-border hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                          <Globe className="w-3.5 h-3.5 text-sky-600" /> Direct IP / DDNS
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Jika VPS dan MikroTik berada di LAN yang sama atau menggunakan IP Publik.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Form Router Parameters */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 bg-slate-50/70 p-4 rounded-xl border border-border">
                <div className="space-y-1">
                  <Label htmlFor="routerName" className="text-xs font-medium">
                    Nama Router
                  </Label>
                  <Input
                    id="routerName"
                    value={routerForm.name}
                    onChange={(e) => setRouterForm({ ...routerForm, name: e.target.value })}
                    placeholder="MikroTik-Utama"
                    className="h-8 text-xs bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="ipAddress" className="text-xs font-medium">
                    Host IP / IP Terowongan *
                  </Label>
                  <Input
                    id="ipAddress"
                    value={routerForm.ipAddress}
                    onChange={(e) => setRouterForm({ ...routerForm, ipAddress: e.target.value })}
                    placeholder="10.254.1.2"
                    className="h-8 text-xs bg-white font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="apiPort" className="text-xs font-medium">
                    Port API MikroTik *
                  </Label>
                  <Input
                    id="apiPort"
                    value={routerForm.port}
                    onChange={(e) => setRouterForm({ ...routerForm, port: e.target.value })}
                    placeholder="8728"
                    className="h-8 text-xs bg-white font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="winboxPort" className="text-xs font-medium">
                    Port Winbox
                  </Label>
                  <Input
                    id="winboxPort"
                    value={routerForm.winboxPort}
                    onChange={(e) => setRouterForm({ ...routerForm, winboxPort: e.target.value })}
                    placeholder="8291"
                    className="h-8 text-xs bg-white font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="apiUser" className="text-xs font-medium">
                    API Username
                  </Label>
                  <Input
                    id="apiUser"
                    value={routerForm.username}
                    onChange={(e) => setRouterForm({ ...routerForm, username: e.target.value })}
                    placeholder="euginebill_api"
                    className="h-8 text-xs bg-white font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="apiPass" className="text-xs font-medium">
                    API Password
                  </Label>
                  <Input
                    id="apiPass"
                    type="text"
                    value={routerForm.password}
                    onChange={(e) => setRouterForm({ ...routerForm, password: e.target.value })}
                    placeholder="Password API"
                    className="h-8 text-xs bg-white font-mono"
                  />
                </div>
              </div>

              {/* Generated RouterOS Script Box */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-slate-700" />
                    <Label className="text-xs font-semibold">Skrip Konfigurasi MikroTik (Siap Dijalankan di Terminal):</Label>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyScript}
                    className="h-7 text-xs px-2.5 gap-1.5 border-border bg-white hover:bg-slate-50"
                  >
                    {copiedScript ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700 font-medium">Tersalin ke Clipboard!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>Salin Skrip</span>
                      </>
                    )}
                  </Button>
                </div>

                <div className="relative">
                  <pre className="p-3.5 rounded-xl bg-slate-900 text-slate-100 text-xs font-mono overflow-x-auto max-h-56 leading-relaxed border border-slate-800">
                    {generatedScript}
                  </pre>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Buka <strong>Winbox &gt; Terminal</strong>, lalu klik kanan &gt; Paste skrip di atas. Skrip otomatis
                  membuat user API dan mengizinkan firewall input port {routerForm.port || '8728'} di baris paling atas.
                </p>
              </div>

              {/* Test Connection Live Box */}
              <div className="p-4 rounded-xl border border-border bg-slate-50/80 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5 text-sky-600" /> Uji Konektivitas Billing ke MikroTik
                    </h4>
                    <p className="text-[11px] text-muted-foreground">
                      Pastikan MikroTik dapat dijangkau oleh VPS EugineBill sebelum lanjut ke langkah berikutnya.
                    </p>
                  </div>
                  <Button
                    onClick={handleTestRouter}
                    disabled={isTestingRouter}
                    size="sm"
                    className="h-8 text-xs gap-1.5 bg-sky-600 hover:bg-sky-700 text-white"
                  >
                    {isTestingRouter ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Menguji Koneksi...
                      </>
                    ) : (
                      <>
                        <Server className="w-3.5 h-3.5" /> Test Koneksi MikroTik
                      </>
                    )}
                  </Button>
                </div>

                {testResult && (
                  <div
                    className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
                      testResult.success
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                        : 'border-rose-200 bg-rose-50 text-rose-900'
                    }`}
                  >
                    {testResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 space-y-1">
                      <div className="font-semibold">
                        {testResult.success ? 'Koneksi Berhasil! MikroTik Siap Digunakan.' : 'Koneksi Gagal'}
                      </div>
                      <p className="text-[11px] leading-relaxed opacity-90">{testResult.message}</p>
                      {!testResult.success && testResult.diagnosis === 'firewall_block' && (
                        <div className="p-2 mt-1 rounded bg-white/80 border border-rose-200 text-[11px] text-rose-800 space-y-1">
                          <div>
                            <strong>Diagnosa Firewall:</strong> Port API terblokir. Pastikan rule firewall filter accept
                            di baris teratas (place-before=0) sudah dieksekusi di MikroTik.
                          </div>
                          {testResult.fixScript && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                await copyToClipboard(testResult.fixScript!);
                                alert('Perintah fix firewall disalin! Silakan tempel di terminal MikroTik.');
                              }}
                              className="h-6 text-[10px] px-2 gap-1 border-rose-300 text-rose-700 bg-white hover:bg-rose-50"
                            >
                              <Copy className="w-3 h-3" /> Salin Skrip Perbaikan Firewall
                            </Button>
                          )}
                        </div>
                      )}

                    </div>
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter className="border-t border-border/50 pt-4 flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={handleBack} className="h-9 text-xs gap-1.5">
                <ArrowLeft className="w-3.5 h-3.5" /> Kembali
              </Button>
              <div className="flex items-center gap-2">
                {!routerSaved && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSaveRouter}
                    disabled={isSavingRouter}
                    className="h-9 text-xs"
                  >
                    Simpan Tanpa Test
                  </Button>
                )}
                <Button onClick={handleNext} className="h-9 text-xs gap-1.5 px-5 bg-sky-600 hover:bg-sky-700 text-white">
                  Lanjut ke Paket PPPoE <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </CardFooter>
          </Card>
        )}

        {/* STEP 3: PAKET LAYANAN PPPOE */}
        {currentStep === 3 && (
          <Card className="border-border shadow-xs bg-white">
            <CardHeader className="border-b border-border/50 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center">
                    <Package className="w-4 h-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold">Langkah 3: Buat Paket Layanan PPPoE Perdana</CardTitle>
                    <CardDescription className="text-xs">
                      Tentukan nama paket, alokasi bandwidth download/upload, dan tarif berlangganan bulanan.
                    </CardDescription>
                  </div>
                </div>
                {createdProfile && (
                  <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700 text-xs gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Paket Dibuat
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="pkgName" className="text-xs font-medium">
                    Nama Paket Layanan *
                  </Label>
                  <Input
                    id="pkgName"
                    value={profileForm.name}
                    onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                    placeholder="Contoh: Home 20 Mbps"
                    className="h-9 text-sm"
                  />
                  <p className="text-[11px] text-muted-foreground">Label paket yang tertera pada katalog dan invoice.</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="groupName" className="text-xs font-medium">
                    PPP Profile MikroTik *
                  </Label>
                  <Input
                    id="groupName"
                    value={profileForm.groupName}
                    onChange={(e) => setProfileForm({ ...profileForm, groupName: e.target.value })}
                    placeholder="default"
                    className="h-9 text-sm font-mono"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Nama PPP profile di MikroTik (gunakan <code>default</code> jika belum membuat khusus).
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="dlSpeed" className="text-xs font-medium">
                    Download Speed (Mbps) *
                  </Label>
                  <Input
                    id="dlSpeed"
                    type="number"
                    value={profileForm.downloadSpeed}
                    onChange={(e) => setProfileForm({ ...profileForm, downloadSpeed: e.target.value })}
                    placeholder="20"
                    className="h-9 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="ulSpeed" className="text-xs font-medium">
                    Upload Speed (Mbps) *
                  </Label>
                  <Input
                    id="ulSpeed"
                    type="number"
                    value={profileForm.uploadSpeed}
                    onChange={(e) => setProfileForm({ ...profileForm, uploadSpeed: e.target.value })}
                    placeholder="20"
                    className="h-9 text-sm"
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="price" className="text-xs font-medium">
                    Tarif Bulanan (Rp) *
                  </Label>
                  <Input
                    id="price"
                    type="number"
                    value={profileForm.price}
                    onChange={(e) => setProfileForm({ ...profileForm, price: e.target.value })}
                    placeholder="200000"
                    className="h-9 text-sm font-semibold"
                  />
                  <p className="text-[11px] text-muted-foreground">Nominal tagihan bulanan pelanggan untuk paket ini.</p>
                </div>
              </div>

              {createdProfile && (
                <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-900 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div>
                      <span className="font-semibold">{createdProfile.name}</span> berhasil dibuat (
                      {createdProfile.downloadSpeed}M/{createdProfile.uploadSpeed}M - Rp{' '}
                      {createdProfile.price.toLocaleString('id-ID')}).
                    </div>
                  </div>
                  <Badge variant="outline" className="border-emerald-300 bg-white text-emerald-700 text-[10px]">
                    ID: {createdProfile.id.slice(0, 8)}...
                  </Badge>
                </div>
              )}
            </CardContent>
            <CardFooter className="border-t border-border/50 pt-4 flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={handleBack} className="h-9 text-xs gap-1.5">
                <ArrowLeft className="w-3.5 h-3.5" /> Kembali
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleSaveProfile}
                  disabled={isSavingProfile}
                  className="h-9 text-xs gap-2 bg-sky-600 hover:bg-sky-700 text-white"
                >
                  {isSavingProfile ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Simpan Paket & Lanjut
                </Button>
              </div>
            </CardFooter>
          </Card>
        )}

        {/* STEP 4: PELANGGAN TRIAL */}
        {currentStep === 4 && (
          <Card className="border-border shadow-xs bg-white">
            <CardHeader className="border-b border-border/50 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold">Langkah 4: Daftarkan Pelanggan Percobaan (Trial)</CardTitle>
                    <CardDescription className="text-xs">
                      Sistem akan membuat PPPoE Secret di MikroTik dan menerbitkan tagihan invoice perdana secara otomatis.
                    </CardDescription>
                  </div>
                </div>
                {createdCustomer && (
                  <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700 text-xs gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Terdaftar
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="custName" className="text-xs font-medium">
                    Nama Pelanggan *
                  </Label>
                  <Input
                    id="custName"
                    value={customerForm.name}
                    onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                    placeholder="Pelanggan Percobaan"
                    className="h-9 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="custPhone" className="text-xs font-medium">
                    Nomor WhatsApp Pelanggan *
                  </Label>
                  <Input
                    id="custPhone"
                    value={customerForm.phone}
                    onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                    placeholder="0812xxxxxxxx"
                    className="h-9 text-sm"
                  />
                  <p className="text-[11px] text-muted-foreground">Nomor tujuan notifikasi rincian tagihan via WhatsApp.</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="pppoeUser" className="text-xs font-medium">
                    PPPoE Username *
                  </Label>
                  <Input
                    id="pppoeUser"
                    value={customerForm.username}
                    onChange={(e) => setCustomerForm({ ...customerForm, username: e.target.value })}
                    placeholder="trial01"
                    className="h-9 text-sm font-mono"
                  />
                  <p className="text-[11px] text-muted-foreground">Username secret yang disinkronisasikan ke MikroTik.</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="pppoePass" className="text-xs font-medium">
                    PPPoE Password *
                  </Label>
                  <Input
                    id="pppoePass"
                    type="text"
                    value={customerForm.password}
                    onChange={(e) => setCustomerForm({ ...customerForm, password: e.target.value })}
                    placeholder="123456"
                    className="h-9 text-sm font-mono"
                  />
                  <p className="text-[11px] text-muted-foreground">Password koneksi dial PPPoE ONT/modem pelanggan.</p>
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs font-medium">Paket Layanan Terpilih:</Label>
                  <div className="p-3 rounded-lg border border-border bg-slate-50 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-sky-600" />
                      <span className="font-semibold">{createdProfile?.name || profileForm.name}</span>
                      <span className="text-muted-foreground">
                        ({profileForm.downloadSpeed}M/{profileForm.uploadSpeed}M)
                      </span>
                    </div>
                    <span className="font-semibold text-foreground">
                      Rp {parseInt(profileForm.price || '0').toLocaleString('id-ID')}/bln
                    </span>
                  </div>
                </div>
              </div>

              {createdCustomer && (
                <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-900 text-xs space-y-1.5">
                  <div className="flex items-center gap-2 font-semibold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    Akun Pelanggan Percobaan Berhasil Didaftarkan!
                  </div>
                  <div className="text-[11px] text-emerald-800 grid grid-cols-2 gap-2 mt-1">
                    <div>
                      Username: <strong>{createdCustomer.username}</strong>
                    </div>
                    <div>
                      Invoice Perdana: <strong>{createdCustomer.invoiceNumber}</strong>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter className="border-t border-border/50 pt-4 flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={handleBack} className="h-9 text-xs gap-1.5">
                <ArrowLeft className="w-3.5 h-3.5" /> Kembali
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleSaveCustomer}
                  disabled={isSavingCustomer}
                  className="h-9 text-xs gap-2 bg-sky-600 hover:bg-sky-700 text-white"
                >
                  {isSavingCustomer ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Users className="w-3.5 h-3.5" />}
                  Daftarkan Pelanggan & Lanjut
                </Button>
              </div>
            </CardFooter>
          </Card>
        )}

        {/* STEP 5: INTEGRASI WHATSAPP BOT */}
        {currentStep === 5 && (
          <Card className="border-border shadow-xs bg-white">
            <CardHeader className="border-b border-border/50 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold">Langkah 5: Integrasi WhatsApp Bot Notifikasi</CardTitle>
                    <CardDescription className="text-xs">
                      Aktifkan engine Baileys internal atau gateway WhatsApp favorit untuk broadcast tagihan otomatis.
                    </CardDescription>
                  </div>
                </div>
                {waConnected ? (
                  <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700 text-xs gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Bot Terhubung
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 text-xs gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Belum Scan QR
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="p-4 rounded-xl border border-border bg-slate-50/70 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        waConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'
                      }`}
                    />
                    <span className="font-semibold text-xs">
                      Status WhatsApp Engine:{' '}
                      {waConnected ? 'Tersambung & Siap Mengirim' : 'Menunggu Pemasangan (Scan QR)'}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefreshWhatsApp}
                    disabled={waLoading}
                    className="h-7 text-xs px-2.5 gap-1.5 bg-white"
                  >
                    <RefreshCw className={`w-3 h-3 ${waLoading ? 'animate-spin' : ''}`} /> Cek Status
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  EugineBill dilengkapi Baileys multi-device engine internal yang gratis tanpa biaya langganan bulanan.
                  Cukup buka modul WhatsApp, scan QR code dengan aplikasi WhatsApp Admin Anda, dan bot langsung aktif
                  mengirim rincian invoice dan peringatan jatuh tempo.
                </p>

                <div className="flex flex-wrap gap-2 pt-1">
                  <Link href="/admin/settings/whatsapp" target="_blank">
                    <Button size="sm" variant="default" className="h-8 text-xs gap-1.5 bg-sky-600 hover:bg-sky-700">
                      <ExternalLink className="w-3.5 h-3.5" /> Buka Halaman Scan QR WhatsApp
                    </Button>
                  </Link>
                </div>
              </div>

              <div className="p-3 rounded-lg border border-sky-200 bg-sky-50 text-sky-900 text-xs flex items-start gap-2">
                <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                <div className="text-[11px] leading-relaxed">
                  <strong>Tips:</strong> Anda juga dapat menautkan penyedia pihak ketiga seperti Fonnte, Wablas, Kirimi.id,
                  atau Gowa kapan saja melalui menu <em>Pengaturan &gt; WhatsApp</em>.
                </div>
              </div>
            </CardContent>
            <CardFooter className="border-t border-border/50 pt-4 flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={handleBack} className="h-9 text-xs gap-1.5">
                <ArrowLeft className="w-3.5 h-3.5" /> Kembali
              </Button>
              <div className="flex items-center gap-2">
                <Button onClick={handleNext} className="h-9 text-xs gap-1.5 px-5 bg-sky-600 hover:bg-sky-700 text-white">
                  Lanjut ke Payment Gateway <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </CardFooter>
          </Card>
        )}

        {/* STEP 6: PAYMENT GATEWAY (OPSIONAL) */}
        {currentStep === 6 && (
          <Card className="border-border shadow-xs bg-white">
            <CardHeader className="border-b border-border/50 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold">Langkah 6: Payment Gateway Otomatis (Opsional)</CardTitle>
                    <CardDescription className="text-xs">
                      Dukungan QRIS Real-Time Dinamis & Bank Virtual Account untuk konfirmasi pembayaran otomatis 24/7.
                    </CardDescription>
                  </div>
                </div>
                <Badge variant="outline" className="border-slate-300 bg-slate-50 text-slate-700 text-xs">
                  Opsional
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="p-4 rounded-xl border border-border bg-slate-50/70 space-y-3">
                <h4 className="text-xs font-semibold text-foreground">Integrasi Payment Aggregator Indonesia</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  EugineBill mendukung berbagai saluran gerbang pembayaran resmi untuk otomatisasi lunas tagihan tanpa cek
                  mutasi manual:
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  <div className="p-2.5 rounded-lg border border-border bg-white text-center">
                    <div className="text-xs font-bold text-foreground">Midtrans</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">Snap / Core API</div>
                  </div>
                  <div className="p-2.5 rounded-lg border border-border bg-white text-center">
                    <div className="text-xs font-bold text-foreground">Tripay</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">QRIS & VA Murah</div>
                  </div>
                  <div className="p-2.5 rounded-lg border border-border bg-white text-center">
                    <div className="text-xs font-bold text-foreground">Duitku</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">VA & Gerai Retail</div>
                  </div>
                  <div className="p-2.5 rounded-lg border border-border bg-white text-center">
                    <div className="text-xs font-bold text-foreground">Xendit</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">Enterprise Gateway</div>
                  </div>
                </div>

                <div className="pt-2">
                  <Link href="/admin/payment-gateway" target="_blank">
                    <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 bg-white">
                      <ExternalLink className="w-3.5 h-3.5" /> Buka Pengaturan Payment Gateway
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Optional Section: Distribusi Fiber Optik */}
              <div className="p-4 rounded-xl border border-border bg-white space-y-2">
                <div className="flex items-center gap-2">
                  <Cable className="w-4 h-4 text-sky-600" />
                  <h4 className="text-xs font-semibold text-foreground">
                    Distribusi Fiber Optik (OLT / ODC / ODP) - Opsional
                  </h4>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Untuk billing dan internet berjalan, langkah ini bersifat opsional. Anda dapat memetakan OLT, ODC, dan
                  ODP kapan saja setelah go-live melalui menu Jaringan.
                </p>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Link href="/admin/network/olts" target="_blank">
                    <Button size="sm" variant="outline" className="h-7 text-xs border-border">
                      Manajemen OLT
                    </Button>
                  </Link>
                  <Link href="/admin/network/fiber-odcs" target="_blank">
                    <Button size="sm" variant="outline" className="h-7 text-xs border-border">
                      Data ODC
                    </Button>
                  </Link>
                  <Link href="/admin/network/fiber-odps" target="_blank">
                    <Button size="sm" variant="outline" className="h-7 text-xs border-border">
                      Data ODP
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
            <CardFooter className="border-t border-border/50 pt-4 flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={handleBack} className="h-9 text-xs gap-1.5">
                <ArrowLeft className="w-3.5 h-3.5" /> Kembali
              </Button>
              <Button onClick={handleNext} className="h-9 text-xs gap-1.5 px-5 bg-sky-600 hover:bg-sky-700 text-white">
                Selesaikan Setup & Lihat Ringkasan <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* STEP 7: SELESAI & RINGKASAN GO-LIVE */}
        {currentStep === 7 && (
          <Card className="border-border shadow-xs overflow-hidden bg-white">
            <div className="bg-gradient-to-r from-sky-600 to-indigo-700 p-8 text-white text-center space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center mx-auto border border-white/20 shadow-md">
                <Sparkles className="w-8 h-8 text-amber-300" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Selamat! Konfigurasi Awal Telah Rampung</h2>
              <p className="text-xs sm:text-sm text-sky-100 max-w-xl mx-auto leading-relaxed">
                Billing EugineBill Anda kini siap beroperasi melayani pendaftaran pelanggan, pemantauan status PPPoE, dan
                penagihan otomatis.
              </p>
            </div>

            <CardContent className="pt-6 space-y-6">
              {/* Summary Checklist Cards */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Rekapitulasi Modul Terkonfigurasi:
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-xl border border-border bg-slate-50/70 flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-semibold text-foreground">Identitas & Profil ISP</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {companyForm.name} ({companyForm.adminPhone})
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl border border-border bg-slate-50/70 flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-semibold text-foreground">Router MikroTik</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {routerForm.name} - IP: {routerForm.ipAddress} (Port {routerForm.port})
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl border border-border bg-slate-50/70 flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-semibold text-foreground">Paket Layanan PPPoE</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {profileForm.name} - Rp {parseInt(profileForm.price || '0').toLocaleString('id-ID')}/bulan
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl border border-border bg-slate-50/70 flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-semibold text-foreground">Pelanggan Percobaan</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        User: {customerForm.username} ({customerForm.name})
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl border border-border bg-slate-50/70 flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-semibold text-foreground">WhatsApp Bot Notifikasi</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {waConnected ? 'Mesin Baileys Aktif' : 'Tersedia di Menu Pengaturan'}
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl border border-border bg-slate-50/70 flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-semibold text-foreground">Infrastruktur & Gateway</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        Siap dipetakan (OLT / ODC / ODP & Pembayaran Otomatis)
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>

            <CardFooter className="border-t border-border/50 p-6 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50">
              <Button variant="outline" size="sm" onClick={() => setCurrentStep(1)} className="h-9 text-xs">
                Ulangi / Review Langkah
              </Button>
              <Button
                onClick={handleFinishWizard}
                className="h-10 text-xs px-6 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs"
              >
                Buka Dashboard Admin <ArrowRight className="w-4 h-4" />
              </Button>
            </CardFooter>
          </Card>
        )}
      </div>
    </div>
  );
}
