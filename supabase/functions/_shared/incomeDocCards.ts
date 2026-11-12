// The buttons under a proof-of-income result that waits for the team (Telegram KYC group):
//
//    👀 Check                 opens Admin → Risk → Income docs (files, checks, score, AI note)
//    ✅ Approve / ❌ Reject    callback "pi:<a|d>:<document uuid>" → swaps in a confirm row (nothing
//                             saved yet), "pi:<ya|yd>" saves it, "pi:b" goes back
//
// The save goes through decide_income_document_from_card() — the same path as the admin panel's
// Approve / Decline: the decision lands on the row and kyc-cross-check tells the borrower (push,
// Messenger, Telegram). A document that was already decided (admin panel, another tap, or approved
// automatically) is left alone and the card says who decided it.
//
// Kept apart from incomeDocs.ts so telegram-webhook doesn't load the PDF reader.
import { type CardStamp, linkRows, stampCard } from './adminCards.ts';
import { callTelegramApi, sendTelegramMessage, type TelegramInlineKeyboard } from './telegram.ts';

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

export const INCOME_DOCS_ADMIN_URL = 'https://moodeng.app/admin/income-docs';

export type IncomeDocStep = 'approve' | 'decline' | 'yes_approve' | 'yes_decline' | 'back';
const CODES: Record<IncomeDocStep, string> = { approve: 'a', decline: 'd', yes_approve: 'ya', yes_decline: 'yd', back: 'b' };

// Telegram callback_data, ≤64 bytes: "pi:ya:" + a 36-character uuid = 42.
export const buildIncomeDocCallback = (step: IncomeDocStep, docId: string) => `pi:${CODES[step]}:${docId}`;
export const parseIncomeDocCallback = (data?: string | null): { step: IncomeDocStep; docId: string } | null => {
   const match = (data ?? '').match(/^pi:(a|d|ya|yd|b):([0-9a-f-]{36})$/i);
   if (!match) return null;
   const step = (Object.keys(CODES) as IncomeDocStep[]).find((k) => CODES[k] === match[1].toLowerCase());
   return step ? { step, docId: match[2].toLowerCase() } : null;
};

const checkRow = () => [{ text: '👀 Check', url: INCOME_DOCS_ADMIN_URL }];

export const incomeDocDecisionRow = (docId: string) => [
   { text: '✅ Approve', callback_data: buildIncomeDocCallback('approve', docId) },
   { text: '❌ Reject', callback_data: buildIncomeDocCallback('decline', docId) }
];

export const incomeDocConfirmRows = (docId: string, decision: 'approve' | 'decline'): TelegramInlineKeyboard => [
   [
      decision === 'approve'
         ? { text: '✅ Yes, approve it', callback_data: buildIncomeDocCallback('yes_approve', docId) }
         : { text: '❌ Yes, reject it', callback_data: buildIncomeDocCallback('yes_decline', docId) }
   ],
   [{ text: '◀ Back', callback_data: buildIncomeDocCallback('back', docId) }]
];

/** What goes under a result that waits for the team. */
export const incomeDocKeyboard = (docId: string): TelegramInlineKeyboard => [checkRow(), incomeDocDecisionRow(docId)];

type CardDecision = { state: 'decided' | 'already' | 'not_found'; decision?: string | null; by?: string | null };

/** The card's after-state for each way a "Yes" tap can end. Pure. */
export const incomeDocStamp = (result: CardDecision, tapped: 'approved' | 'declined', by: string): CardStamp => {
   if (result.state === 'decided') {
      return tapped === 'approved'
         ? { header: '✅ APPROVED — they were told their proof of income is verified', by }
         : { header: '❌ REJECTED — they were told to send a different document', by };
   }
   if (result.state === 'already') {
      const how = result.decision === 'approved' ? 'approved' : result.decision === 'declined' ? 'rejected' : 'decided';
      return { header: `ℹ️ Already decided — ${how} by ${result.by?.trim() || 'the team'}`, detail: 'Nothing changed. To change it, use Check.', by, verb: 'Tapped by' };
   }
   return { header: 'ℹ️ This document is no longer there', detail: 'Nothing changed.', by, verb: 'Tapped by' };
};

type CardQuery = {
   id: string;
   data?: string;
   from?: { id?: number; username?: string; first_name?: string; last_name?: string };
   message?: { chat: { id: number | string }; message_id: number; text?: string; reply_markup?: { inline_keyboard?: TelegramInlineKeyboard } };
};

/** A tap on a proof-of-income card. True when the button was ours (handled or refused). */
export const handleIncomeDocCallback = async (svc: SupabaseClient, query: CardQuery, adminChatIds: string[]): Promise<boolean> => {
   const parsed = parseIncomeDocCallback(query.data);
   if (!parsed) return false;
   const answer = (text: string) => callTelegramApi('answerCallbackQuery', { callback_query_id: query.id, text: text.slice(0, 190) }).catch(() => undefined);
   const card = query.message;
   if (!card || !adminChatIds.includes(String(card.chat.id))) {
      await answer('Not allowed here.');
      return true;
   }
   const links = linkRows(card.reply_markup?.inline_keyboard);
   const setButtons = (rows: TelegramInlineKeyboard) =>
      callTelegramApi('editMessageReplyMarkup', { chat_id: card.chat.id, message_id: card.message_id, reply_markup: { inline_keyboard: rows } }).catch((err) =>
         console.error('income doc card: buttons failed', err instanceof Error ? err.message : err)
      );
   const { step, docId } = parsed;

   // First tap (and ◀ Back) only swaps the buttons — nothing is saved until "Yes".
   if (step === 'approve' || step === 'decline' || step === 'back') {
      await Promise.all([
         answer(step === 'approve' ? 'Tap ✅ Yes to approve — they get a message.' : step === 'decline' ? 'Tap ❌ Yes to reject — they get a message.' : ''),
         setButtons([...links, ...(step === 'back' ? [incomeDocDecisionRow(docId)] : incomeDocConfirmRows(docId, step))])
      ]);
      return true;
   }

   const decision = step === 'yes_approve' ? 'approved' : 'declined';
   const by = query.from?.username
      ? `@${query.from.username}`
      : [query.from?.first_name, query.from?.last_name].filter(Boolean).join(' ') || String(query.from?.id ?? 'admin');
   // 'busy' is the shared "still saving" button (telegram-webhook answers it).
   await Promise.all([answer('⏳ Saving…'), setButtons([[{ text: '⏳ Saving…', callback_data: 'busy' }]])]);

   const { data, error } = await svc.rpc('decide_income_document_from_card', { p_id: docId, p_decision: decision, p_by: by });
   const result = (data ?? null) as CardDecision | null;
   if (error || !result?.state) {
      console.error('income doc card: decide failed', error?.message ?? 'no result');
      // Nothing was saved: put the buttons back and say so under the card.
      await setButtons([...links, incomeDocDecisionRow(docId)]);
      await sendTelegramMessage(card.chat.id, `⚠️ That didn’t save — tap again. (${(error?.message ?? 'no answer').slice(0, 120)})`, {
         replyToMessageId: card.message_id
      }).catch(() => undefined);
      return true;
   }
   await stampCard(card.chat.id, card.message_id, card.text ?? '', links, incomeDocStamp(result, decision, by));
   return true;
};
