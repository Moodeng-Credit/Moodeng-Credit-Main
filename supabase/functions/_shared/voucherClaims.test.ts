import { assert, assertEquals, assertStringIncludes } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { buildVoucherCallback, buildVoucherCodeEmail, parseVoucherCallback } from './voucherClaims.ts';

const CLAIM_ID = '0274e575-7921-4a25-b4f3-722fba3c2da6';

Deno.test('voucher card buttons round-trip', () => {
   assertEquals(parseVoucherCallback(buildVoucherCallback('sent', CLAIM_ID)), { decision: 'sent', claimId: CLAIM_ID });
   assertEquals(parseVoucherCallback(buildVoucherCallback('rejected', CLAIM_ID)), { decision: 'rejected', claimId: CLAIM_ID });
   assertEquals(parseVoucherCallback('vo:x:' + CLAIM_ID), null);
});

Deno.test('voucher email: first name, amount, reason and the code', () => {
   const email = buildVoucherCodeEmail({ fullName: '  Maria  Santos ', amountPhp: 50, reward: 'tier_rising', code: 'GRAB-1234-ABCD' });
   assertEquals(email.subject, 'Your ₱50 GrabFood voucher from Moodeng Credit');
   assertStringIncludes(email.text, 'Hi Maria,');
   assertStringIncludes(email.text, 'for growing your Moodeng to Rising');
   assertStringIncludes(email.text, 'Your code: GRAB-1234-ABCD');
   assertStringIncludes(email.html, 'GRAB-1234-ABCD');
});

Deno.test('voucher email escapes HTML in the name and code', () => {
   const email = buildVoucherCodeEmail({ fullName: '<b>x</b>', amountPhp: 100, reward: 'unknown', code: 'A&B<1>' });
   assert(!email.html.includes('<b>x</b>'));
   assertStringIncludes(email.html, 'A&amp;B&lt;1&gt;');
   assertStringIncludes(email.text, 'from Moodeng Credit');
});
