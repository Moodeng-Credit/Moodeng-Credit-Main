import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { extractVerifications } from './parse.ts';

// Existing thread reopened via the m.me link → bare `referral`.
Deno.test('referral event yields the code + PSID', () => {
   const payload = {
      object: 'page',
      entry: [{ messaging: [{ sender: { id: 'PSID_1' }, referral: { ref: 'MDNG-ABC123', source: 'SHORTLINK' } }] }]
   };
   assertEquals(extractVerifications(payload), [{ code: 'MDNG-ABC123', psid: 'PSID_1' }]);
});

// New thread: the code rides in on the Get Started postback.
Deno.test('postback.referral event yields the code + PSID', () => {
   const payload = {
      entry: [{ messaging: [{ sender: { id: 'PSID_2' }, postback: { payload: 'GET_STARTED', referral: { ref: 'MDNG-DEF456' } } }] }]
   };
   assertEquals(extractVerifications(payload), [{ code: 'MDNG-DEF456', psid: 'PSID_2' }]);
});

// First message carried the referral.
Deno.test('message.referral event yields the code + PSID', () => {
   const payload = {
      entry: [{ messaging: [{ sender: { id: 'PSID_3' }, message: { text: 'hi', referral: { ref: 'MDNG-AAA111' } } }] }]
   };
   assertEquals(extractVerifications(payload), [{ code: 'MDNG-AAA111', psid: 'PSID_3' }]);
});

// Meta / the phone may lower-case or re-case the ref; we normalize to the stored MDNG-UPPER shape.
Deno.test('lower-case ref is normalized to the stored code shape', () => {
   const payload = { entry: [{ messaging: [{ sender: { id: 'PSID_4' }, referral: { ref: 'mdng-abc123' } }] }] };
   assertEquals(extractVerifications(payload), [{ code: 'MDNG-ABC123', psid: 'PSID_4' }]);
});

// Events we can't act on are dropped rather than throwing.
Deno.test('events without a ref, without a sender, or without our code are skipped', () => {
   const payload = {
      entry: [
         { messaging: [{ sender: { id: 'PSID_5' } }] }, // no ref (e.g. a plain message)
         { messaging: [{ referral: { ref: 'MDNG-ZZZ999' } }] }, // no sender
         { messaging: [{ sender: { id: 'PSID_6' }, referral: { ref: 'hello there' } }] } // ref, but not our code
      ]
   };
   assertEquals(extractVerifications(payload), []);
});

// Batched delivery: several entries / messaging events flatten into the full list.
Deno.test('multiple entries and messaging events are flattened', () => {
   const payload = {
      entry: [
         { messaging: [{ sender: { id: 'A' }, referral: { ref: 'MDNG-111AAA' } }, { sender: { id: 'B' }, referral: { ref: 'MDNG-222BBB' } }] },
         { messaging: [{ sender: { id: 'C' }, postback: { referral: { ref: 'MDNG-333CCC' } } }] }
      ]
   };
   assertEquals(extractVerifications(payload), [
      { code: 'MDNG-111AAA', psid: 'A' },
      { code: 'MDNG-222BBB', psid: 'B' },
      { code: 'MDNG-333CCC', psid: 'C' }
   ]);
});

Deno.test('an empty / non-messaging body yields nothing', () => {
   assertEquals(extractVerifications({}), []);
   assertEquals(extractVerifications({ entry: [{}] }), []);
});
