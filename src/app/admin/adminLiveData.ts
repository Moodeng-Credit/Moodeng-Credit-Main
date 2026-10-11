import { type AdminStatus, deriveAccessRequestStatus, deriveLoanStatus } from '@/app/admin/adminStatus';
import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from '@/lib/supabase/client';

// Read-only history for the admin panel: per-borrower timeline and the "Recent changes" feed.
// Built only from data that already exists (users timestamps, loan_access_requests, loans,
// admin_audit_logs, account_status_audit_logs) — nothing here writes.

export interface AdminHistoryEvent {
   key: string;
   at: string;
   label: string;
   status: AdminStatus | null;
   userId: string | null;
   username: string | null;
   actorId: string | null;
   actorName: string | null;
   detail: string | null;
}

type Row = Record<string, unknown>;

const str = (value: unknown): string | null => (typeof value === 'string' && value ? value : null);

const humanize = (action: string) => action.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

const ACCESS_LABEL: Partial<Record<AdminStatus, string>> = {
   approved: 'Approved',
   declined: 'Declined',
   expired: 'Request expired',
   pending_call: 'Asked for access'
};

// Rows → timeline events. Exported for tests; usernames are filled in afterwards.
export function buildUserEvents(user: Row): AdminHistoryEvent[] {
   const userId = str(user.id);
   const out: AdminHistoryEvent[] = [];
   const push = (at: unknown, label: string, status: AdminStatus | null, detail: string | null = null) => {
      const when = str(at);
      if (when)
         out.push({
            key: `user:${userId}:${label}`,
            at: when,
            label,
            status,
            userId,
            username: null,
            actorId: null,
            actorName: null,
            detail
         });
   };
   push(user.created_at, 'Joined', 'new');
   push(user.messenger_verified_at, 'Facebook linked', null);
   push(user.video_call_scheduled_at, 'Call booked', 'call_booked');
   push(
      user.video_call_outcome_at,
      user.video_call_outcome === 'no_show' ? 'Missed the call' : 'Showed up to the call',
      user.video_call_outcome === 'no_show' ? 'declined' : null
   );
   push(user.loan_access_approved_at, 'Approved', 'approved');
   push(user.didit_submitted_at, 'Sent ID to Didit', 'in_review', str(user.didit_id_status));
   return out;
}

export function buildAccessRequestEvents(requests: Row[]): AdminHistoryEvent[] {
   return requests.flatMap((r) => {
      const status = deriveAccessRequestStatus({ status: str(r.status), expires_at: str(r.expires_at) });
      const userId = str(r.user_id);
      const events: AdminHistoryEvent[] = [];
      const created = str(r.created_at);
      if (created)
         events.push({
            key: `lar:${r.id}:created`,
            at: created,
            label: 'Asked for access',
            status: 'pending_call',
            userId,
            username: null,
            actorId: null,
            actorName: null,
            detail: str(r.kind)
         });
      const decided = str(r.decided_at);
      if (decided && status !== 'pending_call')
         events.push({
            key: `lar:${r.id}:decided`,
            at: decided,
            label: ACCESS_LABEL[status] ?? humanize(String(r.status)),
            status,
            userId,
            username: null,
            actorId: str(r.decided_by),
            actorName: null,
            detail: null
         });
      return events;
   });
}

export function buildLoanEvents(loans: Row[]): AdminHistoryEvent[] {
   return loans.flatMap((l) => {
      const userId = str(l.borrower_user_id);
      const amount = `$${Number(l.loan_amount ?? 0)}`;
      const base = { userId, username: null, actorId: null, actorName: null };
      const events: AdminHistoryEvent[] = [];
      const add = (at: unknown, key: string, label: string, status: AdminStatus, actorId: unknown = null) => {
         const when = str(at);
         if (when) events.push({ ...base, key: `loan:${l.id}:${key}`, at: when, label, status, actorId: str(actorId), detail: amount });
      };
      add(l.created_at, 'requested', 'Requested a loan', 'requested');
      add(l.funded_at, 'funded', 'Funded', 'funded');
      add(l.repaid_at, 'repaid', 'Repaid', 'repaid');
      add(l.refunded_at, 'refunded', 'Refunded', 'refunded', l.refunded_by);
      if (!l.repaid_at && deriveLoanStatus(l as never) === 'overdue') add(l.due_date, 'overdue', 'Went overdue', 'overdue');
      return events;
   });
}

export function buildAuditEvents(adminLogs: Row[], statusLogs: Row[]): AdminHistoryEvent[] {
   const fromAdmin = adminLogs.map<AdminHistoryEvent>((a) => ({
      key: `audit:${a.id}`,
      at: String(a.created_at),
      label: humanize(String(a.action ?? 'admin action')),
      status: null,
      userId: str(a.target_user_id),
      username: null,
      actorId: str(a.actor_user_id),
      actorName: null,
      detail: str(a.target_table)
   }));
   const fromStatus = statusLogs.map<AdminHistoryEvent>((s) => ({
      key: `status:${s.id}`,
      at: String(s.created_at),
      label: `Account ${String(s.previous_status ?? '?')} → ${String(s.new_status ?? '?')}`,
      status: s.new_status === 'banned' ? 'banned' : s.new_status === 'blocked' ? 'watchlist' : null,
      userId: str(s.target_user_id),
      username: null,
      actorId: str(s.actor_user_id),
      actorName: null,
      detail: str(s.reason)
   }));
   return [...fromAdmin, ...fromStatus];
}

export const sortNewestFirst = (events: AdminHistoryEvent[]) => [...events].sort((a, b) => b.at.localeCompare(a.at));

async function attachNames(events: AdminHistoryEvent[]): Promise<AdminHistoryEvent[]> {
   const ids = [...new Set(events.flatMap((e) => [e.userId, e.actorId]).filter((id): id is string => Boolean(id)))];
   if (!ids.length) return events;
   const { data } = await getSupabaseBrowserClient().from('users').select('id,username').in('id', ids);
   const names = new Map((data ?? []).map((u: { id: string; username: string | null }) => [u.id, u.username]));
   return events.map((e) => ({
      ...e,
      username: e.userId ? (names.get(e.userId) ?? null) : null,
      actorName: e.actorId ? (names.get(e.actorId) ?? null) : null
   }));
}

/** Everything that happened to one borrower, oldest first. */
export async function getBorrowerHistory(userId: string): Promise<AdminHistoryEvent[]> {
   if (!isSupabaseBrowserConfigured()) return [];
   const supabase = getSupabaseBrowserClient();
   const [user, requests, loans, adminLogs, statusLogs] = await Promise.all([
      supabase
         .from('users')
         .select(
            'id,created_at,messenger_verified_at,video_call_scheduled_at,video_call_outcome,video_call_outcome_at,loan_access_approved_at,didit_submitted_at,didit_id_status'
         )
         .eq('id', userId)
         .maybeSingle(),
      supabase
         .from('loan_access_requests')
         .select('id,user_id,kind,status,created_at,expires_at,decided_at,decided_by')
         .eq('user_id', userId),
      supabase
         .from('loans')
         .select(
            'id,borrower_user_id,loan_amount,loan_status,repayment_status,due_date,due_timezone,created_at,funded_at,repaid_at,refunded_at,refunded_by'
         )
         .eq('borrower_user_id', userId),
      supabase
         .from('admin_audit_logs')
         .select('id,actor_user_id,action,target_table,target_user_id,created_at')
         .eq('target_user_id', userId)
         .limit(100),
      supabase.from('account_status_audit_logs').select('*').eq('target_user_id', userId).limit(50)
   ]);
   const events = [
      ...(user.data ? buildUserEvents(user.data as Row) : []),
      ...buildAccessRequestEvents((requests.data ?? []) as Row[]),
      ...buildLoanEvents((loans.data ?? []) as Row[]),
      ...buildAuditEvents((adminLogs.data ?? []) as Row[], (statusLogs.data ?? []) as Row[])
   ];
   return sortNewestFirst(await attachNames(events)).reverse();
}

/** Latest state changes across the platform, newest first. */
export async function getRecentStateChanges(limit = 20): Promise<AdminHistoryEvent[]> {
   if (!isSupabaseBrowserConfigured()) return [];
   const supabase = getSupabaseBrowserClient();
   const [requests, loans, adminLogs, statusLogs] = await Promise.all([
      supabase
         .from('loan_access_requests')
         .select('id,user_id,kind,status,created_at,expires_at,decided_at,decided_by')
         .order('created_at', { ascending: false })
         .limit(limit),
      supabase
         .from('loans')
         .select(
            'id,borrower_user_id,loan_amount,loan_status,repayment_status,due_date,due_timezone,created_at,funded_at,repaid_at,refunded_at,refunded_by'
         )
         .eq('is_test', false)
         .order('updated_at', { ascending: false })
         .limit(limit),
      supabase
         .from('admin_audit_logs')
         .select('id,actor_user_id,action,target_table,target_user_id,created_at')
         .order('created_at', { ascending: false })
         .limit(limit),
      supabase.from('account_status_audit_logs').select('*').order('created_at', { ascending: false }).limit(limit)
   ]);
   const events = sortNewestFirst([
      ...buildAccessRequestEvents((requests.data ?? []) as Row[]),
      // A loan's "Went overdue" is derived, not a change someone made — keep it out of the feed.
      ...buildLoanEvents((loans.data ?? []) as Row[]).filter((e) => e.status !== 'overdue'),
      ...buildAuditEvents((adminLogs.data ?? []) as Row[], (statusLogs.data ?? []) as Row[])
   ]).slice(0, limit);
   return attachNames(events);
}

/** Look up a username, for "Approved by @x" on realtime highlights. */
export async function getUsername(userId: string): Promise<string | null> {
   const { data } = await getSupabaseBrowserClient().from('users').select('username').eq('id', userId).maybeSingle();
   return (data as { username?: string | null } | null)?.username ?? null;
}
