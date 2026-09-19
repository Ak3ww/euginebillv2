'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Server,
  Network,
  Users,
  CreditCard,
  Bot,
  Package,
  ArrowRight,
  ExternalLink,
  CheckCircle2,
  HelpCircle,
  Shield,
  BookOpen,
  ChevronRight,
  Sliders,
  Sparkles,
  LayoutDashboard,
} from 'lucide-react';

interface SetupStep {
  id: string;
  stepNumber: number;
  title: string;
  badge: string;
  icon: React.ReactNode;
  summary: string;
  primaryAction: {
    label: string;
    href: string;
  };
  secondaryAction?: {
    label: string;
    href: string;
  };
  actionItems: string[];
  scriptNote: string;
}

export default function DocsPage() {
  const [activeStepId, setActiveStepId] = useState<string>('step-1');

  const steps: SetupStep[] = [
    {
      id: 'step-1',
      stepNumber: 1,
      title: 'Menghubungkan MikroTik ke Billing',
      badge: 'Wajib Pertama',
      icon: <Server className="w-5 h-5 text-blue-600" />,
      summary: 'Daftarkan router MikroTik Anda melalui VPN terowongan aman (WireGuard atau L2TP) tanpa memerlukan IP publik statis.',
      primaryAction: {
        label: 'Buka Halaman VPN Client',
        href: '/admin/network/vpn-client',
      },
      secondaryAction: {
        label: 'Buka Data Router (Test Koneksi)',
        href: '/admin/network/routers',
      },
      actionItems: [
        'Klik tombol "Tambah VPN Client", isi nama router Anda dan port target API yang diinginkan (default 8728 atau custom seperti 8520).',
        'Klik "Simpan & Generate Script", lalu salin script 1-klik yang otomatis disediakan di modal halaman tersebut.',
        'Buka Winbox MikroTik Anda > New Terminal > Tempelkan (paste) script tersebut.',
        'Buka halaman Data Router, pilih router yang baru dibuat, lalu klik tombol "Test Koneksi" hingga muncul status sukses.',
      ],
      scriptNote: 'Skrip RouterOS lengkap (pembuatan interface VPN, user admin API, dan aturan firewall filter input) sudah otomatis di-generate secara dinamis dan siap disalin di halaman VPN Client & Data Router.',
    },
    {
      id: 'step-2',
      stepNumber: 2,
      title: 'Sinkronisasi Paket Tarif & Profile Kecepatan',
      badge: 'Layanan',
      icon: <Package className="w-5 h-5 text-emerald-600" />,
      summary: 'Hubungkan paket tarif bulanan yang akan ditagihkan ke pelanggan dengan nama PPP Profile yang sudah ada di MikroTik Anda.',
      primaryAction: {
        label: 'Buka Halaman Manajemen Paket',
        href: '/admin/packages',
      },
      actionItems: [
        'Pastikan PPP Profile kecepatan bandwidth Anda sudah tersedia di MikroTik (menu /ppp profile).',
        'Buka halaman Manajemen Paket di billing, lalu klik tombol "Tambah Paket".',
        'Tentukan Nama Paket (misal Home 20 Mbps), tarif iuran bulanan, dan pilih nama PPP Profile MikroTik yang bersangkutan.',
        'Pilih router target Anda lalu klik "Simpan". Paket kini siap dipilih saat registrasi pelanggan.',
      ],
      scriptNote: 'Tidak perlu konfigurasi queue atau mangle manual di billing. Sistem otomatis membaca profil kecepatan native MikroTik Anda.',
    },
    {
      id: 'step-3',
      stepNumber: 3,
      title: 'Mendaftarkan Pelanggan & Otomasi PPPoE Secret',
      badge: 'Operasional',
      icon: <Users className="w-5 h-5 text-purple-600" />,
      summary: 'Input data pelanggan baru di web billing. Akun secret di MikroTik otomatis terbuat secara instan dan invoice perdana langsung terbit.',
      primaryAction: {
        label: 'Buka Halaman Data Pelanggan',
        href: '/admin/customers',
      },
      actionItems: [
        'Masuk ke halaman Data Pelanggan > klik "Tambah Pelanggan".',
        'Isi nama lengkap, nomor WhatsApp aktif (format 08...), dan alamat pemasangan.',
        'Pilih paket langganan yang telah dibuat pada Langkah 2.',
        'Tentukan Username & Password PPPoE yang akan di-dial oleh modem ONT pelanggan.',
        'Klik "Simpan". Akun /ppp/secret langsung aktif di MikroTik dalam 1 detik tanpa perlu membuka Winbox!',
      ],
      scriptNote: 'Otomasi Penuh: Pelanggan yang belum membayar saat jatuh tempo otomatis diisolir oleh cron billing, dan otomatis terbuka kembali saat pembayaran diterima.',
    },
    {
      id: 'step-4',
      stepNumber: 4,
      title: 'Menghubungkan OLT ke Monitoring Billing (Opsional)',
      badge: 'Monitoring FTTH',
      icon: <Network className="w-5 h-5 text-indigo-600" />,
      summary: 'Cukup daftarkan IP Management OLT Anda agar status redaman optik (dBm) dan status LOS ONT pelanggan terpantau langsung di billing.',
      primaryAction: {
        label: 'Buka Halaman OLT Management',
        href: '/admin/network/olts',
      },
      secondaryAction: {
        label: 'Buka Live Monitoring OLT',
        href: '/admin/olt/monitoring',
      },
      actionItems: [
        'Anda tidak perlu merombak topologi jaringan FTTH atau VLAN yang sudah berjalan.',
        'Buka halaman OLT Management > klik "Tambah OLT".',
        'Pilih tipe OLT (VSOL, ZTE, EPON/GPON), masukkan IP Management OLT Anda, dan port Telnet/SNMP.',
        'Klik "Simpan & Uji Koneksi". Data redaman optik (RX/TX Power) dan ONT online langsung muncul di dashboard billing.',
      ],
      scriptNote: 'Seluruh parameter Telnet dan template MIB SNMP sudah terpasang otomatis di backend billing.',
    },
    {
      id: 'step-5',
      stepNumber: 5,
      title: 'Setup WhatsApp Bot Notifikasi Tagihan',
      badge: 'Otomasi Pesan',
      icon: <Bot className="w-5 h-5 text-emerald-600" />,
      summary: 'Hubungkan WhatsApp Anda untuk pengiriman rincian tagihan invoice otomatis, pengingat tempo (H-6 & H-1), dan kuitansi lunas instan.',
      primaryAction: {
        label: 'Buka Halaman Gateway WhatsApp',
        href: '/admin/whatsapp',
      },
      actionItems: [
        'Buka halaman Gateway WhatsApp pada tab "Koneksi".',
        'Buka aplikasi WhatsApp di HP Admin > Menu Titik Tiga (kanan atas) > Perangkat Tertaut > Tautkan Perangkat.',
        'Scan QR Code yang tampil di layar billing.',
        'Status akan langsung berubah menjadi "ONLINE / TERHUBUNG". Bot notifikasi tagihan kini aktif otomatis!',
      ],
      scriptNote: 'Menggunakan engine native Baileys mandiri tanpa biaya langganan bulanan vendor pihak ketiga.',
    },
    {
      id: 'step-6',
      stepNumber: 6,
      title: 'Setup Payment Gateway (QRIS & VA Otomatis Lunas)',
      badge: 'Finansial',
      icon: <CreditCard className="w-5 h-5 text-amber-600" />,
      summary: 'Aktifkan pembayaran otomatis via QRIS dan Virtual Account. Invoice otomatis berstatus lunas dan isolasi pelanggan terbuka seketika.',
      primaryAction: {
        label: 'Buka Halaman Payment Gateway',
        href: '/admin/payment-gateway',
      },
      actionItems: [
        'Masuk ke halaman Payment Gateway, pilih provider yang Anda gunakan (Midtrans, Tripay, Xendit, atau Duitku).',
        'Masukkan Server Key / Merchant Code dari akun payment gateway Anda.',
        'Salin URL Callback Webhook yang tertera di halaman setting tersebut, lalu tempelkan di dashboard payment gateway Anda.',
        'Selesai! Ketika pelanggan scan QRIS atau transfer VA, tagihan otomatis lunas dan internet pelanggan yang terisolir aktif kembali dalam 2 detik.',
      ],
      scriptNote: 'Webhook Callback URL dan panduan kunci API sudah tersedia lengkap langsung di halaman setting Payment Gateway.',
    },
  ];

  const activeStep = steps.find((s) => s.id === activeStepId) || steps[0];

  return (
    <div className="min-h-screen bg-background text-foreground py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 border border-primary/20 rounded-2xl text-primary">
              <BookOpen className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Panduan Setup Awal Billing</h1>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  Easy Setup
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Ikuti 6 langkah terstruktur di bawah ini. Klik langsung tombol setting untuk diarahkan ke halaman konfigurasi terkait.
              </p>
            </div>
          </div>
          <Link
            href="/admin/dashboard"
            className="px-4 py-2 text-xs font-medium bg-muted hover:bg-accent border border-border rounded-xl text-foreground transition-colors flex items-center gap-2 self-start sm:self-auto"
          >
            <LayoutDashboard className="w-4 h-4" /> Kembali ke Dashboard
          </Link>
        </div>

        {/* Easy Setup Wizard CTA Banner */}
        <div className="relative overflow-hidden rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50/90 via-sky-50/60 to-blue-50/90 dark:border-blue-900/50 dark:from-blue-950/40 dark:via-sky-950/20 dark:to-blue-950/40 p-5 sm:p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/50 rounded-xl text-blue-600 dark:text-blue-400 shrink-0">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm sm:text-base font-semibold text-blue-950 dark:text-blue-100">
                  Ingin setup langsung dipandu langkah demi langkah secara interaktif?
                </h3>
                <p className="text-xs text-blue-800/80 dark:text-blue-300/80">
                  Buka Setup Wizard untuk konfigurasi terpadu VPN, router MikroTik, paket layanan, dan WhatsApp secara otomatis.
                </p>
              </div>
            </div>
            <Link
              href="/setup"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-all shrink-0"
            >
              <span>Buka Setup Wizard</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Stepper Progress Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {steps.map((step) => {
            const isActive = step.id === activeStepId;
            return (
              <button
                key={step.id}
                onClick={() => setActiveStepId(step.id)}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  isActive
                    ? 'bg-primary/10 border-primary shadow-sm ring-1 ring-primary/20'
                    : 'bg-card border-border hover:border-primary/40'
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-2">
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    Langkah {step.stepNumber}
                  </span>
                  <div className="shrink-0">{step.icon}</div>
                </div>
                <div className="text-xs font-semibold text-foreground line-clamp-1">{step.title}</div>
              </button>
            );
          })}
        </div>

        {/* Active Step Detailed Card */}
        <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm">
          {/* Step Header */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-border pb-5">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  Langkah {activeStep.stepNumber} dari 6
                </span>
                <span className="text-xs text-muted-foreground font-medium">{activeStep.badge}</span>
              </div>
              <h2 className="text-2xl font-bold text-foreground flex items-center gap-2.5">
                {activeStep.icon} {activeStep.title}
              </h2>
              <p className="text-sm text-muted-foreground max-w-2xl">{activeStep.summary}</p>
            </div>

            {/* Direct Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 sm:self-center shrink-0">
              <Link
                href={activeStep.primaryAction.href}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground font-semibold text-xs rounded-xl hover:bg-primary/90 transition-all shadow-sm hover:shadow"
              >
                {activeStep.primaryAction.label} <ArrowRight className="w-4 h-4" />
              </Link>
              {activeStep.secondaryAction && (
                <Link
                  href={activeStep.secondaryAction.href}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-muted hover:bg-accent border border-border text-foreground font-medium text-xs rounded-xl transition-colors"
                >
                  {activeStep.secondaryAction.label} <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>
          </div>

          {/* Action Checklist */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
              <Sliders className="w-4 h-4 text-primary" /> Apa yang Anda Lakukan di Halaman Setting Ini:
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {activeStep.actionItems.map((item, index) => (
                <div
                  key={index}
                  className="p-3.5 rounded-xl border border-border bg-muted/20 flex items-start gap-3"
                >
                  <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    {index + 1}
                  </div>
                  <p className="text-xs text-foreground leading-relaxed">{item}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Script & Auto-Generate Notice Banner */}
          <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20 flex items-start gap-3 text-xs text-muted-foreground">
            <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <strong className="text-foreground">Skrip &amp; Generator Otomatis:</strong> {activeStep.scriptNote}
            </div>
          </div>

          {/* Step Navigation Controls */}
          <div className="pt-4 border-t border-border flex items-center justify-between">
            {(() => {
              const currentIndex = steps.findIndex((s) => s.id === activeStep.id);
              const prevStep = steps[currentIndex - 1];
              const nextStep = steps[currentIndex + 1];

              return (
                <>
                  {prevStep ? (
                    <button
                      onClick={() => setActiveStepId(prevStep.id)}
                      className="px-4 py-2 text-xs bg-muted hover:bg-accent border border-border rounded-xl text-foreground flex items-center gap-1.5 font-medium transition-colors"
                    >
                      &larr; Langkah {prevStep.stepNumber}: {prevStep.title}
                    </button>
                  ) : (
                    <div />
                  )}

                  {nextStep ? (
                    <button
                      onClick={() => setActiveStepId(nextStep.id)}
                      className="px-5 py-2 text-xs bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl flex items-center gap-1.5 font-semibold transition-colors shadow-sm"
                    >
                      Lanjut ke Langkah {nextStep.stepNumber}: {nextStep.title} &rarr;
                    </button>
                  ) : (
                    <Link
                      href="/admin/dashboard"
                      className="px-5 py-2 text-xs bg-emerald-600 text-white hover:bg-emerald-500 rounded-xl flex items-center gap-1.5 font-semibold transition-colors shadow-sm"
                    >
                      Setup Selesai! Buka Dashboard &rarr;
                    </Link>
                  )}
                </>
              );
            })()}
          </div>
        </div>

        {/* Quick FAQ / Help Footer */}
        <div className="bg-muted/30 border border-border rounded-2xl p-5 text-xs text-muted-foreground flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <HelpCircle className="w-4 h-4 text-primary shrink-0" />
            <span>Butuh bantuan lebih lanjut saat setup? Semua tombol salin skrip di setiap halaman setting bekerja 100% pada semua browser dan handphone.</span>
          </div>
          <Link href="/admin/network/routers" className="text-primary hover:underline font-medium inline-flex items-center gap-1 shrink-0">
            Cek Status Router <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
