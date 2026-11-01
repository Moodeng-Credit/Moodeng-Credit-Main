// The call-booking bot (bookingBot.ts) on real Messenger, through SendPulse — TEST ACCOUNTS ONLY for now.
//
// sendpulse-events hands us each message a known borrower types. We answer it only when:
//   - telegram_bot_settings 'messenger_booking_bot' is 'test' (no row, or anything else = off), and
//   - the borrower is a test account (users.is_test), and
//   - they're already in a booking chat, or this message starts one ("book", "book a call", "mag-book").
// Otherwise we return false and the message goes on to support as before.
//
// In test mode nothing real happens: free times are the live ones (as a fresh borrower would see them),
// times are read by DeepSeek, but no Cal.com call is booked, held or cancelled, and the bot says so.
// Replies are plain text (sendMessengerMessage sends text only), so buttons become a lettered list and a
// letter or the button's words count as the tap (bookingBot.plainText / buttonFor). "stop" ends the chat.
//
// The conversation is saved per SendPulse contact in public.messenger_booking_chats.

import { readCallTime } from './bookingAi.ts';
import * as Bot from './bookingBot.ts';
import { listCallSlots } from './callBooking.ts';
import { sendMessengerMessage } from './sendpulse.ts';

// deno-lint-ignore no-explicit-any
type Svc = any;

const SETTING = 'messenger_booking_bot';
export const START = /^\s*(book|book a call|book call|book my call|schedule( a)? call|mag-?book|iskedyul)\b/i;
const STOP = /^\s*(stop|exit|quit|end)\s*[.!]*\s*$/i;
// The pretend borrower listCallSlots uses for "what would a fresh borrower see" (no strikes, no call yet).
const PREVIEW_USER = { id: '00000000-0000-0000-0000-000000000000', email: null };

/** The borrower's wall clock in a zone. */
export const wallNow = (zone: string, at = new Date()): Bot.Now => {
   const p = Object.fromEntries(
      new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
         .formatToParts(at)
         .map((x) => [x.type, x.value])
   );
   return { date: `${p.year}-${p.month}-${p.day}`, min: (Number(p.hour) % 24) * 60 + Number(p.minute) };
};

/** listCallSlots' answer (ISO times in the borrower's zone) → the bot's free list: 2+ hours away, 7 days. */
export const freeFromSlots = (body: { all?: string[]; slots?: string[]; hosts?: Record<string, string> }, now: Bot.Now): Bot.Slot[] => {
   const nowAbs = Date.parse(`${now.date}T00:00:00Z`) / 60000 + now.min;
   const out = (body.all ?? body.slots ?? [])
      .map((iso) => ({ date: iso.slice(0, 10), min: Bot.toMin(iso.slice(11, 16)) ?? -1, host: body.hosts?.[iso] === 'george' ? 'George' : 'Emma' }))
      .filter((s) => s.min >= 0 && Date.parse(`${s.date}T00:00:00Z`) / 60000 + s.min > nowAbs + 120);
   const days = [...new Set(out.map((s) => s.date))].sort().slice(0, 7);
   return out.filter((s) => days.includes(s.date));
};

const mode = async (svc: Svc): Promise<'off' | 'test'> => {
   const { data } = await svc.from('telegram_bot_settings').select('value').eq('key', SETTING).maybeSingle();
   return String(data?.value ?? '').replace(/"/g, '').trim() === 'test' ? 'test' : 'off';
};

const say = async (contactId: string, replies: Bot.Reply[], lang: Bot.Lang) => {
   for (const r of replies) {
      const res = await sendMessengerMessage(contactId, { text: Bot.plainText(r, lang) });
      if (!res.ok) console.error('messenger-booking-bot: send failed', res.reason);
   }
};

/** True when the booking bot answered this message (so it isn't also a support ticket). Never throws. */
export const handleBookingMessage = async (svc: Svc, userId: string, contactId: string, text: string): Promise<boolean> => {
   try {
      if ((await mode(svc)) !== 'test') return false;
      const { data: user } = await svc
         .from('users')
         .select('id, is_test, display_name, facebook_name, whatsapp_number, timezone, video_call_timezone, preferred_locale, income_type, monthly_income, payday_type, payday_start, payday_end')
         .eq('id', userId)
         .maybeSingle();
      if (!user?.is_test) return false;
      const { data: row, error } = await svc.from('messenger_booking_chats').select('state').eq('contact_id', contactId).maybeSingle();
      if (error) {
         console.error('messenger-booking-bot: state lookup failed', error.message);
         return false;
      }
      const save = (state: Bot.BotState) =>
         svc.from('messenger_booking_chats').upsert({ contact_id: contactId, user_id: userId, state, updated_at: new Date().toISOString() });

      if (!row) {
         if (!START.test(text)) return false;
         const bioDone = !!(user.income_type && user.monthly_income && user.payday_type);
         const g = Bot.greet(Bot.newState(Bot.profileFromUser(user)), bioDone);
         await say(contactId, [...g.replies, { text: '🧪 Test account: this is the booking bot being tried. Nothing gets really booked. Type STOP to end.' }], g.state.lang);
         await save(g.state);
         return true;
      }
      const state = row.state as Bot.BotState;
      if (STOP.test(text)) {
         await svc.from('messenger_booking_chats').delete().eq('contact_id', contactId);
         await say(contactId, [{ text: '🧪 Booking chat ended. Type BOOK to start again.' }], state.lang);
         return true;
      }

      const zone = Bot.profileFromUser(user).zone;
      const now = wallNow(zone);
      const slots = await listCallSlots(svc, PREVIEW_USER, zone, null, true);
      const free = slots.status === 200 ? freeFromSlots(slots.body as never, now) : [];
      // The time they hold or booked here isn't free to them (nothing is really held in test mode).
      const mine = state.mine;
      const ctx: Bot.Ctx = {
         now,
         free: free.filter((s) => !(mine && s.date === mine.date && s.min === mine.min)),
         lastDay: free.length ? free[free.length - 1].date : '',
         readAi: (t, n) => readCallTime(t, n)
      };
      const r = await Bot.step(state, { text }, ctx);
      const extra: Bot.Reply[] = r.events.some((e) => e.type === 'book') ? [{ text: '🧪 Test account: nothing was really booked.' }] : [];
      await say(contactId, [...r.replies, ...extra], r.state.lang);
      await save(r.state);
      for (const e of r.events) if (e.type !== 'read' && e.type !== 'offered') console.log('messenger-booking-bot', userId, JSON.stringify(e));
      return true;
   } catch (err) {
      console.error('messenger-booking-bot: failed', err instanceof Error ? err.message : err);
      return false;
   }
};
