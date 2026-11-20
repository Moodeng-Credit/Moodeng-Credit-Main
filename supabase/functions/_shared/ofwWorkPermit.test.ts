import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { capForPermit, cleanPlan, fallbackPlan, permitProblem, planQuestions, WORK_PERMIT_QUESTION } from './prescreenV2.ts';

Deno.test('OFW workers abroad get the ofw_worker plan; family of an OFW and helpers at home do not', () => {
   for (const job of ['Domestic helper', 'DH in HK', 'helper in Hong Kong', 'OFW caregiver Taiwan', 'Kasambahay sa Dubai', 'FDH Singapore', 'nanny abroad'])
      assertEquals(fallbackPlan(job).category, 'ofw_worker', job);
   assertEquals(fallbackPlan('kasambahay').category, 'household');
   assert(fallbackPlan('helper').category !== 'ofw_worker');
   assertEquals(fallbackPlan('my husband is OFW').category, 'ofw_family');
   assertEquals(fallbackPlan('OFW').category, 'ofw_family');
});

Deno.test('the ofw_worker plan asks for the work permit (skippable, never sticks anyone)', () => {
   const qs = planQuestions(fallbackPlan('DH in HK'), { jobVideo: false });
   const permit = qs.find((q) => q.id === 'work_permit');
   assert(permit);
   assertEquals(permit.kind, 'doc');
   assertEquals(permit.optional, true);
   assert(!planQuestions(fallbackPlan('farmer'), { jobVideo: false }).some((q) => q.id === 'work_permit'));
});

Deno.test("Gemini's plan: permit only for someone working abroad, never with no_income", () => {
   const base = { category: 'ofw_worker', questions: [{ text: 'Where do you work?' }], photos: [{ text: 'Take a photo of you at work' }] };
   assertEquals(cleanPlan({ ...base, permit: true })?.permit, true);
   assertEquals(cleanPlan({ ...base, permit: true, no_income: true })?.permit, undefined);
   assertEquals(cleanPlan(base)?.permit, undefined);
});

Deno.test('permit problem: skipped, unseen, expired or ending soon; fine when valid; nothing when not asked', () => {
   const asked = [{ id: 'job' }, { id: WORK_PERMIT_QUESTION.id }];
   assert(permitProblem(asked, [])?.includes('no work permit'));
   assert(permitProblem(asked, [{ q: 'work_permit', score: null }])?.includes('no work permit'));
   assert(permitProblem(asked, [{ q: 'work_permit', score: 2, note: 'Ended 2026-09-30' }])?.includes('Ended 2026-09-30'));
   assertEquals(permitProblem(asked, [{ q: 'work_permit', score: 8, note: 'Valid to 2027-06' }]), null);
   assertEquals(permitProblem([{ id: 'job' }], []), null);
});

Deno.test("Emma's rule: a permit problem keeps the score under 50", () => {
   assertEquals(capForPermit(82, 'OFW: no work permit'), 49);
   assertEquals(capForPermit(30, 'OFW: no work permit'), 30);
   assertEquals(capForPermit(82, null), 82);
   assertEquals(capForPermit(null, 'x'), null);
});
