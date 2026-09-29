import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { parseSendPulseEvents } from './sendpulseEvents.ts';

const NOW = Date.parse('2026-09-29T07:23:00Z');

const subscribe = {
   service: 'messenger',
   title: 'new_subscriber',
   bot: { id: '81acb48b-e32c-4c85-b29f-0efae2ca2716', external_id: '1148756028310286', name: 'Moodeng Credit' },
   contact: { id: 'sp-contact-1', name: 'Aya Albarracin', last_message: 'Get started', variables: {} },
   date: Date.parse('2026-09-29T07:22:40Z')
};

Deno.test('a first-time "Get Started" without a code', () => {
   assertEquals(parseSendPulseEvents([subscribe], NOW), [
      {
         title: 'new_subscriber',
         botId: '81acb48b-e32c-4c85-b29f-0efae2ca2716',
         pageId: '1148756028310286',
         contactId: 'sp-contact-1',
         contactName: 'Aya Albarracin',
         codes: [],
         at: Date.parse('2026-09-29T07:22:40Z'),
         fromPerson: true
      }
   ]);
});

Deno.test('a single object (not an array) is accepted too', () => {
   assertEquals(parseSendPulseEvents(subscribe, NOW).length, 1);
});

Deno.test('codes from a typed message, the raw info, or the mdng_code the link set', () => {
   const typed = { ...subscribe, title: 'incoming_message', contact: { ...subscribe.contact, last_message: 'mdng 3d66ad' } };
   assertEquals(parseSendPulseEvents([typed], NOW)[0].codes, ['MDNG-3D66AD']);
   const info = { ...subscribe, title: 'incoming_message', info: { message: { text: 'code MDNG-95BC0D' } } };
   assertEquals(parseSendPulseEvents([info], NOW)[0].codes, ['MDNG-95BC0D']);
   const variable = { ...subscribe, contact: { ...subscribe.contact, variables: { mdng_code: 'MDNG-4CC380' } } };
   assertEquals(parseSendPulseEvents([variable], NOW)[0].codes, ['MDNG-4CC380']);
});

Deno.test("the bot's own outgoing messages never count as the person", () => {
   const outgoing = { ...subscribe, title: 'outgoing_message', contact: { ...subscribe.contact, last_message: 'MDNG-3D66AD' } };
   const [event] = parseSendPulseEvents([outgoing], NOW);
   assertEquals(event.fromPerson, false);
   assertEquals(event.codes, []);
   // Leaving or blocking the bot isn't reaching out either.
   for (const title of ['unsubscribe', 'bot_unsubscribe', 'bot_block', 'redirect', 'open_live_chat']) {
      assertEquals(parseSendPulseEvents([{ ...subscribe, title }], NOW)[0].fromPerson, false);
   }
});

Deno.test('other channels, junk and odd dates', () => {
   assertEquals(parseSendPulseEvents([{ ...subscribe, service: 'telegram' }], NOW), []);
   assertEquals(parseSendPulseEvents(null, NOW), []);
   assertEquals(parseSendPulseEvents(['x', 3], NOW), []);
   // Seconds are converted; the future is clamped to now; missing → now.
   assertEquals(parseSendPulseEvents([{ ...subscribe, date: 1790666560 }], NOW)[0].at, 1790666560000);
   assertEquals(parseSendPulseEvents([{ ...subscribe, date: NOW + 60_000 }], NOW)[0].at, NOW);
   assertEquals(parseSendPulseEvents([{ ...subscribe, date: undefined }], NOW)[0].at, NOW);
});
