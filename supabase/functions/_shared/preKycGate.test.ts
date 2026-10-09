import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { isKycVerified, isKycWithDidit, needsPreKycGate } from './preKycGate.ts';

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

// Must match getVerificationUiState (src/lib/verificationUiState.ts) review / processing, and the
// exemption in needs_pre_kyc_gate — or the app and the server disagree on who is gated.
Deno.test('"already with Didit" matches the app: review and processing only', () => {
   const at = '2026-10-09T00:00:00Z';
   assertEquals(isKycWithDidit({ didit_id_status: 'In Review' }), true);
   assertEquals(isKycWithDidit({ didit_submitted_at: at, didit_id_status: null }), true);
   assertEquals(isKycWithDidit({ didit_submitted_at: at, didit_id_status: 'Declined' }), false);
   assertEquals(isKycWithDidit({ didit_submitted_at: at, didit_id_status: 'Expired' }), false);
   assertEquals(isKycWithDidit({ didit_submitted_at: at, didit_id_status: 'Not Started' }), false);
   assertEquals(isKycWithDidit({ didit_submitted_at: at, didit_id_status: 'DUPLICATE' }), false);
   assertEquals(isKycWithDidit({ didit_submitted_at: null, didit_id_status: null }), false);
});
