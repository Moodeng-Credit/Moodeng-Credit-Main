import { assertEquals, assertRejects } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { hmacSha256Hex, verifyStableyardWebhook } from './stableyard.ts';

const SECRET = 'whsec_test_123';
const NOW = 1_790_000_000;
const BODY =
   '{"id":"outbox_1","name":"deposit.settled","apiVersion":"2026-09-09","createdAt":"2026-10-01T12:05:00Z","payload":{"accountId":"acct_1","depositId":"deposit_1"}}';

const signedHeaders = async (overrides: Record<string, string> = {}, body = BODY, timestamp = NOW) => {
   const base: Record<string, string> = {
      'x-stableyard-event': 'deposit.settled',
      'x-stableyard-event-id': 'outbox_1',
      'x-stableyard-delivery': 'dlv_1',
      'x-stableyard-timestamp': String(timestamp)
   };
   const digest = await hmacSha256Hex(SECRET, `${timestamp}.${base['x-stableyard-delivery']}.${base['x-stableyard-event-id']}.${body}`);
   return new Headers({ ...base, 'x-stableyard-signature': `t=${timestamp},v1=${digest}`, ...overrides });
};

Deno.test('accepts a correctly signed delivery', async () => {
   const verified = await verifyStableyardWebhook(BODY, await signedHeaders(), SECRET, NOW + 10);
   assertEquals(verified, { deliveryId: 'dlv_1', eventId: 'outbox_1', eventName: 'deposit.settled', timestamp: NOW });
});

Deno.test('rejects a tampered body', async () => {
   const headers = await signedHeaders();
   await assertRejects(
      () => verifyStableyardWebhook(BODY.replace('deposit_1', 'deposit_2'), headers, SECRET, NOW),
      Error,
      'Invalid webhook signature'
   );
});

Deno.test('rejects the wrong secret', async () => {
   const headers = await signedHeaders();
   await assertRejects(() => verifyStableyardWebhook(BODY, headers, 'whsec_other', NOW), Error, 'Invalid webhook signature');
});

Deno.test('rejects a swapped event id (it is part of the signed payload)', async () => {
   const headers = await signedHeaders({ 'x-stableyard-event-id': 'outbox_2' });
   await assertRejects(() => verifyStableyardWebhook(BODY, headers, SECRET, NOW), Error, 'Invalid webhook signature');
});

Deno.test('rejects a stale timestamp', async () => {
   const headers = await signedHeaders();
   await assertRejects(() => verifyStableyardWebhook(BODY, headers, SECRET, NOW + 301), Error, 'outside tolerance');
});

Deno.test('rejects t= that does not match x-stableyard-timestamp', async () => {
   const headers = await signedHeaders({ 'x-stableyard-timestamp': String(NOW + 1) });
   await assertRejects(() => verifyStableyardWebhook(BODY, headers, SECRET, NOW), Error, 'timestamp mismatch');
});

Deno.test('rejects missing headers and malformed signatures', async () => {
   await assertRejects(() => verifyStableyardWebhook(BODY, new Headers(), SECRET, NOW), Error, 'Missing');
   const headers = await signedHeaders({ 'x-stableyard-signature': 'v1=abc' });
   await assertRejects(() => verifyStableyardWebhook(BODY, headers, SECRET, NOW), Error, 'Malformed');
});
