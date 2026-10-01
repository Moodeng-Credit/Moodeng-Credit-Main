import { describe, expect, it } from 'vitest';

import { LOAN_OVERDUE_GRACE_HOURS, isLoanPastDue, isPublicDefault, wasRepaidPublicLate } from '../utils/loanOverdue';

// due_date is a single UTC instant, but borrowers/lenders span time zones, so a
// loan gets a flat 24h grace past its due date before it counts as a loss.
describe('isLoanPastDue', () => {
   const dueMidnightUtc = '2026-09-11 00:00:00+00';

   it('is NOT past due during the due day itself', () => {
      const now = new Date('2026-09-11T11:08:00Z');
      expect(isLoanPastDue(dueMidnightUtc, now)).toBe(false);
   });

   it('is NOT past due one minute before the 24h grace window closes', () => {
      const now = new Date('2026-09-11T23:59:00Z');
      expect(isLoanPastDue(dueMidnightUtc, now)).toBe(false);
   });

   it('becomes past due exactly 24h after the due date', () => {
      expect(isLoanPastDue(dueMidnightUtc, new Date('2026-09-11T23:59:59Z'))).toBe(false);
      expect(isLoanPastDue(dueMidnightUtc, new Date('2026-09-12T00:00:00Z'))).toBe(true);
   });

   it('gives a full 24h from the due instant even for an end-of-day due timestamp', () => {
      // A flat 24h grace (not a date comparison): due 23:59:59 → grace ends the
      // next day at 23:59:59, so mid-next-day is still within grace.
      const dueEndOfDay = '2026-09-14 23:59:59+00';
      expect(isLoanPastDue(dueEndOfDay, new Date('2026-09-15T12:00:00Z'))).toBe(false);
      expect(isLoanPastDue(dueEndOfDay, new Date('2026-09-16T00:00:00Z'))).toBe(true);
   });

   it('counts a clearly late loan as past due', () => {
      expect(isLoanPastDue('2026-08-05 00:00:00+00', new Date('2026-09-11T11:08:00Z'))).toBe(true);
   });

   it('returns false for a missing due date', () => {
      expect(isLoanPastDue(null)).toBe(false);
      expect(isLoanPastDue(undefined)).toBe(false);
   });

   it('uses a 24 hour grace window', () => {
      expect(LOAN_OVERDUE_GRACE_HOURS).toBe(24);
   });

   it('gives borrowers west of UTC their whole due day', () => {
      const due = '2026-10-01T00:00:00Z';
      // Los Angeles: due day ends Oct 2 07:00Z; the old 24h rule fired at Oct 2 00:00Z (5 PM local).
      expect(isLoanPastDue(due, new Date('2026-10-02T03:00:00Z'), 'America/Los_Angeles')).toBe(false);
      expect(isLoanPastDue(due, new Date('2026-10-02T07:00:00Z'), 'America/Los_Angeles')).toBe(true);
      // Manila is unchanged (due + 24h is later than the end of its day).
      expect(isLoanPastDue(due, new Date('2026-10-01T23:59:00Z'), 'Asia/Manila')).toBe(false);
      expect(isLoanPastDue(due, new Date('2026-10-02T00:00:00Z'), 'Asia/Manila')).toBe(true);
   });
});

describe('public late / default labels', () => {
   const due = '2026-10-01T00:00:00Z';

   it('waits 3 days past the deadline before calling a loan a default', () => {
      expect(isPublicDefault(due, 'Asia/Manila', new Date('2026-10-04T23:00:00Z'))).toBe(false);
      expect(isPublicDefault(due, 'Asia/Manila', new Date('2026-10-05T00:00:00Z'))).toBe(true);
   });

   it('only calls a repayment late when it came more than 3 days after the deadline', () => {
      expect(wasRepaidPublicLate(due, '2026-10-01T09:00:00Z', 'Asia/Manila')).toBe(false);
      expect(wasRepaidPublicLate(due, '2026-10-03T12:00:00Z', 'Asia/Manila')).toBe(false);
      expect(wasRepaidPublicLate(due, '2026-10-05T01:00:00Z', 'Asia/Manila')).toBe(true);
   });
});
