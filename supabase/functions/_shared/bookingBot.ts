// The Messenger call-booking bot's conversation, as one pure module: (saved state + one message or
// button tap) → (new state + replies + events). No network, no database, no DOM, so the same code runs
// in the booking-bot test page (bundled to public/design/booking-bot-test/bookingBot.js) and, later, in
// messenger-webhook with the state saved per PSID.
//
// Flow: they name a day/time (DeepSeek reads it, simple rules if it's down) → we offer up to 3 free
// times → tapping one HOLDS it → "get to know you" questions (ranges; "Prefer not to say" re-asked once,
// then held off — Emma + George, 2026-10-30) → what the first loan is → YES → first name → booked.
// Moving a call keeps the old time until a new one is tapped. Nothing here scores or decides anything:
// the fit check is a team-only note.
//
// Real booking is the caller's (Ctx.book / Ctx.cancel; without them, as on the test page, it's pretend).
// A booked call being moved stays booked (`kept`) until the new time is really booked at YES, so backing
// out, losing the new time, or letting its hold run out (Ctx.lapsed) puts them back on the old one.
//
// It starts from what we already know (profileFromUser): their country (phone, then device time zone),
// their time zone, language, first name, and the app bio (work, monthly income, payday) — so the chat
// never re-asks what the bio already answered.
//
// Messenger limits kept here: quick-reply / button titles ≤ 20 characters (details go in the message
// text), at most 13 quick replies. All times are the borrower's wall clock in their own time zone.

import type { CallTimeRead } from './bookingAi.ts';

// ---------------------------------------------------------------------------------------------------
// Markets: time zone, currency and money ranges per country.
// ---------------------------------------------------------------------------------------------------

export type MarketId = 'PH' | 'ID';
export type Market = {
   id: MarketId;
   zone: string; // default IANA zone when we don't know theirs
   cur: string; // currency prefix
   firstLoan: string; // the first $15 loan in local money
   // Upper bounds of each money question's ranges (the last button is "more than the last bound").
   bounds: { income: number[]; leftover: number[]; sales: number[]; debtAmt: number[] };
   // A bare number under this could mean thousands ("5" for ₱5k): ask instead of guessing.
   bareMin: number;
};

export const MARKETS: Record<MarketId, Market> = {
   PH: {
      id: 'PH',
      zone: 'Asia/Manila',
      cur: '₱',
      firstLoan: '₱870',
      bounds: { income: [5000, 10000, 20000, 40000], leftover: [500, 1000, 3000], sales: [1000, 3000, 7000], debtAmt: [5000, 20000, 50000] },
      bareMin: 100
   },
   // PLACEHOLDER (not reviewed): ranges converted from the peso ones at ~₱1 = Rp280. The team should set
   // real Rupiah ranges, and Indonesian wording is still to come — Indonesians get English for now.
   ID: {
      id: 'ID',
      zone: 'Asia/Jakarta',
      cur: 'Rp',
      firstLoan: 'Rp245rb',
      bounds: { income: [1_500_000, 3_000_000, 5_000_000, 10_000_000], leftover: [150_000, 300_000, 1_000_000], sales: [300_000, 1_000_000, 2_000_000], debtAmt: [1_500_000, 5_000_000, 15_000_000] },
      bareMin: 1000
   }
};

/** What the bot knows before the first message: from public.users (see profileFromUser). */
export type Profile = {
   market: MarketId;
   zone: string; // IANA zone their times are shown in
   zoneName: string; // "Manila", "Bangkok"
   lang: Lang;
   firstName: string | null; // from their account, to check the name they type
   known: Record<string, string>; // question key → answer from the app bio (never re-asked)
};

/** The public.users columns profileFromUser reads (all optional). */
export type UserRow = {
   display_name?: string | null;
   facebook_name?: string | null;
   whatsapp_number?: string | null;
   timezone?: string | null; // device time zone at signup
   video_call_timezone?: string | null; // the zone they last booked a call in
   preferred_locale?: string | null;
   income_type?: string | null; // full-time | part-time | freelance
   monthly_income?: string | null; // under_200 | 200_400 | 400_700 | 700_plus (USD)
   payday_type?: string | null; // mid-month | end-of-month | irregular
   payday_start?: number | null;
   payday_end?: number | null;
};

const isZone = (z: string) => {
   try {
      new Intl.DateTimeFormat('en-US', { timeZone: z });
      return z.includes('/');
   } catch {
      return false;
   }
};
const INCOME_USD: Record<string, string> = { under_200: 'Under $200', '200_400': '$200–$400', '400_700': '$400–$700', '700_plus': 'Over $700' };
const WORK: Record<string, string> = { 'full-time': 'Employed (full-time)', 'part-time': 'Employed (part-time)', freelance: 'Employed (freelance)' };

/**
 * Their starting profile. Country: phone first (+62 Indonesia, +63 Philippines), then device time zone
 * (Asia/Jakarta → Indonesia), else the Philippines. Time zone: where they booked before, else their
 * device's, else their country's.
 */
export const profileFromUser = (u: UserRow = {}): Profile => {
   const digits = String(u.whatsapp_number ?? '').replace(/\D/g, '');
   const tzs = [u.video_call_timezone, u.timezone].map((z) => String(z ?? '').trim()).filter(isZone);
   const market: MarketId = digits.startsWith('62') ? 'ID' : digits.startsWith('63') ? 'PH' : tzs.includes('Asia/Jakarta') ? 'ID' : 'PH';
   const zone = tzs[0] || MARKETS[market].zone;
   const known: Record<string, string> = {};
   if (u.income_type && WORK[u.income_type]) known.work = `${WORK[u.income_type]} · from app`;
   if (u.monthly_income && INCOME_USD[u.monthly_income]) known.income = `${INCOME_USD[u.monthly_income]} a month · from app`;
   if (u.payday_type) {
      const days = u.payday_start && u.payday_end ? `, day ${u.payday_start === u.payday_end ? u.payday_start : `${u.payday_start}–${u.payday_end}`}` : '';
      known.payday = `${u.payday_type === 'irregular' ? 'It varies' : u.payday_type === 'mid-month' ? 'Mid-month' : 'End of month'}${days} · from app`;
   }
   const name = String(u.facebook_name || u.display_name || '').trim().split(/\s+/)[0] ?? '';
   return {
      market,
      zone,
      zoneName: zone.split('/').pop()!.replace(/_/g, ' '),
      lang: u.preferred_locale === 'fil' ? 'fil' : 'en',
      firstName: /^\p{L}[\p{L}'.-]+$/u.test(name) ? name : null,
      known
   };
};

// ---------------------------------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------------------------------

export type Lang = 'en' | 'fil';
/** A free time, in the borrower's wall clock: date YYYY-MM-DD, minutes after midnight. */
export type Slot = { date: string; min: number; host: string };
export type Button = { title: string; payload: string };
export type Reply = { text: string; buttons?: Button[]; card?: boolean };
export type Window = { date: string; from: string; to: string };
export type Parsed = { windows: Window[]; at: string | null; anytime: boolean; unclear: boolean; lang: Lang; summary: string };
export type OfferResult = { picks: Slot[]; exact: boolean; asked?: { date: string; min: number }; inside?: number; dayFull?: boolean; tooFar?: boolean };
export type Fit = { verdict: 'good' | 'talk' | 'review'; reason: string };
export type Step = 'waiting_bio' | 'ask' | 'offered' | 'prep' | 'expect' | 'held' | 'name' | 'booked';

export type BotState = {
   market: MarketId;
   zoneName: string;
   lang: Lang;
   knownName: string | null; // their account's first name (to check the typed one)
   known: Record<string, string>; // answers from the app bio
   step: Step;
   mine: Slot | null; // the time they hold or have booked
   booked: boolean; // mine is booked (not just held)
   kept: Slot | null; // their booked call while they hold a new time for it (booked until the new one is)
   offered: Slot[];
   lastOffer: OfferResult | null;
   answers: Record<string, string>; // English labels (team-facing), or what they typed
   asked: string[];
   reasked: string[];
   quizDone: boolean;
   changing: boolean; // booked and asked to move: the next message is read as a time
   name: string;
   lastButtons: Button[]; // the buttons on our latest message: typing one's text (or its letter) taps it
};

export type BotEvent =
   | { type: 'read'; how: string; ms: number; parsed: Parsed; error?: string }
   | { type: 'offered'; result: OfferResult; summary: string }
   | { type: 'hold'; slot: Slot }
   | { type: 'release'; slot: Slot; why: 'moved' | 'other' | 'no' | 'heldOff' | 'cancel' | 'taken' | 'lapsed' }
   | { type: 'book'; slot: Slot; name: string }
   | { type: 'reask'; key: string; value: string | null }
   | { type: 'heldOff'; key: string; value: string | null }
   | { type: 'answers'; answers: Record<string, string>; fit: Fit }
   | { type: 'expectations' }
   | { type: 'attend'; slot: Slot }
   | { type: 'note'; text: string };

export type Now = { date: string; min: number };
export type Ctx = {
   now: Now; // borrower's wall clock
   free: Slot[]; // bookable free times right now (not counting theirs)
   lastDay: string; // last date we can book
   /** DeepSeek reader (bookingAi.readCallTime). Missing or failing → the simple rules below. */
   readAi?: (text: string, now: { weekday: string; date: string; time: string }) => Promise<{ read: CallTimeRead | null; error?: string }>;
   /** Really book the held time. confirmed: the booking already sent its own Messenger confirmation. Missing → pretend. */
   book?: (slot: Slot) => Promise<{ ok: true; confirmed: boolean } | { ok: false; why: 'taken' | 'other' }>;
   /** Really cancel their booked call; false if it couldn't be. Missing → pretend. */
   cancel?: () => Promise<boolean>;
   /** Their 15-minute hold ran out and that time isn't free any more. */
   lapsed?: boolean;
};
export type Input = { text?: string; payload?: string };
export type Result = { state: BotState; replies: Reply[]; events: BotEvent[] };

export const MAX_BUTTON = 20;
export const MAX_Q = 10;

// ---------------------------------------------------------------------------------------------------
// Time helpers (wall-clock dates, no time zones needed)
// ---------------------------------------------------------------------------------------------------

export const addDays = (d: string, n: number) => {
   const t = new Date(d + 'T00:00:00Z');
   t.setUTCDate(t.getUTCDate() + n);
   return t.toISOString().slice(0, 10);
};
const weekday = (d: string) => new Date(d + 'T00:00:00Z').getUTCDay();
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const locale = (lang: Lang) => (lang === 'fil' ? 'fil-PH' : 'en-US');
export const fmtDay = (d: string, lang: Lang) => new Intl.DateTimeFormat(locale(lang), { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(d + 'T00:00:00Z'));
const fmtDayLong = (d: string, lang: Lang) => new Intl.DateTimeFormat(locale(lang), { timeZone: 'UTC', weekday: 'long', month: 'short', day: 'numeric' }).format(new Date(d + 'T00:00:00Z'));
/** "Tue 3" — short enough for a button. */
const dayShort = (d: string, lang: Lang) => `${new Intl.DateTimeFormat(locale(lang), { timeZone: 'UTC', weekday: 'short' }).format(new Date(d + 'T00:00:00Z'))} ${Number(d.slice(8, 10))}`;
export const fmtTime = (m: number) => {
   const h = Math.floor(m / 60) % 24;
   return `${h % 12 || 12}:${String(m % 60).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};
const absMin = (date: string, min: number) => new Date(date + 'T00:00:00Z').getTime() / 60000 + min;
export const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
export const toMin = (s: unknown) => {
   const m = /^(\d{1,2}):(\d{2})$/.exec(String(s ?? ''));
   return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
export const slotKey = (s: { date: string; min: number }) => `${s.date} ${hhmm(s.min)}`;
const sameSlot = (a: Slot | null, b: Slot | null) => !!a && !!b && a.date === b.date && a.min === b.min;
export const longWhen = (s: Slot, lang: Lang, zoneName: string) =>
   `${new Intl.DateTimeFormat(locale(lang), { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(s.date + 'T00:00:00Z'))}, ${fmtTime(s.min)} (${zoneName} time)`;

// ---------------------------------------------------------------------------------------------------
// Words the bot says
// ---------------------------------------------------------------------------------------------------

type Text = string | ((...a: string[]) => string);
const T: Record<string, Record<Lang, Text>> = {
   connected: { en: (n) => `✅ Messenger connected${n ? `, ${n}` : ''}! You'll get your updates here.`, fil: (n) => `✅ Naka-connect na ang Messenger${n ? `, ${n}` : ''}! Dito mo matatanggap ang updates mo.` },
   bioMissing: {
      en: "👉 NEXT: go back to Moodeng and answer 5 quick questions about your work and payday (1 min).\n\nAs soon as you're done, I'll message you here to book your call.",
      fil: '👉 SUSUNOD: bumalik sa Moodeng at sagutin ang 5 mabilis na tanong tungkol sa trabaho at sweldo mo (1 min).\n\nPagkatapos mo, magme-message ako dito para i-book ang call mo.'
   },
   backBtn: { en: '↩️ Back to Moodeng', fil: '↩️ Balik sa Moodeng' },
   ask: {
      en: '📅 LAST STEP: book your 15-min video call with George or Emma.\n\nWhat day and time works best for you? Write it any way you like, e.g. "bukas after 6pm" or "Saturday morning".',
      fil: '📅 HULING HAKBANG: mag-book ng 15-min video call kasama si George o Emma.\n\nAnong araw at oras ang pinaka-okay sa iyo? Isulat mo lang kahit paano, gaya ng "bukas after 6pm" o "Sabado ng umaga".'
   },
   // The AI's summary is never shown to the borrower (team log only).
   offer: { en: 'Got it! These times are free:', fil: 'Sige! Bakante ang mga oras na ito:' },
   near: { en: "Sorry, we're fully booked then. The closest free times are:", fil: 'Pasensya, puno na kami sa oras na iyan. Ito ang pinakamalapit na bakante:' },
   askedFree: { en: (w) => `✅ ${w} is free!`, fil: (w) => `✅ Bakante ang ${w}!` },
   askedTaken: { en: (w) => `❌ ${w} is already taken. The closest free times:`, fil: (w) => `❌ May naka-book na sa ${w}. Ang pinakamalapit na bakante:` },
   askedMine: { en: (w) => `${w} is the time you have now 🙂 Other free times near it:`, fil: (w) => `${w} ang oras mo ngayon 🙂 Ibang bakanteng oras malapit doon:` },
   dayFull: { en: (d) => `❌ ${d} is fully booked. The closest free times on other days:`, fil: (d) => `❌ Puno na ang ${d}. Ang pinakamalapit na bakante sa ibang araw:` },
   tooFar: { en: 'I can only book up to a week ahead 🙏 The free times closest to what you asked:', fil: 'Hanggang isang linggo lang ang pwede kong i-book 🙏 Ang pinakamalapit na bakante sa hiningi mo:' },
   pickHint: { en: 'Tap a time to book it, or type its number.', fil: 'Pindutin ang oras para i-book, o i-type ang numero nito.' },
   reoffer: { en: 'Tap one of these times, or tell me another day and time 🙂', fil: 'Pumili ng isa sa mga oras na ito, o sabihin ang ibang araw at oras 🙂' },
   keepBtn: { en: '👍 Keep my time', fil: '👍 Dati kong oras' },
   tzNote: { en: (z) => `All times are your time (${z}).`, fil: (z) => `Lahat ng oras ay oras mo (${z}).` },
   unclear: {
      en: 'Sorry, I didn\'t catch a day or time 🙏 Try something like "tomorrow 3pm" or "Saturday morning".',
      fil: 'Pasensya, hindi ko nakuha ang araw o oras 🙏 Subukan ang "bukas 3pm" o "Sabado umaga".'
   },
   other: { en: 'No problem! What other day or time works for you?', fil: 'Walang problema! Anong ibang araw o oras ang okay sa iyo?' },
   otherKeep: {
      en: 'No problem! What other day or time works for you?\nYour call stays booked until you pick a new time.',
      fil: 'Walang problema! Anong ibang araw o oras ang okay sa iyo?\nNaka-book pa rin ang call mo hanggang pumili ka ng bagong oras.'
   },
   unclearKeep: {
      en: (w) => `Sorry, I didn't catch a day or time 🙏 You're still booked for ${w}.\nTo change it, try something like "tomorrow 3pm" or "Saturday morning".`,
      fil: (w) => `Pasensya, hindi ko nakuha ang araw o oras 🙏 Naka-book ka pa rin sa ${w}.\nPara palitan, subukan ang "bukas 3pm" o "Sabado umaga".`
   },
   cancelled: {
      en: (w) => `OK, your call on ${w} is cancelled.\nWhenever you're ready, just tell me a day and time 🙂`,
      fil: (w) => `Sige, kinansela na ang call mo sa ${w}.\nKapag handa ka na, sabihin lang ang araw at oras 🙂`
   },
   tapOne: { en: 'Please tap one of the buttons 🙂', fil: 'Pakipindot ang isa sa mga button 🙂' },
   rangeNumber: { en: 'Is that in thousands? Please tap the closest range 🙂', fil: 'Libo ba iyan? Pakipindot ang pinakamalapit na range 🙂' },
   finishFirst: {
      en: "Sorry, I didn't catch a new day or time. Let's finish these questions first — you can change the time at the end 🙂",
      fil: 'Pasensya, hindi ko nakuha ang bagong araw o oras. Tapusin muna natin ang mga tanong — pwede mong palitan ang oras pagkatapos 🙂'
   },
   resume: { en: (w, h) => `⏳ Now holding ${w} with ${h}. Let's finish the questions:`, fil: (w, h) => `⏳ Naka-hold na ang ${w} kasama si ${h}. Tapusin natin ang mga tanong:` },
   otherBtn: { en: '🕐 Other time', fil: '🕐 Ibang oras' },
   lapsed: { en: '⌛ I could only hold your time for 15 minutes, and someone else took it.', fil: '⌛ 15 minuto lang kaya kong i-hold ang oras mo, at may ibang kumuha na nito.' },
   bookFailed: {
      en: "😕 Sorry, something went wrong booking your call. Please type YES to try again — or our team will message you with a time.",
      fil: '😕 Pasensya, nagka-problema sa pag-book ng call mo. Pakitype ulit ang YES — o ime-message ka ng team para sa oras.'
   },
   cancelFailed: {
      en: "😕 Sorry, I couldn't cancel your call just now. Please try again, or our team will cancel it for you.",
      fil: '😕 Pasensya, hindi ko ma-cancel ang call mo ngayon. Subukan ulit, o ika-cancel ito ng team para sa iyo.'
   },
   none: { en: 'Sorry, our calendar is full this week. The team will message you with a time 🙏', fil: 'Pasensya, puno na ang calendar namin ngayong linggo. Ime-message ka ng team para sa oras 🙏' },
   holding: {
      en: (w, h) => `⏳ I'm holding ${w} with ${h} for you.\n\nA few quick questions first so ${h} can prepare (about 2 min). Ranges are fine, and it stays private with our team 🔒`,
      fil: (w, h) => `⏳ Naka-hold para sa iyo ang ${w} kasama si ${h}.\n\nIlang mabilis na tanong muna para makapaghanda si ${h} (mga 2 min). Ranges lang, at pribado ito sa team namin 🔒`
   },
   // No "of N": how many follow-ups apply depends on their answers, and a total that changes confuses.
   question: { en: (n, q) => `Question ${n} · ${q}`, fil: (n, q) => `Tanong ${n} · ${q}` },
   expectations: {
      en: (l) => `Thanks! 🙏 Before you confirm, so it's clear 👇\n\n• Your first loan is small: $15 (about ${l}).\n• Your limit grows step by step: each loan repaid on time unlocks the next level. It takes a few loans, not a few days.\n• It can't be rushed, but if you pay on time, Moodeng grows with you 🦛`,
      fil: (l) => `Salamat! 🙏 Bago mo i-confirm, para malinaw 👇\n\n• Maliit ang unang loan: $15 (mga ${l}).\n• Tumataas ang limit mo nang paunti-unti: bawat loan na nabayaran sa oras, may susunod na level. Ilang loan ito, hindi ilang araw.\n• Hindi ito mapapabilis, pero kapag on time ka, lalaki kasama mo ang Moodeng 🦛`
   },
   gotIt: { en: '👍 Got it', fil: '👍 Naiintindihan ko' },
   confirmTime: {
      en: (w, h) => `✅ LAST STEP: CONFIRM YOUR CALL\n\n📅 ${w}\n👤 with ${h} · 🎥 Zoom · 15 min\n\nOne rule: 1 hour before, I'll message you a ✅ I'll be there button. Tap it, or the call is cancelled.\n\n👉 Type YES to confirm your call.`,
      fil: (w, h) => `✅ HULING HAKBANG: I-CONFIRM ANG CALL MO\n\n📅 ${w}\n👤 kasama si ${h} · 🎥 Zoom · 15 min\n\nIsang rule: 1 oras bago, magme-message ako ng ✅ I'll be there button. Pindutin ito, kung hindi makakansela ang call.\n\n👉 I-type ang YES para i-confirm ang call mo.`
   },
   sayYes: { en: 'Please type YES to confirm this time, or tap 🕐 Other time.', fil: 'Pakitype ang YES para i-confirm, o pindutin ang 🕐 Ibang oras.' },
   askName: { en: 'Thank you! Last thing: please type your first name (for security).', fil: 'Salamat! Huling bagay: pakitype ang first name mo (para sa security).' },
   badName: { en: 'Please type just your first name, e.g. Maria', fil: 'Pakitype lang ang first name mo, hal. Maria' },
   booked: {
      en: (w, n, h) => `🎉 You're booked, ${n}!\n🗓️ ${w} · 15 min with ${h}\n\nBring 🪪 your original ID and 📷 camera on. That's it!`,
      fil: (w, n, h) => `🎉 Naka-book ka na, ${n}!\n🗓️ ${w} · 15 min kasama si ${h}\n\nDalhin ang 🪪 orihinal mong ID at naka-on ang 📷 camera. Iyon lang!`
   },
   promise: { en: (n) => `⏰ Remember, ${n}: tap ✅ 1 hour before, or the call is cancelled.`, fil: (n) => `⏰ Tandaan, ${n}: pindutin ang ✅ 1 oras bago, kung hindi makakansela ang call.` },
   card: { en: "Will you make it? Tap ✅ so we know you're coming — or pick a new time.", fil: 'Makakarating ka ba? Pindutin ang ✅ para alam naming darating ka — o pumili ng bagong oras.' },
   attendBtn: { en: "✅ I'll be there", fil: '✅ Darating ako' },
   changeBtn: { en: '🔄 Change time', fil: '🔄 Palitan ang oras' },
   thanks: { en: '✅ Thanks! See you then 🙌', fil: '✅ Salamat! Kita tayo 🙌' },
   allSet: {
      en: (n, w) => `👍 You're all set${n ? `, ${n}` : ''}! See you ${w}.\nNeed a different time? Just tell me a day and time.`,
      fil: (n, w) => `👍 Ayos na${n ? `, ${n}` : ''}! Kita tayo sa ${w}.\nKailangan ng ibang oras? Sabihin lang ang araw at oras.`
   },
   reask: {
      en: "That's OK 🙂 A rough guess is fine.\nWe lend to people who keep track of their money, so an estimate really helps us.",
      fil: 'Okay lang 🙂 Kahit tantya lang.\nNagpapautang kami sa mga taong alam kung saan napupunta ang pera nila, kaya malaking tulong ang tantya.'
   },
   reaskType: {
      en: "That's OK 🙂 Just a few words is fine.\nIt helps us understand your situation before the call.",
      fil: 'Okay lang 🙂 Kahit ilang salita lang.\nNakakatulong ito para maintindihan namin ang sitwasyon mo bago ang call.'
   },
   reaskOther: {
      en: 'Could you pick the closest one? 🙂 It helps us understand your situation.',
      fil: 'Pwede mo bang piliin ang pinakamalapit? 🙂 Nakakatulong ito para maintindihan namin ang sitwasyon mo.'
   },
   heldOff: {
      en: "Sorry 🙏 We can't book your call just yet.\nWe work with people who are well aware of their current situation and manage their finances responsibly.\nWhen you're ready to share a rough picture, just tell me a day and time and we'll start again.",
      fil: 'Pasensya 🙏 Hindi pa namin ma-book ang call mo.\nNakikipagtulungan kami sa mga taong alam ang kasalukuyang sitwasyon nila at responsable sa pera.\nKapag handa ka nang magbahagi kahit tantya lang, sabihin lang ang araw at oras at magsisimula ulit tayo.'
   },
   skip: { en: 'Skip', fil: 'Laktawan' }
};
const tr = (lang: Lang, key: string, ...a: string[]) => {
   const v = T[key][lang];
   return typeof v === 'function' ? v(...a) : v;
};

// ---------------------------------------------------------------------------------------------------
// Questions. Answers are stored in English (the team reads them); buttons show the borrower's language.
// ---------------------------------------------------------------------------------------------------

type Opt = { en: string; fil: string };
type Question = { en: string; fil: string; opts?: Opt[]; money?: keyof Market['bounds'] | true; free?: boolean };

const kfmt = (n: number, m: Market) => (m.id === 'ID' ? (n >= 1e6 ? `${n / 1e6}jt` : n >= 1000 ? `${n / 1000}rb` : `${n}`) : n >= 1000 ? `${n / 1000}k` : `${n}`);
const unit = (s: string) => s.replace(/^[\d.]+/, '');
const between = (a: number, b: number, m: Market) => {
   const x = kfmt(a, m), y = kfmt(b, m);
   return `${m.cur}${unit(x) === unit(y) ? x.slice(0, x.length - unit(x).length) : x}–${y}`;
};
/** Range buttons from upper bounds: "Under ₱5k", "₱5–10k", …, "More than ₱40k". */
const rangeOpts = (bounds: number[], m: Market, under = true): Opt[] => [
   ...(under ? [{ en: `Under ${m.cur}${kfmt(bounds[0], m)}`, fil: `Below ${m.cur}${kfmt(bounds[0], m)}` }] : []),
   ...bounds.slice(1).map((b, i) => ({ en: between(bounds[i], b, m), fil: between(bounds[i], b, m) })),
   { en: `More than ${m.cur}${kfmt(bounds[bounds.length - 1], m)}`, fil: `Higit ${m.cur}${kfmt(bounds[bounds.length - 1], m)}` }
];

export const PNS: Opt = { en: 'Prefer not to say', fil: 'Ayokong sabihin' };
const o = (en: string, fil: string): Opt => ({ en, fil });

export const questions = (m: Market): Record<string, Question> => ({
   work: { en: 'Are you working right now?', fil: 'May trabaho ka ba ngayon?', opts: [o('Employed', 'May trabaho'), o('Own business', 'Sariling negosyo'), o('Between jobs', 'Walang trabaho'), o('Other', 'Iba pa')] },
   support: {
      en: 'Who do you support with your income? (tap the main one)',
      fil: 'Sino ang sinusuportahan mo sa kita mo? (piliin ang pangunahin)',
      opts: [o('My kids', 'Mga anak ko'), o('My parents', 'Magulang ko'), o('Siblings', 'Kapatid'), o('Partner', 'Partner'), o('Other family', 'Ibang kamag-anak'), o('Just myself', 'Sarili ko lang')]
   },
   kids: { en: 'Do you have kids?', fil: 'May anak ka ba?', opts: [o('Yes', 'Oo'), o('No', 'Wala')] },
   income: { en: 'About how much came in last month? (work, sales, help from family)', fil: 'Mga magkano ang pumasok sa iyo noong nakaraang buwan? (trabaho, benta, tulong ng pamilya)', money: 'income', opts: rangeOpts(m.bounds.income, m) },
   leftover: {
      en: "By the end of the month, what's usually left?",
      fil: 'Pagdating ng katapusan ng buwan, magkano ang natitira?',
      money: 'leftover',
      opts: [o('I run short 😓', 'Kulang pa 😓'), o('Almost nothing', 'Halos wala'), ...rangeOpts(m.bounds.leftover, m, false)]
   },
   job: { en: "What's your job? (just type it)", fil: 'Ano ang trabaho mo? (i-type lang)', free: true },
   jobLong: { en: 'How long have you been at your job?', fil: 'Gaano ka na katagal sa trabaho mo?', opts: [o('<6 months', '<6 buwan'), o('6–12 months', '6–12 buwan'), o('1–3 years', '1–3 taon'), o('3+ years', '3+ taon')] },
   payday: { en: 'When does your pay come in?', fil: 'Kailan ang sweldo mo?', opts: [o('15th & 30th', 'Kinsenas'), o('Weekly', 'Lingguhan'), o('Daily', 'Araw-araw'), o('It varies', 'Pabago-bago')] },
   biz: { en: "What's your business? (just type it)", fil: 'Ano ang negosyo mo? (i-type lang)', free: true },
   sales: { en: 'About how much do you sell in a week?', fil: 'Mga magkano ang benta mo kada linggo?', money: 'sales', opts: rangeOpts(m.bounds.sales, m) },
   lastJob: { en: 'What was your most recent job? (just type it)', fil: 'Ano ang huli mong trabaho? (i-type lang)', free: true },
   moneyNow: { en: 'Any money coming in right now?', fil: 'May pumapasok bang pera ngayon?', opts: [o('Help from family', 'Tulong ng pamilya'), o('Odd jobs', 'Raket / sideline'), o('None right now', 'Wala sa ngayon')] },
   kidsCount: { en: 'How many kids?', fil: 'Ilan ang anak mo?', opts: [o('1', '1'), o('2', '2'), o('3', '3'), o('4+', '4+')] },
   billTrouble: {
      en: 'In the last 3 months, did you have trouble paying a bill on time?',
      fil: 'Sa nakaraang 3 buwan, nahirapan ka bang magbayad ng bill sa oras?',
      opts: [o('No', 'Hindi'), o('Once', 'Isang beses'), o('A few times', 'Ilang beses'), o('Most months', 'Halos buwan-buwan')]
   },
   debt: {
      en: 'Do you owe money right now?',
      fil: 'May utang ka ba ngayon?',
      money: true,
      opts: [o('No', 'Wala'), o('Family / friends', 'Pamilya / kaibigan'), o('5-6 or lending app', '5-6 o lending app'), o('Bank / credit card', 'Bangko / credit card'), o('Several places', 'Maraming lugar')]
   },
   debtAmt: { en: 'About how much in total?', fil: 'Mga magkano lahat?', money: 'debtAmt', opts: rangeOpts(m.bounds.debtAmt, m) },
   loanUse: { en: `What would ${m.firstLoan} (our first $15 loan) help with? (just type it)`, fil: `Saan makakatulong ang ${m.firstLoan} (unang $15 loan namin)? (i-type lang)`, free: true },
   repay: { en: 'When could you pay it back?', fil: 'Kailan mo ito kayang bayaran?', opts: [o('Next payday', 'Sa susunod na sweldo'), o('Within 2 weeks', 'Sa loob ng 2 linggo'), o('Not sure', 'Hindi sigurado')] }
});

const BASE = ['work', 'support', 'kids', 'income', 'leftover'];
const is = (v: string | undefined, ...ws: string[]) => ws.some((w) => String(v ?? '').toLowerCase().includes(w.toLowerCase()));
/** Which follow-ups apply, most useful first (answers are English). */
const followUps = (a: Record<string, string>) =>
   [
      is(a.work, 'employed') && 'job',
      is(a.work, 'employed') && 'payday',
      is(a.work, 'business') && 'biz',
      is(a.work, 'business') && 'sales',
      is(a.work, 'between', 'other') && 'lastJob',
      is(a.work, 'between') && 'moneyNow',
      is(a.kids, 'yes') && 'kidsCount',
      (is(a.leftover, 'short', 'nothing') || a.leftover === PNS.en) && 'debt',
      a.debt && !is(a.debt, 'no', 'prefer') && 'debtAmt',
      'loanUse',
      'repay',
      is(a.leftover, 'short') && 'billTrouble',
      is(a.work, 'employed') && 'jobLong'
   ].filter((k): k is string => !!k);

// Dodging = "Prefer not to say", a skipped typed question, or "Other" on work. "Not sure" on when they
// could repay is a real answer (it's one of that question's own buttons), not a dodge.
const isDodge = (q: Question, key: string, value: string | null) => (value == null ? !!q.free : value === PNS.en || (key === 'work' && value === 'Other'));

/** Team-only, never a rejection (George, 2026-10-29). Being single or supporting nobody never counts against anyone. */
export const fitCheck = (a: Record<string, string>): Fit => {
   const noIncome = is(a.work, 'between') && (is(a.moneyNow, 'none') || !a.moneyNow);
   const deepTrouble = is(a.leftover, 'short') && is(a.debt, 'several') && is(a.repay, 'not sure');
   if (noIncome) return { verdict: 'review', reason: 'no current work or income — ask how they would repay' };
   if (deepTrouble) return { verdict: 'review', reason: "runs short, owes several places, unsure when they'd repay — check $15 really helps" };
   const talk = is(a.leftover, 'short') || is(a.debt, '5-6', 'lending app', 'several') || is(a.billTrouble, 'most');
   return talk ? { verdict: 'talk', reason: 'tight money or existing debts — ask how they would repay' } : { verdict: 'good', reason: 'has income and a small gap a $15 loan can cover' };
};

/** Things to ask about when the chat answers don't match their app bio. */
export const crossCheck = (a: Record<string, string>, bio: { work?: string; payday?: string }) => {
   const notes: string[] = [];
   if (a.work && bio.work && !is(a.work, 'employed')) notes.push(`Bio says "${bio.work}", but in chat: ${a.work}${a.biz ? ` (${a.biz})` : a.lastJob ? ` (last job: ${a.lastJob})` : ''}. Ask which is their main income now.`);
   if (a.payday && bio.payday && !is(a.payday, '15')) notes.push(`Bio payday ${bio.payday}, chat says ${a.payday}. Ask when money really comes in.`);
   return notes;
};

// ---------------------------------------------------------------------------------------------------
// Reading what they type
// ---------------------------------------------------------------------------------------------------

export const norm = (t: unknown) => String(t ?? '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
export const words = (t: unknown) => norm(t).replace(/[^\p{L}\p{N}\s:'-]/gu, ' ').split(/\s+/).filter(Boolean);
// Whole words only: "friend" is not Friday, "money" is not Monday, "2 kids" is not a time.
const TIME_WORD = /\b(today|tonight|tomorrow|tmrw|tmr|bukas|mamaya|ngayon|later|morning|afternoon|evening|night|noon|lunch|umaga|hapon|gabi|tanghali|mon|monday|tue|tues|tuesday|wed|weds|wednesday|thu|thur|thurs|thursday|fri|friday|sat|saturday|sun|sunday|lunes|martes|miyerkules|miyerkoles|huwebes|biyernes|sabado|linggo|weekend|week|besok|nanti|sekarang|pagi|siang|sore|malam|senin|selasa|rabu|kamis|jumat|sabtu|minggu|jan|feb|march|apr|april|june|july|aug|sept|oct|nov|dec)\b/;
const CLOCK = /\b\d{1,2}(:\d{2})?\s*(am|pm)\b|\b\d{1,2}:\d{2}\b|\b(alas|jam|at|around|after|before|from|by|pagkatapos ng|bago mag)\s+\d{1,2}\b|\b\d{1,2}\s*(-|–|to)\s*\d{1,2}\s*(am|pm)?\b|\b\d{1,2}\/\d{1,2}\b/;
// A day named ("4pm instead" has none, so it means the day they already have).
const DAY_WORD = /\b(today|tonight|tomorrow|tmrw|tmr|bukas|mamaya|ngayon|ngayong|later|mon|monday|tue|tues|tuesday|wed|weds|wednesday|thu|thur|thurs|thursday|fri|friday|sat|saturday|sun|sunday|lunes|martes|miyerkules|miyerkoles|huwebes|biyernes|sabado|linggo|weekend|weekdays?|week|besok|lusa|nanti|sekarang|senin|selasa|rabu|kamis|jumat|sabtu|minggu|jan|feb|march|apr|april|june|july|aug|sept|oct|nov|dec|\d{1,2}(st|nd|rd|th))\b|\b\d{1,2}\/\d{1,2}\b/;
export const looksLikeTime = (t: string) => TIME_WORD.test(norm(t)) || CLOCK.test(norm(t));
const CHANGE = /\b(change|resched\w*|move|instead|another (day|time)|other (day|time)|ibang (araw|oras)|iba ?ng (araw|oras)|palit\w*|ilipat|lipat|cancel|na lang|nalang)\b/;
const wantsChange = (t: string) => CHANGE.test(norm(t));
const CANCEL = /\b(cancel\w*|can'?t (make it|come|attend)|cannot (make it|come|attend)|hindi (na )?(ako )?makakapunta|di (ako )?makakapunta|hindi na lang|ayaw ko na|wag na lang|huwag na lang)\b/;
const YES_WORDS = new Set(['yes', 'yeah', 'yea', 'yep', 'yup', 'ye', 'oo', 'opo', 'oho', 'sige', 'ok', 'okay', 'okey', 'oki', 'k', 'sure', 'confirm', 'confirmed', 'go', 'game', 'ya', 'iya', 'g']);
// Words that can follow a YES without being a name.
const FILLER = new Set(['po', 'naman', 'please', 'pls', 'plz', 'thanks', 'thank', 'you', 'ty', 'salamat', 'sure', 'confirm', 'confirmed', 'na', 'lang', 'i', 'will', 'be', 'there', 'see', 'tayo', 'then', 'terima', 'kasih', 'good', 'great', 'nice', 'got', 'it', 'all', 'set', 'deal', 'noted', 'ill', "i'll", 'definitely', 'of', 'course', 'yes', 'oo', 'opo', 'sige', 'ok', 'okay', 'yep', 'yeah', 'kita']);
// Common words that are never a first name.
const NOT_NAMES = new Set([
   ...FILLER,
   ...YES_WORDS,
   ...['hi', 'hello', 'hey', 'actually', 'sorry', 'wait', 'teka', 'ako', 'me', 'my', 'name', 'is', 'am', 'im', 'ang', 'si', 'ay', 'ko', 'yung', 'the', 'a', 'an', 'and', 'but', 'pero', 'also', 'din', 'rin'],
   ...['sir', 'maam', "ma'am", 'madam', 'kuya', 'ate', 'boss', 'no', 'hindi', 'morning', 'afternoon', 'evening', 'can', 'what', 'when', 'how', 'why', 'pwede', 'paano', 'saan', 'kailan', 'bakit'],
   ...['this', 'its', "it's", 'just', 'lol', 'haha', 'hehe', 'test', 'nope', 'none', 'wala']
]);
const NEGATIVE = /^\s*(no|nope|hindi|ayoko|ayaw|wag|huwag|cancel)\b(?!\s*(problem|prob|worries|worry|problema))/;
const cap = (w: string) => (w === w.toLowerCase() || w === w.toUpperCase() ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w[0].toUpperCase() + w.slice(1));

/** A first name from "Maria", "my name is Maria", "ako si Maria", "Ma. Cristina". Null if it doesn't look like one. */
export const firstName = (text: string): string | null => {
   let t = String(text).replace(/[^\p{L}\s'.-]/gu, ' ').trim();
   t = t.replace(/^(yes|oo|opo|sige|ok|okay)\b[\s,.!-]*/i, '').replace(/^(po|hi|hello|hey)\b[\s,.!-]*/i, '');
   t = t.replace(/^((my\s+)?(first\s+)?name\s*(is|'s)?|i\s*am|i'?m|this\s+is|it'?s|ako\s+(po\s+)?(ay\s+)?(si\s+)?|si|(ang\s+)?pangalan\s+ko\s*(po\s*)?(ay\s*)?|nama\s+saya|saya)\b[\s:,.-]*/i, '').replace(/^po\b\s*/i, '');
   const parts = t.split(/\s+/).map((x) => x.replace(/^[.'-]+|[.'-]+$/g, '')).filter(Boolean);
   const w = parts[0] || '';
   if (!/^\p{L}[\p{L}'-]{1,29}$/u.test(w) || NOT_NAMES.has(w.toLowerCase())) return null;
   if (/^ma$/i.test(w) && parts[1] && /^\p{L}{2,}$/u.test(parts[1]) && !NOT_NAMES.has(parts[1].toLowerCase())) return `Ma. ${cap(parts[1])}`;
   return cap(w);
};

/** What a reply to "Type YES to confirm" means: yes (maybe with their name), no, a new time, or neither. */
export const readConfirm = (text: string): { kind: 'yes'; name: string | null } | { kind: 'no' | 'time' | 'other' } => {
   if (/^\s*(👍|✅|👌|🙏)+\s*$/u.test(text)) return { kind: 'yes', name: null };
   const ws = words(text);
   if (!ws.length) return { kind: 'other' };
   if (!YES_WORDS.has(ws[0])) {
      if (NEGATIVE.test(norm(text))) return { kind: 'no' };
      return looksLikeTime(text) || wantsChange(text) ? { kind: 'time' } : { kind: 'other' };
   }
   const rest = ws.slice(1);
   const restText = rest.join(' ');
   // "yes but can we do 4pm instead?" is a new time, not a yes.
   if (looksLikeTime(restText) || wantsChange(restText)) return { kind: 'time' };
   if (/\b(but|pero|wait|teka|actually)\b/.test(restText)) return { kind: 'other' };
   const content = rest.filter((w) => !FILLER.has(w));
   if (!content.length) return { kind: 'yes', name: null };
   // "YES Maria": only when written like a name (capital first letter), so "yes excited" isn't a name.
   if (content.length === 1) {
      const orig = String(text).split(/[^\p{L}'-]+/u).find((w) => norm(w) === content[0]) || '';
      return { kind: 'yes', name: /^\p{Lu}/u.test(orig) ? firstName(orig) : null };
   }
   // "yes, my name is Maria" / "oo, ako si Maria".
   return { kind: 'yes', name: /\b(name|pangalan)\b|\bako (po )?si\b|\bthis is\b/.test(restText) ? firstName(text.replace(/^\s*\S+[\s,.!-]*/, '')) : null };
};

// ---- typed answers to the questions: matched by meaning, never by position ("5" is not the 5th button) ----
const DODGE = /\b(skip|laktawan|ayoko|ayaw|prefer not|rather not|secret|sikreto|private|pass|idk|i don'?t know|dunno|di ko alam|hindi ko alam|ewan|not sure|hindi sigurado|no comment|tidak tahu|rahasia|none of your business|bakit)\b/;
// [pattern, button index] per question, checked in order.
const SYN: Record<string, [RegExp, number][]> = {
   work: [
      [/\b(between|unemployed|jobless|no work|no job|walang trabaho|wala(ng)? work|wala pa|wala)\b/, 2],
      [/\b(business|negosyo|tindahan|sari|store|selling|seller|benta|nagtitinda|online shop|reseller)\b/, 1],
      [/\b(employed|empleyado|employee|working|may trabaho|staff|office|full ?time|part ?time|yes|oo|opo|meron)\b/, 0],
      [/\b(other|iba|student|freelance\w*|retired|ofw|housewife)\b/, 3]
   ],
   support: [
      [/\b(kids?|anak|children|child)\b/, 0],
      [/\b(parents?|magulang|nanay|tatay|mama|papa|mom|dad|mother|father)\b/, 1],
      [/\b(siblings?|kapatid|brother|sister)\b/, 2],
      [/\b(partner|asawa|husband|wife|bf|gf|boyfriend|girlfriend|jowa)\b/, 3],
      [/\b(family|kamag|relatives?|lola|lolo|tita|tito|pamangkin|grand\w*)\b/, 4],
      [/\b(myself|sarili|ako lang|me|alone|just me|none|no one|wala)\b/, 5]
   ],
   kids: [
      [/^(no|none|wala|wala pa|hindi|nope|zero|0)\b/, 1],
      [/^(yes|oo|opo|meron|mayroon|yep|yeah|[1-9])\b/, 0]
   ],
   kidsCount: [
      [/^(1|one|isa)\b/, 0],
      [/^(2|two|dalawa)\b/, 1],
      [/^(3|three|tatlo)\b/, 2],
      [/^([4-9]|1\d|four|five|apat|lima|anim)\b/, 3]
   ],
   jobLong: [
      [/\b([1-5])\s*(months?|mos?|buwan)\b|\b(new|bago|kakasimula|just started)\b/, 0],
      [/\b([6-9]|1[01])\s*(months?|mos?|buwan)\b|\b(half a year|almost a year)\b/, 1],
      [/\b(1|2|one|two|isa|dalawa|a)\s*(years?|yrs?|taon)\b/, 2],
      [/\b([3-9]|[1-9]\d|three|tatlo|many|matagal)\s*(years?|yrs?|taon)\b|\bmatagal na\b/, 3]
   ],
   payday: [
      [/\b(15|30|kinsenas|kinsena|katapusan|twice a month|semi)\b/, 0],
      [/\b(weekly|week|lingguhan|linggo)\b/, 1],
      [/\b(daily|araw-araw|araw araw|everyday|every day|arawan)\b/, 2],
      [/\b(varies|depende|pabago|iba-iba|irregular|random|minsan)\b/, 3]
   ],
   moneyNow: [
      [/\b(family|pamilya|parents|magulang|asawa|padala)\b/, 0],
      [/\b(odd|raket|sideline|extra|gig|part ?time|labada|delivery)\b/, 1],
      [/\b(none|wala|nothing|no)\b/, 2]
   ],
   billTrouble: [
      [/^(no|hindi|never|wala|nope)\b/, 0],
      [/\b(once|isang beses|isa|one time|1)\b/, 1],
      [/\b(few|ilang|sometimes|minsan|twice|2|3)\b/, 2],
      [/\b(most|always|lagi|palagi|halos|every month)\b/, 3]
   ],
   leftover: [
      [/\b(short|kulang|negative|utang|kapos|lubog)\b/, 0],
      [/\b(nothing|wala|zero|halos wala|almost none|none)\b/, 1]
   ],
   debt: [
      [/^(no|none|wala|hindi|nope)\b/, 0],
      [/\b(several|marami|many|lots|everywhere|ilang lugar)\b/, 4],
      [/\b(5-6|five six|lending|app|gcash|ggives|gloan|tala|cashalo|billease|home credit|sloan|spaylater)\b/, 2],
      [/\b(bank|credit card|cc|card)\b/, 3],
      [/\b(family|friends?|pamilya|kaibigan|kapatid|relatives?)\b/, 1]
   ],
   repay: [
      [/\b(payday|sweldo|next pay|kinsenas|katapusan)\b/, 0],
      [/\b(2 weeks|two weeks|2 linggo|dalawang linggo|week|linggo)\b/, 1],
      [/\b(not sure|hindi sigurado|depende|di ko alam|hindi ko alam|idk|ewan)\b/, 2]
   ]
};
/** An amount typed in local money ("15k", "15,000", "500rb", "1jt"). 'unsure' for a bare small number. */
const amountOf = (t: string, m: Market): number | 'unsure' | null => {
   const x = /(\d[\d,.]*)\s*(k\b|thousand|libo|rb\b|ribu|jt\b|juta|m\b|million)?/.exec(t);
   if (!x) return null;
   const n = Number(x[1].replace(/[,.](?=\d{3}\b)/g, '').replace(/,/g, ''));
   if (!Number.isFinite(n)) return null;
   if (x[2]) return n * (/^(jt|juta|m|million)$/.test(x[2]) ? 1e6 : 1000);
   return n === 0 || n >= m.bareMin ? n : 'unsure';
};
const readTyped = (q: Question, key: string, text: string, m: Market): { pick?: number; unsure?: boolean } => {
   const opts = q.opts ?? [];
   const t = norm(text).trim();
   const clean = (s: string) => norm(s).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
   const ct = clean(text);
   let i = opts.findIndex((op) => clean(op.en) === ct || clean(op.fil) === ct);
   if (i < 0 && ct.length >= 3) i = opts.findIndex((op) => clean(op.en).startsWith(ct) || clean(op.fil).startsWith(ct));
   if (i >= 0) return { pick: i };
   for (const [re, idx] of SYN[key] ?? []) if (re.test(t)) return { pick: idx };
   if (typeof q.money === 'string') {
      const a = amountOf(t, m);
      if (a === 'unsure') return { unsure: true };
      if (a !== null) {
         const bounds = m.bounds[q.money];
         // leftover's first two buttons are words; its ranges start at the third. 0 → "Almost nothing".
         if (key === 'leftover') {
            // Buttons: short, almost nothing, then ranges from bounds[0] up. Under the first range → almost nothing.
            if (a < bounds[0]) return { pick: 1 };
            const j = bounds.slice(1).findIndex((x) => a < x);
            return { pick: j === -1 ? opts.length - 1 : 2 + j };
         }
         const j = bounds.findIndex((b) => a < b);
         return { pick: j === -1 ? bounds.length : j };
      }
   }
   return {};
};

// ---------------------------------------------------------------------------------------------------
// Simple time reader (used when DeepSeek is down or slow)
// ---------------------------------------------------------------------------------------------------

const DAYS: [RegExp, number][] = [
   [/\b(sun|sunday|linggo)\b/, 0],
   [/\b(mon|monday|lunes)\b/, 1],
   [/\b(tue|tues|tuesday|martes)\b/, 2],
   [/\b(wed|weds|wednesday|miyerkules|miyerkoles)\b/, 3],
   [/\b(thu|thur|thurs|thursday|huwebes)\b/, 4],
   [/\b(fri|friday|biyernes)\b/, 5],
   [/\b(sat|saturday|sabado)\b/, 6]
];
// "next week" in Filipino is "susunod na linggo" — there "linggo" means week, not Sunday.
export const NEXT_WEEK = /\b(next week|susunod na linggo|sa isang linggo|next linggo|minggu depan)\b/;
// A clock hour with no am/pm: night words make it PM, morning words AM, else 1–7 is PM.
const hourOf = (h: string, mm: string | undefined, ap: string | undefined, t = '') => {
   let x = Number(h) % 12;
   const night = /\b(gabi|night|tonight|evening|hapon|afternoon|pm|malam|sore)\b/.test(t);
   const morning = /\b(umaga|morning|am|pagi)\b/.test(t);
   if (ap === 'pm' || (!ap && (night || (!morning && x >= 1 && x <= 7)))) x += 12;
   return x * 60 + Number(mm || 0);
};
const guessLang = (t: string): Lang => (/\b(bukas|ngayon|mamaya|umaga|hapon|gabi|po|ako|ko|lang|sana|pwede|puwede|kahit|ng|sa)\b/.test(t) ? 'fil' : 'en');

export const ruleParse = (text: string, now: Now): Parsed => {
   const t = text.toLowerCase().replace(/\b(noon|tanghaling tapat)\b/g, '12pm').replace(/\bmidnight\b/g, '12am');
   const dates: string[] = [];
   const nextDow = (dow: number) => {
      for (let i = 0; i < 7; i++) {
         const d = addDays(now.date, i);
         if (weekday(d) === dow) return d;
      }
      return now.date;
   };
   const dayText = t.replace(NEXT_WEEK, ' ');
   if (/\b(today|ngayon|mamaya|later|tonight|ngayong|sekarang|nanti)\b/.test(dayText)) dates.push(now.date);
   if (/\b(tomorrow|tmrw|tmr|bukas|besok)\b/.test(dayText)) dates.push(addDays(now.date, 1));
   if (/weekend/.test(dayText)) dates.push(nextDow(6), nextDow(0));
   for (const [re, dow] of DAYS) if (re.test(dayText)) dates.push(nextDow(dow));
   // "next week" with no day named: the first weekdays of next week.
   if (NEXT_WEEK.test(t) && !dates.length) {
      const mon = addDays(nextDow(1), nextDow(1) === now.date ? 7 : 0);
      for (let i = 0; i < 4; i++) dates.push(addDays(mon, i));
   }
   let from: number | null = null, to: number | null = null, at: string | null = null;
   let m: RegExpExecArray | null;
   if ((m = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:-|–|to|hanggang|until)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/.exec(t)) && (m[3] || m[6] || m[2] || m[5])) {
      // A range: "3 to 5pm", "2-4pm", "10am-12pm". The end's am/pm carries over to the start.
      from = hourOf(m[1], m[2], m[3] || m[6], t);
      to = hourOf(m[4], m[5], m[6], t);
      if (from > to && !m[3]) from -= 12 * 60;
   } else if ((m = /(after|pagkatapos ng|from)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/.exec(t))) {
      from = hourOf(m[2], m[3], m[4], t);
      to = Math.max(21 * 60, from + 60);
   } else if ((m = /(before|bago)\s*(?:mag\s*)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/.exec(t))) {
      to = hourOf(m[2], m[3], m[4], t);
      from = Math.min(9 * 60, to - 60);
   } else if ((m = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/.exec(t)) || (m = /\b(?:at|alas|around|mga|jam)\s*(\d{1,2})(?::(\d{2}))?\b/.exec(t)) || (m = /\b([01]?\d|2[0-3]):([0-5]\d)\b/.exec(t))) {
      const c = m[0].includes(':') && Number(m[1]) > 12 ? Number(m[1]) * 60 + Number(m[2]) : hourOf(m[1], m[2], m[3], t);
      from = c - 30;
      to = c + 30;
      at = hhmm(c);
   } else if (/morning|umaga|pagi/.test(t)) [from, to] = [8 * 60, 12 * 60];
   else if (/\b(lunch|tanghali|siang)\b/.test(t)) [from, to] = [11 * 60, 13 * 60];
   else if (/afternoon|hapon|sore/.test(t)) [from, to] = [12 * 60, 17 * 60];
   else if (/evening|night|gabi|tonight|malam/.test(t)) [from, to] = [17 * 60, 21 * 60];
   const anytime = /\b(any ?time|kahit kailan|kahit anong oras|whenever|kahit ano|kapan saja)\b/.test(t);
   if (!dates.length && from === null) return { windows: [], at: null, anytime, unclear: !anytime, lang: guessLang(t), summary: anytime ? 'any time' : '' };
   if (!dates.length) dates.push(to !== null && to > now.min + 120 ? now.date : addDays(now.date, 1));
   if (from === null || to === null) [from, to] = [9 * 60, 21 * 60];
   const windows = [...new Set(dates)].map((date) => ({ date, from: hhmm(from as number), to: hhmm(to as number) }));
   return { windows: windows.slice(0, at ? 1 : 4), at, anytime: false, unclear: false, lang: guessLang(t), summary: '' };
};

// ---------------------------------------------------------------------------------------------------
// Matching: the windows they asked for → the 3 closest free times
// ---------------------------------------------------------------------------------------------------

export const match = (parsed: Parsed, free: Slot[]): OfferResult => {
   if (parsed.anytime) return { picks: free.slice(0, 3), exact: true };
   const at = parsed.windows[0] ? toMin(parsed.at) : null;
   if (at !== null && parsed.windows[0]) {
      // One exact time ("tomorrow at 9pm"): is it free? Then the free times nearest to it —
      // same day first, then the same time of day on the nearest other days.
      const date = parsed.windows[0].date;
      const hit = free.find((s) => s.date === date && s.min === at) ?? null;
      const dayGap = (s: Slot) => Math.abs(absMin(s.date, 0) - absMin(date, 0)) / 1440;
      const score = (s: Slot) => (s.date === date ? Math.abs(s.min - at) : dayGap(s) * 240 + Math.abs(s.min - at));
      const near = free.filter((s) => s !== hit).sort((a, b) => score(a) - score(b));
      return { picks: hit ? [hit, ...near.slice(0, 2)] : near.slice(0, 3), exact: !!hit, asked: { date, min: at }, dayFull: !free.some((s) => s.date === date) };
   }
   const picks: Slot[] = [];
   for (const w of parsed.windows) {
      const from = toMin(w.from) ?? 9 * 60, to = toMin(w.to) ?? 21 * 60;
      const inside = free.filter((s) => s.date === w.date && s.min >= from && s.min + 15 <= to);
      const mid = (from + to) / 2;
      inside.sort((a, b) => (to - from <= 90 ? Math.abs(a.min - mid) - Math.abs(b.min - mid) : a.min - b.min));
      for (const s of inside) if (!picks.includes(s) && picks.length < 3) picks.push(s);
   }
   picks.sort((a, b) => a.date.localeCompare(b.date) || a.min - b.min);
   if (picks.length >= 3) return { picks, exact: true };
   const w0 = parsed.windows[0];
   const target = w0 ? absMin(w0.date, ((toMin(w0.from) ?? 540) + (toMin(w0.to) ?? 1260)) / 2) : 0;
   const byDistance = (a: Slot, b: Slot) => Math.abs(absMin(a.date, a.min) - target) - Math.abs(absMin(b.date, b.min) - target);
   if (picks.length) {
      // Fewer than 3 inside their window: top up with the free times nearest to it.
      const more = free.filter((s) => !picks.includes(s)).sort(byDistance);
      return { picks: [...picks, ...more.slice(0, 3 - picks.length)], exact: true, inside: picks.length };
   }
   const near = [...free].sort(byDistance).slice(0, 3);
   near.sort((a, b) => a.date.localeCompare(b.date) || a.min - b.min);
   return { picks: near, exact: false };
};

// ---------------------------------------------------------------------------------------------------
// The conversation
// ---------------------------------------------------------------------------------------------------

export const newState = (p: Profile = profileFromUser()): BotState => ({
   market: p.market,
   zoneName: p.zoneName,
   lang: p.lang,
   knownName: p.firstName,
   known: { ...p.known },
   step: 'ask',
   mine: null,
   booked: false,
   kept: null,
   offered: [],
   lastOffer: null,
   answers: {},
   asked: [],
   reasked: [],
   quizDone: false,
   changing: false,
   name: '',
   lastButtons: []
});

/** The first messages after Messenger is connected. bioDone false → send them back to the app first. */
export const greet = (state: BotState, bioDone = true): Result => {
   const st = structuredClone(state);
   const replies: Reply[] = [{ text: tr(st.lang, 'connected', st.knownName ?? '') }];
   if (bioDone) {
      st.step = 'ask';
      replies.push({ text: tr(st.lang, 'ask') });
   } else {
      st.step = 'waiting_bio';
      replies.push({ text: tr(st.lang, 'bioMissing'), buttons: [{ title: tr(st.lang, 'backBtn'), payload: 'back' }] });
   }
   return { state: st, replies, events: [] };
};

/** The "Will you make it?" card (the real bot sends it 1 hour before the call). */
export const attendCard = (state: BotState): Reply => ({
   text: tr(state.lang, 'card'),
   card: true,
   buttons: [
      { title: tr(state.lang, 'attendBtn'), payload: 'attend' },
      { title: tr(state.lang, 'changeBtn'), payload: 'change' }
   ]
});

type Turn = { st: BotState; ctx: Ctx; m: Market; Q: Record<string, Question>; replies: Reply[]; events: BotEvent[] };
const say = (t: Turn, key: string, ...a: string[]) => tr(t.st.lang, key, ...a);
const send = (t: Turn, text: string, buttons?: Button[]) => t.replies.push(buttons?.length ? { text, buttons } : { text });
const when = (t: Turn, s: Slot) => longWhen(s, t.st.lang, t.st.zoneName);
const release = (t: Turn, why: Extract<BotEvent, { type: 'release' }>['why']) => {
   if (!t.st.mine) return;
   t.events.push({ type: 'release', slot: t.st.mine, why });
   t.st.mine = null;
   t.st.booked = false;
};

// ---- holding and confirming ----
const heldButtons = (t: Turn): Button[] => [{ title: say(t, 'otherBtn'), payload: 'other_held' }];
const askFinalConfirm = (t: Turn) => {
   const s = t.st.mine as Slot;
   send(t, say(t, 'confirmTime', when(t, s), s.host), heldButtons(t));
   t.st.step = 'held';
};
const hold = (t: Turn, s: Slot) => {
   t.st.offered = [];
   t.st.changing = false;
   // Moving a booked call: it stays booked until the new time is (bookCall then cancels it).
   if (t.st.booked && t.st.mine && !sameSlot(t.st.mine, s)) t.st.kept = t.st.mine;
   if (t.st.mine && !sameSlot(t.st.mine, s)) release(t, 'moved');
   t.st.mine = s;
   t.st.booked = false;
   t.events.push({ type: 'hold', slot: s });
   if (t.st.quizDone) return askFinalConfirm(t);
   if (t.st.asked.length) {
      send(t, say(t, 'resume', when(t, s), s.host));
      return askNext(t);
   }
   t.st.answers = { ...t.st.known };
   t.st.reasked = [];
   send(t, say(t, 'holding', when(t, s), s.host));
   askNext(t);
};
/** Same person? First names match, or one starts the other ("Ma. Cristina" / "Maria"). */
export const sameFirstName = (a: string, b: string) => {
   const x = norm(a).replace(/[^\p{L}]/gu, ''), y = norm(b).replace(/[^\p{L}]/gu, '');
   return !!x && !!y && (x === y || (Math.min(x.length, y.length) >= 2 && (x.startsWith(y) || y.startsWith(x))));
};
const book = async (t: Turn, name: string) => {
   const s = t.st.mine as Slot;
   // The typed name is a light security check: never shown back, never blocking — the team just sees a mismatch.
   if (t.st.knownName && !sameFirstName(name, t.st.knownName)) t.events.push({ type: 'note', text: `Name check: they typed "${name}", their account says "${t.st.knownName}". Check their ID on the call.` });
   t.st.name = name;
   const r = t.ctx.book ? await t.ctx.book(s) : { ok: true as const, confirmed: false };
   if (!r.ok && r.why === 'taken') return lostTime(t, s, 'taken');
   if (!r.ok) {
      t.events.push({ type: 'note', text: 'Booking failed (not a taken slot) — they can type YES again, or the team books them by hand.' });
      t.st.step = 'held';
      return send(t, say(t, 'bookFailed'), heldButtons(t));
   }
   t.st.booked = true;
   t.st.kept = null;
   t.st.step = 'booked';
   t.st.changing = false;
   t.events.push({ type: 'book', slot: s, name });
   // A real booking already sent the confirmation with its Zoom link and ✅ card (videoCall.sendBookedMessenger).
   if (r.confirmed) return;
   send(t, say(t, 'booked', when(t, s), name, s.host));
   send(t, say(t, 'promise', name));
};
/** Backing out of moving a booked call: the call they had is still booked. */
const restoreKept = (t: Turn) => {
   if (!t.st.kept) return false;
   t.st.mine = t.st.kept;
   t.st.booked = true;
   t.st.kept = null;
   return true;
};
/** Their time is gone (taken when we went to book it, or their hold ran out): the closest free times. Answers are kept. */
const lostTime = (t: Turn, s: Slot, why: 'taken' | 'lapsed') => {
   release(t, why);
   restoreKept(t);
   t.st.changing = false;
   t.st.step = t.st.booked ? 'booked' : 'ask';
   if (why === 'lapsed') send(t, say(t, 'lapsed'));
   const asked: Parsed = { windows: [{ date: s.date, from: hhmm(s.min), to: hhmm(s.min + 30) }], at: hhmm(s.min), anytime: false, unclear: false, lang: t.st.lang, summary: '' };
   offer(t, match(asked, t.ctx.free.filter((x) => !sameSlot(x, s))), '');
};
const allSet = (t: Turn) => send(t, say(t, 'allSet', t.st.name, when(t, t.st.mine as Slot)));

// ---- the questions ----
const nextKey = (t: Turn) => {
   const a = t.st.answers;
   // They support their kids: no need to ask whether they have kids.
   if (a.support === 'My kids' && !a.kids) a.kids = 'Yes';
   if (t.st.asked.length >= MAX_Q) return null;
   // Skip anything already answered (in chat, or in the app bio).
   return [...BASE, ...followUps(a)].find((k) => !t.st.asked.includes(k) && !(k in a)) ?? null;
};
const prepButtons = (t: Turn, key: string): Button[] => {
   const q = t.Q[key];
   const b: Button[] = (q.opts ?? []).map((op, i) => ({ title: op[t.st.lang], payload: `ans:${key}:${i}` }));
   if (q.money) b.push({ title: PNS[t.st.lang], payload: `ans:${key}:pns` });
   if (q.free) b.push({ title: say(t, 'skip'), payload: `ans:${key}:skip` });
   return b;
};
const askNext = (t: Turn) => {
   const key = nextKey(t);
   if (!key) return finishQuiz(t);
   t.st.asked.push(key);
   // Every path has at least 10 questions to choose from, so the count is always out of 10.
   send(t, say(t, 'question', String(t.st.asked.length), t.Q[key][t.st.lang]), prepButtons(t, key));
   t.st.step = 'prep';
};
const finishQuiz = (t: Turn) => {
   t.st.quizDone = true;
   t.events.push({ type: 'answers', answers: { ...t.st.answers }, fit: fitCheck(t.st.answers) });
   send(t, say(t, 'expectations', t.m.firstLoan), [{ title: say(t, 'gotIt'), payload: 'gotit' }]);
   t.st.step = 'expect';
};
const holdOff = (t: Turn, key: string, value: string | null) => {
   t.events.push({ type: 'heldOff', key, value });
   release(t, 'heldOff');
   t.st.asked = [];
   t.st.answers = { ...t.st.known };
   t.st.reasked = [];
   t.st.quizDone = false;
   send(t, say(t, 'heldOff'));
   t.st.step = 'ask';
};
/** value: English label, typed text, or null (skipped). undefined = typed "skip" on a non-money button question. */
const answerPrep = (t: Turn, value: string | null | undefined) => {
   const key = t.st.asked[t.st.asked.length - 1];
   const q = t.Q[key];
   if (value === undefined) return send(t, say(t, 'tapOne'), prepButtons(t, key));
   if (isDodge(q, key, value)) {
      // Second dodge on the same question: hold off, kindly. First: ask once more, same buttons.
      if (t.st.reasked.includes(key)) return holdOff(t, key, value);
      t.st.reasked.push(key);
      t.events.push({ type: 'reask', key, value });
      return send(t, say(t, q.free ? 'reaskType' : key === 'work' ? 'reaskOther' : 'reask'), prepButtons(t, key));
   }
   if (value) t.st.answers[key] = value;
   askNext(t);
};
const handlePrep = async (t: Turn, text: string) => {
   const key = t.st.asked[t.st.asked.length - 1];
   const q = t.Q[key];
   const n = norm(text).trim();
   // Typed "skip": a free-text question is skipped, a money question counts as "Prefer not to say".
   if (/^\s*(skip|laktawan)\s*$/.test(n)) return answerPrep(t, q.free ? null : q.money ? PNS.en : undefined);
   if (q.free) {
      if (DODGE.test(n) && n.split(/\s+/).length <= 4) return answerPrep(t, null);
      if (wantsChange(n) && looksLikeTime(n)) return changeMidQuiz(t, text);
      return answerPrep(t, text.trim().slice(0, 120));
   }
   const r = readTyped(q, key, text, t.m);
   if (r.pick !== undefined && q.opts?.[r.pick]) return answerPrep(t, q.opts[r.pick].en);
   if (looksLikeTime(n) && (wantsChange(n) || !SYN[key])) return changeMidQuiz(t, text);
   if (q.money && DODGE.test(n)) return answerPrep(t, PNS.en);
   send(t, say(t, r.unsure ? 'rangeNumber' : 'tapOne'), prepButtons(t, key));
};
/** They ask to move the call partway through: keep their answers, find a new time, then carry on. */
const changeMidQuiz = async (t: Turn, text: string) => {
   t.st.asked.pop();
   if (!(await readAndOffer(t, text, 'prep'))) {
      send(t, say(t, 'finishFirst'));
      askNext(t);
   }
};

// ---- offering times ----
const gap = (t: Turn, s: Slot, asked: { date: string; min: number }) => {
   const d = absMin(s.date, s.min) - absMin(asked.date, asked.min);
   if (d === 0) return '';
   const fil = t.st.lang === 'fil';
   if (s.date !== asked.date) return s.min === asked.min ? (fil ? ' (parehong oras)' : ' (same time)') : '';
   const n = Math.abs(d), amount = n % 60 === 0 ? `${n / 60} ${fil ? 'oras' : n === 60 ? 'hr' : 'hrs'}` : `${n} min`;
   return fil ? ` (${amount} ${d < 0 ? 'mas maaga' : 'mas huli'})` : ` (${amount} ${d < 0 ? 'earlier' : 'later'})`;
};
const offer = (t: Turn, result: OfferResult, summary: string) => {
   const { picks, exact, asked, dayFull, tooFar } = result;
   t.st.offered = picks;
   if (!picks.length) {
      t.events.push({ type: 'note', text: 'No free time in the next 7 days — the real bot would alert the team.' });
      return send(t, say(t, 'none'));
   }
   t.st.lastOffer = result;
   t.events.push({ type: 'offered', result, summary });
   const lang = t.st.lang;
   const askedText = asked ? `${fmtDay(asked.date, lang)} ${lang === 'fil' ? 'nang' : 'at'} ${fmtTime(asked.min)}` : '';
   const isMine = asked && t.st.mine && asked.date === t.st.mine.date && asked.min === t.st.mine.min;
   const intro = tooFar
      ? say(t, 'tooFar')
      : isMine
        ? say(t, 'askedMine', askedText)
        : asked && dayFull
          ? say(t, 'dayFull', fmtDayLong(asked.date, lang))
          : asked
            ? say(t, exact ? 'askedFree' : 'askedTaken', askedText)
            : say(t, exact ? 'offer' : 'near');
   // Details live in the text (buttons are capped at 20 characters).
   const list = picks.map((s, i) => `${i + 1}. ${fmtDay(s.date, lang)} · ${fmtTime(s.min)}${asked ? gap(t, s, asked) : ''}${i === 0 ? ' ⭐' : ''}`).join('\n');
   const mine = t.st.mine ? `\n${lang === 'fil' ? 'Oras mo ngayon' : 'Your time now'}: ${fmtDay(t.st.mine.date, lang)} · ${fmtTime(t.st.mine.min)}` : '';
   send(t, `${intro}\n\n${list}\n${mine}\n${say(t, 'pickHint')} ${say(t, 'tzNote', t.st.zoneName)}`.replace(/\n\n\n/g, '\n\n'), offerButtons(t, picks));
   t.st.step = 'offered';
};
const offerButtons = (t: Turn, picks: Slot[]): Button[] => {
   const b: Button[] = picks.map((s, i) => ({ title: `${i === 0 ? '⭐ ' : ''}${dayShort(s.date, t.st.lang)} · ${fmtTime(s.min)}`, payload: `slot:${slotKey(s)}` }));
   if (t.st.mine) b.push({ title: say(t, 'keepBtn'), payload: 'keep' });
   b.push({ title: say(t, 'otherBtn'), payload: 'other' });
   return b;
};
const reoffer = (t: Turn) => {
   const last = t.st.lastOffer as OfferResult;
   t.st.offered = last.picks;
   send(t, say(t, 'reoffer'), offerButtons(t, last.picks));
   t.st.step = 'offered';
};
const keepCurrent = (t: Turn) => {
   t.st.offered = [];
   t.st.changing = false;
   if (!t.st.mine) return;
   if (t.st.booked) {
      allSet(t);
      t.st.step = 'booked';
      return;
   }
   if (t.st.quizDone) return askFinalConfirm(t);
   askNext(t);
};
// "2", "the second one", "yung pangalawa", or a time that matches exactly one offered time.
const ORD = [/^(1|one|first|1st|una|unang|uno|#1)$/, /^(2|two|second|2nd|pangalawa|ikalawa|#2)$/, /^(3|three|third|3rd|pangatlo|ikatlo|#3)$/];
const PICK_FILL = new Set(['the', 'yung', 'ung', 'ang', 'po', 'option', 'number', 'choice', 'na', 'lang', 'please', 'pls', 'sige', 'ok', 'okay', 'take', 'gusto', 'ko', 'ako', 'sa', 'nalang', 'i', "i'll", 'ill', 'want', 'pick', 'yes', 'oo', 'opo', 'slot', 'time']);
const pickOffered = (t: Turn, text: string): Slot | null => {
   let ws = words(text).filter((w) => !PICK_FILL.has(w));
   if (ws.length === 2 && ws[1] === 'one') ws = [ws[0]];
   if (ws.length !== 1 && !(ws.length === 2 && /^(am|pm)$/.test(ws[1]))) return null;
   const core = ws.join('');
   const i = ORD.findIndex((re) => re.test(core));
   if (i >= 0) return t.st.offered[i] ?? null;
   const m = /^(\d{1,2})(?::(\d{2}))?(am|pm)?$/.exec(core);
   if (!m) return null;
   const h = Number(m[1]) % 12, mm = Number(m[2] || 0);
   const mins = m[3] === 'am' ? [h * 60 + mm] : m[3] === 'pm' ? [(h + 12) * 60 + mm] : Number(m[1]) > 12 ? [Number(m[1]) * 60 + mm] : [h * 60 + mm, (h + 12) * 60 + mm];
   const hits = t.st.offered.filter((s) => mins.includes(s.min));
   return hits.length === 1 ? hits[0] : null;
};

// ---- reading a day/time ----
const readTime = async (t: Turn, text: string): Promise<Parsed> => {
   const now = t.ctx.now;
   const t0 = Date.now();
   let error: string | undefined;
   if (t.ctx.readAi) {
      try {
         const r = await t.ctx.readAi(text, { weekday: WEEKDAYS[weekday(now.date)], date: now.date, time: hhmm(now.min) });
         const x = r?.read;
         if (x) {
            // "next week" came back unclear: the simple reader knows it (Mon–Thu of next week).
            if (x.unclear && NEXT_WEEK.test(text.toLowerCase())) {
               const parsed = ruleParse(text, now);
               t.events.push({ type: 'read', how: 'DeepSeek said unclear → rules (next week)', ms: Date.now() - t0, parsed });
               return parsed;
            }
            const parsed: Parsed = { windows: x.windows ?? [], at: x.at ?? null, anytime: !!x.anytime, unclear: !!x.unclear, lang: x.lang === 'fil' ? 'fil' : 'en', summary: String(x.summary ?? '').slice(0, 60) };
            t.events.push({ type: 'read', how: 'DeepSeek', ms: Date.now() - t0, parsed });
            return parsed;
         }
         error = r?.error ?? 'no answer';
      } catch (e) {
         error = e instanceof Error ? e.message : 'error';
      }
   }
   const parsed = ruleParse(text, now);
   t.events.push({ type: 'read', how: 'rules', ms: Date.now() - t0, parsed, error });
   return parsed;
};

/**
 * Read a message as a day/time and offer free times. False if there's no usable day or time.
 * Nothing they already have (a held or booked time) is let go here — only when they tap a new time.
 */
const readAndOffer = async (t: Turn, text: string, from: Step): Promise<boolean> => {
   const parsed = await readTime(t, text);
   // One-word replies ("ok", "3pm") don't switch the language. Indonesian is English for now.
   if (parsed.lang !== t.st.lang && words(text).length >= 2 && t.m.id === 'PH') t.st.lang = parsed.lang;
   if (parsed.unclear || (!parsed.anytime && !parsed.windows.length)) return false;
   const mine = t.st.mine;
   // They already have a time and name only a new hour ("4pm instead"): same day as the one they have.
   if (mine && parsed.windows.length && !DAY_WORD.test(norm(text))) {
      parsed.windows = parsed.windows.slice(0, 1).map((w) => ({ ...w, date: mine.date }));
      t.events.push({ type: 'note', text: `No day named, so reading it as ${fmtDay(mine.date, 'en')} (the day they already have).` });
   }
   // Booked and they mention the time they already have ("see you tomorrow!"): nothing to change.
   if (from === 'booked' && !t.st.changing && mine && parsed.windows.some((w) => w.date === mine.date && (toMin(w.from) ?? 0) <= mine.min && mine.min < (toMin(w.to) ?? 1440))) {
      allSet(t);
      t.st.step = 'booked';
      return true;
   }
   const result = match(parsed, t.ctx.free);
   // Everything they asked for is past the days we can book: say so, don't call it "fully booked".
   if (!parsed.anytime && t.ctx.lastDay && parsed.windows.every((w) => w.date > t.ctx.lastDay)) result.tooFar = true;
   offer(t, result, parsed.summary);
   return true;
};

/** They let go of the held time: ask for another (their booked call, if they were moving one, stays). */
const backOut = (t: Turn) => {
   if (restoreKept(t)) {
      send(t, say(t, 'otherKeep'));
      t.st.changing = true;
      t.st.step = 'booked';
      return;
   }
   send(t, say(t, 'other'));
   t.st.step = 'ask';
};

// ---- buttons ----
const handlePayload = (t: Turn, payload: string) => {
   const st = t.st;
   if (payload === 'back' && st.step === 'waiting_bio') {
      send(t, say(t, 'ask'));
      st.step = 'ask';
      return;
   }
   if (payload.startsWith('slot:')) {
      const s = st.offered.find((x) => `slot:${slotKey(x)}` === payload);
      if (s) hold(t, s);
      return; // a stale button: ignore
   }
   if (payload === 'keep' && st.step === 'offered') return keepCurrent(t);
   if (payload === 'other' && st.step === 'offered') {
      st.offered = [];
      if (st.mine && st.booked) {
         send(t, say(t, 'otherKeep'));
         st.changing = true;
         st.step = 'booked';
      } else {
         send(t, say(t, 'other'));
         st.step = 'ask';
      }
      return;
   }
   if (payload === 'other_held' && st.step === 'held') {
      release(t, 'other');
      return backOut(t);
   }
   if (payload.startsWith('ans:') && st.step === 'prep') {
      const [, key, v] = payload.split(':');
      if (key !== st.asked[st.asked.length - 1]) return; // an old question's button
      const q = t.Q[key];
      if (v === 'pns') return answerPrep(t, PNS.en);
      if (v === 'skip') return answerPrep(t, null);
      const op = q.opts?.[Number(v)];
      if (op) answerPrep(t, op.en);
      return;
   }
   if (payload === 'gotit' && st.step === 'expect') {
      t.events.push({ type: 'expectations' });
      return askFinalConfirm(t);
   }
   if (payload === 'attend' && st.booked && st.mine) {
      t.events.push({ type: 'attend', slot: st.mine });
      send(t, say(t, 'thanks'));
      return;
   }
   if (payload === 'change' && st.booked && st.mine) {
      send(t, say(t, 'otherKeep'));
      st.changing = true;
      st.step = 'booked';
   }
};

// ---- typed messages ----
const handleText = async (t: Turn, text: string) => {
   const st = t.st;
   if (st.step === 'waiting_bio') return send(t, say(t, 'bioMissing'), [{ title: say(t, 'backBtn'), payload: 'back' }]);
   if (st.step === 'prep') return handlePrep(t, text);
   if (st.step === 'expect') {
      t.events.push({ type: 'expectations' });
      return askFinalConfirm(t);
   }
   if (st.step === 'offered') {
      const s = pickOffered(t, text);
      if (s) return hold(t, s);
   }
   if (st.step === 'held' && st.mine) {
      const c = readConfirm(text);
      if (c.kind === 'yes') {
         // "YES Maria" in one go, or a moved call (we already have their name): book now.
         const name = c.name || st.name;
         if (name) return book(t, name);
         send(t, say(t, 'askName'));
         st.step = 'name';
         return;
      }
      if (c.kind === 'no') {
         release(t, 'no');
         return backOut(t);
      }
      if (c.kind === 'other') return send(t, say(t, 'sayYes'), heldButtons(t));
      // kind 'time': read it below.
   }
   // A name, unless it's clearly a new time ("actually tuesday 3pm is bad").
   if (st.step === 'name' && st.mine && !(words(text).length > 1 && (looksLikeTime(text) || wantsChange(text)))) {
      const name = firstName(text);
      return name ? book(t, name) : send(t, say(t, 'badName'));
   }
   if (st.step === 'booked' && st.mine && !looksLikeTime(text) && CANCEL.test(norm(text))) {
      const was = when(t, st.mine);
      if (t.ctx.cancel && !(await t.ctx.cancel())) return send(t, say(t, 'cancelFailed'));
      release(t, 'cancel');
      st.changing = false;
      send(t, say(t, 'cancelled', was));
      st.step = 'ask';
      return;
   }
   // Booked: "ok", "thanks", "can I bring a friend?" get a friendly reply; only a day/time moves the call.
   if (st.step === 'booked' && st.mine && !st.changing && !looksLikeTime(text)) {
      if (wantsChange(text)) {
         send(t, say(t, 'otherKeep'));
         st.changing = true;
         return;
      }
      return allSet(t);
   }
   const from = st.step;
   if (await readAndOffer(t, text, from)) return;
   // No usable day or time: whatever they had stays exactly as it was.
   if (from === 'offered' && st.lastOffer) return reoffer(t);
   if (from === 'held' && st.mine) return send(t, say(t, 'sayYes'), heldButtons(t));
   if (from === 'name' && st.mine) return send(t, say(t, 'askName'));
   if (from === 'booked' && st.mine) return send(t, st.changing ? say(t, 'unclearKeep', when(t, st.mine)) : say(t, 'allSet', st.name, when(t, st.mine)));
   send(t, say(t, 'unclear'));
   st.step = 'ask';
};

// ---- text-only channels (SendPulse sends plain text): buttons become a lettered list ----
const LETTERS = 'ABCDEFGHIJKLM';
/** The buttons that get a letter: time buttons are already numbered in the message text. */
const lettered = (buttons: Button[]) => buttons.filter((b) => !b.payload.startsWith('slot:'));
const bare = (s: string) => norm(s).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
/** Typing a button's text, or its letter from plainText, taps it. */
export const buttonFor = (st: BotState, text: string): Button | null => {
   const b = st.lastButtons ?? [];
   const t = bare(text);
   if (!t) return null;
   const byTitle = b.find((x) => bare(x.title) === t);
   if (byTitle) return byTitle;
   const m = /^\s*\(?([a-m])\)?[.)]?\s*$/i.exec(text);
   return m ? (lettered(b)[LETTERS.indexOf(m[1].toUpperCase())] ?? null) : null;
};
/** A reply as one plain message: its text, then "A) …" for each lettered button. */
export const plainText = (reply: Reply, lang: Lang = 'en') => {
   const opts = lettered(reply.buttons ?? []);
   if (!opts.length) return reply.text;
   const list = opts.map((b, i) => `${LETTERS[i]}) ${b.title}`).join('\n');
   const hint = lang === 'fil' ? 'Sumagot ng letra (A, B…) o i-type ang sagot mo.' : 'Reply with a letter (A, B…) or type your answer.';
   return `${reply.text}\n\n${list}\n\n${hint}`;
};

/** One turn: their message (text) or a button tap (payload) → new state, replies, events. Never mutates `state`. */
export const step = async (state: BotState, input: Input, ctx: Ctx): Promise<Result> => {
   const st = structuredClone(state);
   st.lastButtons ??= [];
   st.kept ??= null;
   const m = MARKETS[st.market] ?? MARKETS.PH;
   const t: Turn = { st, ctx, m, Q: questions(m), replies: [], events: [] };
   const text = input.text?.trim().slice(0, 400) ?? '';
   const tapped = !input.payload && text ? buttonFor(st, text) : null;
   // Their hold ran out and the time is gone: say so and offer the closest (this message isn't read).
   if (ctx.lapsed && st.mine && !st.booked) lostTime(t, st.mine, 'lapsed');
   else if (input.payload || tapped) handlePayload(t, (input.payload || tapped?.payload) as string);
   else if (text) await handleText(t, text);
   // What's on screen now: the buttons of our last message (none if it had none).
   if (t.replies.length) t.st.lastButtons = t.replies[t.replies.length - 1].buttons ?? [];
   return { state: t.st, replies: t.replies, events: t.events };
};
