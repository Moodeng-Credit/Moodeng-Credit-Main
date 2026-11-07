import { describe, expect, it } from 'vitest';

import { DEFAULT_ID_RULES } from '@/lib/idTrack';
import { checkIdLoanTerms, daysUntil, idRepaymentBounds, idRepaymentChoices, isIndonesianLoan } from '@/lib/loanMarket';

describe('loanMarket (Indonesia track)', () => {
   it('marks only market ID loans', () => {
      expect(isIndonesianLoan({ market: 'ID' })).toBe(true);
      expect(isIndonesianLoan({ market: null })).toBe(false);
      expect(isIndonesianLoan({})).toBe(false);
      expect(isIndonesianLoan(null)).toBe(false);
   });

   it('offers repayment chips inside the server bounds', () => {
      expect(idRepaymentChoices(5)).toEqual([6, 6.5, 7]);
      expect(idRepaymentChoices(10)).toEqual([11, 12, 13]);
      for (const amount of [5, 10, 20]) {
         const { min, max } = idRepaymentBounds(amount);
         for (const total of idRepaymentChoices(amount)) {
            expect(total).toBeGreaterThanOrEqual(min);
            expect(total).toBeLessThanOrEqual(max);
         }
      }
   });

   it('counts whole days from a YYYY-MM-DD today to an ISO due date', () => {
      expect(daysUntil('2026-11-07', '2026-11-14T00:00:00.000Z')).toBe(7);
      expect(daysUntil('2026-11-07', '2026-11-21')).toBe(14);
      expect(daysUntil('2026-11-07', '')).toBeNull();
   });

   it('mirrors enforce_new_loan_terms', () => {
      const base = { amount: 5, repayment: 6.5, dueDate: '2026-11-14T00:00:00.000Z', today: '2026-11-07', rules: DEFAULT_ID_RULES, approved: true };
      expect(checkIdLoanTerms(base)).toBeNull();
      expect(checkIdLoanTerms({ ...base, approved: false })).toBe('not_approved');
      expect(checkIdLoanTerms({ ...base, amount: 7 })).toBe('amount');
      expect(checkIdLoanTerms({ ...base, repayment: 5.5 })).toBe('repayment_low');
      expect(checkIdLoanTerms({ ...base, repayment: 7.51 })).toBe('repayment_high');
      expect(checkIdLoanTerms({ ...base, dueDate: '2026-11-22T00:00:00.000Z' })).toBe('date');
      expect(checkIdLoanTerms({ ...base, dueDate: '2026-11-07T00:00:00.000Z' })).toBe('date');
   });
});
