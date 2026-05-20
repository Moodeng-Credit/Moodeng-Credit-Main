import { describe, expect, it } from 'vitest';

import {
   buildPointsIdempotencyKey,
   computePointsDelta,
   computeYearOneIouPointsDelta,
   formatPointsMajor,
   getYearOneIouBorrowerBonusPoints,
   loanFundingPointsPerUsdc,
   pointsScale,
   yearOneIouBorrowerBonusTiers
} from '@/shared/points';

describe('computePointsDelta', () => {
   it('computes base IOU points using one point per USDC', () => {
      const result = computePointsDelta('100');

      expect(loanFundingPointsPerUsdc).toBe(1);
      expect(result).toBe(100000000n);
   });

   it('supports decimal loan amounts up to the configured scale', () => {
      const result = computePointsDelta('12.3456');

      expect(result).toBe(12345600n);
   });

   it('rejects invalid decimal precision', () => {
      const tooPrecise = `1.${'1'.repeat(pointsScale + 1)}`;

      expect(() => computePointsDelta(tooPrecise)).toThrowError(/decimal places/);
   });

   it('rejects negative values', () => {
      expect(() => computePointsDelta('-1')).toThrowError(/positive/);
   });
});

describe('Year 1 IOU borrower-order bonuses', () => {
   it('keeps the configured borrower bonus tiers visible to the admin guide', () => {
      expect(yearOneIouBorrowerBonusTiers.map((tier) => tier.bonusPoints)).toEqual([25, 20, 15, 10]);
   });

   it('returns the correct borrower-order bonus', () => {
      expect(getYearOneIouBorrowerBonusPoints(0)).toBe(25);
      expect(getYearOneIouBorrowerBonusPoints(1)).toBe(20);
      expect(getYearOneIouBorrowerBonusPoints(2)).toBe(15);
      expect(getYearOneIouBorrowerBonusPoints(3)).toBe(10);
      expect(getYearOneIouBorrowerBonusPoints(10)).toBe(10);
   });

   it('adds the base funded amount and borrower bonus together', () => {
      expect(computeYearOneIouPointsDelta('10', 0)).toBe(35000000n);
      expect(computeYearOneIouPointsDelta('125', 1)).toBe(145000000n);
      expect(computeYearOneIouPointsDelta('12.50', 3)).toBe(22500000n);
   });
});

describe('buildPointsIdempotencyKey', () => {
   it('builds a stable idempotency key', () => {
      const key = buildPointsIdempotencyKey({
         userId: 'user-123',
         sourceType: 'loan',
         sourceId: 'loan-456',
         eventType: 'funded'
      });

      expect(key).toBe('user-123:loan:loan-456:funded');
   });
});

describe('formatPointsMajor', () => {
   it('formats minor units into major units', () => {
      expect(formatPointsMajor(123000000)).toBe('123');
   });

   it('keeps fractional precision up to the configured scale', () => {
      expect(formatPointsMajor('123450000')).toBe('123.45');
   });

   it('trims trailing zeros in fractional values', () => {
      expect(formatPointsMajor(1000000)).toBe('1');
      expect(formatPointsMajor(1001000)).toBe('1.001');
   });

   it('returns zero for empty values', () => {
      expect(formatPointsMajor(null)).toBe('0');
      expect(formatPointsMajor(undefined)).toBe('0');
   });
});
