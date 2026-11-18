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
import { preScreeningConfirmRows, preScreeningDecisionRow } from './preScreening.ts';
import { callTelegramApi, type TelegramInlineKeyboard } from './telegram.ts';

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
   };
};

const UUID = /^[0-9a-f-]{36}$/i;
const nameOf = (from?: TgUser) =>
   from?.username ? `@${from.username}` : [from?.first_name, from?.last_name].filter(Boolean).join(' ') || 'the team';

/** ps:<good|no|no_yes|back>:<id> */
export const parsePreScreeningCallback = (data: string | undefined) => {
   const m = /^ps:(good|no|no_yes|back):([0-9a-f-]{36})$/i.exec(data ?? '');
   return m ? { step: m[1] as 'good' | 'no' | 'no_yes' | 'back', id: m[2] } : null;
};

/** Acts on a saved decision. Safe to run again: a reject that already ran is skipped. */
export async function applyPreScreeningDecision(svc: SupabaseClient, id: string): Promise<{ ok: boolean; summary: string }> {
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
   const result = await rejectUser(svc, row.user_id, `${row.team_decided_by ?? 'team'} (pre-screening)`);
   // Stamped even when nothing changed (e.g. already approved): don't keep retrying on every run.
   await svc.from('pre_screenings').update({ team_rejected_at: new Date().toISOString() }).eq('id', id);
   return result;
}

// ✅ for someone on the pre-screening path (signed up, Facebook connected, waiting): tell them to keep
// going. Messenger (their 24h window is usually open: they just connected) + a push. Never throws.
const GOOD_FIT_TEXT =
   '🎉 Good news! The Moodeng team looked at your answers. You can keep going: open moodeng.app to set up your wallet and book your 15-min call.\n\n' +
   '🎉 Magandang balita! Pwede ka nang tumuloy: buksan ang moodeng.app para i-set up ang wallet mo at mag-book ng 15-min call.';
async function tellGoodFit(svc: SupabaseClient, userId: string): Promise<string> {
   const { data } = await svc.from('users').select('messenger_psid, prescreen_path').eq('id', userId).maybeSingle();
   const u = data as { messenger_psid?: string | null; prescreen_path?: boolean } | null;
   if (!u?.prescreen_path) return 'Shows on their call card.';
   const [msg, push] = await Promise.all([
      sendMessengerMessage(u.messenger_psid, { text: GOOD_FIT_TEXT }).catch(() => ({ ok: false })),
      sendPushToUser(svc, userId, () => ({
         type: 'loan_access_decision',
         title: 'Good news! 🎉',
         body: 'The team looked at your answers. Set up your wallet and book your call.',
         url: 'https://moodeng.app/onboarding/connect',
         tag: 'prescreen-good'
      })).catch(() => null)
   ]);
   const pushed = Boolean(push && (push as { sent?: number }).sent);
   return msg.ok || pushed ? `They were told to keep going (${[msg.ok ? 'Messenger' : null, pushed ? 'push' : null].filter(Boolean).join(' + ')}).` : '⚠️ Could not message them — they see it next time they open the app.';
}

const STAMP: Record<Decision, string> = { good: '✅ GOOD FIT', not_fit: '❌ NOT A FIT' };

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

   if (parsed.step === 'no' || parsed.step === 'back') {
      await Promise.all([
         answer(parsed.step === 'no' ? 'Tap ❌ Yes, not a fit to confirm. If they have an account, it is turned down.' : ''),
         setButtons(parsed.step === 'no' ? preScreeningConfirmRows(parsed.id) : [preScreeningDecisionRow(parsed.id)])
      ]);
      return true;
   }

   const decision: Decision = parsed.step === 'good' ? 'good' : 'not_fit';
   const by = nameOf(query.from);
   const { data: saved } = await svc
      .from('pre_screenings')
      .update({ team_decision: decision, team_decided_by: by, team_decided_at: new Date().toISOString() })
      .eq('id', parsed.id)
      .neq('status', 'open')
      .select('id')
      .maybeSingle();
   if (!saved) {
      await answer('Couldn’t find that pre-screening.');
      return true;
   }
   const result = await applyPreScreeningDecision(svc, parsed.id);
   const stamp: CardStamp = { header: STAMP[decision], detail: result.summary, by };
   await Promise.all([answer(result.summary), stampCard(card.chat.id, card.message_id, card.text ?? '', links, stamp)]);
   return true;
};
