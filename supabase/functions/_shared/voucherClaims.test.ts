import { assert, assertEquals, assertStringIncludes } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import {
   buildVoucherCallback,
   buildVoucherCodeEmail,
   buildVoucherDigest,
   parseVoucherCallback,
   voucherDecidedBy,
   voucherStampHeader
} from './voucherClaims.ts';

const CLAIM_ID = '0274e575-7921-4a25-b4f3-722fba3c2da6';

Deno.test('voucher card buttons round-trip', () => {
   assertEquals(parseVoucherCallback(buildVoucherCallback('sent', CLAIM_ID)), { decision: 'sent', claimId: CLAIM_ID });
   assertEquals(parseVoucherCallback(buildVoucherCallback('rejected', CLAIM_ID)), { decision: 'rejected', claimId: CLAIM_ID });
   assertEquals(parseVoucherCallback('vo:x:' + CLAIM_ID), null);
});

Deno.test('voucher email: one ₱50 link is one button, with the brands and the reason', () => {
   const email = buildVoucherCodeEmail({ fullName: '  Maria  Santos ', amountPhp: 50, reward: 'tier_rising', links: ['https://rewards.xoxoday.com/a'] });
   assertEquals(email.subject, 'Your ₱50 food voucher from Moodeng Credit');
   assertStringIncludes(email.text, 'Hi Maria,');
   assertStringIncludes(email.text, 'for growing your Moodeng to Rising');
   assertStringIncludes(email.text, 'Your voucher: https://rewards.xoxoday.com/a');
   assertStringIncludes(email.text, 'Jollibee');
   assertStringIncludes(email.html, 'Open my food voucher');
});

Deno.test('voucher email: ₱100 sends two ₱50 links', () => {
   const email = buildVoucherCodeEmail({ fullName: 'Ana', amountPhp: 100, reward: 'referral_inviter', links: ['https://x/1', 'https://x/2'] });
   assertStringIncludes(email.text, '₱50 voucher 1: https://x/1');
   assertStringIncludes(email.text, '₱50 voucher 2: https://x/2');
   assertStringIncludes(email.html, 'Open ₱50 voucher 2');
});

Deno.test('voucher email escapes HTML in the name and link', () => {
   const email = buildVoucherCodeEmail({ fullName: '<b>x</b>', amountPhp: 50, reward: 'unknown', links: ['https://x/?a=1&b="2"'] });
   assert(!email.html.includes('<b>x</b>'));
   assertStringIncludes(email.html, 'a=1&amp;b=&quot;2&quot;');
});

Deno.test('who decided, read from the admin note', () => {
   assertEquals(voucherDecidedBy('rejected by @george via Telegram'), '@george');
   assertEquals(voucherDecidedBy('Xoxo link sent by auto · rejected by @ann via Telegram'), '@ann');
   assertEquals(voucherDecidedBy('Xoxo link sent by auto'), null);
});

Deno.test('stamp headers say food voucher', () => {
   assertStringIncludes(voucherStampHeader('sent', { full_name: 'Irish Cruz', amount_php: 100 }), '₱100 food voucher');
});

Deno.test('receipt message: got it vs didn’t arrive, naming the pick', async () => {
   const { buildVoucherReceiptMessage } = await import('./voucherClaims.ts');
   const base = { id: CLAIM_ID, reward: 'tier_rising', amount_php: '50', full_name: 'Maria Santos', mobile: '0917', email: 'm@x.ph', status: 'sent', created_at: '' };
   assertStringIncludes(buildVoucherReceiptMessage({ ...base, brand: 'food', received_at: '2026-10-27' }), '✅ Maria Santos got their ₱50 🍗 Food link');
   const issue = buildVoucherReceiptMessage({ ...base, brand: 'grabmart', received_at: null });
   assertStringIncludes(issue, "didn't arrive");
   assertStringIncludes(issue, '🛒 GrabMart');
});

Deno.test('daily digest: sections, Facebook, days, stock and the all-clear', () => {
   const person = { name: 'Ana Cruz', username: 'ana.c', facebook: 'Ana C', messenger: true, amountPhp: 100, vouchers: 2, days: null };
   const text = buildVoucherDigest(
      { unclaimed: [person], pending: [], not_arrived: [], no_answer: [{ ...person, name: 'Jun', username: null, facebook: null, amountPhp: '50.00', vouchers: 1, days: 3 }] },
      4
   );
   assertStringIncludes(text, '🎁 Earned, not claimed yet (nudge them to claim) — 1 person, ₱100');
   assertStringIncludes(text, '• Ana Cruz (@ana.c) · ₱100 (2) · FB: Ana C');
   assertStringIncludes(text, '• Jun · ₱50 · Messenger ✓ · 3d');
   assertStringIncludes(text, '₱50 Xoxo links left: 4 — restock soon');
   assertEquals(text.includes('Claimed, not sent'), false);
   assertStringIncludes(buildVoucherDigest({ unclaimed: [], pending: [], not_arrived: [], no_answer: [] }, 20), 'nothing waiting');
});

