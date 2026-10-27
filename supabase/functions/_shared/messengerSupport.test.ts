import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { bangkokHour, borrowCardImage, buildAutoReply, buildMessengerPing, isSupportMessage, isTeamOnline, signUpUrl } from './messengerSupport.ts';

const msg = (text: string | null, extra: Partial<{ hasAttachment: boolean; isButtonTap: boolean; codes: string[] }> = {}) => ({
   text,
   hasAttachment: false,
   isButtonTap: false,
   codes: [] as string[],
   ...extra
});

Deno.test('only real questions become tickets', () => {
   assert(isSupportMessage(msg('how do I repay?')));
   assert(isSupportMessage(msg(null, { hasAttachment: true })));
   assert(!isSupportMessage(msg('Get started')));
   assert(!isSupportMessage(msg('Menu')));
   assert(!isSupportMessage(msg('"menu"')));
   assert(isSupportMessage(msg('menu for repaying?')));
   assert(!isSupportMessage(msg('  ')));
   assert(!isSupportMessage(msg('MDNG-3D66AD', { codes: ['MDNG-3D66AD'] })));
   assert(!isSupportMessage(msg("I'll be there", { isButtonTap: true })));
});

Deno.test('team hours are 10 AM – 10 PM Bangkok', () => {
   assertEquals(bangkokHour(Date.parse('2026-10-23T03:00:00Z')), 10);
   assert(isTeamOnline(Date.parse('2026-10-23T03:00:00Z'))); // 10:00 Bangkok
   assert(isTeamOnline(Date.parse('2026-10-23T14:59:00Z'))); // 21:59
   assert(!isTeamOnline(Date.parse('2026-10-23T15:00:00Z'))); // 22:00
   assert(!isTeamOnline(Date.parse('2026-10-23T02:59:00Z'))); // 09:59
});

Deno.test('auto-reply: offline notice, and the sign-up card only for people without an account', () => {
   const night = buildAutoReply({ at: Date.parse('2026-10-23T17:00:00Z'), firstName: 'Ana', registered: false });
   assert(night.text.startsWith('Hi Ana! 👋'));
   assert(night.text.includes('offline right now'));
   assertEquals(night.card?.button.url, signUpUrl('en'));
   assertEquals(night.card?.imageUrl, borrowCardImage('en'));

   const day = buildAutoReply({ at: Date.parse('2026-10-23T05:00:00Z'), firstName: null, registered: true });
   assert(day.text.includes('will reply right here soon'));
   assertEquals(day.card, undefined);
});

Deno.test('auto-reply in Filipino, with Filipino links', () => {
   const fil = buildAutoReply({ at: Date.parse('2026-10-23T05:00:00Z'), firstName: 'Ana', registered: false, locale: 'fil' });
   assert(fil.text.includes('Salamat sa mensahe mo'));
   assert(fil.card?.button.url.includes('lang=fil'));
   assert(fil.card!.button.title.length <= 20);
   assertEquals(fil.card?.imageUrl, borrowCardImage('fil'));
});

Deno.test('Telegram ping names the sender and links the inbox', () => {
   const guest = buildMessengerPing({ facebookName: 'Ana Cruz', borrower: null, body: 'how do I borrow?', startsConversation: true });
   assert(guest.text.startsWith('💬 New Messenger chat from Ana Cruz (no Moodeng account yet):'));
   assert(guest.text.includes('> how do I borrow?'));
   assertEquals(guest.keyboard.length, 1);

   const borrower = buildMessengerPing({
      facebookName: 'Ana Cruz',
      borrower: { id: 'u1', username: 'ana', email: null, display_name: 'Ana', cs: 2 },
      body: 'paid already',
      startsConversation: false
   });
   assert(borrower.text.startsWith('💬 Ana @ana on Messenger:'));
   assertEquals(borrower.keyboard.length, 2);
});

Deno.test('Telegram ping drops Facebook photo links', () => {
   const ping = buildMessengerPing({
      facebookName: 'Ana',
      borrower: null,
      body: 'https://scontent.xx.fbcdn.net/v/t1.15752-9/1_n.jpg?_nc_cat=108\n📎 Sent a photo or file on Messenger — open the Page inbox to see it.',
      startsConversation: false
   });
   assert(!ping.text.includes('fbcdn'));
   assert(ping.text.includes('> 📎 Sent a photo'));
});
