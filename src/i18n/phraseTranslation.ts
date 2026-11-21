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

// `coverage` is the lazily loaded map from src/i18n/coverage; the keyed and screen translations
// are applied after it so they win when both define the same English text.
export function buildPhraseMap(locale: LocaleCode, coverage?: Record<string, string>) {
   if (locale === 'en') return new Map<string, string>();

   const phraseMap = new Map<string, string>();

   Object.entries(coverage ?? {}).forEach(([englishValue, translatedValue]) => {
      phraseMap.set(normalizePhrase(englishValue), translatedValue);
   });

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

// Sentences built from a number ("Repay on time to reach Level 3 — up to $35.") have one translation
// per number someone wrote down. When a new number has none, reuse the sentence's translation for
// another number: "…Level 2 — up to $20." teaches "…Level {0} — up to ${1}.". Only translations that
// carry every number of the English (each once) become templates, so nothing is guessed.
const NUMBER = /\d+(?:[.,]\d+)*/g;
// Placeholders use private-use characters, which never appear in real text.
const slot = (index: number) => `\uE000${index}\uE001`;
const numberTemplateCache = new WeakMap<Map<string, string>, Map<string, string>>();

function getNumberTemplates(phraseMap: Map<string, string>) {
   let templates = numberTemplateCache.get(phraseMap);
   if (templates) return templates;
   templates = new Map<string, string>();
   for (const [english, translated] of phraseMap) {
      const numbers = english.match(NUMBER);
      if (!numbers || new Set(numbers).size !== numbers.length) continue;
      let foreign = false;
      const value = translated.replace(NUMBER, (found) => {
         const index = numbers.indexOf(found);
         if (index < 0) foreign = true;
         return index < 0 ? found : slot(index);
      });
      if (foreign || !numbers.every((_, index) => value.includes(slot(index)))) continue;
      let index = 0;
      const key = english.replace(NUMBER, () => slot(index++));
      if (!templates.has(key)) templates.set(key, value);
   }
   numberTemplateCache.set(phraseMap, templates);
   return templates;
}

function getNumberTemplateTranslation(phraseMap: Map<string, string>, normalized: string) {
   const numbers = normalized.match(NUMBER);
   if (!numbers) return null;
   let index = 0;
   const template = getNumberTemplates(phraseMap).get(normalized.replace(NUMBER, () => slot(index++)));
   return template ? template.replace(/\uE000(\d+)\uE001/g, (_match, at: string) => numbers[Number(at)] ?? '') : null;
}

export function getTranslation(phraseMap: Map<string, string>, value: string) {
   const normalized = normalizePhrase(value);
   if (!normalized) return null;
   return phraseMap.get(normalized) ?? getNumberTemplateTranslation(phraseMap, normalized);
}

// Replaces known phrases inside a longer string that has no full translation of its own. Only
// multi-word phrases qualify: swapping single words mid-sentence produced half-translated labels
// like "Make Your Permintaan", "Lanjutkan to application" and "Set Repayment Tanggal", which
// Indonesian-locale borrowers were shown in the loan request (seen in PostHog, 2026-09). A string
// with no translation stays in readable English instead.
// The qualifying phrases, longest first, with their patterns compiled once per phrase map rather
// than on every text node the bridge visits.
const phrasePatternCache = new WeakMap<Map<string, string>, Array<[RegExp, string]>>();

function getPhrasePatterns(phraseMap: Map<string, string>) {
   let patterns = phrasePatternCache.get(phraseMap);
   if (!patterns) {
      patterns = Array.from(phraseMap.entries())
         .filter(
            ([englishValue, translatedPhrase]) => englishValue.length >= 4 && englishValue !== translatedPhrase && /\s/.test(englishValue)
         )
         .sort(([left], [right]) => right.length - left.length)
         .map(([englishValue, translatedPhrase]): [RegExp, string] => [getPhrasePattern(englishValue), translatedPhrase]);
      phrasePatternCache.set(phraseMap, patterns);
   }
   return patterns;
}

export function translateKnownPhrases(phraseMap: Map<string, string>, value: string) {
   if (normalizePhrase(value).length > 96) return null;

   let translatedValue = value;

   getPhrasePatterns(phraseMap).forEach(([pattern, translatedPhrase]) => {
      translatedValue = translatedValue.replace(pattern, (_match, leadingBoundary, _phrase, trailingBoundary) => {
         return `${leadingBoundary}${translatedPhrase}${trailingBoundary}`;
      });
   });

   return translatedValue === value ? null : translatedValue;
}
