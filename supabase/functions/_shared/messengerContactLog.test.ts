import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { planHistoryRows, rememberMessengerContact } from './messengerContactLog.ts';

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

// Just enough of the Supabase client for messenger_contacts: select…maybeSingle, upsert…select, update…eq.
const fakeContacts = (rows: Map<string, Record<string, unknown>>) => ({
   from: () => ({
      select: () => ({ eq: (_c: string, id: string) => ({ maybeSingle: () => Promise.resolve({ data: rows.get(id) ?? null }) }) }),
      upsert: (row: Record<string, unknown>) => ({
         select: () => {
            const id = row.contact_id as string;
            if (rows.has(id)) return Promise.resolve({ data: [], error: null });
            rows.set(id, row);
            return Promise.resolve({ data: [{ contact_id: id }], error: null });
         }
      }),
      update: (patch: Record<string, unknown>) => ({
         eq: (_c: string, id: string) => {
            rows.set(id, { ...rows.get(id), ...patch });
            return Promise.resolve({ error: null });
         }
      })
   })
});

Deno.test('rememberMessengerContact: a stranger is new once, keeps their name, counts messages', async () => {
   const rows = new Map<string, Record<string, unknown>>();
   const svc = fakeContacts(rows);
   let lookups = 0;
   const lookup = () => {
      lookups += 1;
      return Promise.resolve('JE Rem');
   };
   const first = await rememberMessengerContact(svc, 'c1', 'message', Date.parse('2026-10-22T14:00:00Z'), null, lookup);
   assertEquals(first, { isNew: true, facebookName: 'JE Rem' });
   const second = await rememberMessengerContact(svc, 'c1', 'message', Date.parse('2026-10-22T15:00:00Z'), null, lookup);
   assertEquals(second, { isNew: false, facebookName: 'JE Rem' });
   assertEquals(lookups, 1); // the name is only looked up while we don't have it
   assertEquals(rows.get('c1')?.message_count, 2);
   assertEquals(rows.get('c1')?.user_id, null);
});

Deno.test('rememberMessengerContact: links the borrower once they are known', async () => {
   const rows = new Map<string, Record<string, unknown>>([
      ['c2', { contact_id: 'c2', facebook_name: 'Ana', last_seen_at: '2026-10-22T14:00:00Z', message_count: 1, user_id: null }]
   ]);
   await rememberMessengerContact(fakeContacts(rows), 'c2', 'message', Date.parse('2026-10-22T15:00:00Z'), 'user-1', () => Promise.resolve(null));
   assertEquals(rows.get('c2')?.user_id, 'user-1');
   assertEquals(rows.get('c2')?.facebook_name, 'Ana');
});
