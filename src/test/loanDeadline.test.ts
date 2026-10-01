import { describe, expect, it } from 'vitest';

import {
   formatDeadlineForViewer,
   getDaysUntilDueDay,
   getDueDayEnd,
   getLoanTimezone,
   isPastDueDay,
   isUsableTimezone
} from '@/lib/loanDeadline';

// Stored the way every due date is: the calendar date at midnight UTC.
const DUE = '2026-09-30T00:00:00.000Z';

describe('a loan is due until the end of its due day in the borrower zone', () => {
   it('is NOT overdue at 8 AM Manila on the due day (the old bug: midnight UTC)', () => {
      expect(isPastDueDay(DUE, 'Asia/Manila', new Date('2026-09-30T00:00:00Z'))).toBe(false);
      expect(isPastDueDay(DUE, 'Asia/Manila', new Date('2026-09-30T00:15:00Z'))).toBe(false);
   });

   it('is still due at 11:59 PM Manila and overdue from midnight Manila', () => {
      expect(isPastDueDay(DUE, 'Asia/Manila', new Date('2026-09-30T15:59:00Z'))).toBe(false);
      expect(isPastDueDay(DUE, 'Asia/Manila', new Date('2026-09-30T16:00:00Z'))).toBe(true);
      expect(getDueDayEnd(DUE, 'Asia/Manila').toISOString()).toBe('2026-09-30T16:00:00.000Z');
   });

   it('a Bangkok borrower gets their own midnight', () => {
      expect(getDueDayEnd(DUE, 'Asia/Bangkok').toISOString()).toBe('2026-09-30T17:00:00.000Z');
   });

   it('counts calendar days on the borrower calendar: due today from their midnight', () => {
      // 1 AM Sep 30 in Manila is still Sep 29 in UTC; for the borrower it is the due day.
      expect(getDaysUntilDueDay(DUE, 'Asia/Manila', new Date('2026-09-29T17:00:00Z'))).toBe(0);
      expect(getDaysUntilDueDay(DUE, 'Asia/Manila', new Date('2026-09-28T17:00:00Z'))).toBe(1);
      expect(getDaysUntilDueDay(DUE, 'Asia/Manila', new Date('2026-09-30T16:30:00Z'))).toBe(-1);
   });
});

describe('the zone a loan is measured in', () => {
   it('uses the zone saved on the loan, ignoring UTC-like values', () => {
      expect(getLoanTimezone({ dueTimezone: 'Asia/Bangkok' }, 'Asia/Manila')).toBe('Asia/Bangkok');
      expect(getLoanTimezone({ dueTimezone: 'UTC' }, 'Asia/Manila')).toBe('Asia/Manila');
      expect(getLoanTimezone({}, 'Asia/Jakarta')).toBe('Asia/Jakarta');
      expect(isUsableTimezone('Etc/GMT+8')).toBe(false);
      expect(isUsableTimezone('Not/AZone')).toBe(false);
   });
});

describe('admin panel: the deadline on the borrower clock and on the viewer clock', () => {
   it('Manila borrower, admin in Thailand', () => {
      expect(formatDeadlineForViewer(DUE, 'Asia/Manila', 'Asia/Bangkok')).toEqual({
         borrower: 'Sep 30, 11:59 PM Manila',
         viewer: '10:59 PM your time'
      });
   });

   it('says it once when both clocks read the same', () => {
      expect(formatDeadlineForViewer(DUE, 'Asia/Bangkok', 'Asia/Bangkok')).toEqual({ borrower: 'Sep 30, 11:59 PM Bangkok', viewer: null });
   });

   it('names the date when the viewer is on a different day', () => {
      expect(formatDeadlineForViewer(DUE, 'America/New_York', 'Asia/Bangkok')).toEqual({
         borrower: 'Sep 30, 11:59 PM New York',
         viewer: 'Oct 1, 10:59 AM your time'
      });
   });
});
