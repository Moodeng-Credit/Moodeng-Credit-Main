import { assertEquals, assertThrows } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { baseUnits, baseUnitsText, drawUnitsFor, minArrival } from './idVaultBridge.ts';
import { encodeApprove, LIFI_DIAMOND } from './lifi.ts';

Deno.test('baseUnits: exact 6-decimal USDC units', () => {
   assertEquals(baseUnits(15), 15_000_000n);
   assertEquals(baseUnits('15.2'), 15_200_000n);
   assertEquals(baseUnits('0.01'), 10_000n);
   assertThrows(() => baseUnits('-1'));
   assertThrows(() => baseUnits('abc'));
});

Deno.test('baseUnitsText: cents, truncated', () => {
   assertEquals(baseUnitsText(15_200_000n), '15.20');
   assertEquals(baseUnitsText(15_059_999n), '15.05');
   assertEquals(baseUnitsText(10_000n), '0.01');
});

Deno.test('drawUnitsFor: quote + 0.6% + 2 cents, rounded up to whole cents', () => {
   // LI.FI said 15.1039 USDC for $15 to arrive → 15.1039 + 0.0906 + 0.02 = 15.2145 → 15.22
   assertEquals(drawUnitsFor(15_103_900n), 15_220_000n);
   // Already on a cent boundary stays there.
   assertEquals(drawUnitsFor(10_000_000n), 10_080_000n);
   // Always covers the quote.
   for (const q of [1n, 5_012_345n, 99_999_999n]) {
      const d = drawUnitsFor(q);
      if (d <= q || d % 10_000n !== 0n) throw new Error(`bad draw for ${q}: ${d}`);
   }
});

Deno.test('minArrival: to_bsc needs the full loan, to_base allows 2% loss', () => {
   assertEquals(minArrival('to_bsc', 15_220_000n, 15n * 10n ** 18n), 15n * 10n ** 18n);
   assertThrows(() => minArrival('to_bsc', 1n));
   // 25 USDT (18 dec) → at least 24.50 USDC (6 dec)
   assertEquals(minArrival('to_base', 25n * 10n ** 18n), 24_500_000n);
});

Deno.test('encodeApprove: ERC-20 approve calldata for the LI.FI contract', () => {
   const data = encodeApprove(LIFI_DIAMOND, 15_220_000n);
   assertEquals(data.slice(0, 10), '0x095ea7b3');
   assertEquals(data.length, 10 + 128);
   assertEquals(data.slice(10, 74), LIFI_DIAMOND.slice(2).toLowerCase().padStart(64, '0'));
   assertEquals(BigInt(`0x${data.slice(74)}`), 15_220_000n);
   assertThrows(() => encodeApprove('0x123', 1n));
});
