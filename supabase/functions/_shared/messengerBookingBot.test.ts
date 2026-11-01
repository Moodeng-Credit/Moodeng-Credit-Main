import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { freeFromSlots, START, wallNow } from './messengerBookingBot.ts';

Deno.test('wallNow: the wall clock in a zone', () => {
   const at = new Date('2026-11-01T18:30:00Z');
   assertEquals(wallNow('Asia/Manila', at), { date: '2026-11-02', min: 2 * 60 + 30 });
   assertEquals(wallNow('Asia/Jakarta', at), { date: '2026-11-02', min: 1 * 60 + 30 });
});

Deno.test('freeFromSlots: local times, hosts, 2+ hours away, 7 days', () => {
   const now = { date: '2026-11-01', min: 10 * 60 };
   const all = ['2026-11-01T11:00:00.000+08:00', '2026-11-01T12:30:00.000+08:00', ...Array.from({ length: 9 }, (_, i) => `2026-11-${String(2 + i).padStart(2, '0')}T09:00:00.000+08:00`)];
   const free = freeFromSlots({ all, hosts: { [all[1]]: 'george' } }, now);
   assertEquals(free[0], { date: '2026-11-01', min: 12 * 60 + 30, host: 'George' });
   assertEquals(new Set(free.map((s) => s.date)).size, 7);
});

Deno.test('START: what begins a booking chat', () => {
   for (const t of ['book', 'BOOK', 'Book a call', 'mag-book po', 'schedule a call']) assertEquals(START.test(t), true, t);
   for (const t of ['hi', 'when is my loan due', 'facebook']) assertEquals(START.test(t), false, t);
});
