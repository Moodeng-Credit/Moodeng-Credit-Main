'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
   type AnalyticsLoanCategory,
   type AnalyticsLoanRow,
   type AnalyticsUserCategory,
   type AnalyticsUserRow,
   type GrowthAnalytics,
   getGrowthAnalytics
} from './adminSupabase';

type Category = AnalyticsUserCategory | AnalyticsLoanCategory;

function pct(value: number): string {
   return `${Math.round(value * 100)}%`;
}

function money(value: number): string {
   return Number(value ?? 0).toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function shortWallet(wallet: string | null): string {
   if (!wallet) return '—';
   return wallet.length > 12 ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}` : wallet;
}

// A stat tile. When `category` is set the tile is a button that opens a drill-down
// list of the exact records it counts; otherwise it renders as a plain box.
function Stat({
   label,
   value,
   note,
   tone = 'default',
   category,
   active,
   onSelect
}: {
   label: string;
   value: string | number;
   note?: string;
   tone?: string;
   category?: Category;
   active?: boolean;
   onSelect?: (category: Category) => void;
}) {
   const border =
      tone === 'danger'
         ? 'border-red-900 bg-red-950/40'
         : tone === 'success'
           ? 'border-emerald-900 bg-emerald-950/40'
           : tone === 'blue'
             ? 'border-blue-900 bg-blue-950/40'
             : 'border-[#2a1453] bg-[#1c0a3a]';
   const clickable = Boolean(category && onSelect);
   const ring = active ? 'ring-2 ring-[#a06bff]' : '';
   const interactive = clickable ? 'cursor-pointer text-left transition hover:brightness-125 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#a06bff]' : '';

   const body = (
      <>
         <p className="text-xs font-black uppercase tracking-wide text-[#a89bb8]">{label}</p>
         <strong className="mt-2 block text-4xl font-black text-white">{value}</strong>
         {note ? <p className="mt-1 text-sm font-bold text-[#a89bb8]">{note}</p> : null}
         {clickable ? <p className="mt-1 text-xs font-black text-[#a06bff]">{active ? 'Hide list ▲' : 'View list ▼'}</p> : null}
      </>
   );

   if (clickable && category && onSelect) {
      return (
         <button type="button" onClick={() => onSelect(category)} aria-pressed={active} className={`rounded-2xl border p-5 ${border} ${ring} ${interactive}`}>
            {body}
         </button>
      );
   }
   return <div className={`rounded-2xl border p-5 ${border}`}>{body}</div>;
}

const USER_FILTERS: Record<AnalyticsUserCategory, { title: string; test: (u: AnalyticsUserRow) => boolean }> = {
   totalUsers: { title: 'All users', test: () => true },
   borrowers: { title: 'Borrowers', test: (u) => u.role === 'borrower' },
   lenders: { title: 'Lenders', test: (u) => u.role === 'lender' },
   unsetRole: { title: 'Users with no role set', test: (u) => u.role !== 'borrower' && u.role !== 'lender' },
   blockedUsers: {
      title: 'Blocked / banned users',
      test: (u) => {
         const s = String(u.status ?? '').toLowerCase();
         return s === 'blocked' || s === 'banned';
      }
   },
   worldIdVerified: { title: 'World ID verified', test: (u) => u.world },
   diditVerified: { title: 'Didit (ID) verified', test: (u) => u.didit },
   anyVerified: { title: 'Verified users', test: (u) => u.world || u.didit }
};

const LOAN_FILTERS: Record<AnalyticsLoanCategory, { title: string; test: (l: AnalyticsLoanRow) => boolean }> = {
   totalLoans: { title: 'All loans', test: () => true },
   requestedLoans: { title: 'Requested loans', test: (l) => l.bucket === 'requested' },
   activeLoans: { title: 'Active loans', test: (l) => l.bucket === 'active' },
   overdueLoans: { title: 'Overdue loans', test: (l) => l.bucket === 'overdue' },
   repaidLoans: { title: 'Repaid loans', test: (l) => l.bucket === 'repaid' }
};

function isUserCategory(category: Category): category is AnalyticsUserCategory {
   return category in USER_FILTERS;
}

// Inline drill-down list for the selected stat card. Uses rows already returned by
// getGrowthAnalytics, so opening a list makes no extra request.
function DetailPanel({ category, data, onClose }: { category: Category; data: GrowthAnalytics; onClose: () => void }) {
   if (isUserCategory(category)) {
      const { title, test } = USER_FILTERS[category];
      const rows = data.userRows.filter(test);
      return (
         <DetailShell title={title} count={rows.length} onClose={onClose}>
            <table className="w-full text-left text-sm">
               <thead>
                  <tr className="text-xs font-black uppercase tracking-wide text-[#6f6385]">
                     <th className="py-2 pr-3">User</th>
                     <th className="py-2 pr-3">Role</th>
                     <th className="py-2 pr-3">Status</th>
                     <th className="py-2 pr-3">Verified</th>
                     <th className="py-2">Wallet</th>
                  </tr>
               </thead>
               <tbody>
                  {rows.map((u) => (
                     <tr key={u.id} className="border-t border-[#2a1453]">
                        <td className="py-2 pr-3 font-bold text-white">{u.username}</td>
                        <td className="py-2 pr-3 capitalize text-[#cfc6dd]">{u.role ?? '—'}</td>
                        <td className="py-2 pr-3 capitalize text-[#cfc6dd]">{u.status ?? '—'}</td>
                        <td className="py-2 pr-3 text-[#cfc6dd]">{[u.world ? 'World' : null, u.didit ? 'Didit' : null].filter(Boolean).join(', ') || '—'}</td>
                        <td className="py-2 font-mono text-[#a89bb8]">{shortWallet(u.wallet)}</td>
                     </tr>
                  ))}
               </tbody>
            </table>
            {rows.length === 0 ? <p className="py-3 text-base font-bold text-[#a89bb8]">No matching users.</p> : null}
         </DetailShell>
      );
   }

   const { title, test } = LOAN_FILTERS[category];
   const rows = data.loanRows.filter(test);
   return (
      <DetailShell title={title} count={rows.length} onClose={onClose}>
         <table className="w-full text-left text-sm">
            <thead>
               <tr className="text-xs font-black uppercase tracking-wide text-[#6f6385]">
                  <th className="py-2 pr-3">Loan</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3 text-right">Amount</th>
                  <th className="py-2 pr-3 text-right">Repaid</th>
                  <th className="py-2 text-right">Owed</th>
               </tr>
            </thead>
            <tbody>
               {rows.map((l) => (
                  <tr key={l.id} className="border-t border-[#2a1453]">
                     <td className="py-2 pr-3 font-mono text-[#cfc6dd]">{l.trackingId ?? l.id.slice(0, 8)}</td>
                     <td className="py-2 pr-3 text-[#cfc6dd]">{l.status ?? '—'}{l.repaymentStatus ? ` · ${l.repaymentStatus}` : ''}</td>
                     <td className="py-2 pr-3 text-right font-bold text-white">{money(l.amount)}</td>
                     <td className="py-2 pr-3 text-right text-emerald-300">{money(l.repaid)}</td>
                     <td className="py-2 text-right text-[#cfc6dd]">{l.bucket === 'repaid' ? '—' : money(l.owed)}</td>
                  </tr>
               ))}
            </tbody>
         </table>
         {rows.length === 0 ? <p className="py-3 text-base font-bold text-[#a89bb8]">No matching loans.</p> : null}
      </DetailShell>
   );
}

function DetailShell({ title, count, onClose, children }: { title: string; count: number; onClose: () => void; children: React.ReactNode }) {
   return (
      <div className="rounded-2xl border border-[#2a1453] bg-[#150730] p-5">
         <div className="mb-3 flex items-center justify-between gap-3">
            <h4 className="text-xl font-black text-white">
               {title} <span className="text-[#a89bb8]">({count})</span>
            </h4>
            <button type="button" onClick={onClose} className="rounded-full bg-[#1c053d] px-4 py-1.5 text-sm font-black text-white">
               Close
            </button>
         </div>
         <div className="max-h-[420px] overflow-auto">{children}</div>
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
   const [selected, setSelected] = useState<Category | null>(null);

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

   // Toggling test data reshuffles every count, so a stale open drill-down would mislead.
   useEffect(() => {
      setSelected(null);
   }, [hideTest]);

   const onSelect = useCallback((category: Category) => {
      setSelected((current) => (current === category ? null : category));
   }, []);

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
                     <Stat label="Total users" value={data.totalUsers} note="all registrations" category="totalUsers" active={selected === 'totalUsers'} onSelect={onSelect} />
                     <Stat label="Borrowers" value={data.borrowers} tone="blue" category="borrowers" active={selected === 'borrowers'} onSelect={onSelect} />
                     <Stat label="Lenders" value={data.lenders} tone="blue" category="lenders" active={selected === 'lenders'} onSelect={onSelect} />
                     <Stat label="Role not set" value={data.unsetRole} note="signed up, no role yet" category="unsetRole" active={selected === 'unsetRole'} onSelect={onSelect} />
                     <Stat label="Verified" value={data.anyVerified} note={`${pct(data.verifiedRate)} of users`} tone="success" category="anyVerified" active={selected === 'anyVerified'} onSelect={onSelect} />
                     <Stat label="World ID" value={data.worldIdVerified} note="is_world_id active" tone="success" category="worldIdVerified" active={selected === 'worldIdVerified'} onSelect={onSelect} />
                     <Stat label="ID verified" value={data.diditVerified} note="Didit active" tone="success" category="diditVerified" active={selected === 'diditVerified'} onSelect={onSelect} />
                     <Stat label="Blocked" value={data.blockedUsers} tone={data.blockedUsers ? 'danger' : 'default'} category="blockedUsers" active={selected === 'blockedUsers'} onSelect={onSelect} />
                  </div>
               </div>

               <div>
                  <h4 className="mb-3 text-xl font-black text-[#cfc6dd]">Loans</h4>
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                     <Stat label="Total loans" value={data.totalLoans} category="totalLoans" active={selected === 'totalLoans'} onSelect={onSelect} />
                     <Stat label="Requested" value={data.requestedLoans} tone="blue" category="requestedLoans" active={selected === 'requestedLoans'} onSelect={onSelect} />
                     <Stat label="Active" value={data.activeLoans} tone="blue" category="activeLoans" active={selected === 'activeLoans'} onSelect={onSelect} />
                     <Stat label="Not paid back" value={data.overdueLoans} tone={data.overdueLoans ? 'danger' : 'default'} category="overdueLoans" active={selected === 'overdueLoans'} onSelect={onSelect} />
                     <Stat label="Paid back" value={data.repaidLoans} note={`${pct(data.repaymentRate)} repayment rate`} tone="success" category="repaidLoans" active={selected === 'repaidLoans'} onSelect={onSelect} />
                     <Stat label="Volume lent" value={money(data.volumeLent)} note="principal disbursed" />
                     <Stat label="Volume repaid" value={money(data.volumeRepaid)} note="cash received" tone="success" />
                     <Stat label="Outstanding" value={money(data.volumeOutstanding)} note="owed incl. interest" tone={data.volumeOutstanding ? 'danger' : 'default'} />
                  </div>
               </div>

               {selected ? <DetailPanel category={selected} data={data} onClose={() => setSelected(null)} /> : null}

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
