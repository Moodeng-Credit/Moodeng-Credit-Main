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
   assertEquals(text, '✅ Facebook connected — new-one\n@new-one\nNew borrower (no loans yet)\nMessage them from Admin → Borrower contacts.');
});
