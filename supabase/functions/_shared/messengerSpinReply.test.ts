import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { parseSpinMessage, spinLink } from './messengerSpinReply.ts';

Deno.test('SPIN keyword: plain, with a code, and not a spin', () => {
   assertEquals(parseSpinMessage('SPIN'), null);
   assertEquals(parseSpinMessage(' spin! '), null);
   assertEquals(parseSpinMessage('Moo-Spin'), null);
   assertEquals(parseSpinMessage('spin payday'), 'PAYDAY');
   assertEquals(parseSpinMessage('can I spin?'), undefined);
   assertEquals(parseSpinMessage('spinach'), undefined);
   assertEquals(parseSpinMessage('spin the wheel please'), undefined);
});

Deno.test('spin link', () => {
   assertEquals(spinLink(null), 'https://moodeng.app/spin');
   assertEquals(spinLink('PAYDAY'), 'https://moodeng.app/spin/PAYDAY');
});
