import { describe, expect, it } from 'vitest';

import { minimumRepayment } from '@/lib/loanPricing';

const NOW = new Date('2026-10-10T00:00:00Z');
const inDays = (d: number) => new Date(NOW.getTime() + d * 86400000).toISOString();

describe('minimumRepayment (10% a month, at least one month)', () => {
   it('$15 over 3 months needs at least $19.50, not $16', () => {
      expect(minimumRepayment(15, inDays(90), NOW)).toEqual({ amount: 19.5, months: 3 });
   });

   it('anything up to a month counts as a full month', () => {
      expect(minimumRepayment(15, inDays(14), NOW)?.amount).toBe(16.5);
      expect(minimumRepayment(15, inDays(30), NOW)?.amount).toBe(16.5);
   });

   it('prorates by day after the first month and rounds up to $0.50', () => {
      // 45 days = 1.5 months → 15% → $17.25 → $17.50
      expect(minimumRepayment(15, inDays(45), NOW)?.amount).toBe(17.5);
      expect(minimumRepayment(50, inDays(60), NOW)?.amount).toBe(60);
   });

   it('nothing to suggest without a valid amount or date', () => {
      expect(minimumRepayment(0, inDays(30), NOW)).toBeNull();
      expect(minimumRepayment(15, null, NOW)).toBeNull();
      expect(minimumRepayment(15, 'not a date', NOW)).toBeNull();
   });
});
