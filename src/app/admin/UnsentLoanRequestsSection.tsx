'use client';

import { useCallback, useEffect, useState } from 'react';

import { type AdminLoanRequestDraft, listUnsentLoanRequestDrafts } from '@/app/admin/adminSupabase';
import { loanRequestStopStepLabel } from '@/lib/loanRequestDraftSync';

const bkk = (iso: string) =>
   new Date(iso).toLocaleString('en-US', { timeZone: 'Asia/Bangkok', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

// The due date as typed (yyyy-mm-dd); shown as a plain date, never shifted by time zone.
const dueLabel = (value: string | null) => {
   if (!value) return '—';
   const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
   if (!m) return value;
   return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).toLocaleDateString('en-US', {
      timeZone: 'UTC',
      month: 'short',
      day: 'numeric'
   });
};

const money = (n: number | null) => (n === null || n === undefined ? '—' : `$${Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 })}`);

const personLabel = (p: AdminLoanRequestDraft['user']) =>
   p ? p.display_name?.trim() || (p.username ? `@${p.username}` : 'Unknown') : 'Deleted account';

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String((err as { message?: string })?.message ?? err));

/**
 * Loan requests a borrower started on the request board but never sent, from the last 14 days:
 * amount, repayment, due date, reason, the screen they stopped on and when (Bangkok time). Written
 * by the board a few seconds after each change; a sent loan drops off by itself.
 */
export default function UnsentLoanRequestsSection() {
   const [drafts, setDrafts] = useState<AdminLoanRequestDraft[]>([]);
   const [loading, setLoading] = useState(true);
   const [error, setError] = useState<string | null>(null);

   const load = useCallback(async () => {
      setLoading(true);
      try {
         setDrafts(await listUnsentLoanRequestDrafts());
         setError(null);
      } catch (err) {
         setError(errorMessage(err));
      } finally {
         setLoading(false);
      }
   }, []);

   useEffect(() => {
      void load();
   }, [load]);

   return (
      <section className="mt-10 space-y-4">
         <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
               <h2 className="break-words text-2xl font-black sm:text-3xl">
                  Started, not sent <span className="text-base font-bold text-[#a89bb8]">({drafts.length})</span>
               </h2>
               <p className="mt-1.5 max-w-3xl text-base text-[#a89bb8]">
                  Requests borrowers began in the last 14 days but haven&apos;t sent: what they typed and the screen they stopped on. Times
                  are Bangkok. A request that gets sent drops off by itself.
               </p>
            </div>
            <button
               type="button"
               onClick={() => void load()}
               className="rounded-full bg-[#241044] px-4 py-1.5 text-sm font-black text-[#a89bb8]"
            >
               {loading ? 'Loading…' : 'Refresh'}
            </button>
         </div>
         {error ? <p className="text-sm font-bold text-red-300">{error}</p> : null}
         {!drafts.length && !loading && !error ? <p className="text-base font-bold text-[#6f6385]">Nobody has a request waiting.</p> : null}
         <ul className="grid gap-3 lg:grid-cols-2">
            {drafts.map((d) => (
               <li key={d.user_id} className="rounded-2xl border border-[#2a1453] bg-[#1c0a3a] p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                     <p className="text-lg font-black text-white">
                        {personLabel(d.user)}
                        {d.user?.username && d.user.display_name ? (
                           <span className="ml-2 text-sm font-bold text-[#a89bb8]">@{d.user.username}</span>
                        ) : null}
                     </p>
                     <span className="rounded-full bg-amber-500 px-2.5 py-0.5 text-xs font-black text-black">
                        Stopped at: {loanRequestStopStepLabel(d.stopped_at)}
                     </span>
                  </div>
                  <p className="mt-2 text-base font-bold text-[#e8e0f2]">
                     {money(d.amount)} → repay {money(d.repay)} · due {dueLabel(d.due_date)}
                  </p>
                  {d.reason ? <p className="mt-1.5 whitespace-pre-line text-sm text-[#cfc6dd]">“{d.reason}”</p> : null}
                  <p className="mt-2 text-xs font-medium text-[#a89bb8]">
                     Last change {bkk(d.updated_at)} · started {bkk(d.started_at)}
                  </p>
               </li>
            ))}
         </ul>
      </section>
   );
}
