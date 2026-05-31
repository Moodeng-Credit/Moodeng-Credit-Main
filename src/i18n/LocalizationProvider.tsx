import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { LocalizationDomBridge } from '@/i18n/LocalizationDomBridge';
import {
   LOCALE_STORAGE_KEY,
   type LocaleCode,
   pickInitialLocale,
   SUPPORTED_LOCALES,
   translate,
   type TranslationKey
} from '@/i18n/translations';

interface LocalizationContextValue {
   locale: LocaleCode;
   locales: typeof SUPPORTED_LOCALES;
   setLocale: (locale: LocaleCode) => void;
   t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

const LocalizationContext = createContext<LocalizationContextValue | null>(null);

function getBrowserLocales() {
   if (typeof navigator === 'undefined') return [];
   return [...(navigator.languages ?? []), navigator.language].filter(Boolean);
}

function getStoredLocale() {
   if (typeof window === 'undefined') return null;

   try {
      return window.localStorage?.getItem(LOCALE_STORAGE_KEY);
   } catch {
      return null;
   }
}

export function LocalizationProvider({ children }: { children: ReactNode }) {
   const [locale, setLocaleState] = useState<LocaleCode>(() =>
      pickInitialLocale({
         storedLocale: getStoredLocale(),
         browserLocales: getBrowserLocales()
      })
   );

   const setLocale = useCallback((nextLocale: LocaleCode) => {
      setLocaleState(nextLocale);
   }, []);

   useEffect(() => {
      const activeLocale = SUPPORTED_LOCALES.find((supportedLocale) => supportedLocale.code === locale);

      if (activeLocale && typeof document !== 'undefined') {
         document.documentElement.lang = activeLocale.htmlLang;
      }

      try {
         window.localStorage?.setItem(LOCALE_STORAGE_KEY, locale);
      } catch {
         // Language switching should still work in embedded previews where localStorage is disabled.
      }
   }, [locale]);

   const value = useMemo<LocalizationContextValue>(
      () => ({
         locale,
         locales: SUPPORTED_LOCALES,
         setLocale,
         t: (key, params) => translate(locale, key, params)
      }),
      [locale, setLocale]
   );

   return (
      <LocalizationContext.Provider value={value}>
         <LocalizationDomBridge locale={locale} />
         {children}
      </LocalizationContext.Provider>
   );
}

export function useLocalization() {
   const context = useContext(LocalizationContext);

   if (!context) {
      throw new Error('useLocalization must be used within LocalizationProvider');
   }

   return context;
}
