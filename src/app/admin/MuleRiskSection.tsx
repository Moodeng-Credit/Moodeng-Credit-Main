'use client';

import { useCallback, useEffect, useState } from 'react';

import { type MuleRiskRow, getMuleRiskScores } from './adminSupabase';

function shortAddr(addr: string): string {
   return addr.length > 14 ? `${addr.slice(0, 8)}…${addr.slice(-6)}` : addr;
}

// Score → colour band. Mirrors the cron's 80 = critical / 60 = warning cut lines.
function band(score: number): { label: string; ring: string; bar: string; chip: string } {
   if (score >= 80) return { label: 'Critical', ring: 'border-red-900 bg-red-950/40', bar: '#f0506e', chip: 'bg-red-900/50 text-red-300' };
   if (score >= 60) return { label: 'High', ring: 'border-amber-900 bg-amber-950/30', bar: '#f0a336', chip: 'bg-amber-900/50 text-amber-300' };
   if (score >= 30) return { label: 'Watch', ring: 'border-[#2a1453] bg-[#1c0a3a]', bar: '#a06bff', chip: 'bg-[#2a1453] text-[#cfc6dd]' };
   return { label: 'Low', ring: 'border-[#2a1453] bg-[#1c0a3a]', bar: '#4ea1ff', chip: 'bg-[#2a1453] text-[#a89bb8]' };
}

// One borrower's risk card: score meter, band chip, reasons, and the shared
// destinations that drove the score.
function RiskCard({ row }: { row: MuleRiskRow }) {
   const b = band(row.score);
   return (
      <div className={`rounded-2xl border p-5 ${b.ring}`}>
         <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
               <p className="truncate text-lg font-black text-white">{row.username ?? row.user_id}</p>
               <p className="text-xs font-bold text-[#a89bb8]">
                  {row.account_status ? <span className="capitalize">{row.account_status}</span> : 'active'}
                  {row.max_co_borrowers > 0 ? ` · ${row.max_co_borrowers} co-borrower(s) on shared destinations` : ''}
               </p>
            </div>
            <div className="text-right">
               <span className={`rounded-full px-2 py-0.5 text-xs font-black ${b.chip}`}>{b.label}</span>
               <p className="mt-1 text-3xl font-black text-white">{row.score}<span className="text-base text-[#a89bb8]">/100</span></p>
            </div>
         </div>
         <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-[#150730]">
            <div className="h-full rounded-full" style={{ width: `${Math.min(row.score, 100)}%`, backgroundColor: b.bar }} />
         </div>
         {row.reasons.length ? (
            <ul className="mt-3 space-y-1">
               {row.reasons.map((r) => (
                  <li key={r} className="flex gap-2 text-sm font-bold text-[#cfc6dd]">
                     <span className="text-[#a06bff]">•</span>
                     {r}
                  </li>
               ))}
            </ul>
         ) : null}
         {row.destinations.length ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
               {row.destinations.map((d) => (
                  <span key={d} className="rounded bg-[#150730] px-2 py-1 font-mono text-xs text-[#a89bb8]" title={d}>
                     {shortAddr(d)}
                  </span>
               ))}
            </div>
         ) : null}
      </div>
   );
}

// `initialRows` skips the fetch — used by the dev preview route where the admin RPC
// isn't reachable. Production renders it without the prop and fetches live.
export default function MuleRiskSection({ initialRows }: { initialRows?: MuleRiskRow[] } = {}) {
   const [rows, setRows] = useState<MuleRiskRow[] | null>(initialRows ?? null);
   const [loading, setLoading] = useState(false);
   const [error, setError] = useState<string | null>(null);
   const [notDeployed, setNotDeployed] = useState(false);

   const load = useCallback(async () => {
      setLoading(true);
      setError(null);
      try {
         const res = await getMuleRiskScores(100);
         setRows(res.rows);
         setNotDeployed(res.notDeployed);
      } catch (err) {
         setError(err instanceof Error ? err.message : 'Could not load mule-risk scores.');
      } finally {
         setLoading(false);
      }
   }, []);

   useEffect(() => {
      if (initialRows) return;
      void load();
   }, [initialRows, load]);

   return (
      <section className="space-y-6">
         <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
               <h2 className="break-words text-4xl font-black sm:text-5xl">Mule risk</h2>
               <p className="mt-3 max-w-3xl text-2xl text-[#a89bb8]">
                  Per-borrower risk from the on-chain money graph — how close each borrower sits to known-bad accounts and shared payout
                  destinations. Higher = more mule-like.
               </p>
            </div>
            <button
               type="button"
               onClick={() => load()}
               disabled={loading}
               className="rounded-full bg-[#1c053d] px-4 py-1.5 text-sm font-black text-white disabled:opacity-50"
            >
               {loading ? '…' : 'Refresh'}
            </button>
         </div>

         {error ? <div className="rounded-2xl border border-red-900 bg-red-950/40 p-4 text-lg font-bold text-red-300">{error}</div> : null}

         {notDeployed ? (
            <div className="rounded-2xl border border-amber-900 bg-amber-950/30 p-5 text-amber-200">
               <p className="text-lg font-black">Scoring function not deployed yet</p>
               <p className="mt-2 text-base font-bold">
                  Apply <code className="rounded bg-[#150730] px-1.5 py-0.5 font-mono text-sm">score_borrower_mule_risk</code> to this project
                  (migration <span className="font-mono">20260819000200_score_borrower_mule_risk.sql</span>), then refresh. Scores also need
                  the <span className="font-mono">loan_fund_flow</span> tracer to have run.
               </p>
            </div>
         ) : null}

         {!notDeployed && rows && !rows.length && !loading ? (
            <div className="rounded-2xl border border-emerald-900 bg-emerald-950/30 p-5 text-lg font-black text-emerald-300">
               No borrowers scored above zero — nothing mule-like in the money graph right now.
            </div>
         ) : null}

         {rows && rows.length ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
               {rows.map((row) => (
                  <RiskCard key={row.user_id} row={row} />
               ))}
            </div>
         ) : null}

         {!rows && loading ? (
            <div className="rounded-2xl border border-[#2a1453] bg-[#1c0a3a] p-5 text-xl font-black text-[#a89bb8]">Scoring borrowers…</div>
         ) : null}
      </section>
   );
}
