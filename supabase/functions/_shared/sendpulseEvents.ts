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
            fromPerson
         }
      ];
   });
};
