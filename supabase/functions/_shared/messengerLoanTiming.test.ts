import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { guessIntent, isEarly, mentionsLoanTiming, timingReply } from './messengerLoanTiming.ts';

const NOW = Date.parse('2026-11-20T05:00:00Z');
const loan = (dueInDays: number) => ({ funded_at: '2026-11-18T05:00:00Z', due_date: new Date(NOW + dueInDays * 86_400_000).toISOString(), due_timezone: 'Asia/Manila', owed: 17.5 });
// Funded after both switches (2nd-half rule 11-27, low-income ladder 11-28).
const NEW_NOW = Date.parse('2026-12-04T05:00:00Z');
const newLoan = (low = false) => ({ funded_at: '2026-12-01T05:00:00Z', due_date: '2026-12-31T00:00:00Z', due_timezone: 'Asia/Manila', owed: 16.5, low_income: low });

Deno.test('word check: timing questions in English and Tagalog', () => {
   assert(mentionsLoanTiming('kailan ko babayaran?'));
   assert(mentionsLoanTiming('can I pay back in 1 week'));
   assert(!mentionsLoanTiming('hello po'));
});

Deno.test('guessIntent: extensions and cannot-pay stay with a person', () => {
   assertEquals(guessIntent('can I get an extension, cannot pay this week'), 'other');
   assertEquals(guessIntent('pwede ba magbayad ngayon'), 'early');
   assertEquals(guessIntent('can I borrow again tomorrow'), 'again');
   assertEquals(guessIntent('kailan due date ko'), 'term');
});

Deno.test('early follows the server rule: old loans 48h, new loans 2nd half, low income pays anytime', () => {
   // Funded Nov 18 (before the switch): 48 hours have passed, so paying now is NOT early.
   assert(!isEarly(loan(20), NOW));
   assert(!isEarly(null, NOW));
   // Funded Dec 1: day 3 is early on the 2nd-half rule; low income can pay anytime (2026-11-28).
   assert(isEarly(newLoan(), NEW_NOW));
   assert(!isEarly(newLoan(true), NEW_NOW));
   assert(!isEarly(newLoan(true), Date.parse('2026-12-01T06:00:00Z')));
   const day8 = Date.parse('2026-12-09T05:00:00Z');
   assert(isEarly(newLoan(), day8));
   assert(!isEarly(newLoan(true), day8));
});

Deno.test('replies: set term, 2nd-half window, repay button only when in the window', () => {
   const term = timingReply('term', loan(20), 'en', NOW);
   assert(term.includes('yours is 2 days') || term.includes('set term'));
   assert(term.includes('2nd half of your loan'));
   // Funded Nov 18, due Dec 10 (Manila): the 2nd half starts Nov 29.
   assert(term.includes('Nov 29 to Dec 10'), term);
   assert(timingReply('early', newLoan(), 'en', NEW_NOW).includes("doesn't help your limit"));
   // Low income: pay anytime, the spin unlocks 3 days after funding (Dec 4).
   const low = timingReply('term', newLoan(true), 'en', Date.parse('2026-12-02T05:00:00Z'));
   assert(low.includes('pay anytime') && low.includes('unlocks Dec 4') && !low.includes('2nd half'), low);
   assert(timingReply('early', newLoan(true), 'en', Date.parse('2026-12-02T05:00:00Z')).includes('good time to pay'));
   assert(timingReply('early', loan(1), 'en', NOW).includes('good time to pay'));
   assert(timingReply('again', null, 'fil', NOW).includes('2 loan sa isang buwan'));
});
