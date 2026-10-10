'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { type AdminCallApprovalRow, type AdminCallDecision, decideAdminCall, getAdminCallApprovals } from '@/app/admin/adminSupabase';
import { groupCallApprovals, isApprovalRequest, relativeStart } from '@/app/admin/callApprovalsModel';

// Call approvals — approve a borrower the moment their video call ends, without waiting for the
// Telegram "Did they show up?" card. Same decisions as the card's buttons (admin-call-approvals
// runs the same code), so the borrower gets the usual message and Telegram stays in sync.

const REFRESH_MS = 30000;

const formatCallTime = (iso: string | null) =>
   iso ? new Date(iso).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : '';

interface CallApprovalsSectionProps {
   // How many people are waiting on a decision, for the tab badge.
   onCountChange?: (count: number) => void;
   // 'waiting' is the short version on Loans → Requests: only the people waiting on a decision.
   variant?: 'full' | 'waiting';
   // Shown as "All calls →" in the waiting variant.
   onOpenCalls?: () => void;
}

export default function CallApprovalsSection({ onCountChange, variant = 'full', onOpenCalls }: CallApprovalsSectionProps) {
   const [rows, setRows] = useState<AdminCallApprovalRow[] | null>(null);
   const [error, setError] = useState<string | null>(null);
   const [busyId, setBusyId] = useState<string | null>(null);
   const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
   const [now, setNow] = useState(() => Date.now());

   const load = useCallback(async () => {
      try {
         setRows(await getAdminCallApprovals());
         setError(null);
      } catch (err) {
         setError(err instanceof Error ? err.message : 'Could not load calls.');
      }
      setNow(Date.now());
   }, []);

   useEffect(() => {
      void load();
      const timer = window.setInterval(() => void load(), REFRESH_MS);
      return () => window.clearInterval(timer);
   }, [load]);

   const groups = useMemo(() => groupCallApprovals(rows ?? [], now), [rows, now]);

   useEffect(() => {
      if (rows) onCountChange?.(groups.needsDecision.length);
   }, [rows, groups.needsDecision.length, onCountChange]);

   const decide = async (row: AdminCallApprovalRow, input: AdminCallDecision, confirmText?: string) => {
      if (confirmText && !window.confirm(confirmText)) return;
      setBusyId(row.userId);
      setNotice(null);
      try {
         const result = await decideAdminCall(input);
         setNotice({ ok: result.ok, text: result.summary });
         await load();
      } catch (err) {
         setNotice({ ok: false, text: err instanceof Error ? err.message : 'Could not save the decision.' });
      } finally {
         setBusyId(null);
      }
   };

   const renderActions = (row: AdminCallApprovalRow) => {
      const busy = busyId === row.userId;
      const base = 'rounded-xl px-4 py-2 text-sm font-black disabled:opacity-50';
      if (isApprovalRequest(row) && row.request) {
         const requestId = row.request.id;
         return (
            <>
               <button
                  type="button"
                  disabled={busy}
                  onClick={() => decide(row, { requestId, decision: 'approved' })}
                  className={`${base} bg-emerald-600 text-white hover:bg-emerald-500`}
               >
                  ✅ Approve
               </button>
               <button
                  type="button"
                  disabled={busy}
                  onClick={() => decide(row, { requestId, decision: 'rejected' }, `Reject ${row.name}? They'll be told they can't borrow.`)}
                  className={`${base} border border-[#3d1f6e] text-white hover:bg-[#2a1453]`}
               >
                  Reject
               </button>
            </>
         );
      }
      if (row.outcome === 'attended') return null;
      if (row.outcome === 'no_show') {
         return (
            <button
               type="button"
               disabled={busy}
               onClick={() => decide(row, { userId: row.userId, decision: 'attended' })}
               className={`${base} border border-emerald-700 text-emerald-300 hover:bg-emerald-950`}
            >
               Actually showed up — approve
            </button>
         );
      }
      return (
         <>
            <button
               type="button"
               disabled={busy}
               onClick={() => decide(row, { userId: row.userId, decision: 'attended' })}
               className={`${base} bg-emerald-600 text-white hover:bg-emerald-500`}
            >
               ✅ Showed up — approve
            </button>
            <button
               type="button"
               disabled={busy}
               onClick={() => decide(row, { userId: row.userId, decision: 'no_show' }, `Mark ${row.name} a no-show? They'll be asked to book again.`)}
               className={`${base} border border-[#3d1f6e] text-white hover:bg-[#2a1453]`}
            >
               ❌ No-show
            </button>
         </>
      );
   };

   const renderRow = (row: AdminCallApprovalRow) => (
      <li key={row.userId} className="rounded-2xl border border-[#2a1453] bg-[#1c0a3a] p-4">
         <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
               <p className="break-words text-lg font-black text-white">{row.name}</p>
               {row.callStartsAt ? (
                  <p className="mt-0.5 text-sm font-bold text-[#c9a7ff]">
                     {formatCallTime(row.callStartsAt)} · {relativeStart(row.callStartsAt, now)}
                     {row.host ? ` · with ${row.host}` : ''}
                  </p>
               ) : (
                  <p className="mt-0.5 text-sm font-bold text-[#c9a7ff]">Asked for access (no call)</p>
               )}
               {row.attendance ? <p className="mt-1 text-sm text-[#a89bb8]">{row.attendance}</p> : null}
               {row.request?.reason ? <p className="mt-1 break-words text-sm text-[#a89bb8]">“{row.request.reason}”</p> : null}
               {row.outcome ? (
                  <p className={`mt-1 text-sm font-black ${row.outcome === 'attended' ? 'text-emerald-300' : 'text-amber-300'}`}>
                     {row.outcome === 'attended' ? 'Showed up' : 'No-show'}
                     {row.loanAccessStatus === 'approved' ? ' · approved' : ''}
                  </p>
               ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
               {row.joinUrl && !row.outcome ? (
                  <a
                     href={row.joinUrl}
                     target="_blank"
                     rel="noreferrer"
                     className="rounded-xl border border-[#3d1f6e] px-4 py-2 text-sm font-black text-white no-underline hover:bg-[#2a1453]"
                  >
                     Join call
                  </a>
               ) : null}
               {renderActions(row)}
            </div>
         </div>
      </li>
   );

   const renderGroup = (title: string, list: AdminCallApprovalRow[], empty: string) => (
      <div>
         <h3 className="text-xl font-black">
            {title} <span className="text-[#a89bb8]">{list.length}</span>
         </h3>
         {list.length ? (
            <ul className="mt-3 space-y-3">{list.map(renderRow)}</ul>
         ) : (
            <p className="mt-2 text-base text-[#a89bb8]">{empty}</p>
         )}
      </div>
   );

   const banners = (
      <>
         {notice ? (
            <p
               className={`rounded-2xl border p-4 text-base font-bold ${notice.ok ? 'border-emerald-900 bg-emerald-950/60 text-emerald-300' : 'border-amber-900 bg-amber-950/60 text-amber-300'}`}
            >
               {notice.text}
            </p>
         ) : null}
         {error ? <p className="rounded-2xl border border-red-900 bg-red-950/60 p-4 text-base font-bold text-red-300">{error}</p> : null}
         {!rows && !error ? <p className="text-lg text-[#a89bb8]">Loading calls…</p> : null}
      </>
   );

   if (variant === 'waiting') {
      return (
         <section className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
               <div>
                  <h2 className="break-words text-2xl font-black sm:text-3xl">
                     Waiting for approval {rows ? <span className="text-[#a89bb8]">{groups.needsDecision.length}</span> : null}
                  </h2>
                  <p className="mt-1.5 max-w-3xl text-base text-[#a89bb8]">
                     New borrowers who had their call (or asked for access) and need your ✅ before they can apply.
                  </p>
               </div>
               {onOpenCalls ? (
                  <button type="button" onClick={onOpenCalls} className="text-sm font-black text-[#c9a7ff] hover:text-white">
                     All calls →
                  </button>
               ) : null}
            </div>
            {banners}
            {rows ? (
               groups.needsDecision.length ? (
                  <ul className="space-y-3">{groups.needsDecision.map(renderRow)}</ul>
               ) : (
                  <p className="text-base text-[#a89bb8]">Nobody is waiting. 🎉</p>
               )
            ) : null}
         </section>
      );
   }

   return (
      <section className="space-y-6">
         <div>
            <h2 className="break-words text-2xl font-black sm:text-3xl">Call approvals</h2>
            <p className="mt-1.5 max-w-3xl text-base text-[#a89bb8]">
               Approve borrowers as soon as their video call ends. Showed up lets them continue (ID check or loan application);
               No-show asks them to book again. Same as the Telegram buttons — whichever you use, the other stays in sync.
            </p>
         </div>
         {banners}
         {rows ? (
            <>
               {renderGroup('Needs a decision', groups.needsDecision, 'Nobody is waiting. 🎉')}
               {renderGroup('Coming up', groups.upcoming, 'No calls booked in the next 24 hours.')}
               {renderGroup('Decided (last 2 days)', groups.decided, 'Nothing decided yet.')}
            </>
         ) : null}
      </section>
   );
}
