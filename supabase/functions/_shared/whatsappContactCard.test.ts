import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { whatsappContactCard } from './whatsappContactCard.ts';

Deno.test('KYC name wins, with (Moodeng) after the last name', () => {
   assertEquals(whatsappContactCard('639173148740', { kycFirstName: 'Luis', kycLastName: 'Contreras', displayName: 'Lu' }), {
      phone_number: '+639173148740',
      first_name: 'Luis',
      last_name: 'Contreras (Moodeng)'
   });
});

Deno.test('falls back to display name, then username', () => {
   assertEquals(whatsappContactCard('639173148740', { displayName: ' Luis Contreras ' }), {
      phone_number: '+639173148740',
      first_name: 'Luis Contreras',
      last_name: '(Moodeng)'
   });
   assertEquals(whatsappContactCard('639173148740', { username: 'luisc' })?.first_name, '@luisc');
   assertEquals(whatsappContactCard('639173148740', {})?.first_name, 'Borrower');
});

Deno.test('no card without a usable number', () => {
   assertEquals(whatsappContactCard(null, { displayName: 'Luis' }), null);
   assertEquals(whatsappContactCard('123', { displayName: 'Luis' }), null);
});
