import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { ceilCents, centsToText, pickFreeCents, repayBlocker, unitsToDecimal, unitsToExactCents, waltUsernameOf } from './idRepayments.ts';

Deno.test('exact amounts: cents rounded up, no float drift', () => {
   assertEquals(ceilCents(6.08), 608);
   assertEquals(ceilCents(6.081), 609);
   assertEquals(ceilCents(0.1 + 0.2), 30);
   assertEquals(ceilCents(12.345), 1235);
   assertEquals(centsToText(608), '6.08');
   assertEquals(centsToText(5), '0.05');
   assertEquals(centsToText(1000), '10.00');
});

Deno.test('a free amount: nearest unused cent, a few below first, then up', () => {
   assertEquals(pickFreeCents(608, new Set()), 608);
   assertEquals(pickFreeCents(608, new Set([608])), 607);
   assertEquals(pickFreeCents(608, new Set([608, 607])), 609);
   assertEquals(pickFreeCents(608, new Set([608, 607, 609, 606, 610, 605, 611, 604, 612])), 613);
   assertEquals(pickFreeCents(2, new Set([2])), 1);
   assertEquals(pickFreeCents(1, new Set([1])), 2); // never 0
   assertEquals(pickFreeCents(608, new Set([608, 607, 609]), 1, 1), null);
});

Deno.test('units ↔ cents: only whole cents match (a fee-cut amount never does)', () => {
   assertEquals(unitsToExactCents(6_080_000_000_000_000_000n), 608);
   assertEquals(unitsToExactCents(6_079_000_000_000_000_000n), null);
   assertEquals(unitsToExactCents(6_080_000_000_000_000_001n), null);
   assertEquals(unitsToDecimal(6_080_000_000_000_000_000n), '6.08');
   assertEquals(unitsToDecimal(500_000_000_000_000_000n), '0.5');
   assertEquals(unitsToDecimal(10n ** 18n), '1');
   assertEquals(unitsToDecimal(123n), '0.000000000000000123');
});

Deno.test('only Indonesia loans paid to Walt are repaid to the payout wallet', () => {
   assertEquals(repayBlocker({ market: 'ID', funding_method: 'walt_manual', onchain_loan_id: null }), null);
   assertEquals(repayBlocker({ market: 'ID', funding_method: null, onchain_loan_id: null }), 'on_contract');
   assertEquals(repayBlocker({ market: 'ID', funding_method: 'direct', onchain_loan_id: null }), 'on_contract');
   assertEquals(repayBlocker({ market: 'PH', funding_method: 'walt_manual', onchain_loan_id: null }), 'on_contract');
   assertEquals(repayBlocker({ market: 'ID', funding_method: 'smart_contract', onchain_loan_id: null }), 'on_contract');
   assertEquals(repayBlocker({ market: 'ID', funding_method: 'walt_manual', onchain_loan_id: 7 }), 'on_contract');
});

Deno.test('Walt username setting', () => {
   assertEquals(waltUsernameOf('@jimmymoodengcredit'), 'jimmymoodengcredit');
   assertEquals(waltUsernameOf(' JimmyMoodengCredit '), 'JimmyMoodengCredit');
   assertEquals(waltUsernameOf(''), null);
   assertEquals(waltUsernameOf('ab'), null);
   assertEquals(waltUsernameOf('0x1234567890abcdef1234567890abcdef12345678'), null);
});
