import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { guessIntent, isEarly, mentionsLoanTiming, timingReply } from './messengerLoanTiming.ts';

const NOW = Date.parse('2026-11-20T05:00:00Z');
const loan = (dueInDays: number) => ({ funded_at: '2026-11-18T05:00:00Z', due_date: new Date(NOW + dueInDays * 86_400_000).toISOString(), due_timezone: 'Asia/Manila', owed: 17.5 });

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

Deno.test('early = before the 2nd half of the loan', () => {
   assert(isEarly(loan(20), NOW));
   // Funded 2 days ago, due tomorrow: the 2nd half has started.
   assert(!isEarly(loan(1), NOW));
   assert(!isEarly(null, NOW));
});

Deno.test('replies: set term, 2nd-half window, repay button only when in the window', () => {
   const term = timingReply('term', loan(20), 'en', NOW);
   assert(term.includes('yours is 2 days') || term.includes('set term'));
   assert(term.includes('2nd half of your loan'));
   // Funded Nov 18, due Dec 10 (Manila): the 2nd half starts Nov 29.
   assert(term.includes('Nov 29 to Dec 10'), term);
   assert(timingReply('early', loan(20), 'en', NOW).includes("doesn't help your limit"));
   assert(timingReply('early', loan(1), 'en', NOW).includes('good time to pay'));
   assert(timingReply('again', null, 'fil', NOW).includes('2 loan sa isang buwan'));
});
