import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { bookingBotAnswers, readBookingBotMode } from './bookingBotSwitch.ts';

Deno.test('booking bot switch: on = everyone, test / test-dry = test accounts, anything else = nobody', () => {
   assertEquals(['"on"', 'on', '"test"', 'test-dry', '', null, 'yes'].map(readBookingBotMode), ['on', 'on', 'test', 'test-dry', 'off', 'off', 'off']);
   assertEquals([bookingBotAnswers('on', false), bookingBotAnswers('on', null), bookingBotAnswers('test', true), bookingBotAnswers('test-dry', true)], [true, true, true, true]);
   assertEquals([bookingBotAnswers('test', false), bookingBotAnswers('off', true)], [false, false]);
});
