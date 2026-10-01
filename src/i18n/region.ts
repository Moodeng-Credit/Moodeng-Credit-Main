import type { LocaleCode } from '@/i18n/translations';

// Best-effort guess of which of our markets a visitor is in, from signals the browser already
// exposes (no network call, no permission prompt). Used to SUGGEST a language, never to force
// one, and later to pick region-specific content (e.g. local exchanges). Not a security control.
//
// Signals, strongest first:
//  1. a browser language tagged with one of our regions (en-PH, id-ID, th-TH, vi-VN, fil-PH, …)
//  2. the device time zone

export type RegionCode = 'PH' | 'ID' | 'TH' | 'VN';

export const REGION_LOCALE: Record<RegionCode, LocaleCode> = {
   PH: 'fil',
   ID: 'id',
   TH: 'th',
   VN: 'vi'
};

const TIME_ZONE_REGION: Record<string, RegionCode> = {
   'Asia/Manila': 'PH',
   'Asia/Jakarta': 'ID',
   'Asia/Pontianak': 'ID',
   'Asia/Makassar': 'ID',
   'Asia/Jayapura': 'ID',
   'Asia/Bangkok': 'TH',
   'Asia/Ho_Chi_Minh': 'VN',
   'Asia/Saigon': 'VN'
};

const REGION_CODES = new Set<string>(Object.keys(REGION_LOCALE));

function regionFromLanguageTag(tag: string): RegionCode | null {
   const parts = tag.replace('_', '-').split('-');
   const region = parts.find((part, index) => index > 0 && part.length === 2)?.toUpperCase();
   return region && REGION_CODES.has(region) ? (region as RegionCode) : null;
}

export function detectRegion({
   browserLocales = [],
   timeZone
}: {
   browserLocales?: readonly string[];
   timeZone?: string | null;
}): RegionCode | null {
   for (const tag of browserLocales) {
      const region = regionFromLanguageTag(tag);
      if (region) return region;
   }
   return (timeZone && TIME_ZONE_REGION[timeZone]) || null;
}

export function suggestLocaleForRegion(region: RegionCode | null): LocaleCode | null {
   return region ? REGION_LOCALE[region] : null;
}

export function readBrowserRegion(): RegionCode | null {
   if (typeof navigator === 'undefined') return null;
   let timeZone: string | undefined;
   try {
      timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
   } catch {
      timeZone = undefined;
   }
   const browserLocales = [...(navigator.languages ?? []), navigator.language].filter(Boolean);
   return detectRegion({ browserLocales, timeZone });
}
