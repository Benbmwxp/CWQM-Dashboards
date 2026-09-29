import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';
const KEY = 'cwqm-theme';

const saved = (): Theme => {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch { /* ignore */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

/** Call once at start-up so the saved theme applies before anything renders. */
export const applySavedTheme = () => { document.documentElement.dataset.theme = saved(); };

/** Theme lives on <html data-theme>, so every token and component follows it. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'));
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem(KEY, theme); } catch { /* ignore */ }
  }, [theme]);
  return { theme, toggle: () => setTheme((t) => (t === 'light' ? 'dark' : 'light')) };
}
