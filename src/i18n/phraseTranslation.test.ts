import { describe, expect, it } from 'vitest';

import { buildPhraseMap, translateKnownPhrases } from '@/i18n/phraseTranslation';

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
