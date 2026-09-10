'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useState, useEffect } from 'react';

export const BALANCE_MASK = '••••••••';
export const BALANCE_MASK_RP = 'Rp ••••••';

interface BalancePrivacyStore {
  isHidden: boolean;
  toggleHide: () => void;
  setHidden: (hidden: boolean) => void;
}

export const useBalancePrivacyStore = create<BalancePrivacyStore>()(
  persist(
    (set) => ({
      isHidden: false,
      toggleHide: () => set((state) => ({ isHidden: !state.isHidden })),
      setHidden: (hidden: boolean) => set({ isHidden: hidden }),
    }),
    {
      name: 'euginebill-balance-privacy',
    }
  )
);

/**
 * Format currency with privacy masking support.
 * When hidden, returns 'Rp ••••••' (or fallbackFormatted if provided).
 * When visible, returns IDR formatted currency (e.g. 'Rp 150.000') or customFormatted.
 */
export function formatCurrencyPrivacy(
  amount: number | string | null | undefined,
  isHidden: boolean,
  customFormatted?: string
): string {
  if (isHidden) {
    return BALANCE_MASK_RP;
  }
  if (customFormatted !== undefined && customFormatted !== null) {
    return customFormatted;
  }
  const num = typeof amount === 'string' ? parseFloat(amount) : Number(amount ?? 0);
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(isNaN(num) ? 0 : num);
}

/**
 * Client-side React hook to consume and toggle balance privacy safely with SSR hydration support.
 */
export function useBalancePrivacy() {
  const isHidden = useBalancePrivacyStore((state) => state.isHidden);
  const toggleHide = useBalancePrivacyStore((state) => state.toggleHide);
  const setHidden = useBalancePrivacyStore((state) => state.setHidden);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const activeHidden = mounted ? isHidden : false;

  const formatRupiah = (amount: number | string | null | undefined, customFormatted?: string) => {
    return formatCurrencyPrivacy(amount, activeHidden, customFormatted);
  };

  return {
    isHidden: activeHidden,
    toggleHide,
    setHidden,
    formatRupiah,
    BALANCE_MASK,
    BALANCE_MASK_RP,
  };
}
