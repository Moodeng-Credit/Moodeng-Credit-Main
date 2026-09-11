import { describe, expect, it } from 'vitest';

import { isLoanPastDue } from '../utils/loanOverdue';

// due_date is stored at midnight UTC. A loan is only overdue / a loss once its
// due date has fully passed — a loan due today is not a loss. No grace window;
// it is a plain calendar-day comparison.
describe('isLoanPastDue', () => {
   const dueMidnightUtc = '2026-09-11 00:00:00+00';

   it('is NOT past due during the due day itself', () => {
      // Late morning on the due day — borrower still has all day to repay.
      const now = new Date('2026-09-11T11:08:00Z');
      expect(isLoanPastDue(dueMidnightUtc, now)).toBe(false);
   });

   it('is NOT past due at the last moment of the due day', () => {
      const now = new Date('2026-09-11T23:59:00Z');
      expect(isLoanPastDue(dueMidnightUtc, now)).toBe(false);
   });

   it('becomes past due once the due date has fully passed', () => {
      const now = new Date('2026-09-12T00:30:00Z');
      expect(isLoanPastDue(dueMidnightUtc, now)).toBe(true);
   });

   it('treats an end-of-day due timestamp by its date', () => {
      const dueEndOfDay = '2026-09-14 23:59:59+00';
      expect(isLoanPastDue(dueEndOfDay, new Date('2026-09-14T12:00:00Z'))).toBe(false);
      expect(isLoanPastDue(dueEndOfDay, new Date('2026-09-15T23:59:59Z'))).toBe(true);
   });

   it('counts a clearly late loan as past due', () => {
      expect(isLoanPastDue('2026-08-05 00:00:00+00', new Date('2026-09-11T11:08:00Z'))).toBe(true);
   });

   it('returns false for a missing due date', () => {
      expect(isLoanPastDue(null)).toBe(false);
      expect(isLoanPastDue(undefined)).toBe(false);
   });
});
