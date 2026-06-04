import { useEffect, useMemo } from 'react';

import { screenTranslationsByLocale } from '@/i18n/screenTranslations';
import { type LocaleCode, translations } from '@/i18n/translations';

const textOriginals = new WeakMap<Text, string>();
const attributeOriginals = new WeakMap<Element, Map<string, string>>();
const translatedTextNodes = new WeakSet<Text>();
const LOCALIZED_ATTRIBUTES = ['aria-label', 'title', 'alt', 'placeholder'] as const;

function normalizePhrase(value: string) {
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

function buildPhraseMap(locale: LocaleCode) {
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

function getTranslation(phraseMap: Map<string, string>, value: string) {
   const normalized = normalizePhrase(value);
   if (!normalized) return null;
   return phraseMap.get(normalized) ?? null;
}

function translateKnownPhrases(phraseMap: Map<string, string>, value: string) {
   if (normalizePhrase(value).length > 96) return null;

   let translatedValue = value;

   Array.from(phraseMap.entries())
      .filter(([englishValue, translatedPhrase]) => englishValue.length >= 4 && englishValue !== translatedPhrase)
      .sort(([left], [right]) => right.length - left.length)
      .forEach(([englishValue, translatedPhrase]) => {
         translatedValue = translatedValue.replace(getPhrasePattern(englishValue), (_match, leadingBoundary, _phrase, trailingBoundary) => {
            return `${leadingBoundary}${translatedPhrase}${trailingBoundary}`;
         });
      });

   return translatedValue === value ? null : translatedValue;
}

function localizeTextNode(node: Text, locale: LocaleCode, phraseMap: Map<string, string>) {
   const currentValue = node.nodeValue ?? '';

   if (locale === 'en') {
      const originalValue = textOriginals.get(node);
      if (translatedTextNodes.has(node) && originalValue && currentValue !== originalValue) {
         node.nodeValue = originalValue;
      }
      translatedTextNodes.delete(node);
      return;
   }

   const originalValue = translatedTextNodes.has(node) ? (textOriginals.get(node) ?? currentValue) : currentValue;
   const translatedValue = getTranslation(phraseMap, originalValue) ?? translateKnownPhrases(phraseMap, originalValue);
   if (!translatedValue) return;

   const leadingWhitespace = originalValue.match(/^\s*/)?.[0] ?? '';
   const trailingWhitespace = originalValue.match(/\s*$/)?.[0] ?? '';
   const nextValue = `${leadingWhitespace}${translatedValue}${trailingWhitespace}`;

   if (currentValue !== nextValue) {
      textOriginals.set(node, originalValue);
      translatedTextNodes.add(node);
      node.nodeValue = nextValue;
   }
}

function localizeElementAttributes(element: Element, locale: LocaleCode, phraseMap: Map<string, string>) {
   LOCALIZED_ATTRIBUTES.forEach((attributeName) => {
      const currentValue = element.getAttribute(attributeName);
      if (!currentValue) return;

      if (locale === 'en') {
         const originalValue = attributeOriginals.get(element)?.get(attributeName);
         if (originalValue && currentValue !== originalValue) {
            element.setAttribute(attributeName, originalValue);
         }
         attributeOriginals.get(element)?.delete(attributeName);
         return;
      }

      const originalValue = attributeOriginals.get(element)?.get(attributeName) ?? currentValue;
      const translatedValue = getTranslation(phraseMap, originalValue);
      if (translatedValue && currentValue !== translatedValue) {
         let originalAttributes = attributeOriginals.get(element);
         if (!originalAttributes) {
            originalAttributes = new Map<string, string>();
            attributeOriginals.set(element, originalAttributes);
         }
         originalAttributes.set(attributeName, originalValue);
         element.setAttribute(attributeName, translatedValue);
      }
   });

   if (element instanceof HTMLInputElement && ['button', 'submit', 'reset'].includes(element.type)) {
      const currentValue = element.value;
      if (!currentValue) return;

      if (locale === 'en') {
         const originalValue = attributeOriginals.get(element)?.get('value');
         if (originalValue && currentValue !== originalValue) {
            element.value = originalValue;
         }
         attributeOriginals.get(element)?.delete('value');
         return;
      }

      const originalValue = attributeOriginals.get(element)?.get('value') ?? currentValue;
      const translatedValue = getTranslation(phraseMap, originalValue);
      if (translatedValue && currentValue !== translatedValue) {
         let originalAttributes = attributeOriginals.get(element);
         if (!originalAttributes) {
            originalAttributes = new Map<string, string>();
            attributeOriginals.set(element, originalAttributes);
         }
         originalAttributes.set('value', originalValue);
         element.value = translatedValue;
      }
   }
}

function shouldSkipElement(element: Element) {
   return Boolean(element.closest('[data-i18n-skip], script, style, textarea, code, pre'));
}

function localizeNode(root: Node, locale: LocaleCode, phraseMap: Map<string, string>) {
   if (root.nodeType === Node.TEXT_NODE) {
      const parentElement = root.parentElement;
      if (!parentElement || shouldSkipElement(parentElement)) return;
      localizeTextNode(root as Text, locale, phraseMap);
      return;
   }

   if (root.nodeType !== Node.ELEMENT_NODE) return;

   const rootElement = root as Element;
   if (shouldSkipElement(rootElement)) return;

   localizeElementAttributes(rootElement, locale, phraseMap);

   const walker = document.createTreeWalker(rootElement, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
   let nextNode = walker.nextNode();

   while (nextNode) {
      if (nextNode.nodeType === Node.TEXT_NODE) {
         const parentElement = nextNode.parentElement;
         if (parentElement && !shouldSkipElement(parentElement)) {
            localizeTextNode(nextNode as Text, locale, phraseMap);
         }
      }

      if (nextNode.nodeType === Node.ELEMENT_NODE) {
         const element = nextNode as Element;
         if (!shouldSkipElement(element)) {
            localizeElementAttributes(element, locale, phraseMap);
         }
      }

      nextNode = walker.nextNode();
   }
}

export function LocalizationDomBridge({ locale }: { locale: LocaleCode }) {
   const phraseMap = useMemo(() => buildPhraseMap(locale), [locale]);

   useEffect(() => {
      if (typeof document === 'undefined') return;

      const localizeDocument = () => {
         if (document.body) {
            localizeNode(document.body, locale, phraseMap);
         }
      };

      localizeDocument();

      const observer = new MutationObserver((mutations) => {
         mutations.forEach((mutation) => {
            if (mutation.type === 'characterData') {
               localizeNode(mutation.target, locale, phraseMap);
               return;
            }

            if (mutation.type === 'attributes') {
               localizeNode(mutation.target, locale, phraseMap);
               return;
            }

            mutation.addedNodes.forEach((node) => {
               localizeNode(node, locale, phraseMap);
            });
         });
      });

      observer.observe(document.body, {
         attributeFilter: [...LOCALIZED_ATTRIBUTES],
         attributes: true,
         characterData: true,
         childList: true,
         subtree: true
      });

      return () => observer.disconnect();
   }, [locale, phraseMap]);

   return null;
}
