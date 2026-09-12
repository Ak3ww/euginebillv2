'use client';

import { useState, useEffect } from 'react';
import {
  Globe,
  Copy,
  Check,
  Server,
  BookOpen,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Laptop,
  CheckCircle2,
  Layers,
  Terminal,
  Cpu,
  Zap,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface AcsGuideCardProps {
  initialHost?: string;
}

export default function AcsGuideCard({ initialHost }: AcsGuideCardProps) {
  const [acsUrl, setAcsUrl] = useState<string>('http://domain-anda.com/api/cwmp');
  const [copiedAcs, setCopiedAcs] = useState<boolean>(false);
  const [copiedMikrotik, setCopiedMikrotik] = useState<boolean>(false);
  const [copiedOlt, setCopiedOlt] = useState<boolean>(false);
  const [showFullGuide, setShowFullGuide] = useState<boolean>(false);
  const [mainStep, setMainStep] = useState<'mikrotik' | 'olt' | 'ont'>('mikrotik');
  const [ontTab, setOntTab] = useState<'zte' | 'huawei' | 'fiberhome' | 'vsol'>('zte');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const origin = window.location.origin;
      setAcsUrl(`${origin}/api/cwmp`);
    } else if (initialHost) {
      setAcsUrl(`http://${initialHost}/api/cwmp`);
    }
  }, [initialHost]);

  const handleCopyAcs = async () => {
    try {
      await navigator.clipboard.writeText(acsUrl);
      setCopiedAcs(true);
      setTimeout(() => setCopiedAcs(false), 2000);
    } catch (err) {
      console.error('Failed to copy ACS URL:', err);
    }
  };

  const mikrotikScript = `# ==============================================================================
# AKTIVASI DEDICATED VLAN TR-069 ACS DI MIKROTIK
# Jalankan di: Winbox -> New Terminal
# ==============================================================================
/interface vlan
add comment="VLAN4000-TR069-ACS" interface=bridge-LAN name=vlan4000-tr069 vlan-id=4000

/ip address
add address=10.40.10.1/24 comment="IP-GATEWAY-TR069-ACS" interface=vlan4000-tr069 network=10.40.10.0

/ip pool
add comment="POOL-DHCP-TR069" name=dhcp_pool_tr069 ranges=10.40.10.2-10.40.11.254

/ip dhcp-server
add address-pool=dhcp_pool_tr069 comment="DHCP-SERVER-TR069" disabled=no interface=vlan4000-tr069 name=dhcp-tr069

/ip dhcp-server network
add address=10.40.10.0/24 comment="NET-TR069-ACS" dns-server=1.1.1.1,8.8.8.8 gateway=10.40.10.1`;

  const oltScript = `! ==============================================================================
! AKTIVASI VLAN 4000 TR-069 PADA OLT VSOL V1600GS
! Jalankan di: Telnet / SSH / Serial Console OLT
! ==============================================================================
enable
config
vlan 4000
description VLAN4000-TR069
exit

interface gigabitEthernet 0/1
switchport hybrid vlan 4000 tagged
exit

interface gigabitEthernet 0/2
switchport hybrid vlan 4000 tagged
exit

interface gigabitEthernet 0/3
switchport hybrid vlan 4000 tagged
exit

write`;

  const handleCopyMikrotik = async () => {
    try {
      await navigator.clipboard.writeText(mikrotikScript);
      setCopiedMikrotik(true);
      setTimeout(() => setCopiedMikrotik(false), 2000);
    } catch (err) {
      console.error('Failed to copy MikroTik script:', err);
    }
  };

  const handleCopyOlt = async () => {
    try {
      await navigator.clipboard.writeText(oltScript);
      setCopiedOlt(true);
      setTimeout(() => setCopiedOlt(false), 2000);
    } catch (err) {
      console.error('Failed to copy OLT script:', err);
    }
  };

  return (
    <Card className="border border-border bg-card shadow-sm">
      <CardContent className="p-5 space-y-4">
        {/* Banner Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center justify-center p-1.5 rounded-md bg-primary/10 text-primary">
                <Server className="w-5 h-5" />
              </span>
              <h2 className="text-base font-semibold text-foreground">
                Built-in TR-069 ACS (Bukan GenieACS)
              </h2>
              <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-medium">
                Otomatis Aktif di VPS
              </Badge>
              <Badge variant="secondary" className="text-xs">
                Zero Docker / Zero Mongo
              </Badge>
              <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-600 border-blue-500/20">
                VLAN 4000 & In-Band Ready
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-3xl">
              Engine TR-069 CWMP terintegrasi langsung di dalam EugineBill. Skrip bawaan OLT dan MikroTik dibuat seringan mungkin (ultra-lean). Jika Anda ingin mengaktifkan manajemen jarak jauh TR-069 via VLAN 4000, salin skrip siap pakai di bawah ini.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant={showFullGuide ? "default" : "outline"}
              size="sm"
              onClick={() => setShowFullGuide(!showFullGuide)}
              className="text-xs gap-1.5 h-9"
            >
              <BookOpen className="w-4 h-4" />
              <span>{showFullGuide ? 'Tutup Panduan' : 'Buka Panduan Setup TR-069'}</span>
              {showFullGuide ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </Button>
            <a
              href="/docs/mikrotik/BUILTIN_TR069_ACS_SETUP_GUIDE.md"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 h-9 bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground text-xs font-medium rounded-md border border-border transition-colors"
            >
              <span>Dokumentasi GitHub</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* ACS URL Box */}
        <div className="rounded-lg border border-border bg-muted/40 p-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-primary" />
                URL ACS EugineBill (Masukkan ke Pengaturan TR-069 Modem)
              </span>
              <div className="flex items-center gap-2">
                <code className="text-xs sm:text-sm font-mono font-semibold text-primary bg-background px-2.5 py-1 rounded border border-border select-all">
                  {acsUrl}
                </code>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant={copiedAcs ? "default" : "secondary"}
                size="sm"
                onClick={handleCopyAcs}
                className="text-xs gap-1.5 h-8 font-medium"
              >
                {copiedAcs ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-white" />
                    <span>Tersalin ke Clipboard</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Salin URL ACS</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mt-3 pt-3 border-t border-border/60 text-xs text-muted-foreground">
            <div>
              <span className="font-medium text-foreground">Endpoint:</span>{' '}
              <span className="font-mono">/api/cwmp</span>
            </div>
            <div>
              <span className="font-medium text-foreground">VLAN Rekomendasi:</span> VLAN 4000 (DHCP)
            </div>
            <div>
              <span className="font-medium text-foreground">Username / Password:</span>{' '}
              <span className="italic">Kosongkan (Default)</span>
            </div>
            <div>
              <span className="font-medium text-foreground">Periodic Inform:</span> 300 detik (5 menit)
            </div>
          </div>
        </div>

        {/* Expandable Step-by-Step Setup Guide */}
        {showFullGuide && (
          <div className="pt-2 border-t border-border space-y-4 animate-in fade-in-50 duration-200">
            {/* Step Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-border pb-3 flex-wrap">
              <button
                type="button"
                onClick={() => setMainStep('mikrotik')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${
                  mainStep === 'mikrotik'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                <Terminal className="w-4 h-4" />
                <span>Langkah 1: Setup MikroTik (VLAN 4000)</span>
              </button>

              <button
                type="button"
                onClick={() => setMainStep('olt')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${
                  mainStep === 'olt'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>Langkah 2: Setup OLT VSOL (VLAN 4000)</span>
              </button>

              <button
                type="button"
                onClick={() => setMainStep('ont')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${
                  mainStep === 'ont'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                <Laptop className="w-4 h-4" />
                <span>Langkah 3: Setting Modem ONT Pelanggan</span>
              </button>
            </div>

            {/* STEP 1: MIKROTIK */}
            {mainStep === 'mikrotik' && (
              <div className="bg-background border border-border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Terminal className="w-4 h-4 text-primary" />
                      Skrip Terminal Winbox MikroTik (VLAN 4000 & DHCP Server)
                    </h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Buka Winbox &rarr; klik <strong>New Terminal</strong> &rarr; paste skrip berikut.
                    </p>
                  </div>

                  <Button
                    variant={copiedMikrotik ? "default" : "outline"}
                    size="sm"
                    onClick={handleCopyMikrotik}
                    className="text-xs gap-1.5 h-8 font-medium"
                  >
                    {copiedMikrotik ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-white" />
                        <span>Script Tersalin!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Salin Script MikroTik</span>
                      </>
                    )}
                  </Button>
                </div>

                <div className="relative">
                  <pre className="bg-muted/60 text-foreground font-mono text-[11px] p-3 rounded-lg border border-border overflow-x-auto leading-relaxed">
                    {mikrotikScript}
                  </pre>
                </div>

                <div className="text-[11px] text-muted-foreground bg-muted/20 p-2.5 rounded border border-border/50">
                  <strong>Catatan Teknis:</strong> Subnet <code className="text-foreground font-mono">10.40.10.0/24</code> akan otomatis membagikan IP dinamis ke modem pelanggan pada VLAN 4000 sehingga modem langsung dapat mengakses endpoint ACS EugineBill.
                </div>
              </div>
            )}

            {/* STEP 2: OLT */}
            {mainStep === 'olt' && (
              <div className="bg-background border border-border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-primary" />
                      Perintah CLI OLT VSOL V1600GS (Tagging VLAN 4000 ke Uplink)
                    </h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Akses OLT via Telnet / SSH / Serial Console lalu jalankan baris perintah ini.
                    </p>
                  </div>

                  <Button
                    variant={copiedOlt ? "default" : "outline"}
                    size="sm"
                    onClick={handleCopyOlt}
                    className="text-xs gap-1.5 h-8 font-medium"
                  >
                    {copiedOlt ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-white" />
                        <span>Perintah CLI Tersalin!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Salin CLI OLT</span>
                      </>
                    )}
                  </Button>
                </div>

                <div className="relative">
                  <pre className="bg-muted/60 text-foreground font-mono text-[11px] p-3 rounded-lg border border-border overflow-x-auto leading-relaxed">
                    {oltScript}
                  </pre>
                </div>

                <div className="text-[11px] text-muted-foreground bg-muted/20 p-2.5 rounded border border-border/50">
                  <strong>Catatan OLT:</strong> Perintah di atas menambahkan VLAN 4000 ke database OLT dan menandai port uplink GE 0/1, 0/2, 0/3 sebagai tagged agar paket TR-069 dari PON dapat diteruskan ke MikroTik.
                </div>
              </div>
            )}

            {/* STEP 3: ONT MODEM */}
            {mainStep === 'ont' && (
              <div className="bg-background border border-border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-border">
                  <div>
                    <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Laptop className="w-4 h-4 text-primary" />
                      Panduan Setting di Modem ONT Pelanggan
                    </h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Pilih merk modem pelanggan untuk melihat langkah konfigurasi.
                    </p>
                  </div>

                  <div className="inline-flex rounded-md border border-border p-0.5 bg-muted/30">
                    <button
                      type="button"
                      onClick={() => setOntTab('zte')}
                      className={`px-3 py-1 text-xs font-medium rounded-sm transition-colors ${
                        ontTab === 'zte'
                          ? 'bg-primary text-primary-foreground shadow-xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      ZTE (F609/F670L)
                    </button>
                    <button
                      type="button"
                      onClick={() => setOntTab('huawei')}
                      className={`px-3 py-1 text-xs font-medium rounded-sm transition-colors ${
                        ontTab === 'huawei'
                          ? 'bg-primary text-primary-foreground shadow-xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Huawei (HG8245H/EG8145)
                    </button>
                    <button
                      type="button"
                      onClick={() => setOntTab('fiberhome')}
                      className={`px-3 py-1 text-xs font-medium rounded-sm transition-colors ${
                        ontTab === 'fiberhome'
                          ? 'bg-primary text-primary-foreground shadow-xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Fiberhome (HG6243/6245)
                    </button>
                    <button
                      type="button"
                      onClick={() => setOntTab('vsol')}
                      className={`px-3 py-1 text-xs font-medium rounded-sm transition-colors ${
                        ontTab === 'vsol'
                          ? 'bg-primary text-primary-foreground shadow-xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      VSOL / Generic XPON
                    </button>
                  </div>
                </div>

                {/* ZTE */}
                {ontTab === 'zte' && (
                  <div className="space-y-2.5 text-xs text-foreground leading-relaxed">
                    <div className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      Konfigurasi ONT ZTE (F609, F670L, F660):
                    </div>
                    <ol className="list-decimal pl-5 space-y-1.5 text-muted-foreground">
                      <li>
                        Buka web admin ONT ZTE (biasanya <code className="font-mono text-foreground">192.168.1.1</code>).
                      </li>
                      <li>
                        <strong>Metode A (Dedicated VLAN 4000):</strong> Buka menu <strong className="text-foreground">Network</strong> &rarr; <strong className="text-foreground">WAN</strong> &rarr; <strong className="text-foreground">WAN Connection</strong>. Buat koneksi baru mode <strong className="text-foreground">IPoE / DHCP</strong>, VLAN ID <code className="font-mono text-foreground font-semibold">4000</code>, Service Type: <code className="font-mono text-foreground font-semibold">TR069</code>.
                      </li>
                      <li>
                        <strong>Metode B (In-Band PPPoE):</strong> Pada koneksi PPPoE yang aktif, cukup ubah <strong className="text-foreground">Service List</strong> menjadi <code className="font-mono text-foreground font-semibold">INTERNET_TR069</code> lalu klik Modify.
                      </li>
                      <li>
                        Buka menu <strong className="text-foreground">Administration</strong> &rarr; <strong className="text-foreground">TR-069</strong>.
                      </li>
                      <li>
                        Centang <strong className="text-foreground">Enable CWMP</strong>.
                      </li>
                      <li>
                        Pada kolom <strong className="text-foreground">ACS URL</strong>, masukkan:{' '}
                        <code className="font-mono text-primary font-semibold bg-muted px-1.5 py-0.5 rounded border border-border select-all">
                          {acsUrl}
                        </code>
                      </li>
                      <li>
                        Username dan Password ACS dapat dikosongkan (default).
                      </li>
                      <li>
                        Centang <strong className="text-foreground">Enable Periodic Inform</strong> dan set interval ke <strong className="text-foreground">300</strong> detik.
                      </li>
                      <li>
                        Klik <strong className="text-foreground">Submit</strong>. Modem akan segera muncul di tabel perangkat ACS dalam 1-2 menit.
                      </li>
                    </ol>
                  </div>
                )}

                {/* HUAWEI */}
                {ontTab === 'huawei' && (
                  <div className="space-y-2.5 text-xs text-foreground leading-relaxed">
                    <div className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      Konfigurasi ONT Huawei (HG8245H, HG8245A, EG8145V5):
                    </div>
                    <ol className="list-decimal pl-5 space-y-1.5 text-muted-foreground">
                      <li>
                        Buka web ONT Huawei (<code className="font-mono text-foreground">192.168.100.1</code> / <code className="font-mono text-foreground">192.168.18.1</code>).
                      </li>
                      <li>
                        <strong>Metode A (VLAN 4000):</strong> Masuk ke tab <strong className="text-foreground">WAN</strong> &rarr; <strong className="text-foreground">WAN Configuration</strong> &rarr; buat profil WAN baru IPoE / DHCP dengan VLAN <code className="font-mono text-foreground font-semibold">4000</code> dan Service Type <code className="font-mono text-foreground font-semibold">TR069</code>.
                      </li>
                      <li>
                        <strong>Metode B (In-Band):</strong> Pada profil PPPoE, ubah Service Type menjadi <code className="font-mono text-foreground font-semibold">INTERNET, TR069</code>.
                      </li>
                      <li>
                        Buka tab <strong className="text-foreground">System Tools</strong> &rarr; <strong className="text-foreground">TR-069</strong>.
                      </li>
                      <li>
                        Centang <strong className="text-foreground">Enable TR-069</strong>.
                      </li>
                      <li>
                        Isi <strong className="text-foreground">URL</strong> dengan:{' '}
                        <code className="font-mono text-primary font-semibold bg-muted px-1.5 py-0.5 rounded border border-border select-all">
                          {acsUrl}
                        </code>
                      </li>
                      <li>
                        Centang <strong className="text-foreground">Periodic Inform</strong> interval <strong className="text-foreground">300</strong> detik lalu klik <strong className="text-foreground">Apply</strong>.
                      </li>
                    </ol>
                  </div>
                )}

                {/* FIBERHOME */}
                {ontTab === 'fiberhome' && (
                  <div className="space-y-2.5 text-xs text-foreground leading-relaxed">
                    <div className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      Konfigurasi ONT Fiberhome (HG6243C, HG6245D):
                    </div>
                    <ol className="list-decimal pl-5 space-y-1.5 text-muted-foreground">
                      <li>
                        Buka web ONT Fiberhome (<code className="font-mono text-foreground">192.168.1.1</code>).
                      </li>
                      <li>
                        Buka <strong className="text-foreground">Network</strong> &rarr; <strong className="text-foreground">Broadband Settings</strong> &rarr; <strong className="text-foreground">Internet Settings</strong>.
                      </li>
                      <li>
                        Tambahkan WAN VLAN 4000 DHCP mode TR069, atau ubah Service List PPPoE ke <code className="font-mono text-foreground font-semibold">INTERNET,TR069</code>.
                      </li>
                      <li>
                        Buka <strong className="text-foreground">Management</strong> &rarr; <strong className="text-foreground">TR-069</strong>.
                      </li>
                      <li>
                        Set <strong className="text-foreground">CWMP Enable</strong> ke <strong className="text-foreground">Yes</strong>.
                      </li>
                      <li>
                        Isi <strong className="text-foreground">URL</strong> dengan:{' '}
                        <code className="font-mono text-primary font-semibold bg-muted px-1.5 py-0.5 rounded border border-border select-all">
                          {acsUrl}
                        </code>
                      </li>
                      <li>
                        Aktifkan Periodic Inform interval 300 detik, klik <strong className="text-foreground">Apply</strong>.
                      </li>
                    </ol>
                  </div>
                )}

                {/* VSOL */}
                {ontTab === 'vsol' && (
                  <div className="space-y-2.5 text-xs text-foreground leading-relaxed">
                    <div className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      Konfigurasi ONT VSOL / XPON Generic:
                    </div>
                    <ol className="list-decimal pl-5 space-y-1.5 text-muted-foreground">
                      <li>
                        Buka web ONT VSOL (<code className="font-mono text-foreground">192.168.1.1</code>).
                      </li>
                      <li>
                        Buka menu <strong className="text-foreground">Network</strong> &rarr; <strong className="text-foreground">WAN Settings</strong> &rarr; buat WAN VLAN 4000 DHCP atau atur Service Mode PPPoE ke <code className="font-mono text-foreground font-semibold">INTERNET,TR069</code>.
                      </li>
                      <li>
                        Buka menu <strong className="text-foreground">Management</strong> &rarr; <strong className="text-foreground">TR069 Config</strong>.
                      </li>
                      <li>
                        Aktifkan <strong className="text-foreground">TR069 Enable</strong>.
                      </li>
                      <li>
                        Masukkan <strong className="text-foreground">ACS Server URL</strong>:{' '}
                        <code className="font-mono text-primary font-semibold bg-muted px-1.5 py-0.5 rounded border border-border select-all">
                          {acsUrl}
                        </code>
                      </li>
                      <li>
                        Centang Periodic Inform interval 300 detik, lalu klik <strong className="text-foreground">Apply</strong>.
                      </li>
                    </ol>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
