'use client';

import { useState, useEffect } from 'react';
import {
  Wifi,
  Globe,
  Copy,
  Check,
  Server,
  BookOpen,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  ShieldCheck,
  Info,
  Laptop,
  CheckCircle2,
  Cpu,
  Layers,
  Sparkles,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface AcsGuideCardProps {
  initialHost?: string;
}

export default function AcsGuideCard({ initialHost }: AcsGuideCardProps) {
  const [acsUrl, setAcsUrl] = useState<string>('http://domain-anda.com/api/cwmp');
  const [copied, setCopied] = useState<boolean>(false);
  const [showFullGuide, setShowFullGuide] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'zte' | 'huawei' | 'fiberhome' | 'vsol'>('zte');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const origin = window.location.origin;
      setAcsUrl(`${origin}/api/cwmp`);
    } else if (initialHost) {
      setAcsUrl(`http://${initialHost}/api/cwmp`);
    }
  }, [initialHost]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(acsUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy ACS URL:', err);
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
                Panduan Integrasi Built-in TR-069 ACS
              </h2>
              <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-medium">
                Native Next.js Engine
              </Badge>
              <Badge variant="secondary" className="text-xs">
                Bukan GenieACS
              </Badge>
              <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-600 border-blue-500/20">
                In-Band PPPoE
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-3xl">
              EugineBill mengusung Built-in TR-069 CWMP Server bawaan. ONT/CPE pelanggan langsung terhubung melalui koneksi WAN PPPoE eksisting tanpa perlu docker GenieACS, MongoDB, atau konfigurasi VLAN TR-069 terpisah (VLAN 4000).
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFullGuide(!showFullGuide)}
              className="text-xs gap-1.5 h-9"
            >
              <BookOpen className="w-4 h-4 text-primary" />
              <span>{showFullGuide ? 'Tutup Panduan' : 'Panduan Setting ONT'}</span>
              {showFullGuide ? (
                <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
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
                URL ACS EugineBill (Masukkan ke Menu TR-069 Modem)
              </span>
              <div className="flex items-center gap-2">
                <code className="text-xs sm:text-sm font-mono font-semibold text-primary bg-background px-2.5 py-1 rounded border border-border select-all">
                  {acsUrl}
                </code>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant={copied ? "default" : "secondary"}
                size="sm"
                onClick={handleCopy}
                className="text-xs gap-1.5 h-8 font-medium"
              >
                {copied ? (
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
              <span className="font-medium text-foreground">Metode:</span> In-Band (VLAN 20 PPPoE)
            </div>
            <div>
              <span className="font-medium text-foreground">Username / Pass:</span>{' '}
              <span className="italic">Kosongkan (Default)</span>
            </div>
            <div>
              <span className="font-medium text-foreground">Periodic Inform:</span> 300 detik (5 menit)
            </div>
          </div>
        </div>

        {/* Expandable Guide Section */}
        {showFullGuide && (
          <div className="pt-2 border-t border-border space-y-4 animate-in fade-in-50 duration-200">
            {/* Quick Principles */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-background border border-border rounded-lg p-3.5 space-y-1.5">
                <div className="flex items-center gap-2 text-foreground font-medium text-xs">
                  <span className="p-1 rounded bg-blue-500/10 text-blue-600">
                    <Layers className="w-4 h-4" />
                  </span>
                  1. Mode In-Band (Tanpa VLAN Khusus)
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Tidak perlu membuat VLAN 4000 atau IP Pool TR-069 di MikroTik/OLT. Modem mengakses ACS langsung melalui koneksi PPPoE pelanggan.
                </p>
              </div>

              <div className="bg-background border border-border rounded-lg p-3.5 space-y-1.5">
                <div className="flex items-center gap-2 text-foreground font-medium text-xs">
                  <span className="p-1 rounded bg-emerald-500/10 text-emerald-600">
                    <Wifi className="w-4 h-4" />
                  </span>
                  2. Ubah Service Type WAN ke INTERNET,TR069
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Pada menu WAN Connection modem pelanggan, ubah Service Type dari <span className="font-mono text-foreground font-semibold">INTERNET</span> menjadi <span className="font-mono text-foreground font-semibold">INTERNET,TR069</span>.
                </p>
              </div>

              <div className="bg-background border border-border rounded-lg p-3.5 space-y-1.5">
                <div className="flex items-center gap-2 text-foreground font-medium text-xs">
                  <span className="p-1 rounded bg-purple-500/10 text-purple-600">
                    <Sparkles className="w-4 h-4" />
                  </span>
                  3. Auto-Mapping Otomatis
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Begitu ONT mengirim Inform pertama kali, EugineBill otomatis memetakan serial number modem ke akun pelanggan berdasarkan WAN IP PPPoE aktif.
                </p>
              </div>
            </div>

            {/* Brand-Specific Steps Tabs */}
            <div className="bg-background border border-border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-border">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Laptop className="w-4 h-4 text-primary" />
                  Panduan Langkah per Merk Modem / ONT
                </span>
                <div className="inline-flex rounded-md border border-border p-0.5 bg-muted/30">
                  <button
                    type="button"
                    onClick={() => setActiveTab('zte')}
                    className={`px-3 py-1 text-xs font-medium rounded-sm transition-colors ${
                      activeTab === 'zte'
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    ZTE (F609/F670L)
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('huawei')}
                    className={`px-3 py-1 text-xs font-medium rounded-sm transition-colors ${
                      activeTab === 'huawei'
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Huawei (HG8245H/EG8145)
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('fiberhome')}
                    className={`px-3 py-1 text-xs font-medium rounded-sm transition-colors ${
                      activeTab === 'fiberhome'
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Fiberhome (HG6243/6245)
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('vsol')}
                    className={`px-3 py-1 text-xs font-medium rounded-sm transition-colors ${
                      activeTab === 'vsol'
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    VSOL / XPON Umum
                  </button>
                </div>
              </div>

              {/* ZTE */}
              {activeTab === 'zte' && (
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
                      Masuk ke menu <strong className="text-foreground">Network</strong> &rarr; <strong className="text-foreground">WAN</strong> &rarr; <strong className="text-foreground">WAN Connection</strong>.
                    </li>
                    <li>
                      Pilih koneksi PPPoE yang aktif, cari opsi <strong className="text-foreground">Service List</strong>, lalu ganti dari <code className="font-mono text-foreground">INTERNET</code> menjadi <code className="font-mono text-foreground font-semibold">INTERNET_TR069</code>. Klik <strong className="text-foreground">Modify</strong>.
                    </li>
                    <li>
                      Masuk ke menu <strong className="text-foreground">Administration</strong> &rarr; <strong className="text-foreground">TR-069</strong>.
                    </li>
                    <li>
                      Centang <strong className="text-foreground">Enable CWMP</strong>.
                    </li>
                    <li>
                      Pada kolom <strong className="text-foreground">ACS URL</strong>, masukkan:{' '}
                      <code className="font-mono text-primary font-semibold bg-muted px-1.5 py-0.5 rounded border border-border">
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
                      Klik <strong className="text-foreground">Submit</strong>. Modem akan langsung mengirim Inform dan muncul di tabel ACS dalam 1-2 menit.
                    </li>
                  </ol>
                </div>
              )}

              {/* HUAWEI */}
              {activeTab === 'huawei' && (
                <div className="space-y-2.5 text-xs text-foreground leading-relaxed">
                  <div className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    Konfigurasi ONT Huawei (HG8245H, HG8245A, EG8145V5):
                  </div>
                  <ol className="list-decimal pl-5 space-y-1.5 text-muted-foreground">
                    <li>
                      Buka web ONT Huawei (biasanya <code className="font-mono text-foreground">192.168.100.1</code> atau <code className="font-mono text-foreground">192.168.18.1</code>).
                    </li>
                    <li>
                      Masuk ke tab <strong className="text-foreground">WAN</strong> &rarr; <strong className="text-foreground">WAN Configuration</strong>.
                    </li>
                    <li>
                      Pilih profil WAN PPPoE, pada kolom <strong className="text-foreground">Service Type</strong> pastikan dicentang atau dipilih <code className="font-mono text-foreground font-semibold">INTERNET, TR069</code>. Klik <strong className="text-foreground">Apply</strong>.
                    </li>
                    <li>
                      Buka tab <strong className="text-foreground">System Tools</strong> &rarr; <strong className="text-foreground">TR-069</strong>.
                    </li>
                    <li>
                      Centang <strong className="text-foreground">Enable TR-069</strong>.
                    </li>
                    <li>
                      Pada kolom <strong className="text-foreground">URL</strong>, masukkan:{' '}
                      <code className="font-mono text-primary font-semibold bg-muted px-1.5 py-0.5 rounded border border-border">
                        {acsUrl}
                      </code>
                    </li>
                    <li>
                      Centang <strong className="text-foreground">Periodic Inform</strong> dengan interval <strong className="text-foreground">300</strong> detik.
                    </li>
                    <li>
                      Klik <strong className="text-foreground">Apply</strong>. Status perangkat akan segera sinkron.
                    </li>
                  </ol>
                </div>
              )}

              {/* FIBERHOME */}
              {activeTab === 'fiberhome' && (
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
                      Masuk ke <strong className="text-foreground">Network</strong> &rarr; <strong className="text-foreground">Broadband Settings</strong> &rarr; <strong className="text-foreground">Internet Settings</strong>.
                    </li>
                    <li>
                      Pada konfigurasi WAN PPPoE, pastikan <strong className="text-foreground">Service List</strong> disetel ke <code className="font-mono text-foreground font-semibold">INTERNET,TR069</code>. Klik simpan.
                    </li>
                    <li>
                      Masuk ke menu <strong className="text-foreground">Management</strong> &rarr; <strong className="text-foreground">TR-069</strong>.
                    </li>
                    <li>
                      Set <strong className="text-foreground">CWMP Enable</strong> ke <strong className="text-foreground">Yes</strong>.
                    </li>
                    <li>
                      Isi <strong className="text-foreground">URL</strong> dengan:{' '}
                      <code className="font-mono text-primary font-semibold bg-muted px-1.5 py-0.5 rounded border border-border">
                        {acsUrl}
                      </code>
                    </li>
                    <li>
                      Set <strong className="text-foreground">Periodic Inform</strong> ke <strong className="text-foreground">Enable</strong> dengan interval <strong className="text-foreground">300</strong>.
                    </li>
                    <li>
                      Klik <strong className="text-foreground">Apply</strong>.
                    </li>
                  </ol>
                </div>
              )}

              {/* VSOL */}
              {activeTab === 'vsol' && (
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
                      Masuk ke menu <strong className="text-foreground">Network</strong> &rarr; <strong className="text-foreground">WAN Settings</strong>.
                    </li>
                    <li>
                      Pada interface PPPoE VLAN 20, set <strong className="text-foreground">Service Mode / Type</strong> ke <code className="font-mono text-foreground font-semibold">INTERNET,TR069</code>. Simpan konfigurasi.
                    </li>
                    <li>
                      Masuk ke menu <strong className="text-foreground">Management / Admin</strong> &rarr; <strong className="text-foreground">TR069 Config</strong>.
                    </li>
                    <li>
                      Aktifkan <strong className="text-foreground">TR069 Enable</strong>.
                    </li>
                    <li>
                      Masukkan <strong className="text-foreground">ACS Server URL</strong>:{' '}
                      <code className="font-mono text-primary font-semibold bg-muted px-1.5 py-0.5 rounded border border-border">
                        {acsUrl}
                      </code>
                    </li>
                    <li>
                      Centang <strong className="text-foreground">Periodic Inform</strong> interval <strong className="text-foreground">300</strong> detik.
                    </li>
                    <li>
                      Klik <strong className="text-foreground">Apply</strong>. Selesai!
                    </li>
                  </ol>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
