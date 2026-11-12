import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { type P2pAd, pickP2pPrice, roundRp } from './waltP2p.ts';

const ad = (price: number, o: Partial<P2pAd> = {}): P2pAd => ({
   price: String(price),
   minAmount: '30000',
   maxAmount: '20000000',
   isOnline: true,
   isAutoAccept: true,
   ...o
});

Deno.test('pickP2pPrice: best fitting online price, instant ads first', () => {
   const ads = [ad(17941, { isAutoAccept: false }), ad(17824), ad(17800), ad(18100, { isOnline: false })];
   // Cashing out: the highest a merchant pays among auto-accept ads (17941 isn't instant, 18100 is offline).
   assertEquals(pickP2pPrice(ads, 'cashout', 90_000), 17824);
   // Buying: the lowest a merchant asks.
   assertEquals(pickP2pPrice([ad(18300), ad(18259, { isAutoAccept: false }), ad(19000)], 'buy', 110_000), 18300);
});

Deno.test('pickP2pPrice: order limits must fit, falls back to non-instant, null when nothing fits', () => {
   assertEquals(pickP2pPrice([ad(17900, { minAmount: '300000' }), ad(17700, { isAutoAccept: false })], 'cashout', 90_000), 17700);
   assertEquals(pickP2pPrice([ad(17900, { minAmount: '300000' })], 'cashout', 90_000), null);
   assertEquals(pickP2pPrice([], 'buy', 90_000), null);
});

Deno.test('roundRp: nearest Rp 100', () => {
   assertEquals(roundRp(5 * 17824), 89100);
   assertEquals(roundRp(6.08 * 18300), 111300);
});
