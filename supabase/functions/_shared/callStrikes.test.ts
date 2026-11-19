import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { countMissedCalls, countReschedules, strikeVerdict } from './callStrikes.ts';

Deno.test('one missed call logged twice a moment apart is one strike', () => {
   assertEquals(countMissedCalls(['2026-11-17T13:46:04Z', '2026-11-17T13:46:05Z']), 1);
});

Deno.test('two separate missed calls are two strikes; nulls are ignored', () => {
   assertEquals(countMissedCalls(['2026-11-17T13:46:04Z', null, '2026-11-19T12:31:04Z']), 2);
});

Deno.test('reschedules: bookings after the first, plus their own Cal.com moves', () => {
   assertEquals(countReschedules(0, 0), 0);
   assertEquals(countReschedules(1, 0), 0);
   assertEquals(countReschedules(3, 1), 3);
});

const base = { missed: 0, bookings: 1, reschedules: 0, exempt: false };

Deno.test('2nd missed call rejects', () => {
   assertEquals(strikeVerdict({ ...base, missed: 1 }), null);
   assertEquals(strikeVerdict({ ...base, missed: 2 }), 'missed_calls');
});

Deno.test('3rd reschedule rejects, counting the booking about to be made', () => {
   assertEquals(strikeVerdict({ ...base, reschedules: 2 }), null);
   assertEquals(strikeVerdict({ ...base, reschedules: 2 }, { extraReschedule: true }), 'too_many_reschedules');
   assertEquals(strikeVerdict({ ...base, reschedules: 3 }), 'too_many_reschedules');
});

Deno.test('attended, approved or already rejected people are never auto-rejected', () => {
   assertEquals(strikeVerdict({ ...base, missed: 5, reschedules: 9, exempt: true }), null);
});
