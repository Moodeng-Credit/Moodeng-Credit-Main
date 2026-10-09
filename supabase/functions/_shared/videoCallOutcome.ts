// "Did they show up?" — the post-call attendance loop for borrower video calls.
//
// ~20 min after a call starts, video-call-reminders asks the admin Telegram channel. Which buttons:
//   * the borrower has a pending 'call' loan-access request (loan_flow = call) → the request's own
//     la: buttons, so Showed up = approved (they can apply) and No-show = back to none (rebook);
//   * otherwise (loan_flow = open: the request already posted when they booked) → vc: buttons that
//     just record the outcome on users.video_call_outcome and, for a no-show, nudge the borrower.
// Commands work too: /showed <@username> and /noshow <@username or request id>.
//
// With Zoom wired up (zoom-webhook), the card carries the evidence ("✅ joined 11:02, stayed 14 min"
// / "❌ never joined"), and a borrower Zoom never saw is marked a no-show automatically an hour in
// if nobody has tapped by then (autoMarkNoShow). Showing up still needs a human ✅ — the call is
// where the host judges they're ready to borrow.

import { ATTENDANCE_COLUMNS, type AttendanceFields, describeAttendance, zoomActiveForHost } from './attendance.ts';
import { postDiscord } from './discord.ts';
import { describeHeldRequests } from './loanRequestHold.ts';
import {
   BORROWER_COLUMNS,
   type BorrowerRow,
   decideLoanAccess,
   decisionKeyboard,
   getAdminChatId,
   notifyBorrower,
   REQUEST_COLUMNS,
   type RequestRow,
   who
} from './loanAccess.ts';
import { needsPreKycGate } from './preKycGate.ts';
import { sendTelegramMessage } from './telegram.ts';
import { formatCallTimeForTeam } from './videoCall.ts';

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

export type CallOutcome = 'attended' | 'no_show';

// callback_data "vc:<a|n>:<user uuid>:<call key>" — the open-flow attendance buttons. The call key
// (the call's start, in base-36 minutes) ties a card to ONE call: after a rebook, tapping yesterday's
// card must not record an outcome for the new call that hasn't happened yet.
export const callKeyFor = (startsAt: string | null | undefined): string =>
   startsAt && !Number.isNaN(Date.parse(startsAt)) ? Math.floor(Date.parse(startsAt) / 60000).toString(36) : '';
export const buildOutcomeCallback = (outcome: CallOutcome, userId: string, startsAt?: string | null) => {
   const key = callKeyFor(startsAt);
   return `vc:${outcome === 'attended' ? 'a' : 'n'}:${userId}${key ? `:${key}` : ''}`;
};
export const parseOutcomeCallback = (data?: string | null): { outcome: CallOutcome; userId: string; callKey: string | null } | null => {
   const match = (data ?? '').match(/^vc:([an]):([0-9a-f-]{36})(?::([0-9a-z]+))?$/i);
   if (!match) return null;
   return { outcome: match[1].toLowerCase() === 'a' ? 'attended' : 'no_show', userId: match[2], callKey: match[3]?.toLowerCase() ?? null };
};

type OutcomeUser = BorrowerRow &
   AttendanceFields & { video_call_outcome?: string | null; video_call_host?: string | null };

// Auto no-show fires this long after the start when Zoom never saw them and nobody tapped.
export const AUTO_NO_SHOW_AFTER_MIN = 60;

const loadUser = async (svc: SupabaseClient, userId: string): Promise<OutcomeUser | null> => {
   const { data } = await svc
      .from('users')
      .select(`${BORROWER_COLUMNS}, video_call_outcome, ${ATTENDANCE_COLUMNS}`)
      .eq('id', userId)
      .maybeSingle();
   return (data as OutcomeUser | null) ?? null;
};

export const findPendingCallRequest = async (svc: SupabaseClient, userId: string): Promise<RequestRow | null> => {
   const { data } = await svc
      .from('loan_access_requests')
      .select(REQUEST_COLUMNS)
      .eq('user_id', userId)
      .eq('status', 'pending')
      .eq('kind', 'call')
      .maybeSingle();
   return (data as RequestRow | null) ?? null;
};

export const promptAdminsForAttendance = async (svc: SupabaseClient, userId: string) => {
   const user = await loadUser(svc, userId);
   if (!user?.video_call_starts_at || user.loan_access_status === 'rejected') return;
   const chat = await getAdminChatId(svc);
   if (!chat) return;

   const request = await findPendingCallRequest(svc, userId);
   const { data: flowData } = await svc.rpc('get_loan_flow');
   const preKyc = await needsPreKycGate(svc, userId);
   const gateOn = preKyc || (typeof flowData === 'string' && flowData !== 'open');
   const noRequestNote =
      gateOn && user.loan_access_status !== 'approved'
         ? `Their request never reached us (app closed after booking?) — Showed up still approves them${preKyc ? ' (they can then apply)' : ''}.`
         : 'Their loan request is already on the board (open flow).';
   const zoomActive = await zoomActiveForHost(svc, user.video_call_host);
   const evidence = describeAttendance(user, zoomActive);
   const autoAt = new Date(Date.parse(user.video_call_starts_at) + AUTO_NO_SHOW_AFTER_MIN * 60000).toLocaleTimeString('en-US', {
      timeZone: 'Asia/Bangkok',
      hour: 'numeric',
      minute: '2-digit'
   });
   const lines = [
      `📞 Did ${who(user, request?.display_name)} show up?`,
      `Call was: ${formatCallTimeForTeam(user.video_call_starts_at, user.video_call_timezone)}`,
      evidence,
      user.video_call_confirmed_at ? "They'd tapped ✅ I'll be there." : 'They never confirmed.',
      request
         ? 'Showed up = they can apply for a loan now. No-show = they have to book again.'
         : noRequestNote,
      zoomActive && !user.video_call_arrived_at && user.video_call_meeting_id
         ? `No tap by ${autoAt} (Bangkok) → I'll mark them a no-show automatically.`
         : null
   ].filter(Boolean);

   await sendTelegramMessage(chat, lines.join('\n'), {
      inlineKeyboard: request
         ? decisionKeyboard(request)
         : [
              [
                 { text: '✅ Showed up', callback_data: buildOutcomeCallback('attended', userId, user.video_call_starts_at) },
                 { text: '❌ No-show', callback_data: buildOutcomeCallback('no_show', userId, user.video_call_starts_at) }
              ]
           ]
   });
};

// Open-flow outcome: record it, and for a no-show nudge the borrower to rebook. Idempotent — the
// first recorded outcome wins, so two admins tapping can't flip it back and forth. The one exception:
// "Showed up" corrects a no-show (a wrong Zoom auto-mark or a mis-tap), since for an unreferred
// borrower attending is the only thing that puts their request on the board.
export const recordCallOutcome = async (
   svc: SupabaseClient,
   userId: string,
   outcome: CallOutcome,
   decidedBy: string,
   // From a card's button: the call it was sent for. A mismatch means they've rebooked since.
   expectedCallKey?: string | null
): Promise<{ ok: boolean; summary: string }> => {
   if (expectedCallKey) {
      const current = await loadUser(svc, userId);
      if (callKeyFor(current?.video_call_starts_at) !== expectedCallKey) {
         return { ok: false, summary: "This card is for an earlier call — they've rebooked since, so nothing was changed." };
      }
   }
   // A pending call request (e.g. /showed <user id>, which findPendingRequest can't resolve) is
   // decided the normal way, so the request closes with the outcome instead of staying pending.
   const pendingRequest = await findPendingCallRequest(svc, userId);
   if (pendingRequest) {
      const decided = await decideLoanAccess(svc, pendingRequest.id, outcome === 'attended' ? 'approved' : 'no_show', decidedBy);
      return { ok: decided.ok, summary: decided.summary };
   }
   // Read before the outcome is written: the pre-KYC gate makes this tap the approval too.
   const preKyc = await needsPreKycGate(svc, userId);
   // A "Showed up" that corrects a no-show tells the borrower: they were told to rebook.
   const correctingNoShow = outcome === 'attended' && (await loadUser(svc, userId))?.video_call_outcome === 'no_show';
   const update = svc
      .from('users')
      .update({ video_call_outcome: outcome, video_call_outcome_at: new Date().toISOString() })
      .eq('id', userId);
   const { data: updated, error } = await (outcome === 'attended'
      ? update.or('video_call_outcome.is.null,video_call_outcome.eq.no_show')
      : update.is('video_call_outcome', null)
   )
      .select(BORROWER_COLUMNS)
      .maybeSingle();
   if (error) throw new Error(error.message);

   if (!updated) {
      const current = await loadUser(svc, userId);
      // Attended an earlier call (open flow, never approved) and now held by the pre-KYC gate: the
      // outcome is already 'attended', but this ✅ must still approve them, or nothing can.
      if (outcome === 'attended' && preKyc && current?.video_call_outcome === 'attended' && current.loan_access_status !== 'approved') {
         // Conditional, so two admins tapping at once approve (and message the borrower) only once.
         const { data: approvedRows, error: approveError } = await svc
            .from('users')
            .update({ loan_access_status: 'approved', loan_access_approved_at: new Date().toISOString(), loan_access_seen_at: null })
            .eq('id', userId)
            .neq('loan_access_status', 'approved')
            .select('id');
         if (approveError) throw new Error(approveError.message);
         if (!approvedRows?.length) return { ok: false, summary: 'Already approved — nothing changed.' };
         await notifyBorrower(svc, current, 'approved');
         const summary = `✅ Showed up → approved: ${who(current)} — by ${decidedBy}`;
         await postDiscord({ content: `📞 Video call ${summary}` }, { prefer: ['DISCORD_BOOKINGS_WEBHOOK_URL'] });
         return { ok: true, summary };
      }
      return {
         ok: false,
         summary: current?.video_call_outcome ? `Already marked ${current.video_call_outcome.replace('_', '-')} — nothing changed.` : 'Borrower not found.'
      };
   }

   // Gated flows (call/approval): a borrower who isn't approved yet but booked and attended — e.g.
   // they closed the app before their request reached us — is approved by this same tap, so
   // "Showed up" always unlocks the application. A no-show stays locked and is asked to rebook.
   // Same for the pre-KYC gate in any flow: Showed up unlocks ID verification.
   const { data: flowData } = await svc.rpc('get_loan_flow');
   const gateOn = preKyc || (typeof flowData === 'string' && flowData !== 'open');
   const unapproved = (updated as BorrowerRow).loan_access_status !== 'approved';
   let approvedNow = false;
   if (gateOn && unapproved && outcome === 'attended') {
      // Conditional, so a concurrent tap that also got here approves (and messages) only once.
      const { data: approvedRows, error: approveError } = await svc
         .from('users')
         .update({ loan_access_status: 'approved', loan_access_approved_at: new Date().toISOString(), loan_access_seen_at: null })
         .eq('id', userId)
         .neq('loan_access_status', 'approved')
         .select('id');
      if (approveError) throw new Error(approveError.message);
      approvedNow = Boolean(approvedRows?.length);
      if (approvedNow) await notifyBorrower(svc, updated as BorrowerRow, 'approved');
   }
   // A no-show parks their open request (database trigger); say which one, to them and the team.
   const held = outcome === 'no_show' ? await describeHeldRequests(svc, userId) : '';
   if (correctingNoShow) {
      // The corrected no-show must not count as a strike toward the rebooking cooldown.
      const { data: lastStrike } = await svc
         .from('video_call_no_shows')
         .select('id')
         .eq('user_id', userId)
         .eq('active', true)
         .eq('kind', 'no_show')
         .order('recorded_at', { ascending: false })
         .limit(1)
         .maybeSingle();
      if (lastStrike) await svc.from('video_call_no_shows').update({ active: false }).eq('id', (lastStrike as { id: string }).id);
      // Only a recent gated-flow no-show is this call's; an old, unrelated one stays as it was.
      const { data: lastNoShow } = await svc
         .from('loan_access_requests')
         .select('id')
         .eq('user_id', userId)
         .eq('status', 'no_show')
         .gte('decided_at', new Date(Date.now() - 7 * 86400000).toISOString())
         .order('decided_at', { ascending: false })
         .limit(1)
         .maybeSingle();
      if (lastNoShow) {
         await svc
            .from('loan_access_requests')
            .update({ status: 'approved', decided_by: `${decidedBy} (corrected no-show)` })
            .eq('id', (lastNoShow as { id: string }).id);
      }
   }
   if (correctingNoShow && !approvedNow) {
      await notifyBorrower(svc, updated as BorrowerRow, 'no_show_corrected');
   }
   if (outcome === 'no_show') {
      await notifyBorrower(svc, updated as BorrowerRow, gateOn && unapproved ? 'no_show' : held.includes('until they attend') ? 'missed_call_request_waiting' : held ? 'missed_call_request_paused' : 'missed_call');
   }

   const summary = `${outcome === 'attended' ? (approvedNow ? '✅ Showed up → approved' : '✅ Showed up') : '❌ No-show'}: ${who(updated as BorrowerRow)} — by ${decidedBy}${held ? `\n${held}` : ''}`;
   await postDiscord({ content: `📞 Video call ${summary}` }, { prefer: ['DISCORD_BOOKINGS_WEBHOOK_URL'] });
   return { ok: true, summary };
};

// An hour in, Zoom never saw them and nobody tapped: record the no-show exactly as the ❌ button
// would (gated flow: close their request, back to 'none', "book a new time"), then tell the admins.
export const autoMarkNoShow = async (svc: SupabaseClient, userId: string): Promise<string | null> => {
   const decidedBy = 'auto (never joined Zoom)';
   const request = await findPendingCallRequest(svc, userId);
   if (!request) {
      // Never overrule an admin: a borrower they already decided on is left alone.
      const user = await loadUser(svc, userId);
      if (!user || user.loan_access_status === 'rejected' || user.video_call_outcome) return null;
   }
   const result = request ? await decideLoanAccess(svc, request.id, 'no_show', decidedBy) : await recordCallOutcome(svc, userId, 'no_show', decidedBy);
   if (!result.ok) return null;
   // With a request, or held by the pre-KYC gate, /showed approves them; otherwise (open flow) it
   // puts their loan request back on the board.
   const approves = Boolean(request) || (await needsPreKycGate(svc, userId));
   const text = approves
      ? `🤖 ${result.summary}\nZoom never saw them join, so they've been asked to book a new time. If they did make it, send /showed ${userId} and they'll be approved.`
      : `🤖 ${result.summary}\nZoom never saw them join, so they've been asked to book a new time. If they did make it, send /showed ${userId} and their request goes back on the board.`;
   try {
      const chat = await getAdminChatId(svc);
      if (chat) await sendTelegramMessage(chat, text);
   } catch (err) {
      console.error('videoCallOutcome: auto no-show telegram failed', err instanceof Error ? err.message : err);
   }
   return result.summary;
};

// The slot was freed because they never confirmed: close a pending call request (gated flows) so
// they're not stuck on "see you on the call", then tell them and the admins. Mirrors a Cal.com cancel.
export const closeReleasedCall = async (svc: SupabaseClient, userId: string, whenForTeam: string) => {
   const { data: closed } = await svc
      .from('loan_access_requests')
      .update({ status: 'expired', decided_at: new Date().toISOString(), decided_by: 'unconfirmed-slot-released' })
      .eq('user_id', userId)
      .eq('status', 'pending')
      .eq('kind', 'call')
      .select('id');
   if (closed?.length) {
      await svc.from('users').update({ loan_access_status: 'none' }).eq('id', userId).eq('loan_access_status', 'pending');
   }
   const { data: borrower } = await svc.from('users').select(BORROWER_COLUMNS).eq('id', userId).maybeSingle();
   if (!borrower) return;
   await notifyBorrower(svc, borrower as BorrowerRow, 'spot_released');

   const text = `🗓️ Freed ${who(borrower as BorrowerRow)}'s slot (${whenForTeam}) — they never confirmed after two asks. They've been asked to pick a new time.`;
   try {
      const chat = await getAdminChatId(svc);
      if (chat) await sendTelegramMessage(chat, text);
   } catch (err) {
      console.error('videoCallOutcome: release telegram failed', err instanceof Error ? err.message : err);
   }
   await postDiscord({ content: text }, { prefer: ['DISCORD_BOOKINGS_WEBHOOK_URL'] });
};
