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
