import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { bangkokHour, borrowCardImage, buildAutoReply, isSupportMessage, isTeamOnline, signUpUrl } from './messengerSupport.ts';

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
