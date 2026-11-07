import { assert, assertEquals, assertStringIncludes } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { buildFxMovedAlert, formatIdr, isRateFresh, refreshUsdIdrRate, remainingIdr, saneUsdIdr, sumRemainingIdr } from './fxRates.ts';

Deno.test('saneUsdIdr keeps 10,000–30,000 only', () => {
   assertEquals(saneUsdIdr(16_543.2), 16_543.2);
   assertEquals(saneUsdIdr('18000'), 18_000);
   assertEquals(saneUsdIdr(9_999), null);
   assertEquals(saneUsdIdr(30_001), null);
   assertEquals(saneUsdIdr(undefined), null);
   assertEquals(saneUsdIdr('abc'), null);
});

Deno.test('isRateFresh: under 6h is fresh', () => {
   const now = Date.parse('2026-11-07T12:00:00Z');
   assert(isRateFresh('2026-11-07T07:00:00Z', now));
   assert(!isRateFresh('2026-11-07T05:59:00Z', now));
   assert(!isRateFresh(null, now));
   assert(!isRateFresh('nope', now));
});

Deno.test('formatIdr uses Indonesian grouping', () => {
   assertEquals(formatIdr(110000), 'Rp 110.000');
   assertEquals(formatIdr('72000.4'), 'Rp 72.000');
   assertEquals(formatIdr(null), 'Rp 0');
});

Deno.test('remainingIdr / sumRemainingIdr', () => {
   assertEquals(remainingIdr({ repay_idr: 110000, repaid_idr: 38000 }), 72000);
   assertEquals(remainingIdr({ repay_idr: '110000', repaid_idr: '120000' }), 0);
   assertEquals(remainingIdr({ repay_idr: null }), null);
   assertEquals(remainingIdr(null), null);
   assertEquals(sumRemainingIdr([{ repay_idr: 110000, repaid_idr: 0 }, { repay_idr: 50000, repaid_idr: 10000 }]), 150000);
   assertEquals(sumRemainingIdr([{ repay_idr: 110000 }, { repay_idr: null }]), null);
   assertEquals(sumRemainingIdr([]), null);
});

Deno.test('moved alert names the loan, the move and what is left', () => {
   const text = buildFxMovedAlert({
      id: 'abcdef12-0000',
      trackingId: 'LOAN-1',
      loanStatus: 'Lent',
      loanAmount: 5,
      repayIdr: 110000,
      repaidIdr: 0,
      totalRepaymentAmount: 5.73,
      rateAtRequest: 18100,
      rateNow: 19200,
      movePct: 6.1
   });
   assertStringIncludes(text, '🇮🇩 Rupiah moved +6.1% on loan LOAN-1');
   assertStringIncludes(text, 'Rp 110.000 promised');
   assertStringIncludes(text, '≈ $5.73 due now');
});

const fakeSvc = (latest: { rate: number; fetched_at: string } | null, inserted: unknown[]) => ({
   from: () => {
      const chain = {
         select: () => chain,
         eq: () => chain,
         order: () => chain,
         limit: () => chain,
         maybeSingle: () => Promise.resolve({ data: latest, error: null }),
         insert: (row: unknown) => {
            inserted.push(row);
            return Promise.resolve({ error: null });
         }
      };
      return chain;
   }
});

Deno.test('refreshUsdIdrRate skips when a recent rate exists', async () => {
   const inserted: unknown[] = [];
   const res = await refreshUsdIdrRate(fakeSvc({ rate: 16500, fetched_at: new Date().toISOString() }, inserted), {
      fetchImpl: () => Promise.reject(new Error('should not fetch'))
   });
   assertEquals(res, { rate: 16500, fetched: false });
   assertEquals(inserted.length, 0);
});

Deno.test('refreshUsdIdrRate falls back to the second source and rejects silly rates', async () => {
   const inserted: unknown[] = [];
   const calls: string[] = [];
   const fetchImpl = ((url: string) => {
      calls.push(url);
      const body = url.includes('er-api') ? { rates: { IDR: 1.5 } } : { rates: { IDR: 16620 } };
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
   }) as unknown as typeof fetch;
   const res = await refreshUsdIdrRate(fakeSvc(null, inserted), { fetchImpl });
   assertEquals(res, { rate: 16620, fetched: true, source: 'frankfurter.app' });
   assertEquals(calls.length, 2);
   assertEquals(inserted, [{ pair: 'USD/IDR', rate: 16620, source: 'frankfurter.app' }]);
});
