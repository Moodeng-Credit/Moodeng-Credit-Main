// Connect → Approve → Apply: the shared pieces used by the loan-access edge function (submit +
// expiry), telegram-webhook (admin buttons / commands) and the post-call attendance prompt.
// See docs/HANDOFF_BORROWER_VERIFICATION.md §13.
//
// State lives in two places, always written together by the service role:
//   users.loan_access_status      none | pending | approved | rejected            (the gate the app reads)
//   loan_access_requests.status   pending | approved | rejected | no_show | expired (one row per reach-out)
// A request's kind is 'approval' (admin decides directly) or 'call' (decided by attendance at the
// booked video call: Showed up → approved, No-show → back to none so they can rebook).
//
// Every notification here is best-effort: the decision is persisted first, and a failed push,
// Telegram or Discord ping is logged, never thrown.

import { postDiscord } from './discord.ts';
import { sendPushToUser } from './pushDelivery.ts';
import type { PushLocale, PushPayload } from './pushMessages.ts';
import { getMessengerContact, messengerDisplayName, sendMessengerMessage } from './sendpulse.ts';
import { callTelegramApi, sendTelegramMessage } from './telegram.ts';
import { formatCallTime } from './videoCall.ts';

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

// 'no_show' only applies to 'call' requests: back to none, so they can book again.
export type LoanAccessDecision = 'approved' | 'rejected' | 'no_show';

export const SITE_URL = (Deno.env.get('VITE_SITE_URL') ?? Deno.env.get('SITE_URL') ?? 'https://app.moodeng.credit').replace(/\/$/, '');
// Opens the loan-request flow straight away (RequestBoard reads ?applyLoan=1).
export const APPLY_URL = `${SITE_URL}/request-board?applyLoan=1`;
// Where admins actually talk to the borrower: the Moodeng Credit Page inbox (SendPulse mirrors it).
const PAGE_INBOX_URL = 'https://business.facebook.com/latest/inbox/messenger?asset_id=1148756028310286';

// Telegram callback_data for the admin buttons: "la:<a|r|n>:<request uuid>".
export const LOAN_ACCESS_CALLBACK_PREFIX = 'la:';
const DECISION_CODE: Record<LoanAccessDecision, string> = { approved: 'a', rejected: 'r', no_show: 'n' };
const CODE_DECISION: Record<string, LoanAccessDecision> = { a: 'approved', r: 'rejected', n: 'no_show' };
export const buildDecisionCallback = (decision: LoanAccessDecision, requestId: string) =>
   `${LOAN_ACCESS_CALLBACK_PREFIX}${DECISION_CODE[decision]}:${requestId}`;
export const parseDecisionCallback = (data?: string | null): { decision: LoanAccessDecision; requestId: string } | null => {
   const match = (data ?? '').match(/^la:([arn]):([0-9a-f-]{36})$/i);
   if (!match) return null;
   return { decision: CODE_DECISION[match[1].toLowerCase()], requestId: match[2] };
};

// The admin buttons for a request: attendance for a 'call' request, approve/reject otherwise.
export const decisionKeyboard = (request: { id: string; kind?: string | null }) =>
   request.kind === 'call'
      ? [
           [
              { text: '✅ Showed up', callback_data: buildDecisionCallback('approved', request.id) },
              { text: '❌ No-show', callback_data: buildDecisionCallback('no_show', request.id) }
           ],
           [{ text: '🚫 Reject', callback_data: buildDecisionCallback('rejected', request.id) }]
        ]
      : [
           [
              { text: '✅ Approve', callback_data: buildDecisionCallback('approved', request.id) },
              { text: '❌ Reject', callback_data: buildDecisionCallback('rejected', request.id) }
           ]
        ];

// Admin approval cards go to the admins-only KYC channel (same place KYC alerts land), falling back
// to the private team channel. Never the lender or support group.
export const getAdminChatId = async (svc: SupabaseClient): Promise<string | null> => {
   const { data } = await svc
      .from('telegram_bot_settings')
      .select('key, value')
      .in('key', ['kyc_alert_chat_id', 'team_group_chat_id']);
   const byKey = new Map<string, string>((data ?? []).map((row: { key: string; value: string }) => [row.key, row.value]));
   return byKey.get('kyc_alert_chat_id') || Deno.env.get('TEAM_TELEGRAM_CHAT_ID') || byKey.get('team_group_chat_id') || null;
};

export type RequestRow = {
   id: string;
   user_id: string;
   kind?: string | null;
   display_name: string | null;
   reason: string | null;
   referral_code: string | null;
   channel: string;
   status: string;
   created_at: string;
};

export type BorrowerRow = {
   id: string;
   username: string | null;
   email: string | null;
   display_name: string | null;
   chat_id: string | number | null;
   notif_account_activity: boolean | null;
   is_didit: string | null;
   didit_id_status: string | null;
   messenger_psid: string | null;
   messenger_verified_at: string | null;
   whatsapp_verified_at: string | null;
   loan_access_status: string | null;
   video_call_starts_at?: string | null;
   video_call_confirmed_at?: string | null;
};

export const BORROWER_COLUMNS =
   'id, username, email, display_name, chat_id, notif_account_activity, is_didit, didit_id_status, messenger_psid, messenger_verified_at, whatsapp_verified_at, loan_access_status, video_call_starts_at, video_call_confirmed_at';
export const REQUEST_COLUMNS = 'id, user_id, kind, display_name, reason, referral_code, channel, status, created_at';

export const shortId = (id: string) => id.slice(0, 8);

export const who = (u: Pick<BorrowerRow, 'display_name' | 'username' | 'email' | 'id'>, fallbackName?: string | null) =>
   [fallbackName || u.display_name, u.username ? `@${u.username}` : null, u.email].filter(Boolean).join(' · ') || u.id;

// ---- Admin ping (on submit) -------------------------------------------------------------------

export const notifyAdminsOfRequest = async (svc: SupabaseClient, request: RequestRow, borrower: BorrowerRow) => {
   const kyc = borrower.is_didit ?? borrower.didit_id_status ?? 'unknown';
   // The Facebook profile name, straight from SendPulse — compare it with the KYC name.
   const fbName = borrower.messenger_psid ? messengerDisplayName(await getMessengerContact(borrower.messenger_psid)) : null;
   const line = borrower.messenger_verified_at
      ? `Messenger ✅${fbName ? ` — Facebook name: ${fbName}` : ''}`
      : borrower.whatsapp_verified_at
        ? 'WhatsApp ✅'
        : 'no verified line';
   // The bio they filled in the Connect filter — so you know their situation before the call.
   const { data: bio } = await svc
      .from('users')
      .select('profession, income_type, income_description, monthly_income, monthly_expenses, payday_type')
      .eq('id', borrower.id)
      .maybeSingle();
   const work = [bio?.profession, bio?.income_type, bio?.income_description].filter(Boolean).join(' · ');
   const money = [
      bio?.monthly_income ? `income ${bio.monthly_income}` : null,
      bio?.monthly_expenses ? `expenses ${bio.monthly_expenses}` : null,
      bio?.payday_type ? `payday ${bio.payday_type}` : null
   ]
      .filter(Boolean)
      .join(' · ');

   // Referred borrowers' calls are Emma's setup calls (local exchange: deposit, cash out, repay).
   const { data: ref } = await svc.from('users').select('redeemed_referral_code_id').eq('id', borrower.id).maybeSingle();
   const { data: refCode } = ref?.redeemed_referral_code_id
      ? await svc.from('referral_codes').select('code').eq('id', ref.redeemed_referral_code_id).maybeSingle()
      : { data: null };
   const referral = refCode?.code ?? request.referral_code ?? null;

   const isCall = request.kind === 'call';
   const lines = [
      isCall
         ? referral
            ? '📞 Referred borrower booked their setup call with Emma'
            : '📞 New borrower booked their intro call'
         : '🤝 New borrower wants to connect',
      `Who: ${who(borrower, request.display_name)}`,
      `KYC: ${kyc}`,
      `Line: ${line}`,
      work ? `Work: ${work}` : null,
      money ? `Money: ${money}` : null,
      isCall && borrower.video_call_starts_at ? `Call: ${formatCallTime(borrower.video_call_starts_at, 'Asia/Bangkok')}` : null,
      referral ? `Referral: ${referral}` : null,
      `Why: ${request.reason?.trim() || '—'}`,
      '',
      isCall
         ? `After the call, tap Showed up (they can then apply) or No-show. Or type /approve ${shortId(request.id)} · /noshow ${shortId(request.id)}`
         : `Chat with them in the Page inbox, then decide. Or type /approve ${shortId(request.id)} · /reject ${shortId(request.id)}`
   ].filter((l) => l !== null) as string[];
   const text = lines.join('\n');

   const adminChat = await getAdminChatId(svc);
   if (adminChat) {
      try {
         await sendTelegramMessage(adminChat, text, {
            inlineKeyboard: [...decisionKeyboard(request), [{ text: '💬 Open Page inbox', url: PAGE_INBOX_URL }]]
         });
      } catch (err) {
         console.error('loanAccess: admin telegram ping failed', err instanceof Error ? err.message : err);
      }
   }

   // Discord webhooks can't carry working buttons, so Discord is notify-only.
   await postDiscord(
      { content: `${lines.slice(0, -2).join('\n')}\nDecide in the Telegram admin channel.` },
      { prefer: ['DISCORD_KYC_WEBHOOK_URL'] }
   );
};

// ---- Borrower notification (on decision / expiry) ---------------------------------------------

const BORROWER_MESSAGES = {
   // Emma's "Post-meeting recap".
   approved: {
      title: "You're approved to borrow 🎉",
      body:
         'Great meeting you! Tap to apply for your loan. Please reply on Messenger with your current contact details and social media handles so the team can reach you when your loan lands in your wallet. IMPORTANT: keeping your account active requires sticking to our repayment terms — loan defaults are flagged immediately and permanently banned across all affiliated platforms.',
      url: APPLY_URL
   },
   // Emma's "Decline the loan request" script.
   rejected: {
      title: 'About your Moodeng application',
      body: "We're sorry to see you go — your application has been closed. If you have any questions or concerns, please let us know. Should you wish to pursue funding in the future, connect directly with Emma Moodeng on Facebook: facebook.com/emmamoodengcredit",
      url: `${SITE_URL}/request-board`
   },
   // Emma's "Decline the loan request" script (no-show).
   no_show: {
      title: 'We missed you on the call',
      body: "We're sorry we missed you — your application can't go ahead without the meeting. If you have any questions, please let us know. Should you wish to pursue funding, tap to book a new call, or connect directly with Emma Moodeng on Facebook: facebook.com/emmamoodengcredit",
      url: APPLY_URL
   },
   // Their call was cancelled (e.g. via Cal.com's email link) before it happened — let them rebook.
   call_cancelled: {
      title: 'Your Moodeng call was cancelled',
      body: 'No problem — tap to pick a new time for your 15-minute call. Your application continues right after it.',
      url: APPLY_URL
   },
   // Open flow: their request is already on the board, so this is just "please talk to us".
   missed_call: {
      title: 'We missed you on the call',
      body: "Your Moodeng video call didn't happen. Message us on Messenger to set a new time.",
      url: `${SITE_URL}/request-board`
   },
   expired: {
      title: 'Still want to borrow with Moodeng?',
      body: "We didn't get to finish connecting. Tap Apply for a loan to reach out again — it only takes a minute.",
      url: APPLY_URL
   }
} as const;

export const notifyBorrower = async (svc: SupabaseClient, borrower: BorrowerRow, kind: keyof typeof BORROWER_MESSAGES) => {
   const msg = BORROWER_MESSAGES[kind];
   try {
      const buildPayload = (_locale: PushLocale): PushPayload => ({
         type: 'loan_access_decision',
         title: msg.title,
         body: msg.body,
         url: msg.url,
         tag: 'loan-access',
         requireInteraction: kind === 'approved'
      });
      await sendPushToUser(svc, borrower.id, buildPayload, { urgency: 'high' });
   } catch (err) {
      console.error('loanAccess: push failed for', borrower.id, err instanceof Error ? err.message : err);
   }

   // Messenger too (lands only inside Meta's 24h window — e.g. they chatted around the call).
   const messenger = await sendMessengerMessage(borrower.messenger_psid, { text: `${msg.title}\n\n${msg.body}\n\n${msg.url}` });
   if (!messenger.ok && messenger.reason !== 'no_contact') console.log('loanAccess: messenger skipped for', borrower.id, messenger.reason);

   if (borrower.chat_id && borrower.notif_account_activity !== false) {
      try {
         await sendTelegramMessage(borrower.chat_id, `${msg.title}\n\n${msg.body}`, {
            inlineKeyboard: [[{ text: msg.url === APPLY_URL ? (kind === 'no_show' ? 'Book a new time' : 'Apply for a loan') : 'Open Moodeng', url: msg.url }]]
         });
      } catch (err) {
         console.error('loanAccess: telegram failed for', borrower.id, err instanceof Error ? err.message : err);
      }
   }
};

// ---- Decide (admin Approve / Reject) ----------------------------------------------------------

export type DecideResult =
   | { ok: true; request: RequestRow; borrower: BorrowerRow; summary: string }
   | { ok: false; summary: string };

// Resolves "/approve <arg>" arguments: a request-id prefix (from the card) or the borrower's
// @username. Only pending requests are considered.
export const findPendingRequest = async (svc: SupabaseClient, arg: string): Promise<RequestRow | null | 'ambiguous'> => {
   const clean = arg.trim().replace(/^@/, '');
   if (!clean) return null;

   const { data: pending } = await svc
      .from('loan_access_requests')
      .select(REQUEST_COLUMNS)
      .eq('status', 'pending');
   const rows = (pending ?? []) as RequestRow[];

   const byId = rows.filter((r) => r.id.toLowerCase().startsWith(clean.toLowerCase()));
   if (byId.length === 1) return byId[0];
   if (byId.length > 1) return 'ambiguous';

   const { data: user } = await svc.from('users').select('id').ilike('username', clean).maybeSingle();
   return rows.find((r) => r.user_id === user?.id) ?? null;
};

export const decideLoanAccess = async (
   svc: SupabaseClient,
   requestId: string,
   decision: LoanAccessDecision,
   decidedBy: string
): Promise<DecideResult> => {
   const now = new Date().toISOString();

   // Conditional on still-pending, so two admins tapping at once can't double-decide.
   const { data: request, error } = await svc
      .from('loan_access_requests')
      .update({ status: decision, decided_at: now, decided_by: decidedBy })
      .eq('id', requestId)
      .eq('status', 'pending')
      .select(REQUEST_COLUMNS)
      .maybeSingle();
   if (error) throw new Error(error.message);

   if (!request) {
      const { data: existing } = await svc.from('loan_access_requests').select('status, decided_by').eq('id', requestId).maybeSingle();
      return {
         ok: false,
         summary: existing
            ? `Already ${existing.status}${existing.decided_by ? ` by ${existing.decided_by}` : ''} — nothing changed.`
            : 'That request no longer exists.'
      };
   }

   // A no-show goes back to 'none' so they can book again; a call request also records attendance.
   const attendance =
      request.kind === 'call' && decision !== 'rejected'
         ? { video_call_outcome: decision === 'approved' ? 'attended' : 'no_show', video_call_outcome_at: now }
         : {};
   const { data: borrower, error: userError } = await svc
      .from('users')
      .update({
         loan_access_status: decision === 'no_show' ? 'none' : decision,
         ...(decision === 'approved' ? { loan_access_approved_at: now, loan_access_seen_at: null } : {}),
         ...attendance
      })
      .eq('id', request.user_id)
      .select(BORROWER_COLUMNS)
      .maybeSingle();
   if (userError) throw new Error(userError.message);
   if (!borrower) return { ok: false, summary: 'Borrower account not found.' };

   await notifyBorrower(svc, borrower, decision);

   const verb =
      decision === 'approved'
         ? request.kind === 'call'
            ? '✅ Showed up → approved:'
            : '✅ Approved'
         : decision === 'no_show'
           ? '❌ No-show:'
           : '🚫 Rejected';
   const summary = `${verb} ${who(borrower, request.display_name)} — by ${decidedBy}`;
   await postDiscord({ content: `🤝 Loan access ${summary}` }, { prefer: ['DISCORD_KYC_WEBHOOK_URL'] });
   return { ok: true, request, borrower, summary };
};

// ---- Telegram plumbing for the admin card -----------------------------------------------------

export const answerCallback = async (callbackQueryId: string, text: string) => {
   try {
      await callTelegramApi('answerCallbackQuery', { callback_query_id: callbackQueryId, text: text.slice(0, 190) });
   } catch (err) {
      console.error('loanAccess: answerCallbackQuery failed', err instanceof Error ? err.message : err);
   }
};

// Replace the card's buttons with the outcome so nobody taps a decided request again.
export const stampAdminCard = async (chatId: number | string, messageId: number, originalText: string, summary: string) => {
   try {
      await callTelegramApi('editMessageText', {
         chat_id: chatId,
         message_id: messageId,
         text: `${originalText}\n\n${summary}`,
         disable_web_page_preview: true
      });
   } catch (err) {
      console.error('loanAccess: editMessageText failed', err instanceof Error ? err.message : err);
   }
};
