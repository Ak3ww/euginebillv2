'use client';

import { useState, useCallback, useEffect } from 'react';

const getInitialTheme = (): boolean => {
  if (typeof window === 'undefined') return false;
  const saved = localStorage.getItem('theme');
  if (saved) return saved === 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
};

export function useTheme() {
  const [isDark, setIsDark] = useState<boolean>(false);

  useEffect(() => {
    const dark = getInitialTheme();
    setIsDark(dark);
    const html = document.documentElement;
    html.classList.toggle('dark', dark);
    html.style.colorScheme = dark ? 'dark' : 'light';
  }, []);

  const toggleTheme = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      const html = document.documentElement;
      html.classList.toggle('dark', next);
      html.style.colorScheme = next ? 'dark' : 'light';
      localStorage.setItem('theme', next ? 'dark' : 'light');
      return next;
    });
  }, []);

  return { isDark, toggleTheme };
}
