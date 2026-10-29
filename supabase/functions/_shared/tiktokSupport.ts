// TikTok DMs to @moodeng.credit as a support channel, on the same Discord ticket system as Messenger.
//
//   Person writes to @moodeng.credit
//     → SendPulse TikTok bot webhook → sendpulse-events → openTikTokTicket(): their one
//       widget_conversations row (channel 'tiktok'), posted into the Discord #web-support ticket and
//       pinged to the Telegram Messenger group.
//     → first message of a conversation: the same automatic reply as Messenger, as plain text (TikTok
//       has no cards), with the sign-up link for people who aren't users yet.
//   Team taps Reply in Discord → the same relay as Messenger → relayAgentReply() sends it on TikTok.
//
// We can't tell which Moodeng account a TikTok chat belongs to: TikTok gives each app its own id for a
// person, so the id our TikTok login stores never matches SendPulse's. The ticket only shows a "maybe"
// hint when exactly one TikTok sign-up has the same display name; the bot never shows account details.
import { adminUserUrl } from './adminCards.ts';
import { buildAutoReply, type Conversation, findOrCreateConversation, signUpUrl, toBotLocale } from './messengerSupport.ts';
import { getTikTokContact, lastOutgoingTikTokAt, sendTikTokText, TIKTOK_INBOX_URL, tiktokDisplayName } from './sendpulse.ts';
import { alertTeam, pingTeam, postToTicket } from './supportTickets.ts';
import type { TelegramInlineKeyboard } from './telegram.ts';

// deno-lint-ignore no-explicit-any
type Svc = any;

const NEW_CONVERSATION_AFTER_MS = 12 * 60 * 60 * 1000;
const RECENT_REPLY_MS = 30 * 60 * 1000;
const ATTACHMENT_NOTE = '📎 Sent a photo, video or file on TikTok — open the chat in SendPulse to see it.';

type Maybe = { id: string; username: string | null };

// Exactly one TikTok sign-up (email tiktok_<hash>@moodeng.app) with this display name, else nothing.
const findLikelyAccount = async (svc: Svc, name: string | null): Promise<Maybe | null> => {
   if (!name) return null;
   const { data } = await svc
      .from('users')
      .select('id, username')
      .like('email', 'tiktok\\_%@moodeng.app')
      .ilike(
         'display_name',
         name.replace(/[\\%_]/g, (c) => `\\${c}`)
      )
      .limit(2);
   const rows = (data ?? []) as Maybe[];
   return rows.length === 1 ? rows[0] : null;
};

export const tiktokTicketContext = (opts: { name: string | null; username: string | null; maybe: Maybe | null }) =>
   [
      `TikTok · ${opts.name ?? 'unknown name'}${opts.username ? ` (@${opts.username})` : ''}`,
      opts.maybe
         ? `maybe Moodeng account ${opts.maybe.username ? `@${opts.maybe.username}` : opts.maybe.id} (same name, not confirmed): ${adminUserUrl(opts.maybe.id, opts.maybe.username)}`
         : 'not linked to a Moodeng account (TikTok chats never are)',
      'TikTok only delivers replies within 48h of their last message, 10 messages max'
   ].join(' · ');

export const buildTikTokPing = (opts: { name: string | null; username: string | null; body: string; startsConversation: boolean }) => {
   const who = [opts.name ?? 'Someone', opts.username ? `@${opts.username}` : null].filter(Boolean).join(' ');
   const head = opts.startsConversation ? `🎵 New TikTok chat from ${who}` : `🎵 ${who} on TikTok`;
   const text = `${head}:\n> ${opts.body.slice(0, 800)}\nReply from the Discord ticket or SendPulse.`;
   const keyboard: TelegramInlineKeyboard = [[{ text: '💬 Open SendPulse chats', url: TIKTOK_INBOX_URL }]];
   return { text, keyboard };
};

// The Messenger automatic reply as one plain-text TikTok message; the sign-up card becomes a link.
export const buildTikTokAutoReply = (opts: { at: number; firstName: string | null; registered: boolean; locale: 'en' | 'fil' }) => {
   const reply = buildAutoReply({ ...opts, withImage: false });
   return reply.card ? `${reply.text}\n\n👉 ${reply.card.title}: ${signUpUrl(opts.locale, 'tiktok')}` : reply.text;
};

export const openTikTokTicket = async (svc: Svc, input: { contactId: string; text: string | null; hasAttachment: boolean; at: number }) => {
   const contact = await getTikTokContact(input.contactId);
   const name = tiktokDisplayName(contact);
   const username = contact?.channel_data?.username?.trim() || null;
   const maybe = await findLikelyAccount(svc, name);

   const found = await findOrCreateConversation(svc, input.contactId, {
      label: `${name ?? 'TikTok user'} (TikTok)`,
      context: tiktokTicketContext({ name, username, maybe }),
      channel: 'tiktok',
      pageUrl: TIKTOK_INBOX_URL
   });
   if (!found) return;
   const { conversation, created } = found as { conversation: Conversation; created: boolean };

   const lastAt = Date.parse(conversation.last_message_at ?? '');
   const startsConversation =
      created || conversation.status === 'resolved' || Number.isNaN(lastAt) || input.at - lastAt > NEW_CONVERSATION_AFTER_MS;

   const body = [input.text?.trim(), input.hasAttachment ? ATTACHMENT_NOTE : null].filter(Boolean).join('\n');
   const posted = await postToTicket(conversation, body);
   if (!posted) {
      await alertTeam(
         svc,
         `🎵 TikTok message from ${name ?? 'someone'} couldn't reach the Discord support ticket:\n> ${body.slice(0, 500)}\nAnswer in SendPulse.`,
         [[{ text: '💬 Open SendPulse chats', url: TIKTOK_INBOX_URL }]]
      );
   } else {
      const ping = buildTikTokPing({ name, username, body, startsConversation });
      await pingTeam(svc, ping.text, ping.keyboard, 'messenger_alert_chat_id');
   }

   // Same rule as Messenger: no automatic reply while someone is already chatting with them.
   const lastOut = startsConversation ? await lastOutgoingTikTokAt(input.contactId) : null;
   if (!startsConversation || (lastOut !== null && input.at - lastOut < RECENT_REPLY_MS)) return;

   // The language they picked in the TikTok bot menu (bot variable `lang`).
   const locale = toBotLocale(typeof contact?.variables?.lang === 'string' ? contact.variables.lang : null);
   const text = buildTikTokAutoReply({ at: input.at, firstName: name?.split(' ')[0] ?? null, registered: Boolean(maybe), locale });
   const sent = await sendTikTokText(input.contactId, text);
   if (sent.ok) {
      await svc
         .from('widget_messages')
         .insert({ conversation_id: conversation.id, sender: 'system', body: text, channel_delivered_at: new Date().toISOString() });
   } else {
      console.log('tiktokSupport: auto-reply not sent:', sent.reason);
   }
};
