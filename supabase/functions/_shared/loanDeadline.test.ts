import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { dueDayBounds, formatDeadline, localHour, resolveTimezone, zonedMidnightUtc } from './loanDeadline.ts';

// due_date is stored as midnight UTC of the calendar due date.
const DUE = '2026-09-30T00:00:00+00:00';

Deno.test('Manila borrower: due day runs 00:00-24:00 Manila, overdue from Oct 1 00:00 Manila', () => {
   const { start, end } = dueDayBounds(DUE, 'Asia/Manila');
   assertEquals(start.toISOString(), '2026-09-29T16:00:00.000Z');
   assertEquals(end.toISOString(), '2026-09-30T16:00:00.000Z');
});

Deno.test('the old bug: 00:15 UTC on the due date is still inside the due day, not overdue', () => {
   const { start, end } = dueDayBounds(DUE, 'Asia/Manila');
   const cronRun = new Date('2026-09-30T00:15:00Z');
   assertEquals(cronRun >= start && cronRun < end, true);
});

Deno.test('Bangkok borrower gets a different, correct window', () => {
   const { end } = dueDayBounds(DUE, 'Asia/Bangkok');
   assertEquals(end.toISOString(), '2026-09-30T17:00:00.000Z');
});

Deno.test('a borrower west of UTC is not overdue until well after UTC midnight', () => {
   const { end } = dueDayBounds(DUE, 'America/New_York');
   assertEquals(end.toISOString(), '2026-10-01T04:00:00.000Z');
});

Deno.test('month and year rollover', () => {
   assertEquals(dueDayBounds('2026-12-31T00:00:00Z', 'Asia/Manila').end.toISOString(), '2026-12-31T16:00:00.000Z');
   assertEquals(zonedMidnightUtc(2026, 1, 1, 'UTC').toISOString(), '2026-01-01T00:00:00.000Z');
});

Deno.test('DST: New York midnight before and after the spring change', () => {
   assertEquals(zonedMidnightUtc(2026, 3, 8, 'America/New_York').toISOString(), '2026-03-08T05:00:00.000Z');
   assertEquals(zonedMidnightUtc(2026, 3, 9, 'America/New_York').toISOString(), '2026-03-09T04:00:00.000Z');
});

Deno.test('timezone resolution: saved zone, then country, then Manila', () => {
   assertEquals(resolveTimezone('Asia/Bangkok', 'PH'), 'Asia/Bangkok');
   assertEquals(resolveTimezone(null, 'th'), 'Asia/Bangkok');
   assertEquals(resolveTimezone('Not/AZone', 'ID'), 'Asia/Jakarta');
   assertEquals(resolveTimezone(null, null), 'Asia/Manila');
   assertEquals(resolveTimezone(undefined, 'ZZ'), 'Asia/Manila');
});

Deno.test('local hour', () => {
   assertEquals(localHour(new Date('2026-09-30T00:15:00Z'), 'Asia/Manila'), 8);
   assertEquals(localHour(new Date('2026-09-29T20:00:00Z'), 'Asia/Manila'), 4);
   assertEquals(localHour(new Date('2026-09-30T00:00:00Z'), 'Asia/Bangkok'), 7);
});

Deno.test('deadline label names the last minute of the due day in the borrower zone', () => {
   assertEquals(formatDeadline(DUE, 'Asia/Manila'), 'Wed, Sep 30, 11:59 PM (Manila)');
});
