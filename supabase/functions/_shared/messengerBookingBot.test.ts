import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { alertTexts, answerRecord, freeFromSlots, holdColumns, START, wallNow, withoutHeld, zonedIso } from './messengerBookingBot.ts';

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
