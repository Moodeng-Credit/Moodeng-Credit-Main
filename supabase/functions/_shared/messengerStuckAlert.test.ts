import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import {
   buildMatchSuggestionCard,
   buildMessengerStuckAlert,
   buildMessengerVerifyCallback,
   buildStuckEmail,
   isEmailable,
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

Deno.test('alert: name, handle, email, minutes waiting, the code and whether we emailed them', () => {
   const text = buildMessengerStuckAlert(
      borrower(),
      { code: 'MDNG-3D66AD', user_id: USER_ID, created_at: '2026-09-29T07:22:25Z' },
      NOW,
      'sent'
   );
   assertEquals(
      text,
      '📵 Facebook not confirmed — Aya\n@aya-b5e3f9 · aya@example.com\nTapped "Verify via Messenger" 12 min ago (code MDNG-3D66AD), and our bot never heard from them.\n📧 We emailed them a link and the code (both work for 24 h).\nIf they stay stuck, find them in the Page inbox. Once you have them, tap ✅ Mark Facebook verified.'
   );
});

Deno.test('alert: shows a possible Facebook match and a failed email', () => {
   const text = buildMessengerStuckAlert(
      borrower(),
      { code: 'MDNG-3D66AD', user_id: USER_ID, created_at: '2026-09-29T07:22:25Z', suggested_contact_name: 'Aya Albarracin' },
      NOW,
      'failed'
   );
   assertEquals(text.includes('🤔 Possible match: "Aya Albarracin" messaged the Page without a code.'), true);
   assertEquals(text.includes("📧 Emailing them failed — they haven't heard from us."), true);
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

Deno.test('shouldAlertStuck: already verified, a lender, or a banned account → no', () => {
   assertEquals(shouldAlertStuck(borrower({ messenger_verified_at: '2026-09-29T07:30:00Z' }), NOW), false);
   assertEquals(shouldAlertStuck(borrower({ user_role: 'lender' }), NOW), false);
   assertEquals(shouldAlertStuck(borrower({ account_status: 'banned' }), NOW), false);
   assertEquals(shouldAlertStuck(borrower({ account_status: 'active' }), NOW), true);
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

Deno.test('isEmailable: real-looking addresses only', () => {
   assertEquals(isEmailable('aya@example.com'), true);
   assertEquals(isEmailable(' aya@example.com '), true);
   assertEquals(isEmailable(null), false);
   assertEquals(isEmailable('aya'), false);
   assertEquals(isEmailable('aya@localhost'), false);
});

Deno.test('email: greets by first name, carries the link, the code and the app link; escapes HTML', () => {
   const links = {
      messenger: 'https://m.me/1?ref=f__mdng_code=MDNG-3D66AD',
      apply: 'https://moodeng.app/request-board?applyLoan=1',
      page: 'https://www.facebook.com/1'
   };
   const email = buildStuckEmail({ display_name: 'Aya Albarracin' }, 'MDNG-3D66AD', links);
   assertEquals(email.subject, 'Finish connecting your Facebook to Moodeng');
   assertEquals(email.text.startsWith('Hi Aya,'), true);
   for (const part of [links.messenger, links.apply, 'MDNG-3D66AD', '24 hours']) assertEquals(email.text.includes(part), true);
   assertEquals(email.html.includes('MDNG-3D66AD'), true);

   const sneaky = buildStuckEmail({ display_name: '<script>x</script>' }, 'MDNG-3D66AD', links);
   assertEquals(sneaky.html.includes('<script>'), false);
   assertEquals(buildStuckEmail({ display_name: null }, 'MDNG-3D66AD', links).text.startsWith('Hi there,'), true);
});

Deno.test('suggestion card: Facebook name, borrower, code and the names we compared', () => {
   const text = buildMatchSuggestionCard(
      { username: 'aya-b5e3f9', display_name: 'Aya', email: null },
      ['aya albaracin', 'AYA M ALBARRACIN'],
      'Aya Albarracin',
      { code: 'MDNG-3D66AD', user_id: USER_ID, created_at: '2026-09-29T07:22:25Z' },
      Date.parse('2026-09-29T07:25:25Z')
   );
   assertEquals(
      text,
      '🤔 Is this them? "Aya Albarracin" just messaged the Page without a code.\nAya (@aya-b5e3f9) tapped "Verify via Messenger" 3 min ago (code MDNG-3D66AD).\nNames we have for them: aya albaracin · AYA M ALBARRACIN\nIf it is, tap ✅ — we also save that Facebook chat so reminders reach them.'
   );
});

// Minimal stand-in for the supabase-js query builder. users: an update (guarded by
// messenger_verified_at IS NULL) returns `updated`, a plain select returns `existing`.
// contact_verification_codes: the borrower's open code (with any suggested Facebook chat).
const fakeDb = (updated: unknown, existing: unknown, openCode: unknown = null) => {
   const writes: unknown[] = [];
   return {
      writes,
      from: (table: string) => {
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
            maybeSingle: () =>
               Promise.resolve({ data: table === 'contact_verification_codes' ? openCode : isUpdate ? updated : existing, error: null })
         };
         return builder;
      }
   };
};

Deno.test('markMessengerVerified: stamps an unverified borrower', async () => {
   const db = fakeDb({ username: 'aya-b5e3f9', display_name: 'Aya' }, null);
   const result = await markMessengerVerified(db, USER_ID, '@george');
   assertEquals(result, { ok: true, summary: '✅ Facebook marked verified for Aya — by @george' });
   assertEquals(db.writes.length, 1);
   assertEquals('messenger_psid' in (db.writes[0] as Record<string, unknown>), false);
});

Deno.test('markMessengerVerified: saves the suggested Facebook chat so reminders reach them', async () => {
   const db = fakeDb({ username: 'aya-b5e3f9', display_name: 'Aya' }, null, {
      suggested_contact_id: 'sp-contact-1',
      suggested_contact_name: 'Aya Albarracin'
   });
   const result = await markMessengerVerified(db, USER_ID, '@george');
   assertEquals(result.summary, '✅ Facebook marked verified for Aya (Facebook: Aya Albarracin) — by @george');
   assertEquals((db.writes[0] as Record<string, unknown>).messenger_psid, 'sp-contact-1');
});

Deno.test('markMessengerVerified: already verified is a friendly no-op', async () => {
   const db = fakeDb(null, { username: 'aya-b5e3f9', display_name: 'Aya' });
   const result = await markMessengerVerified(db, USER_ID, '@george');
   assertEquals(result, { ok: true, summary: 'Facebook already verified for Aya. Nothing to do.' });
});

Deno.test('markMessengerVerified: unknown borrower', async () => {
   const result = await markMessengerVerified(fakeDb(null, null), USER_ID, '@george');
   assertEquals(result, { ok: false, summary: 'Borrower not found.' });
});
