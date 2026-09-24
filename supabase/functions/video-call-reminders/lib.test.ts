import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { skipsDayBeforeReminder } from './lib.ts';

const H = 60 * 60 * 1000;
const start = Date.parse('2026-09-25T08:00:00Z');

Deno.test('a call booked for later today skips the day-before nudge (the confirmation covers it)', () => {
   assertEquals(skipsDayBeforeReminder(new Date(start - 5 * H).toISOString(), start), true);
});

Deno.test('a call booked two days ahead still gets the day-before nudge', () => {
   assertEquals(skipsDayBeforeReminder(new Date(start - 48 * H).toISOString(), start), false);
});

Deno.test('an unknown booking time never suppresses a reminder', () => {
   assertEquals(skipsDayBeforeReminder(null, start), false);
   assertEquals(skipsDayBeforeReminder('garbage', start), false);
});
