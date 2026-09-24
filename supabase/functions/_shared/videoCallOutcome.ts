// "Did they show up?" — the post-call attendance loop for borrower video calls.
//
// ~20 min after a call starts, video-call-reminders asks the admin Telegram channel. Which buttons:
//   * the borrower has a pending 'call' loan-access request (loan_flow = call) → the request's own
//     la: buttons, so Showed up = approved (they can apply) and No-show = back to none (rebook);
//   * otherwise (loan_flow = open: the request already posted when they booked) → vc: buttons that
//     just record the outcome on users.video_call_outcome and, for a no-show, nudge the borrower.
// Commands work too: /showed <@username> and /noshow <@username or request id>.

import { postDiscord } from './discord.ts';
import {
   BORROWER_COLUMNS,
   type BorrowerRow,
   decisionKeyboard,
   getAdminChatId,
   notifyBorrower,
   REQUEST_COLUMNS,
   type RequestRow,
   who
} from './loanAccess.ts';
import { sendTelegramMessage } from './telegram.ts';
import { formatCallTime } from './videoCall.ts';

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

export type CallOutcome = 'attended' | 'no_show';

// callback_data "vc:<a|n>:<user uuid>" — the open-flow attendance buttons.
export const buildOutcomeCallback = (outcome: CallOutcome, userId: string) => `vc:${outcome === 'attended' ? 'a' : 'n'}:${userId}`;
export const parseOutcomeCallback = (data?: string | null): { outcome: CallOutcome; userId: string } | null => {
   const match = (data ?? '').match(/^vc:([an]):([0-9a-f-]{36})$/i);
   if (!match) return null;
   return { outcome: match[1].toLowerCase() === 'a' ? 'attended' : 'no_show', userId: match[2] };
};

type OutcomeUser = BorrowerRow & { video_call_outcome?: string | null };

const loadUser = async (svc: SupabaseClient, userId: string): Promise<OutcomeUser | null> => {
   const { data } = await svc.from('users').select(`${BORROWER_COLUMNS}, video_call_outcome`).eq('id', userId).maybeSingle();
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
   if (!user?.video_call_starts_at) return;
   const chat = await getAdminChatId(svc);
   if (!chat) return;

   const request = await findPendingCallRequest(svc, userId);
   const { data: flowData } = await svc.rpc('get_loan_flow');
   const gateOn = typeof flowData === 'string' && flowData !== 'open';
   const noRequestNote =
      gateOn && user.loan_access_status !== 'approved'
         ? 'Their request never reached us (app closed after booking?) — Showed up still approves them.'
         : 'Their loan request is already on the board (open flow).';
   const lines = [
      `📞 Did ${who(user, request?.display_name)} show up?`,
      `Call was: ${formatCallTime(user.video_call_starts_at, 'Asia/Bangkok')}`,
      user.video_call_confirmed_at ? "They'd tapped ✅ I'll be there." : "They never confirmed on Messenger.",
      request ? 'Showed up = they can apply for a loan now. No-show = they have to book again.' : noRequestNote
   ];

   await sendTelegramMessage(chat, lines.join('\n'), {
      inlineKeyboard: request
         ? decisionKeyboard(request)
         : [
              [
                 { text: '✅ Showed up', callback_data: buildOutcomeCallback('attended', userId) },
                 { text: '❌ No-show', callback_data: buildOutcomeCallback('no_show', userId) }
              ]
           ]
   });
};

// Open-flow outcome: record it, and for a no-show nudge the borrower to rebook. Idempotent — the
// first recorded outcome wins, so two admins tapping can't flip it back and forth.
export const recordCallOutcome = async (
   svc: SupabaseClient,
   userId: string,
   outcome: CallOutcome,
   decidedBy: string
): Promise<{ ok: boolean; summary: string }> => {
   const { data: updated, error } = await svc
      .from('users')
      .update({ video_call_outcome: outcome, video_call_outcome_at: new Date().toISOString() })
      .eq('id', userId)
      .is('video_call_outcome', null)
      .select(BORROWER_COLUMNS)
      .maybeSingle();
   if (error) throw new Error(error.message);

   if (!updated) {
      const current = await loadUser(svc, userId);
      return {
         ok: false,
         summary: current?.video_call_outcome ? `Already marked ${current.video_call_outcome.replace('_', '-')} — nothing changed.` : 'Borrower not found.'
      };
   }

   // Gated flows (call/approval): a borrower who isn't approved yet but booked and attended — e.g.
   // they closed the app before their request reached us — is approved by this same tap, so
   // "Showed up" always unlocks the application. A no-show stays locked and is asked to rebook.
   const { data: flowData } = await svc.rpc('get_loan_flow');
   const gateOn = typeof flowData === 'string' && flowData !== 'open';
   const unapproved = (updated as BorrowerRow).loan_access_status !== 'approved';
   let approvedNow = false;
   if (gateOn && unapproved && outcome === 'attended') {
      const { error: approveError } = await svc
         .from('users')
         .update({ loan_access_status: 'approved', loan_access_approved_at: new Date().toISOString(), loan_access_seen_at: null })
         .eq('id', userId);
      if (approveError) throw new Error(approveError.message);
      approvedNow = true;
      await notifyBorrower(svc, updated as BorrowerRow, 'approved');
   } else if (outcome === 'no_show') {
      await notifyBorrower(svc, updated as BorrowerRow, gateOn && unapproved ? 'no_show' : 'missed_call');
   }

   const summary = `${outcome === 'attended' ? (approvedNow ? '✅ Showed up → approved' : '✅ Showed up') : '❌ No-show'}: ${who(updated as BorrowerRow)} — by ${decidedBy}`;
   await postDiscord({ content: `📞 Video call ${summary}` }, { prefer: ['DISCORD_BOOKINGS_WEBHOOK_URL'] });
   return { ok: true, summary };
};

