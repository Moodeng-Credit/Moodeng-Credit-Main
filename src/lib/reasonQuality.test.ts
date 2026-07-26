import { describe, expect, it } from 'vitest';

import { checkReasonQuality } from '@/lib/reasonQuality';

describe('reason quality', () => {
   it('confirms a real reason', () => {
      expect(checkReasonQuality('Pambayad sa tuition ng anak ko, sahod ako sa Friday').ok).toBe(true);
      expect(checkReasonQuality('I need to buy medicine for my mother and I get paid on the 15th').ok).toBe(true);
      expect(checkReasonQuality('Groceries for my family until my next payday on Nov 30').ok).toBe(true);
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
      expect(checkReasonQuality('   ')).toEqual({ ok: false, hint: '' });
   });

   it('does not scold short but real Taglish', () => {
      expect(checkReasonQuality('Pang bayad sa kuryente namin ngayong buwan').ok).toBe(true);
      expect(checkReasonQuality('Load and fare para makapasok sa trabaho').ok).toBe(true);
   });

   it('tolerates numbers, currency and dates alongside words', () => {
      expect(checkReasonQuality('Rent balance of $80 due on 09/12, sahod ako sa 15').ok).toBe(true);
   });
});
