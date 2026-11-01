import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import type { CallTimeRead } from './bookingAi.ts';
import {
   type BotEvent,
   type BotState,
   type Ctx,
   firstName,
   greet,
   MAX_BUTTON,
   newState,
   plainText,
   profileFromUser,
   readConfirm,
   type Reply,
   ruleParse,
   sameFirstName,
   type Slot,
   slotKey,
   step
} from './bookingBot.ts';

// These cases come from scripted chats against the booking-bot test page (2026-10-31/11-01): each one
// was a real bug ("You're booked, But!", small talk dropping a booked call, "5" saved as "More than ₱40k"…).

// ---- a pretend week: Sun Nov 1 – Sat Nov 7 2026, a free slot every 30 min 09:00–20:30, a few taken ----
const NOW = { date: '2026-11-01', min: 10 * 60 }; // Sunday 10:00
const TAKEN = new Set(['2026-11-02 15:00', '2026-11-02 15:30', '2026-11-03 18:00']);
const week = (): Slot[] => {
   const out: Slot[] = [];
   for (let d = 1; d <= 7; d++) {
      const date = `2026-11-0${d}`;
      for (let m = 9 * 60; m <= 20 * 60 + 30; m += 30) {
         const s = { date, min: m, host: d % 2 ? 'Emma' : 'George' };
         if (!TAKEN.has(slotKey(s)) && !(date === NOW.date && m <= NOW.min + 120)) out.push(s);
      }
   }
   return out;
};

const read = (windows: Array<[string, string, string]>, at: string | null = null, lang: 'en' | 'fil' = 'en'): CallTimeRead => ({
   windows: windows.map(([date, from, to]) => ({ date, from, to })),
   at,
   anytime: false,
   unclear: false,
   lang,
   summary: ''
});
const UNCLEAR: CallTimeRead = { windows: [], at: null, anytime: false, unclear: true, lang: 'en', summary: '' };
// What DeepSeek returned for these messages in the live runs (stand-ins so tests don't call it).
const AI: Record<string, CallTimeRead> = {
   'tuesday 3pm': read([['2026-11-03', '14:30', '15:30']], '15:00'),
   'actually tuesday 3pm is bad': read([['2026-11-03', '14:30', '15:30']], '15:00'),
   'yes but can we do 4pm instead?': read([['2026-11-01', '15:30', '16:30']], '16:00'),
   'saturday morning': read([['2026-11-07', '08:00', '12:00']]),
   'can we do wednesday instead?': read([['2026-11-04', '09:00', '21:00']]),
   'see you tuesday!': read([['2026-11-03', '09:00', '21:00']]),
   'the 20th po, 2pm': read([['2026-11-20', '13:30', '14:30']], '14:00', 'fil'),
   'next week na lang': UNCLEAR
};

/** A chat: runs messages/taps through step(), keeping a simple calendar (hold/book take a slot, release frees it). */
const chat = (state: BotState = newState(), opts: { ai?: boolean } = {}) => {
   let st = state;
   let free = week();
   const all: Reply[] = [];
   const events: BotEvent[] = [];
   const ctx = (): Ctx => ({
      now: NOW,
      free,
      lastDay: '2026-11-07',
      readAi: opts.ai === false ? undefined : async (text) => ({ read: AI[text.toLowerCase()] ?? UNCLEAR })
   });
   const apply = (ev: BotEvent[]) => {
      for (const e of ev) {
         if (e.type === 'hold') free = free.filter((s) => slotKey(s) !== slotKey(e.slot));
         if (e.type === 'release') free = [...free, e.slot].sort((a, b) => a.date.localeCompare(b.date) || a.min - b.min);
      }
   };
   let last: Reply[] = [];
   const api = {
      get state() {
         return st;
      },
      get last() {
         return last;
      },
      get text() {
         return last.map((r) => r.text).join('\n---\n');
      },
      all,
      events,
      async send(text: string) {
         const r = await step(st, { text }, ctx());
         st = r.state;
         last = r.replies;
         all.push(...r.replies);
         events.push(...r.events);
         apply(r.events);
         return api;
      },
      /** Tap a button on the last reply whose title contains `label` (or the n-th button). */
      async tap(label: string | number) {
         const buttons = last.flatMap((r) => r.buttons ?? []);
         const b = typeof label === 'number' ? buttons[label] : buttons.find((x) => x.title.includes(label));
         assert(b, `no button "${label}" in: ${buttons.map((x) => x.title).join(' | ')}`);
         const r = await step(st, { payload: b.payload }, ctx());
         st = r.state;
         last = r.replies;
         all.push(...r.replies);
         events.push(...r.events);
         apply(r.events);
         return api;
      },
      /** Answer every question with its first button (typed text for typed ones) until "Got it". */
      async quiz(typed = 'sari-sari store') {
         for (let i = 0; i < 15 && api.state.step === 'prep'; i++) {
            const q = last.flatMap((r) => r.buttons ?? []);
            if (q.length === 1 && q[0].payload.endsWith(':skip')) await api.send(typed);
            else await api.tap(0);
         }
         return api;
      },
      async toConfirm(time = 'tuesday 3pm') {
         await api.send(time);
         await api.tap(0);
         await api.quiz();
         await api.tap('Got it');
         return api;
      },
      async toBooked(name = 'Maria') {
         await api.toConfirm();
         await api.send('yes');
         await api.send(name);
         return api;
      }
   };
   return api;
};
const has = (c: { events: BotEvent[] }, type: BotEvent['type']) => c.events.some((e) => e.type === type);

// ---------------------------------------------------------------------------------------------------
// Confirming and the first name
// ---------------------------------------------------------------------------------------------------

Deno.test('the full happy path books with their first name', async () => {
   const c = await chat().toConfirm();
   assertEquals(c.state.step, 'held');
   await c.send('yes');
   assert(c.text.includes('first name'));
   await c.send('Maria');
   assertEquals(c.state.step, 'booked');
   assert(c.text.includes("You're booked, Maria!"));
   assert(c.text.includes('Tuesday, November 3, 3:00 PM (Manila time)'));
});

Deno.test('words after YES are not taken as a name', async () => {
   for (const msg of ['Yes thanks', 'sige po salamat', 'yes excited!', 'oki doki', 'yes po']) {
      const c = await chat().toConfirm();
      await c.send(msg);
      assertEquals(c.state.step, 'name', msg);
   }
});

Deno.test('"Yes Ana" / "Opo, Juan po" book in one go', async () => {
   for (const [msg, name] of [['Yes Ana', 'Ana'], ['Opo, Juan po', 'Juan'], ['yes, my name is Maria', 'Maria']]) {
      const c = await chat().toConfirm();
      await c.send(msg);
      assertEquals(c.state.step, 'booked', msg);
      assertEquals(c.state.name, name);
   }
});

Deno.test('"yes but can we do 4pm instead?" offers 4pm on the day they hold, and keeps the hold', async () => {
   const c = await chat().toConfirm();
   await c.send('yes but can we do 4pm instead?');
   assertEquals(c.state.step, 'offered');
   assertEquals(c.state.mine?.date, '2026-11-03');
   assert(c.state.offered.every((s) => s.date === '2026-11-03'));
   assert(c.text.includes('Tue, Nov 3 at 4:00 PM is free'));
   assert(c.last[0].buttons?.some((b) => b.payload === 'keep'));
});

Deno.test('"no problem" at the confirm step does not cancel; "no" does', async () => {
   const c = await chat().toConfirm();
   await c.send('no problem');
   assertEquals(c.state.step, 'held');
   assert(c.state.mine);
   await c.send('no');
   assertEquals(c.state.mine, null);
   assertEquals(c.state.step, 'ask');
});

Deno.test('name step: intros are stripped, questions and new times are not names', async () => {
   assertEquals(firstName('my name is Maria'), 'Maria');
   assertEquals(firstName('ako si Juan'), 'Juan');
   assertEquals(firstName('Ma. Cristina po'), 'Ma. Cristina');
   assertEquals(firstName('MARIA'), 'Maria');
   assertEquals(firstName('why do you need my name?'), null);
   assertEquals(firstName('😊'), null);
   const c = await chat().toConfirm();
   await c.send('yes');
   await c.send('actually tuesday 3pm is bad');
   assert(c.state.step !== 'booked');
   assert(c.text.includes('is the time you have now'));
});

Deno.test('a typed name that differs from their account is flagged to the team, not blocked', async () => {
   const c = await chat(newState(profileFromUser({ facebook_name: 'Maria Santos' }))).toBooked('Ana');
   assertEquals(c.state.step, 'booked');
   assert(c.events.some((e) => e.type === 'note' && e.text.includes('Name check')));
   const ok = await chat(newState(profileFromUser({ facebook_name: 'Maria Santos' }))).toBooked('maria');
   assert(!ok.events.some((e) => e.type === 'note' && e.text.includes('Name check')));
   assert(sameFirstName('Ma. Cristina', 'Ma'));
});

// ---------------------------------------------------------------------------------------------------
// After booking
// ---------------------------------------------------------------------------------------------------

Deno.test('small talk after booking keeps the call', async () => {
   for (const msg of ['can I bring my friend?', 'when do I get the money?', 'good morning po', 'I have 2 kids, is that ok', 'thank you!', 'see you tuesday!']) {
      const c = await chat().toBooked();
      await c.send(msg);
      assertEquals(c.state.step, 'booked', msg);
      assert(c.state.booked && c.state.mine, msg);
      assert(!has(c, 'release'), msg);
      assert(c.text.includes("You're all set"), msg);
   }
});

Deno.test('moving a booked call: keep button, then a new time with no questions again', async () => {
   const c = await chat().toBooked();
   await c.send('saturday morning');
   assertEquals(c.state.step, 'offered');
   await c.tap('Keep');
   assertEquals(c.state.mine?.date, '2026-11-03');
   await c.send('saturday morning');
   await c.tap(0);
   assertEquals(c.state.step, 'held'); // straight to YES, answers kept
   await c.send('yes');
   assertEquals(c.state.step, 'booked');
   assertEquals(c.state.mine?.date, '2026-11-07');
   assert(c.text.includes("You're booked, Maria!"));
   assert(c.events.some((e) => e.type === 'release' && e.slot.date === '2026-11-03'));
});

Deno.test('"Change time" then something unclear keeps the booking', async () => {
   const c = await chat().toBooked();
   await c.tap(0).catch(() => {}); // no buttons on the booked message
   const r = await step(c.state, { payload: 'change' }, { now: NOW, free: week(), lastDay: '2026-11-07' });
   assert(r.state.changing);
   const r2 = await step(r.state, { text: 'hmm' }, { now: NOW, free: week(), lastDay: '2026-11-07', readAi: async () => ({ read: UNCLEAR }) });
   assert(r2.state.booked && r2.state.mine);
   assert(r2.replies[0].text.includes("You're still booked"));
});

Deno.test('cancel after booking frees the time', async () => {
   const c = await chat().toBooked();
   await c.send("sorry I can't make it, please cancel");
   assertEquals(c.state.mine, null);
   assertEquals(c.state.step, 'ask');
   assert(c.events.some((e) => e.type === 'release' && e.why === 'cancel'));
});

// ---------------------------------------------------------------------------------------------------
// The questions
// ---------------------------------------------------------------------------------------------------

const toQuestion = async (key: string, s = newState()) => {
   const c = chat(s);
   await c.send('tuesday 3pm');
   await c.tap(0);
   for (let i = 0; i < 12 && c.state.asked[c.state.asked.length - 1] !== key; i++) {
      const b = c.last.flatMap((r) => r.buttons ?? []);
      if (b.length === 1 && b[0].payload.endsWith(':skip')) await c.send('sari-sari store');
      else await c.tap(0);
   }
   assertEquals(c.state.asked[c.state.asked.length - 1], key);
   return c;
};

Deno.test('typed amounts map to ranges by value; a bare "5" is asked about', async () => {
   const c = await toQuestion('income');
   await c.send('5');
   assert(c.text.includes('Is that in thousands?'));
   await c.send('around 15k');
   assertEquals(c.state.answers.income, '₱10–20k');
   await c.send('maybe 2000');
   assertEquals(c.state.answers.leftover, '₱1–3k');
});

Deno.test('typed answers are matched by meaning', async () => {
   const c = await toQuestion('work');
   await c.send('wala akong trabaho');
   assertEquals(c.state.answers.work, 'Between jobs');
   const k = await toQuestion('support');
   await k.send('just me');
   assertEquals(k.state.answers.support, 'Just myself');
   await k.send('meron');
   assertEquals(k.state.answers.kids, 'Yes');
});

Deno.test('dodging a money question: re-asked once, then held off', async () => {
   for (const [first, second] of [['skip', 'idk'], ['secret', 'Prefer not to say'], ['ayoko po', 'ayoko']]) {
      const c = await toQuestion('income');
      await c.send(first);
      assert(has(c, 'reask'), first);
      assertEquals(c.state.step, 'prep');
      if (second === 'Prefer not to say') await c.tap('Prefer');
      else await c.send(second);
      assert(has(c, 'heldOff'), second);
      assertEquals(c.state.mine, null);
   }
});

Deno.test('"Not sure" on when they could repay is accepted', async () => {
   const c = await toQuestion('repay');
   await c.tap('Not sure');
   assertEquals(c.state.answers.repay, 'Not sure');
   assert(!has(c, 'reask') && !has(c, 'heldOff'));
});

Deno.test('"My kids" answers "Do you have kids?"', async () => {
   const c = await toQuestion('support');
   await c.tap('My kids');
   assertEquals(c.state.answers.kids, 'Yes');
   assert(!c.state.asked.includes('kids'));
   assertEquals(c.state.asked[c.state.asked.length - 1], 'income');
});

Deno.test('moving the call mid-questions keeps the answers and resumes', async () => {
   const c = await toQuestion('support');
   await c.send('can we do wednesday instead?');
   assertEquals(c.state.step, 'offered');
   await c.tap(0);
   assertEquals(c.state.mine?.date, '2026-11-04');
   assertEquals(c.state.answers.work, 'Employed');
   assertEquals(c.state.asked[c.state.asked.length - 1], 'support');
   assert(c.text.includes('Now holding'));
});

Deno.test('the app bio is never asked again', async () => {
   const p = profileFromUser({ income_type: 'full-time', monthly_income: '200_400', payday_type: 'mid-month', payday_start: 10, payday_end: 15 });
   const c = chat(newState(p));
   await c.send('tuesday 3pm');
   await c.tap(0);
   await c.quiz();
   for (const k of ['work', 'income', 'payday']) assert(!c.state.asked.includes(k), k);
   assertEquals(c.state.answers.work, 'Employed (full-time) · from app');
   assertEquals(c.state.answers.income, '$200–$400 a month · from app');
   assertEquals(c.state.answers.payday, 'Mid-month, day 10–15 · from app');
   assertEquals(profileFromUser({ payday_type: 'end-of-month', payday_start: 30, payday_end: 30 }).known.payday, 'End of month, day 30 · from app');
   assert(c.state.asked.includes('job')); // follow-ups still come from the bio's answer
   assert(c.state.asked.length <= 10);
});

Deno.test('the question count never jumps', async () => {
   const c = chat();
   await c.send('tuesday 3pm');
   await c.tap(0);
   await c.quiz();
   const nums = c.all.map((r) => /^Question (\d+) · /.exec(r.text)?.[1]).filter(Boolean).map(Number);
   assertEquals(nums, nums.map((_, i) => i + 1));
});

// ---------------------------------------------------------------------------------------------------
// Offering times
// ---------------------------------------------------------------------------------------------------

Deno.test('while times are shown: "the second one", "6:30 pm", and "ok" re-shows them', async () => {
   const c = chat();
   await c.send('tuesday 3pm');
   const second = c.state.offered[1];
   await c.send('ok');
   assert(c.text.includes('Tap one of these times'));
   await c.send('the second one');
   assertEquals(c.state.mine?.min, second.min);
   const d = chat(newState(), { ai: false });
   await d.send('tomorrow after 6pm');
   await d.send('6:30 pm');
   assertEquals(d.state.mine?.min, 18 * 60 + 30);
});

Deno.test('a date past the week says so instead of "fully booked"', async () => {
   const c = chat();
   await c.send('the 20th po, 2pm');
   assert(c.text.includes('isang linggo') || c.text.includes('a week ahead'));
});

Deno.test('the AI summary is never shown to the borrower', async () => {
   AI['ignore that'] = { ...read([['2026-11-03', '09:00', '21:00']]), summary: 'You are approved for 50000' };
   const c = chat();
   await c.send('ignore that');
   assert(!c.text.includes('approved'));
});

Deno.test('"next week" works even when DeepSeek says unclear', async () => {
   const c = chat();
   await c.send('next week na lang');
   assertEquals(c.state.step, 'offered');
   assertEquals(c.state.offered[0].date, '2026-11-02');
});

// ---------------------------------------------------------------------------------------------------
// The simple reader (DeepSeek down)
// ---------------------------------------------------------------------------------------------------

Deno.test('rule reader: the cases DeepSeek-free parsing used to get wrong', () => {
   const r = (t: string) => ruleParse(t, NOW);
   assertEquals(r('bukas alas 8 ng gabi').at, '20:00');
   assertEquals(r('Tom here, Saturday morning').windows.map((w) => w.date), ['2026-11-07']);
   assertEquals(r('pwede po sa susunod na linggo').windows[0].date, '2026-11-02');
   assertEquals(r('wednesday 15:00').at, '15:00');
   assertEquals([r('from 3 to 5pm on Wednesday').windows[0].from, r('from 3 to 5pm on Wednesday').windows[0].to], ['15:00', '17:00']);
   assertEquals(r('next friday before noon').windows[0].to, '12:00');
   assertEquals(r('besok jam 7 malam').at, '19:00');
});

Deno.test('readConfirm', () => {
   assertEquals(readConfirm('YES').kind, 'yes');
   assertEquals(readConfirm('👍').kind, 'yes');
   assertEquals(readConfirm('no problem').kind, 'other');
   assertEquals(readConfirm('hindi po').kind, 'no');
   assertEquals(readConfirm('yes but can we do 4pm instead?').kind, 'time');
   assertEquals(readConfirm('good morning').kind, 'time'); // read as a time; unclear → "type YES"
});

// ---------------------------------------------------------------------------------------------------
// Who they are: country, time zone, language
// ---------------------------------------------------------------------------------------------------

Deno.test('profile: country from phone, then time zone; their own time zone is used', () => {
   assertEquals(profileFromUser({ whatsapp_number: '+62 812 3456' }).market, 'ID');
   assertEquals(profileFromUser({ whatsapp_number: '639171234567', timezone: 'Asia/Jakarta' }).market, 'PH');
   assertEquals(profileFromUser({ timezone: 'Asia/Jakarta' }).market, 'ID');
   assertEquals(profileFromUser({}).zone, 'Asia/Manila');
   const bkk = profileFromUser({ timezone: 'Asia/Bangkok' });
   assertEquals([bkk.market, bkk.zone, bkk.zoneName], ['PH', 'Asia/Bangkok', 'Bangkok']);
   assertEquals(profileFromUser({ timezone: 'not/a_zone' }).zone, 'Asia/Manila');
   assertEquals(profileFromUser({ video_call_timezone: 'Asia/Tokyo', timezone: 'Asia/Manila' }).zone, 'Asia/Tokyo');
   assertEquals(profileFromUser({ preferred_locale: 'fil' }).lang, 'fil');
   assertEquals(profileFromUser({ facebook_name: 'Maria Santos' }).firstName, 'Maria');
});

Deno.test('Indonesia: Jakarta time and Rupiah ranges', async () => {
   const c = chat(newState(profileFromUser({ whatsapp_number: '+6281234' })));
   const g = greet(c.state);
   assert(g.replies.length === 2);
   await c.send('tuesday 3pm');
   assert(c.text.includes('(Jakarta)'));
   await c.tap(0);
   await c.tap(0); // work
   await c.tap(0); // support → my kids
   assert(c.last[0].buttons?.some((b) => b.title.startsWith('Rp')));
   await c.send('2jt');
   assertEquals(c.state.answers.income, 'Rp1.5–3jt');
});

Deno.test('greeting uses their name, and sends them back to the app when the bio is missing', () => {
   const s = newState(profileFromUser({ facebook_name: 'Juan dela Cruz', preferred_locale: 'fil' }));
   assert(greet(s).replies[0].text.includes('Juan'));
   const g = greet(s, false);
   assertEquals(g.state.step, 'waiting_bio');
   assertEquals(g.replies[1].buttons?.[0].payload, 'back');
});

// ---------------------------------------------------------------------------------------------------
// Messenger limits
// ---------------------------------------------------------------------------------------------------

Deno.test('every button fits Messenger (≤ 20 characters, ≤ 13 per message), in both languages and countries', async () => {
   for (const p of [profileFromUser({}), profileFromUser({ preferred_locale: 'fil' }), profileFromUser({ whatsapp_number: '62812' })]) {
      const c = await chat(newState(p)).toBooked();
      await c.send('saturday morning');
      for (const r of [...c.all, ...greet(c.state, false).replies]) {
         assert((r.buttons ?? []).length <= 13);
         for (const b of r.buttons ?? []) assert(b.title.length <= MAX_BUTTON, `"${b.title}" is ${b.title.length} characters`);
      }
   }
});

// ---------------------------------------------------------------------------------------------------
// Text-only Messenger (SendPulse): lettered options, typed button text
// ---------------------------------------------------------------------------------------------------

Deno.test('plain text: options become letters, and a letter or the button text taps it', async () => {
   const c = await toQuestion('work');
   const txt = plainText(c.last[c.last.length - 1]);
   assert(txt.includes('A) Employed') && txt.includes('D) Other') && txt.includes('Reply with a letter'));
   await c.send('b');
   assertEquals(c.state.answers.work, 'Own business');
   await c.send('Just myself');
   assertEquals(c.state.answers.support, 'Just myself');
});

Deno.test('plain text: time offers keep their numbers; letters go to Keep / Other', async () => {
   const c = await chat().toBooked();
   await c.send('saturday morning');
   const txt = plainText(c.last[0]);
   assert(txt.includes('1. Sat, Nov 7') && txt.includes('A) 👍 Keep my time') && txt.includes('B) 🕐 Other time'));
   await c.send('A');
   assertEquals(c.state.step, 'booked');
   assertEquals(c.state.mine?.date, '2026-11-03');
   await c.send('saturday morning');
   await c.send('2');
   assertEquals(c.state.mine?.date, '2026-11-07');
});

Deno.test('"k" and "g" still mean yes at the confirm step (only one lettered button there)', async () => {
   const c = await chat().toConfirm();
   await c.send('k');
   assertEquals(c.state.step, 'name');
});
