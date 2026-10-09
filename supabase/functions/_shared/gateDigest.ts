// Daily admin digest for the pre-KYC gate (loan-access action=gate_digest, pg_cron 09:00 Manila):
//   ⏳ call happened, still waiting on a ✅ / ❌  — without a tap they sit on "Thanks for joining"
//      until the request expires a week after the call;
//   📭 connected Messenger, no call coming up    — never booked, cancelled, or missed it and never
//      rebooked: the biggest drop-off, and we can now message them.
// Nothing is sent on a day with nothing to report.

import { needsPreKycGate } from './preKycGate.ts';
import { formatCallTimeForTeam } from './videoCall.ts';

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

// ref: what /showed and /noshow take — a request-id prefix, or the borrower's @username / user id
// when they booked but their request never reached us (app closed after booking).
export type WaitingRow = { ref: string; name: string; callAt: string; callTimezone: string | null };
export type UnbookedRow = { name: string; connectedAt: string };

// The call is 15 min; a request still pending this long after the start needs a tap.
const CALL_DONE_AFTER_MS = 30 * 60 * 1000;
// Older connections are cold — the list is for people we can still win back.
const UNBOOKED_WINDOW_DAYS = 14;
const MAX_LINES = 15;

const daysAgo = (iso: string, now: number) => {
   const days = Math.floor((now - Date.parse(iso)) / 86400000);
   return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days}d ago`;
};

const nameOf = (u: { display_name?: string | null; username?: string | null; email?: string | null; id?: string }, fallback?: string | null) =>
   [fallback || u.display_name, u.username ? `@${u.username}` : null].filter(Boolean).join(' ') || u.email || u.id || '?';

export const formatGateDigest = (waiting: WaitingRow[], unbooked: UnbookedRow[], now = Date.now()): string | null => {
   if (!waiting.length && !unbooked.length) return null;
   const list = <T>(rows: T[], line: (row: T, i: number) => string) => [
      ...rows.slice(0, MAX_LINES).map(line),
      ...(rows.length > MAX_LINES ? [`…and ${rows.length - MAX_LINES} more`] : [])
   ];
   return [
      '☀️ Onboarding check-in',
      ...(waiting.length
         ? [
              '',
              `⏳ Call done, waiting on your ✅ / ❌ (${waiting.length}):`,
              ...list(waiting, (r, i) => `${i + 1}. ${r.name} · call ${formatCallTimeForTeam(r.callAt, r.callTimezone)} — /showed ${r.ref} · /noshow ${r.ref}`)
           ]
         : []),
      ...(unbooked.length
         ? [
              '',
              `📭 Connected Messenger, no call booked (${unbooked.length}):`,
              ...list(unbooked, (r, i) => `${i + 1}. ${r.name} · connected ${daysAgo(r.connectedAt, now)}`),
              'Give them a nudge from the Page inbox.'
           ]
         : [])
   ].join('\n');
};

export const collectGateDigest = async (svc: SupabaseClient, now = Date.now()): Promise<{ waiting: WaitingRow[]; unbooked: UnbookedRow[] }> => {
   const { data: pending, error } = await svc
      .from('loan_access_requests')
      .select('id, display_name, users!inner(id, username, email, display_name, video_call_starts_at, video_call_timezone)')
      .eq('status', 'pending')
      .eq('kind', 'call')
      .order('created_at', { ascending: true });
   if (error) throw new Error(error.message);
   const waiting = ((pending ?? []) as Array<{
      id: string;
      display_name: string | null;
      users: { id: string; username: string | null; email: string | null; display_name: string | null; video_call_starts_at: string | null; video_call_timezone: string | null };
   }>)
      .filter((r) => r.users?.video_call_starts_at && Date.parse(r.users.video_call_starts_at) + CALL_DONE_AFTER_MS < now)
      .map((r) => ({ ref: r.id.slice(0, 8), name: nameOf(r.users, r.display_name), callAt: r.users.video_call_starts_at as string, callTimezone: r.users.video_call_timezone }));

   const { data: candidates, error: candidateError } = await svc
      .from('users')
      .select('id, username, email, display_name, messenger_verified_at, video_call_starts_at, video_call_timezone, video_call_outcome')
      .not('messenger_verified_at', 'is', null)
      .or(`video_call_starts_at.is.null,video_call_starts_at.lt.${new Date(now).toISOString()}`)
      .in('loan_access_status', ['none', 'rejected'])
      .gte('messenger_verified_at', new Date(now - UNBOOKED_WINDOW_DAYS * 86400000).toISOString())
      .order('messenger_verified_at', { ascending: false });
   if (candidateError) throw new Error(candidateError.message);
   const unbooked: UnbookedRow[] = [];
   for (const u of (candidates ?? []) as Array<{
      id: string;
      username: string | null;
      email: string | null;
      display_name: string | null;
      messenger_verified_at: string;
      video_call_starts_at: string | null;
      video_call_timezone: string | null;
      video_call_outcome: string | null;
   }>) {
      // Only people the gate is actually holding (not verified, not approved, never borrowed).
      if (!(await needsPreKycGate(svc, u.id))) continue;
      // Booked, the call time has passed, and nobody recorded an outcome: their request never reached
      // us, so it needs a tap like any other — /showed approves them.
      if (u.video_call_starts_at && !u.video_call_outcome && Date.parse(u.video_call_starts_at) + CALL_DONE_AFTER_MS < now) {
         waiting.push({ ref: u.username ? `@${u.username}` : u.id, name: nameOf(u), callAt: u.video_call_starts_at, callTimezone: u.video_call_timezone });
         continue;
      }
      unbooked.push({ name: nameOf(u), connectedAt: u.messenger_verified_at });
   }
   return { waiting, unbooked };
};
