import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { buildPartialRepaymentCopy } from './partialRepaymentNotice.ts';
import { buildPartialRepaymentPushPayload, PUSH_LOCALES } from './pushMessages.ts';

Deno.test('partial repayment copy says what was paid, what is left, and how to undo a mistake', () => {
   const copy = buildPartialRepaymentCopy({ name: 'maria', paid: 15, repaid: 15, total: 18, dueDate: '2026-12-16T00:00:00+00:00' });
   assertEquals(copy.subject, 'We got your $15.00 payment, $3.00 left');
   assert(copy.text.includes('You\'ve now paid $15.00 of $18.00. $3.00 is left, due Dec 16, 2026.'));
   assert(copy.text.includes("Didn't mean to make this payment?"));
   assert(copy.messenger.includes('Hindi mo sinasadyang magbayad?'));
});

Deno.test('partial repayment copy never shows a negative balance', () => {
   const copy = buildPartialRepaymentCopy({ name: null, paid: 5, repaid: 20, total: 18, dueDate: null });
   assert(copy.subject.endsWith('$0.00 left'));
   assert(copy.text.startsWith('Hi there,'));
});

Deno.test('partial repayment push names the amount paid and left in every locale', () => {
   for (const locale of PUSH_LOCALES) {
      const push = buildPartialRepaymentPushPayload({ paid: 15, left: 3 }, locale);
      assertEquals(push.type, 'partial_repayment');
      assert(push.title.includes('$15.00'));
      assert(push.body.includes('$3.00'));
      assert(push.url.endsWith('/repay'));
   }
});
