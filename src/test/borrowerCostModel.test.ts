import { describe, expect, it } from 'vitest';

import {
   borrowerCurrency,
   DEFAULT_COSTS,
   type ExchangeCosts,
   rateOn,
   realCost,
   seasonalForecast,
   summarize
} from '@/app/admin/borrowerCostModel';

const NO_COSTS: ExchangeCosts = {
   label: 'none',
   sendToExchangeUsdc: 0,
   sellPct: 0,
   cashOutLocal: 0,
   cashInLocal: 0,
   buyPct: 0,
   withdrawToWalletUsdc: 0
};
const series = (entries: Record<string, number>) => new Map(Object.entries(entries));

describe('borrowerCostModel', () => {
   it('uses the latest rate on or before a date (weekends)', () => {
      const s = series({ '2026-10-09': 58, '2026-10-12': 59 });
      expect(rateOn(s, '2026-10-11')).toBe(58);
      expect(rateOn(s, '2026-10-12')).toBe(59);
      expect(rateOn(s, '2026-10-01')).toBeNull();
   });

   it('splits the real cost into our fee, the rate move and exchange fees', () => {
      const loan = {
         id: 'a',
         trackingId: 'A',
         borrower: 'alvin',
         currency: 'PHP' as const,
         principal: 15,
         repayment: 16.5,
         fundedDate: '2026-10-13',
         repaidDate: '2026-11-12'
      };
      const rates = { PHP: series({ '2026-10-13': 58, '2026-11-12': 59 }), IDR: series({}) };
      const r = realCost(loan, rates, { PHP: NO_COSTS, IDR: NO_COSTS }, '2026-11-12');
      expect(r).not.toBeNull();
      expect(r!.received).toBeCloseTo(870);
      expect(r!.paid).toBeCloseTo(973.5);
      expect(r!.feeLocal).toBeCloseTo(87);
      expect(r!.fxLocal).toBeCloseTo(16.5);
      expect(r!.exchangeLocal).toBeCloseTo(0);
      expect(r!.realPct).toBeCloseTo(103.5 / 870);
      expect(r!.ourFeePct).toBeCloseTo(0.1);
   });

   it('counts exchange fees on both trips', () => {
      const loan = {
         id: 'a',
         trackingId: 'A',
         borrower: 'b',
         currency: 'PHP' as const,
         principal: 15,
         repayment: 16.5,
         fundedDate: '2026-10-13',
         repaidDate: '2026-11-12'
      };
      const rates = { PHP: series({ '2026-10-13': 58 }), IDR: series({}) };
      const r = realCost(loan, rates, DEFAULT_COSTS, '2026-11-12')!;
      expect(r.fxLocal).toBeCloseTo(0);
      expect(r.exchangeLocal).toBeGreaterThan(15); // at least the ₱15 cash-out
      expect(summarize([r]).count).toBe(1);
   });

   it('picks the currency from the ID country, then the time zone', () => {
      expect(borrowerCurrency('IDN', 'Asia/Manila')).toBe('IDR');
      expect(borrowerCurrency('PHL', 'Asia/Jakarta')).toBe('PHP');
      expect(borrowerCurrency(null, 'Asia/Jakarta')).toBe('IDR');
      expect(borrowerCurrency(null, 'Asia/Macau')).toBe('PHP');
   });

   it('groups 30-day moves by start month', () => {
      // Weakens 1% over every 30 days starting in May, flat otherwise.
      const s = new Map<string, number>();
      let rate = 50;
      for (let t = Date.parse('2020-01-01'); t < Date.parse('2024-12-31'); t += 86_400_000) {
         const day = new Date(t).toISOString().slice(0, 10);
         if (day.slice(5, 7) === '05') rate *= 1.01 ** (1 / 31);
         s.set(day, rate);
      }
      const f = seasonalForecast(s, 30, 10, new Date('2025-01-01'));
      expect(f[4].estimate).toBeGreaterThan(f[0].estimate);
      expect(f[0].estimate).toBeCloseTo(0, 4);
   });
});

describe('suggestedFee', () => {
   it('lowers the fee when the currency is expected to weaken more than usual, raises it when it firms', async () => {
      const { suggestedFee, fxAdjustment } = await import('@/app/admin/borrowerCostModel');
      const forecast = Array.from({ length: 12 }, (_, i) => ({
         month: i + 1,
         meanAll: 0,
         meanRecent: 0,
         estimate: i === 4 ? 0.012 : i === 10 ? -0.012 : 0,
         weakerShare: 0.5,
         p90: 0.02,
         samples: 100
      }));
      expect(fxAdjustment(forecast, 5)).toBeCloseTo(0.012);
      expect(suggestedFee(0.1, forecast, 5)).toBeCloseTo(0.088); // May: peso weakens → lower fee
      expect(suggestedFee(0.1, forecast, 11)).toBeCloseTo(0.112); // Nov: peso firms → higher fee
      expect(suggestedFee(0.1, forecast, 3)).toBeCloseTo(0.1);
   });
});
