'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useAdminLiveReload } from '@/app/admin/useAdminLive';

import { type AdminCallApprovalRow, type AdminCallDecision, decideAdminCall, getAdminCallApprovals } from '@/app/admin/adminSupabase';
import { type CallResult, callResult, completedAtMs, groupCallApprovals, isApprovalRequest, relativeStart } from '@/app/admin/callApprovalsModel';
import CallSheet from '@/app/admin/CallSheet';
import { type AdminIndoProfile, fetchIndonesiaProfiles, telegramUrl, whatsappChatUrl } from '@/app/admin/indonesiaAdmin';
import IndonesiaBadge from '@/components/IndonesiaBadge';

// Call approvals — approve a borrower the moment their video call ends, without waiting for the
// Telegram "Did they show up?" card. Same decisions as the card's buttons (admin-call-approvals
// runs the same code), so the borrower gets the usual message and Telegram stays in sync.

const REFRESH_MS = 30000;


const formatCallTime = (iso: string | null) =>
   iso ? new Date(iso).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : '';
// Completed calls go back further, so they also show the date.
const formatCallDate = (iso: string | null) =>
   iso ? new Date(iso).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '';

type ResultFilter = 'all' | CallResult;
// Upcoming, or one of the finished-call tabs ('all' = every finished call, not-marked ones included).
type CallsTab = 'upcoming' | ResultFilter;

const RESULT_LABEL: Record<CallResult, string> = {
   approved: '✅ Approved',
   no_show: '❌ No-show',
   rejected: '🚫 Rejected',
   unmarked: '❔ Not marked'
};
const RESULT_COLOR: Record<CallResult, string> = {
   approved: 'text-emerald-300',
   no_show: 'text-amber-300',
   rejected: 'text-red-300',
   unmarked: 'text-[#a89bb8]'
};
const RESULT_TABS: { id: ResultFilter; label: string }[] = [
   { id: 'approved', label: '✅ Approved' },
   { id: 'rejected', label: '🚫 Rejected' },
   { id: 'no_show', label: '❌ No-show' },
   { id: 'all', label: 'All finished' }
];

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
   // The call sheet open on top (profile + screening questions + notes for this borrower's call).
   const [sheetRow, setSheetRow] = useState<AdminCallApprovalRow | null>(null);
   // Indonesia-track people in this list (🇮🇩 + how to reach them), read from users.market.
   const [indo, setIndo] = useState<Map<string, AdminIndoProfile>>(() => new Map());
   // Search by name / username across every group.
   const [query, setQuery] = useState('');
   // Upcoming (needs a decision + booked calls, soonest first) or Completed (newest first).
   const [tab, setTab] = useState<CallsTab>('upcoming');
   const [newestFirst, setNewestFirst] = useState(true);

   // The people whose 🇮🇩 profiles are loaded; only re-read when the list of people changes.
   const indoIdsKey = useRef('');
   const load = useCallback(async (maxAgeMs?: number) => {
      try {
         const next = await getAdminCallApprovals({ maxAgeMs });
         setRows(next);
         setError(null);
         const ids = next.map((r) => r.userId);
         const key = [...ids].sort().join(',');
         if (key !== indoIdsKey.current) {
            indoIdsKey.current = key;
            void fetchIndonesiaProfiles(ids)
               .then(setIndo)
               .catch(() => {
                  indoIdsKey.current = '';
               });
         }
      } catch (err) {
         setError(err instanceof Error ? err.message : 'Could not load calls.');
      }
      setNow(Date.now());
   }, []);

   // Timer refresh (call times tick past, Zoom arrivals). Nothing while the tab is hidden; coming back
   // refreshes at once. A list another section loaded within the last ~25 s is reused, so the Calls
   // tab and the Requests card don't each call the server.
   useEffect(() => {
      void load();
      const tick = () => {
         if (document.visibilityState === 'visible') void load(REFRESH_MS - 5000);
      };
      const timer = window.setInterval(tick, REFRESH_MS);
      document.addEventListener('visibilitychange', tick);
      return () => {
         window.clearInterval(timer);
         document.removeEventListener('visibilitychange', tick);
      };
   }, [load]);
   useAdminLiveReload(['users', 'loan_access_requests'], () => load());

   const groups = useMemo(() => {
      const q = query.trim().toLowerCase();
      const list = q ? (rows ?? []).filter((r) => `${r.name} ${r.username ?? ''} ${r.facebookName ?? ''}`.toLowerCase().includes(q)) : (rows ?? []);
      return groupCallApprovals(list, now);
   }, [rows, now, query]);

   const completedShown = useMemo(() => {
      if (tab === 'upcoming') return [];
      const list = tab === 'all' ? groups.completed : groups.completed.filter((r) => callResult(r) === tab);
      return newestFirst ? list : [...list].sort((a, b) => completedAtMs(a) - completedAtMs(b));
   }, [groups.completed, tab, newestFirst]);
   const resultCounts = useMemo(() => {
      const counts: Record<ResultFilter, number> = { all: groups.completed.length, approved: 0, no_show: 0, rejected: 0, unmarked: 0 };
      for (const r of groups.completed) counts[callResult(r)] += 1;
      return counts;
   }, [groups.completed]);

   // Opened from the pre-call Telegram / Discord alert: /admin/calls?sheet=<userId> opens that borrower's
   // call sheet. A call outside this tab's window still opens, with what we know from the link.
   const sheetParamHandled = useRef(false);
   useEffect(() => {
      if (sheetParamHandled.current || !rows) return;
      const userId = new URLSearchParams(window.location.search).get('sheet');
      if (!userId) return;
      sheetParamHandled.current = true;
      setSheetRow(
         rows.find((r) => r.userId === userId) ?? {
            userId,
            name: 'Borrower',
            username: null,
            loanAccessStatus: null,
            callStartsAt: null,
            host: null,
            joinUrl: null,
            attendance: null,
            outcome: null,
            outcomeAt: null,
            request: null
         }
      );
   }, [rows]);

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
      if (row.outcome === 'attended' || row.loanAccessStatus === 'rejected') return null;
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
            {row.request ? (
               <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                     decide(
                        row,
                        { requestId: row.request!.id, decision: 'rejected' },
                        `Reject ${row.name}? Their call is cancelled and they're told they can't borrow.`
                     )
                  }
                  className={`${base} border border-red-800 text-red-300 hover:bg-red-950`}
               >
                  🚫 Reject
               </button>
            ) : null}
         </>
      );
   };

   const renderRow = (row: AdminCallApprovalRow) => (
      <li key={row.userId} className="rounded-2xl border border-[#2a1453] bg-[#1c0a3a] p-4">
         <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
               <p className="flex flex-wrap items-center gap-2 break-words text-lg font-black text-white">
                  {row.name}
                  {indo.has(row.userId) ? <IndonesiaBadge /> : null}
               </p>
               {row.username || row.facebookName ? (
                  <p className="break-words text-sm text-[#c9bde0]">
                     {[row.username ? `@${row.username}` : null, row.facebookName ? `FB: ${row.facebookName}` : null].filter(Boolean).join(' · ')}
                  </p>
               ) : null}
               {(() => {
                  const p = indo.get(row.userId);
                  if (!p) return null;
                  const wa = whatsappChatUrl(p.whatsappNumber);
                  const tg = telegramUrl(p.telegramUsername);
                  return (
                     <p className="mt-0.5 flex flex-wrap gap-x-3 text-sm font-bold">
                        {wa ? (
                           <a className="text-emerald-300 underline" href={wa} rel="noopener noreferrer" target="_blank">
                              Chat on WhatsApp
                           </a>
                        ) : null}
                        {tg ? (
                           <a className="text-sky-300 underline" href={tg} rel="noopener noreferrer" target="_blank">
                              @{p.telegramUsername?.replace(/^@/, '')}
                           </a>
                        ) : null}
                        <span className="text-[#a89bb8]">
                           KYC {p.kyc} · income doc {p.incomeDoc ?? 'none'}
                        </span>
                     </p>
                  );
               })()}
               {row.callStartsAt ? (
                  <p className="mt-0.5 text-sm font-bold text-[#c9a7ff]">
                     {tab !== 'upcoming' && variant === 'full'
                        ? formatCallDate(row.callStartsAt)
                        : `${formatCallTime(row.callStartsAt)} · ${relativeStart(row.callStartsAt, now)}`}
                     {row.host ? ` · with ${row.host}` : ''}
                  </p>
               ) : (
                  <p className="mt-0.5 text-sm font-bold text-[#c9a7ff]">Asked for access (no call)</p>
               )}
               {row.attendance ? <p className="mt-1 text-sm text-[#a89bb8]">{row.attendance}</p> : null}
               {row.request?.reason ? <p className="mt-1 break-words text-sm text-[#a89bb8]">“{row.request.reason}”</p> : null}
               {row.outcome || row.loanAccessStatus === 'rejected' ? (
                  <p className={`mt-1 text-sm font-black ${RESULT_COLOR[callResult(row)]}`}>
                     {RESULT_LABEL[callResult(row)]}
                     {row.outcomeAt ? ` · ${formatCallDate(row.outcomeAt)}` : ''}
                  </p>
               ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
               <button
                  type="button"
                  onClick={() => setSheetRow(row)}
                  className="rounded-xl border border-[#8336f0] px-4 py-2 text-sm font-black text-white hover:bg-[#2a1453]"
               >
                  📋 Call sheet
               </button>
               {row.joinUrl && !row.outcome && row.loanAccessStatus !== 'rejected' ? (
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

   const sheet = sheetRow ? <CallSheet onClose={() => setSheetRow(null)} row={sheetRow} /> : null;

   if (variant === 'waiting') {
      return (
         <section className="space-y-4">
            {sheet}
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
         {sheet}
         <div>
            <h2 className="break-words text-2xl font-black sm:text-3xl">Call approvals</h2>
            <p className="mt-1.5 max-w-3xl text-base text-[#a89bb8]">
               Approve borrowers as soon as their video call ends. Showed up lets them continue (ID check or loan application);
               No-show asks them to book again. Same as the Telegram buttons — whichever you use, the other stays in sync.
            </p>
         </div>
         {banners}
         <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, username or Facebook name"
            className="w-full max-w-md rounded-xl border border-[#3d1f6e] bg-[#1c0a3a] px-4 py-2.5 text-base text-white placeholder:text-[#a89bb8]"
         />
         <div className="flex flex-wrap gap-2" role="tablist">
            {([{ id: 'upcoming', label: 'Upcoming' }, ...RESULT_TABS] as { id: CallsTab; label: string }[]).map(({ id, label }) => (
               <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => setTab(id)}
                  className={`rounded-xl px-5 py-2.5 text-base font-black ${tab === id ? 'bg-[#8336f0] text-white' : 'border border-[#3d1f6e] text-[#c9bde0] hover:bg-[#2a1453]'}`}
               >
                  {label}{' '}
                  {rows ? (
                     <span className="opacity-70">{id === 'upcoming' ? groups.needsDecision.length + groups.upcoming.length : resultCounts[id]}</span>
                  ) : null}
               </button>
            ))}
         </div>
         {rows && tab === 'upcoming' ? (
            <>
               {renderGroup('Needs a decision', groups.needsDecision, query ? 'No match.' : 'Nobody is waiting. 🎉')}
               {renderGroup('Coming up (soonest first)', groups.upcoming, query ? 'No match.' : 'No calls booked in the next 2 weeks.')}
            </>
         ) : null}
         {rows && tab !== 'upcoming' ? (
            <div className="space-y-4">
               <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-base text-[#a89bb8]">Last 30 days{tab === 'all' && resultCounts.unmarked ? ` · ${resultCounts.unmarked} never marked` : ''}</p>
                  <button
                     type="button"
                     onClick={() => setNewestFirst((v) => !v)}
                     className="rounded-full border border-[#8336f0] px-3.5 py-1.5 text-sm font-black text-white hover:bg-[#2a1453]"
                  >
                     {newestFirst ? '↓ Newest first' : '↑ Oldest first'}
                  </button>
               </div>
               {completedShown.length ? (
                  <ul className="space-y-3">{completedShown.map(renderRow)}</ul>
               ) : (
                  <p className="text-base text-[#a89bb8]">{query ? 'No match.' : 'None in the last 30 days.'}</p>
               )}
            </div>
         ) : null}
      </section>
   );
}
