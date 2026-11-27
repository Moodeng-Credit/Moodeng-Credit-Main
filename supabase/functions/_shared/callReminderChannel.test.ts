import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { messengerOnlyText, mightBeReminderChannel, plainMessengerOnly } from './callReminderChannel.ts';

Deno.test('mightBeReminderChannel: short messages that could be about reminders', () => {
   for (const t of ['ok here in messenger only', 'dito na lang po', 'no other number', 'Smart lang meron ako', 'messenger is fine', 'no thanks', 'wala po ibang number']) {
      assert(mightBeReminderChannel(t), t);
   }
   for (const t of ['', 'ok', 'ok po', 'sige', 'yes', 'https://moodeng.app', 'magkano ang interest', 'x'.repeat(201)]) {
      assert(!mightBeReminderChannel(t), t);
   }
});

Deno.test('plainMessengerOnly: the plain ways, nothing more', () => {
   for (const t of ['ok here in messenger only', 'messenger only', 'Messenger lang po', 'sige dito na lang', 'ok po sa messenger lang', 'just here on messenger 👍']) {
      assert(plainMessengerOnly(t), t);
   }
   for (const t of ['ok', 'can I move my call', 'messenger is not working', 'I will send my Globe number']) {
      assert(!plainMessengerOnly(t), t);
   }
});

Deno.test('messengerOnlyText: call time + the ✅ an hour before', () => {
   const en = messengerOnlyText('Fri, Nov 27, 9:30 PM (Manila time)', 'en');
   assert(en.includes('Messenger only'));
   assert(en.includes('Fri, Nov 27, 9:30 PM (Manila time)'));
   assert(en.includes('1 hour before'));
   assertEquals(messengerOnlyText('X', 'fil').includes('dito sa Messenger'), true);
});
