import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { shouldSendBorrowPoster } from './messengerBorrowPoster.ts';

const connected = '2026-10-15T10:00:00Z';
const at = (iso: string) => Date.parse(iso);
const borrower = { messenger_verified_at: connected, borrow_poster_sent_at: null, user_role: 'borrower' };

Deno.test('first message after the code → poster', () => {
   assertEquals(shouldSendBorrowPoster(borrower, at('2026-10-15T10:05:00Z'), false), true);
});

Deno.test('the code message itself (or one right on its heels) → no poster', () => {
   assertEquals(shouldSendBorrowPoster(borrower, at('2026-10-15T09:59:58Z'), false), false);
   assertEquals(shouldSendBorrowPoster(borrower, at('2026-10-15T10:00:10Z'), false), false);
});

Deno.test('only once, only connected borrowers who have not borrowed yet', () => {
   const later = at('2026-10-16T10:00:00Z');
   assertEquals(shouldSendBorrowPoster({ ...borrower, borrow_poster_sent_at: '2026-10-15T10:05:00Z' }, later, false), false);
   assertEquals(shouldSendBorrowPoster({ ...borrower, messenger_verified_at: null }, later, false), false);
   assertEquals(shouldSendBorrowPoster({ ...borrower, user_role: 'lender' }, later, false), false);
   assertEquals(shouldSendBorrowPoster({ ...borrower, user_role: null }, later, false), true);
   assertEquals(shouldSendBorrowPoster(borrower, later, true), false);
   assertEquals(shouldSendBorrowPoster(null, later, false), false);
});
