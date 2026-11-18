import { describe, expect, it } from 'vitest';

import { maximumRepayment, suggestedRepaymentRange } from '@/lib/loanPricing';

const NOW = new Date('2026-11-18T00:00:00Z');
const inDays = (d: number) => new Date(NOW.getTime() + d * 86400000);

describe('maximumRepayment (20% on top per 31 days)', () => {
   it('caps anything up to 31 days at 20%', () => {
      expect(maximumRepayment(15, inDays(14), NOW)).toBe(18);
      expect(maximumRepayment(15, inDays(31), NOW)).toBe(18);
      expect(maximumRepayment(100, inDays(7), NOW)).toBe(120);
   });

   it('prorates past 31 days', () => {
      expect(maximumRepayment(15, inDays(62), NOW)).toBe(21);
      expect(maximumRepayment(100, inDays(93), NOW)).toBe(160);
   });

   it('never goes below the $1 minimum', () => {
      expect(maximumRepayment(3, inDays(14), NOW)).toBe(4);
   });

   it('assumes a month with no date', () => {
      expect(maximumRepayment(15, null, NOW)).toBe(18);
   });

   it('stops $15 → $116.50', () => {
      expect(116.5 > (maximumRepayment(15, inDays(14), NOW) ?? Infinity)).toBe(true);
   });

   it('keeps the suggested range under the cap', () => {
      const range = suggestedRepaymentRange(15, inDays(31), NOW);
      expect(range?.hi).toBeLessThanOrEqual(18);
   });
});
