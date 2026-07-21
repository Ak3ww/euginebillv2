'use client';

import { useState, useCallback, useLayoutEffect } from 'react';

// Helper to get initial theme synchronously (reduces flash on first paint)
const getInitialTheme = (): boolean => {
  return false; // Force light mode globally as requested
};

export function useTheme() {
  const [isDark, setIsDark] = useState<boolean>(false);

  const runWithoutTransitions = useCallback((fn: () => void) => {
    const html = document.documentElement;
    html.classList.add('theme-no-transition');
    fn();
    // Remove class after the next frame so styles apply without animating
    requestAnimationFrame(() => html.classList.remove('theme-no-transition'));
  }, []);

  // Apply theme immediately after mount to avoid visual flash (no transition here)
  useLayoutEffect(() => {
    runWithoutTransitions(() => {
      const dark = getInitialTheme();
      setIsDark(dark);
      const html = document.documentElement;
      html.classList.toggle('dark', dark);
      html.style.colorScheme = dark ? 'dark' : 'light';
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyTheme = useCallback((next: boolean) => {
    // Disabled dark mode as requested
  }, []);

  const toggleTheme = useCallback(() => {
    // Disabled dark mode as requested
  }, []);

  return { isDark, toggleTheme };
}
