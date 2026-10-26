import { extractMessengerCodes } from './messengerCodes.ts';

// Parse SendPulse chatbot webhooks (Bot settings → Webhooks) into what sendpulse-events acts on.
//
// SendPulse posts one event or an array of them, shaped roughly like:
//   { service: 'messenger', title: 'new_subscriber' | 'incoming_message' | …,
//     bot: { id, external_id, name, url },
//     contact: { id, name, username, last_message, variables: { mdng_code, … }, … },
//     info: { … the raw message … }, date: <ms> }
// The exact field set isn't fully documented, so everything here is optional and defensive: we only
// need the contact id, whether the person (not the bot) did something, and any MDNG code in it.

export type SendPulseEvent = {
   title: string;
   botId: string | null;
   // The Facebook Page id SendPulse reports as the bot's "external_id".
   pageId: string | null;
   contactId: string | null;
   contactName: string | null;
   codes: string[];
   at: number;
   // A subscribe or a message FROM the person — never the bot's own outgoing messages.
   fromPerson: boolean;
   // What they typed (incoming messages only), whether they sent a photo/file, and whether it was a
   // tap on a bot button (Get Started, a flow's button) rather than something they wrote.
   text: string | null;
   hasAttachment: boolean;
   isButtonTap: boolean;
   // The parts of the raw event worth keeping for debugging (info + contact.last_message), trimmed.
   payload: Json | null;
};

type Json = Record<string, unknown>;
const asObject = (v: unknown): Json | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null);
const asString = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : typeof v === 'number' ? String(v) : null);

// SendPulse's `date` is documented in milliseconds; accept seconds too, and fall back to "now".
const eventTime = (v: unknown, now: number) => {
   const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : Number.NaN;
   if (!Number.isFinite(n) || n <= 0) return now;
   const ms = n > 1e12 ? n : n * 1000;
   // A redelivered event can be old; one from the future is a clock problem — clamp to now.
   return Math.min(ms, now);
};

// Not the person reaching out: the bot's/operator's own messages, leaving, blocking, link redirects.
const NOT_FROM_PERSON = /outgoing|outbound|operator|bot_message|unsubscri|block|redirect|chat_open|open_chat|live_chat/i;
const FROM_PERSON = /subscri|incoming|message/i;

const PAYLOAD_MAX_CHARS = 4000;

// The person's message. SendPulse doesn't document Messenger's shape; its examples put the platform
// message under info.message.channel_data.message (WhatsApp) and the latest text on
// contact.last_message, so read those, most specific first.
const readMessage = (e: Json, contact: Json | null, incoming: boolean) => {
   const info = asObject(e.info);
   const message = asObject(info?.message);
   const channelData = asObject(message?.channel_data);
   const platform = asObject(channelData?.message) ?? channelData;
   const lastMessage = contact?.last_message;
   const text =
      asString(platform?.text) ??
      asString(asObject(platform?.text)?.body) ??
      asString(message?.text) ??
      (incoming && typeof lastMessage === 'string' ? asString(lastMessage) : null);
   const attachments = platform?.attachments ?? message?.attachments;
   // A button or ☰ menu tap: Messenger puts it under channel_data.message.postback.
   const isButtonTap = Boolean(platform?.quick_reply || platform?.postback || channelData?.postback || message?.postback || info?.postback);
   return { text, hasAttachment: Array.isArray(attachments) && attachments.length > 0, isButtonTap };
};

const trimPayload = (e: Json, contact: Json | null): Json | null => {
   const kept = { info: e.info ?? null, last_message: contact?.last_message ?? null };
   const raw = JSON.stringify(kept);
   return raw.length <= PAYLOAD_MAX_CHARS ? kept : { truncated: raw.slice(0, PAYLOAD_MAX_CHARS) };
};

export const parseSendPulseEvents = (body: unknown, now = Date.now()): SendPulseEvent[] => {
   const list = Array.isArray(body) ? body : body ? [body] : [];
   return list.flatMap((raw) => {
      const e = asObject(raw);
      if (!e) return [];
      const title = asString(e.title) ?? asString(e.event) ?? '';
      const service = asString(e.service);
      if (service && !/messenger|facebook/i.test(service)) return [];
      const bot = asObject(e.bot);
      const contact = asObject(e.contact);
      const variables = asObject(contact?.variables);
      const fromPerson = !NOT_FROM_PERSON.test(title) && (title === '' || FROM_PERSON.test(title));
      // Codes only count when the person sent them (or their link set mdng_code on the contact).
      const incoming = fromPerson && /incoming|message/i.test(title) && !/subscri/i.test(title);
      const message = incoming ? readMessage(e, contact, true) : { text: null, hasAttachment: false, isButtonTap: false };
      const codeSources = fromPerson
         ? [JSON.stringify(contact?.last_message ?? ''), JSON.stringify(e.info ?? ''), asString(variables?.mdng_code)]
         : [];
      return [
         {
            title,
            botId: asString(bot?.id),
            pageId: asString(bot?.external_id),
            contactId: asString(contact?.id),
            contactName: asString(contact?.name),
            codes: [...new Set(codeSources.flatMap((s) => extractMessengerCodes(s)))],
            at: eventTime(e.date, now),
            fromPerson,
            ...message,
            payload: incoming ? trimPayload(e, contact) : null
         }
      ];
   });
};
