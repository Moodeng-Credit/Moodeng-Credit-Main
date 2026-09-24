import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import {
   buildDecisionCallback,
   decideLoanAccess,
   findPendingRequest,
   parseDecisionCallback,
   shortId
} from './loanAccess.ts';

const REQ_ID = '3f2a9c10-1b2c-4d5e-8f90-a1b2c3d4e5f6';

// A tiny stand-in for the supabase-js query builder: every chained call is recorded, and the
// terminal await resolves through `respond(table, calls)`.
type Call = [string, ...unknown[]];
const fakeSupabase = (respond: (table: string, calls: Call[]) => { data: unknown; error: unknown }) => ({
   from(table: string) {
      const calls: Call[] = [];
      const builder: Record<string, unknown> = {};
      for (const method of ['select', 'eq', 'in', 'ilike', 'lt', 'update', 'insert']) {
         builder[method] = (...args: unknown[]) => {
            calls.push([method, ...args]);
            return builder;
         };
      }
      builder.maybeSingle = () => Promise.resolve(respond(table, calls));
      builder.single = () => Promise.resolve(respond(table, calls));
      builder.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
         Promise.resolve(respond(table, calls)).then(resolve, reject);
      return builder;
   }
});

Deno.test('admin button callback data round-trips and stays under Telegram’s 64-byte limit', () => {
   const approve = buildDecisionCallback('approved', REQ_ID);
   const reject = buildDecisionCallback('rejected', REQ_ID);
   assertEquals(approve, `la:a:${REQ_ID}`);
   assertEquals(new TextEncoder().encode(approve).length <= 64, true);
   assertEquals(parseDecisionCallback(approve), { decision: 'approved', requestId: REQ_ID });
   assertEquals(parseDecisionCallback(reject), { decision: 'rejected', requestId: REQ_ID });
});

Deno.test('unrelated or malformed callback data is ignored', () => {
   assertEquals(parseDecisionCallback(undefined), null);
   assertEquals(parseDecisionCallback('la:x:' + REQ_ID), null);
   assertEquals(parseDecisionCallback('la:a:not-a-uuid'), null);
   assertEquals(parseDecisionCallback('something-else'), null);
});

Deno.test('shortId is the 8-char prefix admins type after /approve', () => {
   assertEquals(shortId(REQ_ID), '3f2a9c10');
});

const pending = [
   { id: REQ_ID, user_id: 'u1', status: 'pending' },
   { id: '3f2a9c10-ffff-4d5e-8f90-000000000000', user_id: 'u2', status: 'pending' },
   { id: 'aa11bb22-1b2c-4d5e-8f90-a1b2c3d4e5f6', user_id: 'u3', status: 'pending' }
];

Deno.test('/approve <id prefix> finds the one pending request it names', async () => {
   const svc = fakeSupabase((table) => (table === 'loan_access_requests' ? { data: pending, error: null } : { data: null, error: null }));
   const found = await findPendingRequest(svc, 'aa11');
   assertEquals(typeof found === 'object' && found !== null ? found.user_id : found, 'u3');
});

Deno.test('/approve with a prefix shared by two requests asks for more of the id', async () => {
   const svc = fakeSupabase((table) => (table === 'loan_access_requests' ? { data: pending, error: null } : { data: null, error: null }));
   assertEquals(await findPendingRequest(svc, '3f2a9c10'), 'ambiguous');
});

Deno.test('/approve @username falls back to that borrower’s pending request', async () => {
   const svc = fakeSupabase((table) =>
      table === 'loan_access_requests' ? { data: pending, error: null } : { data: { id: 'u2' }, error: null }
   );
   const found = await findPendingRequest(svc, '@maria');
   assertEquals(typeof found === 'object' && found !== null ? found.user_id : found, 'u2');
});

Deno.test('a second admin tap on an already-decided request changes nothing', async () => {
   const svc = fakeSupabase((table, calls) => {
      const isUpdate = calls.some(([m]) => m === 'update');
      if (table === 'loan_access_requests' && isUpdate) return { data: null, error: null }; // no longer pending
      if (table === 'loan_access_requests') return { data: { status: 'approved', decided_by: '@george' }, error: null };
      throw new Error(`unexpected ${table} call — the borrower must not be touched`);
   });
   const result = await decideLoanAccess(svc, REQ_ID, 'rejected', '@emma');
   assertEquals(result, { ok: false, summary: 'Already approved by @george — nothing changed.' });
});

Deno.test('the decision update is conditional on the request still being pending', async () => {
   let updateCalls: Call[] = [];
   const svc = fakeSupabase((table, calls) => {
      if (table === 'loan_access_requests' && calls.some(([m]) => m === 'update')) {
         updateCalls = calls;
         return { data: null, error: null };
      }
      return { data: null, error: null };
   });
   await decideLoanAccess(svc, REQ_ID, 'approved', '@george');
   assertEquals(
      updateCalls.filter(([m]) => m === 'eq'),
      [
         ['eq', 'id', REQ_ID],
         ['eq', 'status', 'pending']
      ]
   );
});
