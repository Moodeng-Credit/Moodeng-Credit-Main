import { describe, expect, it } from 'vitest';

import {
   fromDateOverrides,
   fromWeekHours,
   hoursOn,
   mondayOf,
   toDateOverrides,
   toWeekHours,
   weekdayOf,
   weekProblem,
   zonedParts
} from '@/app/admin/calendarModel';

import { isValidAvailability, isValidOverrides } from '../../supabase/functions/admin-calendar/lib';

// The shape Cal.com's GET /v2/schedules returns.
const availability = [
   { days: ['Monday', 'Tuesday', 'Wednesday'], startTime: '09:00', endTime: '12:00' },
   { days: ['Monday'], startTime: '14:00', endTime: '17:00' }
];
const overrides = [
   { date: '2026-10-05', startTime: '00:00', endTime: '00:00' },
   { date: '2026-10-06', startTime: '10:00', endTime: '11:00' },
   { date: '2026-10-06', startTime: '08:00', endTime: '09:00' }
];

describe('admin calendar model', () => {
   it('round-trips Cal.com weekly hours through the per-day editor', () => {
      const week = toWeekHours(availability);
      expect(week.Monday).toEqual([
         { start: '09:00', end: '12:00' },
         { start: '14:00', end: '17:00' }
      ]);
      expect(week.Thursday).toEqual([]);
      expect(fromWeekHours(week)).toEqual(availability);
   });

   it('reads 00:00–00:00 overrides as a day off and groups same-date ranges', () => {
      const dated = toDateOverrides(overrides);
      expect(dated['2026-10-05']).toBe('off');
      expect(dated['2026-10-06']).toEqual([
         { start: '08:00', end: '09:00' },
         { start: '10:00', end: '11:00' }
      ]);
      expect(fromDateOverrides(dated)).toEqual([overrides[0], overrides[2], overrides[1]]);
   });

   it('uses an override in place of the weekday hours', () => {
      const week = toWeekHours(availability);
      const dated = toDateOverrides(overrides);
      expect(weekdayOf('2026-10-05')).toBe('Monday');
      expect(hoursOn('2026-10-05', week, dated)).toEqual({ ranges: [], overridden: true, off: true });
      expect(hoursOn('2026-10-12', week, dated).ranges).toHaveLength(2);
   });

   it('flags overlapping and backwards ranges', () => {
      const week = toWeekHours([{ days: ['Friday'], startTime: '09:00', endTime: '12:00' }]);
      expect(weekProblem(week, {})).toBeNull();
      week.Friday.push({ start: '11:00', end: '13:00' });
      expect(weekProblem(week, {})).toMatch(/^Friday: .*overlaps/);
      expect(weekProblem(toWeekHours([]), { '2026-10-06': [{ start: '12:00', end: '10:00' }] })).toMatch(/ends before it starts/);
   });

   it('places an instant on the right local date and minute', () => {
      // 2026-10-04 20:30 UTC is already Monday 03:30 in Bangkok (UTC+7).
      expect(zonedParts('2026-10-04T20:30:00Z', 'Asia/Bangkok')).toEqual({ ymd: '2026-10-05', minutes: 210 });
      expect(mondayOf('2026-10-04')).toBe('2026-09-28');
      expect(mondayOf('2026-10-05')).toBe('2026-10-05');
   });
});

describe('admin-calendar input checks', () => {
   it('accepts what the editor sends', () => {
      expect(isValidAvailability(availability)).toBe(true);
      expect(isValidAvailability([])).toBe(true);
      expect(isValidOverrides(overrides)).toBe(true);
      expect(isValidAvailability([{ days: ['Friday'], startTime: '09:00', endTime: '23:59' }])).toBe(true);
   });

   it('rejects malformed hours', () => {
      expect(isValidAvailability([{ days: ['Funday'], startTime: '09:00', endTime: '10:00' }])).toBe(false);
      expect(isValidAvailability([{ days: ['Monday'], startTime: '10:00', endTime: '09:00' }])).toBe(false);
      expect(isValidAvailability([{ days: [], startTime: '09:00', endTime: '10:00' }])).toBe(false);
      expect(isValidAvailability('09:00')).toBe(false);
      expect(isValidOverrides([{ date: '5 Oct', startTime: '00:00', endTime: '00:00' }])).toBe(false);
      expect(isValidOverrides([{ date: '2026-10-05', startTime: '25:00', endTime: '26:00' }])).toBe(false);
   });
});
