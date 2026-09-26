// Phrase lookup behind LocalizationDomBridge, which translates rendered text in place.
import { screenTranslationsByLocale } from '@/i18n/screenTranslations';
import { type LocaleCode, translations } from '@/i18n/translations';

export function normalizePhrase(value: string) {
   return value.replace(/\s+/g, ' ').trim();
}

function escapeRegExp(value: string) {
   return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getPhrasePattern(phrase: string) {
   const startsWithWord = /^[A-Za-z0-9]/.test(phrase);
   const endsWithWord = /[A-Za-z0-9]$/.test(phrase);
   const phrasePattern = escapeRegExp(phrase).replace(/\s+/g, '\\s+');
   const leadingBoundary = startsWithWord ? '(^|[^\\p{L}\\p{N}])' : '()';
   const trailingBoundary = endsWithWord ? '($|[^\\p{L}\\p{N}])' : '()';

   return new RegExp(`${leadingBoundary}(${phrasePattern})${trailingBoundary}`, 'gu');
}

export function buildPhraseMap(locale: LocaleCode) {
   if (locale === 'en') return new Map<string, string>();

   const phraseMap = new Map<string, string>();

   Object.entries(translations.en).forEach(([key, englishValue]) => {
      const translatedValue = translations[locale][key as keyof typeof translations.en];
      if (englishValue && translatedValue && englishValue !== translatedValue) {
         phraseMap.set(normalizePhrase(englishValue), translatedValue);
      }
   });

   Object.entries(screenTranslationsByLocale[locale] ?? {}).forEach(([englishValue, translatedValue]) => {
      phraseMap.set(normalizePhrase(englishValue), translatedValue);
   });

   return phraseMap;
}

export function getTranslation(phraseMap: Map<string, string>, value: string) {
   const normalized = normalizePhrase(value);
   if (!normalized) return null;
   return phraseMap.get(normalized) ?? null;
}

// Replaces known phrases inside a longer string that has no full translation of its own. Only
// multi-word phrases qualify: swapping single words mid-sentence produced half-translated labels
// like "Make Your Permintaan", "Lanjutkan to application" and "Set Repayment Tanggal", which
// Indonesian-locale borrowers were shown in the loan request (seen in PostHog, 2026-09). A string
// with no translation stays in readable English instead.
export function translateKnownPhrases(phraseMap: Map<string, string>, value: string) {
   if (normalizePhrase(value).length > 96) return null;

   let translatedValue = value;

   Array.from(phraseMap.entries())
      .filter(
         ([englishValue, translatedPhrase]) => englishValue.length >= 4 && englishValue !== translatedPhrase && /\s/.test(englishValue)
      )
      .sort(([left], [right]) => right.length - left.length)
      .forEach(([englishValue, translatedPhrase]) => {
         translatedValue = translatedValue.replace(getPhrasePattern(englishValue), (_match, leadingBoundary, _phrase, trailingBoundary) => {
            return `${leadingBoundary}${translatedPhrase}${trailingBoundary}`;
         });
      });

   return translatedValue === value ? null : translatedValue;
}
