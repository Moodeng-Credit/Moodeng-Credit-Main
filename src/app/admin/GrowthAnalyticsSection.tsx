'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { type GrowthAnalytics, getGrowthAnalytics } from './adminSupabase';

function pct(value: number): string {
   return `${Math.round(value * 100)}%`;
}

function money(value: number): string {
   return Number(value ?? 0).toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function Stat({ label, value, note, tone = 'default' }: { label: string; value: string | number; note?: string; tone?: string }) {
   const border =
      tone === 'danger'
         ? 'border-red-900 bg-red-950/40'
         : tone === 'success'
           ? 'border-emerald-900 bg-emerald-950/40'
           : tone === 'blue'
             ? 'border-blue-900 bg-blue-950/40'
             : 'border-[#2a1453] bg-[#1c0a3a]';
   return (
      <div className={`rounded-2xl border p-5 ${border}`}>
         <p className="text-xs font-black uppercase tracking-wide text-[#a89bb8]">{label}</p>
         <strong className="mt-2 block text-4xl font-black text-white">{value}</strong>
         {note ? <p className="mt-1 text-sm font-bold text-[#a89bb8]">{note}</p> : null}
      </div>
   );
}

// Cumulative-registrations line as a self-contained inline SVG (no chart library).
function GrowthChart({ data }: { data: GrowthAnalytics['registrationsByWeek'] }) {
   const W = 720;
   const H = 200;
   const P = 8;
   if (data.length < 2) {
      return <p className="text-base font-bold text-[#a89bb8]">Not enough history yet to chart a trend.</p>;
   }
   const maxCum = Math.max(...data.map((d) => d.cumulative), 1);
   const stepX = (W - P * 2) / (data.length - 1);
   const points = data.map((d, i) => {
      const x = P + i * stepX;
      const y = H - P - (d.cumulative / maxCum) * (H - P * 2);
      return [x, y] as const;
   });
   const line = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
   const area = `${line} L${points[points.length - 1][0].toFixed(1)},${H - P} L${points[0][0].toFixed(1)},${H - P} Z`;
   return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Cumulative registrations over time">
         <path d={area} fill="#8336f0" opacity="0.18" />
         <path d={line} fill="none" stroke="#a06bff" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
         {points.map(([x, y], i) => (
            <circle key={data[i]?.weekStart ?? `${x}-${y}`} cx={x} cy={y} r="2.5" fill="#d7c4ff" />
         ))}
      </svg>
   );
}

// `initialData` skips the fetch — used by tests and the dev preview route where the admin
// `users` table isn't readable. Production renders it without the prop and fetches live.
export default function GrowthAnalyticsSection({ initialData }: { initialData?: GrowthAnalytics } = {}) {
   const [data, setData] = useState<GrowthAnalytics | null>(initialData ?? null);
   const [loading, setLoading] = useState(false);
   const [error, setError] = useState<string | null>(null);
   const [hideTest, setHideTest] = useState(true);

   const load = useCallback(async (includeTest: boolean) => {
      setLoading(true);
      setError(null);
      try {
         setData(await getGrowthAnalytics({ includeTest }));
      } catch (err) {
         setError(err instanceof Error ? err.message : 'Could not load analytics.');
      } finally {
         setLoading(false);
      }
   }, []);

   useEffect(() => {
      if (initialData) return;
      void load(!hideTest);
   }, [initialData, hideTest, load]);

   const maxWeek = useMemo(() => (data ? Math.max(...data.registrationsByWeek.map((w) => w.count), 1) : 1), [data]);

   return (
      <div className="space-y-5">
         <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-3xl font-black">Growth &amp; analytics</h3>
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

         {error ? (
            <div className="rounded-2xl border border-red-900 bg-red-950/40 p-4 text-lg font-bold text-red-300">{error}</div>
         ) : null}

         {!data ? (
            <div className="rounded-2xl border border-[#2a1453] bg-[#1c0a3a] p-5 text-xl font-black text-[#a89bb8]">
               {loading ? 'Loading analytics…' : 'No data.'}
            </div>
         ) : (
            <>
               <div>
                  <h4 className="mb-3 text-xl font-black text-[#cfc6dd]">People</h4>
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                     <Stat label="Total users" value={data.totalUsers} note="all registrations" />
                     <Stat label="Borrowers" value={data.borrowers} tone="blue" />
                     <Stat label="Lenders" value={data.lenders} tone="blue" />
                     <Stat label="Role not set" value={data.unsetRole} note="signed up, no role yet" />
                     <Stat label="Verified" value={data.anyVerified} note={`${pct(data.verifiedRate)} of users`} tone="success" />
                     <Stat label="World ID" value={data.worldIdVerified} note="is_world_id active" tone="success" />
                     <Stat label="ID verified" value={data.diditVerified} note="Didit active" tone="success" />
                     <Stat label="Blocked" value={data.blockedUsers} tone={data.blockedUsers ? 'danger' : 'default'} />
                  </div>
               </div>

               <div>
                  <h4 className="mb-3 text-xl font-black text-[#cfc6dd]">Loans</h4>
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                     <Stat label="Total loans" value={data.totalLoans} />
                     <Stat label="Requested" value={data.requestedLoans} tone="blue" />
                     <Stat label="Active" value={data.activeLoans} tone="blue" />
                     <Stat label="Not paid back" value={data.overdueLoans} tone={data.overdueLoans ? 'danger' : 'default'} />
                     <Stat label="Paid back" value={data.repaidLoans} note={`${pct(data.repaymentRate)} repayment rate`} tone="success" />
                     <Stat label="Volume lent" value={money(data.volumeLent)} />
                     <Stat label="Volume repaid" value={money(data.volumeRepaid)} tone="success" />
                     <Stat label="Outstanding" value={money(data.volumeOutstanding)} tone={data.volumeOutstanding ? 'danger' : 'default'} />
                  </div>
               </div>

               <div className="rounded-2xl border border-[#2a1453] bg-[#1c0a3a] p-5">
                  <h4 className="mb-3 text-xl font-black text-[#cfc6dd]">Registrations over time (cumulative)</h4>
                  <GrowthChart data={data.registrationsByWeek} />
                  {data.registrationsByWeek.length ? (
                     <div className="mt-5">
                        <p className="mb-2 text-sm font-black uppercase tracking-wide text-[#a89bb8]">New sign-ups by week</p>
                        <div className="flex items-end gap-1" style={{ height: 90 }}>
                           {data.registrationsByWeek.map((w) => (
                              <div key={w.weekStart} className="group relative flex-1" title={`${w.weekStart}: ${w.count} new`}>
                                 <div
                                    className="w-full rounded-t bg-[#8336f0]"
                                    style={{ height: `${Math.max((w.count / maxWeek) * 80, 2)}px` }}
                                 />
                              </div>
                           ))}
                        </div>
                        <div className="mt-1 flex justify-between text-xs font-bold text-[#6f6385]">
                           <span>{data.registrationsByWeek[0].weekStart}</span>
                           <span>{data.registrationsByWeek[data.registrationsByWeek.length - 1].weekStart}</span>
                        </div>
                     </div>
                  ) : null}
               </div>
            </>
         )}
      </div>
   );
}
