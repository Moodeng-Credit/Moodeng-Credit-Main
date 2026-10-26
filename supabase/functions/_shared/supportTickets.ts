// Shared plumbing for support tickets in the Discord #web-support system (widget_conversations +
// widget_messages), used by the channels that feed it besides the website chat: Messenger
// (messengerSupport.ts) and support@ email (email-inbound).
//
// Tickets are posted through the widget API's own /api/message, which saves the message and relays
// it into the Discord forum thread with the Discord bot (Reply / ✅ Resolve / Quick reply). The widget
// picks the forum from the conversation's channel: 'email' → SUPPORT_EMAIL_CHANNEL_ID, everything else
// (Messenger, website chat) → #web-support (SUPPORT_CHANNEL_ID). That needs
// no Discord webhook secret here, unlike postDiscord(), whose fallback DISCORD_TEAM_WEBHOOK_URL isn't
// set on this project.
import { postDiscord } from './discord.ts';
import { getAdminChatId } from './loanAccess.ts';
import { sendTelegramMessage, type TelegramInlineKeyboard } from './telegram.ts';

// deno-lint-ignore no-explicit-any
type Svc = any;

const WIDGET_API = (Deno.env.get('WEB_BASE_URL') || 'https://web-iota-sage-38.vercel.app').replace(/\/$/, '');

// The widget API caps a message at 4000 characters.
export const TICKET_MESSAGE_MAX = 3900;

export type TicketConversation = { id: string; token: string };

// Same path as a website chat message: saved, posted into the Discord ticket, board refreshed.
export const postToTicket = async (conversation: TicketConversation, body: string): Promise<boolean> => {
   const text = body.length > TICKET_MESSAGE_MAX ? `${body.slice(0, TICKET_MESSAGE_MAX)}\n… (cut short)` : body;
   try {
      const res = await fetch(`${WIDGET_API}/api/message`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ conversation_id: conversation.id, token: conversation.token, body: text })
      });
      if (!res.ok) console.error('supportTickets: widget /api/message responded', res.status, (await res.text()).slice(0, 200));
      return res.ok;
   } catch (err) {
      console.error('supportTickets: widget /api/message failed', err instanceof Error ? err.message : err);
      return false;
   }
};

// Something the team must see (a ticket that couldn't be posted, a reply that wasn't delivered): the
// admin Telegram chat, and Discord too where a webhook is configured.
export const alertTeam = async (svc: Svc, text: string, keyboard?: TelegramInlineKeyboard) => {
   try {
      const chat = await getAdminChatId(svc);
      if (chat) await sendTelegramMessage(chat, text, keyboard ? { inlineKeyboard: keyboard } : {});
   } catch (err) {
      console.error('supportTickets: telegram alert failed', err instanceof Error ? err.message : err);
   }
   await postDiscord({ content: text });
};
