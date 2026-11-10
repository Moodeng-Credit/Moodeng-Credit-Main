import { assert, assertEquals, assertStringIncludes } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import {
   botStartLink,
   bridgeAlreadyText,
   bridgeArrivedText,
   bridgeLink,
   bridgeNudgeText,
   type BridgeRow,
   bridgeStepsMessages,
   bridgeWelcome,
   isBridgeToken,
   newBridgeToken,
   parseBridgeKeyword,
   TELEGRAM_APP_STORE_URL,
   TELEGRAM_PLAY_STORE_URL,
   tgNudgeDue,
   waNudgeDue
} from './idWaBridge.ts';

const TOKEN = 'AbCdEfGhIjKlMnOpQrStUv';
const NOW = Date.parse('2026-11-10T05:00:00Z');
const ago = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();

const row = (over: Partial<BridgeRow> = {}): BridgeRow => ({
   id: 'row-1',
   token: TOKEN,
   contact_id: 'contact-1',
   phone: '6281200000000',
   locale: 'id',
   os: 'a',
   last_inbound_at: ago(30),
   steps_sent_at: ago(30),
   wa_nudges: 0,
   wa_nudged_at: null,
   telegram_id: null,
   telegram_username: null,
   started_at: null,
   tg_nudges: 0,
   tg_nudged_at: null,
   user_id: null,
   ...over
});

Deno.test('the typed message: language and phone type', () => {
   assertEquals(parseBridgeKeyword('Halo Moodeng! Saya mau daftar 👋\n(MDNG-DAFTAR-A)'), { locale: 'id', os: 'a' });
   assertEquals(parseBridgeKeyword('Hi Moodeng! I want to join 👋 (MDNG-JOIN-I)'), { locale: 'en', os: 'i' });
   assertEquals(parseBridgeKeyword('mdng daftar'), { locale: 'id', os: null });
   assertEquals(parseBridgeKeyword('MDNG-DAFTAR'), { locale: 'id', os: null });
});

Deno.test('a verification code or other text is not a bridge message', () => {
   assertEquals(parseBridgeKeyword('Verify my Moodeng account: MDNG-3D66AD'), null);
   assertEquals(parseBridgeKeyword('MDNG-DAFTARAN'), null);
   assertEquals(parseBridgeKeyword('halo'), null);
   assertEquals(parseBridgeKeyword(''), null);
   assertEquals(parseBridgeKeyword(null), null);
});

Deno.test('tokens fit a Telegram /start payload', () => {
   const token = newBridgeToken();
   assert(isBridgeToken(token), token);
   assert(`wa_${token}`.length <= 64);
   assert(!isBridgeToken('short'));
   assert(!isBridgeToken('has space in it 123456'));
   assertEquals(botStartLink('SomeBot', TOKEN), `https://t.me/SomeBot?start=wa_${TOKEN}`);
});

Deno.test('steps: install first, then our own link; the right store for the phone', () => {
   const android = bridgeStepsMessages(TOKEN, 'id', 'a');
   assertEquals(android.length, 4);
   assertStringIncludes(android[1], 'Langkah 1 dari 2');
   assertStringIncludes(android[1], TELEGRAM_PLAY_STORE_URL);
   assert(!android[1].includes(TELEGRAM_APP_STORE_URL));
   assertStringIncludes(android[2], 'Langkah 2 dari 2');
   assertStringIncludes(android[2], bridgeLink(TOKEN));
   // The main step uses our link, not a Telegram address.
   assert(!android[2].includes('t.me/'));

   const iphone = bridgeStepsMessages(TOKEN, 'en', 'i');
   assertStringIncludes(iphone[1], TELEGRAM_APP_STORE_URL);
   assert(!iphone[1].includes(TELEGRAM_PLAY_STORE_URL));

   const unknown = bridgeStepsMessages(TOKEN, 'id', null);
   assertStringIncludes(unknown[1], TELEGRAM_PLAY_STORE_URL);
   assertStringIncludes(unknown[1], TELEGRAM_APP_STORE_URL);
});

Deno.test('WhatsApp never talks about loans or money', () => {
   const texts = [
      ...bridgeStepsMessages(TOKEN, 'id', 'a'),
      ...bridgeStepsMessages(TOKEN, 'en', null),
      bridgeNudgeText(1, TOKEN, 'SomeBot', 'id'),
      bridgeNudgeText(2, TOKEN, 'SomeBot', 'id'),
      bridgeNudgeText(1, TOKEN, 'SomeBot', 'en'),
      bridgeNudgeText(2, TOKEN, 'SomeBot', 'en'),
      bridgeArrivedText('id'),
      bridgeArrivedText('en'),
      bridgeAlreadyText('SomeBot', 'id'),
      bridgeAlreadyText('SomeBot', 'en')
   ];
   for (const text of texts) {
      assert(
         !/pinjam|pinjol|utang|hutang|kredit|bunga|rupiah|dana|uang|loan|lend|borrow|credit|interest|money|cash|\$|usdt|usdc|crypto|kripto/i.test(
            text
         ),
         text
      );
   }
});

Deno.test('the first nudge also gives the direct bot link', () => {
   const text = bridgeNudgeText(1, TOKEN, 'SomeBot', 'id');
   assertStringIncludes(text, bridgeLink(TOKEN));
   assertStringIncludes(text, botStartLink('SomeBot', TOKEN));
});

Deno.test('the bot welcome button signs them in on the join page', () => {
   const welcome = bridgeWelcome('id');
   const button = welcome.keyboard[0][0] as { text: string; login_url: { url: string } };
   assertEquals(button.login_url.url, 'https://moodeng.app/auth/telegram/callback?track=id');
   assertStringIncludes(button.text, 'Mulai daftar');
   assertStringIncludes(bridgeWelcome('en', true).text, 'one more tap');
});

Deno.test('WhatsApp nudges: 20 minutes, then 3 hours, never after the 24h window', () => {
   assertEquals(waNudgeDue(row({ steps_sent_at: ago(10), last_inbound_at: ago(10) }), NOW), null);
   assertEquals(waNudgeDue(row(), NOW), 1);
   assertEquals(waNudgeDue(row({ wa_nudges: 1, wa_nudged_at: ago(60) }), NOW), null);
   assertEquals(waNudgeDue(row({ wa_nudges: 1, wa_nudged_at: ago(181), last_inbound_at: ago(220) }), NOW), 2);
   assertEquals(waNudgeDue(row({ wa_nudges: 2, wa_nudged_at: ago(600) }), NOW), null);
   // Their last message was more than 23 hours ago: free text is no longer allowed.
   assertEquals(waNudgeDue(row({ last_inbound_at: ago(23 * 60 + 5), steps_sent_at: ago(23 * 60 + 5) }), NOW), null);
   // Reached Telegram or joined: no more WhatsApp nudges.
   assertEquals(waNudgeDue(row({ telegram_id: 123 }), NOW), null);
   assertEquals(waNudgeDue(row({ user_id: 'u-1' }), NOW), null);
});

Deno.test('Telegram nudges: 30 minutes after Start, then 20 hours', () => {
   assertEquals(tgNudgeDue(row(), NOW), null);
   assertEquals(tgNudgeDue(row({ telegram_id: 123, started_at: ago(10) }), NOW), null);
   assertEquals(tgNudgeDue(row({ telegram_id: 123, started_at: ago(31) }), NOW), 1);
   assertEquals(tgNudgeDue(row({ telegram_id: 123, started_at: ago(400), tg_nudges: 1, tg_nudged_at: ago(300) }), NOW), null);
   assertEquals(tgNudgeDue(row({ telegram_id: 123, started_at: ago(1500), tg_nudges: 1, tg_nudged_at: ago(1201) }), NOW), 2);
   assertEquals(tgNudgeDue(row({ telegram_id: 123, started_at: ago(31), user_id: 'u-1' }), NOW), null);
});
