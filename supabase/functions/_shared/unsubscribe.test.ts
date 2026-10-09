import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

Deno.env.set('UNSUBSCRIBE_SECRET', 'test-secret');
const { isValidUnsubscribeToken, unsubscribeToken } = await import('./unsubscribe.ts');

const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';

Deno.test('a link only unsubscribes the person it was made for', async () => {
   const token = await unsubscribeToken(A);
   assert(/^[A-Za-z0-9_-]{24}$/.test(token));
   assertEquals(await isValidUnsubscribeToken(A, token), true);
   assertEquals(await isValidUnsubscribeToken(B, token), false);
   assertEquals(await isValidUnsubscribeToken(A, token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A')), false);
   assertEquals(await isValidUnsubscribeToken(A, ''), false);
});
