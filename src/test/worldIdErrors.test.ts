import { describe, expect, it } from 'vitest';

import { getWorldIdFailureOutcome } from '@/components/worldId/worldIdErrors';

describe('getWorldIdFailureOutcome', () => {
   it('tells people without an Orb or passport credential to verify another way, not "server error"', () => {
      for (const code of ['credential_unavailable', 'world_id_4_not_available', 'world_id_3_not_available', 'feature_unavailable']) {
         expect(getWorldIdFailureOutcome(code)).toEqual({ kind: 'toast', toastKey: 'worldid_credential_missing' });
      }
   });

   it('maps a pending inclusion proof to its own message', () => {
      expect(getWorldIdFailureOutcome('inclusion_proof_pending')).toEqual({
         kind: 'toast',
         toastKey: 'worldid_credential_pending'
      });
   });

   it('treats transport failures as retryable connection problems', () => {
      for (const code of ['connection_failed', 'timeout', 'generic_error']) {
         expect(getWorldIdFailureOutcome(code)).toEqual({ kind: 'toast', toastKey: 'worldid_connection_failed' });
      }
   });

   it('reports setup problems on our side as World ID unavailable', () => {
      for (const code of ['invalid_rp_signature', 'unknown_rp', 'malformed_request']) {
         expect(getWorldIdFailureOutcome(code)).toEqual({ kind: 'toast', toastKey: 'worldid_unavailable' });
      }
   });

   it('shows the already-used modal for replayed nullifiers', () => {
      expect(getWorldIdFailureOutcome('nullifier_replayed')).toEqual({ kind: 'already_used' });
      expect(getWorldIdFailureOutcome('failed_by_host_app', { alreadyUsed: true })).toEqual({ kind: 'already_used' });
   });

   it('stays quiet when our own backend already reported the failure', () => {
      expect(getWorldIdFailureOutcome('failed_by_host_app')).toEqual({ kind: 'silent' });
   });

   it('only nags about cancelling when verification is not already finishing', () => {
      expect(getWorldIdFailureOutcome('user_rejected')).toEqual({ kind: 'toast', toastKey: 'worldid_not_completed' });
      expect(getWorldIdFailureOutcome('cancelled', { isFinishingVerification: true })).toEqual({ kind: 'silent' });
   });
});
