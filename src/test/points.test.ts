import { describe, expect, it } from 'vitest';

import { buildPointsIdempotencyKey, computePointsDelta, pointsScale } from '@/shared/points';

describe('computePointsDelta', () => {
   it('computes points using integer arithmetic', () => {
      const result = computePointsDelta('100');

      expect(result).toBe(200000000n);
   });

   it('supports decimal loan amounts up to the configured scale', () => {
      const result = computePointsDelta('12.3456');

      expect(result).toBe(24691200n);
   });

   it('rejects invalid decimal precision', () => {
      const tooPrecise = `1.${'1'.repeat(pointsScale + 1)}`;

      expect(() => computePointsDelta(tooPrecise)).toThrowError(/decimal places/);
   });

   it('rejects negative values', () => {
      expect(() => computePointsDelta('-1')).toThrowError(/positive/);
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
