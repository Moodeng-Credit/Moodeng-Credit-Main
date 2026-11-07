import { assert, assertEquals, assertStringIncludes } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import {
   buildFxMovedAlert,
   decideUsdIdrRate,
   formatIdr,
   isRateFresh,
   refreshUsdIdrRate,
   remainingIdr,
   saneUsdIdr,
   sumRemainingIdr
} from './fxRates.ts';

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

const fetchWith = (erApi: unknown, frankfurter: unknown, calls: string[] = []) =>
   ((url: string) => {
      calls.push(url);
      const body = url.includes('er-api') ? erApi : frankfurter;
      if (body instanceof Error) return Promise.reject(body);
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
   }) as unknown as typeof fetch;

const stale = new Date(Date.now() - 7 * 3_600_000).toISOString();

Deno.test('refreshUsdIdrRate: one silly source, nothing stored yet → stores the sane one', async () => {
   const inserted: unknown[] = [];
   const calls: string[] = [];
   const alerts: string[] = [];
   const res = await refreshUsdIdrRate(fakeSvc(null, inserted), {
      fetchImpl: fetchWith({ rates: { IDR: 1.5 } }, { rates: { IDR: 16620 } }, calls),
      alert: (t) => Promise.resolve(void alerts.push(t))
   });
   assertEquals(res, { rate: 16620, fetched: true, source: 'frankfurter.app' });
   assertEquals(calls.length, 2);
   assertEquals(inserted, [{ pair: 'USD/IDR', rate: 16620, source: 'frankfurter.app' }]);
   assertEquals(alerts.length, 0);
});

Deno.test('refreshUsdIdrRate: both agree within 2% → stores the average', async () => {
   const inserted: unknown[] = [];
   const res = await refreshUsdIdrRate(fakeSvc({ rate: 16500, fetched_at: stale }, inserted), {
      fetchImpl: fetchWith({ rates: { IDR: 16600 } }, { rates: { IDR: 16700 } }),
      alert: () => Promise.resolve()
   });
   assertEquals(res, { rate: 16650, fetched: true, source: 'er-api+frankfurter' });
   assertEquals(inserted, [{ pair: 'USD/IDR', rate: 16650, source: 'er-api+frankfurter' }]);
});

Deno.test('refreshUsdIdrRate: sources disagree → keeps the old rate and alerts', async () => {
   const inserted: unknown[] = [];
   const alerts: string[] = [];
   const res = await refreshUsdIdrRate(fakeSvc({ rate: 16500, fetched_at: stale }, inserted), {
      fetchImpl: fetchWith({ rates: { IDR: 16600 } }, { rates: { IDR: 18000 } }),
      alert: (t) => Promise.resolve(void alerts.push(t))
   });
   assertEquals(res, { rate: 16500, fetched: false, error: 'sources_disagree' });
   assertEquals(inserted.length, 0);
   assertEquals(alerts.length, 1);
   assertStringIncludes(alerts[0], 'disagree');
});

Deno.test('refreshUsdIdrRate: one source within 3% of the last rate → stored; further off → alert', async () => {
   const inserted: unknown[] = [];
   const ok = await refreshUsdIdrRate(fakeSvc({ rate: 16500, fetched_at: stale }, inserted), {
      fetchImpl: fetchWith(new Error('down'), { rates: { IDR: 16900 } }),
      alert: () => Promise.resolve()
   });
   assertEquals(ok, { rate: 16900, fetched: true, source: 'frankfurter.app' });
   const alerts: string[] = [];
   const inserted2: unknown[] = [];
   const off = await refreshUsdIdrRate(fakeSvc({ rate: 16500, fetched_at: stale }, inserted2), {
      fetchImpl: fetchWith({ rates: { IDR: 17500 } }, new Error('down')),
      alert: (t) => Promise.resolve(void alerts.push(t))
   });
   assertEquals(off, { rate: 16500, fetched: false, error: 'single_source_off' });
   assertEquals(inserted2.length, 0);
   assertEquals(alerts.length, 1);
});

Deno.test('decideUsdIdrRate: no source → nothing', () => {
   assertEquals(decideUsdIdrRate([null, null], 16500), { store: null, error: 'no_rate_source' });
   assertEquals(decideUsdIdrRate([{ rate: 16000, source: 'a' }, null], null), { store: { rate: 16000, source: 'a' } });
});
