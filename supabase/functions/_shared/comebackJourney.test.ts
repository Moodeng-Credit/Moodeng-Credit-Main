import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { dueStep, type JourneyStep } from './comebackJourney.ts';

const steps: JourneyStep[] = [
   { step: 1, delay_days: 3, subject: 's1', message: 'm1' },
   { step: 2, delay_days: 14, subject: 's2', message: 'm2' },
   { step: 3, delay_days: 30, subject: 's3', message: 'm3' }
];
const none = new Set<number>();

Deno.test('nothing before the first step', () => {
   assertEquals(dueStep(0, steps, none), null);
   assertEquals(dueStep(2, steps, none), null);
});

Deno.test('each step is due only inside its own week', () => {
   assertEquals(dueStep(3, steps, none)?.step, 1);
   assertEquals(dueStep(9, steps, none)?.step, 1);
   assertEquals(dueStep(10, steps, none), null);
   assertEquals(dueStep(14, steps, none)?.step, 2);
   assertEquals(dueStep(36, steps, none)?.step, 3);
   // Repaid long ago: nothing — launching the journey never blasts old borrowers.
   assertEquals(dueStep(37, steps, none), null);
   assertEquals(dueStep(200, steps, none), null);
});

Deno.test('a step already done this cycle is not sent again', () => {
   assertEquals(dueStep(5, steps, new Set([1])), null);
   assertEquals(dueStep(15, steps, new Set([1])), dueStep(15, steps, none));
});

Deno.test('overlapping weeks: the later step wins, and nothing goes backwards', () => {
   const close: JourneyStep[] = [
      { step: 1, delay_days: 3, subject: '', message: '' },
      { step: 2, delay_days: 5, subject: '', message: '' }
   ];
   assertEquals(dueStep(6, close, none)?.step, 2);
   // …and once it's out, the earlier step never follows.
   assertEquals(dueStep(6, close, new Set([2])), null);
});
