import { assert, assertEquals, assertStringIncludes } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import {
   buildVoucherCallback,
   buildVoucherCodeEmail,
   buildRewardNudgeMessage,
   buildRewardSentMessage,
   buildVoucherDigest,
   buildVoucherDigestKeyboard,
   buildVoucherReceiptMessage,
   buildNudgeDraft,
   messengerChatButton,
   messengerOutcomeLine,
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
   // Only people who claimed are listed; the unclaimed are one count line.
   assertStringIncludes(text, '🎁 Not claimed yet: 1 person, ₱100');
   assertEquals(text.includes('• Ana Cruz'), false);
   assertStringIncludes(text, '• Jun · ₱50 · Messenger ✓ · 3d');
   assertStringIncludes(text, '₱50 Xoxo links left: 4 — restock soon');
   assertEquals(text.includes('Claimed, not sent'), false);
   assertStringIncludes(buildVoucherDigest({ unclaimed: [], pending: [], not_arrived: [], no_answer: [] }, 20), 'all confirmed');
   const onlyUnclaimed = buildVoucherDigest({ unclaimed: [person], pending: [], not_arrived: [], no_answer: [] }, 20);
   assertStringIncludes(onlyUnclaimed, 'all confirmed');
   assertStringIncludes(onlyUnclaimed, 'Not claimed yet: 1 person');
});


Deno.test('reward on Messenger: ₱100 is two link buttons, in the bot language', () => {
   const en = buildRewardSentMessage({ firstName: 'Ana', locale: 'en', amountPhp: 100, reward: 'referral_inviter', links: ['https://plum.gift/a', 'https://plum.gift/b'] });
   assertStringIncludes(en.text, 'Hi Ana! Your ₱100 food reward is here for inviting a friend');
   assertEquals(en.card.button, { title: 'Open ₱50 voucher 1', url: 'https://plum.gift/a' });
   assertEquals(en.card.moreButtons, [{ title: 'Open ₱50 voucher 2', url: 'https://plum.gift/b' }]);
   const fil = buildRewardSentMessage({ firstName: null, locale: 'fil', amountPhp: 50, reward: 'tier_rising', links: ['https://plum.gift/a'] });
   assertStringIncludes(fil.text, 'Nandito na ang ₱50 food reward mo dahil umabot na sa Rising');
   assertStringIncludes(fil.text, 'Mang Inasal o Red Ribbon');
   assertEquals(fil.card.button.title, 'Buksan ang voucher');
   for (const msg of [en, fil]) for (const b of [msg.card.button, ...(msg.card.moreButtons ?? [])]) assert(b.title.length <= 20, b.title);
});

Deno.test('reward on Messenger: Bitrefill send points to the email; nudges link to the app', () => {
   const bitrefill = buildRewardSentMessage({ firstName: 'Ana', locale: 'en', amountPhp: 100, reward: 'tier_prime', links: [], product: 'GrabMart' });
   assertStringIncludes(bitrefill.text, 'Bitrefill emailed it to you');
   assertStringIncludes(bitrefill.card.button.url, '/dashboard');
   const nudge = buildRewardNudgeMessage({ kind: 'unclaimed', firstName: 'Ana', locale: 'fil', amountPhp: 150 });
   assertStringIncludes(nudge.text, 'May ₱150 food reward ka');
   assertEquals(nudge.card.button.title, 'I-claim ang reward');
   assertStringIncludes(buildRewardNudgeMessage({ kind: 'no_answer', firstName: null, locale: 'en', amountPhp: 50 }).text, 'Did your ₱50 food voucher arrive?');
});

Deno.test('admin side: 💬 button opens their SendPulse chat; outcome line says what happened', () => {
   const facebook = { contactId: 'c0ffee00-0000-4000-8000-000000000001', facebookName: 'Ana Cruz', firstName: 'Ana', locale: 'en' as const };
   assertEquals(messengerChatButton(facebook), {
      text: '💬 Message Ana on Messenger',
      url: 'https://login.sendpulse.com/chatbots/chats?contact_id=c0ffee00-0000-4000-8000-000000000001&channel=messenger'
   });
   assertEquals(messengerChatButton({ ...facebook, contactId: null }), null);
   assertStringIncludes(messengerOutcomeLine('sent'), 'told them ✓');
   assertStringIncludes(messengerOutcomeLine('send_failed'), 'outside the 24h window');
   assertStringIncludes(messengerOutcomeLine('no_contact'), 'not linked');
});

Deno.test('digest: bot nudge marks and one 💬 button per Messenger person', () => {
   const base = { username: null, facebook: 'Ana Cruz', messenger: true, amountPhp: 50, vouchers: 1, days: 2 };
   const digest = {
      unclaimed: [{ ...base, name: 'Ana', userId: 'u1', messengerContactId: 'c1', nudge: 'sent' as const }],
      pending: [],
      not_arrived: [],
      no_answer: [
         { ...base, name: 'Ana', userId: 'u1', messengerContactId: 'c1', nudge: 'sent' as const },
         { ...base, name: 'Ben', facebook: null, userId: 'u2', messengerContactId: null, nudge: null }
      ]
   };
   const text = buildVoucherDigest(digest, 6);
   assertStringIncludes(text, '🤖 bot nudged');
   assertStringIncludes(text, '📋 copies a ready message');
   const keyboard = buildVoucherDigestKeyboard(digest);
   assertEquals(keyboard.length, 3);
   assertEquals(keyboard[0].map((b) => b.text), ['📥 Open the Moodeng Page inbox']);
   assertEquals(keyboard[1].map((b) => b.text), ['💬 Ana Cruz', '📋 Copy message', '👤']);
   const copy = keyboard[1][1] as { copy_text: { text: string } };
   assertStringIncludes(copy.copy_text.text, 'We sent your ₱50 food voucher');
   assertEquals(keyboard[2].map((b) => b.text), ['📋 Copy message · Ben', '👤']);
   assertEquals(buildVoucherDigestKeyboard({ unclaimed: [], pending: [], not_arrived: [], no_answer: [] }), []);
   // Unclaimed people get no buttons.
   assertEquals(buildVoucherDigestKeyboard({ ...digest, no_answer: [] }), []);

   const reach = buildVoucherDigest(digest, 6);
   assertStringIncludes(reach, '👋 HOW TO REACH THEM');
   assertStringIncludes(reach, '📘 On Facebook Messenger (2)');
   assertStringIncludes(reach, '• Type "Ana Cruz" — that\'s Ana');
   assertStringIncludes(reach, '• Ben — on Messenger, name not saved: tap their 💬 below');
   const offline = buildVoucherDigest({ unclaimed: [], pending: [], not_arrived: [], no_answer: [{ ...base, name: 'Cy', facebook: null, messenger: false, email: 'cy@example.com' }] }, 6);
   assertStringIncludes(offline, '📵 Not on Facebook (1): email or text them\n• Cy — ✉️ cy@example.com');
});

Deno.test('digest: says what each person is owed and how to reach them', () => {
   const person = {
      name: 'Ana Cruz',
      username: 'ana.c',
      facebook: null,
      messenger: false,
      amountPhp: 100,
      vouchers: 2,
      days: null,
      rewards: [
         { reward: 'first_on_time_repayment', amountPhp: 50 },
         { reward: 'tier_rising', amountPhp: '50.00' }
      ],
      phone: '09171234567',
      email: 'ana@example.com'
   };
   const text = buildVoucherDigest({ unclaimed: [], pending: [], not_arrived: [], no_answer: [person] }, 6);
   assertStringIncludes(text, '↳ First on-time ₱50 + Rising ₱50');
   assertStringIncludes(text, '↳ 📞 09171234567 · ✉️ ana@example.com');
   assertStringIncludes(text, '👤 = their account.');
   const noContact = buildVoucherDigest({ unclaimed: [], pending: [], not_arrived: [], no_answer: [{ ...person, phone: null, email: null, rewards: [] }] }, 6);
   assertEquals(noContact.includes('↳'), false);
});

Deno.test('reward message: a Giftaway food eGift is one button and says where it works', () => {
   const msg = buildRewardSentMessage({ firstName: 'Ana', locale: 'en', amountPhp: 100, reward: 'tier_rising', links: ['https://gft.ph/x'], product: 'Jollibee Group', provider: 'giftaway' });
   assertStringIncludes(msg.text, 'Your ₱100 food reward is here');
   assertStringIncludes(msg.text, 'Burger King');
   assertStringIncludes(msg.text, 'Giftaway also texted and emailed it');
   assertEquals(msg.card.button.url, 'https://gft.ph/x');
   assertEquals(msg.card.moreButtons, undefined);

   const grab = buildRewardSentMessage({ firstName: null, locale: 'fil', amountPhp: 50, reward: 'tier_rising', links: ['https://gft.ph/g'], product: 'Grab', provider: 'giftaway' });
   assertStringIncludes(grab.text, 'Grab app');
   assertStringIncludes(grab.text, 'Na-text at na-email');
});

Deno.test('receipt message says whether Giftaway resent it', () => {
   const claim = { id: CLAIM_ID, reward: 'tier_rising', amount_php: 50, brand: 'food', full_name: 'Ana Cruz', mobile: '09171234567', email: 'a@b.co', status: 'sent', created_at: '', received_at: null };
   assertStringIncludes(buildVoucherReceiptMessage(claim, true), 'Giftaway resent the eGift');
   assertStringIncludes(buildVoucherReceiptMessage(claim, false), "Giftaway resend didn't go through");
   assertStringIncludes(buildVoucherReceiptMessage(claim), 'resend from Admin');
});

Deno.test('digest shows Giftaway credits', () => {
   const empty = { unclaimed: [], pending: [], not_arrived: [], no_answer: [] };
   assertStringIncludes(buildVoucherDigest(empty, 6, 320), 'Giftaway credits: ₱320.00 — top up soon');
   assertStringIncludes(buildVoucherDigest(empty, null, 1200), '\n\nGiftaway credits: ₱1200.00');
   assert(!buildVoucherDigest(empty, 6).includes('Giftaway'));
});

Deno.test('nudge drafts fit Telegram and match the situation', () => {
   const person = { name: 'Ana Cruz', username: null, facebook: 'Ana C', messenger: true, amountPhp: '100.00', vouchers: 2, days: 1, email: 'ana@example.com' };
   assertStringIncludes(buildNudgeDraft('unclaimed', person), 'Hi Ana! 🎁 You have ₱100 in food rewards');
   assertStringIncludes(buildNudgeDraft('no_answer', person), 'sent your ₱100 food voucher to ana@example.com');
   assertStringIncludes(buildNudgeDraft('not_arrived', person), "didn't arrive");
   assertStringIncludes(buildNudgeDraft('pending', { ...person, facebook: null }), 'Hi Ana!');
   const long = buildNudgeDraft('no_answer', { ...person, email: `${'x'.repeat(240)}@example.com` });
   assert(long.length <= 256);
});
