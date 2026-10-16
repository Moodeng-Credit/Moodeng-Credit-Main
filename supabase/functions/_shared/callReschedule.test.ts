import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { bangkokDay, buildRescheduleCallback, dayView, daysView, parseRescheduleCallback, startKey } from './callReschedule.ts';

const USER = '8dd3bb85-e8f8-4f21-aedc-016ba68bc35b';
const call = {
   id: USER,
   username: 'jijitoting',
   display_name: 'Jiji',
   email: null,
   video_call_starts_at: '2026-10-17T09:00:00.000Z',
   video_call_timezone: 'Asia/Manila',
   video_call_booking_uid: 'abc',
   video_call_host: 'emma'
};

Deno.test('callbacks round-trip and fit in 64 bytes', () => {
   const start = '2026-10-18T09:15:00.000Z';
   for (const data of [
      buildRescheduleCallback('open', USER),
      buildRescheduleCallback('day', USER, bangkokDay(start)),
      buildRescheduleCallback('slot', USER, startKey(start)),
      buildRescheduleCallback('yes', USER, startKey(start))
   ]) {
      assert(new TextEncoder().encode(data).length <= 64, data);
      assertEquals(parseRescheduleCallback(data)?.userId, USER);
   }
   assertEquals(parseRescheduleCallback(buildRescheduleCallback('yes', USER, startKey(start)))?.arg, startKey(start));
   assertEquals(parseRescheduleCallback('vc:a:' + USER), null);
});

Deno.test('days group by Bangkok date; a day lists its times', () => {
   // 23:30 UTC on the 17th is 06:30 on the 18th in Bangkok.
   const slots = ['2026-10-17T10:00:00.000Z', '2026-10-17T23:30:00.000Z', '2026-10-18T09:15:00.000Z'];
   const days = daysView(call, slots);
   assertEquals(days.keyboard.length, 2); // one row of two days + Close
   assertEquals(days.keyboard[0].map((b) => b.text), ['Sat, Oct 17 · 1', 'Sun, Oct 18 · 2']);
   const sunday = dayView(call, slots, '20261018');
   assertEquals(sunday.keyboard[0].map((b) => b.text), ['6:30 AM', '4:15 PM']);
   assert(daysView(call, []).text.includes('No free times'));
});
