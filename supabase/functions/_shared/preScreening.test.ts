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

const READ = {
   readable: true,
   problem: null,
   doc_type: 'gcash_history' as const,
   holder_name: 'Sample Person',
   institution: 'GCash',
   currency: 'PHP',
   period_start: '2026-10-15',
   period_end: '2026-11-14',
   months_covered: 1,
   transactions: 30,
   monthly_in: 12000,
   monthly_income_usd: 210,
   net_pay: null,
   warnings: []
};

Deno.test('pre-screening: a read proof of income counts as one more item in the score', () => {
   const grade = buildGrade(
      QUESTIONS,
      { work: 'driver', purpose: 'stock', repay: 'salary' },
      {
         answers: [
            { q: 'work', score: 8 },
            { q: 'purpose', score: 8 },
            { q: 'repay', score: 8 }
         ],
         income: { score: 4, note: 'Thin.' },
         flags: ['Said ₱30k a month, document shows ₱12k', '', 7]
      },
      { files: 2, read: READ }
   );
   assertEquals(grade.overall, 70);
   assertEquals(grade.income?.score, 4);
   assertEquals(grade.income?.files, 2);
   assertEquals(grade.flags, ['Said ₱30k a month, document shows ₱12k']);
});

Deno.test('pre-screening: a proof of income the AI could not read is not scored and does not pull the score down', () => {
   const grade = buildGrade(
      QUESTIONS,
      { work: 'driver', purpose: 'stock', repay: 'salary' },
      { answers: QUESTIONS.map((q) => ({ q: q.id, score: 9 })), income: { score: 0 } },
      { files: 1, read: { ...READ, readable: false, problem: 'password-protected' } }
   );
   assertEquals(grade.overall, 90);
   assertEquals(grade.income?.score, null);
   assertEquals(grade.income?.note.includes('password-protected'), true);
});

Deno.test('pre-screening: no proof of income sent = no income part', () => {
   const grade = buildGrade(QUESTIONS, { work: 'a', purpose: 'b', repay: 'c' }, { answers: QUESTIONS.map((q) => ({ q: q.id, score: 5 })) });
   assertEquals(grade.overall, 50);
   assertEquals(grade.income, null);
   assertEquals(grade.flags, []);
});

import { parsePreScreeningCallback } from './preScreeningDecision.ts';

Deno.test('pre-screening: decision buttons parse, and nothing else does', () => {
   const id = '0df3967b-1633-48ed-a5a6-17df9940e020';
   assertEquals(parsePreScreeningCallback(`ps:good:${id}`), { step: 'good', id });
   assertEquals(parsePreScreeningCallback(`ps:no_yes:${id}`), { step: 'no_yes', id });
   assertEquals(parsePreScreeningCallback(`pi:approve:${id}`), null);
   assertEquals(parsePreScreeningCallback(`ps:delete:${id}`), null);
   assertEquals(parsePreScreeningCallback(undefined), null);
});
