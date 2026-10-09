import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { isKycVerified, needsPreKycGate } from './preKycGate.ts';

Deno.test('any approved KYC method counts as verified', () => {
   assertEquals(isKycVerified({ is_didit: 'ACTIVE' }), true);
   assertEquals(isKycVerified({ is_world_id: 'ACTIVE' }), true);
   assertEquals(isKycVerified({ is_world_id_passport: 'ACTIVE' }), true);
   assertEquals(isKycVerified({ is_didit: 'INACTIVE', is_world_id: null }), false);
});

Deno.test('the gate reads the SQL rule and fails open on an error', async () => {
   const svc = (result: { data: unknown; error: unknown }) => ({ rpc: () => Promise.resolve(result) });
   assertEquals(await needsPreKycGate(svc({ data: true, error: null }), 'u'), true);
   assertEquals(await needsPreKycGate(svc({ data: false, error: null }), 'u'), false);
   assertEquals(await needsPreKycGate(svc({ data: null, error: { message: 'function does not exist' } }), 'u'), false);
});
