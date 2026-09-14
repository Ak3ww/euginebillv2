'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import {
  Copy,
  Download,
  CheckCircle,
  AlertCircle,
  Code,
  BookOpen,
  Server,
  Wifi,
  Shield,
  RefreshCw,
  Loader2,
  Radio,
  Layers,
  AlertTriangle,
  Cpu,
  Check,
  Globe,
} from 'lucide-react';
import { useToast } from '@/components/cyberpunk/CyberToast';
import { formatWIB } from '@/lib/timezone';
import { cn } from '@/lib/utils';

interface IsolationSettings {
  isolationIpPool: string;
  isolationServerIp: string;
  isolationRateLimit: string;
  baseUrl: string;
}

export default function MikroTikSetupPage() {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<IsolationSettings>({
    isolationIpPool: '192.168.200.0/24',
    isolationServerIp: '',
    isolationRateLimit: '64k/64k',
    baseUrl: '',
  });
  const [copied, setCopied] = useState<string | null>(null);

  // Mode & Version Switchers
  const [rosVersion, setRosVersion] = useState<'ros7' | 'ros6'>('ros7');
  const [authMode, setAuthMode] = useState<'local' | 'radius'>('local');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings/isolation');
      const data = await response.json();

      if (data.success) {
        setSettings({
          isolationIpPool: data.data.isolationIpPool || '192.168.200.0/24',
          isolationServerIp: data.data.isolationServerIp || '',
          isolationRateLimit: data.data.isolationRateLimit || '64k/64k',
          baseUrl: data.data.baseUrl || '',
        });
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    const fallbackCopy = (str: string): boolean => {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = str;
        textarea.style.position = 'fixed';
        textarea.style.top = '-9999px';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(textarea);
        return ok;
      } catch {
        return false;
      }
    };

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const ok = fallbackCopy(text);
        if (!ok) throw new Error('copy failed');
      }
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
      addToast({ type: 'success', title: 'Berhasil disalin!', description: 'Script berhasil disalin ke clipboard' });
    } catch {
      addToast({ type: 'error', title: 'Gagal menyalin!', description: 'Gagal menyalin ke clipboard. Coba pilih teks dan Ctrl+C.' });
    }
  };

  const downloadScript = (script: string, filename: string) => {
    const blob = new Blob([script], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Extract IP range from CIDR
  const getIpRange = (cidr: string) => {
    const [network] = cidr.split('/');
    const parts = network.split('.');
    parts[3] = '100';
    const start = parts.join('.');
    parts[3] = '200';
    const end = parts.join('.');
    return `${start}-${end}`;
  };

  // Gateway IP = first usable IP of the subnet (e.g. 192.168.200.1)
  const getGatewayIp = (cidr: string) => {
    const [network] = cidr.split('/');
    const parts = network.split('.');
    parts[3] = '1';
    return parts.join('.');
  };

  // Get server IP for NAT redirection
  const getServerIp = () => {
    if (settings.isolationServerIp) return settings.isolationServerIp;
    if (!settings.baseUrl) return 'IP_SERVER_ANDA';
    try {
      const url = new URL(settings.baseUrl);
      return url.hostname;
    } catch {
      return 'IP_SERVER_ANDA';
    }
  };

  // Script 1: IP Pool Isolir
  const ipPoolScript = `/ip pool
add name=pool-isolir ranges=${getIpRange(settings.isolationIpPool)} comment="EugineBill - IP Pool untuk user yang diisolir"`;

  // Script 2: PPP Profile Isolir
  const pppProfileScript = `/ppp profile
add name=isolir \\
    local-address=${getGatewayIp(settings.isolationIpPool)} \\
    remote-address=pool-isolir \\
    address-list=isolir \\
    rate-limit=${settings.isolationRateLimit} \\
    use-mpls=no use-compression=no use-encryption=no \\
    comment="EugineBill - Profile untuk user yang diisolir"`;

  // Script 2b (Only for RADIUS mode): RADIUS Incoming CoA
  const radiusCoaScript = `/radius incoming
set accept=yes port=3799`;

  // Script 3: Payment Gateways Address List
  const paymentGatewayScript = `/ip firewall address-list
# ============================================
# PAYMENT GATEWAY ADDRESS LIST
# RouterOS akan auto-resolve domain -> IP
# ============================================

# Midtrans / Snap
add list=payment-gateways address=api.midtrans.com comment="EugineBill - Midtrans API"
add list=payment-gateways address=app.midtrans.com comment="EugineBill - Midtrans Snap"
add list=payment-gateways address=app.sandbox.midtrans.com comment="EugineBill - Midtrans Sandbox"
add list=payment-gateways address=payment.midtrans.com comment="EugineBill - Midtrans Payment"
add list=payment-gateways address=assets.midtrans.com comment="EugineBill - Midtrans Assets"

# Xendit
add list=payment-gateways address=api.xendit.co comment="EugineBill - Xendit API"
add list=payment-gateways address=checkout.xendit.co comment="EugineBill - Xendit Checkout"
add list=payment-gateways address=dashboard.xendit.co comment="EugineBill - Xendit Dashboard"
add list=payment-gateways address=pay.xendit.co comment="EugineBill - Xendit Pay"

# Duitku
add list=payment-gateways address=passport.duitku.com comment="EugineBill - Duitku API"
add list=payment-gateways address=merchant.duitku.com comment="EugineBill - Duitku Merchant"
add list=payment-gateways address=sandbox.duitku.com comment="EugineBill - Duitku Sandbox"

# Tripay & iPaymu
add list=payment-gateways address=tripay.co.id comment="EugineBill - Tripay"
add list=payment-gateways address=payment.tripay.co.id comment="EugineBill - Tripay Payment"
add list=payment-gateways address=my.ipaymu.com comment="EugineBill - iPaymu"
add list=payment-gateways address=payment.ipaymu.com comment="EugineBill - iPaymu Payment"

# E-Wallet & Bank QRIS (QRIN, GoPay, DANA, OVO, ShopeePay)
add list=payment-gateways address=qrin.web.id comment="EugineBill - QRIN Web"
add list=payment-gateways address=api.qrin.web.id comment="EugineBill - QRIN API"
add list=payment-gateways address=qrin.id comment="EugineBill - QRIN Domain"
add list=payment-gateways address=api.gojek.com comment="EugineBill - Gojek API"
add list=payment-gateways address=gopay.co.id comment="EugineBill - GoPay"
add list=payment-gateways address=api.dana.id comment="EugineBill - DANA API"
add list=payment-gateways address=checkout.dana.id comment="EugineBill - DANA Checkout"
add list=payment-gateways address=api.ovo.id comment="EugineBill - OVO API"
add list=payment-gateways address=open-api.airpay.co.id comment="EugineBill - ShopeePay"
add list=payment-gateways address=qris.id comment="EugineBill - QRIS Hub"`;

  // Script 4: Firewall Filter
  const firewallFilterScript = `/ip firewall filter
# Letakkan rule-rule ini SEBELUM rule DROP forward traffic yang ada!
# Gunakan: /ip firewall filter move [find comment~"EugineBill - Allow"] destination=0

# [1] Allow return traffic established & related
add chain=forward src-address-list=isolir connection-state=established,related action=accept comment="EugineBill - Allow established/related isolir"
add chain=forward dst-address-list=isolir connection-state=established,related action=accept comment="EugineBill - Allow return traffic isolir"

# [2] Allow DNS untuk pelanggan isolir
add chain=forward src-address-list=isolir protocol=udp dst-port=53 action=accept comment="EugineBill - Allow DNS isolir"
add chain=forward src-address-list=isolir protocol=tcp dst-port=53 action=accept comment="EugineBill - Allow DNS TCP isolir"

# [3] Allow ICMP (Ping)
add chain=forward src-address-list=isolir protocol=icmp action=accept comment="EugineBill - Allow ping isolir"

# [4] Allow Akses ke Billing Server (Landing Page Isolir & Invoice)
add chain=forward src-address-list=isolir dst-address=${getServerIp()} action=accept comment="EugineBill - Allow billing server access"

# [5] Allow Akses ke Payment Gateway
add chain=forward src-address-list=isolir dst-address-list=payment-gateways action=accept comment="EugineBill - Allow payment gateway access"

# [6] Drop semua trafik internet lainnya untuk user isolir
add chain=forward src-address-list=isolir action=drop comment="EugineBill - Drop other internet traffic for isolir"`;

  // Script 5: Firewall NAT Redirect
  const firewallNatScript = `/ip firewall nat
# Redirect HTTP (Port 80) ke server billing
add chain=dstnat src-address-list=isolir protocol=tcp dst-port=80 dst-address=!${getServerIp()} dst-address-list=!payment-gateways action=dst-nat to-addresses=${getServerIp()} to-ports=80 comment="EugineBill - Redirect HTTP to isolation landing page"

# Redirect HTTPS (Port 443) ke server billing
add chain=dstnat src-address-list=isolir protocol=tcp dst-port=443 dst-address=!${getServerIp()} dst-address-list=!payment-gateways action=dst-nat to-addresses=${getServerIp()} to-ports=443 comment="EugineBill - Redirect HTTPS to isolation landing page"`;

  // Complete Consolidated Script
  const completeScript = `# ==============================================================================
# EUGINEBILL RADIUS - MIKROTIK ISOLATION SYSTEM SETUP
# Mode: ${authMode === 'radius' ? 'RADIUS Server Mode (CoA Active)' : 'Local Auth Mode (MikroTik API)'}
# Target OS: ${rosVersion === 'ros7' ? 'RouterOS v7' : 'RouterOS v6'}
# Dibuat: ${formatWIB(new Date())}
# ==============================================================================
# PENTING:
# 1. Pastikan IP Server (${getServerIp()}) adalah IP Public/VPN server Anda.
# 2. Firewall MikroTik menggunakan IP Address, bukan nama domain.
# ==============================================================================

# 1. IP POOL ISOLIR
${ipPoolScript}

# 2. PPP PROFILE ISOLIR
${pppProfileScript}
${authMode === 'radius' ? `\n# 2b. RADIUS INCOMING (COA / DISCONNECT)\n${radiusCoaScript}` : ''}
# 3. PAYMENT GATEWAYS WHITELIST
${paymentGatewayScript}

# 4. FIREWALL FILTER RULES
${firewallFilterScript}

# 5. FIREWALL NAT REDIRECT RULES
${firewallNatScript}

# ==============================================================================
# SETUP SELESAI!
# ==============================================================================
# Pelanggan isolir akan otomatis masuk ke address-list 'isolir'.
# Akses internet diputus kecuali DNS, Billing Server (${getServerIp()}), dan Payment Gateway.`;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
          <Server className="w-6 h-6 text-primary" />
          {t('isolation.mikrotikTitle')}
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          {t('isolation.mikrotikSubtitle')}
        </p>
      </div>

      {/* Info Banner */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div className="text-xs text-foreground space-y-1">
          <p className="font-semibold text-sm">{t('isolation.autoScriptBanner')}</p>
          <p className="text-muted-foreground leading-relaxed">
            Skrip ini mengonfigurasi IP pool isolir, profil PPP rate limit, whitelist payment gateway, dan aturan redirect firewall agar pelanggan terisolir dapat melakukan pembayaran mandiri.
          </p>
        </div>
      </div>

      {/* Server IP Warning if Empty */}
      {!settings.isolationServerIp && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-xs text-foreground space-y-1">
            <h3 className="font-bold text-sm text-amber-600 dark:text-amber-400">
              IP Server Belum Dikonfigurasi
            </h3>
            <p className="text-muted-foreground">
              Firewall MikroTik <strong>hanya mendukung IP address</strong> (bukan hostname domain).
              Saat ini skrip menggunakan fallback: <code className="bg-muted px-1.5 py-0.5 rounded font-mono font-bold text-primary">{getServerIp()}</code>.
            </p>
            <p className="text-muted-foreground pt-1">
              Silakan atur <strong>"IP Server (untuk MikroTik NAT)"</strong> di menu <a href="/admin/settings/isolation" className="text-primary underline font-medium">Pengaturan Isolasi</a> untuk hasil optimal.
            </p>
          </div>
        </div>
      )}

      {/* Interactive Switchers: RouterOS Version & Auth Mode */}
      <div className="bg-card rounded-xl border border-border p-4 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* RouterOS Version Toggle */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-primary" /> Versi RouterOS MikroTik
            </label>
            <div className="inline-flex rounded-lg border border-border p-1 bg-muted/40">
              <button
                onClick={() => setRosVersion('ros7')}
                className={cn(
                  'px-3 py-1.5 text-xs font-semibold rounded-md transition-all',
                  rosVersion === 'ros7'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                RouterOS v7 (Modern)
              </button>
              <button
                onClick={() => setRosVersion('ros6')}
                className={cn(
                  'px-3 py-1.5 text-xs font-semibold rounded-md transition-all',
                  rosVersion === 'ros6'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                RouterOS v6 (Legacy)
              </button>
            </div>
          </div>

          {/* Auth Mode Toggle */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Radio className="w-4 h-4 text-primary" /> Mode Autentikasi Pelanggan
            </label>
            <div className="inline-flex rounded-lg border border-border p-1 bg-muted/40">
              <button
                onClick={() => setAuthMode('local')}
                className={cn(
                  'px-3 py-1.5 text-xs font-semibold rounded-md transition-all',
                  authMode === 'local'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Local Auth Mode (MikroTik API)
              </button>
              <button
                onClick={() => setAuthMode('radius')}
                className={cn(
                  'px-3 py-1.5 text-xs font-semibold rounded-md transition-all',
                  authMode === 'radius'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                RADIUS Server Mode (FreeRADIUS)
              </button>
            </div>
          </div>
        </div>

        <div className="text-[11px] text-muted-foreground border-t border-border pt-3 flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-primary shrink-0" />
          <span>
            {authMode === 'local'
              ? 'Local Auth Mode: EugineBill memindahkan profil PPPoE secret ke "isolir" via API dan men-disconnect sesi aktif.'
              : 'RADIUS Server Mode: FreeRADIUS mengembalikan attribute "Filter-Id=isolir" / "Mikrotik-Address-List=isolir" dan mengirim CoA Disconnect ke port 3799.'}
          </span>
        </div>
      </div>

      {/* Settings Grid & Quick Actions */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Current Settings Summary */}
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <h3 className="font-semibold text-sm text-foreground flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-primary" />
            {t('isolation.currentSettings')}
          </h3>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-2.5 rounded-lg bg-muted/30 border border-border/50">
              <span className="text-muted-foreground block mb-0.5">IP Pool:</span>
              <span className="font-mono font-semibold text-foreground">{settings.isolationIpPool}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-muted/30 border border-border/50">
              <span className="text-muted-foreground block mb-0.5">Server IP (NAT):</span>
              <span className={`font-mono font-semibold ${settings.isolationServerIp ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-500'}`}>
                {settings.isolationServerIp || 'Belum Diset'}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-muted/30 border border-border/50">
              <span className="text-muted-foreground block mb-0.5">Rate Limit:</span>
              <span className="font-mono font-semibold text-foreground">{settings.isolationRateLimit}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-muted/30 border border-border/50">
              <span className="text-muted-foreground block mb-0.5">Base URL:</span>
              <span className="font-mono font-semibold text-primary truncate block">{settings.baseUrl || '-'}</span>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-card rounded-xl border border-border p-4 flex flex-col justify-between space-y-3">
          <div>
            <h3 className="font-semibold text-sm text-foreground mb-1">{t('isolation.quickActions')}</h3>
            <p className="text-xs text-muted-foreground">
              Salin seluruh skrip gabungan ({rosVersion.toUpperCase()} · {authMode === 'radius' ? 'RADIUS' : 'Local'}) atau download file .rsc untuk di-import langsung di Winbox.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              onClick={() => copyToClipboard(completeScript, 'complete')}
              className="flex items-center justify-center gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold py-2 px-3 rounded-lg shadow-xs transition-colors"
            >
              {copied === 'complete' ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copied === 'complete' ? 'Tersalin!' : 'Salin Seluruh Script'}</span>
            </button>
            <button
              onClick={() => downloadScript(completeScript, `isolir-${rosVersion}-${authMode}.rsc`)}
              className="flex items-center justify-center gap-1.5 bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold py-2 px-3 rounded-lg border border-border transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Download File .RSC</span>
            </button>
          </div>
        </div>
      </div>

      {/* Script Breakdown Cards */}
      <div className="space-y-4">
        {/* Step 1: IP Pool */}
        <ScriptCard
          stepNumber="01"
          title="1. Buat IP Pool Isolir"
          description="Alokasi pool IP khusus bagi pelanggan yang dialihkan ke masa isolir."
          script={ipPoolScript}
          copied={copied === 'pool'}
          onCopy={() => copyToClipboard(ipPoolScript, 'pool')}
          onDownload={() => downloadScript(ipPoolScript, '01-ip-pool.rsc')}
        />

        {/* Step 2: PPP Profile */}
        <ScriptCard
          stepNumber="02"
          title="2. Buat PPP Profile Isolir"
          description="Profil PPPoE dengan limitasi bandwidth ketat dan otomatis memasukkan IP ke address-list 'isolir'."
          script={pppProfileScript}
          copied={copied === 'profile'}
          onCopy={() => copyToClipboard(pppProfileScript, 'profile')}
          onDownload={() => downloadScript(pppProfileScript, '02-ppp-profile.rsc')}
        />

        {/* Step 2b: RADIUS Incoming CoA (if RADIUS Mode) */}
        {authMode === 'radius' && (
          <ScriptCard
            stepNumber="02b"
            title="2b. Aktifkan RADIUS Incoming (CoA / Disconnect)"
            description="Wajib untuk mode RADIUS agar server dapat memutus atau mengubah profil pelanggan secara real-time."
            script={radiusCoaScript}
            copied={copied === 'coa'}
            onCopy={() => copyToClipboard(radiusCoaScript, 'coa')}
            onDownload={() => downloadScript(radiusCoaScript, '02b-radius-coa.rsc')}
          />
        )}

        {/* Step 3: Payment Gateways Whitelist */}
        <ScriptCard
          stepNumber="03"
          title="3. Whitelist Payment Gateway"
          description="Daftar domain payment gateway (Midtrans, Xendit, Duitku, QRIN, dsb.) agar invoice dapat dibayar pelanggan."
          script={paymentGatewayScript}
          copied={copied === 'whitelist'}
          onCopy={() => copyToClipboard(paymentGatewayScript, 'whitelist')}
          onDownload={() => downloadScript(paymentGatewayScript, '03-payment-whitelist.rsc')}
        />

        {/* Step 4: Firewall Filter */}
        <ScriptCard
          stepNumber="04"
          title="4. Firewall Filter Rules"
          description="Mengizinkan hanya DNS, Ping, Billing Server, dan Payment Gateway; memblokir seluruh trafik internet lainnya."
          script={firewallFilterScript}
          copied={copied === 'filter'}
          onCopy={() => copyToClipboard(firewallFilterScript, 'filter')}
          onDownload={() => downloadScript(firewallFilterScript, '04-firewall-filter.rsc')}
        />

        {/* Step 5: Firewall NAT Redirect */}
        <ScriptCard
          stepNumber="05"
          title="5. Firewall NAT Redirect Rules"
          description="Mengalihkan request HTTP (port 80) dan HTTPS (port 443) pelanggan isolir langsung ke halaman penagihan."
          script={firewallNatScript}
          copied={copied === 'nat'}
          onCopy={() => copyToClipboard(firewallNatScript, 'nat')}
          onDownload={() => downloadScript(firewallNatScript, '05-firewall-nat.rsc')}
        />
      </div>

      {/* Execution Instructions */}
      <div className="bg-card rounded-xl border border-border p-5 space-y-4">
        <h2 className="text-base font-bold text-foreground flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary" />
          Cara Eksekusi di Winbox / Terminal MikroTik
        </h2>

        <div className="grid sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 bg-muted/30 border border-border rounded-lg space-y-1.5">
            <span className="font-bold text-foreground block">Langkah 1: Hubungkan Winbox</span>
            <p className="text-muted-foreground">Buka Winbox, connect ke router MikroTik klien dengan akun admin berhak write/full.</p>
          </div>
          <div className="p-3 bg-muted/30 border border-border rounded-lg space-y-1.5">
            <span className="font-bold text-foreground block">Langkah 2: Buka New Terminal</span>
            <p className="text-muted-foreground">Klik tombol "Salin Seluruh Script" di atas, lalu paste (Ctrl+V) langsung ke jendela New Terminal Winbox.</p>
          </div>
          <div className="p-3 bg-muted/30 border border-border rounded-lg space-y-1.5">
            <span className="font-bold text-foreground block">Langkah 3: Atur Urutan Filter</span>
            <p className="text-muted-foreground">Pastikan rule filter isolir ditaruh di atas sebelum rule Drop Internet global di IP &gt; Firewall &gt; Filter.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ScriptCardProps {
  stepNumber: string;
  title: string;
  description: string;
  script: string;
  copied: boolean;
  onCopy: () => void;
  onDownload: () => void;
}

function ScriptCard({ stepNumber, title, description, script, copied, onCopy, onDownload }: ScriptCardProps) {
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden shadow-xs">
      <div className="p-4 border-b border-border flex items-center justify-between gap-3 bg-muted/20">
        <div>
          <h3 className="font-semibold text-sm text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onCopy}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-background hover:bg-muted text-foreground text-xs font-medium rounded-lg border border-border transition-colors"
            title="Salin script"
          >
            {copied ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
            <span>{copied ? 'Tersalin' : 'Salin'}</span>
          </button>
          <button
            onClick={onDownload}
            className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg border border-border transition-colors"
            title="Download script"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="p-4 bg-muted/40">
        <pre className="text-xs font-mono text-foreground overflow-x-auto whitespace-pre-wrap break-all select-all">
          {script}
        </pre>
      </div>
    </div>
  );
}
