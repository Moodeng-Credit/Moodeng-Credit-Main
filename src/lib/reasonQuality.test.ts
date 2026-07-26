import { describe, expect, it } from 'vitest';

import { checkReasonQuality, looksNotEnglish } from '@/lib/reasonQuality';

describe('reason quality', () => {
   it('confirms a real English reason', () => {
      expect(checkReasonQuality('I need to buy medicine for my mother and I get paid on the 15th').ok).toBe(true);
      expect(checkReasonQuality('Groceries for my family until my next payday on Nov 30').ok).toBe(true);
      expect(checkReasonQuality('Rent balance is due Friday and I am short by $30').ok).toBe(true);
   });

   it('rejects keyboard mash that clears the character minimum', () => {
      const result = checkReasonQuality('dwadpajdiwajdwadwadpjawojdawiodawdawdawdawdwad');
      expect(result.ok).toBe(false);
      expect(result.hint).not.toBe('');
   });

   it('rejects mash broken up with spaces', () => {
      expect(checkReasonQuality('asdkjh qwlkej zxcvbn mnbvcx qwerty asdfgh').ok).toBe(false);
   });

   it('rejects one word repeated to pad the counter', () => {
      expect(checkReasonQuality('money money money money money money money').ok).toBe(false);
   });

   it('stays quiet on empty input', () => {
      expect(checkReasonQuality('   ')).toEqual({ ok: false, hint: '', code: 'empty' });
   });

   describe('English only — lenders are US/EU and cannot read Tagalog', () => {
      it('rejects Tagalog and Taglish', () => {
         const taglish = checkReasonQuality('Pambayad sa tuition ng anak ko, sahod ako sa Friday');
         expect(taglish.ok).toBe(false);
         expect(taglish.hint).toContain('English');
         expect(checkReasonQuality('Kailangan ko ng pambili ng gamot para sa nanay ko').ok).toBe(false);
         expect(checkReasonQuality('Pang bayad sa kuryente namin ngayong buwan').ok).toBe(false);
      });

      it('rejects scripts no lender can read', () => {
         expect(checkReasonQuality('我需要钱来支付我母亲的医疗费用和交通费').hint).toContain('English');
      });

      it('does not fail English over a single borrowed or ambiguous word', () => {
         // "para" (para-athlete), "na" (initials), "sa" (South Africa) each appear in English.
         expect(checkReasonQuality('Saving up for the para athletics meet entry fee in March').ok).toBe(true);
         expect(checkReasonQuality('Buying gamot for my mother, she needs it before Friday').ok).toBe(true);
      });
   });

   // Used on its own by the bio step's "describe your situation" field, where the shape rules
   // (four words, character minimum) don't apply but the English rule still does.
   describe('looksNotEnglish on its own', () => {
      it('flags Tagalog and Bisaya prose', () => {
         expect(looksNotEnglish('Tindera ako sa palengke, kita ko araw araw')).toBe(true);
         expect(looksNotEnglish('Nagtatrabaho ako sa construction, sahod tuwing Sabado')).toBe(true);
         expect(looksNotEnglish('Naa koy gamay nga tindahan sa amoang balay')).toBe(true);
      });

      it('leaves English descriptions alone', () => {
         expect(looksNotEnglish('I run a small online shop and income changes month to month')).toBe(false);
         expect(looksNotEnglish('I drive a jeepney six days a week and get paid daily')).toBe(false);
      });

      it('does not flag a local job title', () => {
         expect(looksNotEnglish('sari-sari store owner')).toBe(false);
         expect(looksNotEnglish('jeepney driver')).toBe(false);
         expect(looksNotEnglish('palengke vendor')).toBe(false);
      });

      it('is quiet on empty input', () => {
         expect(looksNotEnglish('  ')).toBe(false);
      });
   });

   it('tolerates numbers, currency and dates alongside words', () => {
      expect(checkReasonQuality('Rent balance of $80 due on 09/12, I get paid on the 15th').ok).toBe(true);
   });
});
