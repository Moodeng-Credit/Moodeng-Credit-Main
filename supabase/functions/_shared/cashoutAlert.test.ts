import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { buildCashoutAlert, describeWho } from './cashoutAlert.ts';

const USER_ID = 'b5e3f979-6f66-45c7-9af1-c56133e6c1b4';

Deno.test('cash-out alert: amount, who, how, where, when in Bangkok', () => {
   const text = buildCashoutAlert({
      amount: 20,
      exchange: 'Maya',
      destination: '0x1234567890abcdef1234567890abcdef12345678',
      txHash: '0xabc',
      wallet: 'embedded',
      at: new Date('2026-11-14T08:04:00Z'), // 3:04 PM in Bangkok
      user: { id: USER_ID, displayName: 'Test Borrower', telegramUsername: 'testuser', market: 'PH' },
      cashoutNumber: 2
   });
   assertEquals(
      text,
      [
         '💸 Cash-out: $20.00 USDC',
         '',
         'Who: Test Borrower · @testuser (PH) · 2nd cash-out',
         'How: Maya · from Moodeng wallet',
         'To: 0x1234…5678',
         'When: Sat, Nov 14, 3:04 PM Bangkok',
         `User ID: ${USER_ID}`
      ].join('\n')
   );
});

Deno.test('cash-out alert: falls back to email, then unknown', () => {
   assertEquals(describeWho({ id: USER_ID, email: 'a@example.com' }), 'a@example.com');
   assertEquals(describeWho({ id: USER_ID }), 'Unknown user');
   assertEquals(describeWho({ id: USER_ID, username: 'moo', market: 'ID' }), 'moo (ID)');
});

Deno.test('cash-out alert: Base Pay wallet and 11th/12th/13th', () => {
   const text = buildCashoutAlert({
      amount: 5.5,
      exchange: 'PDAX',
      destination: '0x1234567890abcdef1234567890abcdef12345678',
      txHash: '0xabc',
      wallet: 'base',
      at: new Date('2026-11-14T08:04:00Z'),
      user: { id: USER_ID, username: 'moo' },
      cashoutNumber: 12
   });
   assertEquals(text.split('\n')[2], 'Who: moo · 12th cash-out');
   assertEquals(text.split('\n')[3], 'How: PDAX · from Base Pay wallet');
});
