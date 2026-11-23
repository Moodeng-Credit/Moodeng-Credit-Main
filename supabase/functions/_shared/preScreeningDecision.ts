// Pre-screening: the team's ✅ Good fit / ❌ Not a fit (migration 20261118030000). The buttons sit on
// the "🎥 Pre-screening" card (preScreening.ts preScreeningDecisionRow); taps arrive in telegram-webhook
// (ps:<step>:<id>). Admin → Pre-screening decides through decide_pre_screening → kyc-cross-check
// {"prescreen_decided": id}. Either way applyPreScreeningDecision does the rest:
//   ❌ not_fit + an account → the real reject (rejectUser: message, call cancelled, cards stamped).
//   No account yet → nothing now; claim_pre_screening → notifyPreScreeningClaimed runs this again.
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { type CardStamp, linkRows, stampCard } from './adminCards.ts';
import { rejectUser } from './loanAccess.ts';
import { sendPushToUser } from './pushDelivery.ts';
import { sendMessengerMessage } from './sendpulse.ts';
import { NOT_FIT_REASONS, preScreeningConfirmRows, preScreeningDecisionRows } from './preScreening.ts';
import { BOOK_CALL_URL, goodFitMessengerText, sendBookCallWhatsApp } from './bookCallLink.ts';
import { callTelegramApi, sendTelegramMessage, type TelegramInlineKeyboard } from './telegram.ts';

type Decision = 'good' | 'not_fit';
type TgUser = { id?: number; username?: string; first_name?: string; last_name?: string };
type CardQuery = {
   id: string;
   data?: string;
   from?: TgUser;
   message?: {
      chat: { id: number | string };
      message_id: number;
      text?: string;
      reply_markup?: { inline_keyboard?: TelegramInlineKeyboard };
      // On the "confirm the reason" message: the pre-screening card it answers.
      reply_to_message?: { message_id: number; text?: string; reply_markup?: { inline_keyboard?: TelegramInlineKeyboard } };
   };
};
type ReplyMessage = {
   message_id: number;
   chat: { id: number | string };
   text?: string;
   from?: TgUser;
   reply_to_message?: { message_id: number; text?: string; from?: { is_bot?: boolean } };
};

const UUID = /^[0-9a-f-]{36}$/i;
const nameOf = (from?: TgUser) =>
   from?.username ? `@${from.username}` : [from?.first_name, from?.last_name].filter(Boolean).join(' ') || 'the team';

/**
 * ps:<good|no|no_yes|back>:<id>, or ps:nr:<reason>:<id> (❌ with a reason; no_yes = older cards).
 * ❌ → ✍️ Other: ps:type (asks for the reason in a reply), then ps:oc (confirm) / ps:ox (cancel)
 * on the "confirm" message.
 */
export const parsePreScreeningCallback = (data: string | undefined) => {
   const withReason = /^ps:nr:([a-z]+):([0-9a-f-]{36})$/i.exec(data ?? '');
   if (withReason) {
      return NOT_FIT_REASONS[withReason[1]] ? { step: 'no_yes' as const, id: withReason[2], reason: NOT_FIT_REASONS[withReason[1]] } : null;
   }
   const m = /^ps:(good|no|no_yes|back|type|oc|ox):([0-9a-f-]{36})$/i.exec(data ?? '');
   return m
      ? { step: m[1] as 'good' | 'no' | 'no_yes' | 'back' | 'type' | 'oc' | 'ox', id: m[2], reason: null as string | null }
      : null;
};

// The typed-reason prompt and the confirm message carry what they belong to in their own text. Pure.
const REASON_TAG = (id: string, cardMsg: number) => `(not-fit ${id} · card ${cardMsg})`;
export const parseReasonPrompt = (text: string | undefined) => {
   const m = /\(not-fit ([0-9a-f-]{36}) · card (\d+)\)/i.exec(text ?? '');
   return m ? { id: m[1], cardMsg: Number(m[2]) } : null;
};
const REASON_MAX = 200; // decide_pre_screening keeps 200 too
export const confirmText = (name: string, reason: string) =>
   `❌ Not a fit: ${name}\nReason: ${reason}\n\nConfirm? This turns them down and sends the rejection message.`;
/** The reason back out of confirmText. Pure. */
export const reasonFromConfirm = (text: string | undefined) => {
   const m = /\nReason: ([\s\S]*?)\n\nConfirm\?/.exec(text ?? '');
   const reason = m?.[1]?.trim();
   return reason ? reason.slice(0, REASON_MAX) : null;
};

/** Acts on a saved decision. Safe to run again: a reject that already ran is skipped. */
export async function applyPreScreeningDecision(
   svc: SupabaseClient,
   id: string,
   opts: { strikeReason?: 'income_costs' } = {}
): Promise<{ ok: boolean; summary: string }> {
   if (!UUID.test(id)) return { ok: false, summary: 'bad id' };
   const { data } = await svc
      .from('pre_screenings')
      .select('id, name, user_id, team_decision, team_decided_by, team_rejected_at')
      .eq('id', id)
      .maybeSingle();
   const row = data as { user_id: string | null; team_decision: Decision | null; team_decided_by: string | null; team_rejected_at: string | null } | null;
   if (!row?.team_decision) return { ok: false, summary: 'no decision' };
   if (row.team_decision === 'good') {
      if (!row.user_id) return { ok: true, summary: 'Marked good fit — shows on their call card when they sign up.' };
      const told = await tellGoodFit(svc, row.user_id);
      return { ok: true, summary: `Marked good fit. ${told}` };
   }
   if (!row.user_id) return { ok: true, summary: 'Not a fit — no account yet; they’ll be turned down if they sign up.' };
   if (row.team_rejected_at) return { ok: true, summary: 'Already turned down.' };
   const result = await rejectUser(svc, row.user_id, `${row.team_decided_by ?? 'team'} (pre-screening)`, opts);
   // Stamped even when nothing changed (e.g. already approved): don't keep retrying on every run.
   await svc.from('pre_screenings').update({ team_rejected_at: new Date().toISOString() }).eq('id', id);
   return result;
}

// ✅ for someone on the pre-screening path (signed up, Facebook connected, waiting): tell them to book
// their call, with the direct link (bookCallLink.ts). Messenger (their 24h window is usually
// open: they just connected) + WhatsApp when they have it + a push + a text. Never throws.
async function tellGoodFit(svc: SupabaseClient, userId: string): Promise<string> {
   const { data } = await svc
      .from('users')
      .select('messenger_psid, prescreen_path, display_name, username, whatsapp_contact_id, whatsapp_number, whatsapp_verified_at')
      .eq('id', userId)
      .maybeSingle();
   const u = data as {
      messenger_psid?: string | null;
      prescreen_path?: boolean;
      display_name?: string | null;
      username?: string | null;
      whatsapp_contact_id?: string | null;
      whatsapp_number?: string | null;
      whatsapp_verified_at?: string | null;
   } | null;
   if (!u?.prescreen_path) return 'Shows on their call card.';
   const [msg, wa, push, sms] = await Promise.all([
      sendMessengerMessage(u.messenger_psid, { text: goodFitMessengerText() }).catch(() => ({ ok: false })),
      sendBookCallWhatsApp(u, 'good_fit'),
      sendPushToUser(svc, userId, () => ({
         type: 'loan_access_decision',
         title: 'Good news! 🎉',
         body: 'The team looked at your answers. Book your 15-min call.',
         url: BOOK_CALL_URL,
         tag: 'prescreen-good'
      })).catch(() => null),
      // A text too: Messenger can't reach them after 24h; a text can (migration 20261118150000).
      svc.rpc('prescreen_good_sms', { p_user: userId }).then(
         ({ data }) => (typeof data === 'string' ? data : 'failed'),
         () => 'failed'
      )
   ]);
   const pushed = Boolean(push && (push as { sent?: number }).sent);
   const texted = sms === 'sent' || sms === 'unconfirmed';
   const ways = [msg.ok ? 'Messenger' : null, wa ? 'WhatsApp' : null, pushed ? 'push' : null, texted ? 'text' : null].filter(Boolean);
   const smsNote = sms === 'rejected_network' ? ' (no text: Smart/TNT/Sun number)' : sms === 'no_number' ? ' (no number to text)' : '';
   return ways.length
      ? `They were told to keep going (${ways.join(' + ')})${smsNote}.`
      : `⚠️ Could not reach them${smsNote} — they see it next time they open the app.`;
}

// "Good fit" is only the pre-screen: it never lets them borrow, so the stamp says so (2026-11-23: a
// Good fit was taken for an approval and the borrower waited for a loan that couldn't come).
const STAMP: Record<Decision, string> = { good: '✅ GOOD FIT (pre-screen) · not approved to borrow yet', not_fit: '❌ NOT A FIT' };

/** Telegram taps on the card. ❌ asks once more first (it can reject an account). */
export const handlePreScreeningCallback = async (svc: SupabaseClient, query: CardQuery, adminChatIds: string[]): Promise<boolean> => {
   const parsed = parsePreScreeningCallback(query.data);
   if (!parsed) return false;
   const answer = (text: string) =>
      callTelegramApi('answerCallbackQuery', { callback_query_id: query.id, text: text.slice(0, 190) }).catch(() => undefined);
   const card = query.message;
   if (!card || !adminChatIds.includes(String(card.chat.id))) {
      await answer('Not allowed here.');
      return true;
   }
   const links = linkRows(card.reply_markup?.inline_keyboard);
   const setButtons = (rows: TelegramInlineKeyboard) =>
      callTelegramApi('editMessageReplyMarkup', {
         chat_id: card.chat.id,
         message_id: card.message_id,
         reply_markup: { inline_keyboard: [...rows, ...links] }
      }).catch((err) => console.error('pre-screening card: buttons failed', err instanceof Error ? err.message : err));

   if (parsed.step === 'type') {
      const { data: ps } = await svc.from('pre_screenings').select('name').eq('id', parsed.id).maybeSingle();
      const name = (ps as { name?: string } | null)?.name ?? 'them';
      await Promise.all([
         answer('Type the reason in the reply box 👇'),
         setButtons(preScreeningDecisionRows(parsed.id)),
         callTelegramApi('sendMessage', {
            chat_id: card.chat.id,
            text: `✍️ ${nameOf(query.from)}: why is ${name} not a fit? Reply with the reason. You confirm before anything happens.\n${REASON_TAG(parsed.id, card.message_id)}`,
            reply_parameters: { message_id: card.message_id, allow_sending_without_reply: true },
            reply_markup: { force_reply: true, input_field_placeholder: 'Why not a fit…' }
         }).catch((err) => console.error('pre-screening: reason prompt failed', err instanceof Error ? err.message : err))
      ]);
      return true;
   }

   if (parsed.step === 'ox') {
      await Promise.all([
         answer('Cancelled — nothing changed.'),
         callTelegramApi('editMessageText', {
            chat_id: card.chat.id,
            message_id: card.message_id,
            text: `${card.text ?? ''}\n\n✖️ Cancelled by ${nameOf(query.from)} — nothing changed.`,
            reply_markup: { inline_keyboard: [] }
         }).catch(() => undefined)
      ]);
      return true;
   }

   if (parsed.step === 'oc') {
      const reason = reasonFromConfirm(card.text);
      if (!reason) {
         await answer('Couldn’t read the reason — tap ❌ Not a fit on the card again.');
         return true;
      }
      const by = nameOf(query.from);
      const decided = await decide(svc, parsed.id, 'not_fit', by, reason);
      if (!decided) {
         await answer('Couldn’t find that pre-screening.');
         return true;
      }
      const orig = card.reply_to_message;
      const stamp: CardStamp = { header: `${STAMP.not_fit} — ${reason}`, detail: decided.summary, by };
      await Promise.all([
         answer(decided.summary),
         orig?.text ? stampCard(card.chat.id, orig.message_id, orig.text, linkRows(orig.reply_markup?.inline_keyboard), stamp) : null,
         callTelegramApi('editMessageText', {
            chat_id: card.chat.id,
            message_id: card.message_id,
            text: `❌ Not a fit — ${reason}\n${decided.summary}\n— by ${by}`,
            reply_markup: { inline_keyboard: [] }
         }).catch(() => undefined)
      ]);
      return true;
   }

   if (parsed.step === 'no' || parsed.step === 'back') {
      await Promise.all([
         answer(parsed.step === 'no' ? 'Why? Tap a reason — that confirms it. If they have an account, it is turned down.' : ''),
         setButtons(parsed.step === 'no' ? preScreeningConfirmRows(parsed.id) : preScreeningDecisionRows(parsed.id))
      ]);
      return true;
   }

   const decision: Decision = parsed.step === 'good' ? 'good' : 'not_fit';
   const by = nameOf(query.from);
   const result = await decide(svc, parsed.id, decision, by, parsed.reason);
   if (!result) {
      await answer('Couldn’t find that pre-screening.');
      return true;
   }
   const stamp: CardStamp = { header: `${STAMP[decision]}${parsed.reason ? ` — ${parsed.reason}` : ''}`, detail: result.summary, by };
   await Promise.all([answer(result.summary), stampCard(card.chat.id, card.message_id, card.text ?? '', links, stamp)]);
   return true;
};

/** Saves the team's decision and acts on it. Null when there's no such (finished) pre-screening. */
async function decide(
   svc: SupabaseClient,
   id: string,
   decision: Decision,
   by: string,
   reason: string | null,
   opts: { strikeReason?: 'income_costs' } = {}
) {
   const { data: saved } = await svc
      .from('pre_screenings')
      .update({
         team_decision: decision,
         team_decided_by: by,
         team_decided_at: new Date().toISOString(),
         team_reason: decision === 'not_fit' ? reason : null
      })
      .eq('id', id)
      .neq('status', 'open')
      .select('id')
      .maybeSingle();
   return saved ? applyPreScreeningDecision(svc, id, opts) : null;
}

/** A reply to "✍️ why is X not a fit?": shows the reason back with ✅ Confirm / ↩️ Cancel. True when it was one. */
export const handlePreScreeningReasonReply = async (svc: SupabaseClient, message: ReplyMessage, adminChatIds: string[]): Promise<boolean> => {
   const prompt = message.reply_to_message;
   if (!prompt?.from?.is_bot) return false;
   const ref = parseReasonPrompt(prompt.text);
   if (!ref) return false;
   if (!adminChatIds.includes(String(message.chat.id))) return true;
   const reason = (message.text ?? '').trim().replace(/\s*\n\s*/g, ' ').slice(0, REASON_MAX);
   if (!reason || reason.startsWith('/')) {
      await sendTelegramMessage(message.chat.id, 'Reply with the reason as plain text.', { replyToMessageId: message.message_id }).catch(
         () => undefined
      );
      return true;
   }
   const { data: ps } = await svc.from('pre_screenings').select('name').eq('id', ref.id).maybeSingle();
   const name = (ps as { name?: string } | null)?.name ?? 'them';
   await sendTelegramMessage(message.chat.id, confirmText(name, reason), {
      replyToMessageId: ref.cardMsg,
      inlineKeyboard: [
         [
            { text: '✅ Yes, not a fit', callback_data: `ps:oc:${ref.id}` },
            { text: '↩️ Cancel', callback_data: `ps:ox:${ref.id}` }
         ]
      ]
   }).catch((err) => console.error('pre-screening: confirm failed', err instanceof Error ? err.message : err));
   // The prompt has done its job; gone so nobody replies to it twice.
   await callTelegramApi('deleteMessage', { chat_id: message.chat.id, message_id: prompt.message_id }).catch(() => undefined);
   return true;
};

/**
 * High medical costs still to come (vs their income) and no team decision 2 hours after grading:
 * declined automatically with the income message (George, 2026-11-21). The card gets a reply saying so;
 * the Reject card's buttons (for good / for now / approve after all) still let the team undo it.
 */
export async function autoDeclineForCosts(
   svc: SupabaseClient,
   row: { id: string; name: string; team_card: { chat: number | string; msg: number } | null },
   why: string
): Promise<{ ok: boolean; summary: string }> {
   const result = await decide(svc, row.id, 'not_fit', 'auto (2h, no team decision)', `Costs too high for income — ${why}`.slice(0, 200), {
      strikeReason: 'income_costs'
   });
   if (!result) return { ok: false, summary: 'not found' };
   if (row.team_card) {
      await callTelegramApi('sendMessage', {
         chat_id: row.team_card.chat,
         reply_to_message_id: row.team_card.msg,
         text: `❌ Auto-declined (no decision in 2 hours): ${row.name}
Costs still to come are too high for their income — ${why}
${result.summary}
They were told it's because their costs are high compared with their income (no mention of health).`
      }).catch(() => undefined);
   }
   return result;
}
