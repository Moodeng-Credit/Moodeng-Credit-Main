import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import {
   adminUserUrl,
   alreadyDecidedHeader,
   linkRows,
   renderDecidedCard,
   stampDecisionCards,
   TELEGRAM_TEXT_LIMIT,
   truncateForTelegram,
   withAdminLink
} from './adminCards.ts';
import { buildKycRetryCallback, classifyKycOutcome, kycVerdictStamp, parseKycRetryCallback } from './kycCards.ts';
import { loanAccessStampHeader } from './loanAccess.ts';
import { voucherDecidedBy, voucherStampHeader } from './voucherClaims.ts';

const USER_ID = 'b5e3f979-6f66-45c7-9af1-c56133e6c1b4';
const AT = new Date('2026-10-11T08:04:00Z'); // 3:04 PM in Bangkok

Deno.test('decided card: status header first, then the original card, then who and when (Bangkok)', () => {
   const text = renderDecidedCard('📞 New borrower booked their intro call\nWho: Irish', {
      header: loanAccessStampHeader('approved', 'Irish'),
      by: '@george',
      at: AT
   });
   assertEquals(
      text,
      '✅ APPROVED — Irish can now apply for a loan\n\n📞 New borrower booked their intro call\nWho: Irish\n\nDecided by @george · Oct 11, 3:04 PM Bangkok'
   );
});

Deno.test('decided card: a huge card is cut to Telegram’s 4096 limit, header and footer kept', () => {
   const text = renderDecidedCard('x'.repeat(10_000), {
      header: '❌ NO-SHOW — Irish was asked to book a new call',
      detail: 'held',
      by: '@george',
      at: AT
   });
   assertEquals(text.length <= TELEGRAM_TEXT_LIMIT, true);
   assertEquals(text.startsWith('❌ NO-SHOW'), true);
   assertEquals(text.endsWith('Decided by @george · Oct 11, 3:04 PM Bangkok'), true);
});

Deno.test('truncate never splits an emoji in half', () => {
   const cut = truncateForTelegram('ab😀cd', 4); // room for 3 units before "…": "ab" + half an emoji
   assertEquals(cut, 'ab…');
   assertEquals(truncateForTelegram('short', 10), 'short');
});

Deno.test('already-decided taps read as information', () => {
   assertEquals(alreadyDecidedHeader('Already approved by @george — nothing changed.'), 'ℹ️ Already decided — approved by @george');
   assertEquals(alreadyDecidedHeader('Already marked no-show — nothing changed.'), 'ℹ️ Already decided — marked no-show');
   assertEquals(alreadyDecidedHeader('That request no longer exists.'), 'ℹ️ Already decided — That request no longer exists.');
});

Deno.test('a decided card keeps only its link buttons, plus 👤 Open in admin', () => {
   const rows = linkRows([
      [
         { text: '✅ Approve', callback_data: `la:a:${USER_ID}` },
         { text: '❌ Reject', callback_data: `la:r:${USER_ID}` }
      ],
      [{ text: '💬 Open Page inbox', url: 'https://business.facebook.com/inbox' }]
   ]);
   assertEquals(rows, [[{ text: '💬 Open Page inbox', url: 'https://business.facebook.com/inbox' }]]);
   const withAdmin = withAdminLink(rows, USER_ID, 'irish_1');
   assertEquals(withAdmin.length, 2);
   assertEquals(withAdmin[1][0].url, adminUserUrl(USER_ID, 'irish_1'));
   assertEquals(withAdminLink(withAdmin, USER_ID, 'irish_1').length, 2); // not added twice
   assertEquals(adminUserUrl(USER_ID, 'irish_1').endsWith(`/admin?q=irish_1&user=${USER_ID}`), true);
});

Deno.test('stampDecisionCards claims every remembered card for the decision and edits it', async () => {
   const calls: unknown[][] = [];
   const refs = [
      {
         channel: 'telegram',
         chat_id: '-100',
         webhook_key: null,
         message_id: '11',
         original_text: 'call starting',
         original_payload: { links: [] }
      },
      {
         channel: 'telegram',
         chat_id: '-100',
         webhook_key: null,
         message_id: '12',
         original_text: 'did they show up?',
         original_payload: null
      },
      { channel: 'discord', chat_id: null, webhook_key: 'kyc', message_id: '99', original_text: 'x', original_payload: null }
   ];
   const builder: Record<string, unknown> = {};
   for (const m of ['delete', 'eq']) {
      builder[m] = (...args: unknown[]) => {
         calls.push([m, ...args]);
         return builder;
      };
   }
   builder.select = () => Promise.resolve({ data: refs, error: null });
   const svc = { from: (table: string) => (calls.push(['from', table]), builder) };

   const edits: Array<Record<string, unknown>> = [];
   const realFetch = globalThis.fetch;
   Deno.env.set('TELEGRAM_API_TOKEN', 'test-token');
   globalThis.fetch = ((_url: string, init: RequestInit) => {
      edits.push(JSON.parse(String(init.body)));
      return Promise.resolve(new Response(JSON.stringify({ ok: true, result: true })));
   }) as typeof fetch;
   try {
      const n = await stampDecisionCards(svc, 'loan_access', USER_ID, '❌ NO-SHOW — Irish was asked to book a new call', {
         by: '@george',
         at: AT
      });
      assertEquals(n, 3);
      assertEquals(calls.slice(0, 4), [
         ['from', 'admin_message_refs'],
         ['delete'],
         ['eq', 'kind', 'loan_access'],
         ['eq', 'ref_id', USER_ID]
      ]);
      // Both Telegram cards edited; the Discord ref's webhook env ('kyc') isn't set, so it's skipped.
      assertEquals(edits.map((e) => e.message_id).sort(), [11, 12]);
      assertEquals(String(edits[0].text).startsWith('❌ NO-SHOW — Irish was asked to book a new call'), true);
      assertEquals('reply_markup' in edits[0], false); // no links → keyboard removed
   } finally {
      globalThis.fetch = realFetch;
      Deno.env.delete('TELEGRAM_API_TOKEN');
   }
});

Deno.test('every card type has a header that says what it means for the person', () => {
   assertEquals(loanAccessStampHeader('approved', 'Irish', { call: true }), '✅ SHOWED UP → APPROVED — Irish can now apply for a loan');
   assertEquals(loanAccessStampHeader('rejected', 'Irish'), "🚫 REJECTED — Irish's application is closed");
   assertEquals(loanAccessStampHeader('no_show', 'Irish'), '❌ NO-SHOW — Irish was asked to book a new call');
   assertEquals(
      voucherStampHeader('sent', { full_name: 'Irish Cruz', amount_php: '150.00' }),
      '🎟 VOUCHER SENT — Irish Cruz got their ₱150 GrabMart code'
   );
   assertEquals(voucherDecidedBy('sent by @george via Telegram'), '@george');
   assertEquals(voucherDecidedBy('wrong number'), null);
   assertEquals(kycVerdictStamp('✅ Approved — user is now verified', 'Irish')?.header, '✅ DIDIT APPROVED — Irish is ID-verified');
   assertEquals(kycVerdictStamp('❌ Declined — Document expired', 'Irish')?.detail, 'Reason: Document expired');
   assertEquals(kycVerdictStamp('👀 IN MANUAL REVIEW — check the Didit dashboard to expedite', 'Irish'), null);
   assertEquals(classifyKycOutcome('🚫 Duplicate face — blocked'), 'duplicate');
});

Deno.test('KYC retry callback round-trips and fits Telegram’s 64 bytes', () => {
   const data = buildKycRetryCallback(USER_ID);
   assertEquals(new TextEncoder().encode(data).length <= 64, true);
   assertEquals(parseKycRetryCallback(data), { userId: USER_ID });
   assertEquals(parseKycRetryCallback(`la:a:${USER_ID}`), null);
});
