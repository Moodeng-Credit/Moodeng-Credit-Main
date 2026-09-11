import { describe, expect, it } from 'vitest';

import { LOAN_OVERDUE_GRACE_HOURS, isLoanPastDue } from '../utils/loanOverdue';

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
});
