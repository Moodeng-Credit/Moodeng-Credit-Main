import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { RUNG, shouldReleaseSlot, skipsDayBeforeReminder, skipsKeepSpot, targetRung } from './lib.ts';

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

Deno.test('the ladder: each window maps to its rung', () => {
   assertEquals(targetRung(30 * 60), RUNG.NONE);
   assertEquals(targetRung(20 * 60), RUNG.DAY);
   assertEquals(targetRung(120), RUNG.KEEP_SPOT);
   assertEquals(targetRung(65), RUNG.HOUR);
   assertEquals(targetRung(4), RUNG.STARTING);
   assertEquals(targetRung(-2), RUNG.STARTING);
   assertEquals(targetRung(-5), RUNG.WAITING);
   assertEquals(targetRung(-25), RUNG.PROMPT);
   assertEquals(targetRung(-61), RUNG.AUTO_NO_SHOW);
});

Deno.test('no "keep your spot" ask when they booked under 3h ago', () => {
   assertEquals(skipsKeepSpot(new Date(start - 2 * H).toISOString(), start), true);
   assertEquals(skipsKeepSpot(new Date(start - 5 * H).toISOString(), start), false);
});

Deno.test('a slot is released only if unconfirmed AND the ask verifiably reached them', () => {
   const base = { video_call_confirmed_at: null, video_call_keep_spot_asked_at: '2026-09-25T06:00:00Z', video_call_booking_uid: 'uid1' };
   assertEquals(shouldReleaseSlot(base), true);
   assertEquals(shouldReleaseSlot({ ...base, video_call_confirmed_at: '2026-09-25T06:10:00Z' }), false);
   assertEquals(shouldReleaseSlot({ ...base, video_call_keep_spot_asked_at: null }), false);
   assertEquals(shouldReleaseSlot({ ...base, video_call_booking_uid: null }), false);
});
