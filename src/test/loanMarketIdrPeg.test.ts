import { describe, expect, it } from 'vitest';

import { DEFAULT_ID_RULES } from '@/lib/idTrack';
import {
   approxIdr,
   clipRepayIdr,
   formatIdr,
   idLoanTermMessage,
   idRepaymentBounds,
   idRepayIdrBounds,
   idRepayIdrChoices,
   idUsdForIdr,
   remainingIdr
} from '@/lib/loanMarket';

// Server rule (enforce_new_loan_terms): total = round(repay_idr / rate, 2), amount + 1 ≤ total ≤ 1.5 × amount,
// repay_idr a multiple of 500.
const serverAccepts = (amount: number, idr: number, rate: number) => {
   const usd = Math.round((idr / rate) * 100) / 100;
   const { min, max } = idRepaymentBounds(amount);
   return idr % 500 === 0 && usd >= min && usd <= max;
};

const RATES = [15_800, 16_543.21, 16_500, 18_090.5, 18_100, 19_200, 12_345.67, 29_000];

describe('rupiah peg (Indonesia track)', () => {
   it('formats rupiah with Indonesian grouping', () => {
      expect(formatIdr(110000)).toBe('Rp 110.000');
      expect(formatIdr(1234567.4)).toBe('Rp 1.234.567');
      expect(formatIdr(500)).toBe('Rp 500');
      expect(approxIdr(5, 16_543)).toBe('≈ Rp 83.000');
      expect(approxIdr(5, null)).toBeNull();
   });

   it('rounds the USD the way the server does', () => {
      expect(idUsdForIdr(110000, 18_090.5)).toBe(6.08);
      expect(idUsdForIdr(110000, 18_100)).toBe(6.08);
   });

   it('rupiah bounds are multiples of 500 the server accepts, and the next step out is rejected', () => {
      for (const rate of RATES) {
         for (const amount of [5, 10]) {
            const b = idRepayIdrBounds(amount, rate);
            expect(b).not.toBeNull();
            if (!b) continue;
            expect(b.min % 500).toBe(0);
            expect(b.max % 500).toBe(0);
            expect(serverAccepts(amount, b.min, rate)).toBe(true);
            expect(serverAccepts(amount, b.max, rate)).toBe(true);
            expect(serverAccepts(amount, b.min - 500, rate)).toBe(false);
            expect(serverAccepts(amount, b.max + 500, rate)).toBe(false);
         }
      }
   });

   it('no rate, no bounds or chips', () => {
      expect(idRepayIdrBounds(5, null)).toBeNull();
      expect(idRepayIdrBounds(5, 0)).toBeNull();
      expect(idRepayIdrChoices(5, undefined)).toEqual([]);
      expect(clipRepayIdr(100000, 5, null)).toBeNull();
   });

   it('offers 3 round chips (Rp 5.000) inside the server range', () => {
      for (const rate of RATES) {
         for (const amount of [5, 10]) {
            const chips = idRepayIdrChoices(amount, rate);
            expect(chips.length).toBe(3);
            expect([...chips].sort((a, b) => a - b)).toEqual(chips);
            expect(new Set(chips).size).toBe(3);
            for (const chip of chips) {
               expect(chip % 5000).toBe(0);
               expect(serverAccepts(amount, chip, rate)).toBe(true);
            }
         }
      }
   });

   it('chips follow the usual USD totals at a typical rate', () => {
      // $5 at 16.500: $6 / $6.50 / $7 ≈ Rp 99.000 / 107.250 / 115.500 → nearest round chips.
      expect(idRepayIdrChoices(5, 16_500)).toEqual([100000, 105000, 115000]);
      // $10 at 16.500: range Rp 181.500–247.500, $11 ≈ 181.500 → 185.000.
      expect(idRepayIdrChoices(10, 16_500)).toEqual([185000, 200000, 215000]);
   });

   it('clips a typed rupiah total to Rp 500 steps inside the range', () => {
      const b = idRepayIdrBounds(5, 16_500)!;
      expect(clipRepayIdr(1000, 5, 16_500)).toBe(b.min);
      expect(clipRepayIdr(999_999, 5, 16_500)).toBe(b.max);
      expect(clipRepayIdr(110_240, 5, 16_500)).toBe(110_000);
      expect(clipRepayIdr(110_260, 5, 16_500)).toBe(110_500);
   });

   it('says the repayment limits in rupiah when there is a rate', () => {
      const b = idRepayIdrBounds(5, 16_500)!;
      expect(idLoanTermMessage('repayment_low', DEFAULT_ID_RULES, 5, 'id', 16_500)).toBe(`Pengembalian minimal ${formatIdr(b.min)}.`);
      expect(idLoanTermMessage('repayment_high', DEFAULT_ID_RULES, 5, 'en', 16_500)).toBe(`Repay at most ${formatIdr(b.max)}.`);
      expect(idLoanTermMessage('repayment_low', DEFAULT_ID_RULES, 5, 'en')).toBe('Repay at least $6.');
   });

   it('rupiah left on a pegged loan', () => {
      expect(remainingIdr({ repayIdr: 110000, repaidIdr: 38000 })).toBe(72000);
      expect(remainingIdr({ repayIdr: 110000, repaidIdr: 120000 })).toBe(0);
      expect(remainingIdr({ repayIdr: 110000 })).toBe(110000);
      expect(remainingIdr({})).toBeNull();
      expect(remainingIdr(null)).toBeNull();
   });
});
