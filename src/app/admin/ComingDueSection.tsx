'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { type ComingDueLoan, listComingDueLoans, nudgeBorrower } from './adminSupabase';

type BucketId = 'overdue' | 'due3' | 'due7' | 'due14' | 'due30' | 'upcoming';

const BUCKETS: Array<{ id: BucketId; label: string; test: (days: number) => boolean }> = [
   { id: 'overdue', label: 'Overdue', test: (d) => d < 0 },
   { id: 'due3', label: 'Next 3 days', test: (d) => d >= 0 && d <= 3 },
   { id: 'due7', label: 'Next 7 days', test: (d) => d >= 0 && d <= 7 },
   { id: 'due14', label: 'Next 14 days', test: (d) => d >= 0 && d <= 14 },
   { id: 'due30', label: 'Next 30 days', test: (d) => d >= 0 && d <= 30 },
   { id: 'upcoming', label: 'All upcoming', test: (d) => d >= 0 }
];

function money(value: number | null | undefined): string {
   return Number(value ?? 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

function shortDate(value: string | null): string {
   if (!value) return '—';
   const d = new Date(value);
   return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function countdownLabel(days: number): string {
   if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue`;
   if (days === 0) return 'Due today';
   if (days === 1) return 'Due tomorrow';
   return `Due in ${days} days`;
}

function countdownClass(days: number): string {
   if (days < 0) return 'bg-red-900/50 text-red-300';
   if (days <= 1) return 'bg-orange-900/50 text-orange-300';
   if (days <= 7) return 'bg-amber-900/50 text-amber-300';
   return 'bg-blue-900/50 text-blue-300';
}

export default function ComingDueSection({
   onExtend,
   initialLoans
}: {
   onExtend?: (loanId: string) => void;
   initialLoans?: ComingDueLoan[];
}) {
   const [loans, setLoans] = useState<ComingDueLoan[]>(initialLoans ?? []);
   const [loading, setLoading] = useState(false);
   const [error, setError] = useState<string | null>(null);
   const [bucket, setBucket] = useState<BucketId>('due7');
   const [hideTest, setHideTest] = useState(true);
   const [search, setSearch] = useState('');
   const [nudging, setNudging] = useState<string | null>(null);
   const [nudged, setNudged] = useState<Record<string, string>>({});

   const load = useCallback(async (includeTest: boolean) => {
      setLoading(true);
      setError(null);
      try {
         setLoans(await listComingDueLoans({ includeTest }));
      } catch (err) {
         setError(err instanceof Error ? err.message : 'Could not load loans.');
      } finally {
         setLoading(false);
      }
   }, []);

   useEffect(() => {
      if (initialLoans) return; // preview/tests inject data and skip the live fetch
      void load(!hideTest);
   }, [hideTest, load, initialLoans]);

   const handleNudge = useCallback(async (loan: ComingDueLoan) => {
      setNudging(loan.id);
      setError(null);
      try {
         const r = await nudgeBorrower(loan);
         const channels = [r.borrowerEmailSent ? 'email' : null, r.borrowerTelegramSent ? 'Telegram' : null].filter(Boolean);
         setNudged((prev) => ({ ...prev, [loan.id]: channels.length ? `Sent (${channels.join(' + ')})` : 'No channel' }));
         if (!channels.length) {
            setError(`No reminder sent for ${loan.tracking_id}: borrower has no email or Telegram on file.`);
         }
      } catch (err) {
         setError(err instanceof Error ? err.message : 'Could not send the reminder.');
      } finally {
         setNudging(null);
      }
   }, []);

   const activeBucket = BUCKETS.find((b) => b.id === bucket) ?? BUCKETS[2];

   const counts = useMemo(() => {
      const map = {} as Record<BucketId, number>;
      for (const b of BUCKETS) map[b.id] = loans.filter((l) => b.test(l.days_until_due)).length;
      return map;
   }, [loans]);

   const shown = useMemo(() => {
      const q = search.trim().toLowerCase();
      return loans
         .filter((l) => activeBucket.test(l.days_until_due))
         .filter((l) => {
            if (!q) return true;
            const fields = [l.tracking_id, l.borrower?.username, l.lender?.username, l.reason];
            return fields.some((f) => (f ?? '').toLowerCase().includes(q));
         });
   }, [loans, activeBucket, search]);

   const totalOutstanding = useMemo(() => shown.reduce((sum, l) => sum + l.outstanding, 0), [shown]);

   return (
      <div className="space-y-4">
         <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-3xl font-black">
               Coming due <span className="text-xl font-bold text-[#a89bb8]">({shown.length})</span>
            </h3>
            <div className="flex flex-wrap items-center gap-2">
               <button
                  type="button"
                  onClick={() => setHideTest((v) => !v)}
                  className={`rounded-full px-4 py-1.5 text-sm font-black ${hideTest ? 'bg-emerald-900/50 text-emerald-300' : 'bg-amber-900/50 text-amber-300'}`}
               >
                  {hideTest ? 'Test data hidden' : 'Showing test data'}
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

         <div className="flex flex-wrap items-center gap-2">
            {BUCKETS.map((b) => (
               <button
                  key={b.id}
                  type="button"
                  onClick={() => setBucket(b.id)}
                  className={`rounded-full px-4 py-1.5 text-sm font-black ${bucket === b.id ? 'bg-[#8336f0] text-white' : 'bg-[#241044] text-[#a89bb8]'}`}
               >
                  {b.label} <span className="opacity-70">({counts[b.id] ?? 0})</span>
               </button>
            ))}
         </div>

         <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by tracking ID, borrower, lender, or reason"
            className="w-full rounded-xl border border-[#3d1f6e] bg-[#241044] px-4 py-3 text-base font-bold text-white placeholder:text-[#6f6385]"
         />

         <div className="rounded-2xl border border-[#2a1453] bg-[#1c0a3a] px-5 py-3 text-sm font-bold text-[#a89bb8]">
            {shown.length} loan{shown.length === 1 ? '' : 's'} in view · {money(totalOutstanding)} outstanding
         </div>

         {error ? <div className="rounded-2xl border border-red-900 bg-red-950/40 p-4 text-lg font-bold text-red-300">{error}</div> : null}

         {shown.length ? (
            <div className="overflow-x-auto rounded-2xl border border-[#2a1453]">
               <table className="w-full min-w-[960px] border-collapse text-left">
                  <thead>
                     <tr className="bg-[#1c0a3a] text-xs font-black uppercase tracking-wide text-[#a89bb8]">
                        <th className="px-4 py-3">Countdown</th>
                        <th className="px-4 py-3">Due</th>
                        <th className="px-4 py-3">Tracking</th>
                        <th className="px-4 py-3">Borrower</th>
                        <th className="px-4 py-3">Contact</th>
                        <th className="px-4 py-3 text-right">Outstanding</th>
                        <th className="px-4 py-3">Lender</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                     </tr>
                  </thead>
                  <tbody>
                     {shown.map((l) => (
                        <tr key={l.id} className="border-t border-[#241044] bg-[#150730] align-top">
                           <td className="px-4 py-3">
                              <span
                                 className={`inline-flex rounded-full px-3 py-1 text-xs font-black uppercase ${countdownClass(l.days_until_due)}`}
                              >
                                 {countdownLabel(l.days_until_due)}
                              </span>
                           </td>
                           <td className="px-4 py-3 text-sm font-medium text-[#a89bb8]">{shortDate(l.due_date)}</td>
                           <td className="px-4 py-3 font-mono text-sm font-bold text-[#cfc6dd]">{l.tracking_id}</td>
                           <td className="px-4 py-3 text-sm font-bold text-white">{l.borrower?.username ?? '—'}</td>
                           <td className="px-4 py-3 text-xs font-medium text-[#a89bb8]">
                              <div className="space-y-0.5">
                                 <div>{l.borrower?.email ?? '—'}</div>
                                 {l.borrower?.telegram_username ? <div>@{l.borrower.telegram_username}</div> : null}
                              </div>
                           </td>
                           <td className="px-4 py-3 text-right text-sm font-black text-white">{money(l.outstanding)}</td>
                           <td className="px-4 py-3 text-sm font-bold text-white">{l.lender?.username ?? '—'}</td>
                           <td className="px-4 py-3">
                              <div className="flex flex-wrap justify-end gap-2">
                                 <button
                                    type="button"
                                    onClick={() => handleNudge(l)}
                                    disabled={nudging === l.id || !l.borrower?.id}
                                    className={`rounded-full px-3 py-1 text-xs font-black uppercase disabled:opacity-50 ${nudged[l.id] ? 'bg-emerald-900/50 text-emerald-300' : 'bg-[#241044] text-[#cfc6dd]'}`}
                                    title="Email + Telegram the borrower a repayment reminder"
                                 >
                                    {nudging === l.id ? '…' : nudged[l.id] ? nudged[l.id] : 'Nudge'}
                                 </button>
                                 {onExtend ? (
                                    <button
                                       type="button"
                                       onClick={() => onExtend(l.id)}
                                       className="rounded-full bg-[#8336f0] px-3 py-1 text-xs font-black uppercase text-white"
                                       title="Extend this loan's due date"
                                    >
                                       Extend
                                    </button>
                                 ) : null}
                              </div>
                           </td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>
         ) : (
            <div className="rounded-2xl border border-[#2a1453] bg-[#1c0a3a] p-5 text-xl font-black text-[#a89bb8]">
               {loading ? 'Loading loans…' : 'No loans in this window.'}
            </div>
         )}
      </div>
   );
}
