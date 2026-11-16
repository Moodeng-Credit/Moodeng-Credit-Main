import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { buildCashOutReply, CASH_OUT_QUESTION, CASH_OUT_QUESTION_FIRST, cashOutQuestion, parseCashOutChoice } from './messengerCashOutHelp.ts';

Deno.test('numbers and names pick a cash-out way', () => {
   assertEquals(parseCashOutChoice('1'), { choice: 'qr', by: 'number' });
   assertEquals(parseCashOutChoice(' 2. '), { choice: 'gcrypto', by: 'number' });
   assertEquals(parseCashOutChoice('3️⃣'), { choice: 'pdax', by: 'number' });
   assertEquals(parseCashOutChoice('4'), { choice: 'maya', by: 'number' });
   assertEquals(parseCashOutChoice('QR'), { choice: 'qr', by: 'name' });
   assertEquals(parseCashOutChoice('bank qr'), { choice: 'qr', by: 'name' });
   assertEquals(parseCashOutChoice('GCrypto'), { choice: 'gcrypto', by: 'name' });
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

Deno.test('plain "bank" / "gcash" stay with support', () => {
   for (const text of ['bank', 'gcash', 'Gcash']) assertEquals(parseCashOutChoice(text), null, text);
});

Deno.test('Filipino copy: same ways, same coin warnings, same buttons', () => {
   assert(cashOutQuestion('fil').includes('1, 2, 3 o 4'));
   assertEquals(cashOutQuestion('en'), CASH_OUT_QUESTION);
   for (const choice of ['qr', 'gcrypto', 'pdax', 'maya'] as const) {
      const en = buildCashOutReply(choice);
      const fil = buildCashOutReply(choice, 'fil');
      assert(fil.text !== en.text, choice);
      assertEquals(fil.card, en.card);
   }
   assert(buildCashOutReply('gcrypto', 'fil').text.includes('Hindi USDT, hindi Ethereum'));
   assert(buildCashOutReply('maya', 'fil').text.includes('Solana'));
});

Deno.test('first loan: one GCrypto recommendation, YES (or the whole list) shows its steps', () => {
   assertEquals(cashOutQuestion('en', true), CASH_OUT_QUESTION_FIRST);
   assert(CASH_OUT_QUESTION_FIRST.includes('GCrypto') && CASH_OUT_QUESTION_FIRST.includes('Reply YES'));
   assert(!CASH_OUT_QUESTION_FIRST.includes('1, 2'));
   assert(cashOutQuestion('fil', true).includes('YES'));
   for (const text of ['yes', 'YES', 'Yes!', 'oo', 'Opo', 'ok', 'go', 'sige', '1 2 3 4', '1234', '1,2,3,4', '1, 2, 3, 4']) {
      assertEquals(parseCashOutChoice(text), { choice: 'gcrypto', by: 'number' }, text);
   }
   for (const text of ['yes I paid', 'ok thanks', '1 2', '12']) assertEquals(parseCashOutChoice(text), null, text);
});

Deno.test('step footers name the other ways, not menu numbers', () => {
   for (const lang of ['en', 'fil'] as const) {
      for (const choice of ['qr', 'gcrypto', 'pdax', 'maya'] as const) {
         assert(!/1, 2/.test(buildCashOutReply(choice, lang).text), `${lang} ${choice}`);
      }
   }
});
