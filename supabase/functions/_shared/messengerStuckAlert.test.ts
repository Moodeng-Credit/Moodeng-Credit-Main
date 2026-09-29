import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import {
   buildMessengerStuckAlert,
   buildMessengerVerifyCallback,
   markMessengerVerified,
   parseMessengerVerifyCallback,
   REALERT_AFTER_MS,
   shouldAlertStuck,
   type StuckBorrower
} from './messengerStuckAlert.ts';

const NOW = Date.parse('2026-09-29T07:34:00Z');
const USER_ID = 'b5e3f979-6f66-45c7-9af1-c56133e6c1b4';

const borrower = (overrides: Partial<StuckBorrower> = {}): StuckBorrower => ({
   id: USER_ID,
   username: 'aya-b5e3f9',
   display_name: 'Aya',
   email: 'aya@example.com',
   user_role: 'borrower',
   messenger_verified_at: null,
   messenger_stuck_alerted_at: null,
   ...overrides
});

Deno.test('alert: name, handle, email, minutes waiting and the code', () => {
   const text = buildMessengerStuckAlert(borrower(), { code: 'MDNG-3D66AD', user_id: USER_ID, created_at: '2026-09-29T07:22:25Z' }, NOW);
   assertEquals(
      text,
      '📵 Facebook not confirmed — Aya\n@aya-b5e3f9 · aya@example.com\nTapped "Verify via Messenger" 12 min ago (code MDNG-3D66AD), and our bot never heard from them.\nLook for them in the Page inbox or email them. Once you have them, tap ✅ Mark Facebook verified.'
   );
});

Deno.test('alert: falls back to the username, drops an empty contact line', () => {
   const text = buildMessengerStuckAlert(
      borrower({ display_name: '  ', username: null, email: null }),
      { code: 'MDNG-000000', user_id: USER_ID, created_at: '2026-09-29T07:24:00Z' },
      NOW
   );
   assertEquals(text.split('\n')[0], '📵 Facebook not confirmed — A borrower');
   assertEquals(text.split('\n')[1].startsWith('Tapped'), true);
});

Deno.test('shouldAlertStuck: unverified borrower never alerted → yes', () => {
   assertEquals(shouldAlertStuck(borrower(), NOW), true);
});

Deno.test('shouldAlertStuck: already verified or a lender → no', () => {
   assertEquals(shouldAlertStuck(borrower({ messenger_verified_at: '2026-09-29T07:30:00Z' }), NOW), false);
   assertEquals(shouldAlertStuck(borrower({ user_role: 'lender' }), NOW), false);
   // NULL role still counts as a borrower (some real borrowers have one).
   assertEquals(shouldAlertStuck(borrower({ user_role: null }), NOW), true);
});

Deno.test('shouldAlertStuck: once per borrower per day', () => {
   const hourAgo = new Date(NOW - 60 * 60 * 1000).toISOString();
   const dayAgo = new Date(NOW - REALERT_AFTER_MS).toISOString();
   assertEquals(shouldAlertStuck(borrower({ messenger_stuck_alerted_at: hourAgo }), NOW), false);
   assertEquals(shouldAlertStuck(borrower({ messenger_stuck_alerted_at: dayAgo }), NOW), true);
});

Deno.test('callback round-trips and rejects anything else', () => {
   const data = buildMessengerVerifyCallback(USER_ID);
   assertEquals(new TextEncoder().encode(data).length <= 64, true);
   assertEquals(parseMessengerVerifyCallback(data), { userId: USER_ID });
   assertEquals(parseMessengerVerifyCallback(`la:a:${USER_ID}`), null);
   assertEquals(parseMessengerVerifyCallback('mv:not-a-uuid'), null);
   assertEquals(parseMessengerVerifyCallback(undefined), null);
});

// Minimal stand-in for the supabase-js query builder: an update (guarded by
// messenger_verified_at IS NULL) returns `updated`; a plain select returns `existing`.
const fakeUsers = (updated: unknown, existing: unknown) => {
   const writes: unknown[] = [];
   return {
      writes,
      from: () => {
         let isUpdate = false;
         const builder = {
            update: (values: unknown) => {
               isUpdate = true;
               writes.push(values);
               return builder;
            },
            select: () => builder,
            eq: () => builder,
            is: () => builder,
            maybeSingle: () => Promise.resolve({ data: isUpdate ? updated : existing, error: null })
         };
         return builder;
      }
   };
};

Deno.test('markMessengerVerified: stamps an unverified borrower', async () => {
   const db = fakeUsers({ username: 'aya-b5e3f9', display_name: 'Aya' }, null);
   const result = await markMessengerVerified(db, USER_ID, '@george');
   assertEquals(result, { ok: true, summary: '✅ Facebook marked verified for Aya — by @george' });
   assertEquals(db.writes.length, 1);
});

Deno.test('markMessengerVerified: already verified is a friendly no-op', async () => {
   const db = fakeUsers(null, { username: 'aya-b5e3f9', display_name: 'Aya' });
   const result = await markMessengerVerified(db, USER_ID, '@george');
   assertEquals(result, { ok: true, summary: 'Facebook already verified for Aya. Nothing to do.' });
});

Deno.test('markMessengerVerified: unknown borrower', async () => {
   const result = await markMessengerVerified(fakeUsers(null, null), USER_ID, '@george');
   assertEquals(result, { ok: false, summary: 'Borrower not found.' });
});
