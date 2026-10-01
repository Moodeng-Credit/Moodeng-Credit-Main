import { afterEach, describe, expect, it } from 'vitest';

import { currentSentences, SENTENCES } from '@/i18n/sentences';
import { SUPPORTED_LOCALES } from '@/i18n/translations';

describe('SENTENCES', () => {
   afterEach(() => {
      document.documentElement.lang = 'en';
   });

   it.each(SUPPORTED_LOCALES.map((l) => l.code))('%s keeps the number and the name', (code) => {
      const s = SENTENCES[code];
      expect(s.uniqueLenders(3)).toContain('3');
      expect(s.moreCharactersToGo(7)).toContain('7');
      expect(s.fundLoanTitle('Maria')).toContain('Maria');
      expect(s.fundedLoanBody('Maria')).toContain('Maria');
      expect(s.transferAddress('Binance')).toContain('Binance');
      expect(s.quizRestartConfirm.length).toBeGreaterThan(10);
   });

   it('keeps the original English', () => {
      expect(SENTENCES.en.uniqueLenders(1)).toBe('1 Unique Lender');
      expect(SENTENCES.en.moreCharactersToGo(2)).toBe('2 more characters to go');
      expect(SENTENCES.en.fundLoanTitle('Ana')).toBe('Fund Ana’s loan');
   });

   it('reads the current language for plain helpers', () => {
      document.documentElement.lang = 'id';
      expect(currentSentences()).toBe(SENTENCES.id);
   });
});
