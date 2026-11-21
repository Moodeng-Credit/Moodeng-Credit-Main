import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { callInboxFor, isCallInbox, isPlaceholderEmail } from './placeholderEmail.ts';

Deno.test('placeholder sign-up addresses, including phone/guest and TikTok', () => {
   for (const e of ['phone_307d697b@moodeng.app', 'guest_abc123@moodeng.app', 'telegram_1@moodeng.credit', 'line_x@moodeng.app', 'tiktok_9@moodeng.app']) {
      assert(isPlaceholderEmail(e), e);
   }
   for (const e of ['maria@gmail.com', 'support@moodeng.app', 'support+guesttest1@moodeng.app', null]) assert(!isPlaceholderEmail(e), String(e));
});

Deno.test('call inbox: a real +tag on support@, recognised by email-inbound', () => {
   const inbox = callInboxFor('307d697b-59ad-4ab4-af85-0bae782963c5');
   assertEquals(inbox, 'support+call-307d697b59ad@moodeng.app');
   assert(isCallInbox(inbox));
   assert(isCallInbox('SUPPORT+call-307d697b59ad@moodeng.app'));
   assert(!isCallInbox('support@moodeng.app'));
   assert(!isPlaceholderEmail(inbox));
});
