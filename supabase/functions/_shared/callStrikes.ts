// Call strikes → automatic rejection (George, 2026-11-19): "after 3 reschedulings and missing 2
// meetings, the user should get just an automatic rejection saying they rescheduled too much or
// didn't show up twice, and it should be recorded as such."
//
//   Missed calls: a no-show (gated: loan_access_requests 'no_show'; open flow: video_call_no_shows),
//   or a slot freed because they never tapped ✅ (requests 'expired' by unconfirmed-slot-released;
//   call_events 'unconfirmed'). The 2nd one rejects them.
//   Reschedules: every time they book again after their first booking, plus every move they make on
//   Cal.com. A move by the team (🔄 Change time) never counts. The 3rd one rejects them — booked
//   through us it is refused instead of booked; moved on Cal.com, the moved call is cancelled.
//
// Anyone who has attended a call, or is already approved/rejected, is left alone. The reject is the
// normal one (rejectUser: cards stamped, call cancelled, Discord line) with its own message, and
// users.loan_access_reject_reason + the request's decided_by say why.

import { postDiscord } from './discord.ts';
import { getCallChangesChatId, rejectUser } from './loanAccess.ts';
import { sendTelegramMessage } from './telegram.ts';

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

export const MISSED_CALLS_LIMIT = 2;
export const RESCHEDULE_LIMIT = 3;
// One missed call can be logged twice (a request and the no-show log), seconds apart: one strike.
const SAME_CALL_MS = 2 * 60 * 60 * 1000;
// A Cal.com reschedule this soon after the team's 🔄 Change time is the team's own move.
// 30 min: the Cal.com 🔄 Change time link logs the team move when it's opened, not when the time is picked.
const TEAM_MOVE_WINDOW_MS = 30 * 60 * 1000;
// Bookings weren't logged before this shipped: until then, each call request stands for one booking.
export const BOOKING_LOG_START = '2026-11-19T17:00:00Z';

// income_costs: pre-screening medical costs still to come are too high for their income, and nobody on the
// team decided within 2 hours (George, 2026-11-21). Same automatic path, its own message.
// linked_account: the same person as an account we already turned down (linkedAccounts.ts autoRejectLinked).
export type StrikeReason = 'missed_calls' | 'too_many_reschedules' | 'income_costs' | 'linked_account';
export const UNCONFIRMED_DECIDED_BY = 'unconfirmed-slot-released';

export const REJECT_LABEL: Record<StrikeReason, string> = {
   missed_calls: `auto: missed ${MISSED_CALLS_LIMIT} calls`,
   too_many_reschedules: `auto: rescheduled ${RESCHEDULE_LIMIT} times`,
   income_costs: 'auto: costs too high for their income',
   linked_account: 'auto: same person as a rejected account'
};

/** Distinct missed calls from their timestamps (records within 2 hours are the same call). */
export const countMissedCalls = (isos: Array<string | null | undefined>): number => {
   const times = isos
      .map((iso) => (iso ? Date.parse(iso) : NaN))
      .filter((t) => !Number.isNaN(t))
      .sort((a, b) => a - b);
   return times.filter((t, i) => i === 0 || t - times[i - 1] > SAME_CALL_MS).length;
};

/** Reschedules so far: bookings after the first, plus their own Cal.com moves. */
export const countReschedules = (bookings: number, ownMoves: number): number => Math.max(bookings - 1, 0) + ownMoves;

export type CallStrikes = { missed: number; bookings: number; reschedules: number; exempt: boolean };

export const loadCallStrikes = async (svc: SupabaseClient, userId: string): Promise<CallStrikes> => {
   const [{ data: user }, { data: requests }, { data: noShows }, { data: events }] = await Promise.all([
      svc.from('users').select('loan_access_status, video_call_outcome, is_test').eq('id', userId).maybeSingle(),
      svc.from('loan_access_requests').select('status, created_at, decided_at, decided_by').eq('user_id', userId).eq('kind', 'call'),
      svc.from('video_call_no_shows').select('kind, recorded_at').eq('user_id', userId).eq('active', true),
      svc.from('call_events').select('kind, recorded_at').eq('user_id', userId)
   ]);
   const reqs = (requests ?? []) as Array<{ status: string; created_at: string; decided_at: string | null; decided_by: string | null }>;
   const logged = (noShows ?? []) as Array<{ kind: string; recorded_at: string }>;
   const evs = (events ?? []) as Array<{ kind: string; recorded_at: string }>;
   const u = user as { loan_access_status?: string | null; video_call_outcome?: string | null } | null;
   const exempt =
      !u ||
      u.loan_access_status === 'approved' ||
      u.loan_access_status === 'rejected' ||
      u.video_call_outcome === 'attended' ||
      logged.some((r) => r.kind === 'attended');

   const missed = countMissedCalls([
      ...reqs.filter((r) => r.status === 'no_show' || (r.status === 'expired' && r.decided_by === UNCONFIRMED_DECIDED_BY)).map((r) => r.decided_at),
      ...logged.filter((r) => r.kind === 'no_show').map((r) => r.recorded_at),
      ...evs.filter((e) => e.kind === 'unconfirmed').map((e) => e.recorded_at)
   ]);
   const bookings =
      evs.filter((e) => e.kind === 'booked').length + reqs.filter((r) => Date.parse(r.created_at) < Date.parse(BOOKING_LOG_START)).length;
   const reschedules = countReschedules(bookings, evs.filter((e) => e.kind === 'moved').length);
   return { missed, bookings, reschedules, exempt };
};

/** The rule, given what they've done (and, for a booking about to be made, one more reschedule). */
export const strikeVerdict = (s: CallStrikes, opts: { extraReschedule?: boolean } = {}): StrikeReason | null => {
   if (s.exempt) return null;
   if (s.missed >= MISSED_CALLS_LIMIT) return 'missed_calls';
   if (s.reschedules + (opts.extraReschedule ? 1 : 0) >= RESCHEDULE_LIMIT) return 'too_many_reschedules';
   return null;
};

export const logCallEvent = async (svc: SupabaseClient, userId: string, kind: 'booked' | 'moved' | 'team_moved' | 'unconfirmed', callAt?: string | null) => {
   const { error } = await svc.from('call_events').insert({ user_id: userId, kind, call_at: callAt ?? null });
   if (error) console.error('callStrikes: log failed', kind, error.message);
};

/** True when the team moved this person's call in the last few minutes (🔄 Change time). */
export const teamMovedRecently = async (svc: SupabaseClient, userId: string): Promise<boolean> => {
   const { data } = await svc
      .from('call_events')
      .select('id')
      .eq('user_id', userId)
      .eq('kind', 'team_moved')
      .gte('recorded_at', new Date(Date.now() - TEAM_MOVE_WINDOW_MS).toISOString())
      .limit(1);
   return Boolean(data?.length);
};

/** Reject them now if the rule says so. Returns the reason when they were rejected, else null. */
export const autoRejectForStrikes = async (
   svc: SupabaseClient,
   userId: string,
   opts: { extraReschedule?: boolean } = {}
): Promise<StrikeReason | null> => {
   const strikes = await loadCallStrikes(svc, userId);
   const reason = strikeVerdict(strikes, opts);
   if (!reason) return null;
   const result = await rejectUser(svc, userId, REJECT_LABEL[reason], { strikeReason: reason });
   if (!result.ok) {
      console.log('callStrikes: auto reject skipped for', userId, result.summary);
      return null;
   }
   const text = `🤖 Auto-rejected — ${reason === 'missed_calls' ? `missed ${strikes.missed} calls` : `rescheduled ${strikes.reschedules + (opts.extraReschedule ? 1 : 0)} times`}. They were told why.\n${result.summary}\nUndo: /reopen`;
   try {
      const chat = await getCallChangesChatId(svc);
      if (chat) await sendTelegramMessage(chat, text);
   } catch (err) {
      console.error('callStrikes: telegram failed', err instanceof Error ? err.message : err);
   }
   await postDiscord({ content: text }, { prefer: ['DISCORD_BOOKINGS_WEBHOOK_URL'] });
   return reason;
};
