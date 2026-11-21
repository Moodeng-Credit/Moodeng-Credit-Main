import { assert, assertEquals } from 'jsr:@std/assert@1';
import { blockRows, hasLinkedFlag, parseBlockCallback } from './blockForGood.ts';
import { linkedRedFlag } from './linkedAccounts.ts';

const ID = '11111111-2222-3333-4444-555555555555';

Deno.test('block button round-trips its user id', () => {
   const [[button]] = blockRows(ID);
   assert('callback_data' in button);
   assertEquals(parseBlockCallback(button.callback_data), { userId: ID });
   assert(button.callback_data.length <= 64, 'Telegram callback_data limit');
   assertEquals(parseBlockCallback('pq:ask:' + ID), null);
   assertEquals(parseBlockCallback(undefined), null);
});

Deno.test('the button shows only for the linked-account red flag', () => {
   const linked = linkedRedFlag([{ user_id: ID, username: 'borrower-b', status: 'rejected', via: ['same WhatsApp number'], bad: true, why: 'rejected' }]);
   assert(linked);
   assert(hasLinkedFlag(['payslip date is old', linked]));
   assertEquals(hasLinkedFlag(['payslip date is old', 'the AI red-flag check didn’t run']), false);
});
