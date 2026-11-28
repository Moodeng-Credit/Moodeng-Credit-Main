'use client';

import { type RefObject, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAdminLiveReload } from '@/app/admin/useAdminLive';

import { type AdminCallApprovalRow, type AdminCallDecision, decideAdminCall, getAdminCallApprovals } from '@/app/admin/adminSupabase';
import {
   buildCallLine,
   buildDaySchedule,
   type CallResult,
   callResult,
   completedAtMs,
   groupCallApprovals,
   isApprovalRequest,
   isLiveNow,
   relativeStart,
   type ScheduleState
} from '@/app/admin/callApprovalsModel';
import CallBriefCard from '@/app/admin/CallBrief';
import { FaceStrip, FaceThumb, useCallFaces } from '@/app/admin/CallFaces';
import CallSheet from '@/app/admin/CallSheet';
import { type AdminIndoProfile, fetchIndonesiaProfiles, telegramUrl, whatsappChatUrl } from '@/app/admin/indonesiaAdmin';
import IndonesiaBadge from '@/components/IndonesiaBadge';

// Call approvals — approve a borrower the moment their video call ends, without waiting for the
// Telegram "Did they show up?" card. Same decisions as the card's buttons (admin-call-approvals
// runs the same code), so the borrower gets the usual message and Telegram stays in sync.

const REFRESH_MS = 30000;
// The clock on the page (countdowns, who is on now / up next) moves this often without asking the server.
const CLOCK_MS = 15000;
// "Time changed" stays on a card this long after a borrower moves their call.
const MOVED_NOTE_MS = 3 * 60000;
const DAY_MS = 24 * 3600000;
// The soft-teal look (preview). /admin/calls?look=teal turns it on for this computer (teal-light and
// teal-dark force a mode; plain teal follows the app's light/dark setting), ?look=off turns it off.
// Only the full Calls screen wears it: colors are CSS variables set by the .calls-teal wrapper
// (globals.css) and every class falls back to the purple admin look without it.
const LOOK_KEY = 'moodeng_admin_calls_look';
const LOOKS = ['teal', 'teal-light', 'teal-dark'];
const readLook = (): string => {
   try {
      const fromLink = new URLSearchParams(window.location.search).get('look');
      if (fromLink) {
         if (LOOKS.includes(fromLink)) window.localStorage.setItem(LOOK_KEY, fromLink);
         else window.localStorage.removeItem(LOOK_KEY);
      }
      const saved = window.localStorage.getItem(LOOK_KEY) ?? '';
      return LOOKS.includes(saved) ? saved : '';
   } catch {
      return '';
   }
};
const lookClass = (look: string): string => {
   if (!look) return '';
   const light = look === 'teal-light' || (look === 'teal' && !document.documentElement.classList.contains('dark'));
   return `calls-teal ${light ? 'calls-teal-light' : ''} rounded-[28px] p-4 sm:p-6`;
};

// "My calls": show one host's calls only. Remembered on this computer.
const HOST_KEY = 'moodeng_admin_calls_host';
const readSavedHost = () => {
   try {
      return window.localStorage.getItem(HOST_KEY) ?? '';
   } catch {
      return '';
   }
};

const formatClock = (ms: number) => new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
// The row name is "Name · @username · email"; the card shows just the name, the rest sits underneath.
const shortName = (name: string) => name.split(' · ')[0] || name;
const localDayStart = (ms: number, offsetDays = 0) => {
   const d = new Date(ms);
   d.setHours(0, 0, 0, 0);
   d.setDate(d.getDate() + offsetDays);
   return d.getTime();
};
const dayLabel = (dayStart: number, now: number) => {
   const diff = Math.round((dayStart - localDayStart(now)) / DAY_MS);
   if (diff === 0) return 'Today';
   if (diff === 1) return 'Tomorrow';
   if (diff === -1) return 'Yesterday';
   return new Date(dayStart).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
};

const SCHEDULE_MARK: Record<ScheduleState, { icon: string; label: string; color: string }> = {
   approved: { icon: '✅', label: 'Approved', color: 'text-[color:var(--ct-good,#6ee7b7)]' },
   no_show: { icon: '❌', label: 'No-show', color: 'text-[color:var(--ct-warn,#fcd34d)]' },
   rejected: { icon: '🚫', label: 'Rejected', color: 'text-[color:var(--ct-bad,#fca5a5)]' },
   unmarked: { icon: '❔', label: 'Not marked', color: 'text-[color:var(--ct-dim,#a89bb8)]' },
   now: { icon: '🟢', label: 'On now', color: 'text-[color:var(--ct-good,#6ee7b7)]' },
   next: { icon: '⏭', label: 'Up next', color: 'text-[color:var(--ct-gold-text,#ffd166)]' },
   waiting: { icon: '⏳', label: 'Decide', color: 'text-[color:var(--ct-warn,#fcd34d)]' },
   upcoming: { icon: '', label: '', color: 'text-[color:var(--ct-dim,#a89bb8)]' }
};

// Cards slide to their new place when the order changes (a call starts, ends or is moved), so the eye
// can follow who went where. Every [data-flip] element under the root is tracked by its id.
function useSlideOnReorder(root: RefObject<HTMLElement | null>) {
   const tops = useRef(new Map<string, number>());
   useLayoutEffect(() => {
      const el = root.current;
      if (!el) return;
      const still = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const rootTop = el.getBoundingClientRect().top;
      const next = new Map<string, number>();
      el.querySelectorAll<HTMLElement>('[data-flip]').forEach((card) => {
         const id = card.dataset.flip ?? '';
         const top = card.getBoundingClientRect().top - rootTop;
         next.set(id, top);
         const before = tops.current.get(id);
         if (!still && before !== undefined && Math.abs(before - top) > 4 && typeof card.animate === 'function') {
            card.animate([{ transform: `translateY(${before - top}px)` }, { transform: 'translateY(0)' }], {
               duration: 450,
               easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)'
            });
         }
      });
      tops.current = next;
   });
}


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
   approved: 'text-[color:var(--ct-good,#6ee7b7)]',
   no_show: 'text-[color:var(--ct-warn,#fcd34d)]',
   rejected: 'text-[color:var(--ct-bad,#fca5a5)]',
   unmarked: 'text-[color:var(--ct-dim,#a89bb8)]'
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
   // The one card opened up to show everything + the decision buttons (the rest stay one line).
   const [openId, setOpenId] = useState<string | null>(null);
   // Which day the schedule on the right shows (0 = today).
   const [dayOffset, setDayOffset] = useState(0);
   const look = useMemo(() => (variant === 'full' ? lookClass(readLook()) : ''), [variant]);
   // '' = everyone's calls, else one host's (people asking for access without a call always show).
   const [hostFilter, setHostFilter] = useState(readSavedHost);
   const pickHost = (host: string) => {
      setHostFilter(host);
      try {
         window.localStorage.setItem(HOST_KEY, host);
      } catch {
         // Private mode: the choice just isn't remembered.
      }
   };
   // People whose call time just changed: the time it was, and when we noticed.
   const [moved, setMoved] = useState<Record<string, { from: string; at: number }>>({});
   const lastStarts = useRef<Map<string, string | null> | null>(null);
   const lineRef = useRef<HTMLDivElement>(null);
   useSlideOnReorder(lineRef);

   // The people whose 🇮🇩 profiles are loaded; only re-read when the list of people changes.
   const indoIdsKey = useRef('');
   const load = useCallback(async (maxAgeMs?: number) => {
      try {
         const next = await getAdminCallApprovals({ maxAgeMs });
         setRows(next);
         setError(null);
         const starts = new Map(next.map((r) => [r.userId, r.callStartsAt] as const));
         const before = lastStarts.current;
         if (before) {
            const changed: Record<string, { from: string; at: number }> = {};
            for (const [id, start] of starts) {
               const was = before.get(id);
               if (was && start && was !== start) changed[id] = { from: was, at: Date.now() };
            }
            if (Object.keys(changed).length) setMoved((m) => ({ ...m, ...changed }));
         }
         lastStarts.current = starts;
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
   useEffect(() => {
      const timer = window.setInterval(() => {
         if (document.visibilityState === 'visible') setNow(Date.now());
      }, CLOCK_MS);
      return () => window.clearInterval(timer);
   }, []);

   const hosts = useMemo(() => [...new Set((rows ?? []).map((r) => r.host).filter((h): h is string => Boolean(h)))].sort(), [rows]);
   // The short "waiting" card on Requests always shows everyone. A saved host nobody has calls with is ignored.
   const activeHost = variant === 'full' && hosts.includes(hostFilter) ? hostFilter : '';
   const hostRows = useMemo(() => (activeHost ? (rows ?? []).filter((r) => !r.host || r.host === activeHost) : (rows ?? [])), [rows, activeHost]);

   const groups = useMemo(() => {
      const q = query.trim().toLowerCase();
      const list = q ? hostRows.filter((r) => `${r.name} ${r.username ?? ''} ${r.facebookName ?? ''}`.toLowerCase().includes(q)) : hostRows;
      return groupCallApprovals(list, now);
   }, [hostRows, now, query]);

   const line = useMemo(() => buildCallLine(groups, now), [groups, now]);
   // Faces for everyone still ahead or waiting (not the 30 days of finished calls). Full screen only.
   const faceIds = useMemo(
      () => (variant === 'full' ? [...groups.needsDecision, ...groups.upcoming].map((r) => r.userId) : []),
      [groups.needsDecision, groups.upcoming, variant]
   );
   const faces = useCallFaces(faceIds);
   // The schedule ignores the search box: it is the whole day, finished calls included.
   const dayStart = localDayStart(now, dayOffset);
   const schedule = useMemo(() => buildDaySchedule(hostRows, now, dayStart, localDayStart(now, dayOffset + 1)), [hostRows, now, dayStart, dayOffset]);

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
                  className={`${base} border border-[color:var(--ct-line2,#3d1f6e)] text-[color:var(--ct-ink,#fff)] hover:bg-[var(--ct-soft,#2a1453)]`}
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
               className={`${base} border border-emerald-700 text-[color:var(--ct-good,#6ee7b7)] hover:bg-emerald-950`}
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
               className={`${base} border border-[color:var(--ct-line2,#3d1f6e)] text-[color:var(--ct-ink,#fff)] hover:bg-[var(--ct-soft,#2a1453)]`}
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
                  className={`${base} border border-red-800 text-[color:var(--ct-bad,#fca5a5)] hover:bg-red-950`}
               >
                  🚫 Reject
               </button>
            ) : null}
         </>
      );
   };

   const callTimeLine = (row: AdminCallApprovalRow, withDate: boolean) =>
      row.callStartsAt ? (
         <p className="mt-0.5 text-sm font-bold text-[color:var(--ct-soft-ink,#c9a7ff)]">
            {withDate ? formatCallDate(row.callStartsAt) : `${formatCallTime(row.callStartsAt)} · ${relativeStart(row.callStartsAt, now)}`}
            {row.host ? ` · with ${row.host}` : ''}
         </p>
      ) : (
         <p className="mt-0.5 text-sm font-bold text-[color:var(--ct-soft-ink,#c9a7ff)]">Asked for access (no call)</p>
      );

   const movedNote = (row: AdminCallApprovalRow) => {
      const m = moved[row.userId];
      if (!m || now - m.at > MOVED_NOTE_MS) return null;
      return (
         <span className="rounded-full bg-amber-400/20 px-2.5 py-0.5 text-xs font-black text-[color:var(--ct-warn,#fde68a)]">
            🔄 Time changed · was {formatCallTime(m.from)}
         </span>
      );
   };

   // Everything we know for the call, under the name: handles, how to reach them, Zoom, why they borrow, result.
   const renderDetails = (row: AdminCallApprovalRow) => {
      const p = indo.get(row.userId);
      const wa = p ? whatsappChatUrl(p.whatsappNumber) : null;
      const tg = p ? telegramUrl(p.telegramUsername) : null;
      const extra = row.name.split(' · ').slice(1).join(' · ');
      return (
         <>
            {extra || row.facebookName ? (
               <p className="break-words text-sm text-[color:var(--ct-soft-ink,#c9bde0)]">
                  {[extra || (row.username ? `@${row.username}` : null), row.facebookName ? `FB: ${row.facebookName}` : null].filter(Boolean).join(' · ')}
               </p>
            ) : null}
            {p ? (
               <p className="mt-0.5 flex flex-wrap gap-x-3 text-sm font-bold">
                  {wa ? (
                     <a className="text-[color:var(--ct-good,#6ee7b7)] underline" href={wa} rel="noopener noreferrer" target="_blank">
                        Chat on WhatsApp
                     </a>
                  ) : null}
                  {tg ? (
                     <a className="text-[color:var(--ct-link,#7dd3fc)] underline" href={tg} rel="noopener noreferrer" target="_blank">
                        @{p.telegramUsername?.replace(/^@/, '')}
                     </a>
                  ) : null}
                  <span className="text-[color:var(--ct-dim,#a89bb8)]">
                     KYC {p.kyc} · income doc {p.incomeDoc ?? 'none'}
                  </span>
               </p>
            ) : null}
            {row.attendance ? <p className="mt-1 text-sm text-[color:var(--ct-dim,#a89bb8)]">{row.attendance}</p> : null}
            {row.request?.reason ? <p className="mt-1 break-words text-sm text-[color:var(--ct-dim,#a89bb8)]">“{row.request.reason}”</p> : null}
            {row.outcome || row.loanAccessStatus === 'rejected' ? (
               <p className={`mt-1 text-sm font-black ${RESULT_COLOR[callResult(row)]}`}>
                  {RESULT_LABEL[callResult(row)]}
                  {row.outcomeAt ? ` · ${formatCallDate(row.outcomeAt)}` : ''}
               </p>
            ) : null}
         </>
      );
   };

   const nameLink = (row: AdminCallApprovalRow, className: string) => (
      <Link to={`/admin/user/${row.userId}`} title="Open everything about this person" className={`${className} hover:text-[color:var(--ct-soft-ink,#c9a7ff)]`}>
         {shortName(row.name)}
      </Link>
   );

   const prepButtons = (row: AdminCallApprovalRow, big: boolean) => (
      <>
         <button
            type="button"
            onClick={() => setSheetRow(row)}
            className={`rounded-xl font-black ${big ? 'bg-[var(--ct-pill,#8336f0)] px-5 py-3 text-base text-[color:var(--ct-pill-ink,#fff)] hover:bg-[var(--ct-pill-hover,#9450f5)]' : 'border border-[color:var(--ct-pill,#8336f0)] px-3.5 py-2 text-sm text-[color:var(--ct-ink,#fff)] hover:bg-[var(--ct-soft,#2a1453)]'}`}
         >
            📋 {big ? 'Get ready — call sheet' : 'Call sheet'}
         </button>
         {row.joinUrl && !row.outcome && row.loanAccessStatus !== 'rejected' ? (
            <a
               href={row.joinUrl}
               target="_blank"
               rel="noreferrer"
               className={`rounded-xl border border-[color:var(--ct-line2,#3d1f6e)] font-black text-[color:var(--ct-ink,#fff)] no-underline hover:bg-[var(--ct-soft,#2a1453)] ${big ? 'px-5 py-3 text-base' : 'px-3.5 py-2 text-sm'}`}
            >
               🎥 Join call
            </a>
         ) : null}
      </>
   );

   // The big card at the top: the call that is on now, or the next one.
   const renderHero = (row: AdminCallApprovalRow, kind: 'now' | 'next') => {
      const open = kind === 'now' || openId === row.userId;
      return (
         <div
            key={row.userId}
            id={`call-${row.userId}`}
            data-flip={row.userId}
            className={`rounded-3xl border-2 p-5 sm:p-6 ${kind === 'now' ? 'border-emerald-500 bg-emerald-950/30' : 'border-[color:var(--ct-pill,#8336f0)] bg-[var(--ct-card,#1c0a3a)]'}`}
         >
            <div className="flex flex-wrap items-center gap-2">
               <span
                  className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide ${kind === 'now' ? 'bg-emerald-500 text-[#06281a]' : 'bg-[#ffd166] text-[color:var(--ct-gold-ink,#2a1453)]'}`}
               >
                  {kind === 'now' ? '🟢 On now' : '⏭ Up next'}
               </span>
               <span className="text-lg font-black text-[color:var(--ct-ink,#fff)]">{relativeStart(row.callStartsAt, now)}</span>
               <span className="text-base font-bold text-[color:var(--ct-soft-ink,#c9a7ff)]">
                  {formatCallTime(row.callStartsAt)}
                  {row.host ? ` · with ${row.host}` : ''}
               </span>
               {movedNote(row)}
            </div>
            <div className="mt-3 flex items-start gap-4">
               <FaceThumb face={faces[row.userId]} name={shortName(row.name)} size="lg" />
               <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 break-words text-3xl font-black text-[color:var(--ct-ink,#fff)]">
                     {nameLink(row, 'text-[color:var(--ct-ink,#fff)] no-underline')}
                     {indo.has(row.userId) ? <IndonesiaBadge /> : null}
                  </p>
                  <div className="mt-1">{renderDetails(row)}</div>
               </div>
            </div>
            <div className="mt-3">
               <FaceStrip face={faces[row.userId]} />
            </div>
            <div className="mt-3">
               <CallBriefCard userId={row.userId} />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
               {prepButtons(row, true)}
               {kind === 'next' ? (
                  <button
                     type="button"
                     onClick={() => setOpenId(open ? null : row.userId)}
                     className="rounded-xl px-3 py-3 text-sm font-black text-[color:var(--ct-soft-ink,#c9a7ff)] hover:text-[color:var(--ct-ink,#fff)]"
                  >
                     {open ? 'Hide decision ▴' : 'Decide now ▾'}
                  </button>
               ) : null}
            </div>
            {open ? <div className="mt-3 flex flex-wrap gap-2 border-t border-[color:var(--ct-line,#2a1453)] pt-3">{renderActions(row)}</div> : null}
         </div>
      );
   };

   // One person on the list. 'open' shows everything with the decision buttons (people waiting on a
   // decision); 'line' is a single line that opens on a tap.
   const renderRow = (row: AdminCallApprovalRow, mode: 'open' | 'line' = 'open') => {
      const open = mode === 'open' || openId === row.userId;
      const finished = tab !== 'upcoming' && variant === 'full';
      const live = isLiveNow(row, now);
      return (
         <li
            key={row.userId}
            id={`call-${row.userId}`}
            data-flip={row.userId}
            className={`rounded-2xl border bg-[var(--ct-card,#1c0a3a)] ${open ? 'p-4' : 'px-4 py-2.5'} ${live ? 'border-emerald-600' : 'border-[color:var(--ct-line,#2a1453)]'}`}
         >
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
               <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
                  {mode === 'line' && row.callStartsAt ? (
                     <span className="w-[5.5rem] shrink-0 text-base font-black tabular-nums text-[color:var(--ct-ink,#fff)]">
                        {finished
                           ? new Date(row.callStartsAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
                           : formatClock(Date.parse(row.callStartsAt))}
                     </span>
                  ) : null}
                  <span className="flex min-w-0 flex-wrap items-center gap-2 break-words text-lg font-black text-[color:var(--ct-ink,#fff)]">
                     {variant === 'full' && tab === 'upcoming' ? <FaceThumb face={faces[row.userId]} name={shortName(row.name)} /> : null}
                     {nameLink(row, 'text-[color:var(--ct-ink,#fff)] underline decoration-[color:var(--ct-pill,#8336f0)] decoration-2 underline-offset-4')}
                     {indo.has(row.userId) ? <IndonesiaBadge /> : null}
                  </span>
                  {mode === 'line' ? (
                     <span className="text-sm font-bold text-[color:var(--ct-dim,#a89bb8)]">
                        {finished ? (
                           <span className={RESULT_COLOR[callResult(row)]}>{RESULT_LABEL[callResult(row)]}</span>
                        ) : (
                           relativeStart(row.callStartsAt, now)
                        )}
                        {row.host ? ` · ${row.host}` : ''}
                     </span>
                  ) : null}
                  {movedNote(row)}
               </div>
               <div className="flex flex-wrap items-center gap-2">
                  {prepButtons(row, false)}
                  {mode === 'line' ? (
                     <button
                        type="button"
                        aria-expanded={open}
                        aria-label={open ? 'Show less' : 'Show more'}
                        onClick={() => setOpenId(open ? null : row.userId)}
                        className="rounded-xl border border-[color:var(--ct-line2,#3d1f6e)] px-3 py-2 text-sm font-black text-[color:var(--ct-soft-ink,#c9bde0)] hover:bg-[var(--ct-soft,#2a1453)]"
                     >
                        {open ? '▴' : '▾'}
                     </button>
                  ) : null}
               </div>
            </div>
            {open ? (
               <div className="mt-2">
                  {callTimeLine(row, finished)}
                  {renderDetails(row)}
                  {(() => {
                     const actions = renderActions(row);
                     return actions ? <div className="mt-3 flex flex-wrap gap-2">{actions}</div> : null;
                  })()}
               </div>
            ) : null}
         </li>
      );
   };

   const heading = (title: string, count: number) => (
      <h3 className="text-sm font-black uppercase tracking-wide text-[color:var(--ct-dim,#a89bb8)]">
         {title} <span className="text-[color:var(--ct-faint,#6f6385)]">{count}</span>
      </h3>
   );

   // The calls after the next one, a heading per day.
   const laterByDay = (() => {
      const days: { start: number; list: AdminCallApprovalRow[] }[] = [];
      for (const row of line.later) {
         const start = localDayStart(Date.parse(row.callStartsAt ?? ''));
         const last = days[days.length - 1];
         if (last && last.start === start) last.list.push(row);
         else days.push({ start, list: [row] });
      }
      return days;
   })();

   // Tap a name on the schedule: jump to their card on the line, or open the call sheet if they're not on it.
   const jumpTo = (row: AdminCallApprovalRow) => {
      const card = tab === 'upcoming' ? document.getElementById(`call-${row.userId}`) : null;
      if (!card) {
         setSheetRow(row);
         return;
      }
      setOpenId(row.userId);
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
   };

   const scheduleCard = (
      <aside className="rounded-2xl border border-[color:var(--ct-line,#2a1453)] bg-[var(--ct-card,#1c0a3a)] p-4 xl:sticky xl:top-4">
         <div className="flex items-center justify-between gap-2">
            <button
               type="button"
               aria-label="Day before"
               disabled={dayOffset <= -7}
               onClick={() => setDayOffset((d) => d - 1)}
               className="rounded-lg border border-[color:var(--ct-line2,#3d1f6e)] px-2.5 py-1 text-sm font-black text-[color:var(--ct-ink,#fff)] hover:bg-[var(--ct-soft,#2a1453)] disabled:opacity-40"
            >
               ‹
            </button>
            <div className="text-center">
               <p className="text-base font-black text-[color:var(--ct-ink,#fff)]">{dayLabel(dayStart, now)}</p>
               <p className="text-xs text-[color:var(--ct-dim,#a89bb8)]">
                  {new Date(dayStart).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
                  {dayOffset !== 0 ? (
                     <button type="button" onClick={() => setDayOffset(0)} className="ml-2 font-black text-[color:var(--ct-soft-ink,#c9a7ff)] hover:text-[color:var(--ct-ink,#fff)]">
                        Back to today
                     </button>
                  ) : null}
               </p>
            </div>
            <button
               type="button"
               aria-label="Day after"
               disabled={dayOffset >= 13}
               onClick={() => setDayOffset((d) => d + 1)}
               className="rounded-lg border border-[color:var(--ct-line2,#3d1f6e)] px-2.5 py-1 text-sm font-black text-[color:var(--ct-ink,#fff)] hover:bg-[var(--ct-soft,#2a1453)] disabled:opacity-40"
            >
               ›
            </button>
         </div>
         {schedule.length ? (
            <>
               <p className="mt-2 text-center text-xs font-bold text-[color:var(--ct-dim,#a89bb8)]">
                  {schedule.length} {schedule.length === 1 ? 'call' : 'calls'} ·{' '}
                  {schedule.filter((e) => e.state === 'now' || e.state === 'next' || e.state === 'upcoming').length} to go
               </p>
               <ol className="mt-3 max-h-64 space-y-1 overflow-y-auto xl:max-h-[calc(100vh-11rem)]">
                  {schedule.map((entry, i) => {
                     const mark = SCHEDULE_MARK[entry.state];
                     const nowLine = dayOffset === 0 && entry.startMs > now && (i === 0 || schedule[i - 1].startMs <= now);
                     const done = entry.state === 'approved' || entry.state === 'no_show' || entry.state === 'rejected' || entry.state === 'unmarked';
                     return (
                        <li key={entry.row.userId}>
                           {nowLine ? (
                              <div className="my-1.5 flex items-center gap-2 text-[11px] font-black uppercase text-[color:var(--ct-gold-text,#ffd166)]">
                                 <span className="h-px flex-1 bg-[#ffd166]/60" />
                                 Now {formatClock(now)}
                                 <span className="h-px flex-1 bg-[#ffd166]/60" />
                              </div>
                           ) : null}
                           <button
                              type="button"
                              onClick={() => jumpTo(entry.row)}
                              className={`flex w-full items-baseline gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-[var(--ct-soft,#2a1453)] ${entry.state === 'now' ? 'bg-emerald-950/50' : entry.state === 'next' ? 'bg-[var(--ct-soft,#2a1453)]' : ''}`}
                           >
                              <span className={`w-[4.75rem] shrink-0 whitespace-nowrap text-sm font-black tabular-nums ${done ? 'text-[color:var(--ct-faint,#6f6385)]' : 'text-[color:var(--ct-ink,#fff)]'}`}>
                                 {formatClock(entry.startMs)}
                              </span>
                              <span className="min-w-0 flex-1">
                                 <span className={`block truncate text-sm font-bold ${done ? 'text-[color:var(--ct-dim,#a89bb8)]' : 'text-[color:var(--ct-ink,#fff)]'}`}>{shortName(entry.row.name)}</span>
                                 <span className={`block text-xs font-bold ${mark.color}`}>
                                    {[mark.icon && `${mark.icon} ${mark.label}`, entry.row.host].filter(Boolean).join(' · ')}
                                 </span>
                              </span>
                           </button>
                        </li>
                     );
                  })}
               </ol>
            </>
         ) : (
            <p className="mt-4 text-center text-sm text-[color:var(--ct-dim,#a89bb8)]">{rows ? 'No calls this day.' : 'Loading…'}</p>
         )}
      </aside>
   );

   const banners = (
      <>
         {notice ? (
            <p
               className={`rounded-2xl border p-4 text-base font-bold ${notice.ok ? 'border-emerald-900 bg-emerald-950/60 text-[color:var(--ct-good,#6ee7b7)]' : 'border-amber-900 bg-amber-950/60 text-[color:var(--ct-warn,#fcd34d)]'}`}
            >
               {notice.text}
            </p>
         ) : null}
         {error ? <p className="rounded-2xl border border-red-900 bg-red-950/60 p-4 text-base font-bold text-[color:var(--ct-bad,#fca5a5)]">{error}</p> : null}
         {!rows && !error ? <p className="text-lg text-[color:var(--ct-dim,#a89bb8)]">Loading calls…</p> : null}
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
                     Waiting for approval {rows ? <span className="text-[color:var(--ct-dim,#a89bb8)]">{groups.needsDecision.length}</span> : null}
                  </h2>
                  <p className="mt-1.5 max-w-3xl text-base text-[color:var(--ct-dim,#a89bb8)]">
                     New borrowers who had their call (or asked for access) and need your ✅ before they can apply.
                  </p>
               </div>
               {onOpenCalls ? (
                  <button type="button" onClick={onOpenCalls} className="text-sm font-black text-[color:var(--ct-soft-ink,#c9a7ff)] hover:text-[color:var(--ct-ink,#fff)]">
                     All calls →
                  </button>
               ) : null}
            </div>
            {banners}
            {rows ? (
               groups.needsDecision.length ? (
                  <ul className="space-y-3">{groups.needsDecision.map((r) => renderRow(r))}</ul>
               ) : (
                  <p className="text-base text-[color:var(--ct-dim,#a89bb8)]">Nobody is waiting. 🎉</p>
               )
            ) : null}
         </section>
      );
   }

   const noCalls = !line.onNow.length && !line.upNext;
   return (
      <section className={`space-y-5 ${look}`}>
         {sheet}
         <div>
            <h2 className="break-words text-2xl font-black sm:text-3xl">Calls</h2>
            <p className="mt-1 text-base text-[color:var(--ct-dim,#a89bb8)]">Who you meet next, and one tap to get ready. The list moves by itself.</p>
         </div>
         {banners}
         <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
            <div className="xl:col-start-2 xl:row-start-1">{scheduleCard}</div>
            <div ref={lineRef} className="min-w-0 space-y-5 xl:col-start-1 xl:row-start-1">
               <div className="flex flex-wrap items-center gap-2">
                  <div className="flex flex-wrap gap-1.5" role="tablist">
                     {([{ id: 'upcoming', label: 'Upcoming' }, ...RESULT_TABS] as { id: CallsTab; label: string }[]).map(({ id, label }) => (
                        <button
                           key={id}
                           type="button"
                           role="tab"
                           aria-selected={tab === id}
                           onClick={() => setTab(id)}
                           className={`rounded-full px-3.5 py-1.5 text-sm font-black ${tab === id ? 'bg-[var(--ct-pill,#8336f0)] text-[color:var(--ct-pill-ink,#fff)]' : 'border border-[color:var(--ct-line2,#3d1f6e)] text-[color:var(--ct-soft-ink,#c9bde0)] hover:bg-[var(--ct-soft,#2a1453)]'}`}
                        >
                           {label}{' '}
                           {rows ? (
                              <span className="opacity-70">
                                 {id === 'upcoming' ? groups.needsDecision.length + groups.upcoming.length : resultCounts[id]}
                              </span>
                           ) : null}
                        </button>
                     ))}
                  </div>
                  {hosts.length > 1 ? (
                     <div className="ml-auto flex overflow-hidden rounded-full border border-[color:var(--ct-line2,#3d1f6e)]" role="group" aria-label="Whose calls">
                        {['', ...hosts].map((host) => (
                           <button
                              key={host || 'all'}
                              type="button"
                              aria-pressed={activeHost === host}
                              onClick={() => pickHost(host)}
                              className={`px-3 py-1.5 text-sm font-black capitalize ${activeHost === host ? 'bg-[#ffd166] text-[color:var(--ct-gold-ink,#2a1453)]' : 'text-[color:var(--ct-soft-ink,#c9bde0)] hover:bg-[var(--ct-soft,#2a1453)]'}`}
                           >
                              {host || 'Everyone'}
                           </button>
                        ))}
                     </div>
                  ) : null}
                  <input
                     type="search"
                     value={query}
                     onChange={(e) => setQuery(e.target.value)}
                     placeholder="Search a name"
                     className={`${hosts.length > 1 ? '' : 'ml-auto '}w-full max-w-[14rem] rounded-full border border-[color:var(--ct-line2,#3d1f6e)] bg-[var(--ct-card,#1c0a3a)] px-4 py-1.5 text-sm text-[color:var(--ct-ink,#fff)] placeholder:text-[color:var(--ct-dim,#a89bb8)]`}
                  />
               </div>
               {rows && tab === 'upcoming' ? (
                  <>
                     {line.onNow.map((r) => renderHero(r, 'now'))}
                     {line.upNext ? renderHero(line.upNext, 'next') : null}
                     {noCalls && !line.waiting.length ? (
                        <p className="rounded-2xl border border-[color:var(--ct-line,#2a1453)] bg-[var(--ct-card,#1c0a3a)] p-5 text-base text-[color:var(--ct-dim,#a89bb8)]">
                           {query ? 'No match.' : 'No calls booked in the next 2 weeks. 🎉'}
                        </p>
                     ) : null}
                     {line.waiting.length ? (
                        <div>
                           {heading('⏳ Needs your decision', line.waiting.length)}
                           <ul className="mt-2 space-y-2">{line.waiting.map((r) => renderRow(r))}</ul>
                        </div>
                     ) : null}
                     {laterByDay.map((day) => (
                        <div key={day.start}>
                           {heading(`After that · ${dayLabel(day.start, now)}`, day.list.length)}
                           <ul className="mt-2 space-y-2">{day.list.map((r) => renderRow(r, 'line'))}</ul>
                        </div>
                     ))}
                  </>
               ) : null}
               {rows && tab !== 'upcoming' ? (
                  <div className="space-y-3">
                     <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm text-[color:var(--ct-dim,#a89bb8)]">
                           Last 30 days{tab === 'all' && resultCounts.unmarked ? ` · ${resultCounts.unmarked} never marked` : ''}
                        </p>
                        <button
                           type="button"
                           onClick={() => setNewestFirst((v) => !v)}
                           className="rounded-full border border-[color:var(--ct-pill,#8336f0)] px-3.5 py-1.5 text-sm font-black text-[color:var(--ct-ink,#fff)] hover:bg-[var(--ct-soft,#2a1453)]"
                        >
                           {newestFirst ? '↓ Newest first' : '↑ Oldest first'}
                        </button>
                     </div>
                     {completedShown.length ? (
                        <ul className="space-y-2">{completedShown.map((r) => renderRow(r, 'line'))}</ul>
                     ) : (
                        <p className="text-base text-[color:var(--ct-dim,#a89bb8)]">{query ? 'No match.' : 'None in the last 30 days.'}</p>
                     )}
                  </div>
               ) : null}
            </div>
         </div>
      </section>
   );
}
