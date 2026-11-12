import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { type Check, checkLines, readyHeadline } from './idReady.ts';

const ok: Check = { ok: true, label: 'Payout wallet 0xabc', fix: 'never shown' };
const bad: Check = { ok: false, label: 'Payout coin: USDT', fix: 'Set it to USDC.' };
const unknown: Check = { ok: null, label: 'Gas sponsorship on Base: not tested', fix: 'Tap Test gas.' };

Deno.test('checkLines: a fix is shown only under a check that is not passing', () => {
   assertEquals(
      checkLines([ok, bad, unknown]),
      '✅ Payout wallet 0xabc\n❌ Payout coin: USDT\n   → Set it to USDC.\n⚪ Gas sponsorship on Base: not tested\n   → Tap Test gas.'
   );
});

Deno.test('readyHeadline: failures first, then unknowns, then ready', () => {
   assertEquals(readyHeadline([ok, bad, unknown]), '🇮🇩 Not ready: 1 thing to fix');
   assertEquals(readyHeadline([bad, bad]), '🇮🇩 Not ready: 2 things to fix');
   assertEquals(readyHeadline([ok, unknown]), '🇮🇩 Looks ready, 1 not checked yet');
   assertEquals(readyHeadline([ok, ok]), '🇮🇩 Ready to fund Indonesian requests');
});
