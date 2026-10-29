// Admin-only research (George, 2026-10-29: "I wonder if people even read them"): for each kind of
// bot message on Messenger, how many went out, were seen, had a link tapped, or got a reply within a
// day. Read-only, from SendPulse's chat history.
import { listMessengerChats, listMessengerMessages, type SendPulseMessage } from './sendpulse.ts';

// First words → message kind. Anything else outgoing is a team member typing (or something rare).
const KINDS: Array<[string, RegExp]> = [
   ['welcome', /^Hi, this is Moodeng Credit/i],
   ['menu', /^(How can we help|Paano ka namin matutulungan)/i],
   ['connected', /(Your Facebook is confirmed|You're connected!|One sec, confirming)/i],
   ['notifications_blocked', /(naka-block ang notifications|notifications .*blocked)/i],
   ['six_things', /6 things to know|6 bagay/i],
   ['offline', /team is offline|offline right now/i],
   ['next_step', /^(📍|Your next step|Susunod mong hakbang)/i],
   ['booked', /(You're booked!|Thank you for confirming! Your meeting)/i],
   ['reminder_day_before', /^👋 Just a quick reminder/i],
   ['confirm_1h', /^⏰ Our meeting is in 1 hour/i],
   ['starting_soon', /^⏰ Our meeting starts in under an hour/i],
   ['starting_now', /^👋 Our meeting is starting now/i],
   ['waiting', /^🙂 We're ready for you/i],
   ['moved', /has moved to/i],
   ['cancelled', /call was cancelled/i],
   ['missed', /We missed you on the call/i],
   ['approved', /You're approved/i],
   ['videos', /quick videos before your first loan/i],
   ['verified', /You.re verified on Moodeng/i],
   ['funded', /first loan is funded|Welcome to the community/i],
   ['reward', /reward/i],
   ['due_reminder', /(is due|overdue|due date)/i]
];

const textOf = (m: SendPulseMessage): string => {
   const d = m.data ?? {};
   const t = d.text ?? d.message?.text ?? d.attachment?.payload?.text ?? d.attachment?.payload?.elements?.[0]?.title ?? '';
   return String(t);
};
export const kindOf = (text: string) => KINDS.find(([, re]) => re.test(text))?.[0] ?? 'team_or_other';

type Row = { sent: number; delivered: number; seen: number; tapped: number; replied: number; examples: string[] };

export const botMessageStats = async (sinceIso: string, maxChats = 120) => {
   const since = Date.parse(sinceIso);
   const contacts = await listMessengerChats(maxChats);
   const rows: Record<string, Row> = {};
   for (const id of contacts) {
      const msgs = (await listMessengerMessages(id)).filter((m) => m.created_at).sort((a, b) => Date.parse(a.created_at!) - Date.parse(b.created_at!));
      msgs.forEach((m, i) => {
         if (m.direction !== 2 || Date.parse(m.created_at!) < since) return;
         const text = textOf(m);
         const kind = kindOf(text);
         const r = (rows[kind] ??= { sent: 0, delivered: 0, seen: 0, tapped: 0, replied: 0, examples: [] });
         r.sent += 1;
         if ((m.status ?? 0) >= 3) r.delivered += 1;
         if (m.opened_at || (m.status ?? 0) === 4 || (m.status ?? 0) === 5) r.seen += 1;
         if (m.redirected_at || (m.status ?? 0) === 5) r.tapped += 1;
         const t = Date.parse(m.created_at!);
         // A reply: their next message within 24h, before we sent anything else of this kind.
         const next = msgs.slice(i + 1).find((x) => x.direction === 1);
         if (next && Date.parse(next.created_at!) - t < 24 * 3600_000) r.replied += 1;
         if (r.examples.length < 1 && text) r.examples.push(text.slice(0, 90));
      });
   }
   return { contacts: contacts.length, since: sinceIso, rows };
};
