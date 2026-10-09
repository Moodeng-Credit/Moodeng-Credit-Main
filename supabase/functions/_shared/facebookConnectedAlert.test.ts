import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { buildFacebookConnectedAlert } from './facebookConnectedAlert.ts';

const NOW = Date.parse('2026-09-24T00:00:00Z');

Deno.test('existing late payer: name, handle, Facebook name and repayment record', () => {
   const text = buildFacebookConnectedAlert(
      { username: 'jaja-reyes', display_name: 'Jaja', email: 'jaja@example.com' },
      'Jaja Reyes',
      [
         { funded_at: '2026-08-01', due_date: '2026-08-15T00:00:00Z', repaid_at: '2026-08-19T00:00:00Z' },
         { funded_at: '2026-09-01', due_date: '2026-09-15T00:00:00Z', repaid_at: null },
         { funded_at: '2026-09-01', due_date: '2026-09-02T00:00:00Z', repaid_at: null, is_test: true }
      ],
      NOW
   );
   assertEquals(
      text,
      '✅ Facebook connected — Jaja\n@jaja-reyes · jaja@example.com\nFacebook name: Jaja Reyes\nExisting borrower · 2 funded loans · repaid late ×1 · ⚠️ overdue now ×1\nMessage them from Admin → Borrower contacts.'
   );
});

Deno.test('brand-new borrower without a Facebook name', () => {
   const text = buildFacebookConnectedAlert({ username: 'new-one', display_name: null, email: null }, null, [], NOW);
   assertEquals(
      text,
      '✅ Facebook connected — new-one\n@new-one\nNew borrower (no loans yet)\nMessage them from Admin → Borrower contacts.'
   );
});

Deno.test('flags a Facebook that is already linked to other Moodeng accounts', () => {
   const text = buildFacebookConnectedAlert({ username: 'new-one', display_name: null, email: null }, 'Jaja Reyes', [], NOW, [
      '@jaja-reyes',
      '@jaja2'
   ]);
   assertEquals(text.includes('⚠️ Same Facebook is already linked to @jaja-reyes, @jaja2'), true);
});

Deno.test('a declined ID check is flagged so the team reaches out', () => {
   const text = buildFacebookConnectedAlert(
      { username: 'rae', display_name: 'Rae', email: null, is_didit: 'INACTIVE', didit_id_status: 'Declined', didit_decline_reason: 'Face mismatch' },
      null,
      [],
      NOW
   );
   assertEquals(
      text,
      "✅ Facebook connected — Rae\n@rae\nNew borrower (no loans yet)\n⚠️ Their ID check was DECLINED (Face mismatch) — they connected to talk to us about it. Please message them.\nMessage them from Admin → Borrower contacts."
   );
});

Deno.test('a decline that was later overridden (verified) is not flagged', () => {
   const text = buildFacebookConnectedAlert(
      { username: 'rae', display_name: 'Rae', email: null, is_didit: 'ACTIVE', didit_id_status: 'Declined' },
      null,
      [],
      NOW
   );
   assertEquals(text.includes('DECLINED'), false);
});
