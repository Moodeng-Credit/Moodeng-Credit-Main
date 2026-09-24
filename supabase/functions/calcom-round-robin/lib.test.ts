import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { hostsFreeAt, mergeSlots, orderHostsToTry, preferSoonSlots } from './lib.ts';

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

Deno.test('preferSoonSlots offers only the next-day times when there are enough of them', () => {
   const now = Date.parse('2026-09-24T02:00:00Z');
   const slots = ['2026-09-24T04:00:00Z', '2026-09-24T06:00:00Z', '2026-09-24T09:00:00Z', '2026-09-26T04:00:00Z'];
   assertEquals(preferSoonSlots(slots, now), slots.slice(0, 3));
});

Deno.test('preferSoonSlots falls back to every slot when the next day is too thin', () => {
   const now = Date.parse('2026-09-24T02:00:00Z');
   const slots = ['2026-09-24T04:00:00Z', '2026-09-26T04:00:00Z', '2026-09-27T04:00:00Z'];
   assertEquals(preferSoonSlots(slots, now), slots);
});
