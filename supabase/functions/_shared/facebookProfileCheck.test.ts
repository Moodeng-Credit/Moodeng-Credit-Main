import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { contactPhotoUrl, nameFlags, splitFacebookName } from './facebookProfileCheck.ts';

Deno.test('nameFlags: a normal name passes', () => {
   assertEquals(nameFlags('Maria', 'Santos'), []);
   assertEquals(nameFlags('Juan Miguel', 'dela Cruz'), []);
   assertEquals(nameFlags('Ana', 'de los Santos'), []);
   assertEquals(nameFlags('Mary-Ann', "O'Neil"), []);
});

Deno.test('nameFlags: missing or fake last name', () => {
   assertEquals(nameFlags('Maria', ''), ['no_last_name']);
   assertEquals(nameFlags('Maria', '.'), ['no_last_name']);
   assertEquals(nameFlags('Maria', 'S'), ['no_last_name']);
   assertEquals(nameFlags('Maria', 'Maria'), ['no_last_name']);
});

Deno.test('nameFlags: not capitalised', () => {
   assertEquals(nameFlags('claire', 'Santos'), ['lowercase_name']);
   assertEquals(nameFlags('Claire', 'santos'), ['lowercase_name']);
   assertEquals(nameFlags('claire', ''), ['no_last_name', 'lowercase_name']);
});

Deno.test('nameFlags: no name from SendPulse flags nothing', () => {
   assertEquals(nameFlags('', ''), []);
});

Deno.test('splitFacebookName: falls back to the full name', () => {
   assertEquals(splitFacebookName({ name: 'Maria Clara Santos' }), { first: 'Maria', last: 'Clara Santos' });
   assertEquals(splitFacebookName({ first_name: 'Maria', last_name: null }), { first: 'Maria', last: '' });
});

Deno.test('contactPhotoUrl: finds the picture field', () => {
   assertEquals(contactPhotoUrl({ id: 'c', channel_data: { profile_pic: 'https://x.test/p.jpg' } as never }), 'https://x.test/p.jpg');
   assertEquals(contactPhotoUrl({ id: 'c', channel_data: { name: 'A' } }), null);
   assertEquals(contactPhotoUrl(null), null);
});
