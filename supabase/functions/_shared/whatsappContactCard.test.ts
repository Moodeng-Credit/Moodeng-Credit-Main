import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { whatsappContactCard } from './whatsappContactCard.ts';

Deno.test('KYC name wins, with (Moodeng) after the last name', () => {
   assertEquals(whatsappContactCard('639170000001', { kycFirstName: 'Maria', kycLastName: 'Santos', displayName: 'Ria' }), {
      phone_number: '+639170000001',
      first_name: 'Maria',
      last_name: 'Santos (Moodeng)'
   });
});

Deno.test('falls back to display name, then username', () => {
   assertEquals(whatsappContactCard('639170000001', { displayName: '  Maria Santos ' }), {
      phone_number: '+639170000001',
      first_name: 'Maria Santos',
      last_name: '(Moodeng)'
   });
   assertEquals(whatsappContactCard('639170000001', { username: 'marias' })?.first_name, '@marias');
   assertEquals(whatsappContactCard('639170000001', {})?.first_name, 'Borrower');
});

Deno.test('no card without a usable number', () => {
   assertEquals(whatsappContactCard(null, { displayName: 'Maria' }), null);
   assertEquals(whatsappContactCard('123', { displayName: 'Maria' }), null);
});
