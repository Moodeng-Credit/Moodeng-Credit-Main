// The buttons under a proof-of-income result that waits for the team (Telegram KYC group):
//
//    👀 Open this document    opens Admin → Income docs on this one send (?doc=<id>: files, checks, score, AI note)
//    ✅ Approve / ❌ Reject    callback "pi:<a|d>:<document uuid>" → swaps in a confirm row (nothing
//                             saved yet), "pi:<ya|yd>" saves it, "pi:b" goes back
//
// The save goes through decide_income_document_from_card() — the same path as the admin panel's
// Approve / Decline: the decision lands on the row and kyc-cross-check tells the borrower (push,
// Messenger, Telegram). A document that was already decided (admin panel, another tap, or approved
// automatically) is left alone and the card says who decided it.
//
// The same buttons go on the Discord post when the bot is set up (see the Discord section below).
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

/** What goes under a result that waits for the team. */
export const incomeDocKeyboard = (docId: string, decide = true): TelegramInlineKeyboard =>
   decide ? [checkRow(docId), incomeDocDecisionRow(docId)] : [checkRow(docId)];

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

export const buildIncomeDocDiscordId = (step: IncomeDocStep, docId: string) => `incdoc:${CODES[step]}:${docId}`;
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
export const handleIncomeDocDiscordClick = async (svc: SupabaseClient, body: DiscordInteraction): Promise<Record<string, unknown> | null> => {
   const parsed = parseIncomeDocDiscordId(body.data?.custom_id);
   if (!parsed) return null;
   const { step, docId } = parsed;
   const update = (data: Record<string, unknown>) => ({ type: 7, data });
   if (step === 'approve' || step === 'decline') return update({ components: incomeDocDiscordRows(docId, step) });
   if (step === 'back') return update({ components: incomeDocDiscordRows(docId, 'decide') });

   const who = body.member?.nick || body.member?.user?.global_name || body.member?.user?.username || body.user?.global_name || body.user?.username || 'Discord';
   const by = `${who} (Discord)`;
   const decision = step === 'yes_approve' ? 'approved' : 'declined';
   const { data, error } = await svc.rpc('decide_income_document_from_card', { p_id: docId, p_decision: decision, p_by: by });
   const result = (data ?? null) as CardDecision | null;
   if (error || !result?.state) {
      console.error('income doc discord: decide failed', error?.message ?? 'no result');
      // Ephemeral: only the clicker sees it; the card keeps its buttons.
      return { type: 4, data: { content: `⚠️ That didn’t save — click again. (${(error?.message ?? 'no answer').slice(0, 120)})`, flags: 64 } };
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
