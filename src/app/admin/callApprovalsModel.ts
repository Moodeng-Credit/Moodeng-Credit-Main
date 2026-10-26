import type { AdminCallApprovalRow } from '@/app/admin/adminSupabase';

// Sorting for the Call approvals tab: who needs a decision now, whose call is still ahead, and
// what was decided recently. Kept pure so it's unit-testable.

// A call counts as "now" from this long before its start — the host may open the panel early.
export const NOW_WINDOW_MIN = 10;

export interface CallApprovalGroups {
   needsDecision: AdminCallApprovalRow[];
   upcoming: AdminCallApprovalRow[];
   decided: AdminCallApprovalRow[];
}

const startMs = (row: AdminCallApprovalRow) => (row.callStartsAt ? Date.parse(row.callStartsAt) : NaN);

// A no-call approval request (loan flow 'approval'): decided with Approve / Reject.
export const isApprovalRequest = (row: AdminCallApprovalRow) => row.request !== null && row.request.kind !== 'call';

export const groupCallApprovals = (rows: AdminCallApprovalRow[], now: number): CallApprovalGroups => {
   const needsDecision: AdminCallApprovalRow[] = [];
   const upcoming: AdminCallApprovalRow[] = [];
   const decided: AdminCallApprovalRow[] = [];
   for (const row of rows) {
      if (isApprovalRequest(row)) {
         needsDecision.push(row);
         continue;
      }
      const start = startMs(row);
      if (Number.isNaN(start) || row.loanAccessStatus === 'rejected') continue;
      if (row.outcome) decided.push(row);
      else if (start <= now + NOW_WINDOW_MIN * 60000) needsDecision.push(row);
      else upcoming.push(row);
   }
   const byStart = (a: AdminCallApprovalRow, b: AdminCallApprovalRow) =>
      (startMs(a) || Date.parse(a.request?.createdAt ?? '') || 0) - (startMs(b) || Date.parse(b.request?.createdAt ?? '') || 0);
   needsDecision.sort(byStart);
   upcoming.sort(byStart);
   decided.sort((a, b) => Date.parse(b.outcomeAt ?? '') - Date.parse(a.outcomeAt ?? '') || 0);
   return { needsDecision, upcoming, decided };
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
