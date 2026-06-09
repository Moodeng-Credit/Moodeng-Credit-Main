import { useEffect, useState } from 'react';

const STORAGE_KEY = 'moodeng_theme';

function getInitialTheme(): 'light' | 'dark' {
   const stored = localStorage.getItem(STORAGE_KEY);
   if (stored === 'light' || stored === 'dark') return stored;
   return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: 'light' | 'dark') {
   if (theme === 'dark') {
      document.documentElement.classList.add('dark');
   } else {
      document.documentElement.classList.remove('dark');
   }
}

export function useTheme() {
   const [theme, setTheme] = useState<'light' | 'dark'>(() => {
      if (typeof window === 'undefined') return 'light';
      return getInitialTheme();
   });

   useEffect(() => {
      applyTheme(theme);
      localStorage.setItem(STORAGE_KEY, theme);
   }, [theme]);

   const toggle = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

   return { theme, toggle };
}
