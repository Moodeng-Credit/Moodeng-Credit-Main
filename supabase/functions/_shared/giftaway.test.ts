import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { giftawayReference, giftawaySource, parseGiftawaySource, sha1Hex, toPhilippineMobile, twoWordName } from './giftaway.ts';

const CLAIM_ID = '0274e575-7921-4a25-b4f3-722fba3c2da6';

Deno.test('giftaway secure hash is lowercase SHA-1 hex', async () => {
   assertEquals(await sha1Hex('abc'), 'a9993e364706816aba3e25717850c26c9cd0d89d');
});

Deno.test('giftaway mobile: PH numbers become 09XXXXXXXXX, others are dropped', () => {
   assertEquals(toPhilippineMobile('+63 917 123 4567'), '09171234567');
   assertEquals(toPhilippineMobile('639171234567'), '09171234567');
   assertEquals(toPhilippineMobile('0917-123-4567'), '09171234567');
   assertEquals(toPhilippineMobile('9171234567'), '09171234567');
   assertEquals(toPhilippineMobile('+62 812 3456 7890'), null);
   assertEquals(toPhilippineMobile(''), null);
});

Deno.test('giftaway names are at least two words', () => {
   assertEquals(twoWordName('  Maria   Santos '), 'Maria Santos');
   assertEquals(twoWordName('Ana'), 'Ana Moodeng');
   assertEquals(twoWordName('🙂'), 'Moodeng Borrower');
});

Deno.test('giftaway reference is fixed per claim and the source round-trips', () => {
   assertEquals(giftawayReference(CLAIM_ID), `MDNG-${CLAIM_ID}`);
   const source = giftawaySource({ orderId: '46231081', referenceNo: giftawayReference(CLAIM_ID), product: 'Jollibee Group' });
   assertEquals(source, `giftaway 46231081 MDNG-${CLAIM_ID} Jollibee Group`);
   assertEquals(parseGiftawaySource(source), { orderId: '46231081', referenceNo: `MDNG-${CLAIM_ID}` });
   assertEquals(parseGiftawaySource('bitrefill GrabMart inv1'), null);
});
