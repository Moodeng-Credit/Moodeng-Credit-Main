import type { LocaleCode } from '@/i18n/translations';

type CoverageLocale = Exclude<LocaleCode, 'en'>;

// Each locale's coverage map is large, so it ships as its own chunk and loads only once a
// visitor picks that language. Entries in screenTranslations.ts still take precedence.
const coverageLoaders: Record<CoverageLocale, () => Promise<Record<string, string>>> = {
   fil: () => import('@/i18n/coverage/fil').then((module) => module.screenCoverage),
   id: () => import('@/i18n/coverage/id').then((module) => module.screenCoverage),
   th: () => import('@/i18n/coverage/th').then((module) => module.screenCoverage),
   vi: () => import('@/i18n/coverage/vi').then((module) => module.screenCoverage)
};

export function loadScreenCoverage(locale: LocaleCode): Promise<Record<string, string>> {
   return locale === 'en' ? Promise.resolve({}) : coverageLoaders[locale]();
}
