import { describe, expect, it } from 'vitest';

import { getLoanPastDueAt, isLoanPastDue, isPublicDefault, wasRepaidPublicLate } from '../utils/loanOverdue';

// One deadline: due until the end of the due day on the borrower's clock (Manila when unknown), overdue
// from 00:00 the next day there. No extra hours on top.
describe('isLoanPastDue', () => {
   const dueMidnightUtc = '2026-09-11 00:00:00+00';

   it('is NOT past due during the due day itself (Manila by default)', () => {
      expect(isLoanPastDue(dueMidnightUtc, new Date('2026-09-11T11:08:00Z'))).toBe(false);
   });

   it('becomes past due at midnight Manila, the end of the due day', () => {
      // 11:59 PM Manila on Sep 11 = 15:59Z; midnight = 16:00Z.
      expect(isLoanPastDue(dueMidnightUtc, new Date('2026-09-11T15:59:59Z'))).toBe(false);
      expect(isLoanPastDue(dueMidnightUtc, new Date('2026-09-11T16:00:00Z'))).toBe(true);
   });

   it('no longer waits until 8 AM Manila the next day', () => {
      expect(isLoanPastDue(dueMidnightUtc, new Date('2026-09-11T23:00:00Z'), 'Asia/Manila')).toBe(true);
   });

   it('counts a clearly late loan as past due', () => {
      expect(isLoanPastDue('2026-08-05 00:00:00+00', new Date('2026-09-11T11:08:00Z'))).toBe(true);
   });

   it('returns false for a missing due date', () => {
      expect(isLoanPastDue(null)).toBe(false);
      expect(isLoanPastDue(undefined)).toBe(false);
   });

   it('uses the end of the due day in the borrower\'s own zone', () => {
      const due = '2026-10-01T00:00:00Z';
      // Los Angeles: their Oct 1 ends Oct 2 07:00Z.
      expect(isLoanPastDue(due, new Date('2026-10-02T06:59:00Z'), 'America/Los_Angeles')).toBe(false);
      expect(isLoanPastDue(due, new Date('2026-10-02T07:00:00Z'), 'America/Los_Angeles')).toBe(true);
      // Macau (UTC+8): same as Manila.
      expect(getLoanPastDueAt(due, 'Asia/Macau').toISOString()).toBe('2026-10-01T16:00:00.000Z');
      // Jakarta (UTC+7): midnight there is 17:00Z.
      expect(getLoanPastDueAt(due, 'Asia/Jakarta').toISOString()).toBe('2026-10-01T17:00:00.000Z');
   });
});

describe('public late / default labels', () => {
   const due = '2026-10-01T00:00:00Z';

   it('waits 3 days past the deadline before calling a loan a default', () => {
      // Deadline is midnight Manila (Oct 1 16:00Z); the public label waits 3 more days.
      expect(isPublicDefault(due, 'Asia/Manila', new Date('2026-10-04T15:59:00Z'))).toBe(false);
      expect(isPublicDefault(due, 'Asia/Manila', new Date('2026-10-04T16:00:00Z'))).toBe(true);
   });

   it('only calls a repayment late when it came more than 3 days after the deadline', () => {
      expect(wasRepaidPublicLate(due, '2026-10-01T09:00:00Z', 'Asia/Manila')).toBe(false);
      expect(wasRepaidPublicLate(due, '2026-10-03T12:00:00Z', 'Asia/Manila')).toBe(false);
      expect(wasRepaidPublicLate(due, '2026-10-05T01:00:00Z', 'Asia/Manila')).toBe(true);
   });
});
