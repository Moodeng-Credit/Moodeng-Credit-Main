import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { decideTimingMatch, type TimingAttempt } from './messengerTimingMatch.ts';

const T0 = Date.parse('2026-10-11T03:00:00Z');
const sec = 1000;
const at = (offsetSec: number) => new Date(T0 + offsetSec * sec).toISOString();
const tap = (user: string, offsetSec: number, code = `MDNG-${user.toUpperCase().padEnd(6, '0').slice(0, 6)}`): TimingAttempt => ({
   code,
   user_id: user,
   chat_opened_at: at(offsetSec)
});

Deno.test('connects the one borrower who tapped Open Messenger in the last minute', () => {
   const decision = decideTimingMatch(T0, [tap('aaa', -20)]);
   assertEquals(decision.kind, 'auto');
   if (decision.kind === 'auto') assertEquals(decision.attempt.user_id, 'aaa');
});

Deno.test('does nothing when nobody tapped recently', () => {
   assertEquals(decideTimingMatch(T0, []).kind, 'none');
   assertEquals(decideTimingMatch(T0, [tap('aaa', -61)]).kind, 'none');
});

Deno.test('never guesses between two borrowers in the same minute', () => {
   const decision = decideTimingMatch(T0, [tap('aaa', -40), tap('bbb', -10)]);
   assertEquals(decision.kind, 'ambiguous');
   if (decision.kind === 'ambiguous') assertEquals(decision.userIds.sort(), ['aaa', 'bbb']);
});

Deno.test('one borrower tapping twice is still one borrower; their latest code wins', () => {
   const decision = decideTimingMatch(T0, [tap('aaa', -50, 'MDNG-AAA001'), tap('aaa', -5, 'MDNG-AAA002')]);
   assertEquals(decision.kind, 'auto');
   if (decision.kind === 'auto') assertEquals(decision.attempt.code, 'MDNG-AAA002');
});

Deno.test('an older tap outside the minute does not make it ambiguous', () => {
   const decision = decideTimingMatch(T0, [tap('old', -90), tap('aaa', -15)]);
   assertEquals(decision.kind, 'auto');
   if (decision.kind === 'auto') assertEquals(decision.attempt.user_id, 'aaa');
});

Deno.test('tolerates a few seconds of clock skew, but not a tap well after the chat', () => {
   assertEquals(decideTimingMatch(T0, [tap('aaa', 4)]).kind, 'auto');
   assertEquals(decideTimingMatch(T0, [tap('aaa', 30)]).kind, 'none');
});

Deno.test('ignores rows with a bad timestamp', () => {
   assertEquals(decideTimingMatch(T0, [{ code: 'MDNG-AAAAAA', user_id: 'aaa', chat_opened_at: 'nope' }]).kind, 'none');
});
