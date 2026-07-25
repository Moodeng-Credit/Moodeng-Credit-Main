'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { classifyOffer, type OfferBand, suggestedReturnRange } from '@/lib/loanPricing';

import { type AdminLoanRecord, listAdminLoans } from './adminSupabase';

function money(value: number): string {
   return Number(value ?? 0).toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function plusMoney(value: number): string {
   const rounded = Math.round(value * 100) / 100;
   const body = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
   return `+$${body}`;
}

function pct(part: number, whole: number): string {
   if (!whole) return '0%';
   return `${Math.round((part / whole) * 100)}%`;
}

function median(values: number[]): number | null {
   if (!values.length) return null;
   const sorted = [...values].sort((a, b) => a - b);
   const mid = Math.floor(sorted.length / 2);
   return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function formatDuration(hours: number | null): string {
   if (hours == null) return '—';
   if (hours < 1) return '<1h';
   if (hours < 48) return `${Math.round(hours)}h`;
   return `${Math.round(hours / 24)}d`;
}

const BAND_META: Record<OfferBand, { label: string; bar: string; tone: string }> = {
   below: { label: 'Underpriced', bar: 'bg-amber-500', tone: 'border-amber-900 bg-amber-950/40' },
   in: { label: 'Priced right', bar: 'bg-emerald-500', tone: 'border-emerald-900 bg-emerald-950/40' },
   above: { label: 'Overpaying', bar: 'bg-blue-500', tone: 'border-blue-900 bg-blue-950/40' }
};

const SIZE_BUCKETS: Array<{ label: string; min: number; max: number; mid: number }> = [
   { label: '$1–20', min: 0, max: 20, mid: 17.5 },
   { label: '$20–40', min: 20, max: 40, mid: 30 },
   { label: '$40–60', min: 40, max: 60, mid: 50 },
   { label: '$60–80', min: 60, max: 80, mid: 70 },
   { label: '$80–100', min: 80, max: 100, mid: 90 },
   { label: '$100+', min: 100, max: Infinity, mid: 110 }
];

interface PricedLoan {
   loan: AdminLoanRecord;
   band: OfferBand;
   offer: number;
   funded: boolean;
   timeToFundHours: number | null;
}

function StatCard({ label, value, note, tone }: { label: string; value: string | number; note?: string; tone?: string }) {
   return (
      <div className={`rounded-2xl border p-5 ${tone ?? 'border-[#2a1453] bg-[#1c0a3a]'}`}>
         <p className="text-xs font-black uppercase tracking-wide text-[#a89bb8]">{label}</p>
         <strong className="mt-2 block text-4xl font-black text-white">{value}</strong>
         {note ? <p className="mt-1 text-sm font-bold text-[#a89bb8]">{note}</p> : null}
      </div>
   );
}

// `initialLoans` skips the live fetch — used by the dev preview route (where the admin
// tables aren't readable) and tests. Production renders without it and fetches live.
export default function PricingHealthSection({ initialLoans }: { initialLoans?: AdminLoanRecord[] } = {}) {
   const [loans, setLoans] = useState<AdminLoanRecord[] | null>(initialLoans ?? null);
   const [loading, setLoading] = useState(false);
   const [error, setError] = useState<string | null>(null);
   const [hideTest, setHideTest] = useState(true);

   const load = useCallback(async (includeTest: boolean) => {
      setLoading(true);
      setError(null);
      try {
         setLoans(await listAdminLoans('all', { includeTest }));
      } catch (err) {
         setError(err instanceof Error ? err.message : 'Could not load loans.');
      } finally {
         setLoading(false);
      }
   }, []);

   useEffect(() => {
      if (initialLoans) return;
      void load(!hideTest);
   }, [initialLoans, hideTest, load]);

   const priced = useMemo<PricedLoan[]>(() => {
      if (!loans) return [];
      const out: PricedLoan[] = [];
      for (const loan of loans) {
         const band = classifyOffer(loan.loan_amount, loan.total_repayment_amount);
         if (!band) continue;
         const funded = loan.loan_status === 'Lent';
         let timeToFundHours: number | null = null;
         if (funded && loan.created_at && loan.funded_at) {
            const ms = new Date(loan.funded_at).getTime() - new Date(loan.created_at).getTime();
            if (Number.isFinite(ms) && ms >= 0) timeToFundHours = ms / 3_600_000;
         }
         out.push({ loan, band, offer: loan.total_repayment_amount - loan.loan_amount, funded, timeToFundHours });
      }
      return out;
   }, [loans]);

   const counts = useMemo(() => {
      const c = { below: 0, in: 0, above: 0 } as Record<OfferBand, number>;
      for (const p of priced) c[p.band] += 1;
      return c;
   }, [priced]);

   const byBand = useMemo(() => {
      const build = (band: OfferBand) => {
         const rows = priced.filter((p) => p.band === band);
         const funded = rows.filter((p) => p.funded);
         return {
            total: rows.length,
            fundedRate: rows.length ? funded.length / rows.length : 0,
            medianFundHours: median(funded.map((p) => p.timeToFundHours).filter((h): h is number => h != null))
         };
      };
      return { below: build('below'), in: build('in'), above: build('above') };
   }, [priced]);

   const underpricedOpen = useMemo(
      () =>
         priced
            .filter((p) => p.band === 'below' && p.loan.loan_status === 'Requested')
            .sort((a, b) => new Date(b.loan.created_at ?? 0).getTime() - new Date(a.loan.created_at ?? 0).getTime())
            .slice(0, 12),
      [priced]
   );

   const buckets = useMemo(
      () =>
         SIZE_BUCKETS.map((bucket) => {
            const rows = priced.filter((p) => p.loan.loan_amount >= bucket.min && p.loan.loan_amount < bucket.max);
            const avgOffer = rows.length ? rows.reduce((sum, p) => sum + p.offer, 0) / rows.length : null;
            const suggested = suggestedReturnRange(bucket.mid);
            return { ...bucket, count: rows.length, avgOffer, suggested };
         }).filter((b) => b.count > 0),
      [priced]
   );

   const total = priced.length;

   return (
      <div className="space-y-5">
         <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-3xl font-black">Loan pricing health</h3>
            <div className="flex items-center gap-2">
               <button
                  type="button"
                  onClick={() => setHideTest((v) => !v)}
                  className={`rounded-full px-4 py-1.5 text-sm font-black ${hideTest ? 'bg-emerald-900/50 text-emerald-300' : 'bg-amber-900/50 text-amber-300'}`}
               >
                  {hideTest ? 'Real customers only' : 'Including test data'}
               </button>
               <button
                  type="button"
                  onClick={() => load(!hideTest)}
                  disabled={loading}
                  className="rounded-full bg-[#1c053d] px-4 py-1.5 text-sm font-black text-white disabled:opacity-50"
               >
                  {loading ? '…' : 'Refresh'}
               </button>
            </div>
         </div>

         <p className="max-w-3xl text-base font-bold text-[#a89bb8]">
            How borrowers price the return they offer lenders, versus the suggested range for each loan size. This is guidance
            only — nothing is enforced. Use it to sanity-check the suggested ranges and spot requests that may sit unfunded.
         </p>

         {error ? (
            <div className="rounded-2xl border border-red-900 bg-red-950/40 p-4 text-lg font-bold text-red-300">{error}</div>
         ) : null}

         {!loans ? (
            <div className="rounded-2xl border border-[#2a1453] bg-[#1c0a3a] p-5 text-xl font-black text-[#a89bb8]">
               {loading ? 'Loading loans…' : 'No data.'}
            </div>
         ) : total === 0 ? (
            <div className="rounded-2xl border border-[#2a1453] bg-[#1c0a3a] p-5 text-xl font-black text-[#a89bb8]">
               No priced loans yet.
            </div>
         ) : (
            <>
               <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  <StatCard label="Loans priced" value={total} note="requested + funded" />
                  <StatCard label={BAND_META.in.label} value={counts.in} note={`${pct(counts.in, total)} of loans`} tone={BAND_META.in.tone} />
                  <StatCard
                     label={BAND_META.below.label}
                     value={counts.below}
                     note={`${pct(counts.below, total)} — below suggested`}
                     tone={BAND_META.below.tone}
                  />
                  <StatCard
                     label={BAND_META.above.label}
                     value={counts.above}
                     note={`${pct(counts.above, total)} — above suggested`}
                     tone={BAND_META.above.tone}
                  />
               </div>

               <div className="rounded-2xl border border-[#2a1453] bg-[#1c0a3a] p-5">
                  <h4 className="mb-3 text-xl font-black text-[#cfc6dd]">How loans are priced</h4>
                  <div className="flex h-5 w-full overflow-hidden rounded-full bg-[#100523]">
                     {(['below', 'in', 'above'] as OfferBand[]).map((band) =>
                        counts[band] ? (
                           <div
                              key={band}
                              className={BAND_META[band].bar}
                              style={{ width: `${(counts[band] / total) * 100}%` }}
                              title={`${BAND_META[band].label}: ${counts[band]} (${pct(counts[band], total)})`}
                           />
                        ) : null
                     )}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-4 text-sm font-bold text-[#a89bb8]">
                     {(['in', 'below', 'above'] as OfferBand[]).map((band) => (
                        <span key={band} className="flex items-center gap-2">
                           <span className={`inline-block size-3 rounded-full ${BAND_META[band].bar}`} />
                           {BAND_META[band].label} · {counts[band]} ({pct(counts[band], total)})
                        </span>
                     ))}
                  </div>
               </div>

               <div className="rounded-2xl border border-[#2a1453] bg-[#1c0a3a] p-5">
                  <h4 className="mb-1 text-xl font-black text-[#cfc6dd]">Does pricing affect funding?</h4>
                  <p className="mb-4 text-sm font-bold text-[#6f6385]">Funded share and typical time-to-fund by pricing band.</p>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                     {(['below', 'in', 'above'] as OfferBand[]).map((band) => (
                        <div key={band} className={`rounded-2xl border p-4 ${BAND_META[band].tone}`}>
                           <p className="text-xs font-black uppercase tracking-wide text-[#cfc6dd]">{BAND_META[band].label}</p>
                           <strong className="mt-2 block text-3xl font-black text-white">{pct(byBand[band].total ? byBand[band].fundedRate : 0, 1)}</strong>
                           <p className="mt-1 text-sm font-bold text-[#a89bb8]">funded · {byBand[band].total} loan{byBand[band].total === 1 ? '' : 's'}</p>
                           <p className="mt-2 text-sm font-bold text-[#cfc6dd]">
                              Median to fund: <span className="text-white">{formatDuration(byBand[band].medianFundHours)}</span>
                           </p>
                        </div>
                     ))}
                  </div>
               </div>

               <div className="rounded-2xl border border-[#2a1453] bg-[#1c0a3a] p-5">
                  <h4 className="mb-1 text-xl font-black text-[#cfc6dd]">Underpriced open requests</h4>
                  <p className="mb-4 text-sm font-bold text-[#6f6385]">
                     Still awaiting a lender and offering below the suggested return — candidates to nudge.
                  </p>
                  {underpricedOpen.length === 0 ? (
                     <p className="text-base font-bold text-[#a89bb8]">None right now — every open request is priced in range or above. 🎉</p>
                  ) : (
                     <div className="overflow-x-auto">
                        <table className="w-full min-w-[520px] text-left">
                           <thead>
                              <tr className="text-xs font-black uppercase tracking-wide text-[#6f6385]">
                                 <th className="pb-2">Borrower</th>
                                 <th className="pb-2 text-right">Loan</th>
                                 <th className="pb-2 text-right">Offered</th>
                                 <th className="pb-2 text-right">Suggested</th>
                              </tr>
                           </thead>
                           <tbody>
                              {underpricedOpen.map((p) => {
                                 const range = suggestedReturnRange(p.loan.loan_amount);
                                 return (
                                    <tr key={p.loan.id} className="border-t border-[#2a1453]">
                                       <td className="py-3 text-base font-bold text-white">
                                          {p.loan.borrower?.username ?? p.loan.tracking_id ?? 'Unknown'}
                                       </td>
                                       <td className="py-3 text-right text-base font-bold text-[#cfc6dd]">{money(p.loan.loan_amount)}</td>
                                       <td className="py-3 text-right text-base font-black text-amber-300">{plusMoney(p.offer)}</td>
                                       <td className="py-3 text-right text-base font-bold text-emerald-300">
                                          {range ? `+$${range.lo}–${range.hi}` : '—'}
                                       </td>
                                    </tr>
                                 );
                              })}
                           </tbody>
                        </table>
                     </div>
                  )}
               </div>

               <div className="rounded-2xl border border-[#2a1453] bg-[#1c0a3a] p-5">
                  <h4 className="mb-1 text-xl font-black text-[#cfc6dd]">Offered vs suggested, by loan size</h4>
                  <p className="mb-4 text-sm font-bold text-[#6f6385]">
                     Average return borrowers actually offer per size bracket — use this to recalibrate the suggested ranges.
                  </p>
                  <div className="overflow-x-auto">
                     <table className="w-full min-w-[520px] text-left">
                        <thead>
                           <tr className="text-xs font-black uppercase tracking-wide text-[#6f6385]">
                              <th className="pb-2">Loan size</th>
                              <th className="pb-2 text-right">Loans</th>
                              <th className="pb-2 text-right">Avg offered</th>
                              <th className="pb-2 text-right">Suggested</th>
                           </tr>
                        </thead>
                        <tbody>
                           {buckets.map((b) => (
                              <tr key={b.label} className="border-t border-[#2a1453]">
                                 <td className="py-3 text-base font-bold text-white">{b.label}</td>
                                 <td className="py-3 text-right text-base font-bold text-[#cfc6dd]">{b.count}</td>
                                 <td className="py-3 text-right text-base font-black text-white">{b.avgOffer == null ? '—' : plusMoney(b.avgOffer)}</td>
                                 <td className="py-3 text-right text-base font-bold text-emerald-300">
                                    {b.suggested ? `+$${b.suggested.lo}–${b.suggested.hi}` : '—'}
                                 </td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>
               </div>
            </>
         )}
      </div>
   );
}
