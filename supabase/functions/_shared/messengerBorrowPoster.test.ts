import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { posterDue } from './messengerBorrowPoster.ts';

const connected = '2026-10-15T10:00:00Z';
const at = (iso: string) => Date.parse(iso);
const borrower = { messenger_verified_at: connected, borrow_poster_sent_at: null, user_role: 'borrower' };

Deno.test('poster goes out on its own 2+ minutes after connecting, not on top of the connected reply', () => {
   assertEquals(posterDue(borrower, at('2026-10-15T10:00:30Z'), false), false);
   assertEquals(posterDue(borrower, at('2026-10-15T10:02:00Z'), false), true);
   assertEquals(posterDue(borrower, at('2026-10-15T15:00:00Z'), false), true);
});

Deno.test('not once Meta\'s 24h window may have closed', () => {
   assertEquals(posterDue(borrower, at('2026-10-16T09:30:00Z'), false), false);
});

Deno.test('only once, only connected borrowers who have not borrowed yet', () => {
   const later = at('2026-10-15T10:10:00Z');
   assertEquals(posterDue({ ...borrower, borrow_poster_sent_at: '2026-10-15T10:05:00Z' }, later, false), false);
   assertEquals(posterDue({ ...borrower, messenger_verified_at: null }, later, false), false);
   assertEquals(posterDue({ ...borrower, user_role: 'lender' }, later, false), false);
   assertEquals(posterDue({ ...borrower, user_role: null }, later, false), true);
   assertEquals(posterDue(borrower, later, true), false);
   assertEquals(posterDue(null, later, false), false);
});
