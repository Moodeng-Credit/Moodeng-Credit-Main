import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { extractMessengerCodes } from './messengerCodes.ts';

Deno.test('bare ref from the m.me link', () => {
   assertEquals(extractMessengerCodes('MDNG-3D66AD'), ['MDNG-3D66AD']);
});

Deno.test('typed by hand: any case, any separator, surrounding words', () => {
   assertEquals(extractMessengerCodes('mdng 3d66ad'), ['MDNG-3D66AD']);
   assertEquals(extractMessengerCodes('MDNG3D66AD'), ['MDNG-3D66AD']);
   assertEquals(extractMessengerCodes('hi my code is MDNG–3D66AD. thanks'), ['MDNG-3D66AD']);
   assertEquals(extractMessengerCodes('verify_MDNG-3D66AD'), ['MDNG-3D66AD']);
});

Deno.test('forgives O / I / L typed for 0 / 1', () => {
   assertEquals(extractMessengerCodes('MDNG-4CC38O'), ['MDNG-4CC380']);
   assertEquals(extractMessengerCodes('MDNG-B0DI0L'), ['MDNG-B0D101']);
});

Deno.test('never lets a wildcard or a non-code through', () => {
   assertEquals(extractMessengerCodes('MDNG-%'), []);
   assertEquals(extractMessengerCodes('%'), []);
   assertEquals(extractMessengerCodes('MDNG-______'), []);
   assertEquals(extractMessengerCodes('MDNG-ZZZZZZ'), []);
   assertEquals(extractMessengerCodes('MDNG-3D66AD7'), []);
   assertEquals(extractMessengerCodes('hello'), []);
   assertEquals(extractMessengerCodes(null), []);
});

Deno.test('several codes in one message, de-duplicated', () => {
   assertEquals(extractMessengerCodes('MDNG-3D66AD or mdng-3d66ad or MDNG-95BC0D'), ['MDNG-3D66AD', 'MDNG-95BC0D']);
});
