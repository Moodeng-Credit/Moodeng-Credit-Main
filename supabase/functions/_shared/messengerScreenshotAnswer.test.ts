import { assert } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { screenshotOpen } from './messengerPhotoIntake.ts';

const doc = (over: Record<string, unknown> = {}) => ({
   id: 'd1',
   decision: null,
   decided_by: null,
   questions: [
      { id: 'p1', kind: 'text' },
      { id: 'p2', kind: 'photo' }
   ],
   answers: [{ id: 'p1' }],
   ...over
});

Deno.test('a Messenger photo is the payslip screenshot answer only while that question is open', () => {
   assert(screenshotOpen(doc()));
   // Approved by itself (small step): still open.
   assert(screenshotOpen(doc({ decision: 'approved', decided_by: 'auto ($40 step)' })));
   // Already answered, a team decision, or no such question: a new document instead.
   assert(!screenshotOpen(doc({ answers: [{ id: 'p1' }, { id: 'p2' }] })));
   assert(!screenshotOpen(doc({ decision: 'approved', decided_by: 'george' })));
   assert(!screenshotOpen(doc({ decision: 'declined', decided_by: 'george' })));
   assert(!screenshotOpen(doc({ questions: [{ id: 'q1', kind: 'text' }] })));
});
