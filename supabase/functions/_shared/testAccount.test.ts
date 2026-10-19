import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { parseTestAccountCallback, testAccountConfirmKeyboard, testAccountRow, withoutTestAccountRow } from './testAccount.ts';

const ID = '1fa30eaa-2ee8-485e-bb4a-ea07b63045d1';

Deno.test('callbacks round-trip and stay under 64 bytes', () => {
   const [[ask]] = testAccountRow(ID) as Array<Array<{ callback_data: string }>>;
   const [[yes, no]] = testAccountConfirmKeyboard(ID) as Array<Array<{ callback_data: string }>>;
   assertEquals(parseTestAccountCallback(ask.callback_data), { step: 'ask', userId: ID });
   assertEquals(parseTestAccountCallback(yes.callback_data), { step: 'yes', userId: ID });
   assertEquals(parseTestAccountCallback(no.callback_data), { step: 'no' });
   assertEquals([ask, yes, no].every((b) => new TextEncoder().encode(b.callback_data).length <= 64), true);
   assertEquals(parseTestAccountCallback('la:a:' + ID), null);
});

Deno.test('no button for an account that is already a test account', () => {
   assertEquals(testAccountRow(ID, true), []);
});

Deno.test('marking drops only the 🧪 row from the card', () => {
   const card = [[{ text: '🔄 Change time', callback_data: 'rs:o:' + ID }], [{ text: 'Admin', url: 'https://x' }], ...testAccountRow(ID)];
   assertEquals(withoutTestAccountRow(card), card.slice(0, 2));
});
