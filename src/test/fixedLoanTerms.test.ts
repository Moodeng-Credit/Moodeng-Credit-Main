import { describe, expect, it } from 'vitest';
import { FIXED_TERM_DAYS, fixedRepayment } from '@/lib/loanPricing';

// Same table as the SQL guard app_private.fixed_loan_repayment (20261125200000_fixed_loan_terms.sql).
describe('fixed loan terms', () => {
   it('is 30 days', () => {
      expect(FIXED_TERM_DAYS).toBe(30);
   });

   it.each([
      [15, 16.5],
      [13, 14.3],
      [25, 27.5],
      [45, 49.5],
      [5, 6],
      [9.99, 10.99],
      [10.01, 11.02],
      [135, 148.5]
   ])('$%s pays back $%s', (amount, total) => {
      expect(fixedRepayment(amount)).toBe(total);
   });

   it('keeps the two-part price for split loans', () => {
      expect(fixedRepayment(100, { split: true })).toBe(107.5);
      expect(fixedRepayment(65, { split: true })).toBe(69.88);
   });

   it('has no price for nothing', () => {
      expect(fixedRepayment(0)).toBeNull();
      expect(fixedRepayment(Number.NaN)).toBeNull();
   });
});
