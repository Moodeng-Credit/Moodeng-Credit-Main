import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { limitUpFirstName, limitUpLang, limitUpMessengerText, limitUpWhatsAppLine } from './limitUpMessage.ts';
import { cleanTemplateParam } from './metaMessenger.ts';

Deno.test('limit-up: language and first name', () => {
   assertEquals(limitUpLang('fil'), 'fil');
   assertEquals(limitUpLang('tl-PH'), 'fil');
   assertEquals(limitUpLang('en'), 'en');
   assertEquals(limitUpLang(null), 'en');
   assertEquals(limitUpFirstName({ display_name: 'Maria Clara Santos' }), 'Maria');
   assertEquals(limitUpFirstName({ display_name: ' ', facebook_name: null, username: 'juan99' }), 'juan99');
   assertEquals(limitUpFirstName({}), 'there');
});

Deno.test('limit-up: Messenger text names both limits', () => {
   const text = limitUpMessengerText('Maria', 25, 35, 'en');
   assertStringIncludes(text, '$35');
   assertStringIncludes(text, '$25');
   assertStringIncludes(limitUpMessengerText('Maria', 25, 35, 'fil'), 'Tumaas');
});

Deno.test('limit-up: WhatsApp line survives template cleaning (no $)', () => {
   const line = cleanTemplateParam(limitUpWhatsAppLine(25, 35, 'en'));
   assertEquals(line.includes('$'), false);
   assertStringIncludes(line, '25 USDC to 35 USDC');
});
