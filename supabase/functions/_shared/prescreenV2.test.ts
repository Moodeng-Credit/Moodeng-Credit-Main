import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { buildGrade, type PreScreenQuestion } from './preScreening.ts';
import { plainRedFlags } from './preScreeningAsk.ts';
import { fallbackPlan as fallbackPlanV2, jobRedFlags, noIncomeLine } from './prescreenV2.ts';
import {
   cleanPlan,
   fallbackPlan,
   insertPlan,
   medicalFromAnswer,
   medicalLine,
   medicalRedFlag,
   photoLine,
   photoRedFlags,
   photoWarnings,
   planQuestions,
   saidNoMedical,
   toCoach,
   toMedical,
   worstMedical
} from './prescreenV2.ts';

Deno.test('job plan: the fallback list picks the job', () => {
   assertEquals(fallbackPlan('Rice farmer').category, 'farmer');
   assertEquals(fallbackPlan('Public school teacher').category, 'teacher');
   assertEquals(fallbackPlan('Lalamove rider').category, 'driver_app');
   assertEquals(fallbackPlan('tricycle driver').category, 'driver');
   assertEquals(fallbackPlan('sari-sari store').category, 'store');
   assertEquals(fallbackPlan('Receptionist').category, 'employee');
   assertEquals(fallbackPlan('Receptionist').salaried, true);
   assertEquals(fallbackPlan('farmer').salaried, false);
   assertEquals(fallbackPlan('something odd').category, 'other');
   assertEquals(fallbackPlan('farmer').by, 'list');
});

Deno.test('job plan: Gemini output is cleaned, and unusable output is refused', () => {
   assertEquals(cleanPlan(null), null);
   assertEquals(cleanPlan({ questions: [], photos: [{ text: 'x' }] }), null);
   const plan = cleanPlan({
      category: 'farmer',
      salaried: 'yes',
      questions: [{ text: 'What do you farm?', hint: 'rice', good: 'names crops' }, { text: 'Own it?' }, { text: 'third' }],
      photos: [{ text: 'Take a photo of you at your farm', alt: 'your tools' }, { text: 'harvest' }, { text: 'third' }]
   });
   assert(plan);
   assertEquals(plan.questions.length, 2);
   assertEquals(plan.photos.length, 2);
   assertEquals(plan.salaried, false);
   assertEquals(plan.questions[1].good, 'A specific, believable answer.');
   assertEquals(plan.by, 'ai');
});

Deno.test('job plan: questions go right after the job, replacing an earlier plan', () => {
   const base = [
      { id: 'purpose', kind: 'text' },
      { id: 'job', kind: 'job' },
      { id: 'medical', kind: 'medical' }
   ];
   const farmer = planQuestions(fallbackPlan('farmer'), { jobVideo: true });
   assertEquals(
      farmer.map((q) => q.id),
      ['job_q1', 'job_q2', 'job_photo1', 'job_video']
   );
   const first = insertPlan(base, farmer, 'farmer', 'farmer');
   assertEquals(
      first.map((q) => q.id),
      ['purpose', 'job', 'job_q1', 'job_q2', 'job_photo1', 'job_video', 'medical']
   );
   assertEquals(first[1].typed_job, 'farmer');
   // Changed their job: the farmer questions go, the teacher ones (+ the COE) come in.
   const teacher = planQuestions(fallbackPlan('teacher'), { jobVideo: false });
   const second = insertPlan(first, teacher, 'teacher', 'teacher');
   assertEquals(
      second.map((q) => q.id),
      ['purpose', 'job', 'job_q1', 'job_q2', 'job_photo1', 'coe', 'medical']
   );
   assertEquals(second.find((q) => q.id === 'coe')?.optional, true);
   // No job question (an old row): nothing is added.
   assertEquals(insertPlan([{ id: 'purpose' }], farmer, 'farmer', 'farmer').length, 1);
});

Deno.test('coach: only a clear "not ok" with a hint flags; anything else passes', () => {
   assertEquals(toCoach({ ok: false, hint: 'Tell us what you farm.' }), { ok: false, hint: 'Tell us what you farm.' });
   assertEquals(toCoach({ ok: false }), { ok: true, hint: '' });
   assertEquals(toCoach({ ok: true, hint: 'x' }), { ok: true, hint: '' });
   assertEquals(toCoach('garbage'), { ok: true, hint: '' });
});

Deno.test('medical: "no" words, reads, the worst of several reads', () => {
   for (const no of ['no', 'No.', 'wala', 'Wala po', 'none', 'tidak ada', 'hindi po']) assert(saidNoMedical(no), no);
   for (const yes of ['my mother has diabetes', 'no money for her meds', 'yes']) assert(!saidNoMedical(yes), yes);
   assertEquals(toMedical({ severity: 'extreme' }), null);
   const low = toMedical({ severity: 'low', has_problem: true, condition: 'cold', loan_for: 'none' });
   const high = toMedical({ severity: 'high', who: 'mother', condition: 'dialysis', loan_for: 'ongoing', chronic: true });
   assertEquals(worstMedical([low, null, high])?.severity, 'high');
   assertEquals(worstMedical([null]), null);
   assertEquals(medicalRedFlag(low), null);
   assertEquals(medicalRedFlag(high), 'medical: mother, dialysis, loan for an ongoing cost');
   assert(medicalLine(high, 'Mama on dialysis')?.includes('🔴 HIGH'));
   assertEquals(medicalLine(medicalFromAnswer('no', null), 'no'), '🩺 Medical: no');
});

Deno.test('medical: without the AI, their own "future / ongoing" choice is high', () => {
   assertEquals(medicalFromAnswer('wala', null).severity, 'none');
   assertEquals(medicalFromAnswer('lola has asthma', 'ongoing').severity, 'high');
   assertEquals(medicalFromAnswer('lola has asthma', 'future').severity, 'high');
   assertEquals(medicalFromAnswer('lola has asthma', 'none').severity, 'medium');
   // Not graded and not "no": still stops auto ✅.
   assertEquals(medicalRedFlag(medicalFromAnswer('lola has asthma', 'paid')), 'medical: not graded by the AI — read their answer');
   assertEquals(medicalRedFlag(medicalFromAnswer('wala', null)), null);
});

Deno.test('photos: late, skipped, old file and screen are flagged; on time is clean', () => {
   const asked = '2026-11-20T07:00:00Z';
   const onTime = { photo: 'x.jpg', source: 'camera' as const, asked_at: asked, uploaded_at: '2026-11-20T07:02:10Z', late: false };
   assertEquals(photoWarnings(onTime, null), []);
   assert(
      photoLine(1, 'Take a photo of you at your farm', onTime, 8, {
         fits_ask: true,
         live_scene: true,
         screen_or_print: false,
         note: 'rice field'
      }).includes('2m10s after the ask')
   );
   assert(photoLine(1, 'x', onTime, 8, null).includes('14:02 BKK'));
   const late = { ...onTime, uploaded_at: '2026-11-20T07:07:30Z', late: true };
   assertEquals(photoWarnings(late, null), ['LATE: sent 7m30s after the ask']);
   // Gallery photos from the last 2 months are fine; older ones are flagged.
   const todayFile = { ...onTime, source: 'file' as const, file_modified_at: '2026-11-19T09:00:00Z' };
   assertEquals(photoWarnings(todayFile, null), []);
   assertEquals(photoWarnings({ ...todayFile, late: true, uploaded_at: '2026-11-20T07:09:00Z' }, null), []);
   assert(photoLine(1, 'x', todayFile, 8, null).includes('from gallery, taken'));
   const monthOld = { ...onTime, source: 'file' as const, file_modified_at: '2026-10-20T07:00:00Z' };
   assertEquals(photoWarnings(monthOld, null), []);
   assert(photoLine(1, 'x', monthOld, 8, null).includes('31 days before'));
   const oldFile = { ...onTime, source: 'file' as const, file_modified_at: '2026-09-01T07:00:00Z' };
   assertEquals(photoWarnings(oldFile, null), ['photo is older than 2 months']);
   assertEquals(photoWarnings(onTime, { fits_ask: true, live_scene: false, screen_or_print: true, note: '' }), [
      'looks like a photo of a screen or a printout'
   ]);
   assertEquals(photoWarnings({ skip: true, skip_reason: 'ran out of time' }, null), ['skipped (ran out of time)']);
   // Red flags: timing / source / screen only (a weak photo is a low score, not a red flag).
   assertEquals(
      photoRedFlags([
         { q: 'job_photo1', photo: late },
         { q: 'job_photo2', photo: onTime, photo_check: { fits_ask: false, live_scene: true, screen_or_print: false, note: '' } }
      ]),
      ['job photo #1: LATE: sent 7m30s after the ask']
   );
});

Deno.test('auto ✅ red flags: a high medical grade and a late photo stop it', () => {
   const high = toMedical({ severity: 'high', who: 'father', condition: 'stroke', loan_for: 'future' });
   const flags = plainRedFlags({
      answers: [{ q: 'job_photo1', transcript: null, note: '', photo: { photo: 'x', late: true, asked_at: null } }],
      medical: high
   });
   assertEquals(flags, ['medical: father, stroke, loan for a cost coming up', 'job photo #1: no ask time recorded']);
   assertEquals(plainRedFlags({ answers: [], medical: toMedical({ severity: 'medium' }) }), []);
});

Deno.test('grade: medical is never in the score; photos the AI saw count', () => {
   const questions: PreScreenQuestion[] = [
      { id: 'purpose', text: 'What is this loan for?', kind: 'text' },
      { id: 'job_photo1', text: 'Take a photo', kind: 'photo' },
      { id: 'coe', text: 'COE', kind: 'doc', optional: true },
      { id: 'medical', text: 'Medical?', kind: 'medical' }
   ];
   const model = {
      answers: [
         { q: 'purpose', score: 8, note: 'ok' },
         { q: 'job_photo1', score: 6, note: 'tools only' },
         { q: 'medical', score: 0, note: 'mother sick' }
      ]
   };
   const g = buildGrade(questions, { purpose: 'rice seeds', medical: 'mother sick' }, model, null, new Set(), {
      uncounted: new Set(['medical', 'coe']),
      looked: new Set(['job_photo1'])
   });
   assertEquals(g.overall, 70);
   assertEquals(g.unheard, 0);
   assertEquals(g.answers.find((a) => a.q === 'medical')?.score, null);
   assertEquals(g.answers.find((a) => a.q === 'job_photo1')?.score, 6);
   // The backup grader can't see photos: left out, not "not heard".
   const backup = buildGrade(questions, { purpose: 'rice seeds', medical: 'x' }, model, null, new Set(), {
      uncounted: new Set(['medical', 'coe', 'job_photo1'])
   });
   assertEquals(backup.overall, 80);
   assertEquals(backup.unheard, 0);
});

Deno.test('job keyword list: no-income, OFW family and gambling groups; "business" is not a bus', () => {
   assertEquals(fallbackPlanV2('housewife').noIncome, true);
   assertEquals(fallbackPlanV2('housewife').photos.length, 0);
   assertEquals(fallbackPlanV2('my husband is a seaman').category, 'ofw_family');
   assertEquals(fallbackPlanV2('online casino agent').sensitive, true);
   assertEquals(fallbackPlanV2('vending machine').sensitive, undefined);
   assertEquals(fallbackPlanV2('small business').category !== 'driver', true);
   assertEquals(fallbackPlanV2('babuyan, pig raiser').category, 'farmer');
   assertEquals(fallbackPlanV2('insurance agent').category !== 'bpo', true);
});

Deno.test('jobRedFlags / noIncomeLine: sensitive work and a job typed over and over', () => {
   assertEquals(jobRedFlags([{ kind: 'job', typed_job: 'sabungero', sensitive: true }]).length, 1);
   assertEquals(jobRedFlags([{ kind: 'job', typed_job: 'farmer' }]), []);
   assertEquals(jobRedFlags([{ kind: 'job' }], { _jobs: ['farmer', 'student', 'farmer', 'teacher'] }).length, 1);
   assertEquals(jobRedFlags([{ kind: 'job' }], { _jobs: ['farmer', 'Farmer'] }), []);
   assertEquals(noIncomeLine([{ kind: 'job', no_income: true }]) !== null, true);
   assertEquals(noIncomeLine([{ kind: 'job' }]), null);
});

Deno.test('job keyword list: any job abroad is an OFW worker; family of one is ofw_family; local jobs stay local', () => {
   for (const job of ['factory worker in Kuwait', 'OFW sa Saudi', 'driver in Dubai', 'nurse in Saudi Arabia', 'DH sa Saudi', 'TKI di Malaysia'])
      assertEquals(fallbackPlan(job).category, 'ofw_worker', job);
   for (const job of ['my husband is OFW in Dubai', 'suami saya TKI di Malaysia', 'my wife is a domestic helper in HK'])
      assertEquals(fallbackPlan(job).category, 'ofw_family', job);
   for (const job of ['helper sa Maynila', 'factory worker', 'Grab driver', 'tricycle driver', 'small business'])
      assert(!fallbackPlan(job).category.startsWith('ofw'), job);
});
