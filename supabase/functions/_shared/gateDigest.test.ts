import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { formatGateDigest } from './gateDigest.ts';

const NOW = Date.parse('2026-10-10T01:00:00Z');

Deno.test('a quiet day sends nothing', () => {
   assertEquals(formatGateDigest([], [], NOW), null);
});

Deno.test('lists calls waiting on a tap with ready-to-send commands, and unbooked connections', () => {
   const text = formatGateDigest(
      [{ ref: 'abcdef12', name: 'Rae @rae', callAt: '2026-10-09T06:00:00Z', callTimezone: 'Asia/Manila' }],
      [{ name: 'Jo @jo', connectedAt: '2026-10-08T03:00:00Z' }],
      NOW
   ) as string;
   assert(text.includes('⏳ Call done, waiting on your ✅ / ❌ (1):'));
   assert(text.includes('/showed abcdef12 · /noshow abcdef12'));
   assert(text.includes('📭 Connected Messenger, no call booked (1):'));
   assert(text.includes('1. Jo @jo · connected yesterday'));
});

Deno.test('long lists are capped', () => {
   const many = Array.from({ length: 20 }, (_, i) => ({ name: `u${i}`, connectedAt: '2026-10-09T00:00:00Z' }));
   const text = formatGateDigest([], many, NOW) as string;
   assert(text.includes('…and 5 more'));
});
