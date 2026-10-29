import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { buildTikTokAutoReply, buildTikTokPing, tiktokTicketContext } from './tiktokSupport.ts';

const NIGHT = Date.parse('2026-10-23T17:00:00Z'); // midnight Bangkok
const DAY = Date.parse('2026-10-23T05:00:00Z'); // noon Bangkok

Deno.test('auto-reply is one plain-text message with a TikTok sign-up link for newcomers', () => {
   const text = buildTikTokAutoReply({ at: NIGHT, firstName: 'Ana', registered: false, locale: 'en' });
   assert(text.startsWith('Hi Ana! 👋'));
   assert(text.includes('offline right now'));
   assert(text.includes('utm_source=tiktok'));
   assert(text.includes('lang=en'));

   const fil = buildTikTokAutoReply({ at: DAY, firstName: null, registered: false, locale: 'fil' });
   assert(fil.includes('lang=fil'));
   assert(fil.includes('Unang loan mo'));

   const known = buildTikTokAutoReply({ at: DAY, firstName: 'Ana', registered: true, locale: 'en' });
   assert(!known.includes('http'));
});

Deno.test('ticket context: name, maybe-account hint, and the 48h rule', () => {
   const none = tiktokTicketContext({ name: 'Ana', username: 'ana.ph', maybe: null });
   assert(none.startsWith('TikTok · Ana (@ana.ph)'));
   assert(none.includes('not linked'));
   assert(none.includes('48h'));

   const maybe = tiktokTicketContext({ name: 'Ana', username: null, maybe: { id: 'u1', username: 'ana' } });
   assert(maybe.includes('maybe Moodeng account @ana'));
   assert(maybe.includes('not confirmed'));
});

Deno.test('telegram ping says TikTok and links to SendPulse', () => {
   const ping = buildTikTokPing({ name: 'Ana', username: 'ana.ph', body: 'how do I borrow?', startsConversation: true });
   assertEquals(ping.text.split('\n')[0], '🎵 New TikTok chat from Ana @ana.ph:');
   assert(ping.text.includes('> how do I borrow?'));
   assertEquals(ping.keyboard[0][0].text, '💬 Open SendPulse chats');
});
