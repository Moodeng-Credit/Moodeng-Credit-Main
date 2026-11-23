import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { isDaytimeManila, nudgeDue, nudgeText } from './bookCallNudge.ts';

const H = 3600000;
const now = Date.parse('2026-11-23T04:00:00Z'); // 12:00 Manila
const row = (o: Partial<{ decidedHoursAgo: number; nudges: number; lastHoursAgo: number | null }>) => ({
   id: 'p',
   user_id: 'u',
   team_decided_at: new Date(now - (o.decidedHoursAgo ?? 10) * H).toISOString(),
   book_nudges: o.nudges ?? 0,
   book_nudged_at: o.lastHoursAgo == null ? null : new Date(now - o.lastHoursAgo * H).toISOString()
});

Deno.test('nudgeDue: first reminder 6h after the good fit', () => {
   assertEquals(nudgeDue(row({ decidedHoursAgo: 5 }), now), null);
   assertEquals(nudgeDue(row({ decidedHoursAgo: 6 }), now), 1);
   assertEquals(nudgeDue(row({ decidedHoursAgo: 20 }), now), 1);
});

Deno.test('nudgeDue: second reminder 24h after the first, never a third', () => {
   assertEquals(nudgeDue(row({ decidedHoursAgo: 40, nudges: 1, lastHoursAgo: 23 }), now), null);
   assertEquals(nudgeDue(row({ decidedHoursAgo: 40, nudges: 1, lastHoursAgo: 24 }), now), 2);
   assertEquals(nudgeDue(row({ decidedHoursAgo: 80, nudges: 2, lastHoursAgo: 30 }), now), null);
});

Deno.test('nudgeDue: gives up a week after the good fit', () => {
   assertEquals(nudgeDue(row({ decidedHoursAgo: 7 * 24 + 1 }), now), null);
   assertEquals(nudgeDue({ ...row({}), team_decided_at: null }, now), null);
});

Deno.test('isDaytimeManila: 09:00–20:59 only', () => {
   assertEquals(isDaytimeManila(Date.parse('2026-11-23T00:59:00Z')), false); // 08:59
   assertEquals(isDaytimeManila(Date.parse('2026-11-23T01:00:00Z')), true); // 09:00
   assertEquals(isDaytimeManila(Date.parse('2026-11-23T12:59:00Z')), true); // 20:59
   assertEquals(isDaytimeManila(Date.parse('2026-11-23T13:00:00Z')), false); // 21:00
});

Deno.test('nudgeText: greeting, the reminder, then their step', () => {
   const t = nudgeText(1, 'en', 'Ana', 'STEP');
   assertEquals(t.startsWith('Hi Ana! 👋 Reminder: you passed the pre-screening!'), true);
   assertEquals(t.includes("no invite to wait for"), true);
   assertEquals(t.endsWith('\n\nSTEP'), true);
   assertEquals(nudgeText(2, 'fil', null, 'X').startsWith('👋 Bukas pa'), true);
});
