// Best-effort Discord webhook posting for team / admin alerts (bookings, loan requests, KYC).
//
// Routing: resolveDiscordWebhook tries the caller's preferred env keys first (e.g.
// DISCORD_BOOKINGS_WEBHOOK_URL, DISCORD_KYC_WEBHOOK_URL) and then falls back to the shared
// DISCORD_TEAM_WEBHOOK_URL. That means a single secret — DISCORD_TEAM_WEBHOOK_URL — makes every
// team alert appear in one channel out of the box, while a per-feed secret can still peel any one
// of them off into its own channel later without a code change.
//
// Every send is fire-and-forget and never throws: a failed ping must not break the flow that
// triggered it (a booking, a loan request, a KYC outcome all persist first).
//
// Posts about something whose state changes later (a loan request, a KYC review, a voucher claim)
// pass `ref`: the post is sent with ?wait=true and its message id saved in admin_message_refs, so
// stampDecisionCards (adminCards.ts) can edit it to show the outcome.

// #logins is reserved for the login feed (record-session-ip posts there directly). A webhook is
// identified by its numeric id, so discord.com vs discordapp.com spellings compare equal.
const webhookId = (url: string | undefined | null): string | null =>
   url?.match(/\/webhooks\/(\d+)\//)?.[1] ?? null;

export type ResolvedDiscordWebhook = { key: string; url: string };

export const resolveDiscordWebhookWithKey = (...preferKeys: string[]): ResolvedDiscordWebhook | null => {
   const loginId = webhookId(Deno.env.get('DISCORD_LOGIN_WEBHOOK_URL'));
   for (const key of [...preferKeys, 'DISCORD_TEAM_WEBHOOK_URL']) {
      const val = Deno.env.get(key)?.trim();
      if (!val) continue;
      // Never let a team alert land in #logins, even if a secret was pasted with the wrong URL.
      if (loginId && webhookId(val) === loginId) continue;
      return { key, url: val };
   }
   return null;
};

export const resolveDiscordWebhook = (...preferKeys: string[]): string | null =>
   resolveDiscordWebhookWithKey(...preferKeys)?.url ?? null;

export type DiscordEmbed = {
   title?: string;
   description?: string;
   url?: string;
   color?: number;
   fields?: Array<{ name: string; value: string; inline?: boolean }>;
   timestamp?: string;
};

export type DiscordPayload = { content?: string; embeds?: DiscordEmbed[] };

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

// Where to remember a post: same kind / ref ids as the Telegram admin cards (adminCards.ts).
export type DiscordRef = { svc: SupabaseClient; kind: string; refId: string };

// `<webhook>/messages/<id>` and/or `?wait=true`, keeping any query the secret carries (thread_id).
export const discordWebhookUrl = (webhookUrl: string, opts: { messageId?: string; wait?: boolean } = {}) => {
   const url = new URL(webhookUrl);
   if (opts.messageId) url.pathname = `${url.pathname.replace(/\/$/, '')}/messages/${opts.messageId}`;
   if (opts.wait) url.searchParams.set('wait', 'true');
   return url.toString();
};

// Alerts often quote user-typed text (a borrower's reason, a name). Never let that text ping
// anyone — "@everyone" in a loan reason must stay inert.
const NO_MENTIONS = { allowed_mentions: { parse: [] as string[] } };

export const postDiscord = async (payload: DiscordPayload, opts: { prefer?: string[]; ref?: DiscordRef } = {}): Promise<boolean> => {
   const hook = resolveDiscordWebhookWithKey(...(opts.prefer ?? []));
   if (!hook) return false;
   try {
      const res = await fetch(opts.ref ? discordWebhookUrl(hook.url, { wait: true }) : hook.url, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ ...payload, ...NO_MENTIONS })
      });
      if (!res.ok) {
         console.error(`[discord] webhook responded ${res.status}`);
         return false;
      }
      if (opts.ref) await rememberDiscordMessage(opts.ref, hook.key, payload, res);
      return true;
   } catch (err) {
      console.error('[discord] webhook post failed:', err instanceof Error ? err.message : err);
      return false;
   }
};

const rememberDiscordMessage = async (ref: DiscordRef, webhookKey: string, payload: DiscordPayload, res: Response) => {
   try {
      const message = (await res.json().catch(() => null)) as { id?: string } | null;
      if (!message?.id) {
         console.error('[discord] wait=true returned no message id — not remembered', ref.kind, ref.refId);
         return;
      }
      // Only the env key name is stored; the webhook URL (a secret) is resolved again when editing.
      const { error } = await ref.svc.from('admin_message_refs').insert({
         kind: ref.kind,
         ref_id: ref.refId,
         channel: 'discord',
         webhook_key: webhookKey,
         message_id: String(message.id),
         original_text: payload.content ?? null,
         original_payload: payload
      });
      if (error) console.error('[discord] remembering message failed', ref.kind, ref.refId, error.message);
   } catch (err) {
      console.error('[discord] remembering message failed', err instanceof Error ? err.message : err);
   }
};

/** Replace a remembered webhook message (PATCH /messages/<id>). Never throws. */
export const editDiscordMessage = async (webhookKey: string, messageId: string, payload: DiscordPayload): Promise<boolean> => {
   const url = Deno.env.get(webhookKey)?.trim();
   if (!url) {
      console.error('[discord] edit skipped: webhook env missing', webhookKey);
      return false;
   }
   try {
      const res = await fetch(discordWebhookUrl(url, { messageId }), {
         method: 'PATCH',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ content: payload.content ?? null, embeds: payload.embeds ?? [], ...NO_MENTIONS })
      });
      if (!res.ok) console.error(`[discord] edit responded ${res.status}`);
      return res.ok;
   } catch (err) {
      console.error('[discord] edit failed:', err instanceof Error ? err.message : err);
      return false;
   }
};

// ---- After-state rendering -------------------------------------------------------------------

export const DISCORD_CONTENT_LIMIT = 2000;
const TITLE_LIMIT = 256;
const FIELD_VALUE_LIMIT = 1024;

const cut = (text: string, limit: number) => (text.length <= limit ? text : `${text.slice(0, limit - 1)}…`);

// Embed colour for a header, from its leading emoji: good news green, needs attention orange,
// bad red, closed / neutral grey.
export const stampColor = (header: string): number => {
   const h = header.trim();
   if (/^(✅|💸|💰|💵)/u.test(h)) return 0x57f287;
   if (/^(⚠|🔎|⏳)/u.test(h)) return 0xf39c12;
   if (/^(❌|🚫|🗑|⛔)/u.test(h)) return 0xe74c3c;
   if (/^(↩|⌛|ℹ)/u.test(h)) return 0x95a5a6;
   return 0x5865f2;
};

export type DiscordStamp = { header: string; detail?: string | null; footer: string };

/**
 * The edited message, always rendered from the ORIGINAL payload plus the latest stamp — so a loan
 * that goes funded → overdue → repaid shows one header, never a stack of them.
 * Embeds: the first embed's title gets the header as a prefix, its colour follows the header, and a
 * "Status" field carries "Decided by … · time" (the detail goes in a "Details" field).
 * Plain content: header (and detail) in bold on top, the footer line at the bottom, within 2000 chars.
 */
export const renderDiscordStamped = (original: DiscordPayload, stamp: DiscordStamp): DiscordPayload => {
   const header = stamp.header.trim();
   const detail = stamp.detail?.trim() || null;
   if (original.embeds?.length) {
      const [first, ...rest] = original.embeds;
      const fields = [...(first.fields ?? [])];
      if (detail) fields.push({ name: 'Details', value: cut(detail, FIELD_VALUE_LIMIT) });
      fields.push({ name: 'Status', value: cut(stamp.footer, FIELD_VALUE_LIMIT) });
      return {
         ...(original.content ? { content: original.content } : {}),
         embeds: [
            {
               ...first,
               title: cut(first.title ? `${header} · ${first.title}` : header, TITLE_LIMIT),
               color: stampColor(header),
               fields: fields.slice(-25)
            },
            ...rest
         ]
      };
   }
   const head = `**${[header, detail].filter(Boolean).join('\n')}**`;
   const foot = `_${stamp.footer}_`;
   const room = DISCORD_CONTENT_LIMIT - head.length - foot.length - 4;
   const body = room > 0 ? cut((original.content ?? '').trim(), room) : '';
   return { content: cut([head, body, foot].filter(Boolean).join('\n\n'), DISCORD_CONTENT_LIMIT) };
};

// ---- Mirroring a Telegram post -----------------------------------------------------------------

type MirrorButton = { text: string; url?: string; callback_data?: string; copy_text?: { text: string } };

/**
 * A Telegram message + its inline keyboard as Discord markdown: one line per button row, link
 * buttons as [label](<url>) (angle brackets stop link previews), copy buttons as the text itself,
 * callback buttons (✅ Send code …) left out — those only work in Telegram.
 */
export const telegramToDiscordContent = (text: string, keyboard: MirrorButton[][] = []) => {
   const rows = keyboard
      .map((row) =>
         row
            .map((button) => {
               if (button.url) return `[${button.text}](<${button.url}>)`;
               if (button.copy_text) return `📋 “${button.copy_text.text}”`;
               return null;
            })
            .filter(Boolean)
            .join(' · ')
      )
      .filter(Boolean);
   return rows.length ? `${text}\n\n${rows.join('\n')}` : text;
};

/** Split into ≤2000-character messages at line breaks (a single over-long line is cut). */
export const splitDiscordContent = (content: string, limit = DISCORD_CONTENT_LIMIT): string[] => {
   const chunks: string[] = [];
   let current = '';
   for (const line of content.split('\n')) {
      const piece = line.length > limit ? cut(line, limit) : line;
      if (current && current.length + 1 + piece.length > limit) {
         chunks.push(current);
         current = piece;
      } else {
         current = current ? `${current}\n${piece}` : piece;
      }
   }
   if (current) chunks.push(current);
   return chunks;
};

/** Post a Telegram message (and keyboard) to a Discord webhook. Never throws. */
export const mirrorToDiscord = async (webhookUrl: string | null | undefined, text: string, keyboard?: MirrorButton[][]): Promise<boolean> => {
   if (!webhookUrl) return false;
   try {
      for (const content of splitDiscordContent(telegramToDiscordContent(text, keyboard))) {
         const res = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // flags 4 = no link previews.
            body: JSON.stringify({ content, flags: 4, ...NO_MENTIONS })
         });
         if (!res.ok) {
            console.error(`[discord] mirror responded ${res.status}`);
            return false;
         }
      }
      return true;
   } catch (err) {
      console.error('[discord] mirror failed', err instanceof Error ? err.message : err);
      return false;
   }
};
