import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { buildNextLoanReadText, describeTiming } from './repayNextLoanRead.ts';

const funded = '2026-11-16T15:04:22Z';
const due = '2026-12-16T00:00:00Z';

Deno.test('repaid ~40h after funding on a 30-day loan is very_early', () => {
   const t = describeTiming({ id: 'x', funded_at: funded, due_date: due, repaid_at: '2026-11-18T06:48:59Z' });
   assertEquals(t.label, 'very_early');
   assertStringIncludes(t.line, '40h after funding');
});

Deno.test('repaid a week into a 30-day loan is early', () => {
   assertEquals(describeTiming({ id: 'x', funded_at: funded, due_date: due, repaid_at: '2026-11-23T00:00:00Z' }).label, 'early');
});

Deno.test('repaid a few days before due is near_on_time', () => {
   assertEquals(describeTiming({ id: 'x', funded_at: funded, due_date: due, repaid_at: '2026-12-12T00:00:00Z' }).label, 'near_on_time');
});

Deno.test('repaid on the due day is near_on_time, two days after is late', () => {
   assertEquals(describeTiming({ id: 'x', funded_at: funded, due_date: due, repaid_at: '2026-12-16T15:00:00Z' }).label, 'near_on_time');
   assertEquals(describeTiming({ id: 'x', funded_at: funded, due_date: due, repaid_at: '2026-12-18T15:00:00Z' }).label, 'late');
});

Deno.test('message shows verdict, next amount and reasons', () => {
   const text = buildNextLoanReadText({
      username: 'someone',
      loanAmount: 15,
      nextAmount: 25,
      verified: true,
      cap: null,
      timingLine: 'Paid 40h after funding.',
      hasSheet: true,
      siblingsLine: 'Same referral code: 3 others',
      read: { verdict: 'check', timing: 'suspicious_early', afford: 'yes', reasons: ['a', 'b', 'c', 'd'], ask_on_messenger: 'What did you restock?' }
   });
   assertStringIncludes(text, '🟡 Check with them first');
   assertStringIncludes(text, 'up to $25 (this one $15)');
   assertStringIncludes(text, '⚠️ suspiciously early');
   assertStringIncludes(text, 'Ask: What did you restock?');
   assertEquals(text.includes('• d'), false);
});
