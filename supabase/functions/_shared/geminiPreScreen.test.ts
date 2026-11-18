import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { clipWarnings, toClipCheck, toIncomeRead } from './geminiPreScreen.ts';

Deno.test('toIncomeRead: unreadable keeps the reason, drops the type', () => {
   const r = toIncomeRead({ readable: false, problem: 'Blurry photo', doc_type: 'payslip' });
   assertEquals(r?.readable, false);
   assertEquals(r?.problem, 'Blurry photo');
   assertEquals(r?.doc_type, null);
});

Deno.test('toIncomeRead: numbers from strings, unknown type → other, warnings capped', () => {
   const r = toIncomeRead({
      readable: true,
      doc_type: 'crypto_wallet',
      monthly_income_usd: '210.5',
      months_covered: 1,
      transactions: 7.4,
      warnings: ['a', '', 3, 'b']
   });
   assertEquals(r?.doc_type, 'other');
   assertEquals(r?.monthly_income_usd, 210.5);
   assertEquals(r?.transactions, 7);
   assertEquals(r?.warnings, ['a', 'b']);
   assertEquals(toIncomeRead(null), null);
});

Deno.test('clipWarnings: only what is clearly off', () => {
   assertEquals(clipWarnings(null), []);
   assertEquals(clipWarnings(toClipCheck({ person_visible: true, one_person: true, live_person: true, reading: false, note: 'ok' })), []);
   assertEquals(clipWarnings(toClipCheck({ person_visible: false, reading: true, one_person: null })), [
      'no face on camera',
      'reading from a script'
   ]);
});
