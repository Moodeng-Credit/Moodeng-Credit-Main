import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { addFacebookLines, facebookLine, mentionsIn, pickPeople, type FacebookPerson } from './teamFacebook.ts';

// Made-up people only (no real borrower data in the repo).
const ana: FacebookPerson = { id: 'u1', username: 'anareyes', email: 'ana@example.com', facebook_name: 'An Rey', messenger_psid: 'c-1' };
const ben: FacebookPerson = { id: 'u2', username: 'ben_t', telegram_username: '@bentg', facebook_name: 'Benny', facebook_profile_url: 'https://facebook.com/benny' };
const noFb: FacebookPerson = { id: 'u3', username: 'nofb' };
const chat = (id: string) => `https://login.sendpulse.com/chatbots/chats?contact_id=${id}&channel=messenger`;

Deno.test('facebookLine: name + SendPulse chat, profile when known, nothing without either', () => {
   assertEquals(facebookLine(ana), `👤 Facebook: An Rey — ${chat('c-1')}`);
   assertEquals(facebookLine(ben), '👤 Facebook: Benny — https://facebook.com/benny');
   assertEquals(facebookLine({ id: 'x', messenger_psid: 'c-9' }), `👤 Facebook: name not saved — ${chat('c-9')}`);
   assertEquals(facebookLine({ id: 'x', facebook_name: 'Solo' }), '👤 Facebook: Solo — no Messenger chat yet');
   assertEquals(facebookLine(noFb), null);
   assertEquals(facebookLine(ana, true), `👤 Facebook (@anareyes): An Rey — ${chat('c-1')}`);
});

Deno.test('mentionsIn: handles and emails, an email is not a handle', () => {
   assertEquals(mentionsIn('⚠️ Ana · @AnaReyes. (ana@example.com) with @george'), { handles: ['anareyes', 'george'], emails: ['ana@example.com'] });
});

Deno.test('pickPeople: exact one-account matches only, explicit ids first', () => {
   assertEquals(pickPeople('@anareyes repaid', [ana, ben]).map((p) => p.id), ['u1']);
   assertEquals(pickPeople('lender @bentg', [ana, ben]).map((p) => p.id), ['u2']);
   assertEquals(pickPeople('With: Ana (ana@example.com)', [ana]).map((p) => p.id), ['u1']);
   // ilike's _ wildcard can pull in near-misses; they don't count.
   assertEquals(pickPeople('@benxt', [ben]), []);
   // One handle, two accounts → nobody (a wrong Facebook is worse than none).
   assertEquals(pickPeople('@ben_t', [ben, { ...ana, id: 'u9', telegram_username: 'ben_t' }]), []);
   assertEquals(pickPeople('no mention', [ana, ben], ['u2']).map((p) => p.id), ['u2']);
});

Deno.test('addFacebookLines: appends, labels several, never twice', () => {
   assertEquals(addFacebookLines('Hi @anareyes', [ana]), `Hi @anareyes\n\n👤 Facebook: An Rey — ${chat('c-1')}`);
   const once = addFacebookLines('x', [ana]);
   assertEquals(addFacebookLines(once, [ana]), once);
   assertEquals(addFacebookLines('x', [ana, ben]).split('\n').slice(2), [
      `👤 Facebook (@anareyes): An Rey — ${chat('c-1')}`,
      '👤 Facebook (@ben_t): Benny — https://facebook.com/benny'
   ]);
   assertEquals(addFacebookLines('x', [noFb]), 'x');
   const long = 'a'.repeat(4090);
   assertEquals(addFacebookLines(long, [ana]), long);
});
