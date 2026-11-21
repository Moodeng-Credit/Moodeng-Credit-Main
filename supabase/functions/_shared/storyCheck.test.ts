import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { combineOpinions, FLAG_ONLY, opinionText, preScreeningContext } from './incomeDocs.ts';

const o = (verdict: 'lend' | 'maybe', mismatches: string[] = []) => ({ verdict, note: 'n', ask: [], repayChance: 80, reasons: [], mismatches });

Deno.test('story mismatches only when most reads found some', () => {
   const two = combineOpinions([o('lend', ['Says teacher, GCash shows store sales']), o('lend', ['Job and income differ']), o('lend')])!;
   assertEquals(two.mismatches.length, 1);
   const one = combineOpinions([o('lend', ['Says teacher, GCash shows store sales']), o('lend'), o('lend')])!;
   assertEquals(one.mismatches, []);
   assert(opinionText(two).includes("🔀 Doesn't fit:"));
   assert(!opinionText(one).includes('🔀'));
   assert(FLAG_ONLY.has('story_mismatch'));
});

Deno.test('pre-screening boiled down for the story check (made-up person)', () => {
   const ctx = preScreeningContext({
      name: 'Juan Dela Cruz',
      questions: [
         { id: 'job', kind: 'job', text: 'What is your job?', typed_job: 'teacher' },
         { id: 'job_q1', kind: 'text', text: 'Where do you teach?' },
         { id: 'medical', kind: 'medical', text: 'Medical?' }
      ],
      answers: [
         { q: 'job', text: 'teacher' },
         { q: 'job_q1', text: 'Grade 3, public school' },
         { q: 'medical', text: 'no' }
      ],
      grade: { summary: 'A teacher.', answers: [{ q: 'job_photo1', note: 'n', photo_check: { note: 'Classroom with children' } }, { q: 'intro', transcript: 'I am Juan, a teacher' }] }
   })!;
   assertEquals(ctx.job_typed, 'teacher');
   assertEquals(ctx.job_photo_showed, 'Classroom with children');
   assertEquals(ctx.answers.map((a) => a.question), ['What is your job?', 'Where do you teach?']);
   assertEquals(ctx.said_on_video.length, 1);
   assertEquals(preScreeningContext(null), null);
});
