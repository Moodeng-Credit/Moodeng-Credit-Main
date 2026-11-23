import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { BOOK_CALL_URL, bookCallWhatsAppText, firstNameOf, goodFitMessengerText, whatsAppTarget } from './bookCallLink.ts';

Deno.test('booking link goes to the connect screen', () => {
   assert(BOOK_CALL_URL.endsWith('/onboarding/connect'));
});

Deno.test('WhatsApp text: one line (Meta refuses new lines in a parameter) with the booking link', () => {
   for (const kind of ['good_fit', 'reminder'] as const) {
      const t = bookCallWhatsAppText(kind);
      assert(!/[\n\t]/.test(t));
      assert(!/ {5,}/.test(t));
      assert(t.includes(BOOK_CALL_URL));
      assert(t.length < 1000);
   }
});

Deno.test('✅ Messenger text carries the booking link', () => {
   assert(goodFitMessengerText().includes(BOOK_CALL_URL));
});

Deno.test('first name falls back to username, then "there"', () => {
   assertEquals(firstNameOf('Maria Santos', 'maria'), 'Maria');
   assertEquals(firstNameOf('  ', 'maria'), 'maria');
   assertEquals(firstNameOf(null, null), 'there');
});

Deno.test('WhatsApp target: chat first, else a verified number, else none', () => {
   assertEquals(whatsAppTarget({ whatsapp_contact_id: 'c1', whatsapp_number: '639000000000', whatsapp_verified_at: 'x' }), {
      contactId: 'c1'
   });
   assertEquals(whatsAppTarget({ whatsapp_number: '+63 900 000 0000', whatsapp_verified_at: 'x' }), { phone: '639000000000' });
   assertEquals(whatsAppTarget({ whatsapp_number: '639000000000', whatsapp_verified_at: null }), null);
   assertEquals(whatsAppTarget(null), null);
});
