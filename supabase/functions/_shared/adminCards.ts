// Admin Telegram cards with a clear before and after state.
//
// Before: the card as posted — what happened, the decision buttons, and link buttons (Page inbox,
// 👤 Open in admin, Didit console…).
// After: as soon as anyone decides — a card button, a /command, the admin panel, or an automatic
// event (Zoom auto no-show, a Didit verdict, the bot confirming a Messenger code) — EVERY card about
// that decision is edited to:
//
//    ✅ APPROVED — Irish can now apply for a loan      ← what it means for the person
//    <optional detail line(s)>
//
//    <the original card text>
//
//    Decided by @george · Oct 11, 3:04 PM Bangkok
//
// with the decision buttons gone and the link buttons kept.
//
// Where each card lives is saved in admin_message_refs (migration 20261011130000 — channel-agnostic,
// so Discord messages can use it next) when it's posted, keyed by what decides it:
//    loan_access  ref = user id   request cards (la:) + call-start / "Did they show up?" cards (la: / vc:)
//    voucher      ref = claim id  food voucher claim cards (vo:)
//    messenger    ref = user id   stuck-Facebook + "Is this them?" cards (mv:)
//    kyc_review   ref = user id   Didit "in manual review" cards — stamped by the Didit verdict
//    kyc_tries    ref = user id   "out of KYC tries" cards (kr:)
//    referral_payout ref = payout id  "code owner is owed money" cards (rp:)
// stampDecisionCards claims the refs with one DELETE … RETURNING, so two paths deciding at once
// (e.g. a card tap and the voucher trigger) edit each card only once.
//
// Everything here is best-effort: a failed edit or a missing table is logged, never thrown — the
// decision itself has already been saved.
import { type DiscordPayload, editDiscordMessage, renderDiscordStamped } from './discord.ts';
import { callTelegramApi, sendTelegramMessage, type TelegramInlineKeyboard } from './telegram.ts';

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

//    loan         ref = loan id   (Discord) new request / funded / unknown-sender + needs-refund alerts —
//                                 multi-step: funded → overdue → repaid, stamped by state-events-dispatch
export type AdminCardKind = 'loan_access' | 'voucher' | 'messenger' | 'kyc_review' | 'kyc_tries' | 'loan' | 'referral_payout';

export type CardLink = { text: string; url: string };

// The after-state of a card. `by` and `at` make the footer ("Decided by @george · …", or another
// `verb` such as "Tapped by" for an already-decided tap); `detail` goes under the header.
// `buttons` (Telegram only) stay on the decided card above its links — e.g. ✅ Approve anyway on a
// no-show, for a borrower who turns up late and gets a separate call.
export type CardStamp = {
   header: string;
   detail?: string | null;
   by?: string | null;
   at?: Date;
   verb?: string;
   buttons?: TelegramInlineKeyboard;
};

// Telegram rejects a message (and an edit) longer than this, counted in UTF-16 code units — the
// same as a JS string's length.
export const TELEGRAM_TEXT_LIMIT = 4096;

// Cut to `limit` without splitting an emoji's surrogate pair, marking the cut with "…".
export const truncateForTelegram = (text: string, limit = TELEGRAM_TEXT_LIMIT): string => {
   if (text.length <= limit) return text;
   if (limit <= 1) return '…'.slice(0, Math.max(0, limit));
   let cut = limit - 1;
   const code = text.charCodeAt(cut - 1);
   if (code >= 0xd800 && code <= 0xdbff) cut -= 1; // Don't leave half an emoji at the end.
   return `${text.slice(0, cut)}…`;
};

export const formatDecidedAt = (at: Date) =>
   `${at.toLocaleString('en-US', { timeZone: 'Asia/Bangkok', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} Bangkok`;

// The edited card text. Header and footer always survive; a long original is cut instead, so the
// whole thing stays under Telegram's limit.
export const renderDecidedCard = (originalText: string, stamp: CardStamp, limit = TELEGRAM_TEXT_LIMIT): string => {
   const head = truncateForTelegram([stamp.header, stamp.detail?.trim() || null].filter(Boolean).join('\n'), Math.floor(limit / 2));
   const foot = `${stamp.verb ?? 'Decided by'} ${stamp.by?.trim() || 'the team'} · ${formatDecidedAt(stamp.at ?? new Date())}`;
   const room = limit - head.length - foot.length - 4; // two blank-line separators
   const body = room > 0 ? truncateForTelegram(originalText.trim(), room) : '';
   return [head, body, foot].filter(Boolean).join('\n\n');
};

// "Already decided" for a tap that changed nothing — reads as information, not an error.
// "Already approved by @george — nothing changed." → "ℹ️ Already decided — approved by @george"
export const alreadyDecidedHeader = (summary: string): string => {
   const clean = summary
      .replace(/\s*(?:—|-)\s*nothing (?:was )?changed\.?\s*$/i, '')
      .replace(/\.?\s*nothing to do\.?\s*$/i, '')
      .trim();
   const rest = clean.match(/^already\s+(.+)$/i)?.[1] ?? clean;
   return `ℹ️ Already decided — ${rest}`;
};

// Only the link buttons of a keyboard (row structure kept, empty rows dropped) — what stays on a
// decided card.
export const linkRows = (keyboard: TelegramInlineKeyboard | null | undefined): CardLink[][] =>
   (keyboard ?? [])
      .map((row) => row.filter((b): b is CardLink => 'url' in b && typeof b.url === 'string').map((b) => ({ text: b.text, url: b.url })))
      .filter((row) => row.length > 0);

// Same env order as loanAccess.ts SITE_URL (kept separate: loanAccess imports this file).
const siteUrl = () =>
   (Deno.env.get('VITE_SITE_URL') ?? Deno.env.get('MOODENG_APP_URL') ?? Deno.env.get('SITE_URL') ?? 'https://moodeng.app').replace(
      /\/$/,
      ''
   );

// The person in the admin Directory: ?user= selects and scrolls to them, ?q= filters the list to
// their username so they're on it however old the account (src/app/admin/page.tsx).
export const adminUserUrl = (userId: string, username?: string | null) => {
   const params = new URLSearchParams();
   if (username) params.set('q', username);
   params.set('user', userId);
   return `${siteUrl()}/admin?${params.toString()}`;
};

export const OPEN_IN_ADMIN_TEXT = '👤 Open in admin';

export const openInAdminButton = (userId: string, username?: string | null): CardLink => ({
   text: OPEN_IN_ADMIN_TEXT,
   url: adminUserUrl(userId, username)
});

// ✅ Approve anyway, for a no-show card: they turned up late / apologised and the team met them on a
// separate call. Same callback as the call card's ✅ Showed up ("vc:a:<user id>", parsed by
// videoCallOutcome.parseOutcomeCallback) but without a call key, so it still works after a rebook.
// recordCallOutcome turns the no-show into "showed up", approves them and sends the approval message.
export const approveAnywayButtons = (userId: string): TelegramInlineKeyboard => [
   [{ text: '✅ Approve anyway (met them later)', callback_data: `vc:a:${userId}` }]
];

// Adds the 👤 Open in admin link to a set of link rows unless one is already there.
export const withAdminLink = (rows: CardLink[][], userId: string | null | undefined, username?: string | null): CardLink[][] =>
   !userId || rows.some((row) => row.some((b) => b.text === OPEN_IN_ADMIN_TEXT)) ? rows : [...rows, [openInAdminButton(userId, username)]];

// ---- Before: post + remember -----------------------------------------------------------------

// Save where a card was posted (admin_message_refs, channel 'telegram'). `sent` is sendMessage's
// result (the Telegram Message). The link buttons to keep on the decided card go in original_payload.
export const rememberAdminCard = async (
   svc: SupabaseClient,
   card: { kind: AdminCardKind; refId: string; text: string; keyboard?: TelegramInlineKeyboard },
   sent: unknown
) => {
   const message = sent as { message_id?: number; chat?: { id?: number | string } } | null;
   if (!message?.message_id || message.chat?.id === undefined) {
      console.error('adminCards: sendMessage returned no message id — card not remembered', card.kind, card.refId);
      return;
   }
   const { error } = await svc.from('admin_message_refs').insert({
      kind: card.kind,
      ref_id: card.refId,
      channel: 'telegram',
      chat_id: String(message.chat.id),
      message_id: String(message.message_id),
      original_text: card.text,
      original_payload: { links: linkRows(card.keyboard) }
   });
   if (error) console.error('adminCards: remembering card failed', card.kind, card.refId, error.message);
};

// Post an admin card and remember it, so a decision made anywhere can stamp it later. Throws only
// if the send itself fails (callers already treat the send as best-effort).
export const sendAdminCard = async (
   svc: SupabaseClient,
   chatId: number | string,
   card: { kind: AdminCardKind; refId: string; text: string; keyboard?: TelegramInlineKeyboard }
) => {
   const text = truncateForTelegram(card.text);
   const sent = await sendTelegramMessage(chatId, text, card.keyboard ? { inlineKeyboard: card.keyboard } : {});
   await rememberAdminCard(svc, { ...card, text }, sent);
   return sent;
};

// ---- After: stamp ----------------------------------------------------------------------------

// Edit one Telegram card into its after-state: the stamp on top, the original text, links kept.
export const stampCard = async (
   chatId: number | string,
   messageId: number,
   originalText: string,
   links: CardLink[][],
   stamp: CardStamp
) => {
   const keyboard: TelegramInlineKeyboard = [...(stamp.buttons ?? []), ...links];
   try {
      await callTelegramApi('editMessageText', {
         chat_id: chatId,
         message_id: messageId,
         text: renderDecidedCard(originalText, stamp),
         disable_web_page_preview: true,
         // Without reply_markup Telegram drops the keyboard; with only links, the decision buttons go.
         ...(keyboard.length ? { reply_markup: { inline_keyboard: keyboard } } : {})
      });
      return true;
   } catch (err) {
      console.error('adminCards: editMessageText failed', err instanceof Error ? err.message : err);
      return false;
   }
};

export type MessageRef = {
   channel: 'telegram' | 'discord';
   chat_id: string | null;
   webhook_key: string | null;
   message_id: string;
   original_text: string | null;
   // Telegram: { links }. Discord: the posted payload ({ content?, embeds? }).
   original_payload: ({ links?: CardLink[][] } & DiscordPayload) | null;
};

const linksOf = (ref: Pick<MessageRef, 'original_payload'>) => ref.original_payload?.links ?? [];

export const stampFooter = (stamp: CardStamp) =>
   `${stamp.verb ?? 'Decided by'} ${stamp.by?.trim() || 'the team'} · ${formatDecidedAt(stamp.at ?? new Date())}`;

// One remembered message → its after-state, per channel. Always rendered from the original, so
// re-stamping a multi-step message replaces its header instead of stacking another one.
const stampRef = async (ref: MessageRef, stamp: CardStamp) => {
   if (ref.channel === 'telegram') {
      if (!ref.chat_id) return false;
      return await stampCard(ref.chat_id, Number(ref.message_id), ref.original_text ?? '', linksOf(ref), stamp);
   }
   if (!ref.webhook_key) return false;
   const original: DiscordPayload = ref.original_payload?.embeds?.length
      ? { content: ref.original_payload.content, embeds: ref.original_payload.embeds }
      : { content: ref.original_payload?.content ?? ref.original_text ?? '' };
   return await editDiscordMessage(
      ref.webhook_key,
      ref.message_id,
      renderDiscordStamped(original, { header: stamp.header, detail: stamp.detail, footer: stampFooter(stamp) })
   );
};

/**
 * Stamp every remembered message for this decision (e.g. all of a borrower's request and call cards)
 * with its after-state: `header` on top, then `detail` (extra lines, who decided, when). Call it from
 * the decision itself, so every path — Telegram, the admin panel, automatic — updates the cards.
 * The refs are claimed by deleting them, so a card is only ever stamped once. Returns how many
 * messages were stamped.
 *
 * `final: false` (multi-step kinds, e.g. a loan that is funded, then overdue, then repaid) edits the
 * messages but KEEPS the refs, so the next state can re-stamp them; the edit is re-rendered from the
 * original each time. Only the terminal state (final, the default) claims and deletes them.
 */
export const stampDecisionCards = async (
   svc: SupabaseClient,
   kind: AdminCardKind,
   refId: string,
   header: string | CardStamp,
   detail: Omit<CardStamp, 'header'> & { final?: boolean } = {}
): Promise<number> => {
   const { final = true, ...rest } = detail;
   const stamp: CardStamp = typeof header === 'string' ? { ...rest, header } : { ...header, ...rest };
   try {
      const at = stamp.at ?? new Date();
      const columns = 'channel, chat_id, webhook_key, message_id, original_text, original_payload';
      const query = svc.from('admin_message_refs');
      const { data, error } = final
         ? await query.delete().eq('kind', kind).eq('ref_id', refId).select(columns)
         : await query.select(columns).eq('kind', kind).eq('ref_id', refId);
      if (error) {
         console.error('adminCards: claiming cards failed', kind, refId, error.message);
         return 0;
      }
      const refs = (data ?? []) as MessageRef[];
      await Promise.all(refs.map((ref) => stampRef(ref, { ...stamp, at })));
      return refs.length;
   } catch (err) {
      console.error('adminCards: stampDecisionCards failed', kind, refId, err instanceof Error ? err.message : err);
      return 0;
   }
};

// The tapped card's ref, if it was posted after admin_message_refs existed and isn't stamped yet.
// telegram-webhook reads it BEFORE deciding: a remembered card is stamped by the decision itself,
// an older card from the message in the tap.
export const findAdminCard = async (
   svc: SupabaseClient,
   chatId: number | string,
   messageId: number
): Promise<{ text: string; links: CardLink[][] } | null> => {
   try {
      const { data, error } = await svc
         .from('admin_message_refs')
         .select('original_text, original_payload')
         .eq('channel', 'telegram')
         .eq('chat_id', String(chatId))
         .eq('message_id', String(messageId))
         .limit(1)
         .maybeSingle();
      if (error || !data) return null;
      const ref = data as Pick<MessageRef, 'original_text' | 'original_payload'>;
      return { text: ref.original_text ?? '', links: linksOf(ref) };
   } catch {
      return null;
   }
};

// Claim one card (telegram-webhook stamps it itself). False means another path already stamped it.
export const claimCard = async (svc: SupabaseClient, chatId: number | string, messageId: number): Promise<boolean> => {
   try {
      const { data, error } = await svc
         .from('admin_message_refs')
         .delete()
         .eq('channel', 'telegram')
         .eq('chat_id', String(chatId))
         .eq('message_id', String(messageId))
         .select('id');
      if (error) return true; // Table missing / unreadable: stamp anyway.
      return Boolean(data?.length);
   } catch {
      return true;
   }
};

// A short name for headers: "Irish", else "@irish", else "They".
export const personName = (u: { display_name?: string | null; username?: string | null } | null | undefined, fallback?: string | null) =>
   fallback?.trim() || u?.display_name?.trim() || (u?.username ? `@${u.username}` : '') || 'They';
