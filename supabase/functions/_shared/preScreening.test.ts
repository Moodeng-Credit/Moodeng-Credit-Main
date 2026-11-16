import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { buildGrade, verdictFor } from './preScreening.ts';

const QUESTIONS = [
   { id: 'work', text: 'Job?' },
   { id: 'purpose', text: 'What for?' },
   { id: 'repay', text: 'How repay?' }
];

Deno.test('pre-screening: averages the three answers into a 0-100 score', () => {
   const grade = buildGrade(
      QUESTIONS,
      { work: 'I sell rice', purpose: 'stock', repay: 'from sales on Friday' },
      {
         summary: 'Sells rice.',
         answers: [
            { q: 'work', score: 8, note: 'clear' },
            { q: 'purpose', score: 6, note: 'ok' },
            { q: 'repay', score: 10, note: 'plan' }
         ]
      }
   );
   assertEquals(grade.overall, 80);
   assertEquals(grade.verdict, 'good');
   assertEquals(
      grade.answers.map((a) => a.score),
      [8, 6, 10]
   );
});

Deno.test('pre-screening: an unheard answer is left out of the score, not counted as a bad answer', () => {
   const grade = buildGrade(
      QUESTIONS,
      { work: 'driver', purpose: null, repay: 'salary' },
      {
         answers: [
            { q: 'work', score: 9 },
            { q: 'repay', score: 9 },
            { q: 'purpose', score: 10 }
         ]
      }
   );
   assertEquals(grade.overall, 90);
   assertEquals(grade.verdict, 'good');
   assertEquals(grade.unheard, 1);
   assertEquals(grade.answers[1].transcript, null);
   assertEquals(grade.answers[1].score, null);
});

Deno.test('pre-screening: no number when nothing was heard or the model skipped a heard answer', () => {
   assertEquals(buildGrade(QUESTIONS, {}, null).overall, null);
   const partial = buildGrade(QUESTIONS, { work: 'driver', purpose: 'load', repay: 'salary' }, { answers: [{ q: 'work', score: 9 }] });
   assertEquals(partial.overall, null);
   assertEquals(partial.verdict, null);
});

Deno.test('pre-screening: clamps scores the model sends out of range', () => {
   const grade = buildGrade(
      QUESTIONS,
      { work: 'a', purpose: 'b', repay: 'c' },
      {
         answers: [
            { q: 'work', score: 99 },
            { q: 'purpose', score: -4 },
            { q: 'repay', score: '7' }
         ]
      }
   );
   assertEquals(
      grade.answers.map((a) => a.score),
      [10, 0, 7]
   );
});

Deno.test('pre-screening: maps scores to verdicts', () => {
   assertEquals(verdictFor(70), 'good');
   assertEquals(verdictFor(69), 'ok');
   assertEquals(verdictFor(44), 'weak');
   assertEquals(verdictFor(null), null);
});
