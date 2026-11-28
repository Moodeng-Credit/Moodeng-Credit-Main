import { assertEquals } from 'jsr:@std/assert@1';
import { applyUrgency, shouting, urgencyCheck, urgentPhrase } from './preScreenUrgency.ts';

Deno.test('urgentPhrase: says it is urgent, in English or Tagalog', () => {
   for (const t of [
      'I urgently need a loan',
      'For emergency po',
      'need the money today',
      'asap please',
      'Kailangan ko agad',
      'kailangan ko po ngayon na',
      'please help me po',
      'apurahan po'
   ])
      assertEquals(typeof urgentPhrase(t), 'string', t);
});

Deno.test('urgentPhrase: normal answers are not urgent', () => {
   for (const t of [
      'Additional funds for bill',
      'I have an emergency fund',
      'I use my emergency savings',
      'I am working right now as a BPO agent',
      'I will pay immediately when salary comes',
      'My partner has a job',
      'kailangan ko ng puhunan para sa tindahan'
   ])
      assertEquals(urgentPhrase(t), null, t);
});

Deno.test('shouting: long typed answers in capitals only', () => {
   assertEquals(shouting('I NEED THIS LOAN FOR MY BILLS'), true);
   assertEquals(shouting('TASKUS'), false);
   assertEquals(shouting('Taskus Ortigas Food Delivery'), false);
   assertEquals(shouting('BPO agent at TaskUs'), false);
});

Deno.test('urgencyCheck + applyUrgency: big cut, held under 50', () => {
   const found = urgencyCheck([{ spoken: 'Hi, I need it urgently for rent' }, { typed: ['PAY ON TIME PROMISE PO'] }]);
   assertEquals(found?.caps, true);
   assertEquals(found?.reasons.length, 2);
   assertEquals(applyUrgency(85, found), 49);
   assertEquals(applyUrgency(60, found), 30);
   assertEquals(applyUrgency(85, urgencyCheck([{ spoken: 'Additional funds for bill', typed: ['No'] }])), 85);
   // CAPS only counts typed text, not the AI transcript.
   assertEquals(urgencyCheck([{ spoken: 'I WORK AT A CALL CENTER IN TAGUIG' }]), null);
});
