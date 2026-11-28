import type { AdminCallApprovalRow } from '@/app/admin/adminSupabase';

// Sorting for the Call approvals tab: who needs a decision now, whose call is still ahead, and
// which calls are done (approved, no-show, rejected). Kept pure so it's unit-testable.

// A call counts as "now" from this long before its start — the host may open the panel early.
export const NOW_WINDOW_MIN = 10;

// Undecided calls older than this stop asking for a decision and move to Completed as "not marked" —
// unless their call request is still pending, which keeps them waiting until someone decides.
export const DECIDE_WINDOW_H = 48;

export type CallResult = 'approved' | 'no_show' | 'rejected' | 'unmarked';

export interface CallApprovalGroups {
   needsDecision: AdminCallApprovalRow[];
   upcoming: AdminCallApprovalRow[];
   // Completed calls, newest first (by decision time, else call time).
   completed: AdminCallApprovalRow[];
}

const startMs = (row: AdminCallApprovalRow) => (row.callStartsAt ? Date.parse(row.callStartsAt) : NaN);

// A no-call approval request (loan flow 'approval'): decided with Approve / Reject.
export const isApprovalRequest = (row: AdminCallApprovalRow) => row.request !== null && row.request.kind !== 'call';

// How a completed call ended.
export const callResult = (row: AdminCallApprovalRow): CallResult => {
   if (row.loanAccessStatus === 'rejected') return 'rejected';
   if (row.outcome === 'attended') return 'approved';
   if (row.outcome === 'no_show') return 'no_show';
   return 'unmarked';
};

// When it was completed: the decision time, else the call time.
export const completedAtMs = (row: AdminCallApprovalRow) => {
   const decided = row.outcomeAt ? Date.parse(row.outcomeAt) : NaN;
   return Number.isNaN(decided) ? startMs(row) || 0 : decided;
};

export const groupCallApprovals = (rows: AdminCallApprovalRow[], now: number): CallApprovalGroups => {
   const needsDecision: AdminCallApprovalRow[] = [];
   const upcoming: AdminCallApprovalRow[] = [];
   const completed: AdminCallApprovalRow[] = [];
   for (const row of rows) {
      if (isApprovalRequest(row)) {
         needsDecision.push(row);
         continue;
      }
      const start = startMs(row);
      if (Number.isNaN(start)) continue;
      if (row.outcome || row.loanAccessStatus === 'rejected') completed.push(row);
      else if (start > now + NOW_WINDOW_MIN * 60000) upcoming.push(row);
      else if (start >= now - DECIDE_WINDOW_H * 3600000 || row.request) needsDecision.push(row);
      else completed.push(row);
   }
   const byStart = (a: AdminCallApprovalRow, b: AdminCallApprovalRow) =>
      (startMs(a) || Date.parse(a.request?.createdAt ?? '') || 0) - (startMs(b) || Date.parse(b.request?.createdAt ?? '') || 0);
   needsDecision.sort(byStart);
   upcoming.sort(byStart);
   completed.sort((a, b) => completedAtMs(b) - completedAtMs(a));
   return { needsDecision, upcoming, completed };
};

// "in 12 min" / "started 5 min ago" / "2 h ago" — the call's start relative to now.
export const relativeStart = (iso: string | null, now: number): string => {
   if (!iso) return '';
   const diffMin = Math.round((Date.parse(iso) - now) / 60000);
   const span = (min: number) => (min < 60 ? `${min} min` : `${Math.round(min / 60)} h`);
   if (diffMin > 0) return `in ${span(diffMin)}`;
   if (diffMin === 0) return 'starting now';
   return `started ${span(-diffMin)} ago`;
};

// ── The call line (Calls tab) ────────────────────────────────────────────────────────────────────
// The same groups, laid out like an assembly line: who is on a call right now, who is up next, who
// comes after. Calls move along it by themselves as time passes or a borrower changes their time.

// A started call counts as "on now" for this long: a 15-minute slot plus a little for a late start.
// After it the call is just waiting for its decision, so back-to-back calls don't pile up as "on now".
export const LIVE_WINDOW_MIN = 20;

// On a call right now: undecided, started, and not longer than LIVE_WINDOW_MIN ago.
export const isLiveNow = (row: AdminCallApprovalRow, now: number): boolean => {
   if (isApprovalRequest(row) || row.outcome || row.loanAccessStatus === 'rejected') return false;
   const start = startMs(row);
   return !Number.isNaN(start) && start <= now && start > now - LIVE_WINDOW_MIN * 60000;
};

export interface CallLine {
   // On a call now, soonest first.
   onNow: AdminCallApprovalRow[];
   // Earlier calls (and no-call requests) still waiting on a decision, oldest first.
   waiting: AdminCallApprovalRow[];
   // The next call to start, if any.
   upNext: AdminCallApprovalRow | null;
   // Every call after that one, soonest first.
   later: AdminCallApprovalRow[];
}

export const buildCallLine = (groups: CallApprovalGroups, now: number): CallLine => {
   // Calls about to start sit under "needs a decision" in the groups; on the line they are still ahead.
   const notStarted = (r: AdminCallApprovalRow) => !isApprovalRequest(r) && startMs(r) > now;
   const ahead = [...groups.needsDecision.filter(notStarted), ...groups.upcoming];
   return {
      onNow: groups.needsDecision.filter((r) => isLiveNow(r, now)),
      waiting: groups.needsDecision.filter((r) => !isLiveNow(r, now) && !notStarted(r)),
      upNext: ahead[0] ?? null,
      later: ahead.slice(1)
   };
};

// Where one call stands on a day's schedule.
export type ScheduleState = CallResult | 'now' | 'next' | 'waiting' | 'upcoming';

export interface ScheduleEntry {
   row: AdminCallApprovalRow;
   startMs: number;
   state: ScheduleState;
}

// Every call that starts in [dayStart, dayEnd), earliest first, with where it stands at `now`.
// Pass the whole list (not a searched one) so finished calls and the real "next" call are right.
export const buildDaySchedule = (rows: AdminCallApprovalRow[], now: number, dayStart: number, dayEnd: number): ScheduleEntry[] => {
   const nextId = buildCallLine(groupCallApprovals(rows, now), now).upNext?.userId ?? null;
   const entries: ScheduleEntry[] = [];
   for (const row of rows) {
      if (isApprovalRequest(row)) continue;
      const start = startMs(row);
      if (Number.isNaN(start) || start < dayStart || start >= dayEnd) continue;
      let state: ScheduleState;
      if (row.outcome || row.loanAccessStatus === 'rejected') state = callResult(row);
      else if (isLiveNow(row, now)) state = 'now';
      else if (start > now) state = row.userId === nextId ? 'next' : 'upcoming';
      else state = start >= now - DECIDE_WINDOW_H * 3600000 || row.request ? 'waiting' : 'unmarked';
      entries.push({ row, startMs: start, state });
   }
   return entries.sort((a, b) => a.startMs - b.startMs);
};
