import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { connectedAt, startNudgeDue, startNudgeText, startNudgeWhatsAppText } from './prescreenStartNudge.ts';

const H = 3600000;
const now = Date.parse('2026-11-24T02:00:00Z'); // 10:00 Manila
const user = (o: Partial<{ fbHoursAgo: number | null; waHoursAgo: number | null; nudges: number; lastHoursAgo: number | null }>) => ({
   id: 'u',
   messenger_verified_at: o.fbHoursAgo === null ? null : new Date(now - (o.fbHoursAgo ?? 3) * H).toISOString(),
   whatsapp_verified_at: o.waHoursAgo == null ? null : new Date(now - o.waHoursAgo * H).toISOString(),
   prescreen_start_nudges: o.nudges ?? 0,
   prescreen_start_nudged_at: o.lastHoursAgo == null ? null : new Date(now - o.lastHoursAgo * H).toISOString()
});

Deno.test('startNudgeDue: first reminder an hour after connecting Facebook', () => {
   assertEquals(startNudgeDue(user({ fbHoursAgo: 0.5 }), false, now), null);
   assertEquals(startNudgeDue(user({ fbHoursAgo: 1 }), false, now), 1);
   assertEquals(startNudgeDue(user({ fbHoursAgo: 11 }), false, now), 1);
});

Deno.test('startNudgeDue: second reminder 24h after the first, never a third', () => {
   assertEquals(startNudgeDue(user({ fbHoursAgo: 30, nudges: 1, lastHoursAgo: 23 }), false, now), null);
   assertEquals(startNudgeDue(user({ fbHoursAgo: 30, nudges: 1, lastHoursAgo: 24 }), false, now), 2);
   assertEquals(startNudgeDue(user({ fbHoursAgo: 60, nudges: 2, lastHoursAgo: 30 }), false, now), null);
});

Deno.test('startNudgeDue: nothing once the pre-screening is sent, or a week after connecting', () => {
   assertEquals(startNudgeDue(user({ fbHoursAgo: 5 }), true, now), null);
   assertEquals(startNudgeDue(user({ fbHoursAgo: 7 * 24 + 1 }), false, now), null);
   assertEquals(startNudgeDue(user({ fbHoursAgo: null }), false, now), null);
});

Deno.test('startNudgeDue: WhatsApp-only connections count too, the earlier connection starts the clock', () => {
   assertEquals(startNudgeDue(user({ fbHoursAgo: null, waHoursAgo: 2 }), false, now), 1);
   assertEquals(connectedAt(user({ fbHoursAgo: 2, waHoursAgo: 5 })), now - 5 * H);
});

Deno.test('texts: Messenger has the continue link + sign-in hint; WhatsApp is one line', () => {
   const en = startNudgeText(1, 'en', 'Maria');
   assert(en.startsWith('Hi Maria! '));
   assert(en.includes('/continue?via=nudge'));
   assert(en.includes('number or email you signed up with'));
   assert(startNudgeText(2, 'fil', null).includes('Bukas pa ang slot mo'));
   for (const n of [1, 2] as const) {
      const wa = startNudgeWhatsAppText(n);
      assert(!wa.includes('\n'));
      assert(wa.length < 300);
      assert(wa.includes('/continue?via=whatsapp'));
   }
});
