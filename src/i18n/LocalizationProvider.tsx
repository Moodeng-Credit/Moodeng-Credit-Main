import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { LocalizationDomBridge } from '@/i18n/LocalizationDomBridge';
import { readBrowserRegion, type RegionCode, suggestLocaleForRegion } from '@/i18n/region';
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
   /** Sets the locale because the person picked it, so we stop suggesting another one. */
   chooseLocale: (locale: LocaleCode) => void;
   /** True once the person has picked a language themselves (any device session on this browser). */
   hasChosenLocale: boolean;
   /** Best-effort market guess from browser language region and time zone. */
   region: RegionCode | null;
   /** The language of that market, used to highlight a suggestion in language pickers. */
   suggestedLocale: LocaleCode | null;
   t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

const LocalizationContext = createContext<LocalizationContextValue | null>(null);

function getBrowserLocales() {
   if (typeof navigator === 'undefined') return [];
   return [...(navigator.languages ?? []), navigator.language].filter(Boolean);
}

// Set when the person picks a language in a picker (not when we fall back to the browser language).
const LOCALE_CHOSEN_STORAGE_KEY = 'md_locale_chosen';

function readLocaleChosen() {
   if (typeof window === 'undefined') return false;
   try {
      return window.localStorage?.getItem(LOCALE_CHOSEN_STORAGE_KEY) === '1';
   } catch {
      return false;
   }
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

   const [hasChosenLocale, setHasChosenLocale] = useState(readLocaleChosen);
   const region = useMemo(() => readBrowserRegion(), []);

   const setLocale = useCallback((nextLocale: LocaleCode) => {
      setLocaleState(nextLocale);
   }, []);

   const chooseLocale = useCallback((nextLocale: LocaleCode) => {
      setLocaleState(nextLocale);
      setHasChosenLocale(true);
      try {
         window.localStorage?.setItem(LOCALE_CHOSEN_STORAGE_KEY, '1');
      } catch {
         // Still switches for this visit where localStorage is unavailable.
      }
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
         chooseLocale,
         hasChosenLocale,
         region,
         suggestedLocale: suggestLocaleForRegion(region),
         t: (key, params) => translate(locale, key, params)
      }),
      [locale, setLocale, chooseLocale, hasChosenLocale, region]
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
