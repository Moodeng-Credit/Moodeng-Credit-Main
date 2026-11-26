import { assertEquals } from 'jsr:@std/assert@1';

import { cleanTemplateParam, MESSENGER_TEMPLATES, metaPsidForContact, sendTemplateToContact, utilityTemplateBody } from './metaMessenger.ts';

// A fake service client whose event log holds the given rows (newest first).
const svcWithEvents = (rows: unknown[]) => ({
   from: () => {
      const q = { select: () => q, eq: () => q, order: () => q, limit: async () => ({ data: rows }) };
      return q;
   },
   rpc: async () => ({ data: '' })
});

Deno.test('Page templates: the four fallbacks use the names approved on the Page', () => {
   assertEquals(MESSENGER_TEMPLATES, {
      funded: 'moodeng_loan_funded',
      paymentReceived: 'moodeng_payment_received',
      rewardSent: 'moodeng_reward_sent',
      approved: 'moodeng_account_approved'
   });
});

Deno.test('Messenger id: latest sender_id from the event log, never the Page itself', async () => {
   const svc = svcWithEvents([
      { payload: { info: { message: { channel_data: { sender_id: '1148756028310286' } } } } },
      { payload: null },
      { payload: { info: { message: { channel_data: { sender_id: '24680135792468' } } } } }
   ]);
   assertEquals(await metaPsidForContact(svc, 'c1'), '24680135792468');
   assertEquals(await metaPsidForContact(svcWithEvents([]), 'c1'), null);
});

Deno.test('template fallback: no Messenger id and no Facebook name → not sent', async () => {
   const r = await sendTemplateToContact(svcWithEvents([]), { contactId: 'c1' }, { name: MESSENGER_TEMPLATES.approved, params: ['Ana'] });
   assertEquals(r, { ok: false, reason: 'no_messenger_id', steps: [] });
});

Deno.test('template params: no $, #, % or emoji (Meta rejects them)', () => {
   assertEquals(cleanTemplateParam('$20'), '20 USDC');
   assertEquals(cleanTemplateParam('$22.5 (part 1 of 2)'), '22.5 USDC (part 1 of 2)');
   assertEquals(cleanTemplateParam('Jo 🌸 Ann'), 'Jo Ann');
   assertEquals(cleanTemplateParam('Tue 24 Nov'), 'Tue 24 Nov');
});

Deno.test('utility body: UTILITY type, named template, cleaned body params', () => {
   const b = utilityTemplateBody('123456', { name: 'moodeng_repay_reminder', language: 'en', params: ['Ana', '$20', 'Mon 1 Dec'] });
   assertEquals(b.messaging_type, 'UTILITY');
   assertEquals(b.recipient.id, '123456');
   assertEquals(b.message.template.name, 'moodeng_repay_reminder');
   assertEquals(b.message.template.components[0].parameters.map((p) => p.text), ['Ana', '20 USDC', 'Mon 1 Dec']);
});
