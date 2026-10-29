import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import {
   bangkokDay,
   bookingCooldownUntil,
   calendlyToCalSchedule,
   clusterSlots,
   dayIsFull,
   dropBusySlots,
   hostsFreeAt,
   mergeSlots,
   orderHostsToTry,
   preferHost,
   preferSoonSlots,
   recheckRange,
   teamGuests
} from './lib.ts';

Deno.test('mergeSlots unions hosts, de-dupes by instant, and sorts', () => {
   const george = ['2026-09-22T19:00:00.000+07:00', '2026-09-22T20:00:00.000+07:00'];
   const emma = ['2026-09-22T12:00:00.000Z', '2026-09-22T19:30:00.000+07:00']; // 12:00Z == 19:00+07 (dupe)
   assertEquals(mergeSlots([george, emma]), [
      '2026-09-22T19:00:00.000+07:00',
      '2026-09-22T19:30:00.000+07:00',
      '2026-09-22T20:00:00.000+07:00'
   ]);
});

Deno.test('hostsFreeAt matches by instant, not string formatting', () => {
   const perHost = {
      george: ['2026-09-22T19:00:00.000+07:00'],
      emma: ['2026-09-22T12:00:00.000Z'] // same instant as george's 19:00+07
   };
   assertEquals(hostsFreeAt('2026-09-22T12:00:00.000Z', perHost).sort(), ['emma', 'george']);
   assertEquals(hostsFreeAt('2026-09-22T20:00:00.000+07:00', perHost), []);
});

Deno.test('orderHostsToTry is deterministic, returns all free hosts, preferred first', () => {
   const a = orderHostsToTry(['george', 'emma'], 'user-1:slot');
   const b = orderHostsToTry(['george', 'emma'], 'user-1:slot');
   assertEquals(a, b); // stable for same seed
   assertEquals([...a].sort(), ['emma', 'george']); // both present as fallbacks
   assertEquals(orderHostsToTry(['emma'], 'x'), ['emma']);
   assertEquals(orderHostsToTry([], 'x'), []);
});

Deno.test('different seeds can prefer different hosts (spreads load)', () => {
   const seen = new Set<string>();
   for (const seed of ['a', 'b', 'c', 'd', 'e', 'f']) seen.add(orderHostsToTry(['george', 'emma'], seed)[0]);
   assertEquals(seen.size, 2); // both hosts get picked first across borrowers
});

Deno.test('preferSoonSlots offers the next 48 hours plus weekend times when there are enough', () => {
   const now = Date.parse('2026-09-23T02:00:00Z'); // Wednesday
   const slots = [
      '2026-09-23T04:00:00Z', // Wed
      '2026-09-24T06:00:00Z', // Thu
      '2026-09-24T09:00:00Z', // Thu, still inside 48h
      '2026-09-25T04:00:00Z', // Fri, past 48h — dropped
      '2026-09-26T13:00:00Z', // Sat 8 PM Bangkok — kept
      '2026-09-27T14:00:00Z', // Sun 9 PM Bangkok — kept
      '2026-09-28T04:00:00Z' // Mon — dropped
   ];
   assertEquals(preferSoonSlots(slots, now), [slots[0], slots[1], slots[2], slots[4], slots[5]]);
});

Deno.test('preferSoonSlots judges the weekend by the Bangkok day', () => {
   const now = Date.parse('2026-09-23T02:00:00Z');
   const soon = ['2026-09-23T04:00:00Z', '2026-09-23T06:00:00Z', '2026-09-23T09:00:00Z'];
   // Fri 18:00 UTC = Sat 1 AM Bangkok (kept); Sun 17:30 UTC = Mon 12:30 AM Bangkok (dropped).
   const slots = [...soon, '2026-09-25T18:00:00Z', '2026-09-27T17:30:00Z'];
   assertEquals(preferSoonSlots(slots, now), [...soon, '2026-09-25T18:00:00Z']);
});

Deno.test('preferSoonSlots falls back to every slot when the next two days are too thin', () => {
   const now = Date.parse('2026-09-24T02:00:00Z');
   const slots = ['2026-09-24T04:00:00Z', '2026-09-26T04:00:00Z', '2026-09-27T04:00:00Z'];
   assertEquals(preferSoonSlots(slots, now), slots);
});

Deno.test('recheckRange covers a Manila 7 AM slot that falls on the previous UTC day', () => {
   // 07:00 +08:00 on Oct 2 = 23:00 UTC on Oct 1. Cal.com reads the bounds in Manila time, so the
   // range must reach past Oct 2 00:00 Manila — Oct 1..Oct 3 does.
   assertEquals(recheckRange('2026-10-01T23:00:00.000Z'), { from: '2026-09-30', to: '2026-10-03' });
});

Deno.test('two strikes: a second no-show blocks booking for 7 days after the latest', () => {
   const now = Date.parse('2026-09-25T00:00:00Z');
   assertEquals(bookingCooldownUntil(['2026-09-20T00:00:00Z'], now), null);
   assertEquals(bookingCooldownUntil(['2026-09-10T00:00:00Z', '2026-09-22T00:00:00Z'], now), '2026-09-29T00:00:00.000Z');
   assertEquals(bookingCooldownUntil(['2026-09-01T00:00:00Z', '2026-09-10T00:00:00Z'], now), null);
   assertEquals(bookingCooldownUntil([null, '2026-09-22T00:00:00Z'], now), null);
});

Deno.test('one missed call logged in both tables is one strike, not two', () => {
   const now = Date.parse('2026-10-28T08:00:00Z');
   assertEquals(bookingCooldownUntil(['2026-10-28T06:06:37.257Z', '2026-10-28T06:06:37.851Z'], now), null);
   // ...but a second missed call (logged twice too) still pauses booking.
   assertEquals(
      bookingCooldownUntil(['2026-10-20T06:00:00.1Z', '2026-10-20T06:00:00.7Z', '2026-10-28T06:06:37.2Z', '2026-10-28T06:06:37.8Z'], now),
      '2026-11-04T06:06:37.200Z'
   );
});

Deno.test('teamGuests invites every other cofounder, never the host or the borrower', () => {
   const emails = { george: 'George@example.com', emma: 'emma@example.com' };
   assertEquals(teamGuests('emma', emails, 'borrower@example.com'), ['george@example.com']);
   assertEquals(teamGuests('george', emails, 'borrower@example.com'), ['emma@example.com']);
   assertEquals(teamGuests('emma', emails, 'GEORGE@example.com'), []); // borrower is a cofounder testing
   assertEquals(teamGuests('emma', { george: null, emma: 'emma@example.com' }, 'b@example.com'), []); // /me failed
   assertEquals(teamGuests('emma', { george: 'emma@example.com', emma: 'emma@example.com' }, 'b@example.com'), []); // shared login
});

Deno.test('calendlyToCalSchedule groups weekly hours and keeps only upcoming one-off days', () => {
   const rules = [
      { type: 'wday', wday: 'sunday', intervals: [{ from: '20:00', to: '23:00' }] },
      { type: 'wday', wday: 'monday', intervals: [{ from: '10:00', to: '15:00' }, { from: '20:00', to: '23:00' }] },
      { type: 'wday', wday: 'friday', intervals: [{ from: '10:00', to: '15:00' }, { from: '21:30', to: '24:00' }] },
      { type: 'date', date: '2026-10-01', intervals: [] },
      { type: 'date', date: '2026-11-02', intervals: [] },
      { type: 'date', date: '2026-11-03', intervals: [{ from: '12:00', to: '13:00' }] }
   ];
   assertEquals(calendlyToCalSchedule(rules, 'Asia/Bangkok', '2026-10-27'), {
      timeZone: 'Asia/Bangkok',
      availability: [
         { days: ['Monday', 'Friday'], startTime: '10:00', endTime: '15:00' },
         { days: ['Sunday', 'Monday'], startTime: '20:00', endTime: '23:00' },
         { days: ['Friday'], startTime: '21:30', endTime: '23:59' }
      ],
      overrides: [
         { date: '2026-11-02', startTime: '00:00', endTime: '00:00' },
         { date: '2026-11-03', startTime: '12:00', endTime: '13:00' }
      ]
   });
});

Deno.test('dropBusySlots removes any call that would overlap a busy block', () => {
   const slots = ['2026-10-27T10:45:00+07:00', '2026-10-27T11:00:00+07:00', '2026-10-27T11:45:00+07:00', '2026-10-27T12:00:00+07:00'];
   const busy = [{ start: '2026-10-27T04:00:00Z', end: '2026-10-27T05:00:00Z' }]; // 11:00–12:00 Bangkok
   assertEquals(dropBusySlots(slots, busy, 15), ['2026-10-27T10:45:00+07:00', '2026-10-27T12:00:00+07:00']);
});

Deno.test('bangkokDay counts days in Bangkok time, not UTC', () => {
   assertEquals(bangkokDay('2026-10-28T16:59:00Z'), '2026-10-28'); // 23:59 Bangkok
   assertEquals(bangkokDay('2026-10-28T17:00:00Z'), '2026-10-29'); // 00:00 Bangkok next day
});

// Free times every 15 min, 10:00–17:45 Bangkok on Oct 29.
const dayOfSlots = (day = '2026-10-29', from = 10, to = 18) => {
   const out: string[] = [];
   for (let h = from; h < to; h += 1) for (const m of ['00', '15', '30', '45']) out.push(`${day}T${String(h).padStart(2, '0')}:${m}:00+07:00`);
   return out;
};

Deno.test('a day with 4 calls is full: no times offered, and booking it is refused', () => {
   const booked = ['2026-10-29T10:00:00+07:00', '2026-10-29T10:30:00+07:00', '2026-10-29T11:00:00+07:00', '2026-10-29T11:30:00+07:00'];
   const next = dayOfSlots('2026-10-30');
   const out = clusterSlots([...dayOfSlots(), ...next], booked);
   assertEquals(out.slots, next);
   assertEquals(dayIsFull('2026-10-29T15:00:00+07:00', booked), true);
   assertEquals(dayIsFull('2026-10-29T15:00:00+07:00', booked.slice(1)), false);
   // 06:00 Bangkok on Oct 30 is 23:00 UTC on Oct 29 — still a different Bangkok day, so not full.
   assertEquals(dayIsFull('2026-10-29T23:00:00Z', booked), false);
});

Deno.test('after the first call of a day, only times within 2h are offered and the nearest are recommended', () => {
   // Cal.com no longer lists 14:00 — that's the booked call.
   const out = clusterSlots(dayOfSlots().filter((s) => s !== '2026-10-29T14:00:00+07:00'), ['2026-10-29T14:00:00+07:00']);
   assertEquals(out.slots[0], '2026-10-29T12:00:00+07:00');
   assertEquals(out.slots[out.slots.length - 1], '2026-10-29T16:00:00+07:00');
   assertEquals(out.recommended, [
      '2026-10-29T13:15:00+07:00',
      '2026-10-29T13:30:00+07:00',
      '2026-10-29T13:45:00+07:00',
      '2026-10-29T14:15:00+07:00',
      '2026-10-29T14:30:00+07:00',
      '2026-10-29T14:45:00+07:00'
   ]);
});

Deno.test('the booked calls themselves are never returned, only the free times Cal.com gave', () => {
   const free = dayOfSlots().filter((s) => s !== '2026-10-29T14:00:00+07:00');
   const out = clusterSlots(free, ['2026-10-29T14:00:00+07:00']);
   assertEquals(out.slots.includes('2026-10-29T14:00:00+07:00'), false);
   assertEquals(out.recommended.includes('2026-10-29T14:00:00+07:00'), false);
});

Deno.test('when the block has passed, the closest few times are kept instead of emptying the day', () => {
   const evening = ['2026-10-29T20:00:00+07:00', '2026-10-29T20:15:00+07:00', '2026-10-29T21:00:00+07:00', '2026-10-29T22:00:00+07:00'];
   const out = clusterSlots(evening, ['2026-10-29T10:00:00+07:00']);
   assertEquals(out.slots, evening.slice(0, 3));
   assertEquals(out.recommended, evening.slice(0, 3));
});

Deno.test("a day with no calls yet: Emma's times are recommended, unless every time is hers", () => {
   const all = dayOfSlots('2026-10-29', 10, 12);
   const emma = all.slice(0, 4);
   assertEquals(clusterSlots(all, [], emma), { slots: all, recommended: emma });
   assertEquals(clusterSlots(all, [], all), { slots: all, recommended: [] });
});

Deno.test('preferHost puts Emma first whenever she is free', () => {
   assertEquals(preferHost(['george', 'emma']), ['emma', 'george']);
   assertEquals(preferHost(['emma', 'george']), ['emma', 'george']);
   assertEquals(preferHost(['george']), ['george']);
});

Deno.test('calendlyToCalSchedule: a window ending at midnight ("00:00") becomes 23:59', () => {
   const s = calendlyToCalSchedule([{ type: 'wday', wday: 'sunday', intervals: [{ from: '00:00', to: '02:00' }, { from: '16:00', to: '00:00' }] }], 'Asia/Bangkok', '2026-10-29');
   assertEquals(s.availability, [
      { days: ['Sunday'], startTime: '00:00', endTime: '02:00' },
      { days: ['Sunday'], startTime: '16:00', endTime: '23:59' }
   ]);
});
