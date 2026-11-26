import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { type AckFacts, ackPrompt, ackStatusLine, cleanAck } from './messengerSmartAck.ts';

const facts = (over: Partial<AckFacts> = {}): AckFacts => ({
   firstName: 'Ana',
   locale: 'en',
   messages: [{ from: 'them', text: 'My store did great today!' }],
   loan: { owed: 17, due: 'Dec 16', payFrom: 'Dec 9' },
   ...over
});

Deno.test('status line is ours, in both languages', () => {
   assert(ackStatusLine(true, 'en').includes('reply right here soon'));
   assert(ackStatusLine(false, 'en').includes('10 AM Thai time (11 AM Philippine time)'));
   assert(ackStatusLine(false, 'fil').includes('11 AM sa Pilipinas'));
});

Deno.test('prompt carries the name and the real loan facts', () => {
   const p = ackPrompt(facts());
   assert(p.includes('"Hi Ana!"'));
   assert(p.includes('they owe $17, due Dec 16'));
   assert(p.includes('Dec 9 to Dec 16'));
   const none = ackPrompt(facts({ firstName: null, loan: null }));
   assert(none.includes('"Hi!"'));
   assert(none.includes('no open loan'));
});

Deno.test('a warm reaction is kept', () => {
   assertEquals(cleanAck('Hi Ana! That is great news 🎉', facts()), 'Hi Ana! That is great news 🎉');
   assertEquals(cleanAck('"Hi Ana! Thanks for the update"', facts()), 'Hi Ana! Thanks for the update.');
   assertEquals(
      cleanAck('Hi Ana! Thanks for telling us, your due date is Dec 16 and you owe $17.', facts()),
      'Hi Ana! Thanks for telling us, your due date is Dec 16 and you owe $17.'
   );
});

Deno.test('anything that decides, links or invents money falls back to the canned reply', () => {
   assertEquals(cleanAck('', facts()), null);
   assertEquals(cleanAck(null, facts()), null);
   assertEquals(cleanAck('Hi Ana! Sure, the 30th is fine.', facts()), null);
   assertEquals(cleanAck('Okay Ana, see you then!', facts()), null);
   assertEquals(cleanAck('Hi Ana! Your extension is approved.', facts()), null);
   assertEquals(cleanAck('Hi Ana! Pay at https://moodeng.app/repay', facts()), null);
   assertEquals(cleanAck('Hi Ana! You owe $20.', facts()), null);
   assertEquals(cleanAck('Hi Ana! You owe $17.', facts({ loan: null })), null);
   assertEquals(cleanAck(`Hi Ana! ${'so '.repeat(120)}`, facts()), null);
});
