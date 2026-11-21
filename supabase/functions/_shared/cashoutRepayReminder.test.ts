import { assert, assertEquals } from 'jsr:@std/assert@1';
import { buildCashoutMessengerText, pickNextRepay, repayLine } from './cashoutRepayReminder.ts';

const now = new Date('2026-11-21T14:00:00Z'); // Nov 21, 22:00 Manila

Deno.test('pickNextRepay: soonest open loan, what is left on it', () => {
   const repay = pickNextRepay([
      { due_date: '2026-12-20T00:00:00.000Z', total_repayment_amount: 22, repaid_amount: 0 },
      { due_date: '2026-12-05T00:00:00.000Z', total_repayment_amount: 16.5, repaid_amount: 5 }
   ]);
   assertEquals(repay, { amount: 11.5, dueIso: '2026-12-05T00:00:00.000Z' });
});

Deno.test('pickNextRepay: skips fully paid loans, null when nothing owed', () => {
   assertEquals(pickNextRepay([{ due_date: '2026-12-05T00:00:00.000Z', total_repayment_amount: 16.5, repaid_amount: 16.5 }]), null);
   assertEquals(pickNextRepay([]), null);
});

Deno.test('pickNextRepay: two-payment loan asks for the next part', () => {
   const repay = pickNextRepay([
      {
         due_date: '2026-12-30T00:00:00.000Z',
         total_repayment_amount: 110,
         repaid_amount: 0,
         repayment_schedule: [
            { due: '2026-12-15', amount: 55 },
            { due: '2026-12-30', amount: 55 }
         ]
      }
   ]);
   assertEquals(repay, { amount: 55, dueIso: '2026-12-15T00:00:00.000Z' });
});

Deno.test('repayLine: due date ahead vs overdue', () => {
   assertEquals(
      repayLine({ amount: 16.5, dueIso: '2026-12-05T00:00:00.000Z' }, now),
      "Don't forget: repay 16.5 USDC by Dec 5, 2026 to level up to bigger loans."
   );
   // Due today is not overdue yet.
   assert(repayLine({ amount: 16.5, dueIso: '2026-11-21T00:00:00.000Z' }, now).startsWith("Don't forget"));
   assert(repayLine({ amount: 16.5, dueIso: '2026-11-20T00:00:00.000Z' }, now).includes('overdue'));
});

Deno.test('buildCashoutMessengerText: with and without a loan', () => {
   const withLoan = buildCashoutMessengerText(15, 'GCrypto', { amount: 16.5, dueIso: '2026-12-05T00:00:00.000Z' }, now);
   assert(withLoan.startsWith('✅ Cash-out sent! Your 15 USDC is on its way to GCrypto.'));
   assert(withLoan.includes('repay 16.5 USDC by Dec 5, 2026'));
   assert(withLoan.includes('https://moodeng.app/repay'));
   const noLoan = buildCashoutMessengerText(15, 'GCrypto', null, now);
   assert(!noLoan.includes('repay'));
});
