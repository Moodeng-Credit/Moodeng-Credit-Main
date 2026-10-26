import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { stampDecisionCards } from './adminCards.ts';
import { discordWebhookUrl, postDiscord, renderDiscordStamped, stampColor } from './discord.ts';
import { type StateEvent, stateEventStamp } from './stateEvents.ts';

const ev = (kind: string, to: string, extra: Partial<StateEvent> = {}): StateEvent => ({
   id: 1,
   kind,
   ref_id: 'ref-1',
   user_id: null,
   from_state: null,
   to_state: to,
   actor: null,
   meta: {},
   ...extra
});

// ---- Header mapping ----------------------------------------------------------------------------

Deno.test('loan events map to headers; only terminal states are final', () => {
   const funded = stateEventStamp(ev('loan', 'funded', { actor: '@lena', meta: { lender: '@lena' } }))!;
   assertEquals([funded.cardKind, funded.header, funded.final, funded.by], ['loan', '✅ FUNDED by @lena', false, '@lena']);
   assertEquals(stateEventStamp(ev('loan', 'overdue'))!.header, '⚠️ OVERDUE');
   assertEquals(stateEventStamp(ev('loan', 'overdue'))!.final, false);
   assertEquals(stateEventStamp(ev('loan', 'repaid'))!.header, '💸 REPAID');
   assertEquals(stateEventStamp(ev('loan', 'repaid', { meta: { late: true } }))!.header, '💸 REPAID (late)');
   assertEquals(stateEventStamp(ev('loan', 'repaid'))!.final, true);
   assertEquals(stateEventStamp(ev('loan', 'refunded', { meta: { reason: 'dup' } }))!.detail, 'Reason: dup');
   assertEquals(stateEventStamp(ev('loan', 'deleted'))!.header, '🗑 DELETED');
   assertEquals(stateEventStamp(ev('loan', 'expired'))!.header, '⌛ EXPIRED');
   assertEquals(stateEventStamp(ev('loan', 'requested')), null);
});

Deno.test('access, KYC, voucher and messenger events map to the existing card kinds', () => {
   const approved = stateEventStamp(ev('loan_access', 'approved', { actor: 'George' }))!;
   assertEquals([approved.cardKind, approved.final, approved.by, approved.verb], ['loan_access', true, 'George', 'Decided by']);
   assertEquals(stateEventStamp(ev('loan_access_request', 'no_show'))!.header, '🚫 NO-SHOW');
   assertEquals(stateEventStamp(ev('loan_access', 'pending')), null);
   assertEquals(stateEventStamp(ev('video_call', 'attended'))!.final, false);
   const kyc = stateEventStamp(ev('kyc', 'declined', { meta: { reason: 'blurry' } }))!;
   assertEquals([kyc.cardKind, kyc.header, kyc.detail], ['kyc_review', '❌ KYC DECLINED', 'Reason: blurry']);
   assertEquals(stateEventStamp(ev('kyc', 'in_review'))!.final, false);
   assertEquals(stateEventStamp(ev('voucher', 'sent'))!.header, '✅ VOUCHER SENT');
   assertEquals(stateEventStamp(ev('messenger', 'verified'))!.cardKind, 'messenger');
   const system = stateEventStamp(ev('loan', 'overdue', { actor: 'system' }))!;
   assertEquals([system.by, system.verb], ['system', 'Updated by']);
   assertEquals(stateEventStamp(ev('world_id', 'active')), null);
});

// ---- Discord render ----------------------------------------------------------------------------

Deno.test('renderDiscordStamped prefixes the embed title, recolours it and adds a Status field', () => {
   const original = { embeds: [{ title: '💸 New loan request', description: 'body', color: 1, fields: [{ name: 'a', value: 'b' }] }] };
   const first = renderDiscordStamped(original, { header: '✅ FUNDED by @lena', footer: 'Funded by @lena · now' });
   const again = renderDiscordStamped(original, { header: '⚠️ OVERDUE', detail: 'x', footer: 'Updated by system · later' });
   assertEquals(first.embeds![0].title, '✅ FUNDED by @lena · 💸 New loan request');
   assertEquals(first.embeds![0].color, 0x57f287);
   assertEquals(first.embeds![0].fields, [{ name: 'a', value: 'b' }, { name: 'Status', value: 'Funded by @lena · now' }]);
   // Re-rendered from the original: no stacking.
   assertEquals(again.embeds![0].title, '⚠️ OVERDUE · 💸 New loan request');
   assertEquals(again.embeds![0].color, 0xf39c12);
   assertEquals(again.embeds![0].fields!.length, 3);
   assertEquals(original.embeds[0].fields.length, 1); // original untouched
});

Deno.test('renderDiscordStamped puts the header on top of plain content within 2000 chars', () => {
   const out = renderDiscordStamped({ content: 'x'.repeat(3000) }, { header: '🚫 NO-SHOW', footer: 'Decided by George · now' });
   assertEquals(out.content!.startsWith('**🚫 NO-SHOW**\n\n'), true);
   assertEquals(out.content!.endsWith('_Decided by George · now_'), true);
   assertEquals(out.content!.length <= 2000, true);
   assertEquals(stampColor('❌ KYC DECLINED'), 0xe74c3c);
   assertEquals(stampColor('↩️ REFUNDED'), 0x95a5a6);
});

Deno.test('discordWebhookUrl keeps the thread query and adds wait / message id', () => {
   const hook = 'https://discord.com/api/webhooks/1/tok?thread_id=5';
   assertEquals(discordWebhookUrl(hook, { wait: true }), 'https://discord.com/api/webhooks/1/tok?thread_id=5&wait=true');
   assertEquals(discordWebhookUrl(hook, { messageId: '9' }), 'https://discord.com/api/webhooks/1/tok/messages/9?thread_id=5');
});

// ---- Post → remember → edit -------------------------------------------------------------------

const HOOK = 'https://discord.com/api/webhooks/123/token';

Deno.test('postDiscord with ref posts with wait=true and remembers the env key, not the URL', async () => {
   const inserts: unknown[] = [];
   const svc = { from: () => ({ insert: (row: unknown) => (inserts.push(row), Promise.resolve({ error: null })) }) };
   const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
   const realFetch = globalThis.fetch;
   Deno.env.set('DISCORD_REQUESTS_WEBHOOK_URL', HOOK);
   globalThis.fetch = ((url: string, init: RequestInit) => {
      requests.push({ url, body: JSON.parse(String(init.body)) });
      return Promise.resolve(new Response(JSON.stringify({ id: '777' })));
   }) as typeof fetch;
   try {
      const payload = { embeds: [{ title: 'New loan request' }] };
      const ok = await postDiscord(payload, { prefer: ['DISCORD_REQUESTS_WEBHOOK_URL'], ref: { svc, kind: 'loan', refId: 'L1' } });
      assertEquals(ok, true);
      assertEquals(requests[0].url, `${HOOK}?wait=true`);
      assertEquals(requests[0].body.allowed_mentions, { parse: [] });
      assertEquals(inserts, [
         {
            kind: 'loan',
            ref_id: 'L1',
            channel: 'discord',
            webhook_key: 'DISCORD_REQUESTS_WEBHOOK_URL',
            message_id: '777',
            original_text: null,
            original_payload: payload
         }
      ]);
   } finally {
      globalThis.fetch = realFetch;
      Deno.env.delete('DISCORD_REQUESTS_WEBHOOK_URL');
   }
});

const refsClient = (refs: unknown[], calls: unknown[][]) => {
   const builder: Record<string, unknown> = {};
   let selected = false;
   for (const m of ['delete', 'select', 'eq']) {
      builder[m] = (...args: unknown[]) => {
         calls.push([m, ...args]);
         if (m === 'select') selected = true;
         // The query resolves after its last .eq (non-final) or .select (final).
         const done = (m === 'select' && calls.some((c) => c[0] === 'delete')) || (m === 'eq' && selected && args[0] === 'ref_id');
         return done ? Promise.resolve({ data: refs, error: null }) : builder;
      };
   }
   return { from: () => builder };
};

Deno.test('stampDecisionCards edits Discord messages; non-final keeps the refs, final claims them', async () => {
   const ref = {
      channel: 'discord',
      chat_id: null,
      webhook_key: 'DISCORD_REQUESTS_WEBHOOK_URL',
      message_id: '777',
      original_text: null,
      original_payload: { embeds: [{ title: '💸 New loan request' }] }
   };
   const patches: Array<{ url: string; method?: string; body: Record<string, unknown> }> = [];
   const realFetch = globalThis.fetch;
   Deno.env.set('DISCORD_REQUESTS_WEBHOOK_URL', HOOK);
   globalThis.fetch = ((url: string, init: RequestInit) => {
      patches.push({ url, method: init.method, body: JSON.parse(String(init.body)) });
      return Promise.resolve(new Response('{}'));
   }) as typeof fetch;
   try {
      const keepCalls: unknown[][] = [];
      assertEquals(await stampDecisionCards(refsClient([ref], keepCalls), 'loan', 'L1', '⚠️ OVERDUE', { by: 'system', final: false }), 1);
      assertEquals(keepCalls.some((c) => c[0] === 'delete'), false);
      const finalCalls: unknown[][] = [];
      assertEquals(await stampDecisionCards(refsClient([ref], finalCalls), 'loan', 'L1', '💸 REPAID (late)', { by: 'system' }), 1);
      assertEquals(finalCalls[0], ['delete']);

      assertEquals(patches.map((p) => [p.url, p.method]), [
         [`${HOOK}/messages/777`, 'PATCH'],
         [`${HOOK}/messages/777`, 'PATCH']
      ]);
      const embeds = (b: Record<string, unknown>) => b.embeds as Array<{ title: string }>;
      assertEquals(embeds(patches[0].body)[0].title, '⚠️ OVERDUE · 💸 New loan request');
      assertEquals(embeds(patches[1].body)[0].title, '💸 REPAID (late) · 💸 New loan request');
      assertEquals(patches[1].body.allowed_mentions, { parse: [] });
   } finally {
      globalThis.fetch = realFetch;
      Deno.env.delete('DISCORD_REQUESTS_WEBHOOK_URL');
   }
});
