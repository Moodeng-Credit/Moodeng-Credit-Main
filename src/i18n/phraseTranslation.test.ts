import { describe, expect, it } from 'vitest';

import { buildPhraseMap, getTranslation, translateKnownPhrases } from '@/i18n/phraseTranslation';

// Labels Indonesian-locale borrowers actually saw half-translated in the loan request (PostHog,
// Sep 2026). With no full translation of their own, they must stay in English rather than have
// single words swapped mid-sentence.
describe('translateKnownPhrases', () => {
   const indonesian = buildPhraseMap('id');

   it.each(['Make Your Request', 'Continue to application', 'Set Repayment Date', 'Verify Yourself >', 'Create An Account'])(
      'leaves "%s" readable instead of swapping single words',
      (label) => {
         expect(translateKnownPhrases(indonesian, label)).toBeNull();
      }
   );

   it('still swaps a known multi-word phrase inside a longer string', () => {
      const [phrase, translated] = Array.from(indonesian.entries()).find(([english]) => english === 'Request Board') ?? [];
      expect(phrase).toBe('Request Board');
      expect(translateKnownPhrases(indonesian, 'Open the Request Board today')).toContain(translated);
   });
});

describe('buildPhraseMap with lazily loaded coverage', () => {
   it('adds coverage phrases but lets screen translations win', () => {
      const phraseMap = buildPhraseMap('id', { 'A coverage-only phrase': 'Frasa cakupan', 'Transaction History': 'Salah' });
      expect(phraseMap.get('A coverage-only phrase')).toBe('Frasa cakupan');
      expect(phraseMap.get('Transaction History')).toBe(buildPhraseMap('id').get('Transaction History'));
   });

   it.each(['fil', 'id', 'th', 'vi'] as const)('loads the %s coverage chunk', async (locale) => {
      const { loadScreenCoverage } = await import('@/i18n/coverage');
      const coverage = await loadScreenCoverage(locale);
      Object.entries(coverage).forEach(([english, translated]) => {
         expect(translated.trim(), english).not.toBe('');
      });
   });
});

describe('getTranslation for a number with no translation of its own', () => {
   const map = buildPhraseMap('fil', {
      'Repay on time to reach Level 2 — up to $20.': 'Magbayad on time para maabot ang Level 2 — hanggang $20.',
      'Repay your $20 loan on time': 'Bayaran on time ang $20 loan mo',
      'Pay $5 on day 5': 'Magbayad ng $5 sa araw 5',
      'Only 3 left': 'Natitira: 3 at 2 pa'
   });

   it('reuses the translation written for another number', () => {
      expect(getTranslation(map, 'Repay on time to reach Level 3 — up to $35.')).toBe('Magbayad on time para maabot ang Level 3 — hanggang $35.');
      expect(getTranslation(map, 'Repay your $25 loan on time')).toBe('Bayaran on time ang $25 loan mo');
   });

   it('keeps an exact translation first', () => {
      expect(getTranslation(map, 'Repay your $20 loan on time')).toBe('Bayaran on time ang $20 loan mo');
   });

   it('does not guess when the numbers are ambiguous or the translation adds its own', () => {
      expect(getTranslation(map, 'Pay $6 on day 6')).toBeNull();
      expect(getTranslation(map, 'Only 4 left')).toBeNull();
      expect(getTranslation(map, 'Something else with 7')).toBeNull();
   });
});
