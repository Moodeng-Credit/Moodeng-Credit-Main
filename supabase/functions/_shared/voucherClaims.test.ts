import { assert, assertEquals, assertStringIncludes } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { buildVoucherCallback, buildVoucherCodeEmail, parseVoucherCallback, voucherDecidedBy, voucherStampHeader } from './voucherClaims.ts';

const CLAIM_ID = '0274e575-7921-4a25-b4f3-722fba3c2da6';

Deno.test('voucher card buttons round-trip', () => {
   assertEquals(parseVoucherCallback(buildVoucherCallback('sent', CLAIM_ID)), { decision: 'sent', claimId: CLAIM_ID });
   assertEquals(parseVoucherCallback(buildVoucherCallback('rejected', CLAIM_ID)), { decision: 'rejected', claimId: CLAIM_ID });
   assertEquals(parseVoucherCallback('vo:x:' + CLAIM_ID), null);
});

Deno.test('voucher email: first name, amount, how to use it and the code', () => {
   const email = buildVoucherCodeEmail({ fullName: '  Maria  Santos ', amountPhp: 100, code: 'GRAB-1234-ABCD' });
   assertEquals(email.subject, 'Your ₱100 GrabMart voucher from Moodeng Credit');
   assertStringIncludes(email.text, 'Hi Maria,');
   assertStringIncludes(email.text, 'Grab → Mart');
   assertStringIncludes(email.text, 'Your code: GRAB-1234-ABCD');
   assertStringIncludes(email.html, 'GRAB-1234-ABCD');
});

Deno.test('voucher email escapes HTML in the name and code', () => {
   const email = buildVoucherCodeEmail({ fullName: '<b>x</b>', amountPhp: 100, code: 'A&B<1>' });
   assert(!email.html.includes('<b>x</b>'));
   assertStringIncludes(email.html, 'A&amp;B&lt;1&gt;');
});

Deno.test('who decided, read from the admin note', () => {
   assertEquals(voucherDecidedBy('rejected by @george via Telegram'), '@george');
   assertEquals(voucherDecidedBy('banked toward GrabMart ₱100 (2026-10-26) · rejected by @ann via Telegram'), '@ann');
   assertEquals(voucherDecidedBy('Code sent by auto'), null);
});

Deno.test('stamp headers name GrabMart', () => {
   assertStringIncludes(voucherStampHeader('sent', { full_name: 'Irish Cruz', amount_php: 100 }), '₱100 GrabMart code');
   assertStringIncludes(voucherStampHeader('rejected', { full_name: 'Irish Cruz', amount_php: 100 }), 'GrabMart wallet');
});
