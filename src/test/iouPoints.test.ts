import { describe, expect, it } from 'vitest';

import { calculateIouPoints } from '@/lib/iouPoints';

describe('calculateIouPoints', () => {
   it('returns doubled points for whole numbers', () => {
      expect(calculateIouPoints(1)).toBe('2');
      expect(calculateIouPoints(10)).toBe('20');
   });

   it('preserves six decimal places for fractional values', () => {
      expect(calculateIouPoints(1.5)).toBe('3');
      expect(calculateIouPoints(1.25)).toBe('2.500000');
      expect(calculateIouPoints(123.456789)).toBe('246.913578');
   });

   it('handles tiny decimal values deterministically', () => {
      expect(calculateIouPoints(0.000001)).toBe('0.000002');
      expect(calculateIouPoints(0.01)).toBe('0.020000');
   });
});
