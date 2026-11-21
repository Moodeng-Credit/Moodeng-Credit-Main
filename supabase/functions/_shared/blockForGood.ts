// 🚫 Block for good — one tap for a cheater coming back on a new account (George 2026-11-21: same
// person, 4th account, new Gmail + new Facebook, same WhatsApp number).
//
// The button sits under the admin-chat notes that say an account is linked to a bad one:
//   preScreeningAsk   "🚩 71/100, but not auto-approved — red flag: linked to 3 bad accounts…"
//   linkedSweep       "⚠️ New account @x is linked to 3 bad accounts…"
// A tap ghosts the account (quiet reject, nothing sent, bot off — same as /ghost), closes their
// open pre-screening as ❌ without the rejection message, and stamps the card. Future accounts on
// the same verified WhatsApp number are rejected (and ghosted) by the DB trigger
// users_reject_when_whatsapp_rejected (migration 20261121190000). Undo: /unghost + /reopen.
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { linkRows, stampCard } from './adminCards.ts';
import { ghostUser } from './loanAccess.ts';
import { callTelegramApi, type TelegramInlineKeyboard } from './telegram.ts';

export const BLOCK_REASON = 'Blocked for good — same person as a rejected account';

/** The button row. Pure. */
export const blockRows = (userId: string): TelegramInlineKeyboard => [[{ text: '🚫 Block for good', callback_data: `bk:${userId}` }]];

/** bk:<user id>. Pure. */
export const parseBlockCallback = (data: string | undefined) => {
   const m = /^bk:([0-9a-f-]{36})$/i.exec(data ?? '');
   return m ? { userId: m[1] } : null;
};

/** True when one of the red flags is the linked-to-a-bad-account one (linkedRedFlag). Pure. */
export const hasLinkedFlag = (flags: string[]) => flags.some((f) => f.startsWith('linked to '));

type TgUser = { username?: string; first_name?: string; last_name?: string };
type BlockQuery = {
   id: string;
   data?: string;
   from?: TgUser;
   message?: {
      chat: { id: number | string };
      message_id: number;
      text?: string;
      reply_markup?: { inline_keyboard?: TelegramInlineKeyboard };
      reply_to_message?: { message_id: number; text?: string; reply_markup?: { inline_keyboard?: TelegramInlineKeyboard } };
   };
};

const nameOf = (from?: TgUser) =>
   from?.username ? `@${from.username}` : [from?.first_name, from?.last_name].filter(Boolean).join(' ') || 'the team';

/** Ghost + close open pre-screenings quietly. Returns what happened and whether a pre-screening was closed. */
export async function blockForGood(svc: SupabaseClient, userId: string, by: string) {
   const ghost = await ghostUser(svc, userId, by);
   if (!ghost.ok) return { ok: false, summary: ghost.summary, closedPreScreening: false };
   const now = new Date().toISOString();
   // team_rejected_at set too, so a later ❌ on the card doesn't send the rejection message.
   const { data: closed } = await svc
      .from('pre_screenings')
      .update({ team_decision: 'not_fit', team_reason: BLOCK_REASON, team_decided_by: by, team_decided_at: now, team_rejected_at: now })
      .eq('user_id', userId)
      .is('team_decision', null)
      .select('id');
   return { ok: true, summary: ghost.summary, closedPreScreening: (closed ?? []).length > 0 };
}

/** Telegram tap on 🚫 Block for good. Admin chats only. */
export const handleBlockCallback = async (svc: SupabaseClient, query: BlockQuery, adminChatIds: string[]): Promise<boolean> => {
   const parsed = parseBlockCallback(query.data);
   if (!parsed) return false;
   const answer = (text: string) =>
      callTelegramApi('answerCallbackQuery', { callback_query_id: query.id, text: text.slice(0, 190) }).catch(() => undefined);
   const msg = query.message;
   if (!msg || !adminChatIds.includes(String(msg.chat.id))) {
      await answer('Not allowed here.');
      return true;
   }
   const by = nameOf(query.from);
   let result: Awaited<ReturnType<typeof blockForGood>>;
   try {
      result = await blockForGood(svc, parsed.userId, by);
   } catch (err) {
      console.error('block for good failed', err instanceof Error ? err.message : err);
      await answer('⚠️ Block failed — try /ghost instead.');
      return true;
   }
   if (!result.ok) {
      await answer(result.summary);
      return true;
   }
   const card = msg.reply_to_message;
   await Promise.all([
      answer('🚫 Blocked for good — nothing was sent to them.'),
      callTelegramApi('editMessageText', {
         chat_id: msg.chat.id,
         message_id: msg.message_id,
         text: `${msg.text ?? ''}\n\n🚫 Blocked for good by ${by}. New accounts on the same WhatsApp number are rejected on their own.\n${result.summary}`.slice(0, 4000),
         disable_web_page_preview: true,
         reply_markup: { inline_keyboard: linkRows(msg.reply_markup?.inline_keyboard) }
      }).catch((err) => console.error('block for good: edit note failed', err instanceof Error ? err.message : err)),
      // The pre-screening card this note replies to: its ✅/❌ go, so nobody approves them by mistake.
      result.closedPreScreening && card?.text
         ? stampCard(msg.chat.id, card.message_id, card.text, linkRows(card.reply_markup?.inline_keyboard), {
              header: '🚫 BLOCKED FOR GOOD — same person as a rejected account',
              detail: 'Rejected quietly, nothing sent to them.',
              by
           })
         : null
   ]);
   return true;
};
