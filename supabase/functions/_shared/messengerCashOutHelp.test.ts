import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { buildCashOutReply, CASH_OUT_QUESTION, parseCashOutChoice } from './messengerCashOutHelp.ts';

Deno.test('numbers and names pick a cash-out way', () => {
   assertEquals(parseCashOutChoice('1'), { choice: 'qr', by: 'number' });
   assertEquals(parseCashOutChoice(' 2. '), { choice: 'gcrypto', by: 'number' });
   assertEquals(parseCashOutChoice('3️⃣'), { choice: 'pdax', by: 'number' });
   assertEquals(parseCashOutChoice('4'), { choice: 'maya', by: 'number' });
   assertEquals(parseCashOutChoice('QR'), { choice: 'qr', by: 'name' });
   assertEquals(parseCashOutChoice('bank qr'), { choice: 'qr', by: 'name' });
   assertEquals(parseCashOutChoice('GCrypto'), { choice: 'gcrypto', by: 'name' });
   assertEquals(parseCashOutChoice('gcash'), { choice: 'gcrypto', by: 'name' });
   assertEquals(parseCashOutChoice('PDAX!'), { choice: 'pdax', by: 'name' });
   assertEquals(parseCashOutChoice('Maya'), { choice: 'maya', by: 'name' });
});

Deno.test('other messages are not answers', () => {
   for (const text of ['5', '12', 'how do i cash out with gcash?', 'menu', 'REWARD', 'usdc', '']) {
      assertEquals(parseCashOutChoice(text), null, text);
   }
});

Deno.test('every way names the exact coin and network', () => {
   for (const choice of ['gcrypto', 'pdax'] as const) {
      const { text } = buildCashOutReply(choice);
      assert(text.includes('USD Coin (Base)') || text.includes('USDCBASE'), choice);
      assert(text.includes('Not USDT, not Ethereum'), choice);
   }
   const maya = buildCashOutReply('maya').text;
   assert(maya.includes('Solana') && maya.includes('not Ethereum and not USDT'));
   assert(CASH_OUT_QUESTION.includes('1, 2, 3 or 4'));
});

Deno.test('card button titles fit Messenger (≤ 20 chars)', () => {
   for (const choice of ['qr', 'gcrypto', 'pdax', 'maya'] as const) {
      const { card } = buildCashOutReply(choice);
      for (const b of [card.button, ...(card.moreButtons ?? [])]) assert([...b.title].length <= 20, b.title);
      assert(card.title.length <= 80);
   }
});
