'use client';

import React, { useState } from 'react';
import { CreditCard, QrCode } from 'lucide-react';

interface BankLogoProps {
  name: string;
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'auto';
  variant?: 'badge' | 'plain';
}

// Normalized mapping to static SVG files in /images/banks/
const BANK_LOGO_MAP: Record<string, string> = {
  // Banks
  bca: '/images/banks/bca.svg',
  mandiri: '/images/banks/mandiri.svg',
  m2: '/images/banks/mandiri.svg',
  bri: '/images/banks/bri.svg',
  br: '/images/banks/bri.svg',
  briva: '/images/banks/bri.svg',
  briv: '/images/banks/bri.svg',
  bni: '/images/banks/bni.svg',
  i1: '/images/banks/bni.svg',
  bsi: '/images/banks/bsi.svg',
  bv: '/images/banks/bsi.svg',
  seabank: '/images/banks/seabank.svg',
  sea: '/images/banks/seabank.svg',
  cimb: '/images/banks/cimb-niaga.svg',
  'cimb-niaga': '/images/banks/cimb-niaga.svg',
  permata: '/images/banks/permata.svg',
  bt: '/images/banks/permata.svg',

  // QRIS & Wallets
  qris: '/images/banks/qris.svg',
  dana: '/images/banks/dana.svg',
  da: '/images/banks/dana.svg',
  gopay: '/images/banks/gopay.svg',
  go: '/images/banks/gopay.svg',
  shopeepay: '/images/banks/shopeepay.svg',
  sp: '/images/banks/shopeepay.svg',
  ovo: '/images/banks/ovo.svg',
  ov: '/images/banks/ovo.svg',
  linkaja: '/images/banks/linkaja.svg',
  la: '/images/banks/linkaja.svg',

  // Retail
  alfamart: '/images/banks/alfamart.svg',
  alfa: '/images/banks/alfamart.svg',
  indomaret: '/images/banks/indomaret.svg',
  indo: '/images/banks/indomaret.svg',
};

export function BankLogo({ name, className = '', size = 'sm', variant = 'badge' }: BankLogoProps) {
  const [hasError, setHasError] = useState(false);

  const cleanName = (name || '')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .trim();

  // Look up direct or substring match
  let logoSrc = BANK_LOGO_MAP[cleanName];
  if (!logoSrc) {
    for (const [key, path] of Object.entries(BANK_LOGO_MAP)) {
      if (cleanName.includes(key) || key.includes(cleanName)) {
        logoSrc = path;
        break;
      }
    }
  }

  // Size styling
  const sizeClasses = {
    xs: 'h-3.5 max-w-[50px]',
    sm: 'h-4 max-w-[65px]',
    md: 'h-6 max-w-[90px]',
    lg: 'h-8 max-w-[120px]',
    auto: 'h-full max-w-full',
  }[size];

  if (!logoSrc || hasError) {
    return (
      <div className={`inline-flex items-center justify-center font-bold text-[10px] text-muted-foreground uppercase ${className}`}>
        {cleanName.includes('qr') ? <QrCode className="w-4 h-4 text-primary" /> : <CreditCard className="w-4 h-4" />}
      </div>
    );
  }

  const imgEl = (
    <img
      src={logoSrc}
      alt={name}
      loading="lazy"
      onError={() => setHasError(true)}
      className={`object-contain transition-all ${sizeClasses} ${className}`}
    />
  );

  if (variant === 'badge') {
    return (
      <div className="inline-flex items-center justify-center px-1.5 py-0.5 bg-white rounded border border-slate-200/80 shadow-xs shrink-0">
        {imgEl}
      </div>
    );
  }

  return imgEl;
}

/**
 * Standard Bank Badges row as shown in user reference:
 * DANA, GoPay, BCA, ShopeePay, SeaBank, BRI, Mandiri, BNI + lainnya
 */
export function AcceptedQrisBadges({ className = '' }: { className?: string }) {
  const badges = [
    { key: 'dana', label: 'DANA' },
    { key: 'gopay', label: 'GoPay' },
    { key: 'bca', label: 'BCA' },
    { key: 'shopeepay', label: 'ShopeePay' },
    { key: 'seabank', label: 'SeaBank' },
    { key: 'bri', label: 'BRI' },
    { key: 'mandiri', label: 'Mandiri' },
    { key: 'bni', label: 'BNI' },
  ];

  return (
    <div className={`flex flex-wrap items-center gap-1.5 sm:gap-2 ${className}`}>
      {badges.map((b) => (
        <BankLogo key={b.key} name={b.key} size="xs" variant="badge" />
      ))}
      <span className="text-[11px] font-medium text-slate-500 ml-0.5">+ lainnya</span>
    </div>
  );
}
