import { assertEquals } from 'jsr:@std/assert@1';

import { cleanTemplateParam, utilityTemplateBody } from './metaMessenger.ts';

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
