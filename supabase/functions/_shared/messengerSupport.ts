// Messenger as a support channel, on the same Discord ticket system as the website chat.
//
//   Person writes to the Moodeng Credit Page
//     → sendpulse-events → openMessengerTicket(): their one widget_conversations row (channel
//       'messenger'), then the widget API's /api/message saves it and posts it into the Discord
//       #web-support ticket with Reply / ✅ Resolve / Quick reply — exactly like a website chat.
//     → first message of a conversation: an automatic reply (team online or offline, and a sign-up
//       card for people who aren't Moodeng users yet).
//   Team taps Reply in Discord → discord-interactions saves it as an 'agent' widget_messages row
//     → trigger (migration 20261023140000) → sendpulse-events ?relay=1 → relayAgentReply() sends it
//       on Messenger. A reply Meta refuses (outside its 24h window) is flagged in the admin Telegram chat.
//
// Facebook confirmation traffic (MDNG codes, Get Started, bot button taps) and the "menu" keyword
// (the SendPulse bot menu answers it) never become a ticket.
import { adminUserUrl } from './adminCards.ts';
import { PAGE_INBOX_URL, SITE_URL } from './loanAccess.ts';
import { type MessengerCard, sendMessengerMessage } from './sendpulse.ts';
import { alertTeam, postToTicket } from './supportTickets.ts';

// deno-lint-ignore no-explicit-any
type Svc = any;

// The team answers 10 AM – 10 PM Thai time (Bangkok, UTC+7).
const OPEN_HOUR = 10;
const CLOSE_HOUR = 22;
// Anyone who started the Facebook step this recently may be the person writing, still unlinked.
const SIGNING_UP_WINDOW_MS = 30 * 60 * 1000;
// A message after this long without one starts a new conversation (and a fresh automatic reply).
const NEW_CONVERSATION_AFTER_MS = 12 * 60 * 60 * 1000;

// The bot speaks English or Filipino (chosen with 🌐 Language in the menu; saved by
// sendpulse-messenger-verify action 'locale' on messenger_contacts.locale and the account).
export type BotLocale = 'en' | 'fil';
export const toBotLocale = (value: string | null | undefined): BotLocale => (value === 'fil' ? 'fil' : 'en');

// Links carry the language so the page opens in it (the app reads ?lang=).
export const signUpUrl = (locale: BotLocale) => `${SITE_URL}/request-board?lang=${locale}&utm_source=messenger&utm_medium=support`;
// The step-by-step "How to borrow" card (scripts/cards/render-cards.mjs).
export const borrowCardImage = (locale: BotLocale) => `${SITE_URL}/cards/how-to-borrow-${locale}.png`;

export const bangkokHour = (at: number) =>
   Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Bangkok', hour: 'numeric', hourCycle: 'h23' }).format(new Date(at)));

export const isTeamOnline = (at: number) => {
   const hour = bangkokHour(at);
   return hour >= OPEN_HOUR && hour < CLOSE_HOUR;
};

// Messages that are part of the Facebook step or a bot button, not someone asking for help.
export const isSupportMessage = (event: { text: string | null; hasAttachment: boolean; isButtonTap: boolean; codes: string[] }) => {
   if (event.codes.length || event.isButtonTap) return false;
   const text = event.text?.trim() ?? '';
   if (!text) return event.hasAttachment;
   return !/^["']?(get started|start|magsimula|menu)[.!]?["']?$/i.test(text);
};

export type AutoReply = { text: string; card?: MessengerCard };

// Save the language picked in the bot: on the contact, and on any account linked to it.
export const saveBotLocale = async (svc: Svc, contactId: string, locale: BotLocale) => {
   const now = new Date().toISOString();
   await svc.from('messenger_contacts').upsert({ contact_id: contactId, locale, last_seen_at: now }, { onConflict: 'contact_id' });
   const { error } = await svc.from('users').update({ preferred_locale: locale, preferred_locale_at: now }).eq('messenger_psid', contactId);
   if (error) console.error('messengerSupport: save account locale failed', error.message);
};

const AUTO_REPLY: Record<BotLocale, { hi: (name: string | null) => string; online: string; offline: string; borrow: string; card: { title: string; subtitle: string; button: string } }> = {
   en: {
      hi: (name) => (name ? `Hi ${name}! 👋` : 'Hi! 👋'),
      online: 'Thanks for your message — George or Emma from Moodeng will reply right here soon.',
      offline:
         "Thanks for your message! Our team is offline right now (10 PM – 10 AM Thai time). We'll reply right here after 10 AM Thai time (11 AM Philippine time).",
      borrow: 'Interested in borrowing? Here is how your first loan works:',
      card: { title: 'Your first loan in 6 steps', subtitle: 'Your first loan is $15. Moodeng adds $0.', button: 'Get your first loan' }
   },
   fil: {
      hi: (name) => (name ? `Hi ${name}! 👋` : 'Hi! 👋'),
      online: 'Salamat sa mensahe mo — sasagot dito si George o Emma ng Moodeng sa lalong madaling panahon.',
      offline:
         'Salamat sa mensahe mo! Offline ang team ngayon (10 PM – 10 AM oras sa Thailand). Sasagot kami dito pagkalipas ng 10 AM oras sa Thailand (11 AM oras sa Pilipinas).',
      borrow: 'Gusto mo bang humiram? Ganito gumagana ang unang loan mo:',
      card: { title: 'Unang loan mo sa 6 na hakbang', subtitle: '$15 ang unang loan mo. Walang dagdag na singil.', button: 'Kunin ang unang loan' }
   }
};

// Messenger drops a card whose image doesn't load, so only use the card image once it's really
// served (it ships with the website, which can deploy after this function).
const imageReady = new Map<string, boolean>();
export const cardImageAvailable = async (url: string): Promise<boolean> => {
   if (imageReady.get(url)) return true;
   try {
      const res = await fetch(url, { method: 'HEAD' });
      const ok = res.ok && (res.headers.get('content-type') ?? '').startsWith('image/');
      if (ok) imageReady.set(url, true);
      return ok;
   } catch {
      return false;
   }
};

export const buildAutoReply = (opts: {
   at: number;
   firstName: string | null;
   registered: boolean;
   locale?: BotLocale;
   withImage?: boolean;
}): AutoReply => {
   const copy = AUTO_REPLY[opts.locale ?? 'en'];
   const status = isTeamOnline(opts.at) ? copy.online : copy.offline;
   const text = `${copy.hi(opts.firstName)} ${status}`;
   if (opts.registered) return { text };
   const locale = opts.locale ?? 'en';
   return {
      text: `${text}\n\n${copy.borrow}`,
      card: {
         title: copy.card.title,
         subtitle: copy.card.subtitle,
         ...(opts.withImage === false ? {} : { imageUrl: borrowCardImage(locale) }),
         button: { title: copy.card.button, url: signUpUrl(locale) }
      }
   };
};

type Borrower = { id: string; username: string | null; email: string | null; display_name: string | null; cs: number | null };

const ticketContext = (borrower: Borrower | null, facebookName: string | null) =>
   borrower
      ? [
           ['Messenger · Moodeng borrower', borrower.display_name?.trim(), borrower.username ? `@${borrower.username}` : null].filter(Boolean).join(' '),
           borrower.email ? `email ${borrower.email}` : null,
           borrower.cs !== null ? `credit level ${borrower.cs}` : null,
           `admin: ${adminUserUrl(borrower.id, borrower.username)}`
        ]
           .filter(Boolean)
           .join(' · ')
      : `Messenger · not linked to a Moodeng account yet (Facebook: ${facebookName ?? 'unknown'}). The automatic reply offers them the sign-up link.`;

type Conversation = { id: string; token: string; status: string; last_message_at: string | null };

// Their one Messenger ticket, created on first contact. visitor_email stays empty on purpose: the
// away-reply email sweep only emails tickets with an address, and Messenger replies go to Messenger.
const findOrCreateConversation = async (
   svc: Svc,
   contactId: string,
   facebookName: string | null,
   borrower: Borrower | null
): Promise<{ conversation: Conversation; created: boolean } | null> => {
   const label = `${facebookName ?? 'Facebook user'} (Messenger)`;
   const context = ticketContext(borrower, facebookName);
   const { data: existing } = await svc
      .from('widget_conversations')
      .select('id, token, status, last_message_at, visitor_name, bot_context')
      .eq('messenger_contact_id', contactId)
      .maybeSingle();
   if (existing) {
      const row = existing as Conversation & { visitor_name: string | null; bot_context: string | null };
      if (row.visitor_name !== label || row.bot_context !== context) {
         await svc.from('widget_conversations').update({ visitor_name: label, bot_context: context }).eq('id', row.id);
      }
      return { conversation: row, created: false };
   }
   const { data, error } = await svc
      .from('widget_conversations')
      .insert({
         channel: 'messenger',
         messenger_contact_id: contactId,
         visitor_name: label,
         page_url: PAGE_INBOX_URL,
         bot_context: context,
         ip: 'messenger'
      })
      .select('id, token, status, last_message_at')
      .single();
   if (error || !data) {
      // Two messages at once: the other one created it.
      const { data: raced } = await svc
         .from('widget_conversations')
         .select('id, token, status, last_message_at')
         .eq('messenger_contact_id', contactId)
         .maybeSingle();
      if (raced) return { conversation: raced as Conversation, created: false };
      console.error('messengerSupport: create conversation failed', error?.message);
      return null;
   }
   return { conversation: data as Conversation, created: true };
};

const ATTACHMENT_NOTE = '📎 Sent a photo or file on Messenger — open the Page inbox to see it.';

export const openMessengerTicket = async (
   svc: Svc,
   input: { contactId: string; facebookName: string | null; userId: string | null; text: string | null; hasAttachment: boolean; at: number }
) => {
   const { data: borrowerRow } = input.userId
      ? await svc.from('users').select('id, username, email, display_name, cs').eq('id', input.userId).maybeSingle()
      : { data: null };
   const borrower = (borrowerRow as Borrower | null) ?? null;
   const found = await findOrCreateConversation(svc, input.contactId, input.facebookName, borrower);
   if (!found) return;
   const { conversation, created } = found;

   const lastAt = Date.parse(conversation.last_message_at ?? '');
   const startsConversation =
      created || conversation.status === 'resolved' || Number.isNaN(lastAt) || input.at - lastAt > NEW_CONVERSATION_AFTER_MS;

   const body = [input.text?.trim(), input.hasAttachment ? ATTACHMENT_NOTE : null].filter(Boolean).join('\n');
   const posted = await postToTicket(conversation, body);
   if (!posted) {
      // The ticket couldn't be posted: still make sure someone sees it.
      await alertTeam(
         svc,
         `💬 Messenger message from ${input.facebookName ?? 'someone'} couldn't reach the Discord support ticket:\n> ${body.slice(0, 500)}\nAnswer in the Page inbox.`,
         [[{ text: '💬 Open Page inbox', url: PAGE_INBOX_URL }]]
      );
   }

   if (startsConversation) {
      // Someone mid-way through the Facebook step isn't linked yet but has an account: no sign-up card.
      const { count: recentAttempts } = borrower
         ? { count: 0 }
         : await svc
              .from('contact_verification_codes')
              .select('id', { count: 'exact', head: true })
              .gte('created_at', new Date(input.at - SIGNING_UP_WINDOW_MS).toISOString());
      const registered = Boolean(borrower) || (recentAttempts ?? 0) > 0;
      const { data: contactRow } = await svc.from('messenger_contacts').select('locale').eq('contact_id', input.contactId).maybeSingle();
      const { data: accountRow } = borrower
         ? await svc.from('users').select('preferred_locale').eq('id', borrower.id).maybeSingle()
         : { data: null };
      const locale = toBotLocale(
         (contactRow as { locale?: string | null } | null)?.locale ?? (accountRow as { preferred_locale?: string | null } | null)?.preferred_locale
      );
      const withImage = registered ? false : await cardImageAvailable(borrowCardImage(locale));
      const reply = buildAutoReply({ at: input.at, firstName: input.facebookName?.split(' ')[0] ?? null, registered, locale, withImage });
      const sent = await sendMessengerMessage(input.contactId, reply);
      if (sent.ok) {
         await svc.from('widget_messages').insert({ conversation_id: conversation.id, sender: 'system', body: reply.text, channel_delivered_at: new Date().toISOString() });
      } else {
         console.log('messengerSupport: auto-reply not sent:', sent.reason);
      }
   }
};

// A team reply saved by discord-interactions → Messenger. Claimed first, so a retried trigger call
// can't send it twice.
export const relayAgentReply = async (svc: Svc, messageId: string): Promise<{ ok: boolean; reason?: string }> => {
   const { data: claimed } = await svc
      .from('widget_messages')
      .update({ channel_delivered_at: new Date().toISOString() })
      .eq('id', messageId)
      .eq('sender', 'agent')
      .is('channel_delivered_at', null)
      .select('id, body, conversation_id')
      .maybeSingle();
   const message = claimed as { id: string; body: string; conversation_id: string } | null;
   if (!message) return { ok: false, reason: 'already_handled' };
   const { data: conv } = await svc
      .from('widget_conversations')
      .select('messenger_contact_id, visitor_name')
      .eq('id', message.conversation_id)
      .maybeSingle();
   const contactId = (conv as { messenger_contact_id?: string | null } | null)?.messenger_contact_id;
   if (!contactId) return { ok: false, reason: 'not_messenger' };

   const sent = await sendMessengerMessage(contactId, { text: message.body });
   if (sent.ok) return { ok: true };

   await svc.from('widget_messages').update({ channel_delivered_at: null, channel_error: sent.reason }).eq('id', message.id);
   const who = (conv as { visitor_name?: string | null }).visitor_name ?? 'this person';
   const why =
      sent.reason === 'send_failed'
         ? "Messenger refused it — most likely it's been more than 24 hours since they last wrote (Meta's rule)."
         : `SendPulse said: ${sent.reason}.`;
   await alertTeam(
      svc,
      `⚠️ A Discord reply to ${who} was NOT delivered on Messenger. ${why}\nReply from the Page inbox instead.\n> ${message.body.slice(0, 300)}`,
      [[{ text: '💬 Open Page inbox', url: PAGE_INBOX_URL }]]
   );
   return { ok: false, reason: sent.reason };
};
