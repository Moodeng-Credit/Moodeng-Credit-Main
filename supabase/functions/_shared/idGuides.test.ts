import { assert, assertEquals, assertStringIncludes } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { GUIDES, guideListScreen, guideStepScreen, parseGuidePhotoCommand } from './idGuides.ts';
import { parseHelperReply } from './idHelper.ts';
import { callbackFits, ID_GUIDE_KEYS, isIdQuestionText, parseIdBotCallback } from './idLoanMath.ts';
import { cleanTelegramUsername, payoutCard } from './idWaltPayouts.ts';

const callbacks = (keyboard: Array<Array<Record<string, unknown>>>) =>
   keyboard.flat().filter((b) => typeof b.callback_data === 'string').map((b) => b.callback_data as string);

Deno.test('every guide step: fits Telegram, both languages, back/next wired, help on every screen', () => {
   for (const key of ID_GUIDE_KEYS) {
      const n = GUIDES[key].steps.length;
      assert(n >= 3 && n <= 7, `${key}: 3–7 steps`);
      for (let i = 1; i <= n; i += 1) {
         for (const l of ['id', 'en'] as const) {
            const s = guideStepScreen(l, key, i, { waltUsername: 'jimmymoodengcredit' });
            assertStringIncludes(s.text, `${i}/${n}`);
            assert(!s.text.includes('{walt}'));
            assert(s.text.length < 1000, 'fits a photo caption');
            const data = callbacks(s.keyboard);
            for (const d of data) {
               assert(callbackFits(d), d);
               assert(parseIdBotCallback(d), `parses: ${d}`);
            }
            if (i > 1) assert(data.includes(`idg:${key}:${i - 1}`));
            if (i < n) assert(data.includes(`idg:${key}:${i + 1}`));
            assert(s.keyboard.flat().some((b) => 'url' in b && String(b.url).includes('start=support')), 'help on every screen');
         }
      }
   }
});

Deno.test('guide steps clamp, the username guide ends with a re-check, warnings on the last step only', () => {
   assertStringIncludes(guideStepScreen('id', 'cash', 99).text, '6/6');
   assertStringIncludes(guideStepScreen('id', 'cash', 0).text, '1/6');
   assert(callbacks(guideStepScreen('id', 'uname', GUIDES.uname.steps.length).keyboard).includes('idg:uname:ok'));
   assert(!guideStepScreen('id', 'send', 1).text.includes('JANGAN'));
   assertStringIncludes(guideStepScreen('id', 'send', GUIDES.send.steps.length).text, 'JANGAN pakai "Withdraw"');
   assertStringIncludes(guideStepScreen('id', 'send', 1, { waltUsername: '@jimmymoodengcredit' }).text, '@jimmymoodengcredit');
   assertEquals(guideStepScreen('id', 'cash', 2, { media: { 'cash:2': 'FILEID' } }).photo, 'FILEID');
   assertEquals(callbacks(guideListScreen('id').keyboard).filter((d) => d.startsWith('idg:')).length, ID_GUIDE_KEYS.length);
});

Deno.test('guide callbacks parse; junk does not', () => {
   assertEquals(parseIdBotCallback('idg:cash:3'), { kind: 'guide', guide: 'cash', step: 3 });
   assertEquals(parseIdBotCallback('idg:uname:ok'), { kind: 'guide', guide: 'uname', step: 'ok' });
   assertEquals(parseIdBotCallback('idg:list:0'), { kind: 'guide', guide: 'list', step: 0 });
   assertEquals(parseIdBotCallback('idg:nope:1'), null);
   assertEquals(parseIdBotCallback('idg:cash:999'), null);
});

Deno.test('questions for the helper', () => {
   assert(isIdQuestionText('gimana cara cairkan?'));
   assert(!isIdQuestionText('/start'));
   assert(!isIdQuestionText('1'));
   assert(!isIdQuestionText('x'.repeat(601)));
});

Deno.test('helper replies: unsure / odd → hand off; never another @username or an address', () => {
   assertEquals(parseHelperReply({ answer: 'Buka Walt lalu tekan Jual.', guide: 'cash', confident: true, handoff: false }, ['jimmymoodengcredit']), {
      answer: 'Buka Walt lalu tekan Jual.',
      guide: 'cash',
      handoff: false
   });
   assert(parseHelperReply({ answer: 'Hmm', guide: null, confident: false }).handoff);
   assert(parseHelperReply({ answer: '', confident: true }).handoff);
   assertEquals(parseHelperReply({ answer: 'x', guide: 'evil', confident: true }).guide, null);
   const scam = parseHelperReply({ answer: 'Kirim ke @someone_else', confident: true }, ['jimmymoodengcredit']);
   assert(scam.handoff && scam.answer === '');
   assert(parseHelperReply({ answer: 'Kirim ke 0x1234567890abcdef', confident: true }).handoff);
   assert(!parseHelperReply({ answer: 'Transfer ke @jimmymoodengcredit di @wallet', confident: true }, ['jimmymoodengcredit']).handoff);
   assert(!parseHelperReply({ answer: 'Jangan kasih PIN ke siapa pun.', confident: true }).handoff, 'safety advice is fine');
   assert(parseHelperReply(null).handoff);
});

Deno.test('Telegram usernames for Walt Transfer', () => {
   assertEquals(cleanTelegramUsername('@Budi_88'), 'Budi_88');
   assertEquals(cleanTelegramUsername('budi'), 'budi');
   assertEquals(cleanTelegramUsername('ab'), null);
   assertEquals(cleanTelegramUsername('1budi'), null);
   assertEquals(cleanTelegramUsername(null), null);
});

Deno.test('payout card: amount + @username to copy, one ✅ Sent button that fits', () => {
   const card = payoutCard(
      { id: '11111111-2222-3333-4444-555555555555', tracking_id: 'MC-1', borrower_user_id: 'u', loan_amount: 5, repay_idr: 110000, due_date: '2026-11-22T00:00:00.000Z' },
      { telegram_username: 'budi_88', display_name: 'Budi', chat_id: 1, preferred_locale: null },
      'budi_88'
   );
   assertStringIncludes(card.text, 'send 5 USDT to @budi_88 by Walt Transfer');
   assertStringIncludes(card.text, 'NOT Withdraw');
   const copies = card.keyboard.flat().filter((b) => 'copy_text' in b) as Array<{ copy_text: { text: string } }>;
   assertEquals(copies.map((c) => c.copy_text.text), ['@budi_88', '5']);
   const data = callbacks(card.keyboard);
   assertEquals(data, ['idwp:11111111-2222-3333-4444-555555555555', 'idwx:11111111-2222-3333-4444-555555555555']);
   for (const d of data) {
      assert(callbackFits(d));
      assertEquals(parseIdBotCallback(d), null, 'not a borrower button');
      assert(!d.startsWith('idw:'), 'not swallowed by the deposit-card handler');
   }
});

Deno.test('/idguidephoto parsing', () => {
   assertEquals(parseGuidePhotoCommand('/idguidephoto cash 2'), { key: 'cash', step: 2, clear: false });
   assertEquals(parseGuidePhotoCommand('/idguidephoto@moodengbot send 5 clear'), { key: 'send', step: 5, clear: true });
   assertEquals(parseGuidePhotoCommand('/idguidephoto'), 'list');
   assertEquals(parseGuidePhotoCommand('/idguidephoto cash 99'), null);
   assertEquals(parseGuidePhotoCommand('/idguidephoto nope 1'), null);
});
