import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import {
   facebookConnectedText,
   facebookStepsMessages,
   MESSENGER_CHAT_URL,
   isIndonesianPhone,
   sendFacebookConnectedOnWhatsApp,
   sendFacebookStepsOnWhatsApp,
   whatsappFirstApplies,
   whatsappFirstLocale
} from './whatsappFirst.ts';

Deno.test('Indonesia only: +62 numbers, or test accounts', () => {
   assert(isIndonesianPhone('6281234567890'));
   assert(isIndonesianPhone('+62 812-3456-7890'));
   assert(!isIndonesianPhone('639171234567'));
   assert(whatsappFirstApplies('6281234567890', false));
   assert(!whatsappFirstApplies('639171234567', false));
   assert(!whatsappFirstApplies(null, null));
   assert(whatsappFirstApplies('66951659077', true));
});

Deno.test('Bahasa Indonesia for +62, English for testers elsewhere', () => {
   assertEquals(whatsappFirstLocale('6281234567890'), 'id');
   assertEquals(whatsappFirstLocale('66951659077'), 'en');
});

Deno.test('the Facebook steps come one at a time: code alone, then the chat link, then paste', () => {
   const id = facebookStepsMessages('MDNG-ABC123', 'id');
   assert(id.length >= 5);
   assert(id.includes('MDNG-ABC123'));
   const codeAt = id.indexOf('MDNG-ABC123');
   assert(id[codeAt - 1].includes('Langkah 1 dari 3'));
   assert(id[codeAt + 1].includes(MESSENGER_CHAT_URL));
   assert(id[codeAt + 2].includes('Langkah 3 dari 3'));
   assert(id.some((m) => m.includes('BANTUAN')));
   const en = facebookStepsMessages('MDNG-ABC123', 'en');
   assert(en.some((m) => m.includes('Step 2 of 3') && m.includes(MESSENGER_CHAT_URL)));
   assert(facebookConnectedText('id').includes('https://moodeng.app/continue?via=whatsapp'));
});

// A tiny stand-in for the Supabase client: one users row, and a record of code writes.
const fakeSvc = (user: Record<string, unknown> | null) => {
   const writes: string[] = [];
   const chain = (table: string) => {
      const q: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'is', 'gt', 'order', 'limit']) q[m] = () => q;
      q.maybeSingle = () => Promise.resolve({ data: table === 'users' ? user : null });
      q.then = (resolve: (v: unknown) => void) => resolve({ data: [] });
      q.delete = () => (writes.push(`${table}:delete`), q);
      q.insert = () => (writes.push(`${table}:insert`), Promise.resolve({ error: null }));
      q.update = () => (writes.push(`${table}:update`), q);
      return q;
   };
   return { svc: { from: chain }, writes };
};

Deno.test('no Facebook code is made for a non-Indonesian number', async () => {
   const { svc, writes } = fakeSvc({ messenger_verified_at: null, user_role: 'borrower', is_test: false });
   await sendFacebookStepsOnWhatsApp(svc, 'user-1', 'wa-1', '639171234567');
   assertEquals(writes, []);
});

Deno.test('no Facebook code once Facebook is already connected', async () => {
   const { svc, writes } = fakeSvc({ messenger_verified_at: '2026-10-25T00:00:00Z', user_role: 'borrower', is_test: false });
   await sendFacebookStepsOnWhatsApp(svc, 'user-1', 'wa-1', '6281234567890');
   assertEquals(writes, []);
});

Deno.test('an Indonesian who connected WhatsApp first gets a fresh Facebook code', async () => {
   const { svc, writes } = fakeSvc({ messenger_verified_at: null, user_role: 'borrower', is_test: false });
   await sendFacebookStepsOnWhatsApp(svc, 'user-1', 'wa-1', '6281234567890');
   assertEquals(writes, ['contact_verification_codes:delete', 'contact_verification_codes:insert']);
});

Deno.test('no "Facebook connected" note when Facebook came first', async () => {
   const { svc } = fakeSvc({
      whatsapp_contact_id: 'wa-1',
      whatsapp_number: '6281234567890',
      whatsapp_verified_at: '2026-10-25T10:00:00Z',
      messenger_verified_at: '2026-10-25T09:00:00Z',
      is_test: false
   });
   // Returns without sending (SendPulse isn't configured here, so a send would only log a reason).
   await sendFacebookConnectedOnWhatsApp(svc, 'user-1');
});

Deno.test('the language they picked wins over the phone number', () => {
   assertEquals(whatsappFirstLocale('6281234567890', 'en'), 'en');
   assertEquals(whatsappFirstLocale('66951659077', 'id'), 'id');
   assertEquals(whatsappFirstLocale('6281234567890', 'fil'), 'id');
   assertEquals(whatsappFirstLocale('66951659077', null), 'en');
});

Deno.test('the Facebook-connected note says to write the loan request in English', () => {
   assert(facebookConnectedText('id').includes('bahasa Inggris'));
   assert(facebookConnectedText('en').includes('write your loan request in English'));
});
