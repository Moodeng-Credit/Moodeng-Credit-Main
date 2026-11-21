// The buttons under a proof-of-income result that waits for the team (Telegram KYC group):
//
//    👀 Open this document    opens Admin → Income docs on this one send (?doc=<id>: files, checks, score, AI note)
//    ✅ Approve               callback "pi:a:<document uuid>" → swaps in "✅ Yes, approve it" (nothing saved
//                             yet), "pi:ya" saves it, "pi:b" goes back
//    ❌ Reject                callback "pi:d:<uuid>" → asks what for: a reason button ("pi:r<n>") saves the
//                             reject with that reason; "✍️ Type the reason" ("pi:rt") posts a prompt — the
//                             team's reply to it is saved as the reason, word for word
//
// The save goes through decide_income_document_from_card() — the same path as the admin panel's
// Approve / Decline: the decision (and reason) lands on the row and kyc-cross-check tells the
// borrower (push, Messenger, Telegram, email), then says under the card which of those reached them.
// A document that was already decided (admin panel, another tap, or approved automatically) is left
// alone and the card says who decided it.
//
// The same buttons go on the Discord post when the bot is set up (see the Discord section below).
//
// Kept apart from incomeDocs.ts so telegram-webhook doesn't load the PDF reader.
import { type CardStamp, linkRows, stampCard } from './adminCards.ts';
import { callTelegramApi, sendTelegramMessage, type TelegramInlineKeyboard } from './telegram.ts';

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

export const INCOME_DOCS_ADMIN_URL = 'https://moodeng.app/admin/income-docs';

/**
 * Reject reasons the team picks from. `text` goes to the borrower as written (push, Messenger,
 * Telegram, email), followed by "You can send a different one any time…". Keep them short and plain.
 */
export const INCOME_REJECT_REASONS = [
   {
      label: '🖍 Parts covered',
      text: 'Parts of your document were covered. Please send it again with nothing hidden — we only check your name and your salary.'
   },
   { label: '👤 No name', text: 'We couldn’t see your name on it. Please also send a screenshot that shows your name on the account.' },
   { label: '📅 Too short', text: 'We need at least 2 months of history. Please send 2–3 months of statements, or your last 2 payslips.' },
   {
      label: '💸 No salary seen',
      text: 'We couldn’t see a regular income in it. Please send a payslip, or a statement that shows your salary coming in.'
   },
   { label: '🔍 Can’t read it', text: 'We couldn’t read it clearly. Please send a sharper photo, or the PDF from your bank app.' }
] as const;

export type IncomeDocStep = 'approve' | 'decline' | 'yes_approve' | 'yes_decline' | 'back' | 'type_reason' | `reason_${number}`;
const FIXED: Record<string, string> = { approve: 'a', decline: 'd', yes_approve: 'ya', yes_decline: 'yd', back: 'b', type_reason: 'rt' };
const codeOf = (step: IncomeDocStep) => FIXED[step] ?? `r${step.slice('reason_'.length)}`;

// Telegram callback_data, ≤64 bytes: "pi:ya:" + a 36-character uuid = 42.
export const buildIncomeDocCallback = (step: IncomeDocStep, docId: string) => `pi:${codeOf(step)}:${docId}`;
export const parseIncomeDocCallback = (data?: string | null): { step: IncomeDocStep; docId: string } | null => {
   const match = (data ?? '').match(/^pi:(a|d|ya|yd|b|rt|r\d):([0-9a-f-]{36})$/i);
   if (!match) return null;
   const code = match[1].toLowerCase();
   const fixed = Object.keys(FIXED).find((k) => FIXED[k] === code) as IncomeDocStep | undefined;
   if (fixed) return { step: fixed, docId: match[2].toLowerCase() };
   const n = Number(code.slice(1));
   return n < INCOME_REJECT_REASONS.length ? { step: `reason_${n}`, docId: match[2].toLowerCase() } : null;
};

/** Admin → Income docs opened on this one send (shown first, highlighted). */
export const incomeDocUrl = (docId: string) => `${INCOME_DOCS_ADMIN_URL}?doc=${docId}`;

const checkRow = (docId: string) => [{ text: '👀 Open this document', url: incomeDocUrl(docId) }];

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

/** "Reject — what for?": the reasons two to a row, then type-your-own, then Back. */
export const incomeDocReasonRows = (docId: string): TelegramInlineKeyboard => {
   const buttons = INCOME_REJECT_REASONS.map((r, i) => ({ text: r.label, callback_data: buildIncomeDocCallback(`reason_${i}`, docId) }));
   const rows: TelegramInlineKeyboard = [];
   for (let i = 0; i < buttons.length; i += 2) rows.push(buttons.slice(i, i + 2));
   rows.push([{ text: '✍️ Type the reason', callback_data: buildIncomeDocCallback('type_reason', docId) }]);
   rows.push([{ text: '◀ Back', callback_data: buildIncomeDocCallback('back', docId) }]);
   return rows;
};

/** What goes under a result that waits for the team. */
export const incomeDocKeyboard = (docId: string, decide = true): TelegramInlineKeyboard =>
   decide ? [checkRow(docId), incomeDocDecisionRow(docId)] : [checkRow(docId)];

type CardDecision = { state: 'decided' | 'already' | 'not_found'; decision?: string | null; by?: string | null };

/** The card's after-state for each way a save can end. Pure. */
export const incomeDocStamp = (result: CardDecision, tapped: 'approved' | 'declined', by: string, reason?: string | null): CardStamp => {
   if (result.state === 'decided') {
      return tapped === 'approved'
         ? { header: '✅ APPROVED — they get a message that their proof of income is verified', by }
         : {
              header: '❌ REJECTED — they get a message to send a different document',
              detail: reason ? `Reason sent: “${reason}”` : 'No reason given.',
              by
           };
   }
   if (result.state === 'already') {
      const how = result.decision === 'approved' ? 'approved' : result.decision === 'declined' ? 'rejected' : 'decided';
      return {
         header: `ℹ️ Already decided — ${how} by ${result.by?.trim() || 'the team'}`,
         detail: 'Nothing changed. To change it, use Check.',
         by,
         verb: 'Tapped by'
      };
   }
   return { header: 'ℹ️ This document is no longer there', detail: 'Nothing changed.', by, verb: 'Tapped by' };
};

// ---- Typed reason --------------------------------------------------------------------------------
// "✍️ Type the reason" posts a force-reply prompt under the card. The prompt ends with a ref line
// carrying the document and the card's message id (a reply only shows Telegram one level up, so the
// prompt has to say which card it is for). The team's reply to it is the reason.

const REF_RE = /ref pi ([0-9a-f-]{36}) (\d+)\s*$/i;
export const reasonPromptText = (docId: string, cardMessageId: number) =>
   `✍️ Why reject? Reply to this message with the reason — they get your words as written, then “You can send a different one any time…”.\n\nref pi ${docId} ${cardMessageId}`;
export const parseReasonPrompt = (text?: string | null): { docId: string; cardMessageId: number } | null => {
   const m = (text ?? '').match(REF_RE);
   return m ? { docId: m[1].toLowerCase(), cardMessageId: Number(m[2]) } : null;
};

type TgUser = { id?: number; username?: string; first_name?: string; last_name?: string };
const nameOf = (from?: TgUser) =>
   from?.username ? `@${from.username}` : [from?.first_name, from?.last_name].filter(Boolean).join(' ') || String(from?.id ?? 'admin');

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

/**
 * Save a decision from the card and stamp it. On a failed save the decision buttons come back and a
 * note goes under the card. The card's text is read from the card itself (callback) or, for a typed
 * reason, not available — then the stamp is posted as a reply instead of editing the card text.
 */
const saveFromCard = async (
   svc: SupabaseClient,
   chatId: number | string,
   cardMessageId: number,
   card: { text?: string; links: ReturnType<typeof linkRows> } | null,
   docId: string,
   decision: 'approved' | 'declined',
   by: string,
   reason: string | null
): Promise<boolean> => {
   const { data, error } = await svc.rpc('decide_income_document_from_card', {
      p_id: docId,
      p_decision: decision,
      p_by: by,
      p_reason: reason,
      p_card: { chat: String(chatId), message: cardMessageId }
   });
   const result = (data ?? null) as CardDecision | null;
   if (error || !result?.state) {
      console.error('income doc card: decide failed', error?.message ?? 'no result');
      await callTelegramApi('editMessageReplyMarkup', {
         chat_id: chatId,
         message_id: cardMessageId,
         reply_markup: { inline_keyboard: [...(card?.links ?? [checkRow(docId)]), incomeDocDecisionRow(docId)] }
      }).catch(() => undefined);
      await sendTelegramMessage(chatId, `⚠️ That didn’t save — tap again. (${(error?.message ?? 'no answer').slice(0, 120)})`, {
         replyToMessageId: cardMessageId
      }).catch(() => undefined);
      return false;
   }
   const stamp = incomeDocStamp(result, decision, by, reason);
   if (card?.text !== undefined) {
      await stampCard(chatId, cardMessageId, card.text, card.links, stamp);
   } else {
      // Typed reason: we don't have the card's text here, so keep it and only drop its buttons.
      await callTelegramApi('editMessageReplyMarkup', {
         chat_id: chatId,
         message_id: cardMessageId,
         reply_markup: { inline_keyboard: [checkRow(docId)] }
      }).catch(() => undefined);
      await sendTelegramMessage(chatId, [stamp.header, stamp.detail, `${stamp.verb ?? 'Decided by'} ${by}`].filter(Boolean).join('\n'), {
         replyToMessageId: cardMessageId
      }).catch(() => undefined);
   }
   return true;
};

/** A tap on a proof-of-income card. True when the button was ours (handled or refused). */
export const handleIncomeDocCallback = async (svc: SupabaseClient, query: CardQuery, adminChatIds: string[]): Promise<boolean> => {
   const parsed = parseIncomeDocCallback(query.data);
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
         reply_markup: { inline_keyboard: rows }
      }).catch((err) => console.error('income doc card: buttons failed', err instanceof Error ? err.message : err));
   const { step, docId } = parsed;

   // Approve / Back only swap the buttons; Reject asks what for. Nothing is saved yet.
   if (step === 'approve' || step === 'back') {
      await Promise.all([
         answer(step === 'approve' ? 'Tap ✅ Yes to approve — they get a message.' : ''),
         setButtons([...links, ...(step === 'back' ? [incomeDocDecisionRow(docId)] : incomeDocConfirmRows(docId, 'approve'))])
      ]);
      return true;
   }
   if (step === 'decline') {
      await Promise.all([
         answer('What for? Pick a reason or type one — they get it in the message.'),
         setButtons([...links, ...incomeDocReasonRows(docId)])
      ]);
      return true;
   }
   if (step === 'type_reason') {
      await answer('Reply to the message below with the reason.');
      await callTelegramApi('sendMessage', {
         chat_id: card.chat.id,
         text: reasonPromptText(docId, card.message_id),
         reply_parameters: { message_id: card.message_id, allow_sending_without_reply: true },
         // Not selective: that would aim the reply box at the card's sender (the bot), not the tapper.
         reply_markup: { force_reply: true, input_field_placeholder: 'Reason for the borrower…' }
      }).catch((err) => console.error('income doc card: reason prompt failed', err instanceof Error ? err.message : err));
      return true;
   }

   // A save: ✅ Yes approve, a reason button, or ❌ Yes reject on cards posted before reasons.
   const decision = step === 'yes_approve' ? 'approved' : 'declined';
   const reason = step.startsWith('reason_') ? (INCOME_REJECT_REASONS[Number(step.slice('reason_'.length))]?.text ?? null) : null;
   // 'busy' is the shared "still saving" button (telegram-webhook answers it).
   await Promise.all([answer('⏳ Saving…'), setButtons([[{ text: '⏳ Saving…', callback_data: 'busy' }]])]);
   await saveFromCard(svc, card.chat.id, card.message_id, { text: card.text ?? '', links }, docId, decision, nameOf(query.from), reason);
   return true;
};

type ReplyMessage = {
   message_id: number;
   chat: { id: number | string };
   from?: TgUser & { is_bot?: boolean };
   text?: string;
   reply_to_message?: { message_id: number; text?: string; from?: { is_bot?: boolean } };
};

/**
 * A reply to the "✍️ Why reject?" prompt in an admin chat: save the reject with that text as the
 * reason. True when the message was such a reply (handled or refused).
 */
export const handleIncomeDocReasonReply = async (svc: SupabaseClient, message: ReplyMessage, adminChatIds: string[]): Promise<boolean> => {
   const prompt = message.reply_to_message;
   if (!prompt?.from?.is_bot) return false;
   const ref = parseReasonPrompt(prompt.text);
   if (!ref) return false;
   if (!adminChatIds.includes(String(message.chat.id))) return true;
   const reason = (message.text ?? '').trim();
   if (!reason || reason.startsWith('/')) {
      await sendTelegramMessage(message.chat.id, 'Reply with the reason as plain text.', { replyToMessageId: message.message_id }).catch(
         () => undefined
      );
      return true;
   }
   const saved = await saveFromCard(
      svc,
      message.chat.id,
      ref.cardMessageId,
      null,
      ref.docId,
      'declined',
      nameOf(message.from),
      reason.slice(0, 300)
   );
   if (saved) {
      // The prompt has done its job: say so, so nobody replies to it twice.
      await callTelegramApi('editMessageText', {
         chat_id: message.chat.id,
         message_id: prompt.message_id,
         text: '✍️ Reason received.'
      }).catch(() => undefined);
   }
   return true;
};

/** Under the card, once kyc-cross-check has sent the borrower's message: where it reached them. Pure. */
export const reachLine = (sent: string[], kind: 'approved' | 'declined' | 'resend') => {
   const what = kind === 'approved' ? 'approval' : 'reject';
   if (!sent.length)
      return `⚠️ Couldn’t reach them about the ${what} — no push, Messenger, Telegram or email worked. Message them yourself.`;
   const only = sent.length === 1 && sent[0] === 'push';
   return only
      ? `⚠️ The ${what} only went out as a push notification (no Messenger, Telegram or email on file). Message them yourself if it matters.`
      : `📬 They got the ${what} by ${sent.join(', ')}.`;
};

// ---- Discord ----------------------------------------------------------------------------------
// Webhook posts can't carry working buttons, so a result that waits for the team is posted by the
// Moodeng Discord app's bot instead (the same app as the support-ticket Reply buttons). Its clicks
// arrive at discord-interactions, which calls handleIncomeDocDiscordClick below.
//
// Needs the vault secret DISCORD_BOT = {"token": "<bot token>", "channel_id": "<channel id>"}, read
// through discord_bot_secret() (service role only). Not set → the caller falls back to the webhook
// post with a link, as before.
//
// custom_id (≤100 characters): "incdoc:<a|d|ya|yd|b>:<document uuid>" — same steps as Telegram.

type DiscordButton = { type: 2; style: number; label: string; custom_id?: string; url?: string };
type DiscordRow = { type: 1; components: DiscordButton[] };
type DiscordEmbed = { title?: string; description?: string; url?: string; color?: number; footer?: { text: string } };

export const buildIncomeDocDiscordId = (step: IncomeDocStep, docId: string) => `incdoc:${codeOf(step)}:${docId}`;
export const parseIncomeDocDiscordId = (customId?: string | null) =>
   customId?.startsWith('incdoc:') ? parseIncomeDocCallback(`pi:${customId.slice('incdoc:'.length)}`) : null;

const LINK = 5;
const discordCheck = (docId: string): DiscordButton => ({ type: 2, style: LINK, label: '👀 Check', url: incomeDocUrl(docId) });

/** The rows under a Discord card at each step. Pure. */
export const incomeDocDiscordRows = (docId: string, show: 'decide' | 'approve' | 'decline' | 'done'): DiscordRow[] => {
   if (show === 'done') return [{ type: 1, components: [discordCheck(docId)] }];
   if (show === 'decide') {
      return [
         {
            type: 1,
            components: [
               discordCheck(docId),
               { type: 2, style: 3, label: '✅ Approve', custom_id: buildIncomeDocDiscordId('approve', docId) },
               { type: 2, style: 4, label: '❌ Reject', custom_id: buildIncomeDocDiscordId('decline', docId) }
            ]
         }
      ];
   }
   return [
      {
         type: 1,
         components: [
            show === 'approve'
               ? { type: 2, style: 3, label: '✅ Yes, approve it', custom_id: buildIncomeDocDiscordId('yes_approve', docId) }
               : { type: 2, style: 4, label: '❌ Yes, reject it', custom_id: buildIncomeDocDiscordId('yes_decline', docId) },
            { type: 2, style: 2, label: '◀ Back', custom_id: buildIncomeDocDiscordId('back', docId) }
         ]
      }
   ];
};

const readDiscordBot = async (svc: SupabaseClient): Promise<{ token: string; channel_id: string } | null> => {
   const { data, error } = await svc.rpc('discord_bot_secret');
   if (error) {
      console.error('income doc card: discord_bot_secret failed', error.message);
      return null;
   }
   try {
      const parsed = typeof data === 'string' && data ? JSON.parse(data) : null;
      return parsed?.token && parsed?.channel_id ? { token: String(parsed.token), channel_id: String(parsed.channel_id) } : null;
   } catch {
      console.error('income doc card: DISCORD_BOT is not JSON');
      return null;
   }
};

/** Post the card with buttons as the bot. False = no bot configured or the post failed (use the webhook). */
export const postIncomeDocDiscordCard = async (svc: SupabaseClient, docId: string, embed: DiscordEmbed): Promise<boolean> => {
   const bot = await readDiscordBot(svc);
   if (!bot) return false;
   try {
      const res = await fetch(`https://discord.com/api/v10/channels/${bot.channel_id}/messages`, {
         method: 'POST',
         headers: { Authorization: `Bot ${bot.token}`, 'Content-Type': 'application/json' },
         body: JSON.stringify({ embeds: [embed], components: incomeDocDiscordRows(docId, 'decide'), allowed_mentions: { parse: [] } })
      });
      if (!res.ok) console.error(`income doc card: Discord post ${res.status}`, (await res.text()).slice(0, 200));
      return res.ok;
   } catch (err) {
      console.error('income doc card: Discord post failed', err instanceof Error ? err.message : err);
      return false;
   }
};

type DiscordInteraction = {
   data?: { custom_id?: string };
   member?: { nick?: string | null; user?: { username?: string; global_name?: string | null } };
   user?: { username?: string; global_name?: string | null };
   message?: { embeds?: DiscordEmbed[] };
};

/**
 * A click on a Discord proof-of-income card → the interaction response (UPDATE_MESSAGE), or null
 * when the button isn't ours. Must answer within Discord's 3 seconds: the save is one RPC (the
 * borrower's message goes out afterwards through pg_net).
 */
export const handleIncomeDocDiscordClick = async (
   svc: SupabaseClient,
   body: DiscordInteraction
): Promise<Record<string, unknown> | null> => {
   const parsed = parseIncomeDocDiscordId(body.data?.custom_id);
   if (!parsed) return null;
   const { step, docId } = parsed;
   const update = (data: Record<string, unknown>) => ({ type: 7, data });
   if (step === 'approve' || step === 'decline') return update({ components: incomeDocDiscordRows(docId, step) });
   if (step === 'back') return update({ components: incomeDocDiscordRows(docId, 'decide') });

   const who =
      body.member?.nick ||
      body.member?.user?.global_name ||
      body.member?.user?.username ||
      body.user?.global_name ||
      body.user?.username ||
      'Discord';
   const by = `${who} (Discord)`;
   const decision = step === 'yes_approve' ? 'approved' : 'declined';
   const { data, error } = await svc.rpc('decide_income_document_from_card', { p_id: docId, p_decision: decision, p_by: by });
   const result = (data ?? null) as CardDecision | null;
   if (error || !result?.state) {
      console.error('income doc discord: decide failed', error?.message ?? 'no result');
      // Ephemeral: only the clicker sees it; the card keeps its buttons.
      return {
         type: 4,
         data: { content: `⚠️ That didn’t save — click again. (${(error?.message ?? 'no answer').slice(0, 120)})`, flags: 64 }
      };
   }
   const stamp = incomeDocStamp(result, decision, by);
   const original = body.message?.embeds?.[0] ?? {};
   const color = result.state !== 'decided' ? 0x95a5a6 : decision === 'approved' ? 0x2ecc71 : 0xe74c3c;
   return update({
      embeds: [
         {
            ...original,
            title: stamp.header,
            color,
            description: [stamp.detail, original.title, original.description].filter(Boolean).join('\n\n').slice(0, 4000),
            footer: { text: `${stamp.verb ?? 'Decided by'} ${by}` }
         }
      ],
      components: incomeDocDiscordRows(docId, 'done')
   });
};
