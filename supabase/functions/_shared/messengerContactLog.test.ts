import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { planHistoryRows } from './messengerContactLog.ts';

Deno.test('only messages from the person are logged', () => {
   const plan = planHistoryRows(
      [
         { id: 'm1', direction: 1, created_at: '2026-10-01T07:57:00Z' },
         { id: 'm2', direction: 2, created_at: '2026-10-01T07:57:05Z' }
      ],
      []
   );
   assertEquals(plan.inserts, [{ sendpulse_message_id: 'm1', occurred_at: '2026-10-01T07:57:00.000Z' }]);
   assertEquals(plan.claims, []);
});

Deno.test('messages already synced are skipped', () => {
   const plan = planHistoryRows(
      [{ id: 'm1', direction: 1, created_at: '2026-10-01T07:57:00Z' }],
      [{ id: 7, occurred_at: '2026-10-01T07:57:00Z', sendpulse_message_id: 'm1' }]
   );
   assertEquals(plan, { inserts: [], claims: [] });
});

Deno.test('a message the webhook already logged is claimed, not duplicated', () => {
   const plan = planHistoryRows(
      [
         { id: 'm1', direction: 1, created_at: '2026-10-01T07:57:30Z' },
         { id: 'm2', direction: 1, created_at: '2026-10-01T07:57:40Z' }
      ],
      [{ id: 7, occurred_at: '2026-10-01T07:57:31Z', sendpulse_message_id: null }]
   );
   // One webhook row absorbs one message; the second message is new.
   assertEquals(plan.claims, [{ id: 7, sendpulse_message_id: 'm1' }]);
   assertEquals(plan.inserts, [{ sendpulse_message_id: 'm2', occurred_at: '2026-10-01T07:57:40.000Z' }]);
});

Deno.test('messages far from any webhook row are new', () => {
   const plan = planHistoryRows(
      [{ id: 'm1', direction: 1, created_at: '2026-10-05T10:00:00Z' }],
      [{ id: 7, occurred_at: '2026-10-01T07:57:31Z', sendpulse_message_id: null }]
   );
   assertEquals(plan.claims, []);
   assertEquals(plan.inserts.length, 1);
});
