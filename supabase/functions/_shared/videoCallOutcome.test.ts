import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { buildDecisionCallback, decisionKeyboard, parseDecisionCallback } from './loanAccess.ts';
import { formatCallTime } from './videoCall.ts';
import { buildOutcomeCallback, parseOutcomeCallback } from './videoCallOutcome.ts';

const USER = '00000000-0000-4000-8000-000000000102';
const REQ = '3f2a9c10-1b2c-4d5e-8f90-a1b2c3d4e5f6';

Deno.test('open-flow attendance buttons round-trip', () => {
   assertEquals(parseOutcomeCallback(buildOutcomeCallback('attended', USER)), { outcome: 'attended', userId: USER });
   assertEquals(parseOutcomeCallback(buildOutcomeCallback('no_show', USER)), { outcome: 'no_show', userId: USER });
   assertEquals(parseOutcomeCallback('la:a:' + REQ), null);
});

Deno.test('call-request No-show button round-trips through the loan-access callback', () => {
   assertEquals(parseDecisionCallback(buildDecisionCallback('no_show', REQ)), { decision: 'no_show', requestId: REQ });
});

Deno.test('a call request gets Showed up / No-show / Reject; an approval request gets Approve / Reject', () => {
   const call = decisionKeyboard({ id: REQ, kind: 'call' }).flat().map((b) => b.text);
   const approval = decisionKeyboard({ id: REQ, kind: 'approval' }).flat().map((b) => b.text);
   assertEquals(call, ['✅ Showed up', '❌ No-show', '🚫 Reject']);
   assertEquals(approval, ['✅ Approve', '❌ Reject']);
});

Deno.test('call time is shown in the borrower’s zone and names it', () => {
   assertEquals(formatCallTime('2026-09-25T03:00:00Z', 'Asia/Manila'), 'Fri, Sep 25, 11:00 AM (Manila time)');
   assertEquals(formatCallTime('2026-09-25T03:00:00Z', null), 'Fri, Sep 25, 10:00 AM (Bangkok time)');
   // A junk zone falls back to Bangkok rather than throwing.
   assertEquals(formatCallTime('2026-09-25T03:00:00Z', 'Not/AZone'), 'Fri, Sep 25, 10:00 AM (Bangkok time)');
});
