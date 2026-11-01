// The call-booking bot (bookingBot.ts) on real Messenger, through SendPulse — TEST ACCOUNTS ONLY for now.
//
// sendpulse-events hands us each message a known borrower types. We answer it only when:
//   - telegram_bot_settings 'messenger_booking_bot' is 'test' or 'test-dry' (no row, or anything else = off), and
//   - the borrower is a test account (users.is_test), and
//   - they're already in a booking chat, or this message starts one ("book", "book a call", "mag-book").
// Otherwise we return false and the message goes on to support as before.
//
// 'test': calls are really booked on Cal.com at the final YES (callBooking.bookCall: same hosts, daily cap,
// Zoom link, reminders, team alert marked 🧪, and its own Messenger confirmation with the ✅ card), and
// "cancel" really cancels (callCancel.cancelUpcomingCall). Free times are this borrower's own list
// (listCallSlots: cooldown, soonest-first), minus times other Messenger chats are holding.
// 'test-dry': the same chat, but nothing is booked or cancelled (the bot says so).
//
// Holds: a tapped time is held for 15 minutes from their latest message (held_start / held_until on
// messenger_booking_chats); other chats don't see it. If they come back after it ran out and the time is
// gone, the bot says so and offers the closest (bookingBot Ctx.lapsed); if it's still free they carry on.
// Holds only exist in these chats: the app's booking page can still take a held time, and then the YES
// gets "just taken, here are the closest".
//
// Buttons: with telegram_bot_settings 'messenger_booking_buttons' = 'quick', options go out as Messenger quick
// replies (a tap comes back as a message with the button's title, which buttonFor reads as the tap). Otherwise,
// or if SendPulse refuses a message with them, it's plain text with a lettered list (bookingBot.plainText),
// and a letter or the button's words count as the tap either way. "stop" ends the chat.
//
// Team alerts (Telegram, 'booking_bot_alert_chat_id', else the call-changes group, else the admin/KYC group):
// the call-prep answers with the fit check when the questions are done, "held off", the name check, a failed
// booking and "no free times". Team-only notes, never shown to the borrower.

import { readCallTime } from './bookingAi.ts';
import * as Bot from './bookingBot.ts';
import { bookCall, listCallSlots } from './callBooking.ts';
import { cancelUpcomingCall } from './callCancel.ts';
import { openInAdminButton } from './adminCards.ts';
import { sendMessengerMessage } from './sendpulse.ts';
import { sendTelegramMessage } from './telegram.ts';

// deno-lint-ignore no-explicit-any
type Svc = any;

const SETTING = 'messenger_booking_bot';
const HOLD_MS = 15 * 60_000;
export const START = /^\s*(book|book a call|book call|book my call|schedule( a)? call|mag-?book|iskedyul)\b/i;
const STOP = /^\s*(stop|exit|quit|end)\s*[.!]*\s*$/i;

/** The borrower's wall clock in a zone. */
export const wallNow = (zone: string, at = new Date()): Bot.Now => {
   const p = Object.fromEntries(
      new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
         .formatToParts(at)
         .map((x) => [x.type, x.value])
   );
   return { date: `${p.year}-${p.month}-${p.day}`, min: (Number(p.hour) % 24) * 60 + Number(p.minute) };
};

/** A wall-clock time in a zone → the UTC instant (ISO). */
export const zonedIso = (s: { date: string; min: number }, zone: string) => {
   const guess = Date.parse(`${s.date}T00:00:00Z`) + s.min * 60_000;
   const w = wallNow(zone, new Date(guess));
   const offset = Date.parse(`${w.date}T00:00:00Z`) + w.min * 60_000 - guess;
   return new Date(guess - offset).toISOString();
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

/** Free times minus what other chats hold (their held_start instants, read in this borrower's zone). */
export const withoutHeld = (free: Bot.Slot[], heldStarts: string[], zone: string): Bot.Slot[] => {
   const held = new Set(heldStarts.map((iso) => Bot.slotKey(wallNow(zone, new Date(iso)))));
   return free.filter((s) => !held.has(Bot.slotKey(s)));
};

/** What to save for their hold: the held time's instant and when it runs out, or nothing. */
export const holdColumns = (state: Bot.BotState, zone: string, now = Date.now()) =>
   state.mine && !state.booked
      ? { held_start: zonedIso(state.mine, zone), held_until: new Date(now + HOLD_MS).toISOString() }
      : { held_start: null, held_until: null };

type Settings = { mode: 'off' | 'test' | 'test-dry'; quick: boolean; alertChat: string };
const ALERT_KEYS = ['booking_bot_alert_chat_id', 'call_changes_chat_id', 'kyc_alert_chat_id'];
const settings = async (svc: Svc): Promise<Settings> => {
   const { data } = await svc.from('telegram_bot_settings').select('key, value').in('key', [SETTING, 'messenger_booking_buttons', ...ALERT_KEYS]);
   const v = (k: string) => String(((data ?? []) as Array<{ key: string; value: unknown }>).find((r) => r.key === k)?.value ?? '').replace(/"/g, '').trim();
   const m = v(SETTING);
   return { mode: m === 'test' || m === 'test-dry' ? m : 'off', quick: v('messenger_booking_buttons') === 'quick', alertChat: ALERT_KEYS.map(v).find(Boolean) ?? '' };
};

const say = async (contactId: string, replies: Bot.Reply[], lang: Bot.Lang, quick: boolean) => {
   for (const r of replies) {
      const titles = (r.buttons ?? []).map((b) => b.title);
      // Quick replies first; if SendPulse refuses that message, the lettered text still gets through.
      if (quick && titles.length) {
         const res = await sendMessengerMessage(contactId, { text: r.text, quickReplies: titles });
         if (res.ok) continue;
         console.error('messenger-booking-bot: quick replies refused, sending letters', res.reason);
      }
      const res = await sendMessengerMessage(contactId, { text: Bot.plainText(r, lang) });
      if (!res.ok) console.error('messenger-booking-bot: send failed', res.reason);
   }
};

const FIT_ICON = { good: '🟢', talk: '🟡', review: '🔴' } as const;
const LANG_NAME: Record<Bot.Lang, string> = { en: 'English', fil: 'Filipino', id: 'Bahasa Indonesia' };
/** The team's Telegram alerts for this turn's events (none for most turns). */
export const alertTexts = (events: Bot.BotEvent[], state: Bot.BotState, who: { name: string; isTest?: boolean | null }): string[] => {
   const Q = Bot.questions(Bot.MARKETS[state.market] ?? Bot.MARKETS.PH);
   const head = (title: string) => `${title}\n👤 ${who.name}${who.isTest ? ' · 🧪 test account' : ''} · ${state.market} · chat in ${LANG_NAME[state.lang]}`;
   const out: string[] = [];
   for (const e of events) {
      if (e.type === 'answers') {
         const lines = Object.entries(e.answers).map(([k, v]) => `• ${Q[k]?.en ?? k} ${v}`);
         const checks = Bot.crossCheck(e.answers, { work: state.known.work, payday: state.known.payday });
         out.push(
            [
               head('📝 Booking bot · call prep'),
               state.mine ? `📅 Holding ${Bot.longWhen(state.mine, 'en', state.zoneName)}` : '',
               `${FIT_ICON[e.fit.verdict]} Fit check (rules, not a decision): ${e.fit.verdict} — ${e.fit.reason}`,
               '',
               'Their answers (tapped, or typed in their own words):',
               ...lines,
               ...(checks.length ? ['', ...checks.map((c) => `⚠️ ${c}`)] : [])
            ]
               .filter((l, i, a) => l !== '' || (i > 0 && a[i - 1] !== ''))
               .join('\n')
         );
      }
      if (e.type === 'heldOff') {
         out.push(`${head('⏸️ Booking bot · held off')}\nThey didn't answer "${Q[e.key]?.en ?? e.key}" twice (${e.value ?? 'skipped'}). No call booked; the bot asked them to come back when they're ready.`);
      }
      if (e.type === 'note' && /^(Name check|Booking failed|No free time)/.test(e.text)) out.push(`${head('⚠️ Booking bot')}\n${e.text}`);
   }
   return out;
};

/** True when the booking bot answered this message (so it isn't also a support ticket). Never throws. */
export const handleBookingMessage = async (svc: Svc, userId: string, contactId: string, text: string): Promise<boolean> => {
   try {
      const cfg = await settings(svc);
      if (cfg.mode === 'off') return false;
      const dry = cfg.mode === 'test-dry';
      const { data: user } = await svc
         .from('users')
         .select('id, email, username, is_test, display_name, facebook_name, whatsapp_number, timezone, video_call_timezone, preferred_locale, income_type, monthly_income, payday_type, payday_start, payday_end')
         .eq('id', userId)
         .maybeSingle();
      if (!user?.is_test) return false;
      const { data: row, error } = await svc.from('messenger_booking_chats').select('state, held_until').eq('contact_id', contactId).maybeSingle();
      if (error) {
         console.error('messenger-booking-bot: state lookup failed', error.message);
         return false;
      }
      const zone = Bot.profileFromUser(user).zone;
      const save = (state: Bot.BotState) =>
         svc.from('messenger_booking_chats').upsert({ contact_id: contactId, user_id: userId, state, ...holdColumns(state, zone), updated_at: new Date().toISOString() });

      if (!row) {
         if (!START.test(text)) return false;
         const bioDone = !!(user.income_type && user.monthly_income && user.payday_type);
         const g = Bot.greet(Bot.newState(Bot.profileFromUser(user)), bioDone);
         const notice = dry ? '🧪 Test account, practice mode: nothing gets really booked. Type STOP to end.' : '🧪 Test account: calls you book here are real (on Cal.com). Type STOP to end.';
         await say(contactId, [...g.replies, { text: notice }], g.state.lang, cfg.quick);
         await save(g.state);
         return true;
      }
      const state = row.state as Bot.BotState;
      if (STOP.test(text)) {
         await svc.from('messenger_booking_chats').delete().eq('contact_id', contactId);
         const kept = state.booked || state.kept ? ' Your booked call stays booked.' : '';
         await say(contactId, [{ text: `🧪 Booking chat ended.${kept} Type BOOK to start again.` }], state.lang, cfg.quick);
         return true;
      }

      const now = wallNow(zone);
      const listed = await listCallSlots(svc, { id: user.id, email: user.email }, zone);
      if (listed.body.error === 'cooldown') {
         await say(contactId, [{ text: "Sorry, you can't book a new call just yet after missed calls. Please try again in a few days 🙏" }], state.lang, cfg.quick);
         return true;
      }
      const { data: holds } = await svc
         .from('messenger_booking_chats')
         .select('held_start')
         .neq('contact_id', contactId)
         .gt('held_until', new Date().toISOString())
         .not('held_start', 'is', null);
      const listedFree = listed.status === 200 ? freeFromSlots(listed.body as never, now) : [];
      const free = withoutHeld(listedFree, ((holds ?? []) as Array<{ held_start: string }>).map((h) => h.held_start), zone);
      // Their own held time is still free on Cal.com (holds live only here), so it's left out of what they're offered.
      const mine = state.mine;
      const others = free.filter((s) => !(mine && s.date === mine.date && s.min === mine.min));
      // Their hold ran out: it's lost only if the time isn't free any more (Cal.com or another chat took it).
      const expired = !!(mine && !state.booked && row.held_until && Date.parse(row.held_until) < Date.now());
      const lapsed = expired && !free.some((s) => s.date === mine!.date && s.min === mine!.min);

      const ctx: Bot.Ctx = {
         now,
         free: others,
         lastDay: listedFree.length ? listedFree[listedFree.length - 1].date : '',
         readAi: (t, n) => readCallTime(t, n),
         lapsed,
         ...(dry
            ? {}
            : {
                 book: async (slot: Bot.Slot) => {
                    const r = await bookCall(svc, { id: user.id, email: user.email }, zonedIso(slot, zone), zone);
                    if (r.body.ok === true) return { ok: true as const, confirmed: r.body.messenger === true };
                    console.error('messenger-booking-bot: book failed', userId, JSON.stringify(r.body));
                    const taken = r.body.error === 'slot_taken' || r.body.error === 'day_full';
                    return { ok: false as const, why: taken ? ('taken' as const) : ('other' as const) };
                 },
                 cancel: async () => {
                    const why = await cancelUpcomingCall(svc, user.id, 'the borrower (Messenger booking bot)');
                    if (why && why !== 'No upcoming call.') console.error('messenger-booking-bot: cancel failed', userId, why);
                    return !why || why === 'No upcoming call.';
                 }
              })
      };
      const r = await Bot.step(state, { text }, ctx);
      const extra: Bot.Reply[] = dry && r.events.some((e) => e.type === 'book') ? [{ text: '🧪 Practice mode: nothing was really booked.' }] : [];
      await say(contactId, [...r.replies, ...extra], r.state.lang, cfg.quick);
      await save(r.state);
      const who = { name: user.display_name || user.facebook_name || (user.username ? `@${user.username}` : 'A borrower'), isTest: user.is_test };
      // Best-effort: they've already had their reply, so a failed alert must not turn this into a support ticket.
      for (const text of cfg.alertChat ? alertTexts(r.events, r.state, who) : []) {
         try {
            await sendTelegramMessage(cfg.alertChat, text, { inlineKeyboard: [[openInAdminButton(user.id, user.username)]] });
         } catch (err) {
            console.error('messenger-booking-bot: team alert failed', err instanceof Error ? err.message : err);
         }
      }
      for (const e of r.events) if (e.type !== 'read' && e.type !== 'offered') console.log('messenger-booking-bot', userId, JSON.stringify(e));
      return true;
   } catch (err) {
      console.error('messenger-booking-bot: failed', err instanceof Error ? err.message : err);
      return false;
   }
};
