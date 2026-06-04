import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';

import { applyThemeMode, getStoredThemeMode, persistThemeMode, THEME_MODE_STORAGE_KEY, type ThemeMode } from '@/lib/themeMode';

interface ThemeModeContextValue {
   mode: ThemeMode;
   isDarkMode: boolean;
   setMode: (mode: ThemeMode) => void;
   toggleMode: () => void;
}

const ThemeModeContext = createContext<ThemeModeContextValue | undefined>(undefined);

export function ThemeModeProvider({ children }: { children: ReactNode }) {
   const [mode, setModeState] = useState<ThemeMode>(() => getStoredThemeMode());

   useEffect(() => {
      applyThemeMode(mode);
      persistThemeMode(mode);
   }, [mode]);

   useEffect(() => {
      const handleStorage = (event: StorageEvent) => {
         if (event.key !== THEME_MODE_STORAGE_KEY) return;
         setModeState(event.newValue === 'dark' ? 'dark' : 'light');
      };

      window.addEventListener('storage', handleStorage);
      return () => window.removeEventListener('storage', handleStorage);
   }, []);

   const value = useMemo<ThemeModeContextValue>(
      () => ({
         mode,
         isDarkMode: mode === 'dark',
         setMode: setModeState,
         toggleMode: () => setModeState((current) => (current === 'dark' ? 'light' : 'dark'))
      }),
      [mode]
   );

   return <ThemeModeContext.Provider value={value}>{children}</ThemeModeContext.Provider>;
}

export function useThemeMode() {
   const context = useContext(ThemeModeContext);
   if (!context) {
      throw new Error('useThemeMode must be used inside ThemeModeProvider');
   }

   return context;
}
