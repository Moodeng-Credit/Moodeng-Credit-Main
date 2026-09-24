// Connect → Approve → Apply: the shared pieces used by the loan-access edge function (submit +
// expiry) and telegram-webhook (admin Approve/Reject). See docs/HANDOFF_BORROWER_VERIFICATION.md §13.
//
// State lives in two places, always written together by the service role:
//   users.loan_access_status        none | pending | approved | rejected   (the gate the app reads)
//   loan_access_requests.status     pending | approved | rejected | expired (one row per reach-out)
//
// Every notification here is best-effort: the decision is persisted first, and a failed push,
// Telegram or Discord ping is logged, never thrown.

import { postDiscord } from './discord.ts';
import { sendPushToUser } from './pushDelivery.ts';
import type { PushLocale, PushPayload } from './pushMessages.ts';
import { callTelegramApi, sendTelegramMessage } from './telegram.ts';

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

export type LoanAccessDecision = 'approved' | 'rejected';

export const SITE_URL = (Deno.env.get('VITE_SITE_URL') ?? Deno.env.get('SITE_URL') ?? 'https://app.moodeng.credit').replace(/\/$/, '');
// Opens the loan-request flow straight away (RequestBoard reads ?applyLoan=1).
export const APPLY_URL = `${SITE_URL}/request-board?applyLoan=1`;
// Where admins actually talk to the borrower: the Moodeng Credit Page inbox (SendPulse mirrors it).
const PAGE_INBOX_URL = 'https://business.facebook.com/latest/inbox/messenger?asset_id=1148756028310286';

// Telegram callback_data for the admin buttons: "la:a:<request uuid>" / "la:r:<request uuid>".
export const LOAN_ACCESS_CALLBACK_PREFIX = 'la:';
export const buildDecisionCallback = (decision: LoanAccessDecision, requestId: string) =>
   `${LOAN_ACCESS_CALLBACK_PREFIX}${decision === 'approved' ? 'a' : 'r'}:${requestId}`;
export const parseDecisionCallback = (data?: string | null): { decision: LoanAccessDecision; requestId: string } | null => {
   const match = (data ?? '').match(/^la:([ar]):([0-9a-f-]{36})$/i);
   if (!match) return null;
   return { decision: match[1].toLowerCase() === 'a' ? 'approved' : 'rejected', requestId: match[2] };
};

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

type RequestRow = {
   id: string;
   user_id: string;
   display_name: string | null;
   reason: string | null;
   referral_code: string | null;
   channel: string;
   status: string;
   created_at: string;
};

type BorrowerRow = {
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
};

export const BORROWER_COLUMNS =
   'id, username, email, display_name, chat_id, notif_account_activity, is_didit, didit_id_status, messenger_psid, messenger_verified_at, whatsapp_verified_at, loan_access_status';

export const shortId = (id: string) => id.slice(0, 8);

const who = (u: Pick<BorrowerRow, 'display_name' | 'username' | 'email' | 'id'>, fallbackName?: string | null) =>
   [fallbackName || u.display_name, u.username ? `@${u.username}` : null, u.email].filter(Boolean).join(' · ') || u.id;

// ---- Admin ping (on submit) -------------------------------------------------------------------

export const notifyAdminsOfRequest = async (svc: SupabaseClient, request: RequestRow, borrower: BorrowerRow) => {
   const kyc = borrower.is_didit ?? borrower.didit_id_status ?? 'unknown';
   const line = borrower.messenger_verified_at
      ? `Messenger ✅ (SendPulse contact ${borrower.messenger_psid ?? '?'})`
      : borrower.whatsapp_verified_at
        ? 'WhatsApp ✅'
        : 'no verified line';
   const lines = [
      '🤝 New borrower wants to connect',
      `Who: ${who(borrower, request.display_name)}`,
      `KYC: ${kyc}`,
      `Line: ${line}`,
      request.referral_code ? `Referral: ${request.referral_code}` : null,
      `Why: ${request.reason?.trim() || '—'}`,
      '',
      `Chat with them in the Page inbox, then decide. Or type /approve ${shortId(request.id)} · /reject ${shortId(request.id)}`
   ].filter((l) => l !== null) as string[];
   const text = lines.join('\n');

   const adminChat = await getAdminChatId(svc);
   if (adminChat) {
      try {
         await sendTelegramMessage(adminChat, text, {
            inlineKeyboard: [
               [
                  { text: '✅ Approve', callback_data: buildDecisionCallback('approved', request.id) },
                  { text: '❌ Reject', callback_data: buildDecisionCallback('rejected', request.id) }
               ],
               [{ text: '💬 Open Page inbox', url: PAGE_INBOX_URL }]
            ]
         });
      } catch (err) {
         console.error('loanAccess: admin telegram ping failed', err instanceof Error ? err.message : err);
      }
   }

   // Discord webhooks can't carry working buttons, so Discord is notify-only.
   await postDiscord(
      { content: `${text.replace(/\n\nChat with them[\s\S]*$/, '')}\nDecide in the Telegram admin channel (buttons or /approve ${shortId(request.id)}).` },
      { prefer: ['DISCORD_KYC_WEBHOOK_URL'] }
   );
};

// ---- Borrower notification (on decision / expiry) ---------------------------------------------

const BORROWER_MESSAGES = {
   approved: {
      title: "You're approved to borrow 🎉",
      body: 'The Moodeng team approved you. Tap to apply for your loan.',
      url: APPLY_URL
   },
   rejected: {
      title: 'About your Moodeng loan access',
      body: "We can't approve loan access right now. Message us on Messenger if you'd like to talk it through.",
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

   if (borrower.chat_id && borrower.notif_account_activity !== false) {
      try {
         await sendTelegramMessage(borrower.chat_id, `${msg.title}\n\n${msg.body}`, {
            inlineKeyboard: [[{ text: kind === 'rejected' ? 'Open Moodeng' : 'Apply for a loan', url: msg.url }]]
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
      .select('id, user_id, display_name, reason, referral_code, channel, status, created_at')
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
      .select('id, user_id, display_name, reason, referral_code, channel, status, created_at')
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

   const { data: borrower, error: userError } = await svc
      .from('users')
      .update({
         loan_access_status: decision,
         ...(decision === 'approved' ? { loan_access_approved_at: now, loan_access_seen_at: null } : {})
      })
      .eq('id', request.user_id)
      .select(BORROWER_COLUMNS)
      .maybeSingle();
   if (userError) throw new Error(userError.message);
   if (!borrower) return { ok: false, summary: 'Borrower account not found.' };

   await notifyBorrower(svc, borrower, decision);

   const summary = `${decision === 'approved' ? '✅ Approved' : '❌ Rejected'} ${who(borrower, request.display_name)} — by ${decidedBy}`;
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
