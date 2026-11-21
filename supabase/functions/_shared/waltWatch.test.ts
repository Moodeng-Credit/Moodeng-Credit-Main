import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { extractInitData, initDataUser, isDone, potTopUp, txCents } from './waltWatch.ts';

Deno.test('txCents: whole cents only, sign ignored', () => {
   assertEquals(txCents('5.000000'), 500);
   assertEquals(txCents('-6.08'), 608);
   assertEquals(txCents('10'), 1000);
   assertEquals(txCents('6.081'), null);
   assertEquals(txCents('abc'), null);
});

Deno.test('isDone: only final, unblocked statuses', () => {
   assertEquals(isDone({ status: 'SUCCESS', is_blocked: false }), true);
   assertEquals(isDone({ status: 'completed', is_blocked: false }), true);
   assertEquals(isDone({ status: 'pending', is_blocked: false }), false);
   assertEquals(isDone({ status: 'success', is_blocked: true }), false);
});

const user = encodeURIComponent(JSON.stringify({ id: 12345, username: 'jimmymoodengcredit' }));
const raw = `query_id=AAE&user=${user}&auth_date=1762900000&signature=x&hash=abc123`;

Deno.test('extractInitData: raw, or inside the web app URL', () => {
   assertEquals(extractInitData(raw), raw);
   assertEquals(extractInitData(`https://walletbot.me/#tgWebAppData=${encodeURIComponent(raw)}&tgWebAppVersion=9.1`), raw);
   assertEquals(extractInitData('hello'), null);
});

Deno.test('initDataUser: reads the Telegram user', () => {
   assertEquals(initDataUser(raw), { id: 12345, username: 'jimmymoodengcredit' });
   assertEquals(initDataUser('hash=1'), null);
});

Deno.test('potTopUp: back to the target, or to what is waiting when that is more', () => {
   assertEquals(potTopUp(4, 0, 300), { need: 296, short: 0 });
   assertEquals(potTopUp(4, 15, 300), { need: 296, short: 11 });
   assertEquals(potTopUp(250, 400, 300), { need: 150, short: 150 });
   assertEquals(potTopUp(320, 10, 300), { need: 0, short: 0 });
});
