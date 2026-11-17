import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { lastTypedAt } from './sendpulse.ts';
import {
   alertTexts,
   answerRecord,
   freeFromSlots,
   holdColumns,
   isPhMobile,
   KEEP_SPOT_REPLY,
   START,
   TEAM_QUIET_MS,
   teamHasChat,
   wallNow,
   withoutHeld,
   zonedIso
} from './messengerBookingBot.ts';

Deno.test('wallNow: the wall clock in a zone', () => {
   const at = new Date('2026-11-01T18:30:00Z');
   assertEquals(wallNow('Asia/Manila', at), { date: '2026-11-02', min: 2 * 60 + 30 });
   assertEquals(wallNow('Asia/Jakarta', at), { date: '2026-11-02', min: 1 * 60 + 30 });
});

Deno.test('freeFromSlots: local times, hosts, 2+ hours away, 7 days', () => {
   const now = { date: '2026-11-01', min: 10 * 60 };
   const all = ['2026-11-01T11:00:00.000+08:00', '2026-11-01T12:30:00.000+08:00', ...Array.from({ length: 9 }, (_, i) => `2026-11-${String(2 + i).padStart(2, '0')}T09:00:00.000+08:00`)];
   const free = freeFromSlots({ all, hosts: { [all[1]]: 'george' } }, now);
   assertEquals(free[0], { date: '2026-11-01', min: 12 * 60 + 30, host: 'George' });
   assertEquals(new Set(free.map((s) => s.date)).size, 7);
});

Deno.test('START: what begins a booking chat', () => {
   for (const t of ['book', 'BOOK', 'Book a call', 'mag-book po', 'schedule a call']) assertEquals(START.test(t), true, t);
   for (const t of ['hi', 'when is my loan due', 'facebook']) assertEquals(START.test(t), false, t);
});

Deno.test('zonedIso: a wall-clock time in a zone → UTC', () => {
   assertEquals(zonedIso({ date: '2026-11-03', min: 15 * 60 }, 'Asia/Manila'), '2026-11-03T07:00:00.000Z');
   assertEquals(zonedIso({ date: '2026-11-03', min: 30 }, 'Asia/Jakarta'), '2026-11-02T17:30:00.000Z');
});

Deno.test('withoutHeld: times other chats hold are not offered, in any zone', () => {
   const free = [
      { date: '2026-11-03', min: 15 * 60, host: 'Emma' },
      { date: '2026-11-03', min: 15 * 60 + 30, host: 'Emma' }
   ];
   // Someone in Jakarta holds 14:00 WIB = 15:00 Manila.
   assertEquals(withoutHeld(free, ['2026-11-03T07:00:00.000Z'], 'Asia/Manila'), [free[1]]);
});

Deno.test('holdColumns: held → 15 minutes from now; booked or nothing → cleared', () => {
   const st = { mine: { date: '2026-11-03', min: 15 * 60, host: 'Emma' }, booked: false } as never;
   const now = Date.parse('2026-11-01T02:00:00Z');
   assertEquals(holdColumns(st, 'Asia/Manila', now), { held_start: '2026-11-03T07:00:00.000Z', held_until: '2026-11-01T02:15:00.000Z' });
   assertEquals(holdColumns({ mine: null, booked: false } as never, 'Asia/Manila', now), { held_start: null, held_until: null });
});

Deno.test('alertTexts: call prep with the fit check, held off, name check; nothing for ordinary turns', async () => {
   const Bot = await import('./bookingBot.ts');
   const st = { ...Bot.newState(Bot.profileFromUser({ whatsapp_number: '+6281234' })), mine: { date: '2026-11-03', min: 15 * 60, host: 'Emma' } };
   const who = { name: 'Siti Rahma', isTest: true };
   const [prep] = alertTexts([{ type: 'answers', answers: { work: 'Employed', income: 'Rp2–4jt', loanUse: 'school fees' }, fit: { verdict: 'good', reason: 'has income' } }], st, who);
   assert(prep.includes('📝 Booking bot · call prep') && prep.includes('Siti Rahma · 🧪 test account · ID · chat in Bahasa Indonesia'));
   assert(prep.includes('Holding Tuesday, November 3, 3:00 PM (Jakarta time)'));
   assert(prep.includes('🟢 Fit check') && prep.includes('• Are you working right now? Employed') && prep.includes('school fees'));
   const [held] = alertTexts([{ type: 'heldOff', key: 'income', value: 'Prefer not to say', answers: { work: 'Employed' } }], st, who);
   assert(held.includes('held off') && held.includes('About how much came in last month?') && held.includes('• Are you working right now? Employed'));
   assertEquals(alertTexts([{ type: 'note', text: 'Name check: they typed "Ana", their account says "Siti".' }], st, who).length, 1);
   assertEquals(alertTexts([{ type: 'note', text: 'No day named, so reading it as Tue.' }, { type: 'hold', slot: st.mine }], st, who).length, 0);
});

Deno.test('answerRecord: saved answers for the call sheet (questions in English), held off with answers so far', async () => {
   const Bot = await import('./bookingBot.ts');
   const st = { ...Bot.newState(Bot.profileFromUser({ preferred_locale: 'fil' })), mine: { date: '2026-11-03', min: 15 * 60, host: 'Emma' } };
   const rec = answerRecord({ type: 'answers', answers: { work: 'Employed', job: 'cashier' }, fit: { verdict: 'talk', reason: 'tight money' } }, st, 'Asia/Manila', 'u1');
   assertEquals(rec, {
      user_id: 'u1',
      items: [{ q: 'Are you working right now?', a: 'Employed' }, { q: "What's your job? (just type it)", a: 'cashier' }],
      lang: 'fil',
      market: 'PH',
      holding_at: '2026-11-03T07:00:00.000Z',
      kind: 'answers',
      fit_verdict: 'talk',
      fit_reason: 'tight money',
      checks: []
   });
   const held = answerRecord({ type: 'heldOff', key: 'income', value: null, answers: { work: 'Employed' } }, { ...st, mine: null }, 'Asia/Manila', 'u1');
   assertEquals(held?.kind, 'held_off');
   assertEquals((held as { held_off_value: string }).held_off_value, 'skipped');
   assertEquals(answerRecord({ type: 'hold', slot: st.mine }, st, 'Asia/Manila', 'u1'), null);
});

Deno.test('answers are listed in asking order, whatever order the saved chat gives them', async () => {
   const Bot = await import('./bookingBot.ts');
   const st = Bot.newState(Bot.profileFromUser({}));
   // The order the live test chat came back in from jsonb (2026-11-01).
   const answers = { job: 'cashier', kids: 'No', work: 'Employed', repay: 'Next payday', income: '₱10–20k', payday: '15th & 30th', loanUse: 'food', support: 'My parents', leftover: '₱1–3k', jobLong: '1–3 years' };
   const rec = answerRecord({ type: 'answers', answers, fit: { verdict: 'good', reason: 'x' } }, st, 'Asia/Manila', 'u1');
   assertEquals(rec?.items.map((i) => i.a), ['Employed', 'My parents', 'No', '₱10–20k', '₱1–3k', 'cashier', '15th & 30th', 'food', 'Next payday', '1–3 years']);
   const [alert] = alertTexts([{ type: 'answers', answers, fit: { verdict: 'good', reason: 'x' } }], st, { name: 'T' });
   assert(alert.indexOf('Are you working') < alert.indexOf('Who do you support') && alert.indexOf('pay it back') < alert.indexOf('How long'));
});

Deno.test('isPhMobile: only a Philippine mobile number on its own', () => {
   for (const yes of ['0917 123 4567', '09171234567', '+63 917 123 4567', '639171234567', '9171234567', '0917-123-4567', ' (0917) 123 4567 ']) assert(isPhMobile(yes), yes);
   for (const no of ['15000', '0917 123 456', '+66 81 234 5678', 'my number is 09171234567', '0817 123 4567', '09171234567890', 'book', '']) assert(!isPhMobile(no), no);
});

Deno.test('keep-spot reply: OK and its Taglish cousins match, real messages do not', () => {
   for (const t of ['OK', 'ok', 'Okay!', 'oo', 'Opo', 'sige', 'yes', '👍', ' ok. ']) assertEquals(KEEP_SPOT_REPLY.test(t), true, t);
   for (const t of ['ok pero late ako', 'can I move it?', '0917 123 4567', 'QUESTIONS', 'okay na ba?']) assertEquals(KEEP_SPOT_REPLY.test(t), false, t);
});

// The shape SendPulse returned for the 2026-11-15 chat: George typing in the Page inbox is an echo
// (app_id of Meta's inbox), the bot's own API sends are not.
Deno.test('lastTypedAt: only Page-inbox echoes count as a person typing', () => {
   const log = [
      { direction: 2, created_at: '2026-11-15T10:29:50Z', data: { is_echo: true, app_id: '263902037430900', text: 'so, monday what time?' } },
      { direction: 2, created_at: '2026-11-15T10:30:39Z', data: { text: 'Question 6' } },
      { direction: 1, created_at: '2026-11-15T10:30:30Z', data: { text: '10am po' } },
      { direction: 2, created_at: '2026-11-15T10:31:00Z', data: null }
   ];
   assertEquals(lastTypedAt(log), Date.parse('2026-11-15T10:29:50Z'));
   assertEquals(lastTypedAt(log.slice(1)), null);
   assertEquals(lastTypedAt([{ direction: 2, created_at: '2026-11-15T10:00:00Z', data: { is_echo: 'true' } }]), Date.parse('2026-11-15T10:00:00Z'));
});

Deno.test('teamHasChat: the bot steps aside when a person is talking in the chat', () => {
   const now = Date.parse('2026-11-15T10:30:00Z');
   const started = now - 60 * 60_000;
   // Team typed after the bot's chat began: step aside (the 2026-11-15 case).
   assertEquals(teamHasChat({ teamAt: now - 60_000, chatStartedAt: started, explicitStart: false, now }), true);
   // Team typed before the chat began (they told them to type BOOK): the chat carries on.
   assertEquals(teamHasChat({ teamAt: started - 60_000, chatStartedAt: started, explicitStart: false, now }), false);
   // No chat yet: QUESTIONS / "cancel my call" wait after a team message; BOOK always starts.
   assertEquals(teamHasChat({ teamAt: now - 60_000, chatStartedAt: null, explicitStart: false, now }), true);
   assertEquals(teamHasChat({ teamAt: now - TEAM_QUIET_MS - 1, chatStartedAt: null, explicitStart: false, now }), false);
   assertEquals(teamHasChat({ teamAt: now - 60_000, chatStartedAt: null, explicitStart: true, now }), false);
   // Nobody typed; chat log unreachable = stay out.
   assertEquals(teamHasChat({ teamAt: null, chatStartedAt: started, explicitStart: false, now }), false);
   assertEquals(teamHasChat({ teamAt: undefined, chatStartedAt: started, explicitStart: true, now }), true);
});
